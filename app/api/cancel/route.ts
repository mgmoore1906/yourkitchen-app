import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import twilio from 'twilio'
import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
function getStripe() { return new Stripe(process.env.STRIPE_SECRET_KEY!) }
function getTwilio() { return twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!) }
async function sendSMS(to: string, body: string) {
  try {
      const client = getTwilio()
    await client.messages.create({ body, from: process.env.TWILIO_PHONE_NUMBER!, to })
  } catch (err: any) { console.error('SMS error:', err.message) }
}

async function sendCancelEmail(to: string, subject: string, html: string) {
  const rKey = process.env.RESEND_API_KEY
  if (!rKey || !to) return
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${rKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'YourKitchen <marques@yourkitchen.app>', to: [to], subject, html }),
    })
  } catch (err: any) { console.error('Cancel email error:', err.message) }
}

export async function POST(request: Request) {
  const stripe = getStripe()
  const supabase = getSupabase()
  try {
    const adminSecret = request.headers.get('x-admin-secret')
    if (adminSecret !== process.env.ADMIN_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { proposal_id, reason, reason_code, listed_price, correct_price } = await request.json()
    if (!proposal_id) return NextResponse.json({ error: 'proposal_id required' }, { status: 400 })

    // Fetch full proposal
    const { data: proposal, error } = await supabase
      .from('meal_proposals')
      .select(`
        id, status, delivery_status, payment_intent_id, stripe_session_id,
        meal_name, restaurant_name, meal_type, coordinator_email, kitchen_restaurant_id, menu_item_id,
        claims(calendar_date_id, guest_coordinators(phone, full_name)),
        kitchens:kitchen_id(id, recipient_id)
      `)
      .eq('id', proposal_id)
      .single()

    if (error || !proposal) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
    }

    const p = proposal as any

    if (p.delivery_status === 'dispatched') {
      return NextResponse.json({
        error: 'Order already dispatched — cancel directly in Shipday dashboard'
      }, { status: 400 })
    }

    // Idempotency: a re-clicked cancel is a safe no-op (no second void, no duplicate notices).
    if (p.status === 'cancelled' || p.delivery_status === 'cancelled') {
      return NextResponse.json({ success: true, alreadyCancelled: true, stripeResult: 'already_cancelled' })
    }

    // 1. Void / refund the Stripe payment if one was captured
    let stripeResult = 'no_payment'
    if (p.payment_intent_id) {
      try {
        const pi = await stripe.paymentIntents.retrieve(p.payment_intent_id)
        if (pi.status === 'requires_capture') {
          // Still on hold — cancel the authorization (no charge)
          await stripe.paymentIntents.cancel(p.payment_intent_id)
          stripeResult = 'authorization_cancelled'
        } else if (pi.status === 'succeeded') {
          // Already captured — issue a full refund
          await stripe.refunds.create({ payment_intent: p.payment_intent_id })
          stripeResult = 'refunded'
        }
      } catch (err: any) {
        console.error('[Cancel] Stripe error:', err.message)
        stripeResult = 'stripe_error'
      }
    }

    // 2. Mark proposal cancelled + re-open the calendar date
    await supabase.from('meal_proposals')
      .update({ status: 'cancelled', delivery_status: 'cancelled' })
      .eq('id', proposal_id)

    // Best-effort reason logging (no-op if the column hasn't been added yet)
    await supabase.from('meal_proposals')
      .update({ cancel_reason: reason_code || 'other' })
      .eq('id', proposal_id)

    if (p.claims?.calendar_date_id) {
      await supabase.from('calendar_dates')
        .update({ status: 'available' })
        .eq('id', p.claims.calendar_date_id)
    }

    const cancelReason = reason || 'Order cancelled by YourKitchen'
    const mealName = p.meal_name     || 'the meal'
    const restName = p.restaurant_name || 'the restaurant'

    // 3. SMS coordinator
    const coordPhone = p.claims?.guest_coordinators?.phone
    if (coordPhone) {
      const refundNote = stripeResult === 'refunded'
        ? ' A full refund has been issued to your card.'
        : stripeResult === 'authorization_cancelled'
        ? ' Your card was not charged.'
        : ''
      await sendSMS(
        coordPhone,
        `❌ Your YourKitchen order was cancelled.\n` +
        `${mealName} from ${restName}\n\n` +
        `${cancelReason}.${refundNote}\n\n— YourKitchen`
      )
    }

    // 4. SMS recipient
    if (p.kitchens?.recipient_id) {
      const { data: recipientProfile } = await supabase
        .from('profiles').select('phone').eq('id', p.kitchens.recipient_id).single()
      if (recipientProfile?.phone) {
        await sendSMS(
          recipientProfile.phone,
          `❌ Your ${mealName} order was cancelled.\n` +
          `${cancelReason}.\n\n` +
          `The date has been reopened for your village.\n\n— YourKitchen`
        )
      }
    }

    // 5. Price-mismatch emails — the actionable detail the SMS can't carry
    if (reason_code === 'price_mismatch') {
      const fmt = (v: any) => { const n = parseFloat(v); return isFinite(n) ? `$${n.toFixed(2)}` : null }
      const correct = fmt(correct_price)
      const listed = fmt(listed_price)
      const priceLine = (listed && correct)
        ? `It was entered as ${listed}, but ${restName}\u2019s current price is ${correct}.`
        : correct
        ? `${restName}\u2019s current price is ${correct}.`
        : `The price entered didn\u2019t match the restaurant\u2019s current price.`
      const coordName = p.claims?.guest_coordinators?.full_name || 'there'

      // The coordinator can't fix this — they don't own the menu. Correct the saved price ourselves
      // (on the recipient's menu) so the coordinator only has to resend.
      const correctNum = parseFloat(correct_price)
      if (isFinite(correctNum)) {
        if (p.menu_item_id) {
          await supabase.from('menu_items').update({ price: correctNum }).eq('id', p.menu_item_id)
        }
        if (p.kitchen_restaurant_id && p.meal_name) {
          const { data: kr } = await supabase.from('kitchen_restaurants')
            .select('favorite_meals, favorite_meal_prices').eq('id', p.kitchen_restaurant_id).single()
          const meals: string[] = (kr as any)?.favorite_meals || []
          const idx = meals.indexOf(p.meal_name)
          if (idx >= 0) {
            const prices: number[] = [...((kr as any)?.favorite_meal_prices || [])]
            while (prices.length < meals.length) prices.push(15)
            prices[idx] = correctNum
            await supabase.from('kitchen_restaurants').update({ favorite_meal_prices: prices }).eq('id', p.kitchen_restaurant_id)
          }
        }
      }

      if (p.coordinator_email) {
        const coordHtml = `
        <div style="font-family:'DM Sans',Arial,sans-serif;background:#FAFAF5;padding:28px 16px">
          <div style="max-width:460px;margin:0 auto;background:#fff;border:1px solid #DDE8E0;border-radius:18px;padding:30px 26px">
            <p style="font-size:11px;font-weight:700;color:#C17F47;letter-spacing:2px;text-transform:uppercase;margin:0 0 12px">Quick fix needed</p>
            <h1 style="font-family:Georgia,serif;font-size:21px;color:#1E2620;font-weight:500;line-height:1.3;margin:0 0 14px">Your meal is paused \u2014 but it\u2019s ready to resend.</h1>
            <p style="font-size:14px;color:#1E2620;line-height:1.6;margin:0 0 14px">Hi ${coordName}, the meal you sent \u2014 <b>${mealName}</b> from ${restName} \u2014 was paused because its menu price was out of date. ${priceLine}</p>
            <div style="background:#EAF2ED;border-radius:12px;padding:14px 18px;margin:0 0 18px">
              <p style="font-size:15px;color:#1E2620;font-weight:600;margin:0;font-family:Georgia,serif">Corrected price: ${correct || 'see the restaurant'}</p>
            </div>
            <p style="font-size:13.5px;color:#6B7066;line-height:1.6;margin:0 0 8px">We\u2019ve corrected it for you \u2014 just resend the meal and it\u2019ll go right through. Your card was not charged.</p>
            <p style="font-size:12.5px;color:#6B7066;line-height:1.6;margin:14px 0 0">Questions? Email <a href="mailto:support@yourkitchen.app" style="color:#3D6B4F">support@yourkitchen.app</a>.</p>
          </div>
        </div>`
        await sendCancelEmail(p.coordinator_email, 'A quick fix to send your meal', coordHtml)
      }

      if (p.kitchens?.recipient_id) {
        const { data: ru } = await supabase.auth.admin.getUserById(p.kitchens.recipient_id)
        const remail = (ru as any)?.user?.email
        if (remail) {
          const recipHtml = `
          <div style="font-family:'DM Sans',Arial,sans-serif;background:#FAFAF5;padding:28px 16px">
            <div style="max-width:460px;margin:0 auto;background:#fff;border:1px solid #DDE8E0;border-radius:18px;padding:30px 26px">
              <p style="font-size:11px;font-weight:700;color:#6B9E7E;letter-spacing:2px;text-transform:uppercase;margin:0 0 12px">A quick note</p>
              <h1 style="font-family:Georgia,serif;font-size:21px;color:#1E2620;font-weight:500;line-height:1.3;margin:0 0 14px">A meal was paused \u2014 nothing to worry about.</h1>
              <p style="font-size:14px;color:#1E2620;line-height:1.6;margin:0 0 14px">A meal your village sent (<b>${mealName}</b>) was paused because of an out-of-date menu price. We\u2019ve let the sender know, and they can resend it in a moment.</p>
              <p style="font-size:13.5px;color:#6B7066;line-height:1.6;margin:0">Your date has been reopened, so it stays available \u2014 nothing for you to do.</p>
              <p style="font-size:12.5px;color:#6B7066;line-height:1.6;margin:14px 0 0">Questions? Email <a href="mailto:support@yourkitchen.app" style="color:#3D6B4F">support@yourkitchen.app</a>.</p>
            </div>
          </div>`
          await sendCancelEmail(remail, 'A meal was paused \u2014 nothing to worry about', recipHtml)
        }
      }
    }

    console.log(`[Cancel] Proposal ${proposal_id} cancelled. Stripe: ${stripeResult}`)

    return NextResponse.json({ success: true, stripeResult })

  } catch (err: any) {
    console.error('[Cancel] Error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

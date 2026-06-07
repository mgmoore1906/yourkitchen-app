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
    await twClient.messages.create({ body, from: process.env.TWILIO_PHONE_NUMBER!, to })
  } catch (err: any) { console.error('SMS error:', err.message) }
}

export async function POST(request: Request) {
  const stripe = getStripe()
  const twClient = getTwilio()
  const supabase = getSupabase()
  try {
    const adminSecret = request.headers.get('x-admin-secret')
    if (adminSecret !== process.env.ADMIN_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { proposal_id, reason } = await request.json()
    if (!proposal_id) return NextResponse.json({ error: 'proposal_id required' }, { status: 400 })

    // Fetch full proposal
    const { data: proposal, error } = await supabase
      .from('meal_proposals')
      .select(`
        id, status, delivery_status, payment_intent_id, stripe_session_id,
        meal_name, restaurant_name, meal_type,
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

    console.log(`[Cancel] Proposal ${proposal_id} cancelled. Stripe: ${stripeResult}`)

    return NextResponse.json({ success: true, stripeResult })

  } catch (err: any) {
    console.error('[Cancel] Error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

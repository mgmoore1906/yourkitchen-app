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
  } catch (err: any) {
    console.error('SMS error:', err.message)
  }
}

const DEFAULT_TIME: Record<string, string> = { breakfast: '08:00', lunch: '12:00', dinner: '18:30' }
function prettyTime(t: string | null | undefined, mealType: string): string {
  const raw = (t && String(t).trim()) ? String(t).split('-')[0].trim() : DEFAULT_TIME[mealType] || '18:30'
  const [hStr, m] = raw.split(':')
  let h = parseInt(hStr, 10)
  if (isNaN(h)) return 'soon'
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12; if (h === 0) h = 12
  return `${h}:${m || '00'} ${ampm}`
}

export async function POST(request: Request) {
  const stripe = getStripe()
  const supabase = getSupabase()
  const body      = await request.text()
  const signature = request.headers.get('stripe-signature') || ''

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err: any) {
    console.error('Webhook signature error:', err.message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // ── checkout.session.completed ─────────────────────────────────────────────
  if (event.type === 'checkout.session.completed') {
    const session         = event.data.object as Stripe.Checkout.Session
    const paymentIntentId = session.payment_intent as string
    const type            = session.metadata?.type
    const proposalIds     = JSON.parse(session.metadata?.proposal_ids || '[]') as string[]
    const coordinatorName = session.metadata?.coordinator_name || ''

    // Tier upgrade — handles BOTH recurring subscriptions (Care+/Annual) and the
    // one-time Founding payment. Founding checkout uses mode:'payment' and does
    // not set metadata.type, so we key off the presence of metadata.tier rather
    // than type alone (otherwise founding buyers would pay and never get upgraded).
    const tierMeta = session.metadata?.tier
    if (type === 'subscription' || tierMeta) {
      const userId = session.metadata?.user_id
      const tier   = tierMeta
      if (userId && tier) {
        const update: Record<string, any> = { tier }
        // Founding = 3 years of Care+ access. Stamp the expiry at purchase so the
        // term is tracked from member #1 (even though nothing enforces it yet).
        if (tier === 'founding') {
          const expiry = new Date()
          expiry.setFullYear(expiry.getFullYear() + 3)
          update.founding_expires_at = expiry.toISOString()
        }
        await supabase.from('profiles').update(update).eq('id', userId)
        console.log(`Tier updated: ${userId} → ${tier}${tier === 'founding' ? ` (expires ${update.founding_expires_at})` : ''}`)
      }
      return NextResponse.json({ received: true })
    }

    // Proposal payment — save payment_intent_id + notify recipient
    if (type === 'proposal' && proposalIds.length > 0) {
      await supabase.from('meal_proposals')
        .update({ payment_intent_id: paymentIntentId })
        .in('id', proposalIds)

      const { data: proposals } = await supabase
        .from('meal_proposals')
        .select(`
          id, meal_type, delivery_time,
          claims(calendar_date_id, guest_coordinators(full_name)),
          kitchen_restaurants(name),
          menu_items(name),
          kitchens:kitchen_id(id, name, address, recipient_id)
        `)
        .in('id', proposalIds)

      for (const p of (proposals || []) as any[]) {
        if (p.claims?.calendar_date_id) {
          await supabase.from('calendar_dates')
            .update({ status: 'claimed' })
            .eq('id', p.claims.calendar_date_id)
        }

        const recipientId = p.kitchens?.recipient_id
        if (!recipientId) continue

        const { data: profile } = await supabase
          .from('profiles').select('phone').eq('id', recipientId).single()

        if (profile?.phone) {
          const mealLabel = p.meal_type === 'breakfast' ? 'breakfast'
            : p.meal_type === 'lunch' ? 'lunch' : 'dinner'
          await sendSMS(
            profile.phone,
            `${coordinatorName} wants to send you ${mealLabel} — ` +
            `${p.menu_items?.name} from ${p.kitchen_restaurants?.name}, arriving around ${prettyTime(p.delivery_time, p.meal_type)}.\n\n` +
            `Reply Y to confirm or N to decline.\n\n— YourKitchen`
          )
        }
      }
      console.log(`Payment authorized for ${proposalIds.length} proposal(s): ${paymentIntentId}`)
    }
  }

  // ── payment_intent.succeeded ───────────────────────────────────────────────
  // Stripe captured payment after recipient confirmed Y.
  // MANUAL DISPATCH GATE: do NOT auto-dispatch Shipday.
  // Mark proposal confirmed, alert Marques, wait for manual Dispatch tap.
  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object as Stripe.PaymentIntent

    const { data: proposal } = await supabase
      .from('meal_proposals')
      .select(`
        id, meal_type, status, tip_amount, delivery_date,
        claims(calendar_date_id, guest_coordinators(phone, full_name)),
        kitchen_restaurants(name, address, phone),
        menu_items(name, price),
        kitchens:kitchen_id(id, name, address, recipient_id)
      `)
      .eq('payment_intent_id', pi.id)
      .single()

    if (!proposal) {
      console.log('No proposal found for payment_intent:', pi.id)
      return NextResponse.json({ received: true })
    }

    const kitchen  = (proposal as any).kitchens
    const mealName = (proposal as any).menu_items?.name || 'the meal'
    const restName = (proposal as any).kitchen_restaurants?.name || 'the restaurant'
    const mealType = (proposal as any).meal_type || 'meal'

    // Update status → awaiting_dispatch (food order not yet placed).
    // Also store the captured total (cents) so analytics GMV has a source —
    // amount_received is what Stripe actually captured for this PaymentIntent.
    await supabase.from('meal_proposals')
      .update({
        status: 'confirmed',
        delivery_status: 'awaiting_dispatch',
        stripe_amount: pi.amount_received ?? pi.amount ?? null,
      })
      .eq('id', (proposal as any).id)

    // Alert Marques via SMS so he knows to place the food order
    const marquesPhone = process.env.MARQUES_PHONE
    if (marquesPhone) {
      const delivDate = (proposal as any).delivery_date
        ? new Date((proposal as any).delivery_date + 'T12:00:00')
            .toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
        : 'today'
      await sendSMS(
        marquesPhone,
        `🍽 YK ORDER READY\n` +
        `${mealName} from ${restName}\n` +
        `${mealType.charAt(0).toUpperCase() + mealType.slice(1)} · ${delivDate}\n` +
        `Delivery: ${kitchen?.address || 'address on file'}\n\n` +
        `1. Place order at restaurant\n` +
        `2. Tap Dispatch in admin panel\n\n` +
        `app.yourkitchen.app/admin`
      )
    }

    // Notify coordinator — payment captured, meal is being arranged
    const coordPhone = (proposal as any).claims?.guest_coordinators?.phone
    if (coordPhone) {
      await sendSMS(
        coordPhone,
        `✅ Your meal gift was confirmed! ${mealName} from ${restName} is being arranged for delivery.\n\n` +
        `We'll text you when it's on the way. Thank you for showing up. 🧡\n\n— YourKitchen`
      )
    }

    // Notify recipient — confirmed, delivery coming
    if (kitchen?.recipient_id) {
      const { data: recipientProfile } = await supabase
        .from('profiles').select('phone').eq('id', kitchen.recipient_id).single()
      if (recipientProfile?.phone) {
        await sendSMS(
          recipientProfile.phone,
          `✅ Confirmed! ${mealName} from ${restName} is being arranged. ` +
          `We'll send a tracking link once it's on the way.\n\n— YourKitchen`
        )
      }
    }

    console.log(`[Gate] Payment captured for proposal ${(proposal as any).id} — awaiting manual dispatch`)
  }

  return NextResponse.json({ received: true })
}

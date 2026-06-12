import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import twilio from 'twilio'
import Stripe from 'stripe'
import { notifyCoordinatorDeclined } from '@/lib/coordinator-notify'
export const dynamic = 'force-dynamic'
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
function getTwilio() { return twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!) }
function getStripe() { return new Stripe(process.env.STRIPE_SECRET_KEY!) }
function twiml(msg: string) {
  return new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${msg}</Message></Response>`,
    { headers: { 'Content-Type': 'text/xml' } }
  )
}

export async function POST(request: Request) {
  const stripe = getStripe()
  const twilioClient = getTwilio()
  const supabase = getSupabase()
  const formData = await request.formData()
  const body = (formData.get('Body') as string)?.trim().toUpperCase()
  const from  = formData.get('From') as string

  // Identify the sender. Two authorized parties can reply Y/N:
  //   1. The recipient (matched via their profile phone), or
  //   2. A confirmation proxy the recipient delegated to (matched via the
  //      kitchen's proxy_phone — the proxy may not have an account at all).
  let kitchen: { id: string } | null = null

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('phone', from)
    .single()

  if (profile) {
    const { data: k } = await supabase
      .from('kitchens')
      .select('id')
      .eq('recipient_id', profile.id)
      .eq('status', 'active')
      .single()
    kitchen = k
  }

  // No recipient match → see if this number is a kitchen's confirmation proxy.
  if (!kitchen) {
    const { data: k } = await supabase
      .from('kitchens')
      .select('id')
      .eq('proxy_phone', from)
      .eq('status', 'active')
      .single()
    kitchen = k
  }

  if (!kitchen) {
    return twiml("We couldn't find your Kitchen. Visit yourkitchen.app for help.")
  }

  // Pending proposals for this kitchen, newest first.
  const { data: pendings } = await supabase
    .from('meal_proposals')
    .select(`
      *,
      claims(*, calendar_dates(*, kitchens(*))),
      kitchen_restaurants(*),
      menu_items(*)
    `)
    .eq('status', 'pending')
    .eq('kitchen_id', kitchen.id)
    .order('proposed_at', { ascending: false })
    .limit(10)

  const pendingList = (pendings || []) as any[]
  if (pendingList.length === 0) {
    return twiml('No pending meal proposals found. — YourKitchen')
  }

  // With more than one meal waiting, a bare Y/N is ambiguous — it would always
  // hit the newest and silently ignore the rest. Route them to the app so each
  // meal gets its own answer instead of the wrong one being confirmed/declined.
  if (pendingList.length > 1 && ['Y', 'YES', 'N', 'NO'].includes(body)) {
    return twiml(`You have ${pendingList.length} meals waiting for a reply. Open app.yourkitchen.app/dashboard to confirm or decline each one. — YourKitchen`)
  }

  const proposal = pendingList[0]

  // ── Y / YES — confirm ────────────────────────────────────────────────────
  if (body === 'Y' || body === 'YES') {

    if (!proposal.payment_intent_id) {
      return twiml("We couldn't find the payment for this proposal. Please visit yourkitchen.app for help.")
    }

    // 1. Update DB
    await Promise.all([
      supabase
        .from('meal_proposals')
        .update({ status: 'confirmed', responded_at: new Date().toISOString() })
        .eq('id', proposal.id),
      supabase
        .from('calendar_dates')
        .update({ status: 'confirmed' })
        .eq('id', proposal.claims?.calendar_date_id),
    ])

    // 2. Capture Stripe hold → fires payment_intent.succeeded webhook → DoorDash dispatch
    try {
      await stripe.paymentIntents.capture(proposal.payment_intent_id)
    } catch (err: any) {
      console.error('Stripe capture failed:', err.message)
      return twiml("Payment capture failed. Please visit yourkitchen.app for help.")
    }

    return twiml(
      `✅ Confirmed! ${proposal.menu_items?.name} from ${proposal.kitchen_restaurants?.name} is on its way. You'll get a tracking link once DoorDash picks it up. — YourKitchen`
    )
  }

  // ── N / NO — decline ─────────────────────────────────────────────────────
  if (body === 'N' || body === 'NO') {

    // Cancel Stripe hold so coordinator isn't charged
    if (proposal.payment_intent_id) {
      try {
        await stripe.paymentIntents.cancel(proposal.payment_intent_id)
      } catch (err: any) {
        console.error('PaymentIntent cancel failed:', err.message)
      }
    }

    await Promise.all([
      supabase
        .from('meal_proposals')
        .update({ status: 'declined', responded_at: new Date().toISOString() })
        .eq('id', proposal.id),
      supabase
        .from('calendar_dates')
        .update({ status: 'available' })
        .eq('id', proposal.claims?.calendar_date_id),
    ])

    // Notify the coordinator their offer was declined (parity with the app flow).
    try {
      const kc = proposal.claims?.calendar_dates?.kitchens
      const items = Array.isArray(proposal.meal_items) ? proposal.meal_items : []
      const mealName = proposal.meal_name
        || (items.length ? items.map((i: any) => i.qty > 1 ? `${i.name} ×${i.qty}` : i.name).join(', ') : null)
        || proposal.menu_items?.name || 'the meal'
      const dateLabel = proposal.delivery_date
        ? new Date(proposal.delivery_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
        : null
      await notifyCoordinatorDeclined({
        coordinatorEmail: proposal.coordinator_email || null,
        coordinatorName: proposal.coordinator_name || null,
        recipientName: (kc?.name || '').split(/[\s']/)[0] || null,
        mealName,
        restName: proposal.kitchen_restaurants?.name || null,
        dateLabel,
        reason: null,
        slug: kc?.slug || null,
      })
    } catch (err: any) { console.error('Coordinator decline notify (SMS) failed:', err?.message) }

    return twiml(
      "Got it — we'll let them know. The date is back open for your village to claim. — YourKitchen"
    )
  }

  // ── Unrecognized reply ────────────────────────────────────────────────────
  return twiml('Reply Y to confirm your meal or N to decline. — YourKitchen')
}

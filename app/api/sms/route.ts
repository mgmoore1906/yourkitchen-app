import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import twilio from 'twilio'
import Stripe from 'stripe'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

function twiml(msg: string) {
  return new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${msg}</Message></Response>`,
    { headers: { 'Content-Type': 'text/xml' } }
  )
}

export async function POST(request: Request) {
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

  // Find most recent pending proposal for this kitchen
  const { data: proposal } = await supabase
    .from('meal_proposals')
    .select(`
      *,
      claims(*, calendar_dates(*, kitchens(*))),
      kitchen_restaurants(*),
      menu_items(*)
    `)
    .eq('status', 'pending')
    .order('proposed_at', { ascending: false })
    .limit(1)
    .single()

  if (!proposal) {
    return twiml('No pending meal proposals found.')
  }

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

    return twiml(
      "Got it — we'll let them know. The date is back open for your village to claim. — YourKitchen"
    )
  }

  // ── Unrecognized reply ────────────────────────────────────────────────────
  return twiml('Reply Y to confirm your meal or N to decline. — YourKitchen')
}

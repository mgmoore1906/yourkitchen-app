import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getSessionUserId } from '@/lib/requireUser'
import Stripe from 'stripe'
import { FOUNDING_AMOUNTS, type FoundingCircle } from '@/lib/foundingCheckout'

function getStripe() { return new Stripe(process.env.STRIPE_SECRET_KEY!) }
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Founding membership — one-time, BANK-ONLY checkout (ACH Direct Debit).
// Bank-only on purpose: ACH (~0.8%, $5 cap) is far cheaper than card, and the
// savings grow with the circle (~$24 on a $1,000 Partner). The "prefer card?"
// links elsewhere point at the hosted card Payment Links for anyone who'd rather
// tap a card. Amounts are inlined per circle (no price-ID env var to depend on).
// metadata.tier='founding' + metadata.circle let the stripe-webhook provision the
// right circle; the webhook ALSO detects the circle from the paid amount, so
// provisioning never hinges on the metadata tag alone.

const VALID: FoundingCircle[] = ['friend', 'patron', 'builder', 'partner']
const CIRCLE_PRODUCT_NAME: Record<FoundingCircle, string> = {
  friend:  'YourKitchen Founding Friend',
  patron:  'YourKitchen Founding Patron',
  builder: 'YourKitchen Founding Builder',
  partner: 'YourKitchen Founding Partner',
}

export async function POST(request: Request) {
  const stripe = getStripe()
  const supabase = getSupabase()
  try {
    const { user_id, circle: rawCircle } = await request.json()
    if (!user_id) return NextResponse.json({ error: 'Missing user_id' }, { status: 400 })

    const circle: FoundingCircle = VALID.includes(rawCircle) ? rawCircle : 'friend'
    const amount = FOUNDING_AMOUNTS[circle]

    const sessionUserId = await getSessionUserId()
    if (!sessionUserId || user_id !== sessionUserId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 401 })
    }

    // ACH Direct Debit requires an account-holder name, so make sure the Stripe
    // customer has one on file (mirrors the stripe-subscription route).
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name, stripe_customer_id')
      .eq('id', user_id)
      .single()

    const { data: authUser } = await supabase.auth.admin.getUserById(user_id)
    const email = authUser?.user?.email
    const customerName = profile?.full_name || email || 'YourKitchen Member'

    let customerId = profile?.stripe_customer_id
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: email || undefined,
        name: customerName,
        metadata: { user_id },
      })
      customerId = customer.id
      await supabase.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user_id)
    } else {
      await stripe.customers.update(customerId, { name: customerName })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.yourkitchen.app'

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment',
      payment_method_types: ['us_bank_account'], // BANK ONLY — no card on this checkout
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: amount,
          product_data: { name: CIRCLE_PRODUCT_NAME[circle] },
        },
      }],
      success_url: `${appUrl}/payment-success?tier=founding&circle=${circle}`,
      cancel_url: `${appUrl}/tiers`,
      client_reference_id: user_id,
      metadata: { user_id, tier: 'founding', circle },
      payment_intent_data: { metadata: { user_id, tier: 'founding', circle } },
    })

    return NextResponse.json({ url: session.url })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

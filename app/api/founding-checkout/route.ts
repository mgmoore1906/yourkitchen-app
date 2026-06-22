import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import Stripe from 'stripe'

function getStripe() { return new Stripe(process.env.STRIPE_SECRET_KEY!) }
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Founding membership — one-time $200, BANK-ONLY checkout (ACH Direct Debit).
// Bank-only on purpose: ACH costs ~$1.60 vs ~$6.10 on a card. The "Prefer card?"
// links elsewhere still point at the hosted card Payment Link for anyone who'd
// rather tap a card. Price is inlined ($200) so there's no price-ID env var to
// depend on. metadata.tier='founding' + metadata.user_id make the existing
// stripe-webhook provision founding + stamp the badge automatically.
const FOUNDING_AMOUNT_CENTS = 20000

export async function POST(request: Request) {
  const stripe = getStripe()
  const supabase = getSupabase()
  try {
    const { user_id } = await request.json()
    if (!user_id) return NextResponse.json({ error: 'Missing user_id' }, { status: 400 })

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
          unit_amount: FOUNDING_AMOUNT_CENTS,
          product_data: { name: 'YourKitchen Founding Membership' },
        },
      }],
      success_url: `${appUrl}/payment-success?tier=founding`,
      cancel_url: `${appUrl}/tiers`,
      client_reference_id: user_id,
      metadata: { user_id, tier: 'founding' },
      payment_intent_data: { metadata: { user_id, tier: 'founding' } },
    })

    return NextResponse.json({ url: session.url })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

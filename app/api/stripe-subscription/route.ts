import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Paid tiers → Stripe price IDs (set these env vars in Vercel)
const PRICE_IDS: Record<string, string | undefined> = {
  care:     process.env.STRIPE_PRICE_CARE,      // $9.99/mo (recurring)
  annual:   process.env.STRIPE_PRICE_ANNUAL,    // $59/yr  (recurring)
  founding: process.env.STRIPE_PRICE_FOUNDING,  // $149    (one-time)
}

export async function POST(request: Request) {
  const supabase = getSupabase()
  try {
    const { tier, user_id } = await request.json()

    if (!user_id) return NextResponse.json({ error: 'Missing user_id' }, { status: 400 })
    if (!tier)    return NextResponse.json({ error: 'Missing tier' }, { status: 400 })

    // ── Downgrade to Free — no Stripe, just update the profile ──
    if (tier === 'free') {
      const { error } = await supabase
        .from('profiles')
        .update({ tier: 'free' })
        .eq('id', user_id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true, tier: 'free' })
    }

    // ── Paid tiers ──
    const priceId = PRICE_IDS[tier]
    if (!priceId) {
      return NextResponse.json({ error: `Invalid or unconfigured tier: ${tier}` }, { status: 400 })
    }

    // Profile + email (Stripe needs a name to avoid "Name is required")
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('id, full_name, stripe_customer_id')
      .eq('id', user_id)
      .single()
    if (profileErr || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const { data: authUser } = await supabase.auth.admin.getUserById(user_id)
    const email = authUser?.user?.email
    const customerName = profile.full_name || email || 'YourKitchen Member'

    // Reuse or create the Stripe customer, always with a name on file
    let customerId = profile.stripe_customer_id
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

    const isLifetime = tier === 'founding'
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.yourkitchen.app'

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: isLifetime ? 'payment' : 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/payment-success?tier=${tier}`,
      cancel_url: `${appUrl}/tiers`,
      metadata: { user_id, tier },
      ...(isLifetime
        ? { payment_intent_data: { metadata: { user_id, tier } } }
        : { subscription_data: { metadata: { user_id, tier } } }),
    })

    return NextResponse.json({ url: session.url })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

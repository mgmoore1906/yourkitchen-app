import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getSessionUserId } from '@/lib/requireUser'
import Stripe from 'stripe'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function getStripe() { return new Stripe(process.env.STRIPE_SECRET_KEY!) }
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Care / Care+ recurring subscriptions. Card-based, server-created Checkout
// Session so the user is stamped on it (client_reference_id + metadata) — the
// stripe-webhook reads metadata.tier on checkout.session.completed and flips the
// right account. The DB stores only the PLAN (care | careplus), not the interval;
// Stripe's billing portal shows the customer their monthly-vs-annual.
const PLANS = {
  care_monthly:     { price: 'price_1TmbNT0sYTt6G0PfEJAmFxZg', tier: 'care' },
  care_annual:      { price: 'price_1TmbP70sYTt6G0Pf6QsuRCaH', tier: 'care' },
  careplus_monthly: { price: 'price_1TmbQZ0sYTt6G0Pf9iXPNdGE', tier: 'careplus' },
  careplus_annual:  { price: 'price_1TmbR60sYTt6G0PfV6ImyLKC', tier: 'careplus' },
} as const
type PlanKey = keyof typeof PLANS

export async function POST(request: Request) {
  const stripe = getStripe()
  const supabase = getSupabase()
  try {
    const { user_id, plan } = await request.json()
    if (!user_id) return NextResponse.json({ error: 'Missing user_id' }, { status: 400 })

    const sel = PLANS[plan as PlanKey]
    if (!sel) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })

    // A caller can only subscribe as themselves.
    const sessionUserId = await getSessionUserId()
    if (!sessionUserId || user_id !== sessionUserId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 401 })
    }

    // Reuse or create the Stripe customer (mirrors founding-checkout).
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
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: sel.price, quantity: 1 }],
      success_url: `${appUrl}/payment-success?tier=${sel.tier}`,
      cancel_url: `${appUrl}/plans`,
      client_reference_id: user_id,
      // The webhook keys off metadata.type='subscription' + metadata.tier.
      metadata: { user_id, type: 'subscription', tier: sel.tier },
      subscription_data: { metadata: { user_id, type: 'subscription', tier: sel.tier } },
    })

    return NextResponse.json({ url: session.url })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

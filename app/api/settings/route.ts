import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

const STRIPE_PRICES: Record<string, { priceId: string; mode: 'subscription' | 'payment' }> = {
  care:     { priceId: 'price_1TS7gX1qsEWj9oGNNeLys5Xb', mode: 'subscription' },
  annual:   { priceId: 'price_1TThbJ1qsEWj9oGNX0E6NnKj', mode: 'subscription' },
  founding: { priceId: 'price_1TThnS1qsEWj9oGNq7On7cJl', mode: 'payment'      },
}

export async function POST(request: Request) {
  try {
    const { tier, user_id } = await request.json()

    // Downgrade to free — just update DB, no Stripe needed
    if (tier === 'free') {
      await supabase.from('profiles').update({ tier: 'free' }).eq('id', user_id)
      return NextResponse.json({ success: true })
    }

    const plan = STRIPE_PRICES[tier]
    if (!plan) return NextResponse.json({ error: 'Invalid tier' }, { status: 400 })

    // Get user email for Stripe customer
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user_id)
      .single()

    const { data: { user } } = await supabase.auth.admin.getUserById(user_id)
    const email = user?.email || ''

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode:                 plan.mode,
      line_items: [{
        price:    plan.priceId,
        quantity: 1,
      }],
      customer_email: email,
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings?upgraded=${tier}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${process.env.NEXT_PUBLIC_APP_URL}/settings`,
      metadata: {
        type:    'subscription',
        tier,
        user_id,
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (err: any) {
    console.error('Stripe subscription error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

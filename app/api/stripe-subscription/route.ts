import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    const { plan, kitchen_id, user_id } = await request.json()

    if (!plan || !kitchen_id || !user_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const priceMap: Record<string, string> = {
      monthly:  process.env.STRIPE_PRICE_CARE_MONTHLY!,
      annual:   process.env.STRIPE_PRICE_CARE_ANNUAL!,
      lifetime: process.env.STRIPE_PRICE_LIFETIME!,
    }

    const priceId = priceMap[plan]
    if (!priceId) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
    }

    const isLifetime = plan === 'lifetime'

    const sessionConfig: any = {
      mode: isLifetime ? 'payment' : 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,                    // ← enables promo + gift codes at checkout
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?upgraded=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
      metadata: {
        kitchen_id,
        user_id,
        plan,
      },
    }

    if (!isLifetime) {
      sessionConfig.subscription_data = {
        trial_period_days: 14,
        metadata: {
          kitchen_id,
          user_id,
          plan,
        },
      }
    }

    const session = await stripe.checkout.sessions.create(sessionConfig)
    return NextResponse.json({ url: session.url })

  } catch (err: any) {
    console.error('Subscription checkout error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

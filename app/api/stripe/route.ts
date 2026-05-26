// FILE: app/api/stripe/route.ts
// Change: added automatic_payment_methods: { enabled: true }
// This is the single flag that unlocks Apple Pay, Google Pay, and Link
// in the PaymentElement — no other Stripe config needed.
// Apple Pay also requires a verified domain in Stripe Dashboard →
// Settings → Payment Methods → Apple Pay → Add domain → yourkitchen.app

import Stripe from 'stripe'
import { NextResponse } from 'next/server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(request: Request) {
  try {
    const { amount } = await request.json()

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // convert to cents
      currency: 'usd',
      capture_method: 'manual', // authorize now, capture on Y confirmation
      automatic_payment_methods: { enabled: true }, // ← NEW: unlocks Apple Pay + Google Pay
    })

    return NextResponse.json({
      client_secret: paymentIntent.client_secret,
      payment_intent_id: paymentIntent.id,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

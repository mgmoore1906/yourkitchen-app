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
    })

    return NextResponse.json({ 
      client_secret: paymentIntent.client_secret,
      payment_intent_id: paymentIntent.id
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

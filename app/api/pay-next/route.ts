import Stripe from 'stripe'
import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
function getStripe() { return new Stripe(process.env.STRIPE_SECRET_KEY!) }

// Multi-meal checkout chaining. Each per-meal Checkout session's success_url points
// here with the NEXT meal's session id (?s=...). We redirect the browser to that
// session's hosted Stripe checkout so the coordinator pays each meal in turn — one
// PaymentIntent per meal. When there's nothing left to pay (or the next session is
// already paid / expired), we fall through to the payment-success page.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('s')
  const done = `${process.env.NEXT_PUBLIC_APP_URL}/payment-success`
  if (!sessionId) return NextResponse.redirect(done)
  try {
    const stripe = getStripe()
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    if (session.status === 'complete' || session.payment_status === 'paid' || !session.url) {
      return NextResponse.redirect(done)
    }
    return NextResponse.redirect(session.url)
  } catch (err: any) {
    console.error('[pay-next] redirect failed:', err?.message)
    return NextResponse.redirect(done)
  }
}

import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(request: Request) {
  try {
    const { proposal_id, action } = await request.json()

    const { data: proposal } = await supabase
      .from('meal_proposals')
      .select('*, claims(calendar_date_id)')
      .eq('id', proposal_id)
      .single()

    if (!proposal) return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })

if (action === 'confirm') {
  let paymentIntentId = proposal.payment_intent_id

  // Fallback: look up payment intent from Stripe session if not saved by webhook
  if (!paymentIntentId && proposal.stripe_session_id) {
    try {
      const session = await stripe.checkout.sessions.retrieve(proposal.stripe_session_id)
      paymentIntentId = session.payment_intent as string | null
      if (paymentIntentId) {
        await supabase.from('meal_proposals')
          .update({ payment_intent_id: paymentIntentId })
          .eq('id', proposal_id)
      }
    } catch (err: any) {
      console.error('Session lookup failed:', err.message)
    }
  }

  if (!paymentIntentId) {
    return NextResponse.json({ error: 'Payment not yet authorized for this proposal' }, { status: 400 })
  }

  await Promise.all([
    supabase.from('meal_proposals')
      .update({ status: 'confirmed', responded_at: new Date().toISOString() })
      .eq('id', proposal_id),
    supabase.from('calendar_dates')
      .update({ status: 'confirmed' })
      .eq('id', proposal.claims?.calendar_date_id),
  ])

  await stripe.paymentIntents.capture(paymentIntentId)
  return NextResponse.json({ success: true })
}

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

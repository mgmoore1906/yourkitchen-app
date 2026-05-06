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
      if (!proposal.payment_intent_id) {
        return NextResponse.json({ error: 'Payment not yet authorized for this proposal' }, { status: 400 })
      }

      // Update DB first — webhook queries by status === 'confirmed'
      await Promise.all([
        supabase
          .from('meal_proposals')
          .update({ status: 'confirmed', responded_at: new Date().toISOString() })
          .eq('id', proposal_id),
        supabase
          .from('calendar_dates')
          .update({ status: 'confirmed' })
          .eq('id', proposal.claims?.calendar_date_id),
      ])

      // Capture the hold — fires payment_intent.succeeded webhook → DoorDash + SMS
      await stripe.paymentIntents.capture(proposal.payment_intent_id)

      return NextResponse.json({ success: true })

    } else if (action === 'decline') {
      // Cancel the hold so coordinator isn't charged
      if (proposal.payment_intent_id) {
        try {
          await stripe.paymentIntents.cancel(proposal.payment_intent_id)
        } catch (err: any) {
          console.error('PaymentIntent cancel failed:', err.message)
        }
      }

      await Promise.all([
        supabase
          .from('meal_proposals')
          .update({ status: 'declined', responded_at: new Date().toISOString() })
          .eq('id', proposal_id),
        supabase
          .from('calendar_dates')
          .update({ status: 'available' })
          .eq('id', proposal.claims?.calendar_date_id),
      ])

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

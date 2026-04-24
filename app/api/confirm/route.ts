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
      .select(`
        *,
        claims(
          calendar_date_id,
          guest_coordinators(full_name, email)
        ),
        kitchen_restaurants(name),
        menu_items(name, price)
      `)
      .eq('id', proposal_id)
      .single()

    if (!proposal) return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })

    if (action === 'confirm') {
      // Create Stripe payment link for coordinator
      const price = proposal.menu_items?.price || 20
      const platformFee = Math.round(price * 0.03 * 100) // 3% in cents
      const totalCents = Math.round(price * 100)

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${proposal.menu_items?.name} from ${proposal.kitchen_restaurants?.name}`,
              description: 'YourKitchen meal delivery',
            },
            unit_amount: totalCents,
          },
          quantity: 1,
        }],
        mode: 'payment',
        success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/payment-success`,
        cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard`,
       SELECT 
  mp.id,
  mp.status,
  gc.full_name,
  gc.email
FROM meal_proposals mp
JOIN claims c ON c.id = mp.claim_id
JOIN guest_coordinators gc ON gc.id = c.guest_coordinator_id
WHERE mp.status = 'pending';
        metadata: {
          proposal_id,
          coordinator_name: proposal.claims?.guest_coordinators?.full_name || '',
        },
      })

      // Update proposal status
      await supabase.from('meal_proposals').update({
        status: 'confirmed',
        responded_at: new Date().toISOString()
      }).eq('id', proposal_id)

      await supabase.from('calendar_dates').update({
        status: 'confirmed'
      }).eq('id', proposal.claims?.calendar_date_id)

      return NextResponse.json({ success: true, checkout_url: session.url })

    } else if (action === 'decline') {
      await supabase.from('meal_proposals').update({
        status: 'declined',
        responded_at: new Date().toISOString()
      }).eq('id', proposal_id)

      await supabase.from('calendar_dates').update({
        status: 'available'
      }).eq('id', proposal.claims?.calendar_date_id)

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

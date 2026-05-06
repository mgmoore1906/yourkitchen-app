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
    const { name, email, phone, note, proposals, kitchen_slug, tip_amount } = await request.json()

    const { data: guest, error: guestError } = await supabase
      .from('guest_coordinators')
      .insert({ full_name: name, email, phone: phone || null })
      .select('id')
      .single()
    if (guestError) return NextResponse.json({ error: guestError.message }, { status: 400 })

    const proposalIds: string[] = []
    const lineItems: any[]      = []

    for (const p of proposals) {
      const [{ data: menuItem }, { data: restaurant }, { data: calDate }] = await Promise.all([
        supabase.from('menu_items').select('name, price').eq('id', p.menu_item_id).single(),
        supabase.from('kitchen_restaurants').select('name').eq('id', p.restaurant_id).single(),
        supabase.from('calendar_dates').select('date').eq('id', p.calendar_date_id).single(),
      ])

      const { data: claim, error: claimError } = await supabase
        .from('claims')
        .insert({
          calendar_date_id:    p.calendar_date_id,
          guest_coordinator_id: guest.id,
          claim_type:          'one_time',
          status:              'active',
          expires_at:          new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
        })
        .select('id')
        .single()
      if (claimError) return NextResponse.json({ error: claimError.message }, { status: 400 })

      const { data: proposal, error: proposalError } = await supabase
        .from('meal_proposals')
        .insert({
          claim_id:             claim.id,
          kitchen_restaurant_id: p.restaurant_id,
          menu_item_id:         p.menu_item_id,
          coordinator_note:     note || null,
          tip_amount:           tip_amount || 0,
          status:               'pending',
        })
        .select('id')
        .single()
      if (proposalError) return NextResponse.json({ error: proposalError.message }, { status: 400 })

      proposalIds.push(proposal.id)

      const dateLabel = calDate?.date
        ? new Date(calDate.date + 'T12:00:00').toLocaleDateString('en-US', {
            weekday: 'short', month: 'short', day: 'numeric',
          })
        : ''

      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: {
            name: `${menuItem?.name ?? 'Meal'} from ${restaurant?.name ?? 'Restaurant'}`,
            description: dateLabel ? `Delivery on ${dateLabel}` : 'YourKitchen meal delivery',
          },
          unit_amount: Math.round((menuItem?.price ?? 20) * 100),
        },
        quantity: 1,
      })
    }

    // Add tip as a separate line item if provided
    const tipCents = tip_amount || 0
    if (tipCents > 0) {
      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Dasher Tip',
            description: 'Tip for your DoorDash driver',
          },
          unit_amount: tipCents,
        },
        quantity: 1,
      })
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types:  ['card'],
      line_items:             lineItems,
      mode:                  'payment',
      payment_intent_data:   { capture_method: 'manual' },
      customer_email:        email,
      success_url:           `${process.env.NEXT_PUBLIC_SITE_URL}/payment-success?type=proposal`,
      cancel_url:            `${process.env.NEXT_PUBLIC_SITE_URL}/k/${kitchen_slug ?? ''}`,
      metadata: {
        type:             'proposal',
        proposal_ids:     JSON.stringify(proposalIds),
        coordinator_name: name,
      },
    })

    return NextResponse.json({ checkout_url: session.url })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

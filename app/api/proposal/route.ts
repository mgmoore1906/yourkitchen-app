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

    // Guest coordinator
    const { data: guest, error: guestError } = await supabase
      .from('guest_coordinators')
      .insert({ full_name: name, email, phone: phone || null })
      .select('id')
      .single()
    if (guestError) return NextResponse.json({ error: guestError.message }, { status: 400 })

    // Kitchen — select id AND name
    const { data: kitchen } = await supabase
      .from('kitchens')
      .select('id, name')
      .eq('slug', kitchen_slug)
      .single()

    const recipientFirst = kitchen?.name ? kitchen.name.split("'")[0] : 'your recipient'

    const proposalIds: string[] = []
    const lineItems: any[] = []

    for (const p of proposals) {
      const [{ data: menuItem }, { data: restaurant }, { data: calDate }] = await Promise.all([
        supabase.from('menu_items').select('name, price').eq('id', p.menu_item_id).single(),
        supabase.from('kitchen_restaurants').select('name').eq('id', p.restaurant_id).single(),
        supabase.from('calendar_dates').select('date, meal_type').eq('id', p.calendar_date_id).single(),
      ])

      const { data: claim, error: claimError } = await supabase
        .from('claims')
        .insert({
          calendar_date_id:     p.calendar_date_id,
          guest_coordinator_id: guest.id,
          claim_type:           'one_time',
          status:               'active',
          expires_at:           new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
        })
        .select('id')
        .single()
      if (claimError) return NextResponse.json({ error: claimError.message }, { status: 400 })

      // Insert proposal with kitchen_id and coordinator_name
      const { data: proposal, error: proposalError } = await supabase
        .from('meal_proposals')
        .insert({
          claim_id:              claim.id,
          kitchen_id:            kitchen?.id || null,
          kitchen_restaurant_id: p.restaurant_id,
          menu_item_id:          p.menu_item_id,
          coordinator_name:      name,
          coordinator_note:      note || null,
          tip_amount:            tip_amount || 0,
          status:                'pending',
        })
        .select('id')
        .single()
      if (proposalError) return NextResponse.json({ error: proposalError.message }, { status: 400 })

      // Denormalize display fields for dashboard query
      if (proposal?.id) {
        await supabase
          .from('meal_proposals')
          .update({
            restaurant_name: restaurant?.name || null,
            meal_name:       menuItem?.name || null,
            delivery_date:   calDate?.date || null,
            meal_type:       (calDate as any)?.meal_type || 'dinner',
          })
          .eq('id', proposal.id)
      }

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
            name:        `${menuItem?.name ?? 'Meal'} from ${restaurant?.name ?? 'Restaurant'}`,
            description: dateLabel ? `Delivery on ${dateLabel}` : 'YourKitchen meal delivery',
          },
          unit_amount: Math.round((menuItem?.price ?? 20) * 100),
        },
        quantity: 1,
      })
    }

    // Tip line item
    if ((tip_amount || 0) > 0) {
      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: {
            name:        'Dasher Tip',
            description: 'Tip for your DoorDash driver',
          },
          unit_amount: tip_amount,
        },
        quantity: 1,
      })
    }

    // 3% YourKitchen platform fee
    const mealTotal  = lineItems
      .filter(li => li.price_data.product_data.name !== 'Dasher Tip')
      .reduce((sum, li) => sum + li.price_data.unit_amount, 0)
    const platformFee = Math.round(mealTotal * 0.03)
    if (platformFee > 0) {
      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: {
            name:        'YourKitchen service fee (3%)',
            description: 'Covers coordination, SMS notifications, and delivery integration',
          },
          unit_amount: platformFee,
        },
        quantity: 1,
      })
    }

    const session = await stripe.checkout.sessions.create({
  payment_method_types: ['card'],
  line_items:            lineItems,
  mode:                  'payment',
  payment_intent_data:   { capture_method: 'manual' },
  customer_email:        email,
  success_url:           `${process.env.NEXT_PUBLIC_APP_URL}/payment-success?recipient=${encodeURIComponent(recipientFirst)}`,
  cancel_url:            `${process.env.NEXT_PUBLIC_SITE_URL}/k/${kitchen_slug ?? ''}`,
  metadata: {
    type:             'proposal',
    proposal_ids:     JSON.stringify(proposalIds),
    coordinator_name: name,
  },
})

// Save payment_intent_id immediately — don't wait for webhook
const paymentIntentId = session.payment_intent as string | null
if (paymentIntentId && proposalIds.length > 0) {
  await supabase
    .from('meal_proposals')
    .update({ payment_intent_id: paymentIntentId })
    .in('id', proposalIds)
}

return NextResponse.json({ checkout_url: session.url })
;

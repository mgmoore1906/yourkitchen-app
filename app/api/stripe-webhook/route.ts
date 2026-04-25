import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import twilio from 'twilio'
import { DoorDashClient } from '@doordash/sdk'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
)

const doordash = new DoorDashClient({
  developer_id: process.env.DOORDASH_DEVELOPER_ID!,
  key_id: process.env.DOORDASH_KEY_ID!,
  signing_secret: process.env.DOORDASH_SIGNING_SECRET!,
})

export async function POST(request: Request) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')!

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err: any) {
    return NextResponse.json({ error: `Webhook error: ${err.message}` }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const proposal_id = session.metadata?.proposal_id

    if (!proposal_id) return NextResponse.json({ received: true })

    const { data: proposal } = await supabase
      .from('meal_proposals')
      .select(`
        *,
        claims(
          calendar_date_id,
          guest_coordinators(full_name, email),
          calendar_dates(date, kitchens(
            id,
            recipient_id,
            name,
            address
          ))
        ),
        kitchen_restaurants(name, address, phone),
        menu_items(name, price)
      `)
      .eq('id', proposal_id)
      .single()

    if (!proposal) return NextResponse.json({ received: true })

    await supabase.from('meal_proposals')
      .update({ status: 'paid' })
      .eq('id', proposal_id)

    const recipientId = proposal.claims?.calendar_dates?.kitchens?.recipient_id
    const { data: recipientProfile } = await supabase
      .from('profiles')
      .select('phone, full_name')
      .eq('id', recipientId)
      .single()

    const coordinatorName = proposal.claims?.guest_coordinators?.full_name
    const mealName = proposal.menu_items?.name
    const restaurantName = proposal.kitchen_restaurants?.name
    const restaurantAddress = proposal.kitchen_restaurants?.address
    const restaurantPhone = proposal.kitchen_restaurants?.phone
    const kitchenAddress = proposal.claims?.calendar_dates?.kitchens?.address
    const

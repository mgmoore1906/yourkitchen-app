import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import twilio from 'twilio'
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

    // Get full proposal details
    const { data: proposal } = await supabase
      .from('meal_proposals')
      .select(`
        *,
        claims(
          calendar_date_id,
          guest_coordinators(full_name, email),
          calendar_dates(date, kitchens(recipient_id, name))
        ),
        kitchen_restaurants(name),
        menu_items(name, price)
      `)
      .eq('id', proposal_id)
      .single()

    if (!proposal) return NextResponse.json({ received: true })

    // Update proposal to paid
    await supabase.from('meal_proposals').update({
      status: 'paid',
    }).eq('id', proposal_id)

    // Get recipient phone
    const recipientId = proposal.claims?.calendar_dates?.kitchens?.recipient_id
    const { data: recipientProfile } = await supabase
      .from('profiles')
      .select('phone')
      .eq('id', recipientId)
      .single()

    const dateFormatted = new Date(
      proposal.claims?.calendar_dates?.date + 'T12:00:00'
    ).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

    const coordinatorName = proposal.claims?.guest_coordinators?.full_name
    const mealName = proposal.menu_items?.name
    const restaurantName = proposal.kitchen_restaurants?.name

    // SMS to recipient
    if (recipientProfile?.phone) {
      await twilioClient.messages.create({
        body: `🧡 Your meal is confirmed! ${coordinatorName} sent you ${mealName} from ${restaurantName} on ${dateFormatted}. It's on its way. — YourKitchen`,
        from: process.env.TWILIO_PHONE_NUMBER!,
        to: recipientProfile.phone,
      })
    }

    // SMS to coordinator
    const coordinatorEmail = proposal.claims?.guest_coordinators?.email
    if (coordinatorEmail) {
      // Log notification
      await supabase.from('notifications').insert({
        kitchen_id: proposal.claims?.calendar_dates?.kitchens?.id,
        type: 'meal_paid',
        channel: 'sms',
        content: `Payment confirmed for ${mealName} on ${dateFormatted}`,
      })
    }
  }

  return NextResponse.json({ received: true })
}

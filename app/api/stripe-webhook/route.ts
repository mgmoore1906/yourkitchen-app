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

async function logToDb(supabase: any, kitchenId: string | null, message: string) {
  if (!kitchenId) return
  try {
    await supabase.from('notifications').insert({
      kitchen_id: kitchenId,
      type: 'meal_confirmed',
      channel: 'sms',
      content: `[DEBUG] ${message}`.slice(0, 500),
    })
  } catch (e) { /* swallow */ }
}

export async function POST(request: Request) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
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
          calendar_dates(date, kitchens(id, recipient_id, name, address))
        ),
        kitchen_restaurants(name, address, phone),
        menu_items(name, price)
      `)
      .eq('id', proposal_id)
      .single()

    if (!proposal) return NextResponse.json({ received: true })

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
    const totalCents = Math.round((proposal.menu_items?.price || 20) * 100)
    const kitchenId = proposal.claims?.calendar_dates?.kitchens?.id

    const dateFormatted = new Date(
      proposal.claims?.calendar_dates?.date + 'T12:00:00'
    ).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

    let doordashTrackingUrl: string | null = null
    let doordashDeliveryId: string | null = null

    // Log what we're about to send to DoorDash
    await logToDb(supabase, kitchenId,
      `DD inputs: pickup=${restaurantAddress} pickup_phone=${restaurantPhone} dropoff=${kitchenAddress} dropoff_phone=${recipientProfile?.phone}`
    )

    if (restaurantAddress && kitchenAddress) {
      try {
        const nameParts = (recipientProfile?.full_name || 'Guest').split(' ')
        const firstName = nameParts[0]
        const lastName = nameParts.slice(1).join(' ') || 'Recipient'

        const delivery = await doordash.createDelivery({
          external_delivery_id: proposal_id,
          pickup_address: restaurantAddress,
          pickup_business_name: restaurantName,
          pickup_phone_number: restaurantPhone || process.env.DOORDASH_SUPPORT_PHONE!,
          pickup_instructions: 'Order placed via YourKitchen.',
          dropoff_address: kitchenAddress,
          dropoff_phone_number: recipientProfile?.phone || process.env.DOORDASH_SUPPORT_PHONE!,
          dropoff_contact_given_name: firstName,
          dropoff_contact_family_name: lastName,
          dropoff_instructions: 'Please leave at the door.',
          order_value: totalCents,
        })

        const respStr = JSON.stringify(delivery).slice(0, 400)
        await logToDb(supabase, kitchenId, `DD response: ${respStr}`)

        doordashTrackingUrl = (delivery.data as any)?.tracking_url || null
        doordashDeliveryId = (delivery.data as any)?.external_delivery_id || proposal_id
      } catch (ddErr: any) {
        const errPayload = JSON.stringify({
          message: ddErr.message,
          name: ddErr.name,
          response: ddErr.response?.data,
          status: ddErr.response?.status,
        }).slice(0, 450)
        await logToDb(supabase, kitchenId, `DD ERROR: ${errPayload}`)
      }
    } else {
      await logToDb(supabase, kitchenId,
        `DD SKIPPED: restaurantAddress=${restaurantAddress} kitchenAddress=${kitchenAddress}`
      )
    }

    await supabase.from('meal_proposals').update({
      status: 'confirmed',
      doordash_delivery_id: doordashDeliveryId,
      doordash_tracking_url: doordashTrackingUrl,
    }).eq('id', proposal_id)

    if (recipientProfile?.phone) {
      const trackingLine = doordashTrackingUrl ? ` Track: ${doordashTrackingUrl}` : ''
      try {
        await twilioClient.messages.create({
          body: `🧡 Your meal is confirmed! ${coordinatorName} sent you ${mealName} from ${restaurantName} on ${dateFormatted}.${trackingLine}`,
          from: process.env.TWILIO_PHONE_NUMBER!,
          to: recipientProfile.phone,
        })
      } catch (twErr: any) {
        await logToDb(supabase, kitchenId, `Twilio ERROR: ${twErr.message}`)
      }
    }

    await supabase.from('notifications').insert({
      kitchen_id: kitchenId,
      type: 'meal_confirmed',
      channel: 'sms',
      content: `Payment confirmed for ${mealName} on ${dateFormatted}`,
    })
  }

  return NextResponse.json({ received: true })
}

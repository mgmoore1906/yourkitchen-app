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

// Parse "123 Main St, City, ST 12345" into DoorDash address components
function parseUSAddress(address: string) {
  const parts = address.split(',').map(p => p.trim())
  if (parts.length < 3) return null
  const stateZip = parts[2].trim().split(/\s+/)
  return {
    street: parts[0],
    city: parts[1],
    state: stateZip[0] || '',
    zip_code: stateZip[1] || '',
    country: 'US',
  }
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

  // ── Coordinator's card authorized at proposal time ──────────────────────
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    if (session.metadata?.type !== 'proposal') return NextResponse.json({ received: true })

    const proposalIds: string[] = JSON.parse(session.metadata.proposal_ids || '[]')
    const paymentIntentId = session.payment_intent as string
    if (!proposalIds.length || !paymentIntentId) return NextResponse.json({ received: true })

    // Store payment_intent_id on each proposal
    await supabase
      .from('meal_proposals')
      .update({ payment_intent_id: paymentIntentId })
      .in('id', proposalIds)

    // Mark calendar dates as claimed
    const { data: proposalRows } = await supabase
      .from('meal_proposals')
      .select('claims(calendar_date_id)')
      .in('id', proposalIds)

    const dateIds = (proposalRows || [])
      .map((p: any) => p.claims?.calendar_date_id)
      .filter(Boolean)

    if (dateIds.length > 0) {
      await supabase
        .from('calendar_dates')
        .update({ status: 'claimed' })
        .in('id', dateIds)
    }

    // Send "wants to send dinner" SMS to Danielle for each proposal
    for (const proposalId of proposalIds) {
      const { data: proposal } = await supabase
        .from('meal_proposals')
        .select(`
          *,
          claims(
            calendar_date_id,
            guest_coordinators(full_name),
            calendar_dates(date, kitchens(id, recipient_id, name))
          ),
          kitchen_restaurants(name),
          menu_items(name)
        `)
        .eq('id', proposalId)
        .single()

      if (!proposal) continue

      const recipientId = proposal.claims?.calendar_dates?.kitchens?.recipient_id
      const { data: recipientProfile } = await supabase
        .from('profiles')
        .select('phone')
        .eq('id', recipientId)
        .single()

      const coordinatorName = proposal.claims?.guest_coordinators?.full_name
      const mealName = proposal.menu_items?.name
      const restaurantName = proposal.kitchen_restaurants?.name
      const dateFormatted = new Date(
        proposal.claims?.calendar_dates?.date + 'T12:00:00'
      ).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

      if (recipientProfile?.phone) {
        try {
          await twilioClient.messages.create({
            body: `${coordinatorName} wants to send you dinner on ${dateFormatted} — ${mealName} from ${restaurantName}.\n\nReply Y to confirm or N to decline.\n\n— YourKitchen`,
            from: process.env.TWILIO_PHONE_NUMBER!,
            to: recipientProfile.phone,
          })
        } catch (twErr: any) {
          console.error('Twilio SMS failed:', twErr.message)
        }
      }

      await supabase.from('notifications').insert({
        kitchen_id: proposal.claims?.calendar_dates?.kitchens?.id,
        type: 'meal_proposed',
        channel: 'sms',
        content: `${coordinatorName} proposed ${mealName} on ${dateFormatted}`,
      })
    }
  }

  // ── Danielle said Y — card captured — fire DoorDash ────────────────────
  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object as Stripe.PaymentIntent

    const { data: proposals } = await supabase
      .from('meal_proposals')
      .select(`
        *,
        claims(
          calendar_date_id,
          guest_coordinators(full_name),
          calendar_dates(date, kitchens(id, recipient_id, name, address))
        ),
        kitchen_restaurants(name, address, phone),
        menu_items(name, price)
      `)
      .eq('payment_intent_id', paymentIntent.id)
      .eq('status', 'confirmed')

    if (!proposals?.length) return NextResponse.json({ received: true })

    for (const proposal of proposals) {
      // Skip if DoorDash already fired (idempotency guard)
      if (proposal.doordash_delivery_id) continue

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
      const kitchenId = proposal.claims?.calendar_dates?.kitchens?.id
      const totalCents = Math.round((proposal.menu_items?.price || 20) * 100)
      const dateFormatted = new Date(
        proposal.claims?.calendar_dates?.date + 'T12:00:00'
      ).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

      let doordashTrackingUrl: string | null = null
      let doordashDeliveryId: string | null = null

      if (restaurantAddress && kitchenAddress) {
        try {
          const nameParts = (recipientProfile?.full_name || 'Guest').split(' ')
          const addressComponents = parseUSAddress(kitchenAddress)

          // dropoff_time: delivery date at 7:00 PM Central Time
          const deliveryDate = proposal.claims?.calendar_dates?.date
          const dropoffTime = deliveryDate
            ? new Date(`${deliveryDate}T19:00:00-05:00`).toISOString()
            : undefined

          const deliveryPayload: any = {
            external_delivery_id: proposal.id,
            pickup_address: restaurantAddress,
            pickup_business_name: restaurantName,
            pickup_phone_number: restaurantPhone || process.env.DOORDASH_SUPPORT_PHONE!,
            pickup_instructions: 'Order placed via YourKitchen.',
            dropoff_address: kitchenAddress,
            dropoff_phone_number: recipientProfile?.phone || process.env.DOORDASH_SUPPORT_PHONE!,
            dropoff_contact_given_name: nameParts[0],
            dropoff_contact_family_name: nameParts.slice(1).join(' ') || 'Recipient',
            dropoff_instructions: 'Please leave at the door.',
            contactless_dropoff: true,
            order_value: totalCents,
            ...(addressComponents && { dropoff_address_components: addressComponents }),
            ...(dropoffTime && { dropoff_time: dropoffTime }),
          }

          const delivery = await doordash.createDelivery(deliveryPayload)
          doordashTrackingUrl = (delivery.data as any)?.tracking_url || null
          doordashDeliveryId = (delivery.data as any)?.external_delivery_id || proposal.id
        } catch (ddErr: any) {
          console.error('DoorDash createDelivery failed:', ddErr.message)
        }
      }

      await supabase.from('meal_proposals').update({
        doordash_delivery_id: doordashDeliveryId,
        doordash_tracking_url: doordashTrackingUrl,
      }).eq('id', proposal.id)

      if (recipientProfile?.phone) {
        const trackingLine = doordashTrackingUrl ? ` Track: ${doordashTrackingUrl}` : ''
        try {
          await twilioClient.messages.create({
            body: `🧡 Confirmed! ${coordinatorName} sent you ${mealName} from ${restaurantName} on ${dateFormatted}.${trackingLine}`,
            from: process.env.TWILIO_PHONE_NUMBER!,
            to: recipientProfile.phone,
          })
        } catch (twErr: any) {
          console.error('Twilio SMS failed:', twErr.message)
        }
      }

      await supabase.from('notifications').insert({
        kitchen_id: kitchenId,
        type: 'meal_confirmed',
        channel: 'sms',
        content: `${mealName} from ${restaurantName} confirmed for ${dateFormatted}`,
      })
    }
  }

  return NextResponse.json({ received: true })
}

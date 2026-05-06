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
  try {
    const body = await request.json()
    const eventType: string = body.event_type || ''
    const data = body.data || {}
    const externalDeliveryId: string = data.external_delivery_id || ''

    if (!externalDeliveryId) return NextResponse.json({ received: true })

    // Update doordash_status on every event
    await supabase
      .from('meal_proposals')
      .update({ doordash_status: eventType.toLowerCase() })
      .eq('id', externalDeliveryId)

    // ── Delivery completed ───────────────────────────────────────────────────
    if (
      eventType === 'DASHER_DROPPED_OFF' ||
      eventType === 'DELIVERED' ||
      eventType === 'DELIVERY_COMPLETE'
    ) {
      const { data: proposal } = await supabase
        .from('meal_proposals')
        .select(`
          *,
          claims(
            calendar_date_id,
            guest_coordinators(full_name, phone),
            calendar_dates(date, kitchens(id, recipient_id, name))
          ),
          kitchen_restaurants(name),
          menu_items(name)
        `)
        .eq('id', externalDeliveryId)
        .single()

      if (proposal) {
        const kitchenId     = proposal.claims?.calendar_dates?.kitchens?.id
        const kitchenName   = proposal.claims?.calendar_dates?.kitchens?.name
        const coordinatorName  = proposal.claims?.guest_coordinators?.full_name
        const coordinatorPhone = proposal.claims?.guest_coordinators?.phone
        const mealName      = proposal.menu_items?.name
        const restaurantName = proposal.kitchen_restaurants?.name
        const recipientId   = proposal.claims?.calendar_dates?.kitchens?.recipient_id

        const { data: recipientProfile } = await supabase
          .from('profiles')
          .select('phone')
          .eq('id', recipientId)
          .single()

        // Thank-you SMS to coordinator
        if (coordinatorPhone) {
          try {
            await twilioClient.messages.create({
              body: `🧡 Your meal was delivered! ${mealName} from ${restaurantName} arrived safely for ${kitchenName}. Thank you for showing up — YourKitchen`,
              from: process.env.TWILIO_PHONE_NUMBER!,
              to: coordinatorPhone,
            })
          } catch (e: any) { console.error('Coordinator delivered SMS failed:', e.message) }
        }

        await supabase.from('notifications').insert({
          kitchen_id: kitchenId,
          type: 'meal_delivered',
          channel: 'sms',
          content: `${mealName} from ${restaurantName} delivered`,
        })
      }
    }

    // ── Delivery cancelled ───────────────────────────────────────────────────
    if (
      eventType === 'DELIVERY_CANCELLED' ||
      eventType === 'DASHER_CANCELLED' ||
      eventType === 'DELIVERY_FAILED'
    ) {
      const { data: proposal } = await supabase
        .from('meal_proposals')
        .select(`
          *,
          claims(
            calendar_date_id,
            guest_coordinators(full_name, phone),
            calendar_dates(date, kitchens(id, recipient_id, name))
          ),
          kitchen_restaurants(name),
          menu_items(name)
        `)
        .eq('id', externalDeliveryId)
        .single()

      if (!proposal) return NextResponse.json({ received: true })

      const kitchenId      = proposal.claims?.calendar_dates?.kitchens?.id
      const kitchenName    = proposal.claims?.calendar_dates?.kitchens?.name
      const calDateId      = proposal.claims?.calendar_date_id
      const coordinatorName  = proposal.claims?.guest_coordinators?.full_name
      const coordinatorPhone = proposal.claims?.guest_coordinators?.phone
      const mealName       = proposal.menu_items?.name
      const restaurantName = proposal.kitchen_restaurants?.name
      const recipientId    = proposal.claims?.calendar_dates?.kitchens?.recipient_id

      const { data: recipientProfile } = await supabase
        .from('profiles')
        .select('phone')
        .eq('id', recipientId)
        .single()

      // 1. Refund coordinator via Stripe
      if (proposal.payment_intent_id) {
        try {
          await stripe.refunds.create({ payment_intent: proposal.payment_intent_id })
        } catch (refundErr: any) {
          console.error('Stripe refund failed:', refundErr.message)
        }
      }

      // 2. Update proposal + reopen calendar date
      await Promise.all([
        supabase
          .from('meal_proposals')
          .update({ status: 'delivery_failed', doordash_status: 'cancelled' })
          .eq('id', externalDeliveryId),
        supabase
          .from('calendar_dates')
          .update({ status: 'available' })
          .eq('id', calDateId),
      ])

      // 3. SMS to recipient
      if (recipientProfile?.phone) {
        try {
          await twilioClient.messages.create({
            body: `We're sorry — your delivery from ${restaurantName} was cancelled by DoorDash. You have not been charged. Your date has been reopened so someone can claim it again. — YourKitchen`,
            from: process.env.TWILIO_PHONE_NUMBER!,
            to: recipientProfile.phone,
          })
        } catch (e: any) { console.error('Recipient cancellation SMS failed:', e.message) }
      }

      // 4. SMS to coordinator
      if (coordinatorPhone) {
        try {
          await twilioClient.messages.create({
            body: `Hi ${coordinatorName} — unfortunately DoorDash cancelled the delivery of ${mealName} for ${kitchenName}. Your card has been fully refunded. We're sorry for the inconvenience. — YourKitchen`,
            from: process.env.TWILIO_PHONE_NUMBER!,
            to: coordinatorPhone,
          })
        } catch (e: any) { console.error('Coordinator cancellation SMS failed:', e.message) }
      }

      await supabase.from('notifications').insert({
        kitchen_id: kitchenId,
        type: 'delivery_cancelled',
        channel: 'sms',
        content: `Delivery of ${mealName} cancelled — refund issued`,
      })
    }

    return NextResponse.json({ received: true })
  } catch (err: any) {
    console.error('DoorDash webhook error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

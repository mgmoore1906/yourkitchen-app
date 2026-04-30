import { createClient } from '@supabase/supabase-js'
import twilio from 'twilio'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
)

export async function POST(request: Request) {
  // Validate DoorDash webhook auth
  const authHeader = request.headers.get('DOORDASH_WEBHOOK_SECRET')
  const expectedToken = process.env.DOORDASH_WEBHOOK_SECRET
  if (!authHeader || authHeader !== expectedToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let payload: any
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const eventName = payload.event_name || payload.delivery_status || ''
  const externalDeliveryId = payload.external_delivery_id || payload.data?.external_delivery_id

  if (!externalDeliveryId) return NextResponse.json({ received: true })

  const { data: proposal } = await supabase
    .from('meal_proposals')
    .select(`
      id,
      menu_items(name),
      kitchen_restaurants(name),
      claims(
        guest_coordinators(full_name, phone, email),
        calendar_dates(date, kitchens(id, recipient_id, name))
      )
    `)
    .eq('doordash_delivery_id', externalDeliveryId)
    .single()

  if (!proposal) return NextResponse.json({ received: true })

  const p = proposal as any
  const kitchenId = p.claims?.calendar_dates?.kitchens?.id
  const recipientId = p.claims?.calendar_dates?.kitchens?.recipient_id
  const coordinator = p.claims?.guest_coordinators
  const mealName = p.menu_items?.name
  const restaurantName = p.kitchen_restaurants?.name
  const dateStr = p.claims?.calendar_dates?.date

  const dateFormatted = dateStr
    ? new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US',
        { weekday: 'long', month: 'long', day: 'numeric' })
    : 'today'

  const { data: recipientProfile } = await supabase
    .from('profiles')
    .select('phone, full_name')
    .eq('id', recipientId)
    .single()

  const isPickup = /PICKUP|PICKED_UP/i.test(eventName)
  const isDelivered = /DROPPED_OFF|DELIVERED/i.test(eventName)
  const isCancelled = /CANCELLED|CANCELED|FAILED/i.test(eventName)

  let internalStatus: string | null = null
  if (isPickup) internalStatus = 'pickup'
  else if (isDelivered) internalStatus = 'delivered'
  else if (isCancelled) internalStatus = 'failed'

  if (internalStatus) {
    await supabase.from('meal_proposals')
      .update({ delivery_status: internalStatus })
      .eq('id', p.id)
  }

  if (isPickup && recipientProfile?.phone) {
    try {
      await twilioClient.messages.create({
        body: `🚗 Your ${mealName} from ${restaurantName} is on the way!`,
        from: process.env.TWILIO_PHONE_NUMBER!,
        to: recipientProfile.phone,
      })
    } catch (e: any) { console.error('Pickup SMS failed:', e.message) }
  }

  if (isDelivered) {
    if (recipientProfile?.phone) {
      try {
        await twilioClient.messages.create({
          body: `🧡 Your ${mealName} has arrived. Enjoy! — YourKitchen`,
          from: process.env.TWILIO_PHONE_NUMBER!,
          to: recipientProfile.phone,
        })
      } catch (e: any) { console.error('Delivered recipient SMS failed:', e.message) }
    }

    if (coordinator?.phone) {
      try {
        await twilioClient.messages.create({
          body: `Thank you for sending ${recipientProfile?.full_name || 'them'} dinner. ${mealName} from ${restaurantName} was just delivered on ${dateFormatted}. — YourKitchen`,
          from: process.env.TWILIO_PHONE_NUMBER!,
          to: coordinator.phone,
        })
      } catch (e: any) { console.error('Coordinator thank-you failed:', e.message) }
    }

    await supabase.from('notifications').insert({
      kitchen_id: kitchenId,
      type: 'meal_confirmed',
      channel: 'sms',
      content: `Delivered: ${mealName} from ${restaurantName} on ${dateFormatted}`,
    })
  }

  if (isCancelled) {
    const cancelMsg = `⚠️ Issue with ${mealName} from ${restaurantName}. We are looking into it. — YourKitchen`
    if (recipientProfile?.phone) {
      try { await twilioClient.messages.create({ body: cancelMsg, from: process.env.TWILIO_PHONE_NUMBER!, to: recipientProfile.phone }) }
      catch (e: any) { console.error(e.message) }
    }
    if (coordinator?.phone) {
      try { await twilioClient.messages.create({ body: cancelMsg, from: process.env.TWILIO_PHONE_NUMBER!, to: coordinator.phone }) }
      catch (e: any) { console.error(e.message) }
    }
  }

  return NextResponse.json({ received: true })
}

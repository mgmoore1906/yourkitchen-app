import { captureServer } from '@/lib/posthog-server'
import { createClient } from '@supabase/supabase-js'
import twilio from 'twilio'
import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
function getTwilio() { return twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!) }
async function sendSMS(to: string, body: string) {
  try {
    const client = getTwilio()
    await client.messages.create({ body, from: process.env.TWILIO_PHONE_NUMBER!, to })
  } catch (err: any) {
    console.error('SMS error:', err.message)
  }
}

// Shipday sends the validation token in a header literally named "token"
// (per Shipday's Order Status Update webhook docs). Keep older header names as
// fallbacks in case the dashboard is configured differently.
function readToken(request: Request): string | null {
  return request.headers.get('token')
    || request.headers.get('x-shipday-token')
    || request.headers.get('authorization')?.replace('Bearer ', '')
    || null
}

// Shipday event -> compact status we store on the proposal (doordash_status).
const STATUS_MAP: Record<string, string> = {
  ORDER_INSERTED: 'received',
  ORDER_ASSIGNED: 'assigned',
  ORDER_ACCEPTED_AND_STARTED: 'accepted',
  ORDER_ONTHEWAY: 'on_the_way',
  ORDER_PIKEDUP: 'picked_up',
  ORDER_COMPLETED: 'delivered',
  ORDER_FAILED: 'failed',
  ORDER_INCOMPLETE: 'failed',
  ORDER_UNASSIGNED: 'unassigned',
}

export async function POST(request: Request) {
  const supabase = getSupabase()

  const token = readToken(request)
  if (process.env.SHIPDAY_WEBHOOK_TOKEN && token !== process.env.SHIPDAY_WEBHOOK_TOKEN) {
    console.warn('[Shipday webhook] Invalid token')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = await request.json().catch(() => null)
  if (!payload) return NextResponse.json({ received: true })
  console.log('[Shipday webhook] Event received:', JSON.stringify(payload).slice(0, 300))

  // Real Shipday payload shape: { event, order_status, order:{ id, order_number }, carrier:{ name }, thirdPartyDeliveryOrder:{ thirdPartyName, driverName } }
  const event: string  = payload.event || ''
  const order          = payload.order || {}
  const orderId        = order.id != null ? String(order.id) : ''
  const orderNumber    = order.order_number || ''
  const tp             = payload.thirdPartyDeliveryOrder || {}
  const driverName     = payload.carrier?.name || tp.driverName || null
  const status         = STATUS_MAP[event] || (event ? event.toLowerCase() : '')

  // Match the proposal by the Shipday order id we saved at dispatch (or the YK order number).
  const ors: string[] = []
  if (orderId) ors.push(`doordash_delivery_id.eq.${orderId}`)
  if (orderNumber) ors.push(`doordash_delivery_id.eq.${orderNumber}`)
  if (ors.length === 0) return NextResponse.json({ received: true })

  const { data: proposal } = await supabase
    .from('meal_proposals')
    .select(`
      id, status, coordinator_name, doordash_tracking_url,
      kitchens:kitchen_id(recipient_id, name),
      claims(guest_coordinators(full_name, phone)),
      kitchen_restaurants(name),
      menu_items(name)
    `)
    .or(ors.join(','))
    .maybeSingle()

  if (!proposal) {
    console.log('[Shipday webhook] No proposal for order:', orderId || orderNumber)
    return NextResponse.json({ received: true })
  }

  const p = proposal as any

  // Persist status so the admin Dispatch view shows it in real time.
  const updates: Record<string, any> = { doordash_status: status }
  if (event === 'ORDER_COMPLETED') { updates.status = 'delivered'; updates.delivery_status = 'delivered' }
  else if (event === 'ORDER_FAILED' || event === 'ORDER_INCOMPLETE') { updates.delivery_status = 'failed' }
  await supabase.from('meal_proposals').update(updates).eq('id', p.id)

  // Names for personalized messaging.
  const recipientId   = p.kitchens?.recipient_id
  if (event === 'ORDER_COMPLETED') { await captureServer(recipientId, 'meal delivered', { restaurant: p.kitchen_restaurants?.name || null }) }
  const mealName      = p.menu_items?.name || 'your meal'
  const restName      = p.kitchen_restaurants?.name || 'the restaurant'
  const coordName     = p.claims?.guest_coordinators?.full_name || p.coordinator_name || 'someone who cares about you'
  const coordPhone    = p.claims?.guest_coordinators?.phone || null
  const kitchenName   = p.kitchens?.name || ''
  const recipientFirst = kitchenName.split("'")[0].replace(/'?s Kitchen.*$/i, '').trim() || 'them'
  // Tracking link is captured at dispatch (Shipday's webhook doesn't include it).
  const trackingUrl   = p.doordash_tracking_url || null
  const track         = trackingUrl ? ` Track: ${trackingUrl}` : ''

  let recipientPhone: string | null = null
  if (recipientId) {
    const { data: profile } = await supabase
      .from('profiles').select('phone').eq('id', recipientId).single()
    recipientPhone = profile?.phone || null
  }

  // Driver picked up the food and is en route to the recipient — the "your meal is coming" moment.
  if (event === 'ORDER_PIKEDUP') {
    if (recipientPhone) {
      await sendSMS(recipientPhone,
        `🚗 ${driverName ? driverName + ' is' : 'A driver is'} on the way with ${mealName} from ${restName} — sent by ${coordName}.${track}` +
        `\n\nBrought to you by YourKitchen 🧡`)
    }
    if (coordPhone) {
      await sendSMS(coordPhone,
        `🚗 The ${mealName} from ${restName} you sent is on its way to ${recipientFirst}.${track}` +
        `\n\nBrought to you by YourKitchen 🧡`)
    }
  }

  if (event === 'ORDER_COMPLETED') {
    if (recipientPhone) {
      await sendSMS(recipientPhone,
        `✅ ${mealName} from ${restName} has been delivered. Enjoy! 🧡\n\nBrought to you by YourKitchen`)
    }
    if (coordPhone) {
      await sendSMS(coordPhone,
        `✅ The ${mealName} you sent ${recipientFirst} has been delivered. 🧡\n\nBrought to you by YourKitchen`)
    }
  }

  if (event === 'ORDER_FAILED' || event === 'ORDER_INCOMPLETE') {
    if (recipientPhone) {
      await sendSMS(recipientPhone,
        `⚠️ There was an issue with your delivery from ${restName}. We'll look into it and follow up shortly.\n\n— YourKitchen`)
    }
    if (coordPhone) {
      await sendSMS(coordPhone,
        `⚠️ There was an issue delivering the ${mealName} you sent ${recipientFirst}. We're looking into it and will follow up.\n\n— YourKitchen`)
    }
  }

  console.log(`[Shipday webhook] proposal ${p.id} → ${status}`)
  return NextResponse.json({ received: true })
}

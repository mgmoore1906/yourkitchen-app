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

export async function POST(request: Request) {
  const supabase = getSupabase()
  // Verify Shipday webhook token
  const token = request.headers.get('x-shipday-token')
    || request.headers.get('authorization')?.replace('Bearer ', '')

  if (token !== process.env.SHIPDAY_WEBHOOK_TOKEN) {
    console.warn('[Shipday webhook] Invalid token')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = await request.json()
  console.log('[Shipday webhook] Event received:', JSON.stringify(payload).slice(0, 300))

  const orderNumber    = payload.orderNumber || payload.order_number || ''
  const status         = payload.status?.toLowerCase() || payload.orderStatus?.toLowerCase() || ''
  const trackingUrl    = payload.trackingLink || payload.tracking_url || null
  const driverName     = payload.carrierName || payload.driverName || null
  const deliveryStatus = status

  // Find proposal by Shipday order number (stored in doordash_delivery_id)
  const { data: proposal } = await supabase
    .from('meal_proposals')
    .select(`
      id, status, coordinator_name,
      kitchens:kitchen_id(recipient_id, name),
      claims(guest_coordinators(full_name, phone)),
      kitchen_restaurants(name),
      menu_items(name)
    `)
    .or(`doordash_delivery_id.eq.${orderNumber},doordash_delivery_id.ilike.YK-${orderNumber.slice(0,8)}%`)
    .single()

  if (!proposal) {
    console.log('[Shipday webhook] No proposal found for order:', orderNumber)
    return NextResponse.json({ received: true })
  }

  // Update tracking URL if provided
  const updates: any = { doordash_status: deliveryStatus }
  if (trackingUrl) updates.doordash_tracking_url = trackingUrl

  // Map Shipday statuses to our status
  if (['delivered', 'complete', 'completed'].includes(status)) {
    updates.status = 'delivered'
  } else if (['cancelled', 'canceled', 'failed'].includes(status)) {
    updates.doordash_status = 'cancelled'
  }

  await supabase.from('meal_proposals').update(updates).eq('id', proposal.id)

  // Gather names for personalized messaging.
  const p = proposal as any
  const recipientId   = p.kitchens?.recipient_id
  const mealName      = p.menu_items?.name || 'your meal'
  const restName      = p.kitchen_restaurants?.name || 'the restaurant'
  const coordName     = p.claims?.guest_coordinators?.full_name || p.coordinator_name || 'someone who cares about you'
  const coordPhone    = p.claims?.guest_coordinators?.phone || null
  // Recipient first name, derived from the kitchen name ("Megan's Kitchen" → "Megan").
  const kitchenName   = p.kitchens?.name || ''
  const recipientFirst = kitchenName.split("'")[0].replace(/'?s Kitchen.*$/i, '').trim() || 'them'
  const track = trackingUrl ? ` Track: ${trackingUrl}` : ''

  // Recipient's phone
  let recipientPhone: string | null = null
  if (recipientId) {
    const { data: profile } = await supabase
      .from('profiles').select('phone').eq('id', recipientId).single()
    recipientPhone = profile?.phone || null
  }

  if (['assigned', 'driver_assigned', 'accepted'].includes(status)) {
    // To the RECIPIENT — names who sent it.
    if (recipientPhone) {
      await sendSMS(recipientPhone,
        `🚗 ${driverName ? driverName + ' is' : 'A driver is'} on the way with ${mealName} from ${restName} — sent by ${coordName}.${track}` +
        `\n\nBrought to you by YourKitchen 🧡`)
    }
    // To the COORDINATOR — names who it's going to.
    if (coordPhone) {
      await sendSMS(coordPhone,
        `🚗 The ${mealName} from ${restName} you sent is on its way to ${recipientFirst}.${track}` +
        `\n\nBrought to you by YourKitchen 🧡`)
    }
  }

  if (['delivered', 'complete', 'completed'].includes(status)) {
    if (recipientPhone) {
      await sendSMS(recipientPhone,
        `✅ ${mealName} from ${restName} has been delivered. Enjoy! 🧡\n\nBrought to you by YourKitchen`)
    }
    if (coordPhone) {
      await sendSMS(coordPhone,
        `✅ The ${mealName} you sent ${recipientFirst} has been delivered. 🧡\n\nBrought to you by YourKitchen`)
    }
  }

  if (['cancelled', 'canceled', 'failed'].includes(status)) {
    if (recipientPhone) {
      await sendSMS(recipientPhone,
        `⚠️ There was an issue with your delivery from ${restName}. We'll look into it and follow up shortly.\n\n— YourKitchen`)
    }
    if (coordPhone) {
      await sendSMS(coordPhone,
        `⚠️ There was an issue delivering the ${mealName} you sent ${recipientFirst}. We're looking into it and will follow up.\n\n— YourKitchen`)
    }
  }

  console.log(`[Shipday webhook] Updated proposal ${proposal.id} → ${deliveryStatus}`)
  return NextResponse.json({ received: true })
}

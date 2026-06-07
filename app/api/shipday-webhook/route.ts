import { createClient } from '@supabase/supabase-js'
import twilio from 'twilio'
import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const twClient = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!)

async function sendSMS(to: string, body: string) {
  try {
    await twClient.messages.create({ body, from: process.env.TWILIO_PHONE_NUMBER!, to })
  } catch (err: any) {
    console.error('SMS error:', err.message)
  }
}

export async function POST(request: Request) {
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
      id, status,
      kitchens:kitchen_id(recipient_id),
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

  // Send SMS on key status changes
  const recipientId = (proposal as any).kitchens?.recipient_id
  if (recipientId) {
    const { data: profile } = await supabase
      .from('profiles').select('phone').eq('id', recipientId).single()

    const mealName = (proposal as any).menu_items?.name || 'your meal'
    const restName = (proposal as any).kitchen_restaurants?.name || 'the restaurant'

    if (profile?.phone) {
      if (['assigned', 'driver_assigned', 'accepted'].includes(status)) {
        await sendSMS(profile.phone,
          `🚗 ${driverName ? driverName + ' is' : 'A driver is'} on the way with ${mealName} from ${restName}.` +
          (trackingUrl ? ` Track: ${trackingUrl}` : '') +
          `\n\n— YourKitchen`)
      }

      if (['delivered', 'complete', 'completed'].includes(status)) {
        await sendSMS(profile.phone,
          `✅ ${mealName} from ${restName} has been delivered. Enjoy! 🧡\n\n— YourKitchen`)
      }

      if (['cancelled', 'canceled', 'failed'].includes(status)) {
        await sendSMS(profile.phone,
          `⚠️ There was an issue with your delivery from ${restName}. We'll look into it and follow up shortly.\n\n— YourKitchen`)
      }
    }
  }

  console.log(`[Shipday webhook] Updated proposal ${proposal.id} → ${deliveryStatus}`)
  return NextResponse.json({ received: true })
}

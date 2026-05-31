import { createClient } from '@supabase/supabase-js'
import twilio from 'twilio'
import { NextResponse } from 'next/server'

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

function buildItems(proposal: any) {
  const mealItems = Array.isArray(proposal.meal_items) ? proposal.meal_items : []
  if (mealItems.length > 0) {
    return mealItems.map((it: any) => ({
      name: it.name + (it.category === 'kids' ? ' (kids)' : ''),
      quantity: it.qty || 1,
      unitPrice: it.price || 0,
    }))
  }
  return [{ name: proposal.meal_name || 'Meal', quantity: 1, unitPrice: 20 }]
}

// Places "Nearby Search" returns a short `vicinity` address (street + city, no
// state/ZIP). An ambiguous string like "813 Cibolo Valley Dr, Cibolo" can geocode
// hundreds of miles off. We borrow the state + ZIP from the recipient's full
// address (the restaurant is always local to them) when the restaurant address
// lacks a state, so Shipday geocodes the pickup correctly.
function regionFromKitchen(kitchenAddress: string): string {
  // Pull a trailing ", ST 12345" or ", ST" from the kitchen address
  const m = kitchenAddress?.match(/,\s*([A-Z]{2})(\s+\d{5})?\s*$/)
  return m ? `${m[1]}${m[2] || ''}`.trim() : ''
}
function completeAddress(addr: string, region: string): string {
  if (!addr) return addr
  // Already has a 2-letter state token near the end? Leave it.
  if (/,\s*[A-Z]{2}(\s+\d{5})?\s*$/.test(addr)) return addr
  return region ? `${addr}, ${region}` : addr
}

async function dispatchShipday(proposal: any, kitchen: any, recipientPhone: string) {
  const restaurant = proposal.kitchen_restaurants
  const coordName  = proposal.coordinator_name || 'Coordinator'
  const orderNumber = `YK-${proposal.id.slice(0, 8).toUpperCase()}`

  const prefMap: Record<string, string> = {
    'leave_at_door':     'Please leave at door. Do NOT knock or ring doorbell.',
    'hand_to_recipient': 'Please hand directly to recipient.',
  }
  const delivPref   = proposal.delivery_preference || 'leave_at_door'
  const prefNote    = prefMap[delivPref] || 'Please leave at door.'
  const customNote  = proposal.delivery_note ? ` Note: ${proposal.delivery_note}` : ''
  const instruction = `YourKitchen delivery — sent by ${coordName}. ${prefNote}${customNote}`

  const payload: any = {
    orderNumber,
    orderTime:           new Date().toISOString(),
    restaurantName:      restaurant?.name || 'Restaurant',
    restaurantAddress:   completeAddress(restaurant?.address || '', regionFromKitchen(kitchen?.address || '')),
    restaurantPhone:     restaurant?.phone || '',
    customerName:        kitchen?.name || 'Recipient',
    customerAddress:     kitchen?.address || '',
    customerEmail:       '',
    customerPhone:       recipientPhone || '',
    deliveryInstruction: instruction,
    items:                   buildItems(proposal),
    orderSource:             'YourKitchen',
    tip:                     (proposal.tip_amount || 0) / 100,
    requestOnDemandDelivery: true,
  }

  // Explicit coordinates remove geocoding ambiguity — the usual cause of a
  // false "address not in service area" rejection from Uber/DoorDash fleets.
  // Only attach when present so we never send null/0 (which geocodes to the ocean).
  if (restaurant?.lat != null && restaurant?.lng != null) {
    payload.pickupLatitude  = restaurant.lat
    payload.pickupLongitude = restaurant.lng
  }
  if (kitchen?.latitude != null && kitchen?.longitude != null) {
    payload.deliveryLatitude  = kitchen.latitude
    payload.deliveryLongitude = kitchen.longitude
  }

  const res = await fetch('https://api.shipday.com/orders', {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Basic ${process.env.SHIPDAY_API_KEY}`,
    },
    body: JSON.stringify(payload),
  })

  const data = await res.json()
  if (!res.ok) throw new Error(data.message || `Shipday error ${res.status}`)

  console.log(`[Shipday] Dispatched: ${orderNumber}`, data)
  return {
    orderNumber,
    shipdayOrderId: data.orderId,
    trackingUrl:    data.trackingLink || null,
  }
}

export async function POST(request: Request) {
  try {
    const adminSecret = request.headers.get('x-admin-secret')
    if (adminSecret !== process.env.ADMIN_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { proposal_id } = await request.json()
    if (!proposal_id) {
      return NextResponse.json({ error: 'proposal_id required' }, { status: 400 })
    }

    const { data: proposal, error } = await supabase
      .from('meal_proposals')
      .select(`
        id, status, delivery_status, tip_amount, delivery_date,
        delivery_preference, delivery_note, meal_type,
        coordinator_name, restaurant_name, meal_name, meal_items,
        claims(calendar_date_id, guest_coordinators(phone)),
        kitchen_restaurants(name, address, phone, lat, lng),
        kitchens:kitchen_id(id, name, address, recipient_id, latitude, longitude)
      `)
      .eq('id', proposal_id)
      .single()

    if (error || !proposal) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
    }

    if ((proposal as any).status !== 'confirmed') {
      return NextResponse.json({ error: `Proposal status is ${(proposal as any).status} — must be confirmed to dispatch` }, { status: 400 })
    }

    if ((proposal as any).delivery_status === 'dispatched') {
      return NextResponse.json({ error: 'Already dispatched' }, { status: 400 })
    }

    const kitchen = (proposal as any).kitchens

    // Recipient phone lives on the profile, not the kitchen — fetch it for Shipday
    let recipientPhone = ''
    if (kitchen?.recipient_id) {
      const { data: rp } = await supabase
        .from('profiles').select('phone').eq('id', kitchen.recipient_id).single()
      recipientPhone = rp?.phone || ''
    }

    const { orderNumber, shipdayOrderId, trackingUrl } = await dispatchShipday(proposal as any, kitchen, recipientPhone)

    await supabase.from('meal_proposals').update({
      doordash_delivery_id:  shipdayOrderId ? String(shipdayOrderId) : orderNumber,
      doordash_tracking_url: trackingUrl,
      delivery_status:       'dispatched',
    }).eq('id', proposal_id)

    // Build a short item summary for the SMS
    const mealItems = Array.isArray((proposal as any).meal_items) ? (proposal as any).meal_items : []
    const itemSummary = mealItems.length > 0
      ? mealItems.map((it: any) => it.qty > 1 ? `${it.name} ×${it.qty}` : it.name).join(', ')
      : ((proposal as any).meal_name || 'your meal')
    const restName = (proposal as any).restaurant_name || (proposal as any).kitchen_restaurants?.name || 'the restaurant'

    // SMS coordinator
    const coordPhone = (proposal as any).claims?.guest_coordinators?.phone
    if (coordPhone) {
      await sendSMS(
        coordPhone,
        `🚗 ${itemSummary} from ${restName} is on its way!` +
        (trackingUrl ? ` Track it: ${trackingUrl}` : '') +
        `\n\n— YourKitchen 🧡`
      )
    }

    // SMS recipient
    if (kitchen?.recipient_id) {
      const { data: recipientProfile } = await supabase
        .from('profiles').select('phone').eq('id', kitchen.recipient_id).single()
      if (recipientProfile?.phone) {
        await sendSMS(
          recipientProfile.phone,
          `🚗 ${itemSummary} from ${restName} is on its way!` +
          (trackingUrl ? ` Track your order: ${trackingUrl}` : '') +
          `\n\n— YourKitchen`
        )
      }
    }

    console.log(`[Dispatch] Order ${orderNumber} dispatched for proposal ${proposal_id}`)

    return NextResponse.json({ success: true, orderNumber, trackingUrl })

  } catch (err: any) {
    console.error('[Dispatch] Error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

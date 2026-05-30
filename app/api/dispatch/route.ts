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

async function dispatchShipday(proposal: any, kitchen: any) {
  const restaurant = proposal.kitchen_restaurants
  const menuItem   = proposal.menu_items
  const coordName  = proposal.claims?.guest_coordinators?.full_name || 'Coordinator'
  const orderNumber = `YK-${proposal.id.slice(0, 8).toUpperCase()}`

  // Build delivery instruction from preference
  const prefMap: Record<string, string> = {
    'leave_at_door':   'Please leave at door. Do NOT knock or ring doorbell.',
    'hand_to_recipient': 'Please hand directly to recipient.',
  }
  const delivPref    = proposal.delivery_preference || 'leave_at_door'
  const prefNote     = prefMap[delivPref] || 'Please leave at door.'
  const customNote   = proposal.delivery_note ? ` Note: ${proposal.delivery_note}` : ''
  const instruction  = `YourKitchen delivery — sent by ${coordName}. ${prefNote}${customNote}`

  const payload = {
    orderNumber,
    orderTime:           new Date().toISOString(),
    restaurantName:      restaurant?.name || 'Restaurant',
    restaurantAddress:   restaurant?.address || '',
    restaurantPhone:     restaurant?.phone || '',
    customerName:        kitchen?.name || 'Recipient',
    customerAddress:     kitchen?.address || '',
    customerEmail:       '',
    customerPhone:       kitchen?.recipient_phone || '',
    deliveryInstruction: instruction,
    items: [{
      name:      menuItem?.name || 'Meal',
      quantity:  1,
      unitPrice: menuItem?.price || 20,
    }],
    orderSource:             'YourKitchen',
    tip:                     (proposal.tip_amount || 0) / 100,
    requestOnDemandDelivery: true,
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
    // Simple admin auth check
    const adminSecret = request.headers.get('x-admin-secret')
    if (adminSecret !== process.env.ADMIN_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { proposal_id } = await request.json()
    if (!proposal_id) {
      return NextResponse.json({ error: 'proposal_id required' }, { status: 400 })
    }

    // Fetch proposal with all related data
    const { data: proposal, error } = await supabase
      .from('meal_proposals')
      .select(`
        id, status, delivery_status, tip_amount, delivery_date,
        delivery_preference, delivery_note, meal_type,
        claims(calendar_date_id, guest_coordinators(phone, full_name)),
        kitchen_restaurants(name, address, phone),
        menu_items(name, price),
        kitchens:kitchen_id(id, name, address, recipient_id)
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

    // Dispatch to Shipday
    const { orderNumber, shipdayOrderId, trackingUrl } = await dispatchShipday(proposal as any, kitchen)

    // Update proposal with Shipday order info
    await supabase.from('meal_proposals').update({
      doordash_delivery_id:  shipdayOrderId ? String(shipdayOrderId) : orderNumber,
      doordash_tracking_url: trackingUrl,
      delivery_status:       'dispatched',
    }).eq('id', proposal_id)

    const mealName = (proposal as any).menu_items?.name || 'the meal'
    const restName = (proposal as any).kitchen_restaurants?.name || 'the restaurant'

    // SMS coordinator — now actually on the way
    const coordPhone = (proposal as any).claims?.guest_coordinators?.phone
    if (coordPhone) {
      await sendSMS(
        coordPhone,
        `🚗 ${mealName} from ${restName} is on its way!` +
        (trackingUrl ? ` Track it: ${trackingUrl}` : '') +
        `\n\n— YourKitchen 🧡`
      )
    }

    // SMS recipient — tracking link
    if (kitchen?.recipient_id) {
      const { data: recipientProfile } = await supabase
        .from('profiles').select('phone').eq('id', kitchen.recipient_id).single()
      if (recipientProfile?.phone) {
        await sendSMS(
          recipientProfile.phone,
          `🚗 ${mealName} from ${restName} is on its way!` +
          (trackingUrl ? ` Track your order: ${trackingUrl}` : '') +
          `\n\n— YourKitchen`
        )
      }
    }

    console.log(`[Dispatch] Order ${orderNumber} dispatched for proposal ${proposal_id}`)

    return NextResponse.json({
      success:    true,
      orderNumber,
      trackingUrl,
    })

  } catch (err: any) {
    console.error('[Dispatch] Error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

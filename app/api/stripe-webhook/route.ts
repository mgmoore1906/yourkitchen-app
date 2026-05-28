import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import twilio from 'twilio'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const stripe   = new Stripe(process.env.STRIPE_SECRET_KEY!)
const twClient = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!)

async function sendSMS(to: string, body: string) {
  try {
    await twClient.messages.create({ body, from: process.env.TWILIO_PHONE_NUMBER!, to })
  } catch (err: any) {
    console.error('SMS error:', err.message)
  }
}

async function dispatchShipday(proposal: any, kitchen: any) {
  const restaurant   = proposal.kitchen_restaurants
  const menuItem     = proposal.menu_items
  const coordName    = proposal.claims?.guest_coordinators?.full_name || 'Coordinator'

  const orderNumber  = `YK-${proposal.id.slice(0, 8).toUpperCase()}`
  const deliveryDate = proposal.delivery_date
    ? new Date(proposal.delivery_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  const payload = {
    orderNumber,
    orderTime:     new Date().toISOString(),
    restaurantName: restaurant?.name || 'Restaurant',
    restaurantAddress: restaurant?.address || '',
    restaurantPhone:   restaurant?.phone || '',
    customerName:      kitchen?.name || 'Recipient',
    customerAddress:   kitchen?.address || '',
    customerEmail:     '',
    customerPhone:     kitchen?.recipient_phone || '',
    deliveryInstruction: `YourKitchen delivery — sent by ${coordName}. Please leave at door.`,
    items: [{
      name:     menuItem?.name || 'Meal',
      quantity: 1,
      unitPrice: menuItem?.price || 20,
    }],
    orderSource: 'YourKitchen',
    tip:         (proposal.tip_amount || 0) / 100,
    // Request on-demand 3rd party delivery (DoorDash/Uber via Shipday gateway)
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

  console.log(`[Shipday] Order created: ${orderNumber}`, data)
  return { orderNumber, shipdayOrderId: data.orderId, trackingUrl: data.trackingLink || null }
}

export async function POST(request: Request) {
  const body      = await request.text()
  const signature = request.headers.get('stripe-signature') || ''

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err: any) {
    console.error('Webhook signature error:', err.message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // ── checkout.session.completed ─────────────────────────────────────────────
  if (event.type === 'checkout.session.completed') {
    const session         = event.data.object as Stripe.Checkout.Session
    const paymentIntentId = session.payment_intent as string
    const type            = session.metadata?.type
    const proposalIds     = JSON.parse(session.metadata?.proposal_ids || '[]') as string[]
    const coordinatorName = session.metadata?.coordinator_name || ''

    // Subscription upgrade
    if (type === 'subscription') {
      const userId = session.metadata?.user_id
      const tier   = session.metadata?.tier
      if (userId && tier) {
        await supabase.from('profiles').update({ tier }).eq('id', userId)
        console.log(`Tier updated: ${userId} → ${tier}`)
      }
      return NextResponse.json({ received: true })
    }

    // Proposal payment — save payment_intent_id + notify recipient
    if (type === 'proposal' && proposalIds.length > 0) {
      await supabase.from('meal_proposals')
        .update({ payment_intent_id: paymentIntentId })
        .in('id', proposalIds)

      const { data: proposals } = await supabase
        .from('meal_proposals')
        .select(`
          id, meal_type,
          claims(calendar_date_id, guest_coordinators(full_name)),
          kitchen_restaurants(name),
          menu_items(name),
          kitchens:kitchen_id(id, name, address, recipient_id)
        `)
        .in('id', proposalIds)

      for (const p of (proposals || []) as any[]) {
        if (p.claims?.calendar_date_id) {
          await supabase.from('calendar_dates')
            .update({ status: 'claimed' })
            .eq('id', p.claims.calendar_date_id)
        }

        const recipientId = p.kitchens?.recipient_id
        if (!recipientId) continue

        const { data: profile } = await supabase
          .from('profiles').select('phone').eq('id', recipientId).single()

        if (profile?.phone) {
          const mealLabel = p.meal_type === 'breakfast' ? 'breakfast'
            : p.meal_type === 'lunch' ? 'lunch' : 'dinner'
          await sendSMS(
            profile.phone,
            `${coordinatorName} wants to send you ${mealLabel} — ` +
            `${p.menu_items?.name} from ${p.kitchen_restaurants?.name}.\n\n` +
            `Reply Y to confirm or N to decline.\n\n— YourKitchen`
          )
        }
      }
      console.log(`Payment authorized for ${proposalIds.length} proposal(s): ${paymentIntentId}`)
    }
  }

  // ── payment_intent.succeeded (Y confirmed → Stripe captured) ──────────────
  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object as Stripe.PaymentIntent

    const { data: proposal } = await supabase
      .from('meal_proposals')
      .select(`
        id, meal_type, status, tip_amount, delivery_date,
        claims(calendar_date_id, guest_coordinators(phone, full_name)),
        kitchen_restaurants(name, address, phone),
        menu_items(name, price),
        kitchens:kitchen_id(id, name, address, recipient_id)
      `)
      .eq('payment_intent_id', pi.id)
      .single()

    if (!proposal) {
      console.log('No proposal found for payment_intent:', pi.id)
      return NextResponse.json({ received: true })
    }

    const kitchen = (proposal as any).kitchens

    try {
      const { orderNumber, shipdayOrderId, trackingUrl } = await dispatchShipday(proposal as any, kitchen)

      // Update proposal with Shipday order info
      await supabase.from('meal_proposals').update({
        doordash_delivery_id:  shipdayOrderId ? String(shipdayOrderId) : orderNumber,
        doordash_tracking_url: trackingUrl,
        status:                'confirmed',
      }).eq('id', (proposal as any).id)

      // Notify coordinator
      const coordPhone = (proposal as any).claims?.guest_coordinators?.phone
      const coordName  = (proposal as any).claims?.guest_coordinators?.full_name || 'You'
      const mealName   = (proposal as any).menu_items?.name || 'the meal'
      const restName   = (proposal as any).kitchen_restaurants?.name || 'the restaurant'

      if (coordPhone) {
        await sendSMS(
          coordPhone,
          `✅ Your meal was confirmed! ${mealName} from ${restName} is being dispatched.` +
          (trackingUrl ? ` Track it: ${trackingUrl}` : '') +
          `\n\n— YourKitchen 🧡`
        )
      }

      // Notify recipient
      if (kitchen?.recipient_id) {
        const { data: recipientProfile } = await supabase
          .from('profiles').select('phone').eq('id', kitchen.recipient_id).single()
        if (recipientProfile?.phone) {
          await sendSMS(
            recipientProfile.phone,
            `✅ Confirmed! ${mealName} from ${restName} is on its way.` +
            (trackingUrl ? ` Track your order: ${trackingUrl}` : '') +
            `\n\n— YourKitchen`
          )
        }
      }

      console.log(`[Shipday] Dispatched order ${orderNumber} for proposal ${(proposal as any).id}`)

    } catch (dispatchErr: any) {
      console.error('[Shipday] Dispatch failed:', dispatchErr.message)

      // Refund coordinator if dispatch fails
      try {
        await stripe.refunds.create({ payment_intent: pi.id })
        await supabase.from('meal_proposals')
          .update({ status: 'declined' })
          .eq('payment_intent_id', pi.id)
        console.log('Refunded payment_intent:', pi.id)
      } catch (refundErr: any) {
        console.error('Refund failed:', refundErr.message)
      }
    }
  }

  return NextResponse.json({ received: true })
}

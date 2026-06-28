import { captureServer } from '@/lib/posthog-server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { NextResponse } from 'next/server'
import { notifyCoordinatorDeclined } from '@/lib/coordinator-notify'
import { notifyMealConfirmed } from '@/lib/meal-confirmed-notify'

export const dynamic = 'force-dynamic'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
function getStripe() { return new Stripe(process.env.STRIPE_SECRET_KEY!) }

// GET — safe, read-only proposal summary for the public confirm page (email hedge).
// Never mutates anything; confirming/declining always goes through POST below,
// so an email client prefetching this link can't trigger a charge.
export async function GET(request: Request) {
  const supabase = getSupabase()
  const { searchParams } = new URL(request.url)
  const proposalId = searchParams.get('id') || searchParams.get('proposal_id')
  if (!proposalId) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const { data: p } = await supabase
    .from('meal_proposals')
    .select(`id, status, meal_type, delivery_time, meal_name, meal_items, is_pickup,
      claims(guest_coordinators(full_name)),
      kitchen_restaurants(name),
      menu_items(name),
      kitchens:kitchen_id(name)`)
    .eq('id', proposalId)
    .single()

  if (!p) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const pp = p as any
  const itemsArr = Array.isArray(pp.meal_items) ? pp.meal_items : []
  const mealName = pp.meal_name
    || (itemsArr.length ? itemsArr.map((i: any) => i.qty > 1 ? `${i.name} \u00d7${i.qty}` : i.name).join(', ') : null)
    || pp.menu_items?.name || 'a meal'

  return NextResponse.json({
    id: pp.id,
    status: pp.status,
    meal_type: pp.meal_type,
    delivery_time: pp.delivery_time,
    is_pickup: !!pp.is_pickup,
    meal_name: mealName,
    restaurant: pp.kitchen_restaurants?.name || '',
    coordinator_name: pp.claims?.guest_coordinators?.full_name || 'Someone',
    kitchen_name: pp.kitchens?.name || '',
  })
}

export async function POST(request: Request) {
  const supabase = getSupabase()
  const stripe = getStripe()
  try {
    const { proposal_id, action, note, reason, delivery_time } = await request.json()

    const { data: proposal } = await supabase
      .from('meal_proposals')
      .select('*, claims(calendar_date_id, guest_coordinators(full_name, email, phone)), kitchens:kitchen_id(name, slug, recipient_id)')
      .eq('id', proposal_id)
      .single()

    if (!proposal) return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })

if (action === 'confirm') {
  let paymentIntentId = proposal.payment_intent_id

  // Fallback: look up payment intent from Stripe session if not saved by webhook
  if (!paymentIntentId && proposal.stripe_session_id) {
    try {
      const session = await stripe.checkout.sessions.retrieve(proposal.stripe_session_id)
      paymentIntentId = session.payment_intent as string | null
      if (paymentIntentId) {
        await supabase.from('meal_proposals')
          .update({ payment_intent_id: paymentIntentId })
          .eq('id', proposal_id)
      }
    } catch (err: any) {
      console.error('Session lookup failed:', err.message)
    }
  }

  if (!paymentIntentId) {
    return NextResponse.json({ error: 'Payment not yet authorized for this proposal' }, { status: 400 })
  }

  await Promise.all([
    supabase.from('meal_proposals')
      .update({ status: 'confirmed', responded_at: new Date().toISOString(), ...(delivery_time ? { delivery_time } : {}) })
      .eq('id', proposal_id),
    supabase.from('calendar_dates')
      .update({ status: 'confirmed' })
      .eq('id', proposal.claims?.calendar_date_id),
  ])

  await stripe.paymentIntents.capture(paymentIntentId)

  await captureServer((proposal as any).kitchens?.recipient_id, 'meal confirmed', { channel: 'dashboard' })

  // Email the recipient a calendar (.ics) so they can add this meal to Google/
  // Apple/Outlook in one tap, right from their inbox. Best-effort — the confirm
  // and capture already succeeded above, so this never blocks the response.
  try {
    const k = (proposal as any).kitchens
    const recipientId = k?.recipient_id
    let recipientEmail: string | null = null
    if (recipientId) {
      try { const { data: au } = await supabase.auth.admin.getUserById(recipientId); recipientEmail = au?.user?.email || null } catch {}
    }
    if (recipientEmail) {
      const items = Array.isArray((proposal as any).meal_items) ? (proposal as any).meal_items : []
      const mealName = (proposal as any).meal_name
        || (items.length ? items.map((i: any) => i.qty > 1 ? `${i.name} ×${i.qty}` : i.name).join(', ') : 'a meal')
      const dl = (proposal as any).delivery_date
        ? new Date((proposal as any).delivery_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
        : null
      await notifyMealConfirmed({
        recipientEmail,
        recipientName: (k?.name || '').split(/[\s']/)[0] || null,
        coordinatorName: (proposal as any).coordinator_name || proposal.claims?.guest_coordinators?.full_name || null,
        mealName,
        restName: (proposal as any).restaurant_name || null,
        dateLabel: dl,
        deliveryDate: (proposal as any).delivery_date || null,
        mealType: (proposal as any).meal_type || null,
        deliveryTime: (delivery_time || (proposal as any).delivery_time) || null,
        proposalId: proposal_id,
      })
    }
  } catch (err: any) { console.error('Meal-confirmed email failed (confirming anyway):', err?.message) }

  return NextResponse.json({ success: true })
}

if (action === 'decline') {
  // Cancel the Stripe hold so the coordinator is never charged. Best-effort:
  // the decline must still succeed even if there's no hold yet or cancel fails.
  if (proposal.payment_intent_id) {
    try {
      await stripe.paymentIntents.cancel(proposal.payment_intent_id)
    } catch (err: any) {
      console.error('PaymentIntent cancel failed (declining anyway):', err.message)
    }
  }

  // Store the decline reason so the coordinator sees a kind, specific message
  // ("we're covered tonight") instead of a silent cancellation.
  const declineReason = (reason || note || '').toString().trim() || null

  await Promise.all([
    supabase.from('meal_proposals')
      .update({ status: 'declined', responded_at: new Date().toISOString(), decline_reason: declineReason })
      .eq('id', proposal_id),
    supabase.from('calendar_dates')
      .update({ status: 'available' })
      .eq('id', proposal.claims?.calendar_date_id),
  ])

  await captureServer((proposal as any).kitchens?.recipient_id, 'meal declined', { channel: 'dashboard' })

  // Tell the coordinator their offer was declined — the /proposals/[id] screen
  // promises "X has been notified". Email is reliable even while SMS is filtered.
  try {
    const k = (proposal as any).kitchens
    const g = (proposal as any).claims?.guest_coordinators
    const items = Array.isArray((proposal as any).meal_items) ? (proposal as any).meal_items : []
    const mealName = (proposal as any).meal_name
      || (items.length ? items.map((i: any) => i.qty > 1 ? `${i.name} ×${i.qty}` : i.name).join(', ') : 'the meal')
    const dateLabel = (proposal as any).delivery_date
      ? new Date((proposal as any).delivery_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
      : null
    await notifyCoordinatorDeclined({
      coordinatorEmail: (proposal as any).coordinator_email || g?.email || null,
      coordinatorName: (proposal as any).coordinator_name || g?.full_name || null,
      recipientName: (k?.name || '').split(/[\s']/)[0] || null,
      mealName,
      restName: (proposal as any).restaurant_name || null,
      dateLabel,
      reason: declineReason,
      slug: k?.slug || null,
    })
  } catch (err: any) { console.error('Coordinator decline notify failed (declining anyway):', err?.message) }

  return NextResponse.json({ success: true })
}

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

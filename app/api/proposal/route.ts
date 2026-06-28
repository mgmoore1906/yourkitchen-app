import { captureServer } from '@/lib/posthog-server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { NextResponse } from 'next/server'
import { haversineDistance, getDeliveryFee } from '@/lib/distance'
import { resolveCourierFee } from '@/lib/shipday'
const MEAL_LABEL: Record<string, string> = { breakfast: '🌅 Breakfast', lunch: '☀️ Lunch', dinner: '🌙 Dinner' }
export const dynamic = 'force-dynamic'
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
function getStripe() { return new Stripe(process.env.STRIPE_SECRET_KEY!) }
export async function POST(request: Request) {
  const stripe = getStripe()
  const supabase = getSupabase()
  const lockedSlotIds: string[] = []
  const releaseLocks = async () => {
    if (lockedSlotIds.length) {
      await supabase.from('calendar_dates').update({ status: 'available' }).in('id', lockedSlotIds)
    }
  }
try {
const {
name, email, phone, note,
proposals,
kitchen_slug,
tip_amount,
delivery_preference,
delivery_note,
is_pickup,
use_places,
} = await request.json()

// ── Guest coordinator ────────────────────────────────────────────────────
const { data: guest, error: guestError } = await supabase
.from('guest_coordinators')
.insert({ full_name: name, email, phone: phone || null })
.select('id')
.single()
if (guestError) return NextResponse.json({ error: guestError.message }, { status: 400 })

// ── Kitchen ──────────────────────────────────────────────────────────────
const { data: kitchen } = await supabase
.from('kitchens')
.select('id, name, latitude, longitude, address, breakfast_windows, lunch_windows, dinner_windows, recipient_id')
.eq('slug', kitchen_slug)
.single()
if (!kitchen) return NextResponse.json({ error: 'Kitchen not found' }, { status: 404 })

const recipientFirst = kitchen.name?.split("'")[0] || 'your recipient'

// Resolve the recipient's preferred delivery time for a given meal type.
// Stored as a single "HH:MM" target in the *_windows columns (see the
// Delivery Times page). Empty → null, and the night-before SMS falls back to
// a sensible default. The coordinator can override per-order in future.
const windowFor = (mealType: string): string | null => {
  const col =
    mealType === 'breakfast' ? kitchen.breakfast_windows
    : mealType === 'lunch'   ? kitchen.lunch_windows
    : kitchen.dinner_windows
  const raw = Array.isArray(col) ? col[0] : null
  if (!raw) return null
  // Accept either "HH:MM" (new format) or "HH:MM-HH:MM" (legacy range → take start)
  return String(raw).split('-')[0].trim() || null
}

const proposalIds: string[] = []
const meals: { proposalId: string; foodItems: any[]; foodCents: number; pickupLat: number | null; pickupLng: number | null; pickupAddr: string; deliveryMiles: number | null; restName: string }[] = []
let mealSubtotalCents = 0
let deliveryMiles: number | null = null
// Captured for the real Shipday courier quote at the fee block below.
let pickupLat: number | null = null
let pickupLng: number | null = null
let pickupAddr = ''


// ── Reserve each slot atomically (prevents double-booking) ──
// Compare-and-swap available→claimed. Only the FIRST concurrent proposal for a
// slot wins; everyone else gets a clean "already claimed" 409. Slots reopen on
// decline (api/confirm), on an N→declined SMS, or if checkout expires unpaid
// (checkout.session.expired in the Stripe webhook).
for (const p of proposals) {
  if (!p.calendar_date_id) continue
  const { data: locked } = await supabase
    .from('calendar_dates')
    .update({ status: 'claimed' })
    .eq('id', p.calendar_date_id)
    .eq('kitchen_id', kitchen.id)
    .eq('status', 'available')
    .select('id')
  if (!locked || locked.length === 0) {
    await releaseLocks()
    return NextResponse.json(
      { error: 'That day was just claimed by someone else in the village. Please pick another open day.', code: 'slot_taken' },
      { status: 409 },
    )
  }
  lockedSlotIds.push(p.calendar_date_id)
}

for (const p of proposals) {

let kitchenRestaurantId: string | null = null
let mealName: string
let mealPrice: number
let restName: string
let dateLabel: string
let mealItems: any[] = []
const mealLabel = p.meal_type ? (MEAL_LABEL[p.meal_type] || '') : ''
deliveryMiles = null; pickupLat = null; pickupLng = null; pickupAddr = ''

if (use_places) {
mealName = p.menu_item_name || 'Meal'
mealPrice = p.menu_item_price || 15
restName = p.restaurant_name || 'Restaurant'
mealItems = Array.isArray(p.meal_items) ? p.meal_items : []
dateLabel = p.delivery_date
? new Date(p.delivery_date + 'T12:00:00').toLocaleDateString('en-US', {
weekday: 'short', month: 'short', day: 'numeric' })
: ''

const { data: kr } = await supabase
.from('kitchen_restaurants')
.select('id, lat, lng, address')
.eq('kitchen_id', kitchen.id)
.ilike('name', restName)
.single()

kitchenRestaurantId = kr?.id || null
if (kr?.lat != null) pickupLat = Number(kr.lat)
if (kr?.lng != null) pickupLng = Number(kr.lng)
if ((kr as any)?.address) pickupAddr = (kr as any).address

if (deliveryMiles === null && kitchen.latitude && kitchen.longitude && kr?.lat && kr?.lng) {
deliveryMiles = haversineDistance(kitchen.latitude, kitchen.longitude, kr.lat, kr.lng)
}

} else {
const [{ data: menuItem }, { data: restaurant }, { data: calDate }] = await Promise.all([
supabase.from('menu_items').select('name, price').eq('id', p.menu_item_id).single(),
supabase.from('kitchen_restaurants').select('id, name, lat, lng, address').eq('id', p.restaurant_id).single(),
supabase.from('calendar_dates').select('date, meal_type').eq('id', p.calendar_date_id).single(),
])
mealName = menuItem?.name || 'Meal'
mealPrice = menuItem?.price || 15
restName = (restaurant as any)?.name || 'Restaurant'
kitchenRestaurantId = (restaurant as any)?.id || null
if ((restaurant as any)?.lat != null) pickupLat = Number((restaurant as any).lat)
if ((restaurant as any)?.lng != null) pickupLng = Number((restaurant as any).lng)
if ((restaurant as any)?.address) pickupAddr = (restaurant as any).address
dateLabel = calDate?.date
? new Date(calDate.date + 'T12:00:00').toLocaleDateString('en-US', {
weekday: 'short', month: 'short', day: 'numeric' })
: ''
if (deliveryMiles === null && kitchen.latitude && kitchen.longitude && (restaurant as any)?.lat && (restaurant as any)?.lng) {
deliveryMiles = haversineDistance(kitchen.latitude, kitchen.longitude, (restaurant as any).lat, (restaurant as any).lng)
}
}

// ── Claim ────────────────────────────────────────────────────────────
const { data: claim, error: claimError } = await supabase
.from('claims')
.insert({
calendar_date_id: p.calendar_date_id,
guest_coordinator_id: guest.id,
claim_type: 'one_time',
status: 'active',
expires_at: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
})
.select('id')
.single()
if (claimError) { await releaseLocks(); return NextResponse.json({ error: claimError.message }, { status: 400 }) }

// ── Proposal ─────────────────────────────────────────────────────────
const { data: proposal, error: proposalError } = await supabase
.from('meal_proposals')
.insert({
claim_id: claim.id,
kitchen_id: kitchen.id,
kitchen_restaurant_id: kitchenRestaurantId,
menu_item_id: use_places ? null : p.menu_item_id,
coordinator_name: name,
coordinator_phone: phone || null,
coordinator_note: note || null,
tip_amount: is_pickup ? 0 : (tip_amount || 0),
delivery_preference: delivery_preference || 'leave_at_door',
delivery_note: delivery_note || null,
is_pickup: !!is_pickup,
restaurant_name: restName,
meal_name: mealName,
meal_items: mealItems,
delivery_date: use_places ? p.delivery_date : undefined,
meal_type: use_places ? p.meal_type : undefined,
delivery_time: use_places ? windowFor(p.meal_type || 'dinner') : undefined,
status: 'pending',
})
.select('id')
.single()
if (proposalError) { await releaseLocks(); return NextResponse.json({ error: proposalError.message }, { status: 400 }) }
if (proposal?.id) { await captureServer((kitchen as any).recipient_id, 'meal proposed', { restaurant: restName, meal: mealName, is_pickup: !!is_pickup }) }

if (!use_places && proposal?.id) {
const { data: calDate } = await supabase
.from('calendar_dates').select('date, meal_type').eq('id', p.calendar_date_id).single()
const resolvedMealType = (calDate as any)?.meal_type || 'dinner'
await supabase.from('meal_proposals').update({
delivery_date: calDate?.date || null,
meal_type: resolvedMealType,
delivery_time: windowFor(resolvedMealType),
}).eq('id', proposal.id)
}

proposalIds.push(proposal.id)

// ── Per-meal Stripe line items (this meal becomes its OWN transaction) ──
const foodItems: any[] = []
let foodCents = 0
if (mealItems.length > 0) {
for (const item of mealItems) {
const cents = Math.round((item.price || 0) * 100)
const qty = item.qty || 1
if (cents <= 0) continue
foodCents += cents * qty
foodItems.push({
price_data: {
currency: 'usd',
product_data: {
name: `${item.name}${item.category === 'kids' ? ' (kids)' : ''}`,
description: `${restName}${dateLabel ? ` · ${dateLabel}` : ''}${mealLabel ? ` · ${mealLabel}` : ''}`,
},
unit_amount: cents,
},
quantity: qty,
})
}
} else {
const cents = Math.round(mealPrice * 100)
foodCents += cents
foodItems.push({
price_data: {
currency: 'usd',
product_data: {
name: `${mealName} from ${restName}`,
description: `${dateLabel || 'YourKitchen meal delivery'}${mealLabel ? ` · ${mealLabel}` : ''}`,
},
unit_amount: cents,
},
quantity: 1,
})
}
mealSubtotalCents += foodCents
meals.push({ proposalId: proposal.id, foodItems, foodCents, pickupLat, pickupLng, pickupAddr, deliveryMiles, restName })

}

// ── Per-delivery fees: each meal is its own driver run ──────────────────────
// Each meal is its own Stripe PaymentIntent AND its own courier dispatch, so we
// quote the courier PER restaurant (real pickup → kitchen distance) and charge
// the FULL tip PER delivery — never split one tip across multiple drivers. The
// service fee (5% + $0.99) is per delivery too, since each is its own card
// transaction. Single-restaurant orders are unchanged; multi-restaurant orders
// now cost (tip + courier + service) × number of deliveries, as they should.
const SERVICE_PCT = 0.05
const SERVICE_FLAT_CENTS = 99
const perTipCents = is_pickup ? 0 : (tip_amount || 0)

const fees: { courier: number; tip: number; service: number }[] = []
for (const m of meals) {
  let courierCents = 0
  if (!is_pickup) {
    const mileageEstimate = getDeliveryFee(m.deliveryMiles)
    const q = await resolveCourierFee({
      pickupLat: m.pickupLat,
      pickupLng: m.pickupLng,
      pickupAddress: m.pickupAddr,
      dropoffLat: kitchen.latitude != null ? Number(kitchen.latitude) : null,
      dropoffLng: kitchen.longitude != null ? Number(kitchen.longitude) : null,
      dropoffAddress: (kitchen as any).address || '',
      tipDollars: (tip_amount || 0) / 100,
    }, mileageEstimate)
    courierCents = Math.round(q.feeDollars * 100)
  }
  const preFee = m.foodCents + courierCents + perTipCents
  const serviceC = m.foodCents > 0 ? Math.round(preFee * SERVICE_PCT) + SERVICE_FLAT_CENTS : 0
  fees.push({ courier: courierCents, tip: perTipCents, service: serviceC })
}

const N = meals.length

// One Checkout session (= one PaymentIntent) per meal. Built in REVERSE so each
// session's success_url hands off to the NEXT meal's payment via /api/pay-next —
// the coordinator pays each meal in turn, ending on payment-success.
const APP = process.env.NEXT_PUBLIC_APP_URL
const SITE = process.env.NEXT_PUBLIC_SITE_URL
let nextSuccessUrl = `${APP}/payment-success?recipient=${encodeURIComponent(recipientFirst)}&slug=${encodeURIComponent(kitchen_slug ?? '')}`
let firstUrl: string | null = null
for (let k = N - 1; k >= 0; k--) {
const m = meals[k]
const f = fees[k]
const li: any[] = [...m.foodItems]
if (f.courier > 0) li.push({ price_data: { currency: 'usd', product_data: { name: 'Courier delivery fee', description: 'Door-to-door courier' }, unit_amount: f.courier }, quantity: 1 })
if (f.tip > 0) li.push({ price_data: { currency: 'usd', product_data: { name: 'Dasher tip', description: 'Goes directly to your driver — 100% passed through' }, unit_amount: f.tip }, quantity: 1 })
if (f.service > 0) li.push({ price_data: { currency: 'usd', product_data: { name: 'Service fee', description: 'Covers coordination, SMS, payment processing, and delivery integration' }, unit_amount: f.service }, quantity: 1 })

const session = await stripe.checkout.sessions.create({
payment_method_types: ['card'],
line_items: li,
mode: 'payment',
expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
payment_intent_data: { capture_method: 'manual' },
customer_email: email,
success_url: nextSuccessUrl,
cancel_url: `${SITE}/k/${kitchen_slug ?? ''}`,
metadata: {
type: 'proposal',
proposal_ids: JSON.stringify([m.proposalId]),
coordinator_name: name,
},
})
await supabase.from('meal_proposals').update({ stripe_session_id: session.id }).eq('id', m.proposalId)
nextSuccessUrl = `${APP}/api/pay-next?s=${session.id}`
firstUrl = session.url
}

return NextResponse.json({ checkout_url: firstUrl })

} catch (err: any) {
await releaseLocks()
console.error('[Proposal] Error:', err.message)
return NextResponse.json({ error: err.message }, { status: 500 })
}
}

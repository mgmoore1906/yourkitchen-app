import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { NextResponse } from 'next/server'
import { haversineDistance, getDeliveryFee } from '@/lib/distance'
import { resolveCourierFee } from '@/lib/shipday'

const supabase = createClient(
process.env.NEXT_PUBLIC_SUPABASE_URL!,
process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(request: Request) {
try {
const {
name, email, phone, note,
proposals,
kitchen_slug,
tip_amount,
delivery_preference,
delivery_note,
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
.select('id, name, latitude, longitude, address, breakfast_windows, lunch_windows, dinner_windows')
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
const lineItems: any[] = []
let mealSubtotalCents = 0
let deliveryMiles: number | null = null
// Captured for the real Shipday courier quote at the fee block below.
let pickupLat: number | null = null
let pickupLng: number | null = null
let pickupAddr = ''


for (const p of proposals) {

let kitchenRestaurantId: string | null = null
let mealName: string
let mealPrice: number
let restName: string
let dateLabel: string
let mealItems: any[] = []

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
if (claimError) return NextResponse.json({ error: claimError.message }, { status: 400 })

// ── Proposal ─────────────────────────────────────────────────────────
const { data: proposal, error: proposalError } = await supabase
.from('meal_proposals')
.insert({
claim_id: claim.id,
kitchen_id: kitchen.id,
kitchen_restaurant_id: kitchenRestaurantId,
menu_item_id: use_places ? null : p.menu_item_id,
coordinator_name: name,
coordinator_note: note || null,
tip_amount: tip_amount || 0,
delivery_preference: delivery_preference || 'leave_at_door',
delivery_note: delivery_note || null,
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
if (proposalError) return NextResponse.json({ error: proposalError.message }, { status: 400 })

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

// ── Stripe line items ────────────────────────────────────────────────
if (mealItems.length > 0) {
// Multi-item cart: one line item per dish, with quantity
for (const item of mealItems) {
const cents = Math.round((item.price || 0) * 100)
const qty = item.qty || 1
if (cents <= 0) continue
mealSubtotalCents += cents * qty
lineItems.push({
price_data: {
currency: 'usd',
product_data: {
name: `${item.name}${item.category === 'kids' ? ' (kids)' : ''}`,
description: `${restName}${dateLabel ? ` · ${dateLabel}` : ''}`,
},
unit_amount: cents,
},
quantity: qty,
})
}
} else {
// Fallback: single meal
const cents = Math.round(mealPrice * 100)
mealSubtotalCents += cents
lineItems.push({
price_data: {
currency: 'usd',
product_data: {
name: `${mealName} from ${restName}`,
description: dateLabel || 'YourKitchen meal delivery',
},
unit_amount: cents,
},
quantity: 1,
})
}
}

// ── Courier delivery fee (real Shipday quote, fallback to mileage estimate) ──
// Prefer the actual courier quote so the coordinator is charged what delivery
// truly costs; fall back to the distance-based estimate if Shipday has no quote.
const mileageEstimate = getDeliveryFee(deliveryMiles)
const courierQuote = await resolveCourierFee({
pickupLat,
pickupLng,
pickupAddress: pickupAddr,
dropoffLat: kitchen.latitude != null ? Number(kitchen.latitude) : null,
dropoffLng: kitchen.longitude != null ? Number(kitchen.longitude) : null,
dropoffAddress: (kitchen as any).address || '',
tipDollars: (tip_amount || 0) / 100,
}, mileageEstimate)
const deliveryFeeAmt = courierQuote.feeDollars
const distanceNote = courierQuote.source === 'shipday'
? 'Live courier quote'
: (deliveryMiles !== null
? `${deliveryMiles.toFixed(1)} mi · estimated courier rate`
: 'Estimated courier rate')

lineItems.push({
price_data: {
currency: 'usd',
product_data: { name: 'Courier delivery fee', description: distanceNote },
unit_amount: Math.round(deliveryFeeAmt * 100),
},
quantity: 1,
})

// ── Dasher tip (100% pass-through) ───────────────────────────────────────
if ((tip_amount || 0) > 0) {
lineItems.push({
price_data: {
currency: 'usd',
product_data: { name: 'Dasher tip', description: 'Goes directly to your driver — 100% passed through' },
unit_amount: tip_amount,
},
quantity: 1,
})
}

// ── Service fee (5% + $0.99) ─────────────────────────────────────────────
// Sized to fully cover Stripe processing (~2.9% + $0.30) AND leave a real
// per-order margin. Computed on the pre-fee total (meal + courier + tip) so
// it scales with order size and is never underwater, even on small meals.
// All component amounts here are in CENTS.
const courierCents = Math.round(deliveryFeeAmt * 100)
const tipCents = tip_amount || 0
const preFeeCents = mealSubtotalCents + courierCents + tipCents
const SERVICE_PCT = 0.05
const SERVICE_FLAT_CENTS = 99
const serviceFee = Math.round(preFeeCents * SERVICE_PCT) + SERVICE_FLAT_CENTS
if (serviceFee > 0) {
lineItems.push({
price_data: {
currency: 'usd',
product_data: {
name: 'Service fee',
description: 'Covers coordination, SMS, payment processing, and delivery integration',
},
unit_amount: serviceFee,
},
quantity: 1,
})
}

// ── Stripe Checkout session ──────────────────────────────────────────────
const session = await stripe.checkout.sessions.create({
payment_method_types: ['card'],
line_items: lineItems,
mode: 'payment',
payment_intent_data: { capture_method: 'manual' },
customer_email: email,
success_url: `${process.env.NEXT_PUBLIC_APP_URL}/payment-success?recipient=${encodeURIComponent(recipientFirst)}`,
cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/k/${kitchen_slug ?? ''}`,
metadata: {
type: 'proposal',
proposal_ids: JSON.stringify(proposalIds),
coordinator_name: name,
},
})

if (session.id && proposalIds.length > 0) {
await supabase.from('meal_proposals')
.update({ stripe_session_id: session.id })
.in('id', proposalIds)
}

return NextResponse.json({ checkout_url: session.url })

} catch (err: any) {
console.error('[Proposal] Error:', err.message)
return NextResponse.json({ error: err.message }, { status: 500 })
}
}

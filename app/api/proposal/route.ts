import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { NextResponse } from 'next/server'
import { haversineDistance, getDeliveryFee } from '@/lib/distance'

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
      use_places, // true = Google Places flow (name+price direct), false = legacy menu_item_id flow
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
      .select('id, name, latitude, longitude')
      .eq('slug', kitchen_slug)
      .single()
    if (!kitchen) return NextResponse.json({ error: 'Kitchen not found' }, { status: 404 })

    const recipientFirst = kitchen.name?.split("'")[0] || 'your recipient'

    const proposalIds: string[] = []
    const lineItems:   any[]    = []

    // ── Per-proposal distance (for delivery fee) ─────────────────────────────
    // We calculate once using first restaurant with coordinates
    let deliveryMiles: number | null = null

    for (const p of proposals) {

      // ── Resolve restaurant + meal depending on flow ──────────────────────
      let kitchenRestaurantId: string | null = null
      let mealName:   string
      let mealPrice:  number  // in dollars
      let restName:   string
      let dateLabel:  string

      if (use_places) {
        // New flow: coordinator picked from Google Places favorites
        // p has: restaurant_name, restaurant_address, place_id,
        //        menu_item_name, menu_item_price, delivery_date, meal_type

        mealName  = p.menu_item_name  || 'Meal'
        mealPrice = p.menu_item_price || 15
        restName  = p.restaurant_name || 'Restaurant'
        dateLabel = p.delivery_date
          ? new Date(p.delivery_date + 'T12:00:00').toLocaleDateString('en-US', {
              weekday: 'short', month: 'short', day: 'numeric' })
          : ''

        // Find the kitchen_restaurant record by name for the FK
        const { data: kr } = await supabase
          .from('kitchen_restaurants')
          .select('id, lat, lng')
          .eq('kitchen_id', kitchen.id)
          .ilike('name', restName)
          .single()

        kitchenRestaurantId = kr?.id || null

        // Grab distance from saved restaurant lat/lng
        if (deliveryMiles === null && kitchen.latitude && kitchen.longitude && kr?.lat && kr?.lng) {
          deliveryMiles = haversineDistance(kitchen.latitude, kitchen.longitude, kr.lat, kr.lng)
        }

      } else {
        // Legacy flow: coordinator picked from seeded menu_items
        const [{ data: menuItem }, { data: restaurant }, { data: calDate }] = await Promise.all([
          supabase.from('menu_items').select('name, price').eq('id', p.menu_item_id).single(),
          supabase.from('kitchen_restaurants').select('id, name, lat, lng').eq('id', p.restaurant_id).single(),
          supabase.from('calendar_dates').select('date, meal_type').eq('id', p.calendar_date_id).single(),
        ])
        mealName            = menuItem?.name     || 'Meal'
        mealPrice           = menuItem?.price    || 15
        restName            = (restaurant as any)?.name || 'Restaurant'
        kitchenRestaurantId = (restaurant as any)?.id   || null
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
          calendar_date_id:     p.calendar_date_id,
          guest_coordinator_id: guest.id,
          claim_type:           'one_time',
          status:               'active',
          expires_at:           new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
        })
        .select('id')
        .single()
      if (claimError) return NextResponse.json({ error: claimError.message }, { status: 400 })

      // ── Proposal ─────────────────────────────────────────────────────────
      const { data: proposal, error: proposalError } = await supabase
        .from('meal_proposals')
        .insert({
          claim_id:              claim.id,
          kitchen_id:            kitchen.id,
          kitchen_restaurant_id: kitchenRestaurantId,
          menu_item_id:          use_places ? null : p.menu_item_id,
          coordinator_name:      name,
          coordinator_note:      note             || null,
          tip_amount:            tip_amount        || 0,
          delivery_preference:   delivery_preference || 'leave_at_door',
          delivery_note:         delivery_note     || null,
          // Denormalized display fields
          restaurant_name:       restName,
          meal_name:             mealName,
          delivery_date:         use_places ? p.delivery_date : undefined,
          meal_type:             use_places ? p.meal_type     : undefined,
          status:                'pending',
        })
        .select('id')
        .single()
      if (proposalError) return NextResponse.json({ error: proposalError.message }, { status: 400 })

      // Denormalize for legacy flow (already done above for places flow)
      if (!use_places && proposal?.id) {
        const { data: calDate } = await supabase
          .from('calendar_dates').select('date, meal_type').eq('id', p.calendar_date_id).single()
        await supabase.from('meal_proposals').update({
          delivery_date: calDate?.date            || null,
          meal_type:     (calDate as any)?.meal_type || 'dinner',
        }).eq('id', proposal.id)
      }

      proposalIds.push(proposal.id)

      // ── Stripe line item for this meal ───────────────────────────────────
      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: {
            name:        `${mealName} from ${restName}`,
            description: dateLabel ? `${dateLabel}` : 'YourKitchen meal delivery',
          },
          unit_amount: Math.round(mealPrice * 100),
        },
        quantity: 1,
      })
    }

    // ── Courier delivery fee (distance-based, DoorDash Drive formula) ────────
    const deliveryFeeAmt = getDeliveryFee(deliveryMiles)
    const distanceNote   = deliveryMiles !== null
      ? `${deliveryMiles.toFixed(1)} mi · DoorDash Drive rate with tip discount`
      : 'DoorDash Drive / Uber Direct courier'

    lineItems.push({
      price_data: {
        currency: 'usd',
        product_data: {
          name:        'Courier delivery fee',
          description: distanceNote,
        },
        unit_amount: Math.round(deliveryFeeAmt * 100),
      },
      quantity: 1,
    })

    // ── Dasher tip (passed 100% to driver) ───────────────────────────────────
    if ((tip_amount || 0) > 0) {
      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: {
            name:        'Dasher tip',
            description: 'Goes directly to your driver — 100% passed through',
          },
          unit_amount: tip_amount,
        },
        quantity: 1,
      })
    }

    // ── YourKitchen platform fee (3% of meal subtotal only) ──────────────────
    const mealSubtotal = lineItems
      .filter(li => !['Courier delivery fee','Dasher tip','YourKitchen platform fee (3%)'].includes(li.price_data.product_data.name))
      .reduce((sum, li) => sum + li.price_data.unit_amount, 0)
    const platformFee = Math.round(mealSubtotal * 0.03)
    if (platformFee > 0) {
      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: {
            name:        'YourKitchen platform fee (3%)',
            description: 'Covers coordination, SMS notifications, and delivery integration',
          },
          unit_amount: platformFee,
        },
        quantity: 1,
      })
    }

    // ── Stripe Checkout session ──────────────────────────────────────────────
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items:           lineItems,
      mode:                 'payment',
      payment_intent_data:  { capture_method: 'manual' }, // hold, don't charge yet
      customer_email:       email,
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/payment-success?recipient=${encodeURIComponent(recipientFirst)}`,
      cancel_url:  `${process.env.NEXT_PUBLIC_SITE_URL}/k/${kitchen_slug ?? ''}`,
      metadata: {
        type:             'proposal',
        proposal_ids:     JSON.stringify(proposalIds),
        coordinator_name: name,
      },
    })

    // Save session ID as fallback for confirm route
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

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/dispatcher-orders  — header: x-dispatcher-secret
//
// A NARROW, READ-ONLY view of confirmed orders for trusted helpers who place
// food orders. Gated by its OWN secret (DISPATCHER_SECRET), separate from the
// full ADMIN_SECRET, so a helper can be given dispatch access without unlocking
// any other admin endpoint — and can be revoked by rotating ONLY this secret.
//
// Exposes only what is needed to place and route an order:
//   - what to order: restaurant name/address/phone, meal, items, meal type
//   - where it goes: recipient kitchen first-name label + delivery address + note
//   - when: delivery date, delivery preference
//   - tip (so the order total is correct)
//
// Deliberately does NOT expose: recipient phone or email, coordinator contact
// details, payment identifiers, Stripe data, or any other kitchen's data beyond
// the single order row. This route is read-only — it cannot mutate anything.
export async function GET(request: Request) {
  const secret = request.headers.get('x-dispatcher-secret')
  if (!process.env.DISPATCHER_SECRET || secret !== process.env.DISPATCHER_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('meal_proposals')
    .select(`
      id, status, delivery_status, meal_type, delivery_date,
      delivery_preference, delivery_note, coordinator_name,
      restaurant_name, meal_name, meal_items, tip_amount,
      doordash_tracking_url,
      kitchen_restaurants(name, address, phone),
      kitchens:kitchen_id(name, address)
    `)
    .eq('status', 'confirmed')
    .order('delivery_date', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Reduce the recipient kitchen to a first-name label only — a dispatcher needs
  // to know whose order this is and where it goes, not the full account identity.
  const firstNameOf = (name: string) => {
    const base = (name || '').replace(/'s Kitchen$/i, '').trim()
    return base.split(/\s+/)[0] || base
  }

  const orders = (data || []).map((r: any) => ({
    id: r.id,
    status: r.status,
    delivery_status: r.delivery_status,
    meal_type: r.meal_type,
    delivery_date: r.delivery_date,
    delivery_preference: r.delivery_preference,
    delivery_note: r.delivery_note,
    coordinator_name: r.coordinator_name,
    restaurant_name: r.restaurant_name || r.kitchen_restaurants?.name || '',
    restaurant_address: r.kitchen_restaurants?.address || '',
    restaurant_phone: r.kitchen_restaurants?.phone || '',
    meal_name: r.meal_name,
    meal_items: r.meal_items,
    tip_amount: r.tip_amount,
    tracking_url: r.doordash_tracking_url || '',
    // Recipient: first-name label + delivery address (needed to place the order)
    recipient_first_name: firstNameOf(r.kitchens?.name || ''),
    delivery_address: r.kitchens?.address || '',
  }))

  return NextResponse.json({ orders })
}

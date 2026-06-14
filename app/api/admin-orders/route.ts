import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// GET /api/admin-orders  — header: x-admin-secret
// Returns all confirmed proposals for the Dispatch tab, using the service-role
// key so RLS on meal_proposals doesn't block the read (the browser anon client
// silently returns empty on this filtered query).
export async function GET(request: Request) {
  const supabase = getSupabase()
  const adminSecret = request.headers.get('x-admin-secret')
  if (adminSecret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('meal_proposals')
    .select(`
      id, status, delivery_status, meal_type, delivery_date, delivery_time, is_pickup,
      delivery_preference, delivery_note, coordinator_name,
      restaurant_name, meal_name, meal_items, tip_amount, stripe_amount,
      doordash_tracking_url, doordash_delivery_id,
      kitchen_restaurants(name, address, phone),
      kitchens:kitchen_id(name, address)
    `)
    .eq('status', 'confirmed')
    .order('delivery_date', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const orders = (data || []).map((r: any) => ({
    ...r,
    kitchen_name: r.kitchens?.name || '',
    kitchen_address: r.kitchens?.address || '',
    restaurant_address: r.kitchen_restaurants?.address || '',
    restaurant_phone: r.kitchen_restaurants?.phone || '',
  }))

  return NextResponse.json({ orders })
}

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// CSV cell escape: wrap in quotes, double any internal quotes.
function cell(v: any): string {
  const s = v === null || v === undefined ? '' : String(v)
  return `"${s.replace(/"/g, '""')}"`
}
function money(n: number): string { return (Math.round(n * 100) / 100).toFixed(2) }

// GET /api/admin-export — header: x-admin-secret
// Full reconciliation export of every PAID order (confirmed + delivered), so the
// first orders show up even after they're marked complete. Opens in Excel.
export async function GET(request: Request) {
  const supabase = getSupabase()
  if (request.headers.get('x-admin-secret') !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('meal_proposals')
    .select(`
      id, status, delivery_status, is_pickup, delivery_date, proposed_at, responded_at,
      coordinator_name, restaurant_name, meal_name, meal_items, tip_amount, stripe_amount,
      doordash_delivery_id, kitchens:kitchen_id(name)
    `)
    .in('status', ['confirmed', 'delivered'])
    .order('responded_at', { ascending: true, nullsFirst: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const headers = [
    'Order #', 'Proposed', 'Charged', 'Delivery date', 'Recipient (kitchen)', 'Coordinator',
    'Meal', 'Restaurant', 'Type', 'Status', 'Delivery status',
    'Food subtotal $', 'Tip $', 'Total charged $', 'Non-food collected $ (delivery+service)',
    'Courier/Order ID',
  ]

  const rows = (data || []).map((r: any) => {
    const items = Array.isArray(r.meal_items) ? r.meal_items : []
    const food = items.reduce((sum: number, i: any) => sum + (Number(i.price) || 0) * (Number(i.qty) || 1), 0)
    const meal = r.meal_name || (items.length ? items.map((i: any) => (i.qty > 1 ? `${i.name} x${i.qty}` : i.name)).join(', ') : '')
    const tip = (Number(r.tip_amount) || 0) / 100
    const total = (Number(r.stripe_amount) || 0) / 100
    const nonFood = total - food - tip
    const d = (s: string | null) => (s ? new Date(s).toLocaleDateString('en-US') : '')
    return [
      'YK-' + String(r.id).slice(0, 8).toUpperCase(),
      d(r.proposed_at), d(r.responded_at), r.delivery_date || '',
      r.kitchens?.name || '', r.coordinator_name || '',
      meal, r.restaurant_name || '',
      r.is_pickup ? 'Pickup' : 'Delivery', r.status || '', r.delivery_status || '',
      money(food), money(tip), money(total), money(nonFood),
      r.doordash_delivery_id || '',
    ]
  })

  const csv = [headers, ...rows].map(row => row.map(cell).join(',')).join('\r\n')
  const today = new Date().toISOString().slice(0, 10)
  return new NextResponse('\uFEFF' + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="yourkitchen-orders-${today}.csv"`,
    },
  })
}

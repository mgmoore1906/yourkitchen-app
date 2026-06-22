import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// POST /api/admin-complete  — header: x-admin-secret  — body: { proposal_id }
// Manually marks an order delivered/complete. Needed for PICKUP orders (no courier
// webhook auto-completes them) and as a manual override. Setting status='delivered'
// drops it off the active Dispatch/Orders lists (which filter status='confirmed').
export async function POST(request: Request) {
  const supabase = getSupabase()
  if (request.headers.get('x-admin-secret') !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { proposal_id } = await request.json().catch(() => ({}))
  if (!proposal_id) return NextResponse.json({ error: 'Missing proposal_id' }, { status: 400 })
  const { error } = await supabase
    .from('meal_proposals')
    .update({ status: 'delivered', delivery_status: 'delivered' })
    .eq('id', proposal_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

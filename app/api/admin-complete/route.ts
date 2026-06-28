import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { captureServer } from '@/lib/posthog-server'
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

  // Funnel: 'meal delivered' fires here on manual close. With Shipday paused this
  // is where delivery actually completes, so the funnel's delivered step stays live.
  try {
    const { data: p } = await supabase
      .from('meal_proposals')
      .select('restaurant_name, kitchens:kitchen_id(recipient_id)')
      .eq('id', proposal_id)
      .single()
    await captureServer((p as any)?.kitchens?.recipient_id, 'meal delivered', { restaurant: (p as any)?.restaurant_name || null, source: 'manual' })
  } catch {}

  return NextResponse.json({ ok: true })
}

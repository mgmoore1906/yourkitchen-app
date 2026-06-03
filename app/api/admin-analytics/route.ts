import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/admin-analytics?range=30d   header: x-admin-secret
// Returns kitchens, proposals, profiles for the analytics dashboard, read with
// the service-role key so RLS doesn't silently return empty (the browser anon
// client gets blocked on these tables, same as the dispatch tab did).
export async function GET(request: Request) {
  if (request.headers.get('x-admin-secret') !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const range = searchParams.get('range') || '30d'
  const cutoff = range === '7d' ? new Date(Date.now() - 7 * 86400000).toISOString()
    : range === '30d' ? new Date(Date.now() - 30 * 86400000).toISOString()
    : range === '90d' ? new Date(Date.now() - 90 * 86400000).toISOString()
    : '2020-01-01T00:00:00Z'

  const [k, p, pr] = await Promise.all([
    supabase.from('kitchens')
      .select('id,name,slug,tier,created_at,address,organizer_id,household_adults,household_children'),
    supabase.from('meal_proposals')
      .select('id,status,delivery_status,meal_type,delivery_date,coordinator_name,restaurant_name,meal_name,tip_amount,proposed_at,kitchen_id')
      .gte('proposed_at', cutoff),
    supabase.from('profiles')
      .select('id,full_name,created_at,tier,phone,sms_consent')
      .gte('created_at', cutoff),
  ])

  return NextResponse.json({
    kitchens: k.data || [],
    proposals: p.data || [],
    profiles: pr.data || [],
  })
}

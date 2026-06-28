import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { geocodeAddress } from '@/lib/geocode'
import { getSessionUserId } from '@/lib/requireUser'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ── GET ─ Resolve the kitchen(s) where the signed-in user is the RECIPIENT ──
// Scoped by recipient_id, so a recipient only ever sees the kitchen(s) set up
// for them — never the sponsor's other kitchens, never billing.
export async function GET() {
  const userId = await getSessionUserId()
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const supabase = getSupabase()
  const { data: kitchens, error } = await supabase
    .from('kitchens')
    .select('id, name, slug, address, latitude, longitude')
    .eq('recipient_id', userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ kitchens: kitchens || [] })
}

// ── PATCH ─ Update the recipient's own kitchen (address / name) ──
// Access-controlled: the signed-in user must be the recipient OR organizer of
// the target kitchen. This is the gate the catalog/calendar routes will reuse so
// a recipient can only ever edit the kitchen that's theirs.
export async function PATCH(request: Request) {
  const userId = await getSessionUserId()
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const supabase = getSupabase()
  try {
    const { kitchen_id, address, name } = await request.json()
    if (!kitchen_id) return NextResponse.json({ error: 'Missing kitchen_id' }, { status: 400 })

    const { data: k } = await supabase
      .from('kitchens')
      .select('id, organizer_id, recipient_id')
      .eq('id', kitchen_id)
      .single()

    if (!k || (k.recipient_id !== userId && k.organizer_id !== userId)) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
    }

    const patch: Record<string, any> = {}
    if (typeof name === 'string' && name.trim()) patch.name = name.trim()
    if (typeof address === 'string') {
      patch.address = address || null
      const coords = address ? await geocodeAddress(address) : null
      patch.latitude = coords?.lat ?? null
      patch.longitude = coords?.lng ?? null
    }
    if (!Object.keys(patch).length) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }

    const { error: uErr } = await supabase.from('kitchens').update(patch).eq('id', kitchen_id)
    if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Request failed' }, { status: 500 })
  }
}

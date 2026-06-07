import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY!

async function fetchPlaceDetails(placeId: string): Promise<{ address: string | null; phone: string | null }> {
  if (!placeId || !PLACES_API_KEY) return { address: null, phone: null }
  try {
    const url = new URL('https://maps.googleapis.com/maps/api/place/details/json')
    url.searchParams.set('place_id', placeId)
    url.searchParams.set('fields', 'formatted_address,formatted_phone_number')
    url.searchParams.set('key', PLACES_API_KEY)
    const res = await fetch(url.toString())
    const data = await res.json()
    if (data.status !== 'OK') return { address: null, phone: null }
    return {
      address: data.result?.formatted_address || null,
      phone:   data.result?.formatted_phone_number || null,
    }
  } catch {
    return { address: null, phone: null }
  }
}

// Detects a complete US address: ends in ", ST" or ", ST 12345"
function hasState(addr: string | null): boolean {
  if (!addr) return false
  return /,\s*[A-Z]{2}(\s+\d{5})?\s*$/.test(addr)
}

// POST /api/admin-backfill-addresses   header: x-admin-secret
// Walks every kitchen_restaurant that has a place_id but a truncated address
// (no state/ZIP), fetches the full formatted_address from Place Details, and
// updates the row. Idempotent — rows that already have a complete address are
// skipped. Safe to run multiple times.
export async function POST(request: Request) {
  const supabase = getSupabase()
  if (request.headers.get('x-admin-secret') !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: rows, error } = await supabase
    .from('kitchen_restaurants')
    .select('id, name, place_id, address, phone')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const results: any[] = []
  let updated = 0, skipped = 0, failed = 0

  for (const r of rows || []) {
    // Skip rows that already have a full address
    if (hasState(r.address)) { skipped++; continue }
    // Can't fix without a place_id
    if (!r.place_id) {
      failed++
      results.push({ id: r.id, name: r.name, status: 'no place_id', old: r.address })
      continue
    }
    const details = await fetchPlaceDetails(r.place_id)
    if (!details.address) {
      failed++
      results.push({ id: r.id, name: r.name, status: 'details failed', old: r.address })
      continue
    }
    await supabase.from('kitchen_restaurants')
      .update({ address: details.address, ...(details.phone ? { phone: details.phone } : {}) })
      .eq('id', r.id)
    updated++
    results.push({ id: r.id, name: r.name, status: 'updated', old: r.address, new: details.address })
    // Gentle pacing to stay well under Places rate limits
    await new Promise(res => setTimeout(res, 120))
  }

  return NextResponse.json({
    summary: { total: rows?.length || 0, updated, skipped, failed },
    results,
  })
}

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { geocodeAddress } from '@/lib/geocode'
export const dynamic = 'force-dynamic'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Set or clear a kitchen's temporary delivery window. Kept separate from
// /api/settings so this save/clear can never disturb the main settings write.
export async function POST(request: Request) {
  const supabase = getSupabase()
  try {
    const { user_id, temp_address, temp_start_date, temp_end_date, clear } = await request.json()
    if (!user_id) return NextResponse.json({ error: 'Missing user_id' }, { status: 400 })

    if (clear) {
      const { error } = await supabase
        .from('kitchens')
        .update({
          temp_address:    null,
          temp_latitude:   null,
          temp_longitude:  null,
          temp_start_date: null,
          temp_end_date:   null,
        })
        .eq('organizer_id', user_id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true, cleared: true })
    }

    if (!temp_address?.trim())              return NextResponse.json({ error: 'Address is required' }, { status: 400 })
    if (!temp_start_date || !temp_end_date) return NextResponse.json({ error: 'Both dates are required' }, { status: 400 })
    if (temp_end_date < temp_start_date)    return NextResponse.json({ error: 'End date cannot be before the start date' }, { status: 400 })

    // Geocoding MUST succeed — without coordinates the courier can't be routed,
    // so we refuse to save a temp address we can't resolve and tell the user.
    const coords = await geocodeAddress(temp_address)
    if (!coords) {
      return NextResponse.json({ error: 'Could not locate that address. Check the spelling and try again.' }, { status: 400 })
    }

    const { error } = await supabase
      .from('kitchens')
      .update({
        temp_address:    temp_address.trim(),
        temp_latitude:   coords.lat,
        temp_longitude:  coords.lng,
        temp_start_date: temp_start_date,
        temp_end_date:   temp_end_date,
      })
      .eq('organizer_id', user_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, lat: coords.lat, lng: coords.lng })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

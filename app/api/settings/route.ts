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

export async function POST(request: Request) {
  const supabase = getSupabase()
  try {
    const {
      user_id,
      full_name,
      phone,
      address,
      household_adults,
      household_children,
      dietary_restrictions,
      breakfast_windows,
      lunch_windows,
      dinner_windows,
      proxy_name,
      proxy_phone,
    } = await request.json()

    if (!user_id)        return NextResponse.json({ error: 'Missing user_id' }, { status: 400 })
    if (!full_name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ full_name: full_name.trim(), phone: phone || null })
      .eq('id', user_id)

    if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })

    const { data: kitchen } = await supabase
      .from('kitchens')
      .select('name, address')
      .eq('organizer_id', user_id)
      .single()

    const shouldUpdateName = !kitchen?.name
      || kitchen.name === "'s Kitchen"
      || kitchen.name.startsWith("'s ")

    // Re-geocode whenever an address is present.
    //
    // We deliberately do NOT gate this on `address !== kitchen.address`. That
    // string compare was fragile: the settings form parses the stored address
    // into Street/Apt/City/State/ZIP on load and re-assembles it on save, and
    // that round-trip isn't always byte-identical. A real change (e.g. state +
    // ZIP only) could re-assemble to the same string and silently skip
    // geocoding — leaving the kitchen lat/lng stale so restaurant search stayed
    // locked to the old area. Geocoding API calls are effectively free at our
    // scale, so we just always resolve fresh coordinates when an address exists
    // and only update them when the geocode actually succeeds.
    let coordsUpdate: { latitude: number; longitude: number } | {} = {}
    if (address && address.trim()) {
      const coords = await geocodeAddress(address)
      if (coords) coordsUpdate = { latitude: coords.lat, longitude: coords.lng }
    }

    const { error: kitchenError } = await supabase
      .from('kitchens')
      .update({
        ...(shouldUpdateName ? { name: `${full_name.trim()}'s Kitchen` } : {}),
        address:             address || null,
        ...coordsUpdate,
        household_adults:    household_adults ?? 2,
        household_children:  household_children ?? 2,
        dietary_restrictions: dietary_restrictions || [],
        breakfast_windows:   breakfast_windows || ['07:00-09:00'],
        lunch_windows:       lunch_windows     || ['11:00-12:30'],
        dinner_windows:      dinner_windows    || ['17:30-19:00'],
        proxy_name:          proxy_name?.trim() || null,
        proxy_phone:         proxy_phone?.trim() || null,
      })
      .eq('organizer_id', user_id)

    if (kitchenError) return NextResponse.json({ error: kitchenError.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

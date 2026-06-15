import { NextRequest, NextResponse } from 'next/server'

const KEY = process.env.GOOGLE_PLACES_API_KEY!

// Validates a free-text US address against Google Geocoding and only accepts a
// real, street-level, deliverable address. Returns the Google-normalized
// formatted address so the user confirms what a driver will actually see —
// not the raw gibberish they may have typed.
export async function POST(request: NextRequest) {
  try {
    const { address } = await request.json()
    if (!address || !String(address).trim() || !KEY) {
      return NextResponse.json({ ok: false, reason: 'missing' })
    }
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json')
    url.searchParams.set('address', String(address))
    url.searchParams.set('region', 'us')
    url.searchParams.set('components', 'country:US')
    url.searchParams.set('key', KEY)

    const res = await fetch(url.toString())
    const data = await res.json()

    if (data.status !== 'OK' || !data.results?.length) {
      return NextResponse.json({ ok: false, reason: 'not_found' })
    }

    const r = data.results[0]
    const loc = r.geometry?.location
    const locType = r.geometry?.location_type // ROOFTOP | RANGE_INTERPOLATED | GEOMETRIC_CENTER | APPROXIMATE
    const types: string[] = r.types || []
    const comps = r.address_components || []

    const streetLevel = locType === 'ROOFTOP' || locType === 'RANGE_INTERPOLATED'
    const hasStreetNumber = comps.some((c: any) => c.types?.includes('street_number'))
    const isAddressType = types.some((t) => ['street_address', 'premise', 'subpremise'].includes(t))
    const precise = streetLevel && hasStreetNumber && isAddressType && !!loc

    if (!precise) {
      return NextResponse.json({
        ok: false,
        reason: 'imprecise',
        formatted: r.formatted_address || null,
      })
    }

    return NextResponse.json({
      ok: true,
      formatted: r.formatted_address,
      lat: loc.lat,
      lng: loc.lng,
      partial: !!r.partial_match,
    })
  } catch {
    return NextResponse.json({ ok: false, reason: 'error' })
  }
}

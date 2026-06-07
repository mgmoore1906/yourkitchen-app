import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
const PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY!

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const lat    = searchParams.get('lat')
    const lng    = searchParams.get('lng')
    const query  = searchParams.get('query') || 'restaurant'
    // 8 miles default (~13km) — optimal for tip economics
    // Caller can pass ?radius=XXXX to override
    const radius = searchParams.get('radius') || '13000'

    if (!lat || !lng) {
      return NextResponse.json({ error: 'lat and lng required' }, { status: 400 })
    }

    const url = new URL('https://maps.googleapis.com/maps/api/place/nearbysearch/json')
    url.searchParams.set('location', `${lat},${lng}`)
    url.searchParams.set('radius',   radius)
    url.searchParams.set('type',     'restaurant')
    url.searchParams.set('keyword',  query)
    url.searchParams.set('key',      PLACES_API_KEY)

    const res  = await fetch(url.toString())
    const data = await res.json()

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error('[Places] API error:', data.status, data.error_message)
      return NextResponse.json({ error: data.error_message || data.status }, { status: 500 })
    }

    const restaurants = (data.results || []).slice(0, 15).map((place: any) => ({
      place_id:    place.place_id,
      name:        place.name,
      address:     place.vicinity,
      lat:         place.geometry?.location?.lat  ?? null,  // ← now included
      lng:         place.geometry?.location?.lng  ?? null,  // ← now included
      rating:      place.rating      || null,
      price_level: place.price_level || null,
      is_open:     place.opening_hours?.open_now ?? null,
      photo_ref:   place.photos?.[0]?.photo_reference || null,
      types:       place.types || [],
    }))

    return NextResponse.json({ restaurants, query, count: restaurants.length })
  } catch (err: any) {
    console.error('[Places] Search error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

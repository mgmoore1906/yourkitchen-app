import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
const PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY!

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const lat    = searchParams.get('lat')
    const lng    = searchParams.get('lng')
    const query  = searchParams.get('query') || 'restaurant'

    if (!lat || !lng) {
      return NextResponse.json({ error: 'lat and lng required' }, { status: 400 })
    }

    // Relevance-ranked Text Search instead of nearbysearch + rankby=distance.
    // rankby=distance buried a real, slightly-far restaurant under every nearer match,
    // so a place that exists never surfaced. Text Search finds named places by relevance
    // at ANY distance, with the kitchen as a location bias so nearby spots still rank well.
    // No type=restaurant filter on purpose: it silently dropped bakeries, taquerias,
    // donut shops, delis, and taco trucks (categorized as bakery / meal_takeaway), which
    // was another "it won't show" bug. The query carries the intent.
    const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json')
    url.searchParams.set('query',    query)
    url.searchParams.set('location', `${lat},${lng}`)
    url.searchParams.set('radius',   '50000') // 50km location bias, NOT a hard cap
    url.searchParams.set('key',      PLACES_API_KEY)

    const res  = await fetch(url.toString())
    const data = await res.json()

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error('[Places] API error:', data.status, data.error_message)
      return NextResponse.json({ error: data.error_message || data.status }, { status: 500 })
    }

    // Keep only food places. Text Search with no type filter also returns non-food
    // matches (e.g. "federal american grill" surfaced the Federal Courthouse). We filter
    // on Google's place types instead of a hard type=restaurant query param — this set is
    // broad on purpose so it KEEPS bakeries, taquerias, delis, donut shops, cafes, and taco
    // trucks (which type=restaurant would drop) while excluding offices, courthouses, parks.
    const FOOD_TYPES = new Set([
      'restaurant', 'food', 'cafe', 'bakery', 'bar',
      'meal_takeaway', 'meal_delivery', 'coffee_shop',
      'ice_cream_shop', 'sandwich_shop',
    ])
    const restaurants = (data.results || [])
      .filter((place: any) => (place.types || []).some((t: string) => FOOD_TYPES.has(t)))
      .slice(0, 20)
      .map((place: any) => ({
      place_id:    place.place_id,
      name:        place.name,
      address:     place.formatted_address || place.vicinity || '',  // textsearch returns formatted_address
      lat:         place.geometry?.location?.lat  ?? null,
      lng:         place.geometry?.location?.lng  ?? null,
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

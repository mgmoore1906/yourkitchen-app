import { NextResponse } from 'next/server'
import { checkRateLimit, clientIp, tooManyRequests } from '@/lib/ratelimit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY!

// Food-related Google Places types. A text search for e.g. "Chili's" near a
// location can return non-food matches (a courthouse, an office park); we keep
// only results whose types intersect this set so the list stays restaurants.
const FOOD_TYPES = new Set([
  'restaurant', 'cafe', 'meal_takeaway', 'meal_delivery', 'bakery', 'food', 'bar',
])

// GET /api/restaurants/search?lat=..&lng=..&query=..
// Returns { restaurants: [{ place_id, name, address, lat, lng, cuisine }] }
export async function GET(request: Request) {
  // This endpoint costs Places credits — cap per-IP like menu-parse.
  const rl = await checkRateLimit('restaurants-search', clientIp(request))
  if (rl.limited) return tooManyRequests(rl.reset)

  const { searchParams } = new URL(request.url)
  const query = (searchParams.get('query') || '').trim()
  const lat = searchParams.get('lat')
  const lng = searchParams.get('lng')

  if (!query) return NextResponse.json({ restaurants: [] })
  if (!PLACES_API_KEY) {
    return NextResponse.json({ error: 'Places API not configured', restaurants: [] }, { status: 500 })
  }

  try {
    const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json')
    url.searchParams.set('query', query)
    if (lat && lng) {
      // Bias to ~15 miles around the kitchen so results are actually local.
      url.searchParams.set('location', `${lat},${lng}`)
      url.searchParams.set('radius', '24000')
    }
    url.searchParams.set('type', 'restaurant')
    url.searchParams.set('key', PLACES_API_KEY)

    const res = await fetch(url.toString())
    const data = await res.json()

    if (data.status && data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error('[Places Text Search] status:', data.status, data.error_message)
      return NextResponse.json({ error: data.status, restaurants: [] }, { status: 502 })
    }

    const results = Array.isArray(data.results) ? data.results : []
    const restaurants = results
      .filter((r: any) => Array.isArray(r.types) && r.types.some((t: string) => FOOD_TYPES.has(t)))
      .slice(0, 10)
      .map((r: any) => ({
        place_id: r.place_id,
        name: r.name,
        address: r.formatted_address || r.vicinity || null,
        lat: r.geometry?.location?.lat ?? null,
        lng: r.geometry?.location?.lng ?? null,
        cuisine: 'Restaurant',
      }))

    return NextResponse.json({ restaurants })
  } catch (err: any) {
    console.error('[restaurants/search] error:', err.message)
    return NextResponse.json({ error: err.message, restaurants: [] }, { status: 500 })
  }
}

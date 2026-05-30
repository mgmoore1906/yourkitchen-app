const PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY!

/**
 * Resolve a free-text address to { lat, lng } using the Google Places
 * "Find Place From Text" endpoint. Uses the same API key already powering
 * restaurant search, so no additional Google API needs to be enabled.
 * Returns null on any failure (never throws) so callers can degrade gracefully.
 */
export async function geocodeAddress(
  address: string
): Promise<{ lat: number; lng: number } | null> {
  if (!address?.trim() || !PLACES_API_KEY) return null
  try {
    const url = new URL('https://maps.googleapis.com/maps/api/place/findplacefromtext/json')
    url.searchParams.set('input', address)
    url.searchParams.set('inputtype', 'textquery')
    url.searchParams.set('fields', 'geometry')
    url.searchParams.set('key', PLACES_API_KEY)

    const res = await fetch(url.toString())
    const data = await res.json()

    if (data.status !== 'OK') {
      console.error('[geocode] Places status:', data.status, data.error_message || '')
      return null
    }

    const loc = data.candidates?.[0]?.geometry?.location
    if (loc && typeof loc.lat === 'number' && typeof loc.lng === 'number') {
      return { lat: loc.lat, lng: loc.lng }
    }
    return null
  } catch (err: any) {
    console.error('[geocode] error:', err.message)
    return null
  }
}

const PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY!

/**
 * Resolve a free-text address to { lat, lng } using the Google Geocoding API.
 *
 * NOTE: This previously used the "Find Place From Text" endpoint, which is
 * built for locating named businesses/landmarks — not for geocoding street
 * addresses. That caused a real bug: changing only the ZIP (or any partial
 * address edit) often returned a stale candidate or null, so the kitchen
 * lat/lng never updated and restaurant search stayed locked to the old area.
 *
 * The Geocoding API is purpose-built to turn an address string into
 * coordinates and resolves partial/ZIP-only changes correctly.
 *
 * Uses the same Google API key as restaurant search. Requires the
 * "Geocoding API" to be enabled on that key in the Google Cloud console
 * (Places API alone is not sufficient for this endpoint).
 *
 * Returns null on any failure (never throws) so callers can degrade gracefully.
 */
export async function geocodeAddress(
  address: string
): Promise<{ lat: number; lng: number } | null> {
  if (!address?.trim() || !PLACES_API_KEY) return null
  try {
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json')
    url.searchParams.set('address', address)
    // Bias toward US results so a bare "City, ST 00000" resolves sensibly.
    url.searchParams.set('region', 'us')
    url.searchParams.set('components', 'country:US')
    url.searchParams.set('key', PLACES_API_KEY)

    const res = await fetch(url.toString())
    const data = await res.json()

    if (data.status !== 'OK') {
      console.error('[geocode] Geocoding status:', data.status, data.error_message || '')
      return null
    }

    const loc = data.results?.[0]?.geometry?.location
    if (loc && typeof loc.lat === 'number' && typeof loc.lng === 'number') {
      return { lat: loc.lat, lng: loc.lng }
    }
    return null
  } catch (err: any) {
    console.error('[geocode] error:', err.message)
    return null
  }
}

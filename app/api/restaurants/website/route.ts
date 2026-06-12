import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY!

// Returns the restaurant's website (if Google has one) for a given place_id.
// Used to auto-run the menu importer right after a restaurant is added.
export async function GET(req: Request) {
  try {
    const placeId = new URL(req.url).searchParams.get('place_id')
    if (!placeId) return NextResponse.json({ website: null })

    const url = new URL('https://maps.googleapis.com/maps/api/place/details/json')
    url.searchParams.set('place_id', placeId)
    url.searchParams.set('fields', 'website')
    url.searchParams.set('key', PLACES_API_KEY)

    const r = await fetch(url.toString())
    const data = await r.json()
    const website: string | null = data?.result?.website || null
    return NextResponse.json({ website })
  } catch {
    return NextResponse.json({ website: null })
  }
}

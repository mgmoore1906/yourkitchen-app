import { NextResponse } from 'next/server'

const PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY!

export async function GET(
  request: Request,
  { params }: { params: Promise<{ place_id: string }> }
) {
  try {
    const { place_id } = await params

    const url = new URL('https://maps.googleapis.com/maps/api/place/details/json')
    url.searchParams.set('place_id', place_id)
    url.searchParams.set('fields',   'name,formatted_address,formatted_phone_number,opening_hours,website,price_level,geometry')
    url.searchParams.set('key',      PLACES_API_KEY)

    const res  = await fetch(url.toString())
    const data = await res.json()

    if (data.status !== 'OK') {
      return NextResponse.json({ error: data.error_message || data.status }, { status: 500 })
    }

    const r = data.result
    return NextResponse.json({
      place_id,
      name:     r.name,
      address:  r.formatted_address,
      phone:    r.formatted_phone_number || null,
      website:  r.website || null,
      lat:      r.geometry?.location?.lat || null,
      lng:      r.geometry?.location?.lng || null,
      hours:    r.opening_hours?.weekday_text || null,
      is_open:  r.opening_hours?.open_now ?? null,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

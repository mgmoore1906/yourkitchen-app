import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY!

// Fetch the FULL formatted address + phone for a place_id via Places Details.
// Nearby Search only returns a short `vicinity` (street + city, no state/ZIP),
// which geocodes incorrectly for cross-region delivery. Place Details returns
// the complete, geocodable address for the restaurant's actual location.
// Returns null fields on any failure so the caller can fall back to what it has.
async function fetchPlaceDetails(placeId: string): Promise<{ address: string | null; phone: string | null }> {
  if (!placeId || !PLACES_API_KEY) return { address: null, phone: null }
  try {
    const url = new URL('https://maps.googleapis.com/maps/api/place/details/json')
    url.searchParams.set('place_id', placeId)
    url.searchParams.set('fields', 'formatted_address,formatted_phone_number')
    url.searchParams.set('key', PLACES_API_KEY)
    const res = await fetch(url.toString())
    const data = await res.json()
    if (data.status !== 'OK') {
      console.error('[Places Details] status:', data.status, data.error_message)
      return { address: null, phone: null }
    }
    return {
      address: data.result?.formatted_address || null,
      phone:   data.result?.formatted_phone_number || null,
    }
  } catch (err: any) {
    console.error('[Places Details] error:', err.message)
    return { address: null, phone: null }
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const kitchenSlug = searchParams.get('slug')
  const kitchenId = searchParams.get('kitchen_id')
  if (!kitchenSlug && !kitchenId) return NextResponse.json({ error: 'slug or kitchen_id required' }, { status: 400 })

  let kId = kitchenId
  if (!kId && kitchenSlug) {
    const { data: kitchen } = await supabase.from('kitchens').select('id').eq('slug', kitchenSlug).single()
    kId = kitchen?.id
  }
  if (!kId) return NextResponse.json({ favorites: [] })

  const { data } = await supabase
    .from('kitchen_restaurants')
    .select('id, name, cuisine, place_id, address, phone, is_active, favorite_meals, favorite_meal_prices, favorite_meal_categories, lat, lng')
    .eq('kitchen_id', kId)
    .eq('is_active', true)
    .order('created_at', { ascending: true })

  return NextResponse.json({ favorites: data || [] })
}

export async function POST(request: Request) {
  try {
    const { kitchen_id, place_id, name, address, cuisine, lat, lng } = await request.json()
    if (!kitchen_id || !name) return NextResponse.json({ error: 'kitchen_id and name required' }, { status: 400 })

    // Upgrade the short vicinity address to the full formatted_address (with
    // state + ZIP) using Place Details — essential for correct cross-region
    // geocoding. Fall back to the passed-in short address if Details fails.
    let fullAddress = address || null
    let phone: string | null = null
    if (place_id) {
      const details = await fetchPlaceDetails(place_id)
      if (details.address) fullAddress = details.address
      phone = details.phone
    }

    const { data: existing } = await supabase
      .from('kitchen_restaurants').select('id, is_active')
      .eq('kitchen_id', kitchen_id).ilike('name', name).single()

    if (existing) {
      // Re-activating (or refreshing) an existing favorite — also patch the
      // address/phone so previously-saved short addresses get upgraded.
      await supabase.from('kitchen_restaurants')
        .update({
          is_active: true,
          place_id: place_id || null,
          lat: lat || null,
          lng: lng || null,
          address: fullAddress,
          ...(phone ? { phone } : {}),
        })
        .eq('id', existing.id)
      return NextResponse.json({ success: true, id: existing.id, existed: true })
    }

    const { data, error } = await supabase
      .from('kitchen_restaurants')
      .insert({
        kitchen_id,
        place_id: place_id || null,
        name,
        address: fullAddress,
        phone: phone,
        cuisine: cuisine || 'Restaurant',
        lat: lat || null,
        lng: lng || null,
        is_active: true,
        favorite_meals: [],
        favorite_meal_prices: [],
        favorite_meal_categories: [],
      })
      .select('id').single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true, id: data.id })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const { restaurant_id, favorite_meals, favorite_meal_prices, favorite_meal_categories, is_active } = await request.json()
    if (!restaurant_id) return NextResponse.json({ error: 'restaurant_id required' }, { status: 400 })
    const updates: any = {}
    if (favorite_meals !== undefined) updates.favorite_meals = favorite_meals
    if (favorite_meal_prices !== undefined) updates.favorite_meal_prices = favorite_meal_prices
    if (favorite_meal_categories !== undefined) updates.favorite_meal_categories = favorite_meal_categories
    if (is_active !== undefined) updates.is_active = is_active
    const { error } = await supabase.from('kitchen_restaurants').update(updates).eq('id', restaurant_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { restaurant_id, kitchen_id, delete_all } = await request.json()
    if (delete_all && kitchen_id) {
      const { error } = await supabase.from('kitchen_restaurants').delete().eq('kitchen_id', kitchen_id)
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ success: true, deleted: 'all' })
    }
    if (!restaurant_id) return NextResponse.json({ error: 'restaurant_id required' }, { status: 400 })
    const { error } = await supabase.from('kitchen_restaurants').delete().eq('id', restaurant_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

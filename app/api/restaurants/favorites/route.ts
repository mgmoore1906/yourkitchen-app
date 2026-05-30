import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const kitchenSlug = searchParams.get('slug')
  const kitchenId   = searchParams.get('kitchen_id')
  if (!kitchenSlug && !kitchenId) return NextResponse.json({ error: 'slug or kitchen_id required' }, { status: 400 })

  let kId = kitchenId
  if (!kId && kitchenSlug) {
    const { data: kitchen } = await supabase.from('kitchens').select('id').eq('slug', kitchenSlug).single()
    kId = kitchen?.id
  }
  if (!kId) return NextResponse.json({ favorites: [] })

  const { data } = await supabase
    .from('kitchen_restaurants')
    .select('id, name, cuisine, place_id, address, phone, is_active, favorite_meals, favorite_meal_prices, lat, lng')
    .eq('kitchen_id', kId)
    .eq('is_active', true)
    .order('created_at', { ascending: true })

  return NextResponse.json({ favorites: data || [] })
}

export async function POST(request: Request) {
  try {
    const { kitchen_id, place_id, name, address, cuisine, lat, lng } = await request.json()
    if (!kitchen_id || !name) return NextResponse.json({ error: 'kitchen_id and name required' }, { status: 400 })

    const { data: existing } = await supabase
      .from('kitchen_restaurants').select('id, is_active')
      .eq('kitchen_id', kitchen_id).ilike('name', name).single()

    if (existing) {
      if (!existing.is_active) {
        await supabase.from('kitchen_restaurants')
          .update({ is_active: true, place_id: place_id || null, lat: lat || null, lng: lng || null })
          .eq('id', existing.id)
      }
      return NextResponse.json({ success: true, id: existing.id, existed: true })
    }

    const { data, error } = await supabase
      .from('kitchen_restaurants')
      .insert({
        kitchen_id,
        place_id:             place_id || null,
        name,
        address:              address  || null,
        cuisine:              cuisine  || 'Restaurant',
        lat:                  lat      || null,
        lng:                  lng      || null,
        is_active:            true,
        favorite_meals:       [],
        favorite_meal_prices: [],
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
    const { restaurant_id, favorite_meals, favorite_meal_prices, is_active } = await request.json()
    if (!restaurant_id) return NextResponse.json({ error: 'restaurant_id required' }, { status: 400 })
    const updates: any = {}
    if (favorite_meals       !== undefined) updates.favorite_meals       = favorite_meals
    if (favorite_meal_prices !== undefined) updates.favorite_meal_prices = favorite_meal_prices
    if (is_active            !== undefined) updates.is_active             = is_active
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

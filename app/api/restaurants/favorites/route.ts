import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET — return kitchen's favorite restaurants with their saved meals
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const kitchenSlug = searchParams.get('slug')
  const kitchenId   = searchParams.get('kitchen_id')

  if (!kitchenSlug && !kitchenId) {
    return NextResponse.json({ error: 'slug or kitchen_id required' }, { status: 400 })
  }

  let kId = kitchenId
  if (!kId && kitchenSlug) {
    const { data: kitchen } = await supabase
      .from('kitchens').select('id').eq('slug', kitchenSlug).single()
    kId = kitchen?.id
  }

  if (!kId) return NextResponse.json({ favorites: [] })

  const { data } = await supabase
    .from('kitchen_restaurants')
    .select('id, name, cuisine, place_id, address, phone, is_active, favorite_meals')
    .eq('kitchen_id', kId)
    .eq('is_active', true)
    .order('created_at', { ascending: true })

  return NextResponse.json({ favorites: data || [] })
}

// POST — add a new favorite restaurant
export async function POST(request: Request) {
  try {
    const { kitchen_id, place_id, name, address, cuisine, phone } = await request.json()
    if (!kitchen_id || !name) {
      return NextResponse.json({ error: 'kitchen_id and name required' }, { status: 400 })
    }

    // Check if already exists
    const { data: existing } = await supabase
      .from('kitchen_restaurants')
      .select('id, is_active')
      .eq('kitchen_id', kitchen_id)
      .ilike('name', name)
      .single()

    if (existing) {
      if (!existing.is_active) {
        await supabase.from('kitchen_restaurants')
          .update({ is_active: true, place_id: place_id || null })
          .eq('id', existing.id)
      }
      return NextResponse.json({ success: true, id: existing.id, existed: true })
    }

    const { data, error } = await supabase
      .from('kitchen_restaurants')
      .insert({
        kitchen_id,
        place_id:       place_id  || null,
        name,
        address:        address   || null,
        phone:          phone     || null,
        cuisine:        cuisine   || 'Restaurant',
        is_active:      true,
        favorite_meals: [],
      })
      .select('id')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true, id: data.id })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// PATCH — update favorite meals for a restaurant
export async function PATCH(request: Request) {
  try {
    const { restaurant_id, favorite_meals } = await request.json()
    if (!restaurant_id) {
      return NextResponse.json({ error: 'restaurant_id required' }, { status: 400 })
    }
    await supabase.from('kitchen_restaurants')
      .update({ favorite_meals: favorite_meals || [] })
      .eq('id', restaurant_id)
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE — remove a favorite restaurant entirely
export async function DELETE(request: Request) {
  try {
    const { restaurant_id } = await request.json()
    await supabase.from('kitchen_restaurants')
      .delete()
      .eq('id', restaurant_id)
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

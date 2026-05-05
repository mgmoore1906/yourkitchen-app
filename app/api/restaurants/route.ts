import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// POST — add a new restaurant to the kitchen
export async function POST(request: Request) {
  try {
    const { kitchen_id, name, cuisine, doordash_store_id } = await request.json()

    if (!kitchen_id || !name) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('kitchen_restaurants')
      .insert({ kitchen_id, name, cuisine, doordash_store_id, is_active: true })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, restaurant: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// PATCH — toggle is_active on an existing restaurant
export async function PATCH(request: Request) {
  try {
    const { restaurant_id, is_active } = await request.json()

    if (!restaurant_id) {
      return NextResponse.json({ error: 'Missing restaurant_id' }, { status: 400 })
    }

    const { error } = await supabase
      .from('kitchen_restaurants')
      .update({ is_active })
      .eq('id', restaurant_id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

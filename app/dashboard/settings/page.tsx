import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    const { user_id } = await request.json()
    if (!user_id) return NextResponse.json({ error: 'Missing user_id' }, { status: 400 })

    // Get kitchen
    const { data: kitchen } = await supabase
      .from('kitchens')
      .select('id')
      .eq('organizer_id', user_id)
      .single()

    if (kitchen) {
      // Delete in order to respect foreign keys
      const { data: dates } = await supabase
        .from('calendar_dates')
        .select('id')
        .eq('kitchen_id', kitchen.id)

      if (dates?.length) {
        const dateIds = dates.map(d => d.id)

        // Delete claims and proposals linked to those dates
        const { data: claims } = await supabase
          .from('claims')
          .select('id')
          .in('calendar_date_id', dateIds)

        if (claims?.length) {
          const claimIds = claims.map(c => c.id)
          await supabase.from('meal_proposals').delete().in('claim_id', claimIds)
          await supabase.from('claims').delete().in('id', claimIds)
        }

        await supabase.from('calendar_dates').delete().eq('kitchen_id', kitchen.id)
      }

      // Delete menu items and restaurants
      const { data: restaurants } = await supabase
        .from('kitchen_restaurants')
        .select('id')
        .eq('kitchen_id', kitchen.id)

      if (restaurants?.length) {
        const restIds = restaurants.map(r => r.id)
        await supabase.from('menu_items').delete().in('kitchen_restaurant_id', restIds)
        await supabase.from('kitchen_restaurants').delete().eq('kitchen_id', kitchen.id)
      }

      // Delete kitchen
      await supabase.from('kitchens').delete().eq('id', kitchen.id)
    }

    // Delete profile
    await supabase.from('profiles').delete().eq('id', user_id)

    // Delete auth user
    const { error: authError } = await supabase.auth.admin.deleteUser(user_id)
    if (authError) {
      console.error('Auth delete error:', authError)
      return NextResponse.json({ error: authError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Delete account error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

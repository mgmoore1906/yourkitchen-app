import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// POST /api/delete-account  — body: { user_id }
//
// Permanently deletes a user's account and all of their Kitchen data.
//
// FIX (June 2026): the previous version silently failed ("Deleting…" then
// nothing). Two root causes, both addressed here:
//   1. It never deleted village_posts, which has a foreign key to kitchens.
//      That FK blocked the `kitchens` delete, which then cascaded into the
//      auth-user delete also failing — with no surfaced error.
//   2. Every intermediate delete was fire-and-forget (no error check), so any
//      failure was swallowed. Now every step is checked and, on failure,
//      returns a real message naming the step so problems are visible.
//
// Order matters: delete children before parents to respect foreign keys.
export async function POST(request: Request) {
  const supabase = getSupabase()
  try {
    const { user_id } = await request.json()
    if (!user_id) return NextResponse.json({ error: 'Missing user_id' }, { status: 400 })

    // Small helper: run a delete, throw with a labeled message if it errors.
    const step = async (label: string, p: PromiseLike<{ error: any }>) => {
      const { error } = await p
      if (error) throw new Error(`${label}: ${error.message}`)
    }

    // Find this user's kitchen.
    const { data: kitchen, error: kErr } = await supabase
      .from('kitchens')
      .select('id')
      .eq('organizer_id', user_id)
      .maybeSingle()
    if (kErr) throw new Error(`lookup kitchen: ${kErr.message}`)

    if (kitchen) {
      const kitchenId = kitchen.id

      // 1. Village posts (FK to kitchens — was the silent blocker).
      await step('village_posts', supabase.from('village_posts').delete().eq('kitchen_id', kitchenId))

      // 2. Calendar dates → claims → proposals.
      const { data: dates, error: dErr } = await supabase
        .from('calendar_dates')
        .select('id')
        .eq('kitchen_id', kitchenId)
      if (dErr) throw new Error(`lookup calendar_dates: ${dErr.message}`)

      if (dates?.length) {
        const dateIds = dates.map(d => d.id)
        const { data: claims, error: cErr } = await supabase
          .from('claims')
          .select('id')
          .in('calendar_date_id', dateIds)
        if (cErr) throw new Error(`lookup claims: ${cErr.message}`)

        if (claims?.length) {
          const claimIds = claims.map(c => c.id)
          await step('meal_proposals', supabase.from('meal_proposals').delete().in('claim_id', claimIds))
          await step('claims', supabase.from('claims').delete().in('id', claimIds))
        }
        await step('calendar_dates', supabase.from('calendar_dates').delete().eq('kitchen_id', kitchenId))
      }

      // 3. Restaurants → menu items.
      const { data: restaurants, error: rErr } = await supabase
        .from('kitchen_restaurants')
        .select('id')
        .eq('kitchen_id', kitchenId)
      if (rErr) throw new Error(`lookup kitchen_restaurants: ${rErr.message}`)

      if (restaurants?.length) {
        const restIds = restaurants.map(r => r.id)
        await step('menu_items', supabase.from('menu_items').delete().in('kitchen_restaurant_id', restIds))
        await step('kitchen_restaurants', supabase.from('kitchen_restaurants').delete().eq('kitchen_id', kitchenId))
      }

      // 4. Any proposals linked directly to the kitchen (defensive — some
      //    proposals reference kitchen_id directly rather than via a claim).
      await step('meal_proposals (by kitchen)', supabase.from('meal_proposals').delete().eq('kitchen_id', kitchenId))

      // 5. The kitchen itself.
      await step('kitchens', supabase.from('kitchens').delete().eq('id', kitchenId))
    }

    // 6. Profile.
    await step('profiles', supabase.from('profiles').delete().eq('id', user_id))

    // 7. Auth user (last — once all FK-linked rows are gone).
    const { error: authError } = await supabase.auth.admin.deleteUser(user_id)
    if (authError) throw new Error(`auth delete: ${authError.message}`)

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Delete account error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

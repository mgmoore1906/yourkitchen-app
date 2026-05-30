import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    const {
      user_id,
      full_name,
      phone,
      address,
      household_adults,
      household_children,
      dietary_restrictions,
      breakfast_windows,
      lunch_windows,
      dinner_windows,
    } = await request.json()

    if (!user_id)        return NextResponse.json({ error: 'Missing user_id' }, { status: 400 })
    if (!full_name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ full_name: full_name.trim(), phone: phone || null })
      .eq('id', user_id)

    if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })

    const { data: kitchen } = await supabase
      .from('kitchens')
      .select('name')
      .eq('organizer_id', user_id)
      .single()

    const shouldUpdateName = !kitchen?.name
      || kitchen.name === "'s Kitchen"
      || kitchen.name.startsWith("'s ")

    const { error: kitchenError } = await supabase
      .from('kitchens')
      .update({
        ...(shouldUpdateName ? { name: `${full_name.trim()}'s Kitchen` } : {}),
        address:             address || null,
        household_adults:    household_adults ?? 2,
        household_children:  household_children ?? 2,
        dietary_restrictions: dietary_restrictions || [],
        breakfast_windows:   breakfast_windows || ['07:00-09:00'],
        lunch_windows:       lunch_windows     || ['11:00-12:30'],
        dinner_windows:      dinner_windows    || ['17:30-19:00'],
      })
      .eq('organizer_id', user_id)

    if (kitchenError) return NextResponse.json({ error: kitchenError.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

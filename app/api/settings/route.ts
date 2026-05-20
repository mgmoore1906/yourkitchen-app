import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    const { user_id, full_name, phone, address, household_size, dietary_restrictions } = await request.json()

    if (!user_id) return NextResponse.json({ error: 'Missing user_id' }, { status: 400 })

    // Update profile
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ full_name, phone })
      .eq('id', user_id)

    if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })

    // Update kitchen
    const { error: kitchenError } = await supabase
      .from('kitchens')
      .update({
        address,
        household_size,
        dietary_restrictions: dietary_restrictions || [],
        name: `${full_name}'s Kitchen`,
      })
      .eq('organizer_id', user_id)

    if (kitchenError) return NextResponse.json({ error: kitchenError.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

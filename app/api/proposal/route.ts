import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    const { name, email, calendar_date_id, restaurant_id, menu_item_id, note } = await request.json()

    const { data: guest, error: guestError } = await supabase
      .from('guest_coordinators')
      .insert({ full_name: name, email })
      .select('id')
      .single()

    if (guestError) return NextResponse.json({ error: guestError.message }, { status: 400 })

    const { data: claim, error: claimError } = await supabase
      .from('claims')
      .insert({
        calendar_date_id,
        guest_coordinator_id: guest.id,
        claim_type: 'one_time',
        status: 'active',
        expires_at: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
      })
      .select('id')
      .single()

    if (claimError) return NextResponse.json({ error: claimError.message }, { status: 400 })

    const { error: proposalError } = await supabase
      .from('meal_proposals')
      .insert({
        claim_id: claim.id,
        kitchen_restaurant_id: restaurant_id,
        menu_item_id,
        coordinator_note: note,
        status: 'pending',
      })

    if (proposalError) return NextResponse.json({ error: proposalError.message }, { status: 400 })

    await supabase
      .from('calendar_dates')
      .update({ status: 'claimed' })
      .eq('id', calendar_date_id)

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
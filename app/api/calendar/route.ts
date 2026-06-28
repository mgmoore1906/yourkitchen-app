import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getSessionUserId } from '@/lib/requireUser'
export const dynamic = 'force-dynamic'
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// A calendar write is only allowed by the kitchen's organizer or recipient.
async function userOwnsKitchen(supabase: any, userId: string, kitchenId: string | null): Promise<boolean> {
  if (!kitchenId) return false
  const { data: k } = await supabase
    .from('kitchens').select('organizer_id, recipient_id').eq('id', kitchenId).single()
  return !!k && (k.organizer_id === userId || k.recipient_id === userId)
}

// POST — add a date to the calendar
export async function POST(request: Request) {
  const supabase = getSupabase()
  try {
    const userId = await getSessionUserId()
    if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

    const { kitchen_id, date, delivery_window_start, delivery_window_end, meal_type, slots } = await request.json()

    if (!kitchen_id) {
      return NextResponse.json({ error: 'Missing kitchen_id' }, { status: 400 })
    }
    if (!(await userOwnsKitchen(supabase, userId, kitchen_id))) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
    }

    // ── Batch mode: open many (date × meal_type) slots at once ──
    // slots = [{ date, meal_type }]. Skips any combo that already exists.
    if (Array.isArray(slots)) {
      if (slots.length === 0) return NextResponse.json({ error: 'No slots provided' }, { status: 400 })
      const dates = [...new Set(slots.map((s: any) => s.date).filter(Boolean))]
      const { data: existing } = await supabase
        .from('calendar_dates')
        .select('date, meal_type')
        .eq('kitchen_id', kitchen_id)
        .in('date', dates)
      const have = new Set((existing || []).map((e: any) => `${e.date}|${e.meal_type}`))
      const toInsert = slots
        .filter((s: any) => s.date && s.meal_type && !have.has(`${s.date}|${s.meal_type}`))
        .map((s: any) => ({
          kitchen_id,
          date: s.date,
          status: 'available',
          meal_type: s.meal_type,
          delivery_window_start: delivery_window_start || '17:30',
          delivery_window_end: delivery_window_end || '19:00',
        }))
      if (toInsert.length === 0) {
        return NextResponse.json({ success: true, added: 0, skipped: slots.length })
      }
      const { error } = await supabase.from('calendar_dates').insert(toInsert)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true, added: toInsert.length, skipped: slots.length - toInsert.length })
    }

    if (!date) {
      return NextResponse.json({ error: 'Missing date' }, { status: 400 })
    }

    // Check if this exact meal_type already exists for this date
    const { data: existing } = await supabase
      .from('calendar_dates')
      .select('id')
      .eq('kitchen_id', kitchen_id)
      .eq('date', date)
      .eq('meal_type', meal_type || 'dinner')
      .single()

    if (existing) {
      return NextResponse.json({ error: 'This meal type is already added for this date' }, { status: 409 })
    }

    const { data, error } = await supabase
      .from('calendar_dates')
      .insert({
        kitchen_id,
        date,
        status: 'available',
        meal_type: meal_type || 'dinner',
        delivery_window_start: delivery_window_start || '17:30',
        delivery_window_end: delivery_window_end || '19:00',
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, date: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE — remove an available date from the calendar
export async function DELETE(request: Request) {
  const supabase = getSupabase()
  try {
    const userId = await getSessionUserId()
    if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

    const { date_id } = await request.json()

    if (!date_id) {
      return NextResponse.json({ error: 'Missing date_id' }, { status: 400 })
    }

    // Only allow deletion if status is 'available' — never remove claimed or confirmed dates
    const { data: existing } = await supabase
      .from('calendar_dates')
      .select('id, status, kitchen_id')
      .eq('id', date_id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Date not found' }, { status: 404 })
    }
    if (!(await userOwnsKitchen(supabase, userId, existing.kitchen_id))) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
    }

    if (existing.status !== 'available') {
      return NextResponse.json({ error: 'Cannot remove a claimed or confirmed date' }, { status: 403 })
    }

    const { error } = await supabase
      .from('calendar_dates')
      .delete()
      .eq('id', date_id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

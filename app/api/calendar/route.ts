import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// POST — add a date to the calendar
export async function POST(request: Request) {
  try {
    const { kitchen_id, date, delivery_window_start, delivery_window_end } = await request.json()

    if (!kitchen_id || !date) {
      return NextResponse.json({ error: 'Missing kitchen_id or date' }, { status: 400 })
    }

    // Check if date already exists for this kitchen
    const { data: existing } = await supabase
      .from('calendar_dates')
      .select('id')
      .eq('kitchen_id', kitchen_id)
      .eq('date', date)
      .single()

    if (existing) {
      return NextResponse.json({ error: 'Date already exists' }, { status: 409 })
    }

    const { data, error } = await supabase
      .from('calendar_dates')
      .insert({
        kitchen_id,
        date,
        status: 'available',
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
  try {
    const { date_id } = await request.json()

    if (!date_id) {
      return NextResponse.json({ error: 'Missing date_id' }, { status: 400 })
    }

    // Only allow deletion if status is 'available' — never remove claimed or confirmed dates
    const { data: existing } = await supabase
      .from('calendar_dates')
      .select('id, status')
      .eq('id', date_id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Date not found' }, { status: 404 })
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

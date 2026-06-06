import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/delivery?user_id=...  → the kitchen's saved delivery time preferences
//
// Dedicated, narrow endpoint for the standalone Delivery Preferences page.
// Unlike /api/settings (which saves the whole profile and FORCES window
// defaults), this touches only the three window columns and never injects a
// default — an empty preference stays empty. Times are stored in the existing
// *_windows text[] columns as a single "HH:MM" target time per meal (e.g.
// dinner_windows: ['19:00']), which the proposal/SMS code already reads.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('user_id')
  if (!userId) return NextResponse.json({ error: 'Missing user_id' }, { status: 400 })

  const { data: kitchen, error } = await supabase
    .from('kitchens')
    .select('breakfast_windows, lunch_windows, dinner_windows')
    .eq('organizer_id', userId)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    breakfast: kitchen?.breakfast_windows?.[0] || '',
    lunch:     kitchen?.lunch_windows?.[0] || '',
    dinner:    kitchen?.dinner_windows?.[0] || '',
  })
}

// POST /api/delivery  — body: { user_id, breakfast, lunch, dinner }
// Each meal value is an "HH:MM" target time, or '' / null to clear it.
export async function POST(request: Request) {
  try {
    const { user_id, breakfast, lunch, dinner } = await request.json()
    if (!user_id) return NextResponse.json({ error: 'Missing user_id' }, { status: 400 })

    // Store each as a single-element array (or empty array when cleared) so the
    // existing array-shaped columns stay valid. No forced defaults.
    const toArr = (v: any) => (v && String(v).trim() ? [String(v).trim()] : [])

    const { error } = await supabase
      .from('kitchens')
      .update({
        breakfast_windows: toArr(breakfast),
        lunch_windows:     toArr(lunch),
        dinner_windows:    toArr(dinner),
      })
      .eq('organizer_id', user_id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

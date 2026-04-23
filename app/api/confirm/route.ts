import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    const { proposal_id, action } = await request.json()

    const { data: proposal } = await supabase
      .from('meal_proposals')
      .select('*, claims(calendar_date_id)')
      .eq('id', proposal_id)
      .single()

    if (!proposal) return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })

    if (action === 'confirm') {
      await supabase.from('meal_proposals').update({
        status: 'confirmed',
        responded_at: new Date().toISOString()
      }).eq('id', proposal_id)

      await supabase.from('calendar_dates').update({
        status: 'confirmed'
      }).eq('id', proposal.claims?.calendar_date_id)

    } else if (action === 'decline') {
      await supabase.from('meal_proposals').update({
        status: 'declined',
        responded_at: new Date().toISOString()
      }).eq('id', proposal_id)

      await supabase.from('calendar_dates').update({
        status: 'available'
      }).eq('id', proposal.claims?.calendar_date_id)
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
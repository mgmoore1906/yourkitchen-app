// app/api/profile/create/route.ts
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

export async function POST(request: Request) {
  const supabase = getSupabase()
  try {
    const body = await request.json()

    const sessionUserId = await getSessionUserId()
    if (!sessionUserId || body?.id !== sessionUserId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 401 })
    }

    const { error } = await supabase
      .from('profiles')
      .upsert(body, { onConflict: 'id' })

    if (error) {
      console.error('Profile upsert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('API error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

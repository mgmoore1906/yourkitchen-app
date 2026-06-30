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

    // Claim any plan paid for before this account existed (matched by the email
    // on the auth user). A claim failure must never block account creation.
    try {
      const { data: authUser } = await supabase.auth.admin.getUserById(sessionUserId)
      const email = (authUser?.user?.email || '').trim().toLowerCase()
      if (email) {
        const { data: pend } = await supabase
          .from('pending_entitlements').select('*').eq('email', email).maybeSingle()
        if (pend?.tier) {
          const patch: Record<string, any> = { tier: pend.tier }
          if (pend.stripe_customer_id) patch.stripe_customer_id = pend.stripe_customer_id
          if (pend.tier === 'founding') {
            patch.founding_circle = pend.founding_circle
            patch.founding_expires_at = pend.founding_expires_at
          }
          await supabase.from('profiles').update(patch).eq('id', sessionUserId)
          await supabase.from('pending_entitlements').delete().eq('email', email)
          console.log(`Claimed pending entitlement for ${email} -> ${pend.tier}`)
        }
      }
    } catch (e) {
      console.error('Entitlement claim skipped:', e)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('API error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

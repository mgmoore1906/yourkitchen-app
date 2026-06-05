import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { type EmailOtpType } from '@supabase/supabase-js'

// GET /auth/callback
//
// Handles BOTH email-confirmation styles so a verification link works no matter
// where it's opened:
//   1. PKCE code flow:   ?code=...                    (same-browser signups)
//   2. Token/OTP verify: ?token_hash=...&type=signup  (any browser/device)
//      Supabase's email link hits /auth/v1/verify, which redirects here with
//      either a `code` or a `token_hash`+`type`. PKCE-only handling left users
//      stranded when they opened the email on a different device, because the
//      code verifier lived only in the original browser.
//
// After a successful verification we send the user straight into setup:
//   - no kitchen yet  -> /onboarding
//   - has a kitchen   -> /dashboard
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null

  const supabase = await createClient()
  let verified = false

  // Path 1 — PKCE code exchange (same-browser case)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) verified = true
  }

  // Path 2 — token-hash OTP verification (works across devices/browsers)
  if (!verified && token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash })
    if (!error) verified = true
  }

  if (verified) {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      // "Onboarding complete" === the user has a kitchen. Must match the check
      // used in /onboarding (mount guard) and /dashboard.
      const { data: kitchen } = await supabase
        .from('kitchens')
        .select('id')
        .eq('organizer_id', user.id)
        .limit(1)
        .maybeSingle()

      if (!kitchen) {
        return NextResponse.redirect(`${origin}/onboarding`)
      }
      return NextResponse.redirect(`${origin}/dashboard`)
    }
  }

  // Verification failed or no recognizable params → back to login with a hint
  return NextResponse.redirect(`${origin}/login?error=auth`)
}

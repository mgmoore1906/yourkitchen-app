import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Get the user who just signed in
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        // Check if they've completed onboarding (profile row exists)
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', user.id)
          .single()

        if (!profile) {
          // Brand new user — no profile yet → onboarding
          return NextResponse.redirect(`${origin}/onboarding`)
        }

        // Returning user — profile exists → dashboard
        return NextResponse.redirect(`${origin}/dashboard`)
      }
    }
  }

  // If something went wrong, send back to login
  return NextResponse.redirect(`${origin}/login?error=auth`)
}

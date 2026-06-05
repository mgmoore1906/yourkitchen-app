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
        // "Onboarding complete" === the user has a kitchen.
        // This MUST match the check used in /onboarding (mount guard) and
        // /dashboard. Using the profiles row instead caused half-onboarded
        // users to be bounced to /dashboard on forward navigation, because a
        // profile can exist before onboarding actually finishes.
        const { data: kitchen } = await supabase
          .from('kitchens')
          .select('id')
          .eq('organizer_id', user.id)
          .limit(1)
          .maybeSingle()

        if (!kitchen) {
          // No kitchen yet → onboarding isn't finished → send them (back) into it
          return NextResponse.redirect(`${origin}/onboarding`)
        }

        // Has a kitchen → returning user → dashboard
        return NextResponse.redirect(`${origin}/dashboard`)
      }
    }
  }

  // If something went wrong, send back to login
  return NextResponse.redirect(`${origin}/login?error=auth`)
}

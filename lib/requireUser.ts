import { createClient } from '@/lib/supabase/server'

// Resolve the signed-in user's id from the session cookie, or null if not
// authenticated. Use in API routes so a caller can only ever act on THEIR OWN
// account — never trust a user_id from the request body for sensitive or
// destructive actions (delete, profile edits, billing).
export async function getSessionUserId(): Promise<string | null> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    return user?.id ?? null
  } catch {
    return null
  }
}

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// POST /api/help — capture a help request from the in-app help page.
//
// Writes every submission to the `help_requests` table so issues are tracked
// and reviewable (not lost in an inbox), and sends Marques a heads-up email via
// Resend. Uses the service-role key because the person submitting may not be
// logged in (a coordinator or recipient could hit help from any state).
//
// Table (run once in Supabase):
//   create table help_requests (
//     id uuid primary key default gen_random_uuid(),
//     name text,
//     email text,
//     topic text,
//     message text not null,
//     user_id uuid,
//     page text,
//     status text default 'new',
//     created_at timestamptz default now()
//   );
export async function POST(request: Request) {
  try {
    const { name, email, topic, message, user_id, page } = await request.json()

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Please include a message.' }, { status: 400 })
    }

    const { error } = await supabase.from('help_requests').insert({
      name:    name?.trim() || null,
      email:   email?.trim() || null,
      topic:   topic || 'general',
      message: message.trim(),
      user_id: user_id || null,
      page:    page || null,
      status:  'new',
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Best-effort email notification. Never fail the request if email is down —
    // the submission is already safely captured in the table.
    if (process.env.RESEND_API_KEY) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'YourKitchen Help <help@yourkitchen.app>',
            to: ['marques@yourkitchen.app'],
            reply_to: email?.trim() || undefined,
            subject: `Help request: ${topic || 'general'}`,
            text:
              `New help request from the app.\n\n` +
              `Name: ${name?.trim() || '—'}\n` +
              `Email: ${email?.trim() || '—'}\n` +
              `Topic: ${topic || 'general'}\n` +
              `Page: ${page || '—'}\n\n` +
              `Message:\n${message.trim()}\n`,
          }),
        })
      } catch (e) {
        console.error('[help] email notify failed (submission still saved):', e)
      }
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

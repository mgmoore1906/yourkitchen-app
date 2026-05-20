import { NextResponse } from 'next/server'
import { getEmailTemplate, EmailType } from '@/lib/email-templates'

export async function POST(request: Request) {
  try {
    const { to, type, name, slug, kitchen_name, trial_days_left } = await request.json()

    if (!to || !type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const template = getEmailTemplate(type as EmailType, {
      name, slug, kitchen_name, trial_days_left
    })

    if (!template) {
      return NextResponse.json({ error: 'Unknown email type' }, { status: 400 })
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Marques at YourKitchen <marques@yourkitchen.app>',
        to: [to],
        subject: template.subject,
        html: template.html,
      }),
    })

    if (!res.ok) {
      const err = await res.json()
      console.error('Resend error:', err)
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Send email error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

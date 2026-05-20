import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { user_name, kitchen_slug, restaurant_name, city, notes } = await request.json()

    if (!restaurant_name || !city) {
      return NextResponse.json({ error: 'Missing restaurant name or city' }, { status: 400 })
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'YourKitchen <onboarding@resend.dev>',
        to: ['marques@yourkitchen.app'],
        subject: `🍽 Restaurant Request: ${restaurant_name} — ${city}`,
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
            <h2 style="color: #1E2620; margin: 0 0 8px;">New Restaurant Request</h2>
            <p style="color: #6B7066; margin: 0 0 24px; font-size: 14px;">A user has requested a new restaurant be added to their Kitchen.</p>

            <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
              <tr><td style="padding: 10px 0; border-bottom: 1px solid #DDE8E0; color: #6B7066; font-size: 13px; width: 140px;">Restaurant</td><td style="padding: 10px 0; border-bottom: 1px solid #DDE8E0; color: #1E2620; font-size: 13px; font-weight: 600;">${restaurant_name}</td></tr>
              <tr><td style="padding: 10px 0; border-bottom: 1px solid #DDE8E0; color: #6B7066; font-size: 13px;">City</td><td style="padding: 10px 0; border-bottom: 1px solid #DDE8E0; color: #1E2620; font-size: 13px; font-weight: 600;">${city}</td></tr>
              <tr><td style="padding: 10px 0; border-bottom: 1px solid #DDE8E0; color: #6B7066; font-size: 13px;">User</td><td style="padding: 10px 0; border-bottom: 1px solid #DDE8E0; color: #1E2620; font-size: 13px; font-weight: 600;">${user_name || 'Unknown'}</td></tr>
              <tr><td style="padding: 10px 0; border-bottom: 1px solid #DDE8E0; color: #6B7066; font-size: 13px;">Kitchen slug</td><td style="padding: 10px 0; border-bottom: 1px solid #DDE8E0; color: #1E2620; font-size: 13px; font-weight: 600;">${kitchen_slug || '—'}</td></tr>
              ${notes ? `<tr><td style="padding: 10px 0; color: #6B7066; font-size: 13px;">Notes</td><td style="padding: 10px 0; color: #1E2620; font-size: 13px;">${notes}</td></tr>` : ''}
            </table>

            <div style="background: #EAF2ED; border-radius: 10px; padding: 16px; margin-bottom: 24px;">
              <p style="color: #3D6B4F; font-size: 13px; margin: 0; line-height: 1.6;">
                <strong>Next steps:</strong><br>
                1. Find the restaurant on doordash.com<br>
                2. Copy the store ID from the URL<br>
                3. Run SQL insert in Supabase<br>
                4. Target: within 24 hours
              </p>
            </div>

            <p style="color: #6B7066; font-size: 12px; margin: 0;">YourKitchen · marques@yourkitchen.app</p>
          </div>
        `,
      }),
    })

    if (!res.ok) {
      const err = await res.json()
      console.error('Resend error:', err)
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Request restaurant error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

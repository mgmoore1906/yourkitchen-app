// lib/meal-confirmed-notify.ts
// Emails the recipient a "meal confirmed" note with a calendar (.ics) attachment
// so they can add the delivery to Google / Apple / Outlook in one tap, straight
// from their inbox. Best-effort: never throws — a confirm always succeeds even
// if the email fails.

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}
function icsEscape(s: string): string {
  return (s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}
const MEAL_TIME: Record<string, [number, number]> = { breakfast: [8, 0], lunch: [12, 0], dinner: [18, 0] }

export type ConfirmedNotice = {
  recipientEmail?: string | null
  recipientName?: string | null
  coordinatorName?: string | null
  mealName?: string | null
  restName?: string | null
  dateLabel?: string | null        // "Monday, June 29"
  deliveryDate?: string | null     // "2026-06-29"
  mealType?: string | null
  deliveryTime?: string | null     // "HH:MM"
  proposalId?: string | null
}

function buildICS(n: ConfirmedNotice): string {
  const pad = (x: number) => String(x).padStart(2, '0')
  let h = 18, m = 0
  if (n.deliveryTime && /^\d{1,2}:\d{2}/.test(n.deliveryTime)) {
    const [hh, mm] = n.deliveryTime.split(':')
    h = parseInt(hh, 10); m = parseInt(mm, 10)
    if (isNaN(h)) h = 18
    if (isNaN(m)) m = 0
  } else {
    const t = MEAL_TIME[n.mealType || 'dinner'] || [18, 0]; h = t[0]; m = t[1]
  }
  const d = (n.deliveryDate || '').split('-')
  const at = (hh: number) => `${d[0]}${d[1]}${d[2]}T${pad(hh)}${pad(m)}00`
  const start = at(h), end = at(h + 1 > 23 ? 23 : h + 1)
  const now = new Date()
  const stamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`
  const title = `${n.mealName || 'Meal'}${n.restName ? ` — ${n.restName}` : ''}`
  const desc = `${n.coordinatorName ? `From ${n.coordinatorName}. ` : ''}${n.restName ? `${n.restName}. ` : ''}Sent with love through YourKitchen.`
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//YourKitchen//Meal Calendar//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT', `UID:${n.proposalId || Date.now()}@yourkitchen.app`, `DTSTAMP:${stamp}`,
    `DTSTART:${start}`, `DTEND:${end}`, `SUMMARY:${icsEscape(title)}`, `DESCRIPTION:${icsEscape(desc)}`,
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n')
}

export async function notifyMealConfirmed(n: ConfirmedNotice): Promise<void> {
  try {
    const to = (n.recipientEmail || '').trim()
    const key = process.env.RESEND_API_KEY
    if (!to || !key || !n.deliveryDate) return

    const recip = (n.recipientName || '').split(' ')[0] || 'there'
    const coord = n.coordinatorName || 'Someone'
    const meal  = n.mealName || 'a meal'
    const rest  = n.restName ? ` from ${escapeHtml(n.restName)}` : ''
    const when  = n.dateLabel ? escapeHtml(n.dateLabel) : 'soon'

    const ics = buildICS(n)
    const icsB64 = Buffer.from(ics, 'utf-8').toString('base64')

    const S = { sage: '#3D6B4F', forest: '#1E2620', stone: '#6B7066', cream: '#FAFAF5', sageLight: '#EAF2ED', border: '#DDE8E0', white: '#FFFFFF' }
    const subject = `Meal confirmed — ${meal} on ${when}`

    const html = `
<div style="background:${S.cream};padding:32px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;background:${S.white};border:1px solid ${S.border};border-radius:16px;padding:28px 28px 24px">
        <tr><td style="padding:0 0 6px">
          <div style="font-size:10px;font-weight:600;letter-spacing:4px;text-transform:uppercase;color:#6B9E7E">Your</div>
          <div style="font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:500;color:${S.forest};line-height:1">Kitchen</div>
        </td></tr>
        <tr><td style="padding:18px 0 10px">
          <div style="font-family:Georgia,'Times New Roman',serif;font-size:21px;font-weight:500;color:${S.forest};line-height:1.3">Hi ${escapeHtml(recip)},</div>
        </td></tr>
        <tr><td style="padding:0 0 16px;font-size:15px;line-height:1.7;color:${S.forest}">
          Good news &mdash; <strong>${escapeHtml(coord)}</strong> is sending <strong>${escapeHtml(meal)}</strong>${rest} on <strong>${when}</strong>. It&rsquo;s all set.
        </td></tr>
        <tr><td style="padding:0 0 18px">
          <div style="background:${S.sageLight};border-radius:12px;padding:14px 16px;font-size:14px;line-height:1.6;color:${S.forest}">
            📅 We&rsquo;ve attached this meal as a calendar file. Open it on your phone to add it to your calendar &mdash; so you can plan the day around one less thing to cook.
          </div>
        </td></tr>
        <tr><td style="padding:0 0 8px">
          <a href="https://app.yourkitchen.app/dashboard" style="display:inline-block;background:${S.sage};color:${S.cream};text-decoration:none;border-radius:999px;padding:13px 28px;font-size:15px;font-weight:600">View my meals &rarr;</a>
        </td></tr>
        <tr><td style="padding:18px 0 0;font-size:13px;line-height:1.6;color:${S.stone}">
          With love, 🧡<br>&mdash; YourKitchen
        </td></tr>
      </table>
    </td></tr>
  </table>
</div>`.trim()

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Marques at YourKitchen <marques@yourkitchen.app>',
        to: [to],
        subject,
        html,
        attachments: [{ filename: 'meal.ics', content: icsB64, content_type: 'text/calendar' }],
      }),
    })
  } catch (err: any) {
    console.error('[meal-confirmed-notify] email failed (continuing):', err?.message)
  }
}

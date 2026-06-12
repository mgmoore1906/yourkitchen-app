// lib/coordinator-notify.ts
// Notifies the coordinator (the person who offered a meal) when the recipient
// declines. The /proposals/[id] decline screen promises "X has been notified" —
// this is what actually delivers on that promise. EMAIL is the reliable channel
// (it works even while outbound SMS is carrier-filtered via Twilio 30007).
// Best-effort: never throws, so a decline always succeeds even if email fails.

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

export type DeclineNotice = {
  coordinatorEmail?: string | null
  coordinatorName?: string | null
  recipientName?: string | null   // first name, e.g. "Danielle"
  mealName?: string | null
  restName?: string | null
  dateLabel?: string | null       // human date, e.g. "Thursday, June 12"
  reason?: string | null          // the recipient's decline note, if any
  slug?: string | null            // kitchen slug, for the "pick another day" link
}

export async function notifyCoordinatorDeclined(n: DeclineNotice): Promise<void> {
  try {
    const to = (n.coordinatorEmail || '').trim()
    const key = process.env.RESEND_API_KEY
    if (!to || !key) return

    const coord = (n.coordinatorName || '').split(' ')[0] || 'there'
    const recip = n.recipientName || 'the family'
    const meal  = n.mealName || 'the meal'
    const rest  = n.restName ? ` from ${escapeHtml(n.restName)}` : ''
    const when  = n.dateLabel ? ` for ${escapeHtml(n.dateLabel)}` : ''
    const link  = n.slug ? `https://app.yourkitchen.app/k/${n.slug}` : 'https://app.yourkitchen.app'

    const S = { sage:'#3D6B4F', forest:'#1E2620', stone:'#6B7066', cream:'#FAFAF5', sageLight:'#EAF2ED', border:'#DDE8E0', white:'#FFFFFF' }

    const reasonBlock = (n.reason || '').trim()
      ? `<tr><td style="padding:0 0 18px">
           <div style="background:${S.sageLight};border-radius:12px;padding:14px 16px;font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:15px;line-height:1.7;color:${S.forest}">
             &ldquo;${escapeHtml((n.reason || '').trim())}&rdquo;
           </div>
         </td></tr>`
      : ''

    const subject = `A note about the meal you offered ${recip}`

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
          <div style="font-family:Georgia,'Times New Roman',serif;font-size:21px;font-weight:500;color:${S.forest};line-height:1.3">Hi ${escapeHtml(coord)},</div>
        </td></tr>
        <tr><td style="padding:0 0 16px;font-size:15px;line-height:1.7;color:${S.forest}">
          ${escapeHtml(recip)} won&rsquo;t be able to take <strong>${escapeHtml(meal)}</strong>${rest}${when}, so <strong>you haven&rsquo;t been charged</strong> &mdash; your card hold was released.
        </td></tr>
        ${reasonBlock}
        <tr><td style="padding:0 0 22px;font-size:15px;line-height:1.7;color:${S.stone}">
          If you&rsquo;d still like to send something, you can pick another open day on their Kitchen.
        </td></tr>
        <tr><td style="padding:0 0 8px">
          <a href="${link}" style="display:inline-block;background:${S.sage};color:${S.cream};text-decoration:none;border-radius:999px;padding:13px 28px;font-size:15px;font-weight:600">Pick another day &rarr;</a>
        </td></tr>
        <tr><td style="padding:18px 0 0;font-size:13px;line-height:1.6;color:${S.stone}">
          Thank you for showing up. 🧡<br>&mdash; YourKitchen
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
      }),
    })
  } catch (err: any) {
    console.error('[coordinator-notify] decline email failed (continuing):', err?.message)
  }
}

import { NextResponse } from 'next/server'
import twilio from 'twilio'

export const runtime = 'nodejs'

function e164(raw: string): string | null {
  const d = (raw || '').replace(/\D/g, '')
  if (d.length === 10) return '+1' + d
  if (d.length === 11 && d.startsWith('1')) return '+' + d
  return null
}

// Sends a one-time SMS code via Twilio Verify (Twilio manages the code, expiry,
// and rate limiting — no codes stored on our side).
export async function POST(request: Request) {
  try {
    const { phone } = await request.json()
    const to = e164(phone || '')
    if (!to) return NextResponse.json({ ok: false, error: 'invalid_phone' }, { status: 400 })
    const sid = process.env.TWILIO_VERIFY_SERVICE_SID
    if (!sid) return NextResponse.json({ ok: false, error: 'not_configured' }, { status: 500 })
    const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!)
    await client.verify.v2.services(sid).verifications.create({ to, channel: 'sms' })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    // Surface the real Twilio error (code + message) so failures are diagnosable.
    return NextResponse.json({ ok: false, error: e?.message || 'request_failed', code: e?.code ?? null, twStatus: e?.status ?? null })
  }
}

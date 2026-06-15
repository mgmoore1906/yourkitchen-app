import { NextResponse } from 'next/server'
import twilio from 'twilio'

export const runtime = 'nodejs'

function e164(raw: string): string | null {
  const d = (raw || '').replace(/\D/g, '')
  if (d.length === 10) return '+1' + d
  if (d.length === 11 && d.startsWith('1')) return '+' + d
  return null
}

// Verifies the SMS code via Twilio Verify. Returns { ok: true } only when approved.
export async function POST(request: Request) {
  try {
    const { phone, code } = await request.json()
    const to = e164(phone || '')
    if (!to || !code) return NextResponse.json({ ok: false, error: 'missing' }, { status: 400 })
    const sid = process.env.TWILIO_VERIFY_SERVICE_SID
    if (!sid) return NextResponse.json({ ok: false, error: 'not_configured' }, { status: 500 })
    const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!)
    const check = await client.verify.v2.services(sid).verificationChecks.create({ to, code: String(code) })
    return NextResponse.json({ ok: check.status === 'approved' })
  } catch (e: any) {
    // Surface the real Twilio error (code + message) so failures are diagnosable.
    return NextResponse.json({ ok: false, error: e?.message || 'request_failed', code: e?.code ?? null, twStatus: e?.status ?? null })
  }
}

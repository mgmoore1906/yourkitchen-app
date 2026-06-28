'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const EyeIcon = () => (
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
<circle cx="12" cy="12" r="3" />
</svg>
)
const EyeOffIcon = () => (
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
<path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
<path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
<line x1="1" y1="1" x2="23" y2="23" />
</svg>
)

export default function ResetPasswordPage() {
  const supabase = createClient()
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  // Prefill the email from the link if it carried one. There is NO token in the
  // URL — the recovery code lives only in the email body, which link scanners
  // (Safe Links, prefetch, in-app browsers) cannot consume. The user types it.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const e = params.get('email')
    if (e) setEmail(e)
    // The code may ride in the link too, purely to pre-fill the field. It is NOT
    // verified on load — only when the user submits — so a prefetch that loads
    // this URL fills a text box and nothing more; the code stays unconsumed.
    const c = params.get('code')
    if (c) setCode(c.replace(/[^0-9]/g, '').slice(0, 6))
  }, [])

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    setError('')
    const cleanCode = code.replace(/\s/g, '')
    if (!email.trim()) { setError('Enter the email address for your account'); return }
    if (cleanCode.length < 6) { setError('Enter the 6-digit code from your email'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (password !== confirm) { setError('Passwords do not match'); return }

    setLoading(true)
    // Step 1: verify the code -> establishes a recovery session. No verifier and
    // no link needed, so this works in any mail client, browser, or device.
    const { error: vErr } = await supabase.auth.verifyOtp({ email: email.trim(), token: cleanCode, type: 'recovery' })
    if (vErr) {
      setError('That code is invalid or has expired. Request a fresh one from the sign-in screen.')
      setLoading(false); return
    }
    // Step 2: set the new password on the now-authenticated session.
    const { error: uErr } = await supabase.auth.updateUser({ password })
    if (uErr) { setError(uErr.message); setLoading(false); return }

    setDone(true); setLoading(false)
    setTimeout(() => router.push('/dashboard'), 1600)
  }

  const passwordsMatch = confirm.length > 0 && password === confirm

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />
      <div style={{ width: '100%', maxWidth: 400, padding: '0 24px' }}>

        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: 5, color: '#6B9E7E', textTransform: 'uppercase', marginBottom: 4 }}>Your</div>
          <div style={{ fontFamily: "'Lora', serif", fontSize: 32, fontWeight: 500, color: '#1E2620' }}>Kitchen</div>
        </div>

        {done ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: 18, background: '#EAF2ED', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, margin: '0 auto 20px' }}>&#10003;</div>
            <h1 style={{ fontFamily: "'Lora', serif", fontSize: 24, fontWeight: 500, color: '#1E2620', margin: '0 0 10px', letterSpacing: -0.5 }}>Password updated</h1>
            <p style={{ fontSize: 14, color: '#6B7066', fontWeight: 300, lineHeight: 1.7 }}>Taking you to your dashboard&#8230;</p>
          </div>
        ) : (
          <>
            <h1 style={{ fontFamily: "'Lora', serif", fontSize: 24, fontWeight: 500, color: '#1E2620', margin: '0 0 8px', letterSpacing: -0.5, textAlign: 'center' }}>Reset your password</h1>
            <p style={{ textAlign: 'center', fontSize: 14, color: '#6B7066', marginBottom: 28, fontWeight: 300, lineHeight: 1.6 }}>Enter the 6-digit code we emailed you, then choose a new password.</p>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={labelStyle}>Account email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@email.com" autoComplete="email" style={inputStyle} />
              </div>

              <div>
                <label style={labelStyle}>6-digit code</label>
                <input
                  type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
                  value={code} onChange={e => setCode(e.target.value.replace(/[^0-9]/g, ''))}
                  required placeholder="123456"
                  style={{ ...inputStyle, letterSpacing: 8, fontSize: 22, textAlign: 'center', fontWeight: 500 }}
                />
              </div>

              <div>
                <label style={labelStyle}>New password</label>
                <div style={{ position: 'relative' }}>
                  <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required placeholder="At least 8 characters" autoComplete="new-password" style={{ ...inputStyle, paddingRight: 46 }} />
                  <button type="button" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'}
                    style={eyeBtn}>{showPassword ? <EyeOffIcon /> : <EyeIcon />}</button>
                </div>
              </div>

              <div>
                <label style={labelStyle}>Confirm new password</label>
                <div style={{ position: 'relative' }}>
                  <input type={showConfirm ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)} required placeholder="Repeat your password" autoComplete="new-password" style={{ ...inputStyle, paddingRight: 46 }} />
                  <button type="button" onClick={() => setShowConfirm(v => !v)} aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
                    style={eyeBtn}>{showConfirm ? <EyeOffIcon /> : <EyeIcon />}</button>
                </div>
                {confirm.length > 0 && (
                  <p style={{ fontSize: 12, color: passwordsMatch ? '#3D6B4F' : '#B94040', margin: '6px 0 0', fontWeight: 500 }}>
                    {passwordsMatch ? '\u2713 Passwords match' : '\u2717 Passwords do not match'}
                  </p>
                )}
              </div>

              {error && <p style={{ color: '#B94040', fontSize: 13, margin: 0, lineHeight: 1.5 }}>{error}</p>}

              <button type="submit" disabled={loading}
                style={{ background: loading ? '#6B9E7E' : '#3D6B4F', color: '#fff', border: 'none', borderRadius: 10, padding: '14px', fontSize: 14, fontWeight: 500, cursor: loading ? 'default' : 'pointer', width: '100%', minHeight: 48, marginTop: 8, fontFamily: "'DM Sans', sans-serif" }}>
                {loading ? 'Resetting\u2026' : 'Reset password'}
              </button>
            </form>

            <p style={{ textAlign: 'center', fontSize: 13, color: '#6B7066', marginTop: 24, fontWeight: 300 }}>
              <Link href="/login" style={{ color: '#3D6B4F', fontWeight: 500, textDecoration: 'none' }}>Back to sign in</Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 500, color: '#6B7066', letterSpacing: 1, textTransform: 'uppercase', display: 'block', marginBottom: 8 }
const inputStyle: React.CSSProperties = { width: '100%', padding: '13px 16px', borderRadius: 10, border: '1.5px solid #DDE8E0', fontSize: 16, background: '#fff', color: '#1E2620', outline: 'none', boxSizing: 'border-box', fontFamily: "'DM Sans', sans-serif" }
const eyeBtn: React.CSSProperties = { position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#6B7066', display: 'flex', alignItems: 'center', padding: 0 }

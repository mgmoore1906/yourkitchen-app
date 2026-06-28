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

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  // The /auth/callback route verifies the recovery token and establishes the
  // session before redirecting here. We confirm that session exists; if it
  // doesn't (expired or reused link), we show a "request a new link" state
  // instead of a form that can't save.
  const [checking, setChecking] = useState(true)
  const [hasSession, setHasSession] = useState(false)

  useEffect(() => {
    let active = true
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!active) return
      setHasSession(!!session)
      setChecking(false)
    })()
    // Also catch the recovery event if the session lands a beat after mount.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) { setHasSession(true); setChecking(false) }
    })
    return () => { active = false; sub.subscription.unsubscribe() }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (password !== confirm) { setError('Passwords do not match'); return }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) { setError(error.message); setLoading(false); return }
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

        {checking ? (
          <p style={{ textAlign: 'center', fontSize: 14, color: '#6B7066', fontWeight: 300 }}>Checking your reset link…</p>
        ) : done ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: 18, background: '#EAF2ED', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, margin: '0 auto 20px' }}>✓</div>
            <h1 style={{ fontFamily: "'Lora', serif", fontSize: 24, fontWeight: 500, color: '#1E2620', margin: '0 0 10px', letterSpacing: -0.5 }}>Password updated</h1>
            <p style={{ fontSize: 14, color: '#6B7066', fontWeight: 300, lineHeight: 1.7 }}>Taking you to your dashboard…</p>
          </div>
        ) : !hasSession ? (
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontFamily: "'Lora', serif", fontSize: 24, fontWeight: 500, color: '#1E2620', margin: '0 0 10px', letterSpacing: -0.5 }}>This link has expired</h1>
            <p style={{ fontSize: 14, color: '#6B7066', fontWeight: 300, lineHeight: 1.7, margin: '0 0 24px' }}>
              Reset links are single-use and expire after a short time. Head back to sign in and tap “Forgot password?” to get a fresh one.
            </p>
            <Link href="/login" style={{ display: 'inline-block', background: '#3D6B4F', color: '#fff', borderRadius: 10, padding: '13px 28px', fontSize: 14, fontWeight: 500, textDecoration: 'none' }}>Back to sign in</Link>
          </div>
        ) : (
          <>
            <p style={{ textAlign: 'center', fontSize: 14, color: '#6B7066', marginTop: -8, marginBottom: 28, fontWeight: 300 }}>Choose a new password for your account.</p>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={labelStyle}>New password</label>
                <div style={{ position: 'relative' }}>
                  <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required placeholder="At least 8 characters" style={{ ...inputStyle, paddingRight: 46 }} />
                  <button type="button" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'}
                    style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#6B7066', display: 'flex', alignItems: 'center', padding: 0 }}>
                    {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </div>

              <div>
                <label style={labelStyle}>Confirm new password</label>
                <div style={{ position: 'relative' }}>
                  <input type={showConfirm ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)} required placeholder="Repeat your password" style={{ ...inputStyle, paddingRight: 46 }} />
                  <button type="button" onClick={() => setShowConfirm(v => !v)} aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
                    style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#6B7066', display: 'flex', alignItems: 'center', padding: 0 }}>
                    {showConfirm ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
                {confirm.length > 0 && (
                  <p style={{ fontSize: 12, color: passwordsMatch ? '#3D6B4F' : '#B94040', margin: '6px 0 0', fontWeight: 500 }}>
                    {passwordsMatch ? '✓ Passwords match' : '✗ Passwords do not match'}
                  </p>
                )}
              </div>

              {error && <p style={{ color: '#B94040', fontSize: 13, margin: 0 }}>{error}</p>}

              <button type="submit" disabled={loading}
                style={{ background: loading ? '#6B9E7E' : '#3D6B4F', color: '#fff', border: 'none', borderRadius: 10, padding: '14px', fontSize: 14, fontWeight: 500, cursor: loading ? 'default' : 'pointer', width: '100%', minHeight: 48, marginTop: 8, fontFamily: "'DM Sans', sans-serif" }}>
                {loading ? 'Updating…' : 'Update password'}
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

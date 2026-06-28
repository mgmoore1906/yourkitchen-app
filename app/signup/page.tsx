'use client'
import { useState } from 'react'
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

export default function SignUpPage() {
const [email, setEmail] = useState('')
const [password, setPassword] = useState('')
const [confirmPassword, setConfirmPassword] = useState('')
const [showPassword, setShowPassword] = useState(false)
const [showConfirm, setShowConfirm] = useState(false)
const [error, setError] = useState('')
const [loading, setLoading] = useState(false)
const [googleLoading, setGoogleLoading] = useState(false)
const [emailSent, setEmailSent] = useState(false)
const [resending, setResending] = useState(false)
const [resent, setResent] = useState(false)
const [agreed, setAgreed] = useState(false)
const router = useRouter()
const supabase = createClient()

const handleSignUp = async (e: React.FormEvent) => {
e.preventDefault()
setError('')
if (!agreed) { setError('Please agree to the Terms and Privacy Policy to continue.'); return }
if (password !== confirmPassword) { setError('Passwords do not match'); return }
if (password.length < 8) { setError('Password must be at least 8 characters'); return }

setLoading(true)
const { data, error } = await supabase.auth.signUp({
email,
password,
options: { emailRedirectTo: `${window.location.origin}/auth/callback`, data: { terms_accepted_at: new Date().toISOString() } },
})

if (error) {
setError(error.message)
setLoading(false)
return
}

// If Supabase returned an active session, email confirmation is OFF —
// the user is already signed in, so go straight to onboarding.
if (data.session) {
router.push('/onboarding')
return
}

// Otherwise a confirmation email was sent — show the check-your-email screen.
setEmailSent(true)
setLoading(false)
}

const handleResend = async () => {
setResending(true); setResent(false)
await supabase.auth.resend({
type: 'signup',
email,
options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
})
setResending(false); setResent(true)
}

const handleGoogleSignUp = async () => {
if (!agreed) { setError('Please agree to the Terms and Privacy Policy to continue.'); return }
setGoogleLoading(true)
const { error } = await supabase.auth.signInWithOAuth({
provider: 'google',
options: { redirectTo: `${window.location.origin}/auth/callback` },
})
if (error) { setError(error.message); setGoogleLoading(false) }
}

const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword

return (
<div style={{ minHeight: '100vh', background: '#FAFAF5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans', sans-serif" }}>
<link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />
<div style={{ width: '100%', maxWidth: 400, padding: '0 24px' }}>

<div style={{ textAlign: 'center', marginBottom: 40 }}>
<div style={{ fontSize: 11, fontWeight: 500, letterSpacing: 5, color: '#6B9E7E', textTransform: 'uppercase', marginBottom: 4 }}>Your</div>
<div style={{ fontFamily: "'Lora', serif", fontSize: 32, fontWeight: 500, color: '#1E2620' }}>Kitchen</div>
{!emailSent && <p style={{ fontSize: 14, color: '#6B7066', marginTop: 8 }}>Create your free account</p>}
</div>

{emailSent ? (
/* ── CHECK YOUR EMAIL ── */
<div style={{ textAlign: 'center' }}>
<div style={{ width: 64, height: 64, borderRadius: 18, background: '#EAF2ED', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, margin: '0 auto 20px' }}>📬</div>
<h1 style={{ fontFamily: "'Lora', serif", fontSize: 24, fontWeight: 500, color: '#1E2620', margin: '0 0 10px', letterSpacing: -0.5 }}>Check your email</h1>
<p style={{ fontSize: 14, color: '#6B7066', fontWeight: 300, lineHeight: 1.7, margin: '0 0 6px' }}>
We sent a confirmation link to
</p>
<p style={{ fontSize: 14, color: '#1E2620', fontWeight: 600, margin: '0 0 20px' }}>{email}</p>
<p style={{ fontSize: 14, color: '#6B7066', fontWeight: 300, lineHeight: 1.7, margin: '0 0 28px' }}>
Tap the link in that email to confirm your account. Setting up your Kitchen begins right after.
</p>

<div style={{ background: '#fff', border: '1px solid #DDE8E0', borderRadius: 12, padding: '16px 18px', marginBottom: 20 }}>
<p style={{ fontSize: 13, color: '#6B7066', fontWeight: 300, margin: '0 0 10px', lineHeight: 1.6 }}>
Didn't get it? Check spam, or resend.
</p>
{resent ? (
<p style={{ fontSize: 13, color: '#3D6B4F', fontWeight: 600, margin: 0 }}>✓ Sent again — give it a minute.</p>
) : (
<button onClick={handleResend} disabled={resending}
style={{ background: 'none', border: 'none', color: '#3D6B4F', fontSize: 13, fontWeight: 600, cursor: resending ? 'default' : 'pointer', fontFamily: "'DM Sans', sans-serif", padding: 0, textDecoration: 'underline' }}>
{resending ? 'Resending…' : 'Resend confirmation email'}
</button>
)}
</div>

<p style={{ fontSize: 13, color: '#6B7066', fontWeight: 300 }}>
Already confirmed?{' '}
<Link href="/login" style={{ color: '#3D6B4F', fontWeight: 500, textDecoration: 'none' }}>Sign in</Link>
</p>
</div>
) : (
/* ── SIGNUP FORM ── */
<>
<div style={{ background: '#EAF2ED', border: '1.5px solid #DDE8E0', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
<label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
<input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} style={{ width: 18, height: 18, accentColor: '#3D6B4F', flexShrink: 0, marginTop: 1 }} />
<span style={{ fontSize: 12.5, color: '#6B7066', lineHeight: 1.6, fontWeight: 300 }}>
I agree to the <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: '#3D6B4F', fontWeight: 500 }}>Terms of Service</a> and <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: '#3D6B4F', fontWeight: 500 }}>Privacy Policy</a>.
</span>
</label>
</div>
<button onClick={handleGoogleSignUp} disabled={googleLoading || !agreed}
style={{ width: '100%', padding: '13px 16px', borderRadius: 10, border: '1.5px solid #DDE8E0', background: '#fff', fontSize: 14, fontWeight: 500, color: '#1E2620', cursor: (googleLoading || !agreed) ? 'default' : 'pointer', opacity: !agreed ? 0.55 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 20, fontFamily: "'DM Sans', sans-serif" }}>
{googleLoading ? 'Redirecting…' : (
<>
<svg width="18" height="18" viewBox="0 0 18 18" fill="none">
<path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
<path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
<path d="M3.964 10.707A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
<path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
</svg>
Continue with Google
</>
)}
</button>

<div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
<div style={{ flex: 1, height: 1, background: '#DDE8E0' }} />
<span style={{ fontSize: 12, color: '#6B7066', fontWeight: 300 }}>or sign up with email</span>
<div style={{ flex: 1, height: 1, background: '#DDE8E0' }} />
</div>

<form onSubmit={handleSignUp} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
<div>
<label style={labelStyle}>Email</label>
<input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com" style={inputStyle} />
</div>

<div>
<label style={labelStyle}>Password</label>
<div style={{ position: 'relative' }}>
<input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required placeholder="At least 8 characters" style={{ ...inputStyle, paddingRight: 46 }} />
<button type="button" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'}
style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#6B7066', display: 'flex', alignItems: 'center', padding: 0 }}>
{showPassword ? <EyeOffIcon /> : <EyeIcon />}
</button>
</div>
</div>

<div>
<label style={labelStyle}>Confirm Password</label>
<div style={{ position: 'relative' }}>
<input type={showConfirm ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required placeholder="Repeat your password" style={{ ...inputStyle, paddingRight: 46 }} />
<button type="button" onClick={() => setShowConfirm(v => !v)} aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#6B7066', display: 'flex', alignItems: 'center', padding: 0 }}>
{showConfirm ? <EyeOffIcon /> : <EyeIcon />}
</button>
</div>
{confirmPassword.length > 0 && (
<p style={{ fontSize: 12, color: passwordsMatch ? '#3D6B4F' : '#B94040', margin: '6px 0 0', fontWeight: 500 }}>
{passwordsMatch ? '✓ Passwords match' : '✗ Passwords do not match'}
</p>
)}
</div>

{error && <p style={{ color: '#B94040', fontSize: 13, margin: 0 }}>{error}</p>}

<button type="submit" disabled={loading || !agreed}
style={{ background: (loading || !agreed) ? '#6B9E7E' : '#3D6B4F', color: '#fff', border: 'none', borderRadius: 10, padding: '14px', fontSize: 14, fontWeight: 500, cursor: (loading || !agreed) ? 'default' : 'pointer', width: '100%', minHeight: 48, marginTop: 8, fontFamily: "'DM Sans', sans-serif" }}>
{loading ? 'Creating account…' : 'Create Free Account'}
</button>
</form>

<p style={{ textAlign: 'center', fontSize: 13, color: '#6B7066', marginTop: 24, fontWeight: 300 }}>
Already have an account?{' '}
<Link href="/login" style={{ color: '#3D6B4F', fontWeight: 500, textDecoration: 'none' }}>Sign in</Link>
</p>
<p style={{ textAlign: 'center', fontSize: 12, color: '#6B7066', marginTop: 12, fontWeight: 300 }}>
Free to start · No card required
</p>
</>
)}
</div>
</div>
)
}

const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 500, color: '#6B7066', letterSpacing: 1, textTransform: 'uppercase', display: 'block', marginBottom: 8 }
const inputStyle: React.CSSProperties = { width: '100%', padding: '13px 16px', borderRadius: 10, border: '1.5px solid #DDE8E0', fontSize: 16, background: '#fff', color: '#1E2620', outline: 'none', boxSizing: 'border-box', fontFamily: "'DM Sans', sans-serif" }

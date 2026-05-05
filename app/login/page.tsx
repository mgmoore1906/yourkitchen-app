'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ width: '100%', maxWidth: 400, padding: '0 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: 5, color: '#6B9E7E', textTransform: 'uppercase', marginBottom: 4 }}>Your</div>
          <div style={{ fontFamily: "'Lora', serif", fontSize: 32, fontWeight: 500, color: '#1E2620' }}>Kitchen</div>
          <p style={{ fontSize: 14, color: '#6B7066', marginTop: 8 }}>Sign in to your account</p>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: '#6B7066', letterSpacing: 1, textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              style={{
                width: '100%', padding: '13px 16px', borderRadius: 10,
                border: '1.5px solid #DDE8E0', fontSize: 14,
                background: '#fff', color: '#1E2620',
                outline: 'none', boxSizing: 'border-box',
                fontFamily: "'DM Sans', sans-serif",
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: '#6B7066', letterSpacing: 1, textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={{
                width: '100%', padding: '13px 16px', borderRadius: 10,
                border: '1.5px solid #DDE8E0', fontSize: 14,
                background: '#fff', color: '#1E2620',
                outline: 'none', boxSizing: 'border-box',
                fontFamily: "'DM Sans', sans-serif",
              }}
            />
          </div>

          {error && <p style={{ color: '#B94040', fontSize: 13, margin: 0 }}>{error}</p>}

          <button
            type="submit"
            disabled={loading}
            style={{
              background: loading ? '#6B9E7E' : '#3D6B4F', color: '#fff',
              border: 'none', borderRadius: 10, padding: '14px',
              fontSize: 14, fontWeight: 500,
              cursor: loading ? 'default' : 'pointer', marginTop: 8,
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        {/* Sign up link */}
        <p style={{ textAlign: 'center', fontSize: 13, color: '#6B7066', marginTop: 24, fontWeight: 300 }}>
          Don&apos;t have an account?{' '}
          <a href="/signup" style={{ color: '#3D6B4F', fontWeight: 500, textDecoration: 'none' }}>
            Create one free
          </a>
        </p>
      </div>
    </div>
  )
}

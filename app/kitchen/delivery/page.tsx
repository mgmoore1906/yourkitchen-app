'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const S = {
  sage: '#3D6B4F', sageMid: '#6B9E7E', sageLight: '#EAF2ED',
  cream: '#FAFAF5', forest: '#1E2620', stone: '#6B7066',
  border: '#DDE8E0', white: '#FFFFFF', amber: '#C17F47',
  amberLight: '#FBF0E4', red: '#B94040',
}

const MEALS = [
  { key: 'breakfast', label: 'Breakfast', emoji: '🌅', color: '#E8834A', hint: 'When breakfast usually works best' },
  { key: 'lunch',     label: 'Lunch',     emoji: '☀️', color: '#4A8FA8', hint: 'Your usual lunchtime' },
  { key: 'dinner',    label: 'Dinner',    emoji: '🌙', color: S.sage,    hint: 'When dinner is most welcome' },
] as const

// Turn "19:00" → "7:00 PM" for the friendly confirmation line.
function pretty(t: string): string {
  if (!t) return ''
  const [hStr, m] = t.split(':')
  let h = parseInt(hStr, 10)
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12; if (h === 0) h = 12
  return `${h}:${m} ${ampm}`
}

export default function DeliveryPreferencesPage() {
  const router = useRouter()
  const supabase = createClient()
  const [userId, setUserId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [times, setTimes] = useState<Record<string, string>>({ breakfast: '', lunch: '', dinner: '' })

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)
      try {
        const res = await fetch(`/api/delivery?user_id=${user.id}`)
        const data = await res.json()
        if (res.ok) {
          setTimes({
            breakfast: data.breakfast || '',
            lunch:     data.lunch || '',
            dinner:    data.dinner || '',
          })
        }
      } catch { /* fall through to empty */ }
      setLoading(false)
    }
    load()
  }, [])

  const save = async () => {
    setSaving(true); setSaved(false); setError('')
    try {
      const res = await fetch('/api/delivery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, ...times }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Could not save.'); setSaving(false); return }
      setSaved(true)
    } catch (e: any) {
      setError(e.message || 'Could not save.')
    }
    setSaving(false)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: S.cream, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, fontFamily: "'DM Sans', sans-serif" }}>
      <svg width="44" height="44" viewBox="0 0 44 44" fill="none" aria-label="Loading">
        <circle cx="22" cy="22" r="19" stroke={S.sageLight} strokeWidth="3" />
        <path d="M22 3 a19 19 0 0 1 19 19" stroke={S.sage} strokeWidth="3" strokeLinecap="round">
          <animateTransform attributeName="transform" type="rotate" from="0 22 22" to="360 22 22" dur="0.8s" repeatCount="indefinite" />
        </path>
      </svg>
      <p style={{ color: S.stone, fontSize: 12.5, fontWeight: 300 }}>Loading your times…</p>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: S.cream, fontFamily: "'DM Sans', sans-serif", paddingBottom: 60 }}>
      <link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />

      <div style={{ background: S.forest, padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => router.push('/dashboard')}
          style={{ background: S.sage, border: 'none', borderRadius: 10, width: 36, height: 36, cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', color: S.white }}>
          ‹
        </button>
        <div>
          <div style={{ fontSize: 9, fontWeight: 500, letterSpacing: 5, color: S.sageMid, textTransform: 'uppercase' }}>Your</div>
          <div style={{ fontFamily: "'Lora', serif", fontSize: 20, fontWeight: 500, color: S.white }}>Kitchen</div>
        </div>
      </div>

      <div style={{ padding: '28px 24px', maxWidth: 500, margin: '0 auto' }}>
        <h1 style={{ fontFamily: "'Lora', serif", fontSize: 26, fontWeight: 500, color: S.forest, margin: '0 0 8px', letterSpacing: -0.5 }}>Delivery times</h1>
        <p style={{ fontSize: 13.5, color: S.stone, fontWeight: 300, lineHeight: 1.6, margin: '0 0 28px' }}>
          Set the time each meal usually works best for you. Your village sees these as the default when they send a meal — and the night before, you'll get a heads up with the time so you can plan. You can leave any meal blank.
        </p>

        {MEALS.map(m => (
          <div key={m.key} style={{ background: S.white, border: `1.5px solid ${S.border}`, borderRadius: 14, padding: '16px 18px', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 16 }}>{m.emoji}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: m.color, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{m.label}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <input
                type="time"
                value={times[m.key]}
                onChange={e => { setTimes(t => ({ ...t, [m.key]: e.target.value })); setSaved(false) }}
                style={{ flex: 1, padding: '12px 14px', borderRadius: 10, border: `1.5px solid ${S.border}`, fontSize: 15, fontFamily: "'DM Sans', sans-serif", color: S.forest, background: '#fff', outline: 'none' }}
              />
              {times[m.key] && (
                <button onClick={() => { setTimes(t => ({ ...t, [m.key]: '' })); setSaved(false) }}
                  style={{ background: 'none', border: 'none', color: S.stone, fontSize: 13, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", whiteSpace: 'nowrap' }}>
                  Clear
                </button>
              )}
            </div>
            <p style={{ fontSize: 11.5, color: S.stone, fontWeight: 300, margin: '8px 0 0' }}>
              {times[m.key] ? `Usually around ${pretty(times[m.key])}` : m.hint}
            </p>
          </div>
        ))}

        {error && <div style={{ background: '#FDE8E8', border: `1.5px solid ${S.red}`, borderRadius: 12, padding: '12px 16px', marginTop: 8 }}><p style={{ fontSize: 13, color: S.red, margin: 0 }}>⚠️ {error}</p></div>}
        {saved && <div style={{ background: S.sageLight, border: `1.5px solid ${S.sage}`, borderRadius: 12, padding: '12px 16px', marginTop: 8 }}><p style={{ fontSize: 13, color: S.sage, margin: 0 }}>✓ Your delivery times are saved.</p></div>}

        <button onClick={save} disabled={saving}
          style={{ width: '100%', marginTop: 18, padding: '14px', borderRadius: 12, border: 'none', background: saving ? S.border : S.sage, color: S.white, fontSize: 15, fontWeight: 600, cursor: saving ? 'default' : 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
          {saving ? 'Saving…' : 'Save delivery times'}
        </button>

        <p style={{ fontSize: 12, color: S.stone, fontWeight: 300, lineHeight: 1.6, margin: '18px 0 0', textAlign: 'center' }}>
          These are your usual times. When someone sends a meal, they can adjust for a one-off — and you'll always confirm the night before.
        </p>
      </div>
    </div>
  )
}

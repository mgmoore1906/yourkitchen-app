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
  { key: 'breakfast', label: 'Breakfast', icon: 'sunrise', color: '#E8834A', hint: 'When breakfast usually works best' },
  { key: 'lunch',     label: 'Lunch',     icon: 'sun',     color: '#4A8FA8', hint: 'Your usual lunchtime' },
  { key: 'dinner',    label: 'Dinner',    icon: 'moon',    color: S.sage,    hint: 'When dinner is most welcome' },
] as const

// Clean inline SVG meal icons (consistent across devices, unlike emoji).
function MealIcon({ kind, color }: { kind: string; color: string }) {
  const common = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  if (kind === 'sunrise') return (
    <svg {...common}><path d="M17 18a5 5 0 0 0-10 0"/><line x1="12" y1="2" x2="12" y2="9"/><line x1="4.22" y1="10.22" x2="5.64" y2="11.64"/><line x1="1" y1="18" x2="3" y2="18"/><line x1="21" y1="18" x2="23" y2="18"/><line x1="18.36" y1="11.64" x2="19.78" y2="10.22"/><line x1="23" y1="22" x2="1" y2="22"/><polyline points="8 6 12 2 16 6"/></svg>
  )
  if (kind === 'sun') return (
    <svg {...common}><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
  )
  return (
    <svg {...common}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
  )
}

// "19:00" -> "7:00 PM"
function fmt1(t: string): string {
  if (!t) return ''
  const [hStr, m] = t.split(':')
  let h = parseInt(hStr, 10)
  if (isNaN(h)) return ''
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12; if (h === 0) h = 12
  return `${h}:${m || '00'} ${ampm}`
}
const periodOf = (t: string): string => { const h = parseInt((t.split(':')[0] || ''), 10); return isNaN(h) ? '' : (h >= 12 ? 'PM' : 'AM') }
// Friendly window: "8:00 - 10:00 AM" when both ends share a half, "11:00 AM - 12:30 PM" otherwise.
function fmtWindow(from: string, to: string): string {
  if (!from) return ''
  if (!to) return fmt1(from)
  const a = fmt1(from), b = fmt1(to)
  if (!a || !b) return a || b
  return (periodOf(from) && periodOf(from) === periodOf(to)) ? `${a.replace(/\s?(AM|PM)$/, '')} - ${b}` : `${a} - ${b}`
}
// Stored window string <-> { from, to }. Accepts "HH:MM-HH:MM" or single "HH:MM".
function parseWin(raw: string): { from: string; to: string } {
  const s = (raw || '').trim()
  if (!s) return { from: '', to: '' }
  const [a, b] = s.split('-')
  return { from: (a || '').trim(), to: (b || '').trim() }
}
function buildWin(w: { from: string; to: string }): string {
  const f = (w.from || '').trim(), t = (w.to || '').trim()
  if (f && t) return `${f}-${t}`
  return f || ''
}

export default function DeliveryPreferencesPage() {
  const router = useRouter()
  const supabase = createClient()
  const [userId, setUserId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [win, setWin] = useState<Record<string, { from: string; to: string }>>({ breakfast: { from: '', to: '' }, lunch: { from: '', to: '' }, dinner: { from: '', to: '' } })

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)
      try {
        const res = await fetch(`/api/delivery?user_id=${user.id}`)
        const data = await res.json()
        if (res.ok) {
          setWin({
            breakfast: parseWin(data.breakfast || ''),
            lunch:     parseWin(data.lunch || ''),
            dinner:    parseWin(data.dinner || ''),
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
        body: JSON.stringify({ user_id: userId, breakfast: buildWin(win.breakfast), lunch: buildWin(win.lunch), dinner: buildWin(win.dinner) }),
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
          Set the window each meal usually works best for you — a start and end time. Your village sees this as the default when they send a meal, and the night before you'll get a heads up so you can plan. Leave any meal blank, or set just a start time.
        </p>

        {MEALS.map(m => (
          <div key={m.key} style={{ background: S.white, border: `1.5px solid ${S.border}`, borderRadius: 14, padding: '16px 18px', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <MealIcon kind={m.icon} color={m.color} />
              <span style={{ fontSize: 12, fontWeight: 700, color: m.color, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{m.label}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="time"
                aria-label={`${m.label} window start`}
                value={win[m.key].from}
                onChange={e => { setWin(w => ({ ...w, [m.key]: { ...w[m.key], from: e.target.value } })); setSaved(false) }}
                style={{ flex: 1, minWidth: 0, padding: '12px 10px', borderRadius: 10, border: `1.5px solid ${S.border}`, fontSize: 15, fontFamily: "'DM Sans', sans-serif", color: S.forest, background: '#fff', outline: 'none' }}
              />
              <span style={{ color: S.stone, fontSize: 15, flexShrink: 0 }}>–</span>
              <input
                type="time"
                aria-label={`${m.label} window end`}
                value={win[m.key].to}
                onChange={e => { setWin(w => ({ ...w, [m.key]: { ...w[m.key], to: e.target.value } })); setSaved(false) }}
                style={{ flex: 1, minWidth: 0, padding: '12px 10px', borderRadius: 10, border: `1.5px solid ${S.border}`, fontSize: 15, fontFamily: "'DM Sans', sans-serif", color: S.forest, background: '#fff', outline: 'none' }}
              />
              {(win[m.key].from || win[m.key].to) && (
                <button onClick={() => { setWin(w => ({ ...w, [m.key]: { from: '', to: '' } })); setSaved(false) }}
                  style={{ background: 'none', border: 'none', color: S.stone, fontSize: 13, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", whiteSpace: 'nowrap', flexShrink: 0 }}>
                  Clear
                </button>
              )}
            </div>
            <p style={{ fontSize: 11.5, color: S.stone, fontWeight: 300, margin: '8px 0 0' }}>
              {win[m.key].from ? `Usually around ${fmtWindow(win[m.key].from, win[m.key].to)}` : m.hint}
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

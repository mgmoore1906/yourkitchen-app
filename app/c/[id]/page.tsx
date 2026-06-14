'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

const S = {
  sage: '#3D6B4F', sageMid: '#6B9E7E', sageLight: '#EAF2ED',
  cream: '#FAFAF5', forest: '#1E2620', amber: '#C17F47',
  white: '#FFFFFF', border: '#DDE8E0', stone: '#6B7066', red: '#B4534B',
}

type Summary = {
  id: string
  status: string
  meal_type: string
  delivery_time: string | null
  is_pickup: boolean
  meal_name: string
  restaurant: string
  coordinator_name: string
  kitchen_name: string
}

function prettyTime(t: string | null, mealType: string): string {
  if (t && /^\d{1,2}:\d{2}/.test(t)) {
    const [h, m] = t.split(':').map(Number)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const h12 = h % 12 === 0 ? 12 : h % 12
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
  }
  return mealType === 'breakfast' ? 'the morning' : mealType === 'lunch' ? 'midday' : 'the evening'
}

const TIME_OPTIONS: Record<string, string[]> = {
  breakfast: ['07:30', '08:00', '08:30', '09:00', '09:30', '10:00'],
  lunch: ['11:00', '11:30', '12:00', '12:30', '13:00', '13:30'],
  dinner: ['16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30'],
}
const DEFAULT_TIME_OPT: Record<string, string> = { breakfast: '08:30', lunch: '12:30', dinner: '18:30' }
function normTime(t: string | null, mealType: string): string {
  const raw = (t && String(t).trim()) ? String(t).split('-')[0].trim() : (DEFAULT_TIME_OPT[mealType] || '18:30')
  const [h, m] = raw.split(':')
  if (!h) return DEFAULT_TIME_OPT[mealType] || '18:30'
  return `${h.padStart(2, '0')}:${(m || '00').padStart(2, '0')}`
}
function timeOptionsFor(mealType: string, current: string): string[] {
  const base = TIME_OPTIONS[mealType] || TIME_OPTIONS.dinner
  return base.includes(current) ? base : [current, ...base].filter(Boolean).sort()
}

export default function ConfirmPage() {
  const params = useParams()
  const id = (Array.isArray(params.id) ? params.id[0] : params.id) || ''

  const [data, setData] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadErr, setLoadErr] = useState(false)
  const [phase, setPhase] = useState<'idle' | 'working' | 'confirmed' | 'declined' | 'already' | 'error'>('idle')
  const [declineOpen, setDeclineOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [chosenTime, setChosenTime] = useState('')

  useEffect(() => {
    if (!id) { setLoading(false); setLoadErr(true); return }
    fetch(`/api/confirm?id=${encodeURIComponent(id)}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((d: Summary) => {
        setData(d)
        setChosenTime(normTime(d.delivery_time, d.meal_type))
        if (d.status === 'confirmed' || d.status === 'declined') setPhase('already')
      })
      .catch(() => setLoadErr(true))
      .finally(() => setLoading(false))
  }, [id])

  async function act(action: 'confirm' | 'decline') {
    setPhase('working')
    try {
      const res = await fetch('/api/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposal_id: id, action, reason: action === 'decline' ? reason : undefined, delivery_time: action === 'confirm' ? chosenTime : undefined }),
      })
      if (!res.ok) throw new Error()
      setPhase(action === 'confirm' ? 'confirmed' : 'declined')
    } catch {
      setPhase('error')
    }
  }

  const wrap: React.CSSProperties = {
    minHeight: '100vh', background: S.cream, display: 'flex', alignItems: 'flex-start',
    justifyContent: 'center', padding: '32px 18px', fontFamily: "'DM Sans', sans-serif",
  }
  const card: React.CSSProperties = {
    width: '100%', maxWidth: 440, background: S.white, borderRadius: 20,
    border: `1px solid ${S.border}`, padding: '32px 26px', boxShadow: '0 8px 30px rgba(30,38,32,0.06)',
  }
  const h: React.CSSProperties = { fontFamily: "'Lora', serif", color: S.forest, fontWeight: 500, letterSpacing: -0.4 }

  if (loading) {
    return <div style={wrap}><div style={{ ...card, textAlign: 'center', color: S.stone }}>Loading…</div></div>
  }

  if (loadErr || !data) {
    return (
      <div style={wrap}>
        <div style={{ ...card, textAlign: 'center' }}>
          <p style={{ fontSize: 30, margin: '0 0 10px' }}>🍃</p>
          <h1 style={{ ...h, fontSize: 21, margin: '0 0 8px' }}>We couldn&rsquo;t find this meal</h1>
          <p style={{ fontSize: 14, color: S.stone, margin: 0, lineHeight: 1.6 }}>
            This link may have expired or already been used. If you were expecting a meal, check your dashboard or the text message we sent.
          </p>
        </div>
      </div>
    )
  }

  const when = prettyTime(data.delivery_time, data.meal_type)
  const arriveVerb = data.is_pickup ? 'ready for pickup around' : 'arriving around'

  if (phase === 'confirmed') {
    return (
      <div style={wrap}>
        <div style={{ ...card, textAlign: 'center' }}>
          <p style={{ fontSize: 34, margin: '0 0 10px' }}>✅</p>
          <h1 style={{ ...h, fontSize: 22, margin: '0 0 10px' }}>All set</h1>
          <p style={{ fontSize: 15, color: S.stone, margin: 0, lineHeight: 1.6 }}>
            {data.meal_name} from {data.restaurant} is confirmed. {data.coordinator_name} will be so glad. We&rsquo;ll take it from here.
          </p>
        </div>
      </div>
    )
  }

  if (phase === 'declined') {
    return (
      <div style={wrap}>
        <div style={{ ...card, textAlign: 'center' }}>
          <p style={{ fontSize: 34, margin: '0 0 10px' }}>🤍</p>
          <h1 style={{ ...h, fontSize: 22, margin: '0 0 10px' }}>No problem at all</h1>
          <p style={{ fontSize: 15, color: S.stone, margin: 0, lineHeight: 1.6 }}>
            We&rsquo;ve let {data.coordinator_name} know, and no one was charged. They can offer another day whenever it works for you.
          </p>
        </div>
      </div>
    )
  }

  if (phase === 'already') {
    return (
      <div style={wrap}>
        <div style={{ ...card, textAlign: 'center' }}>
          <p style={{ fontSize: 30, margin: '0 0 10px' }}>🍃</p>
          <h1 style={{ ...h, fontSize: 21, margin: '0 0 8px' }}>Already answered</h1>
          <p style={{ fontSize: 14, color: S.stone, margin: 0, lineHeight: 1.6 }}>
            This meal was {data.status === 'confirmed' ? 'confirmed' : 'declined'} already — nothing more to do here.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={wrap}>
      <div style={card}>
        <p style={{ fontSize: 12, fontWeight: 700, color: S.sageMid, letterSpacing: 2, textTransform: 'uppercase', margin: '0 0 14px' }}>
          A meal for you
        </p>
        <h1 style={{ ...h, fontSize: 23, lineHeight: 1.3, margin: '0 0 18px' }}>
          {data.coordinator_name} wants to send you {data.meal_type === 'breakfast' ? 'breakfast' : data.meal_type === 'lunch' ? 'lunch' : 'dinner'}.
        </h1>

        <div style={{ background: S.sageLight, borderRadius: 14, padding: '18px 20px', marginBottom: 22 }}>
          <p style={{ fontSize: 17, color: S.forest, fontWeight: 600, margin: '0 0 6px', fontFamily: "'Lora', serif" }}>
            {data.meal_name}
          </p>
          <p style={{ fontSize: 14, color: S.stone, margin: 0, lineHeight: 1.5 }}>
            from {data.restaurant} · {arriveVerb} {when}
          </p>
        </div>

        <p style={{ fontSize: 13.5, color: S.stone, margin: '0 0 20px', lineHeight: 1.6 }}>
          Nothing is charged unless you say yes. Take your time — there&rsquo;s no pressure either way.
        </p>

        {phase === 'error' && (
          <div style={{ background: '#FDE8E8', borderRadius: 10, padding: '11px 14px', marginBottom: 16 }}>
            <p style={{ fontSize: 13, color: S.red, margin: 0 }}>Something went wrong. Please try again.</p>
          </div>
        )}

        {!declineOpen ? (
          <>
            <div style={{ background: S.cream, borderRadius: 12, padding: '14px 16px', marginBottom: 16, textAlign: 'left' }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: S.stone, letterSpacing: 1, textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Confirm delivery time</label>
              <select value={chosenTime} onChange={e => setChosenTime(e.target.value)}
                style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: `1.5px solid ${S.border}`, fontSize: 15, color: S.forest, background: S.white, outline: 'none', fontFamily: "'DM Sans', sans-serif", boxSizing: 'border-box' }}>
                {timeOptionsFor(data.meal_type, chosenTime).map(t => <option key={t} value={t}>{prettyTime(t, data.meal_type)}</option>)}
              </select>
              <p style={{ fontSize: 12, color: S.stone, margin: '8px 0 0', lineHeight: 1.5 }}>We&rsquo;ll aim to have it arrive around this time — change it if another works better.</p>
            </div>
            <button
              onClick={() => act('confirm')}
              disabled={phase === 'working'}
              style={{ width: '100%', padding: '15px', borderRadius: 12, border: 'none', background: S.sage, color: S.white, fontSize: 15, fontWeight: 600, cursor: phase === 'working' ? 'default' : 'pointer', fontFamily: "'DM Sans', sans-serif", marginBottom: 10, opacity: phase === 'working' ? 0.6 : 1 }}>
              {phase === 'working' ? 'One moment…' : 'Yes, please send it'}
            </button>
            <button
              onClick={() => setDeclineOpen(true)}
              disabled={phase === 'working'}
              style={{ width: '100%', padding: '14px', borderRadius: 12, border: `1.5px solid ${S.border}`, background: 'transparent', color: S.stone, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
              Not this time
            </button>
          </>
        ) : (
          <>
            <label style={{ fontSize: 12, fontWeight: 600, color: S.stone, letterSpacing: 1, textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
              A note back <span style={{ fontWeight: 300, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g. We&rsquo;re covered tonight — maybe next week?"
              rows={2}
              style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: `1.5px solid ${S.border}`, fontSize: 14, color: S.forest, outline: 'none', boxSizing: 'border-box', marginBottom: 12, fontFamily: "'DM Sans', sans-serif", resize: 'vertical' }} />
            <button
              onClick={() => act('decline')}
              disabled={phase === 'working'}
              style={{ width: '100%', padding: '14px', borderRadius: 12, border: 'none', background: S.forest, color: S.white, fontSize: 14, fontWeight: 600, cursor: phase === 'working' ? 'default' : 'pointer', fontFamily: "'DM Sans', sans-serif", marginBottom: 10, opacity: phase === 'working' ? 0.6 : 1 }}>
              {phase === 'working' ? 'One moment…' : 'Send my reply'}
            </button>
            <button
              onClick={() => setDeclineOpen(false)}
              disabled={phase === 'working'}
              style={{ width: '100%', padding: '12px', borderRadius: 12, border: 'none', background: 'transparent', color: S.stone, fontSize: 13, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
              ← Back
            </button>
          </>
        )}

        <p style={{ fontSize: 11.5, color: S.stone, textAlign: 'center', margin: '22px 0 0', lineHeight: 1.5, opacity: 0.8 }}>
          You can also reply <strong style={{ color: S.sage }}>Y</strong> or <strong style={{ color: S.sage }}>N</strong> to the text message we sent.
        </p>
      </div>
    </div>
  )
}

'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const S = {
  sage: '#3D6B4F', sageMid: '#6B9E7E', sageLight: '#EAF2ED',
  cream: '#FAFAF5', forest: '#1E2620', stone: '#6B7066',
  border: '#DDE8E0', white: '#FFFFFF', amber: '#C17F47', red: '#B94040',
}

const MEAL_COLORS: Record<string, { color: string; bg: string; label: string }> = {
  breakfast: { color: '#E8834A', bg: '#FFF0E8', label: '🌅 Breakfast' },
  lunch: { color: '#4A8FA8', bg: '#E8F4F8', label: '☀️ Lunch' },
  dinner: { color: '#3D6B4F', bg: '#EAF2ED', label: '🌙 Dinner' },
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  available: { label: 'OPEN', color: S.sage },
  claimed: { label: 'CLAIMED', color: S.amber },
  confirmed: { label: 'CONFIRMED', color: '#4A8FA8' },
  expired: { label: 'EXPIRED', color: S.stone },
}

type CalDate = { id: string; date: string; meal_type: string; status: string; delivery_window_start: string; delivery_window_end: string }

export default function CalendarPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [kitchenId, setKitchenId] = useState('')
  const [dates, setDates] = useState<CalDate[]>([])
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [newDate, setNewDate] = useState('')
  const [newMealType, setNewMealType] = useState('dinner')
  const [error, setError] = useState('')

  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const todayStr = today.toISOString().split('T')[0]
  const monthName = new Date(viewYear, viewMonth, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const firstDay = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()

  const prevMonth = () => { if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) } else setViewMonth(m => m - 1) }
  const nextMonth = () => { if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) } else setViewMonth(m => m + 1) }

  const cells: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: kitchen } = await supabase
        .from('kitchens').select('id').eq('organizer_id', user.id).single()
      if (!kitchen) { router.push('/dashboard'); return }

      setKitchenId(kitchen.id)
      await loadDates(kitchen.id)
      setLoading(false)
    }
    load()
  }, [])

  const loadDates = async (kid: string) => {
    const { data } = await supabase
      .from('calendar_dates')
      .select('id, date, meal_type, status, delivery_window_start, delivery_window_end')
      .eq('kitchen_id', kid)
      .gte('date', todayStr)
      .order('date', { ascending: true })
    setDates(data || [])
  }

  const addDate = async () => {
    if (!newDate) return
    setAdding(true)
    setError('')
    const res = await fetch('/api/calendar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kitchen_id: kitchenId, date: newDate, meal_type: newMealType }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Failed to add date'); setAdding(false); return }
    await loadDates(kitchenId)
    setNewDate('')
    setShowAdd(false)
    setAdding(false)
  }

  const removeDate = async (dateId: string) => {
    setDeleting(dateId)
    const res = await fetch('/api/calendar', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date_id: dateId }),
    })
    if (res.ok) { setDates(prev => prev.filter(d => d.id !== dateId)) }
    setDeleting(null)
  }

  const dateMap: Record<string, CalDate[]> = {}
  dates.forEach(d => { if (!dateMap[d.date]) dateMap[d.date] = []; dateMap[d.date].push(d) })

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00')
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  const upcoming = dates.filter(d => d.date >= todayStr)
  const byStatus = { available: upcoming.filter(d => d.status === 'available'), claimed: upcoming.filter(d => d.status === 'claimed'), confirmed: upcoming.filter(d => d.status === 'confirmed') }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: S.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans', sans-serif" }}>
      <p style={{ color: S.stone, fontSize: 14 }}>Loading calendar…</p>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: S.cream, fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />

      <nav style={{ background: S.white, borderBottom: `0.5px solid ${S.border}`, padding: '14px 28px', display: 'flex', alignItems: 'center', gap: 14, position: 'sticky', top: 0, zIndex: 100 }}>
        <button onClick={() => router.push('/dashboard')} style={{ background: 'none', border: `1.5px solid ${S.border}`, borderRadius: 9, width: 34, height: 34, cursor: 'pointer', fontSize: 16, color: S.stone, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
        <div>
          <div style={{ fontSize: 8, fontWeight: 500, letterSpacing: 5, color: S.sageMid, textTransform: 'uppercase' }}>Your</div>
          <div style={{ fontFamily: "'Lora', serif", fontSize: 20, fontWeight: 500, color: S.forest, letterSpacing: -0.5 }}>Kitchen</div>
        </div>
      </nav>

      <div style={{ maxWidth: 580, margin: '0 auto', padding: '32px 24px 80px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 28 }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: S.sage, margin: '0 0 6px' }}>My Kitchen</p>
            <h1 style={{ fontFamily: "'Lora', serif", fontSize: 26, fontWeight: 500, color: S.forest, margin: 0, letterSpacing: -0.5 }}>My Calendar</h1>
          </div>
          <button onClick={() => setShowAdd(!showAdd)} style={{ background: S.forest, color: S.white, border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
            + Add Date
          </button>
        </div>

        {/* Add date panel */}
        {showAdd && (
          <div style={{ background: S.white, border: `1.5px solid ${S.sage}`, borderRadius: 14, padding: '20px', marginBottom: 20 }}>
            <p style={{ fontFamily: "'Lora', serif", fontSize: 16, fontWeight: 500, color: S.forest, margin: '0 0 16px' }}>Add an open date</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={labelStyle}>Date</label>
                <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} min={todayStr}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 9, border: `1.5px solid ${S.border}`, fontSize: 14, fontFamily: "'DM Sans', sans-serif", boxSizing: 'border-box' as const }} />
              </div>
              <div>
                <label style={labelStyle}>Meal type</label>
                <select value={newMealType} onChange={e => setNewMealType(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 9, border: `1.5px solid ${S.border}`, fontSize: 14, fontFamily: "'DM Sans', sans-serif" }}>
                  <option value="breakfast">🌅 Breakfast</option>
                  <option value="lunch">☀️ Lunch</option>
                  <option value="dinner">🌙 Dinner</option>
                </select>
              </div>
            </div>
            {error && <p style={{ color: S.red, fontSize: 12, margin: '0 0 12px' }}>{error}</p>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setShowAdd(false); setError('') }} style={{ flex: 1, padding: '11px', background: 'transparent', color: S.stone, border: `1.5px solid ${S.border}`, borderRadius: 9, fontSize: 13, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>Cancel</button>
              <button onClick={addDate} disabled={!newDate || adding}
                style={{ flex: 2, padding: '11px', background: adding || !newDate ? S.border : S.sage, color: adding || !newDate ? S.stone : S.white, border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: !newDate || adding ? 'default' : 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                {adding ? 'Adding…' : 'Add to Calendar'}
              </button>
            </div>
          </div>
        )}

        {/* Calendar grid */}
        <div style={{ background: S.white, border: `0.5px solid ${S.border}`, borderRadius: 16, padding: '18px', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <button onClick={prevMonth} style={{ background: S.sageLight, border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', fontSize: 16, color: S.sage, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
            <p style={{ fontFamily: "'Lora', serif", fontSize: 15, fontWeight: 500, color: S.forest, margin: 0 }}>{monthName}</p>
            <button onClick={nextMonth} style={{ background: S.sageLight, border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', fontSize: 16, color: S.sage, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 4 }}>
            {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: S.stone, padding: '2px 0' }}>{d}</div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
            {cells.map((day, i) => {
              if (!day) return <div key={i} />
              const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const slots = dateMap[dateStr] || []
              const isPast = dateStr < todayStr
              const isToday = dateStr === todayStr
              return (
                <div key={i} style={{
                  background: slots.length > 0 ? '#F8FAF8' : S.white,
                  border: `${isToday ? 2 : 1}px solid ${isToday ? S.sage : slots.length > 0 ? '#C8DDD0' : S.border}`,
                  borderRadius: 9, padding: '7px 2px', minHeight: 46,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: 2, opacity: isPast ? 0.4 : 1,
                }}>
                  <span style={{ fontSize: 12, fontWeight: isToday ? 700 : 500, color: S.forest, lineHeight: 1 }}>{day}</span>
                  {slots.length > 0 && (
                    <div style={{ display: 'flex', gap: 2 }}>
                      {slots.map((s, si) => {
                        const mc = MEAL_COLORS[s.meal_type] || MEAL_COLORS.dinner
                        return <div key={si} style={{ width: 5, height: 5, borderRadius: '50%', background: mc.color }} />
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: 14, marginTop: 12, paddingTop: 12, borderTop: `0.5px solid ${S.border}` }}>
            {Object.entries(MEAL_COLORS).map(([k, v]) => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: v.color }} />
                <span style={{ fontSize: 10, color: S.stone, fontWeight: 500 }}>{v.label.split(' ')[1]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming dates list */}
        {Object.entries(byStatus).map(([status, items]) => items.length === 0 ? null : (
          <div key={status} style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: STATUS_LABELS[status]?.color || S.stone, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 10px' }}>
              {status.charAt(0).toUpperCase() + status.slice(1)} ({items.length})
            </p>
            {items.map(d => {
              const mc = MEAL_COLORS[d.meal_type] || MEAL_COLORS.dinner
              const st = STATUS_LABELS[d.status]
              return (
                <div key={d.id} style={{ background: S.white, border: `0.5px solid ${S.border}`, borderRadius: 12, padding: '12px 16px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ background: mc.bg, color: mc.color, fontSize: 9, fontWeight: 700, padding: '3px 9px', borderRadius: 20 }}>{mc.label}</span>
                  <span style={{ fontSize: 14, fontWeight: 500, color: S.forest, flex: 1 }}>{formatDate(d.date)}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: st?.color || S.stone, letterSpacing: '0.05em' }}>{st?.label}</span>
                  {d.status === 'available' && (
                    <button onClick={() => removeDate(d.id)} disabled={deleting === d.id}
                      style={{ background: 'none', border: `1px solid #EEE`, borderRadius: 7, padding: '4px 10px', fontSize: 11, color: S.stone, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                      {deleting === d.id ? '…' : 'Remove'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        ))}

        {upcoming.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 24px', background: S.white, borderRadius: 16, border: `0.5px solid ${S.border}` }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📅</div>
            <p style={{ fontFamily: "'Lora', serif", fontSize: 17, color: S.forest, margin: '0 0 8px' }}>No upcoming dates</p>
            <p style={{ fontSize: 13, color: S.stone, fontWeight: 300, margin: '0 0 16px' }}>Add open dates so your village can claim them.</p>
            <button onClick={() => setShowAdd(true)} style={{ background: S.sage, color: S.white, border: 'none', borderRadius: 9, padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>+ Add First Date</button>
          </div>
        )}
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = { fontSize: 10, fontWeight: 600, color: '#6B7066', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }

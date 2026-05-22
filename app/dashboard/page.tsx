'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const S = {
  sage: '#3D6B4F', sageMid: '#6B9E7E', sageLight: '#EAF2ED',
  cream: '#FAFAF5', forest: '#1E2620', stone: '#6B7066',
  border: '#DDE8E0', white: '#FFFFFF', amber: '#C17F47',
  amberLight: '#FFF8E8', red: '#B94040',
}

const MEAL_COLORS: Record<string, { color: string; bg: string; label: string; emoji: string }> = {
  breakfast: { color: '#E8834A', bg: '#FFF0E8', label: 'Breakfast', emoji: '🌅' },
  lunch:     { color: '#4A8FA8', bg: '#E8F4F8', label: 'Lunch',     emoji: '☀️' },
  dinner:    { color: '#3D6B4F', bg: '#EAF2ED', label: 'Dinner',    emoji: '🌙' },
}

type CalDate = { id: string; date: string; meal_type: string; status: string }
type Proposal = { id: string; coordinator_name: string; restaurant_name: string; meal_name: string; delivery_date: string; meal_type: string }
type Kitchen = { id: string; name: string; slug: string }

export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [userName, setUserName] = useState('')
  const [kitchen, setKitchen] = useState<Kitchen | null>(null)
  const [calDates, setCalDates] = useState<CalDate[]>([])
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [copied, setCopied] = useState(false)

  // Calendar state
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const todayStr = today.toISOString().split('T')[0]

  // Add-date modal
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [addingMealType, setAddingMealType] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')

  const monthName = new Date(viewYear, viewMonth, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const firstDay = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const prevMonth = () => { if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) } else setViewMonth(m => m - 1) }
  const nextMonth = () => { if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) } else setViewMonth(m => m + 1) }

  const cells: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const loadCalDates = useCallback(async (kitchenId: string) => {
    const { data } = await supabase
      .from('calendar_dates')
      .select('id, date, meal_type, status')
      .eq('kitchen_id', kitchenId)
      .gte('date', todayStr)
      .order('date', { ascending: true })
    setCalDates(data || [])
  }, [])

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
      setUserName(profile?.full_name?.split(' ')[0] || 'there')

      const { data: kitchenData } = await supabase
        .from('kitchens').select('id, name, slug').eq('organizer_id', user.id).single()

      if (kitchenData) {
        setKitchen(kitchenData)
        await loadCalDates(kitchenData.id)

        const { data: proposalData } = await supabase
          .from('meal_proposals')
          .select('id, coordinator_name, restaurant_name, meal_name, delivery_date, meal_type, status')
          .eq('kitchen_id', kitchenData.id)
          .eq('status', 'pending')
          .order('delivery_date', { ascending: true })
        setProposals(proposalData || [])
      }
      setLoading(false)
    }
    load()
  }, [])

  // Date map for calendar
  const dateMap: Record<string, CalDate[]> = {}
  calDates.forEach(d => { if (!dateMap[d.date]) dateMap[d.date] = []; dateMap[d.date].push(d) })

  const kitchenUrl = kitchen ? `https://yourkitchen.app/k/${kitchen.slug}` : ''

  const copyLink = async () => {
    if (!kitchenUrl) return
    try {
      await navigator.clipboard.writeText(kitchenUrl)
    } catch {
      // fallback
      const ta = document.createElement('textarea')
      ta.value = kitchenUrl; ta.style.position = 'fixed'; ta.style.opacity = '0'
      document.body.appendChild(ta); ta.select(); document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const shareLink = async () => {
    if (!kitchen) return
    if (navigator.share) {
      try { await navigator.share({ title: kitchen.name, text: 'Send me a meal through YourKitchen', url: kitchenUrl }) } catch { /* cancelled */ }
    } else {
      copyLink()
    }
  }

  const handleDateClick = (dateStr: string) => {
    if (dateStr < todayStr) return
    setSelectedDate(dateStr)
    setAddingMealType(null)
    setAddError('')
  }

  const handleAddMealSlot = async (mealType: string) => {
    if (!kitchen || !selectedDate) return
    setAdding(true); setAddError('')
    const res = await fetch('/api/calendar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kitchen_id: kitchen.id, date: selectedDate, meal_type: mealType }),
    })
    const data = await res.json()
    if (!res.ok) { setAddError(data.error || 'Could not add that slot'); setAdding(false); return }
    await loadCalDates(kitchen.id)
    setAddingMealType(mealType)
    setAdding(false)
  }

  const handleRemoveSlot = async (dateId: string) => {
    await fetch('/api/calendar', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date_id: dateId }),
    })
    if (kitchen) await loadCalDates(kitchen.id)
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00')
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  }

  const initials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  if (loading) return (
    <div style={{ minHeight: '100vh', background: S.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans', sans-serif" }}>
      <p style={{ color: S.stone, fontSize: 14 }}>Loading your Kitchen…</p>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: S.cream, fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />

      {/* Nav — Settings removed, only sign out */}
      <nav style={{ background: S.white, borderBottom: `0.5px solid ${S.border}`, padding: '14px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
          <span style={{ fontSize: 8, fontWeight: 500, letterSpacing: 5, color: S.sageMid, textTransform: 'uppercase' }}>Your</span>
          <span style={{ fontFamily: "'Lora', serif", fontSize: 20, fontWeight: 500, color: S.forest, letterSpacing: -0.5 }}>Kitchen</span>
        </div>
        <button onClick={async () => { await supabase.auth.signOut(); router.push('/login') }}
          style={{ background: 'none', border: 'none', fontSize: 13, fontWeight: 500, color: S.stone, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
          Sign out
        </button>
      </nav>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '28px 24px 80px' }}>

        {/* Greeting */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <p style={{ fontSize: 13, color: S.stone, fontWeight: 300, margin: '0 0 3px' }}>Welcome back,</p>
            <h1 style={{ fontFamily: "'Lora', serif", fontSize: 28, fontWeight: 500, color: S.forest, margin: 0, letterSpacing: -0.5 }}>{userName} 👋</h1>
          </div>
          <div style={{ width: 44, height: 44, borderRadius: 13, background: S.sage, display: 'flex', alignItems: 'center', justifyContent: 'center', color: S.white, fontWeight: 700, fontSize: 15 }}>
            {initials(userName)}
          </div>
        </div>

        {/* NO KITCHEN STATE */}
        {!kitchen && (
          <div style={{ background: S.forest, borderRadius: 20, padding: '32px', textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 14 }}>🥗</div>
            <h2 style={{ fontFamily: "'Lora', serif", fontSize: 22, fontWeight: 500, color: S.white, margin: '0 0 10px' }}>Set up your Kitchen</h2>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.65)', fontWeight: 300, lineHeight: 1.7, margin: '0 0 22px' }}>Add restaurants, set your calendar, and share your link.</p>
            <button onClick={() => router.push('/kitchen/setup')}
              style={{ background: S.sage, color: S.white, border: 'none', borderRadius: 12, padding: '13px 28px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
              Set Up My Kitchen →
            </button>
          </div>
        )}

        {kitchen && (
          <>
            {/* Pending proposals */}
            {proposals.length > 0 && proposals.map(p => (
              <div key={p.id} style={{ background: S.forest, borderRadius: 18, padding: '18px 20px', marginBottom: 16 }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: S.amber, borderRadius: 20, padding: '3px 10px', fontSize: 9, fontWeight: 700, color: S.white, letterSpacing: '0.06em', marginBottom: 10 }}>ACTION NEEDED</div>
                <div style={{ fontFamily: "'Lora', serif", fontSize: 17, color: S.white, fontWeight: 500, margin: '0 0 4px' }}>{p.coordinator_name} wants to send you dinner</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 14, fontWeight: 300 }}>
                  {MEAL_COLORS[p.meal_type]?.emoji} {p.meal_name} · {p.restaurant_name}
                </div>
                <button onClick={() => router.push(`/proposals/${p.id}`)}
                  style={{ width: '100%', background: S.sage, color: S.white, border: 'none', borderRadius: 11, padding: '12px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                  Review Proposal →
                </button>
              </div>
            ))}

            {/* Share link */}
            <div style={{ background: S.white, border: `0.5px dashed ${S.sageMid}`, borderRadius: 16, padding: '16px 20px', marginBottom: 20 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: S.stone, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 6px' }}>Your Kitchen Link</p>
              <div style={{ fontFamily: 'monospace', fontSize: 13, color: S.sage, marginBottom: 12, wordBreak: 'break-all' }}>
                yourkitchen.app/k/{kitchen.slug}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={copyLink} style={{ flex: 1, padding: '10px', background: copied ? S.sage : S.forest, color: S.white, border: 'none', borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", transition: 'background 0.2s' }}>
                  {copied ? '✓ Copied!' : 'Copy Link'}
                </button>
                <button onClick={shareLink} style={{ padding: '10px 16px', background: S.sageLight, color: S.sage, border: 'none', borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                  Share
                </button>
              </div>
            </div>

            {/* Full Calendar */}
            <div style={{ background: S.white, border: `0.5px solid ${S.border}`, borderRadius: 16, padding: '18px', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <p style={{ fontFamily: "'Lora', serif", fontSize: 16, fontWeight: 500, color: S.forest, margin: 0 }}>My Calendar</p>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={prevMonth} style={{ background: S.sageLight, border: 'none', borderRadius: 7, width: 30, height: 30, cursor: 'pointer', fontSize: 15, color: S.sage, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
                  <span style={{ fontSize: 13, fontWeight: 500, color: S.forest, alignSelf: 'center', minWidth: 110, textAlign: 'center' }}>{monthName}</span>
                  <button onClick={nextMonth} style={{ background: S.sageLight, border: 'none', borderRadius: 7, width: 30, height: 30, cursor: 'pointer', fontSize: 15, color: S.sage, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
                </div>
              </div>

              {/* Day headers */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 4 }}>
                {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
                  <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: S.stone, padding: '2px 0' }}>{d}</div>
                ))}
              </div>

              {/* Calendar grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
                {cells.map((day, i) => {
                  if (!day) return <div key={i} />
                  const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                  const isPast = dateStr < todayStr
                  const isToday = dateStr === todayStr
                  const slots = dateMap[dateStr] || []
                  const isSelected = selectedDate === dateStr
                  return (
                    <button key={i}
                      onClick={() => handleDateClick(dateStr)}
                      disabled={isPast}
                      style={{
                        background: isSelected ? S.sageLight : slots.length > 0 ? '#F8FAF8' : S.white,
                        border: `${isSelected || isToday ? 2 : 1}px solid ${isSelected ? S.sage : isToday ? S.sageMid : slots.length > 0 ? '#C8DDD0' : S.border}`,
                        borderRadius: 9, padding: '8px 2px', minHeight: 54,
                        cursor: isPast ? 'default' : 'pointer',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        gap: 3, fontFamily: "'DM Sans', sans-serif",
                        opacity: isPast ? 0.35 : 1, transition: 'all 0.1s',
                      }}>
                      <span style={{ fontSize: 13, fontWeight: isToday ? 700 : 500, color: isSelected ? S.sage : S.forest, lineHeight: 1 }}>{day}</span>
                      {slots.length > 0 && (
                        <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
                          {slots.map((s, si) => {
                            const mc = MEAL_COLORS[s.meal_type] || MEAL_COLORS.dinner
                            return <div key={si} style={{ width: 6, height: 6, borderRadius: '50%', background: mc.color }} />
                          })}
                        </div>
                      )}
                      {slots.length === 0 && !isPast && (
                        <div style={{ fontSize: 14, color: '#DDE8E0', lineHeight: 1 }}>+</div>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Legend */}
              <div style={{ display: 'flex', gap: 14, marginTop: 12, paddingTop: 12, borderTop: `0.5px solid ${S.border}`, flexWrap: 'wrap' }}>
                {Object.entries(MEAL_COLORS).map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: v.color }} />
                    <span style={{ fontSize: 10, color: S.stone, fontWeight: 500 }}>{v.emoji} {v.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Add-date modal panel */}
            {selectedDate && (
              <div style={{ background: S.white, border: `2px solid ${S.sage}`, borderRadius: 16, padding: '18px 20px', marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: S.sage, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 2px' }}>Selected</p>
                    <p style={{ fontFamily: "'Lora', serif", fontSize: 16, fontWeight: 500, color: S.forest, margin: 0 }}>{formatDate(selectedDate)}</p>
                  </div>
                  <button onClick={() => setSelectedDate(null)} style={{ background: 'none', border: 'none', fontSize: 18, color: S.stone, cursor: 'pointer', padding: 4 }}>✕</button>
                </div>

                {/* Existing slots for this date */}
                {(dateMap[selectedDate] || []).length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <p style={{ fontSize: 11, fontWeight: 600, color: S.stone, letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 8px' }}>Open slots</p>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {(dateMap[selectedDate] || []).map(slot => {
                        const mc = MEAL_COLORS[slot.meal_type] || MEAL_COLORS.dinner
                        return (
                          <div key={slot.id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: mc.bg, border: `1px solid ${mc.color}`, borderRadius: 20, padding: '5px 12px 5px 10px' }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: mc.color }}>{mc.emoji} {mc.label}</span>
                            {slot.status === 'available' && (
                              <button onClick={() => handleRemoveSlot(slot.id)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: mc.color, fontSize: 13, padding: 0, lineHeight: 1, marginLeft: 2 }}>✕</button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Add meal type buttons */}
                <p style={{ fontSize: 11, fontWeight: 600, color: S.stone, letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 10px' }}>
                  {(dateMap[selectedDate] || []).length > 0 ? 'Add another slot' : 'Add a meal slot'}
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {Object.entries(MEAL_COLORS).map(([type, mc]) => {
                    const alreadyHas = (dateMap[selectedDate] || []).some(s => s.meal_type === type)
                    return (
                      <button key={type}
                        onClick={() => !alreadyHas && handleAddMealSlot(type)}
                        disabled={alreadyHas || adding}
                        style={{
                          background: alreadyHas ? '#F5F5F5' : adding ? '#EEE' : mc.bg,
                          border: `1.5px solid ${alreadyHas ? '#DDD' : mc.color}`,
                          borderRadius: 10, padding: '12px 8px', cursor: alreadyHas || adding ? 'default' : 'pointer',
                          opacity: alreadyHas ? 0.5 : 1, fontFamily: "'DM Sans', sans-serif",
                        }}>
                        <div style={{ fontSize: 18, marginBottom: 4 }}>{mc.emoji}</div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: alreadyHas ? S.stone : mc.color }}>
                          {alreadyHas ? '✓ Added' : mc.label}
                        </div>
                      </button>
                    )
                  })}
                </div>
                {addError && <p style={{ fontSize: 12, color: S.red, margin: '10px 0 0' }}>{addError}</p>}
                {adding && <p style={{ fontSize: 12, color: S.stone, margin: '10px 0 0', fontWeight: 300 }}>Adding slot…</p>}
              </div>
            )}

            {/* Quick Actions — Settings stays here, removed from nav */}
            <p style={{ fontFamily: "'Lora', serif", fontSize: 17, fontWeight: 500, color: S.forest, margin: '0 0 12px' }}>Quick Actions</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { icon: '🏪', label: 'My Restaurants', path: '/kitchen/restaurants' },
                { icon: '📋', label: 'Order History',  path: '/kitchen/orders' },
                { icon: '⚙️', label: 'Settings',       path: '/settings' },
                { icon: '🔗', label: 'My Kitchen Link', action: copyLink },
              ].map(a => (
                <button key={a.label}
                  onClick={() => a.action ? a.action() : router.push(a.path!)}
                  style={{ background: S.white, border: `0.5px solid ${S.border}`, borderRadius: 14, padding: '16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                  <span style={{ fontSize: 22 }}>{a.icon}</span>
                  <span style={{ fontSize: 13, fontWeight: 500, color: S.forest }}>{a.label}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

'use client'
// FILE: app/k/[slug]/client.tsx
// Changes from original:
//   1. "Create a free Kitchen" CTA added below the kitchen name header
//      (visible on all steps, not just step 1)
//   2. Inline footer added at the very bottom of the page
//   No other logic changes.

import { useState } from 'react'

const MEAL_TYPE_RESTAURANTS: Record<string, string[]> = {
  breakfast: ['First Watch', 'The Toasted Yolk Cafe', 'Harvest Kitchen & Bakery'],
  lunch: ['Cava', 'The Kebab Shop', 'Mod Fresh', 'Harvest Kitchen & Bakery'],
  dinner: ['Cava', 'The Kebab Shop', 'Up Thai Kitchen'],
}
const MEAL_TYPE_LABELS: Record<string, string> = {
  breakfast: '🌅 Breakfast',
  lunch: '☀️ Lunch',
  dinner: '🌙 Dinner',
}
const MEAL_TYPE_COLORS: Record<string, { color: string; bg: string }> = {
  breakfast: { color: '#E8834A', bg: '#FFF0E8' },
  lunch:     { color: '#4A8FA8', bg: '#E8F4F8' },
  dinner:    { color: '#3D6B4F', bg: '#EAF2ED' },
}
const TIP_OPTIONS = [
  { label: 'No tip', value: 0 },
  { label: '$2',     value: 200 },
  { label: '$3',     value: 300 },
  { label: '$5',     value: 500 },
]

type Group = { mealType: string; slots: any[]; restaurant: any | null; menuItem: any | null }

function MealHistory({ meals, recipientFirstName }: { meals: any[]; recipientFirstName: string }) {
  const [expanded, setExpanded] = useState(false)
  if (!meals || meals.length === 0) return null

  const tally: Record<string, number> = {}
  meals.forEach(m => { tally[m.restaurant_name] = (tally[m.restaurant_name] || 0) + 1 })
  const sorted = Object.entries(tally).sort((a, b) => b[1] - a[1])
  const max = sorted[0]?.[1] || 1

  const formatDate = (d: string) =>
    new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  return (
    <div style={{ background: '#fff', border: '1px solid #DDE8E0', borderRadius: 14, marginBottom: 20, overflow: 'hidden' }}>
      <button
        onClick={() => setExpanded(e => !e)}
        style={{ width: '100%', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 16 }}>📋</span>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1E2620' }}>What {recipientFirstName} has already received</div>
            <div style={{ fontSize: 11, color: '#6B7066', fontWeight: 300, marginTop: 1 }}>{meals.length} meal{meals.length > 1 ? 's' : ''} in the last 30 days · tap to avoid repeats</div>
          </div>
        </div>
        <span style={{ fontSize: 14, color: '#6B7066', transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'none' }}>▾</span>
      </button>
      {expanded && (
        <div style={{ borderTop: '0.5px solid #DDE8E0', padding: '14px 16px' }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: '#6B7066', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 10px' }}>Restaurant frequency</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 16 }}>
            {sorted.map(([name, count]) => (
              <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 12, color: '#1E2620', fontWeight: 500, width: 140, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                <div style={{ flex: 1, height: 6, background: '#EAF2ED', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: '#3D6B4F', borderRadius: 3, width: `${(count / max) * 100}%`, transition: 'width 0.3s' }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#3D6B4F', width: 20, textAlign: 'right', flexShrink: 0 }}>{count}×</span>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 10, fontWeight: 700, color: '#6B7066', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 10px' }}>Recent meals</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {meals.map((m, i) => {
              const mc = MEAL_TYPE_COLORS[m.meal_type] || MEAL_TYPE_COLORS.dinner
              return (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: i < meals.length - 1 ? '0.5px solid #EAF2ED' : 'none' }}>
                  <span style={{ background: mc.bg, color: mc.color, fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 20, flexShrink: 0 }}>{MEAL_TYPE_LABELS[m.meal_type]?.split(' ')[1] || m.meal_type}</span>
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: '#1E2620', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.meal_name}</div>
                    <div style={{ fontSize: 11, color: '#6B7066', fontWeight: 300 }}>{m.restaurant_name}</div>
                  </div>
                  <span style={{ fontSize: 11, color: '#6B7066', fontWeight: 300, flexShrink: 0 }}>{formatDate(m.delivery_date)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function CoordCalendar({ availableDates, selectedIds, onToggle }: { availableDates: any[]; selectedIds: Set<string>; onToggle: (slot: any) => void }) {
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const todayStr = today.toISOString().split('T')[0]
  const monthName = new Date(viewYear, viewMonth, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const firstDay = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const prevMonth = () => { if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) } else setViewMonth(m => m - 1) }
  const nextMonth = () => { if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0)  } else setViewMonth(m => m + 1) }
  const dateMap: Record<string, any[]> = {}
  availableDates.forEach(d => { if (!dateMap[d.date]) dateMap[d.date] = []; dateMap[d.date].push(d) })
  const cells: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <div style={{ background: '#fff', border: '1px solid #DDE8E0', borderRadius: 16, padding: '16px', marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <button onClick={prevMonth} style={{ background: '#EAF2ED', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', fontSize: 16, color: '#3D6B4F', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
        <p style={{ fontFamily: "'Lora', serif", fontSize: 16, fontWeight: 500, color: '#1E2620', margin: 0 }}>{monthName}</p>
        <button onClick={nextMonth} style={{ background: '#EAF2ED', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', fontSize: 16, color: '#3D6B4F', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 3 }}>
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 600, color: '#6B7066', padding: '3px 0' }}>{d}</div>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
        {cells.map((day, i) => {
          if (!day) return <div key={i} />
          const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const isPast = dateStr < todayStr
          const isToday = dateStr === todayStr
          const slots = dateMap[dateStr] || []
          const hasSlots = slots.length > 0
          const isAnySelected = slots.some((s: any) => selectedIds.has(s.id))
          return (
            <button key={i}
              onClick={() => { if (!hasSlots || isPast) return; slots.forEach((s: any) => onToggle(s)) }}
              disabled={isPast || !hasSlots}
              style={{ background: isAnySelected ? '#EAF2ED' : hasSlots ? '#F8FAF8' : 'transparent', border: isToday ? '2px solid #3D6B4F' : isAnySelected ? '2px solid #3D6B4F' : hasSlots ? '1.5px solid #DDE8E0' : '1.5px solid transparent', borderRadius: 10, padding: '8px 2px', minHeight: 52, cursor: hasSlots && !isPast ? 'pointer' : 'default', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, fontFamily: "'DM Sans', sans-serif", opacity: isPast ? 0.35 : 1, transition: 'all 0.1s' }}>
              <span style={{ fontSize: 13, fontWeight: isToday ? 700 : 500, color: isPast ? '#C8D5CA' : isAnySelected ? '#3D6B4F' : '#1E2620', lineHeight: 1 }}>{day}</span>
              {hasSlots && (
                <div style={{ display: 'flex', gap: 2 }}>
                  {slots.map((slot: any, si: number) => {
                    const mc = MEAL_TYPE_COLORS[slot.meal_type] || MEAL_TYPE_COLORS.dinner
                    return <div key={si} style={{ width: 6, height: 6, borderRadius: '50%', background: selectedIds.has(slot.id) ? mc.color : '#C8D5CA', flexShrink: 0 }} />
                  })}
                </div>
              )}
            </button>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 14, paddingTop: 12, borderTop: '1px solid #EAF2ED' }}>
        {[{ dot: '#E8834A', label: 'Breakfast' }, { dot: '#4A8FA8', label: 'Lunch' }, { dot: '#3D6B4F', label: 'Dinner' }, { dot: '#C8D5CA', label: 'Not selected' }].map(({ dot, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: dot, flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: '#6B7066', fontWeight: 500 }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function SelectedDatesSummary({ selectedSlots, onRemove }: { selectedSlots: any[]; onRemove: (id: string) => void }) {
  if (selectedSlots.length === 0) return null
  return (
    <div style={{ background: '#EAF2ED', borderRadius: 14, padding: '14px 16px', marginBottom: 16 }}>
      <p style={{ fontSize: 11, fontWeight: 600, color: '#3D6B4F', letterSpacing: 1.5, textTransform: 'uppercase', margin: '0 0 10px' }}>{selectedSlots.length} date{selectedSlots.length > 1 ? 's' : ''} selected</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {selectedSlots.map((slot: any) => {
          const d  = new Date(slot.date + 'T12:00:00')
          const label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
          const mc = MEAL_TYPE_COLORS[slot.meal_type] || MEAL_TYPE_COLORS.dinner
          return (
            <div key={slot.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ background: mc.bg, color: mc.color, borderRadius: 20, fontSize: 10, fontWeight: 600, padding: '2px 8px', border: `1px solid ${mc.color}` }}>{MEAL_TYPE_LABELS[slot.meal_type] || slot.meal_type}</span>
                <span style={{ fontSize: 13, color: '#1E2620', fontWeight: 500 }}>{label}</span>
              </div>
              <button onClick={() => onRemove(slot.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7066', fontSize: 16, padding: '0 4px' }}>✕</button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function GroupProgress({ groups, currentIndex, subStep }: { groups: Group[]; currentIndex: number; subStep: 'restaurant' | 'meal' }) {
  if (groups.length <= 1) return null
  return (
    <div style={{ background: '#fff', border: '1px solid #DDE8E0', borderRadius: 12, padding: '12px 16px', marginBottom: 16 }}>
      <p style={{ fontSize: 11, fontWeight: 600, color: '#6B7066', letterSpacing: 1.5, textTransform: 'uppercase', margin: '0 0 10px' }}>Meal group {currentIndex + 1} of {groups.length}</p>
      <div style={{ display: 'flex', gap: 8 }}>
        {groups.map((g, i) => {
          const mc = MEAL_TYPE_COLORS[g.mealType] || MEAL_TYPE_COLORS.dinner
          const isDone = i < currentIndex; const isCurrent = i === currentIndex
          return (
            <div key={i} style={{ flex: 1 }}>
              <div style={{ height: 4, borderRadius: 4, background: isDone || isCurrent ? mc.color : '#DDE8E0', opacity: isCurrent ? 1 : isDone ? 1 : 0.4, transition: 'all 0.3s' }} />
              <p style={{ fontSize: 10, color: isCurrent ? mc.color : '#6B7066', fontWeight: isCurrent ? 600 : 400, margin: '4px 0 0', textAlign: 'center' }}>{MEAL_TYPE_LABELS[g.mealType]}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── NEW: inline footer ─────────────────────────────────────────────────────────
function CoordFooter() {
  return (
    <footer style={{ background: '#1E2620', padding: '48px 24px', textAlign: 'center', marginTop: 40, fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ fontSize: 9, fontWeight: 500, letterSpacing: 5, color: '#6B9E7E', textTransform: 'uppercase', marginBottom: 2 }}>Your</div>
      <div style={{ fontFamily: "'Lora', serif", fontSize: 24, fontWeight: 500, color: '#fff', letterSpacing: -0.5, marginBottom: 8 }}>Kitchen</div>
      <p style={{ fontFamily: "'Lora', serif", fontStyle: 'italic', fontSize: 13, color: '#6B9E7E', margin: '0 0 20px' }}>"Your kitchen, covered."</p>
      <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '4px 0', fontSize: 11, marginBottom: 16 }}>
        {[
          { label: 'yourkitchen.app', href: 'https://yourkitchen.app' },
          { label: 'marques@yourkitchen.app', href: 'mailto:marques@yourkitchen.app' },
          { label: 'Terms', href: '/terms' },
          { label: 'Privacy', href: '/privacy' },
        ].map((link, i) => (
          <span key={link.label}>
            {i > 0 && <span style={{ color: 'rgba(255,255,255,0.25)', margin: '0 8px' }}>·</span>}
            <a href={link.href} style={{ color: 'rgba(255,255,255,0.3)', textDecoration: 'none' }}>{link.label}</a>
          </span>
        ))}
      </div>
      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.18)', margin: 0 }}>© 2026 YourKitchen LLC · All rights reserved</p>
    </footer>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function CoordKitchenClient({ kitchen, availableDates, restaurants, recentMeals = [] }: any) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [groups, setGroups] = useState<Group[]>([])
  const [currentGroupIndex, setCurrentGroupIndex] = useState(0)
  const [groupSubStep, setGroupSubStep] = useState<'restaurant' | 'meal'>('restaurant')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const [tipAmount, setTipAmount] = useState(300)
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const selectedSlots = availableDates.filter((d: any) => selectedIds.has(d.id))
  const recipientFirstName = kitchen.name?.split("'")[0] || 'them'

  const toggleSlot = (slot: any) => {
    setSelectedIds(prev => { const next = new Set(prev); if (next.has(slot.id)) next.delete(slot.id); else next.add(slot.id); return next })
  }
  const removeSlot = (id: string) => {
    setSelectedIds(prev => { const next = new Set(prev); next.delete(id); return next })
  }

  const buildGroups = (): Group[] => {
    const order = ['breakfast', 'lunch', 'dinner']
    const map: Record<string, any[]> = {}
    selectedSlots.forEach((s: any) => { const mt = s.meal_type || 'dinner'; if (!map[mt]) map[mt] = []; map[mt].push(s) })
    return order.filter(mt => map[mt]).map(mt => ({ mealType: mt, slots: map[mt], restaurant: null, menuItem: null }))
  }

  const handleProceedToGroups = () => {
    const g = buildGroups()
    setGroups(g); setCurrentGroupIndex(0); setGroupSubStep('restaurant'); setStep(2)
  }

  const currentGroup = groups[currentGroupIndex]
  const filteredRestaurants = currentGroup
    ? restaurants.filter((r: any) => (MEAL_TYPE_RESTAURANTS[currentGroup.mealType] || []).includes(r.name))
    : []

  const updateGroup = (index: number, update: Partial<Group>) => {
    setGroups(prev => prev.map((g, i) => i === index ? { ...g, ...update } : g))
  }
  const handleRestaurantSelect = (restaurant: any) => { updateGroup(currentGroupIndex, { restaurant, menuItem: null }); setGroupSubStep('meal') }
  const handleMealSelect = (menuItem: any) => { updateGroup(currentGroupIndex, { menuItem }) }
  const handleGroupNext = () => {
    if (currentGroupIndex < groups.length - 1) { setCurrentGroupIndex(i => i + 1); setGroupSubStep('restaurant') }
    else setStep(3)
  }
  const handleGroupBack = () => {
    if (groupSubStep === 'meal') setGroupSubStep('restaurant')
    else if (currentGroupIndex > 0) { setCurrentGroupIndex(i => i - 1); setGroupSubStep('meal') }
    else setStep(1)
  }

  const getNotePlaceholder = () => {
    const types = [...new Set(selectedSlots.map((s: any) => s.meal_type))]
    if (types.includes('breakfast') && types.includes('dinner')) return "Starting your day and ending it with a little love 🧡 Hope these meals bring you comfort."
    if (types.includes('breakfast')) return "Hope this breakfast starts your day with a little warmth from someone who cares 🌅"
    if (types.includes('lunch')) return "Thinking of you today — hope this lunch gives you a moment to breathe ☀️"
    return "Hope dinner tonight is one less thing to worry about. You've got people in your corner 🧡"
  }

  const handleSubmit = async () => {
    setLoading(true); setErrorMsg('')
    const proposals = groups.flatMap(g =>
      g.slots.map(slot => ({ calendar_date_id: slot.id, restaurant_id: g.restaurant.id, menu_item_id: g.menuItem.id }))
    )
    try {
      const res = await fetch('/api/proposal', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, note, proposals, kitchen_slug: kitchen.slug, tip_amount: tipAmount }),
      })
      const data = await res.json()
      if (!res.ok) { setErrorMsg(data.error || 'Something went wrong.'); setLoading(false); return }
      window.location.href = data.checkout_url
    } catch (err: any) {
      setErrorMsg('Network error. Please try again.'); setLoading(false)
    }
  }

  const totalDates = groups.reduce((sum, g) => sum + g.slots.length, 0)

  if (submitted) {
    return (
      <div style={{ minHeight: '100vh', background: '#FAFAF5', fontFamily: "'DM Sans', sans-serif", display: 'flex', flexDirection: 'column' }}>
        <link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 32px' }}>
          <div style={{ textAlign: 'center', maxWidth: 420 }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>📨</div>
            <h1 style={{ fontFamily: "'Lora', serif", fontSize: 28, fontWeight: 500, color: '#1E2620', margin: '0 0 12px' }}>
              {totalDates > 1 ? `${totalDates} proposals sent!` : 'Proposal sent!'}
            </h1>
            <p style={{ fontSize: 15, color: '#6B7066', lineHeight: 1.7, margin: '0 0 24px', fontWeight: 300 }}>
              {recipientFirstName} will get a notification to confirm each one. Thank you. 🧡
            </p>
            <div style={{ background: '#fff', border: '1px solid #DDE8E0', borderRadius: 16, padding: '20px', textAlign: 'left', marginBottom: 24 }}>
              {groups.map((g, i) => {
                const mc = MEAL_TYPE_COLORS[g.mealType] || MEAL_TYPE_COLORS.dinner
                return (
                  <div key={g.mealType} style={{ paddingBottom: i < groups.length - 1 ? 12 : 0, marginBottom: i < groups.length - 1 ? 12 : 0, borderBottom: i < groups.length - 1 ? '1px solid #EAF2ED' : 'none' }}>
                    <span style={{ background: mc.bg, color: mc.color, borderRadius: 20, fontSize: 11, fontWeight: 600, padding: '3px 10px', border: `1px solid ${mc.color}`, display: 'inline-block', marginBottom: 6 }}>
                      {MEAL_TYPE_LABELS[g.mealType]} · {g.slots.length} date{g.slots.length > 1 ? 's' : ''}
                    </span>
                    <div style={{ fontSize: 13, color: '#1E2620', fontWeight: 500 }}>{g.menuItem?.name}</div>
                    <div style={{ fontSize: 12, color: '#6B7066', fontWeight: 300 }}>{g.restaurant?.name}</div>
                  </div>
                )
              })}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 12 }}>
                <span style={{ fontSize: 13, color: '#6B7066', fontWeight: 300 }}>Status</span>
                <span style={{ fontSize: 13, color: '#1E2620', fontWeight: 500 }}>⏳ Awaiting confirmation</span>
              </div>
            </div>
            <div style={{ background: '#1E2620', borderRadius: 16, padding: '20px 24px', textAlign: 'left' }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#6B9E7E', letterSpacing: 1.5, textTransform: 'uppercase', margin: '0 0 8px' }}>Know someone who needs this?</p>
              <p style={{ fontFamily: "'Lora', serif", fontSize: 17, fontWeight: 500, color: '#fff', margin: '0 0 6px' }}>Set up a free Kitchen for them.</p>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', margin: '0 0 16px', fontWeight: 300, lineHeight: 1.6 }}>New baby, illness, loss — if someone you love needs their village to show up, YourKitchen makes it easy.</p>
              <a href="/signup" style={{ display: 'block', background: '#3D6B4F', color: '#fff', borderRadius: 10, padding: '13px', textAlign: 'center', fontSize: 14, fontWeight: 500, textDecoration: 'none', fontFamily: "'DM Sans', sans-serif" }}>
                Start a free Kitchen →
              </a>
            </div>
          </div>
        </div>
        <CoordFooter />
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF5', fontFamily: "'DM Sans', sans-serif", display: 'flex', flexDirection: 'column' }}>
      <link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ background: '#1E2620', padding: '20px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 9, fontWeight: 500, letterSpacing: 5, color: '#6B9E7E', textTransform: 'uppercase' }}>Your</div>
        <div style={{ fontFamily: "'Lora', serif", fontSize: 24, fontWeight: 500, color: '#fff' }}>Kitchen</div>
      </div>

      {/* Kitchen name + restrictions */}
      <div style={{ background: '#fff', borderBottom: '1px solid #DDE8E0', padding: '20px 24px', textAlign: 'center' }}>
        <h1 style={{ fontFamily: "'Lora', serif", fontSize: 22, fontWeight: 500, color: '#1E2620', margin: '0 0 4px' }}>{kitchen.name}</h1>
        {kitchen.dietary_restrictions?.length > 0 && (
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap', marginTop: 10 }}>
            {kitchen.dietary_restrictions.map((d: string) => (
              <span key={d} style={{ background: '#EAF2ED', color: '#3D6B4F', borderRadius: 20, fontSize: 11, fontWeight: 500, padding: '4px 12px' }}>⚠️ {d}</span>
            ))}
          </div>
        )}

        {/* ── NEW: "Create a free Kitchen" CTA — visible on all steps ── */}
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '0.5px solid #DDE8E0' }}>
          <p style={{ fontSize: 12, color: '#6B7066', fontWeight: 300, margin: '0 0 8px' }}>
            Does someone you love need their village to show up?
          </p>
          <a
            href="/signup"
            style={{ display: 'inline-block', background: '#1E2620', color: '#fff', borderRadius: 10, padding: '9px 20px', fontSize: 12, fontWeight: 500, textDecoration: 'none', fontFamily: "'DM Sans', sans-serif" }}
          >
            Create a free Kitchen →
          </a>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ display: 'flex', gap: 6, padding: '20px 24px 0', maxWidth: 500, margin: '0 auto', width: '100%' }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ flex: 1, height: 4, borderRadius: 4, background: i <= step ? '#3D6B4F' : '#DDE8E0', transition: 'background 0.3s' }} />
        ))}
      </div>

      <div style={{ padding: '24px', maxWidth: 500, margin: '0 auto', flex: 1, width: '100%' }}>

        {/* Step 1 */}
        {step === 1 && (<>
          <h2 style={h2Style}>Choose your dates</h2>
          <p style={subStyle}>Tap any highlighted date to claim it. You can select multiple.</p>
          <MealHistory meals={recentMeals} recipientFirstName={recipientFirstName} />
          {availableDates.length === 0 ? (
            <div style={{ background: '#EAF2ED', borderRadius: 14, padding: '20px', textAlign: 'center', marginBottom: 20 }}>
              <p style={{ color: '#3D6B4F', margin: 0 }}>No open dates right now. Check back soon!</p>
            </div>
          ) : (
            <CoordCalendar availableDates={availableDates} selectedIds={selectedIds} onToggle={toggleSlot} />
          )}
          <SelectedDatesSummary selectedSlots={selectedSlots} onRemove={removeSlot} />
          <button onClick={handleProceedToGroups} disabled={selectedSlots.length === 0} style={btnStyle(selectedSlots.length === 0)}>
            {selectedSlots.length === 0 ? 'Select at least one date' : `Next: Choose Meals → (${selectedSlots.length} date${selectedSlots.length > 1 ? 's' : ''})`}
          </button>
        </>)}

        {/* Step 2 */}
        {step === 2 && currentGroup && (<>
          <GroupProgress groups={groups} currentIndex={currentGroupIndex} subStep={groupSubStep} />
          {groupSubStep === 'restaurant' && (<>
            <h2 style={h2Style}>{groups.length > 1 ? `Choose a ${currentGroup.mealType} restaurant` : 'Choose a restaurant'}</h2>
            <p style={subStyle}>
              {groups.length > 1
                ? `For your ${MEAL_TYPE_LABELS[currentGroup.mealType].toLowerCase()} date${currentGroup.slots.length > 1 ? 's' : ''} — ${currentGroup.slots.map((s: any) => new Date(s.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })).join(', ')}`
                : `${recipientFirstName}'s preferred restaurants — all delivered via DoorDash.`}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
              {filteredRestaurants.map((r: any) => (
                <button key={r.id} onClick={() => handleRestaurantSelect(r)} style={{ background: currentGroup.restaurant?.id === r.id ? '#EAF2ED' : '#fff', border: `2px solid ${currentGroup.restaurant?.id === r.id ? '#3D6B4F' : '#DDE8E0'}`, borderRadius: 16, padding: '14px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, fontFamily: "'DM Sans', sans-serif" }}>
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div style={{ fontFamily: "'Lora', serif", fontSize: 15, fontWeight: 600, color: '#1E2620' }}>{r.name}</div>
                    <div style={{ fontSize: 12, color: '#6B7066', fontWeight: 300, marginTop: 2 }}>{r.cuisine} · DoorDash</div>
                  </div>
                  {currentGroup.restaurant?.id === r.id && <span style={{ color: '#3D6B4F', fontSize: 20 }}>✓</span>}
                </button>
              ))}
            </div>
            <button onClick={handleGroupBack} style={backStyle}>← Back</button>
          </>)}
          {groupSubStep === 'meal' && (<>
            <h2 style={h2Style}>Select a meal</h2>
            <p style={subStyle}>⭐ starred items are {recipientFirstName}&apos;s favorites.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
              {currentGroup.restaurant?.menu_items?.map((item: any) => (
                <button key={item.id} onClick={() => handleMealSelect(item)} style={{ background: currentGroup.menuItem?.id === item.id ? '#EAF2ED' : '#fff', border: `2px solid ${currentGroup.menuItem?.id === item.id ? '#3D6B4F' : '#DDE8E0'}`, borderRadius: 14, padding: '14px 16px', cursor: 'pointer', textAlign: 'left', display: 'flex', gap: 12, alignItems: 'flex-start', fontFamily: "'DM Sans', sans-serif" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: "'Lora', serif", fontSize: 14, fontWeight: 600, color: '#1E2620' }}>{item.is_favorite ? '⭐ ' : ''}{item.name}</div>
                    <div style={{ fontSize: 12, color: '#6B7066', fontWeight: 300, marginTop: 2 }}>{item.description}</div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#3D6B4F', flexShrink: 0 }}>${item.price}</div>
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={handleGroupBack} style={backStyle}>← Back</button>
              <button onClick={handleGroupNext} disabled={!currentGroup.menuItem} style={{ ...btnStyle(!currentGroup.menuItem), flex: 1 }}>
                {currentGroupIndex < groups.length - 1 ? `Next: ${MEAL_TYPE_LABELS[groups[currentGroupIndex + 1]?.mealType]} →` : 'Next: Your Info →'}
              </button>
            </div>
          </>)}
        </>)}

        {/* Step 3 */}
        {step === 3 && (<>
          <h2 style={h2Style}>Almost done!</h2>
          <p style={subStyle}>Let {recipientFirstName} know who&apos;s sending dinner.</p>
          <div style={{ background: '#EAF2ED', borderRadius: 14, padding: '16px', marginBottom: 20 }}>
            {groups.map((g, i) => {
              const mc = MEAL_TYPE_COLORS[g.mealType] || MEAL_TYPE_COLORS.dinner
              return (
                <div key={g.mealType} style={{ paddingBottom: i < groups.length - 1 ? 10 : 0, marginBottom: i < groups.length - 1 ? 10 : 0, borderBottom: i < groups.length - 1 ? '1px solid #C8DDD0' : 'none' }}>
                  <span style={{ background: mc.bg, color: mc.color, borderRadius: 20, fontSize: 10, fontWeight: 600, padding: '2px 8px', border: `1px solid ${mc.color}`, display: 'inline-block', marginBottom: 6 }}>{MEAL_TYPE_LABELS[g.mealType]} · {g.slots.length} date{g.slots.length > 1 ? 's' : ''}</span>
                  <div style={{ fontSize: 13, color: '#3D6B4F', fontWeight: 600 }}>{g.menuItem?.name}</div>
                  <div style={{ fontSize: 12, color: '#6B9E7E', fontWeight: 300 }}>{g.restaurant?.name}</div>
                </div>
              )
            })}
          </div>
          <label style={labelStyle}>Your name</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Marques" style={inputStyle} />
          <label style={labelStyle}>Your email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" style={inputStyle} />
          <label style={labelStyle}>Your phone</label>
          <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(555) 123-4567" style={inputStyle} />
          <p style={{ fontSize: 12, color: '#6B7066', marginTop: -16, marginBottom: 20, fontWeight: 300 }}>We&apos;ll text you when your meal is delivered.</p>
          <label style={labelStyle}>Personal note (optional)</label>
          <textarea value={note} onChange={e => setNote(e.target.value)} placeholder={getNotePlaceholder()} style={{ ...inputStyle, minHeight: 90, resize: 'none' as const }} />
          <label style={labelStyle}>Add a tip for your Dasher</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            {TIP_OPTIONS.map(opt => (
              <button key={opt.value} onClick={() => setTipAmount(opt.value)} style={{ flex: 1, padding: '11px 4px', borderRadius: 10, border: 'none', background: tipAmount === opt.value ? '#3D6B4F' : '#EAF2ED', color: tipAmount === opt.value ? '#fff' : '#3D6B4F', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", transition: 'all 0.15s' }}>{opt.label}</button>
            ))}
          </div>
          <p style={{ fontSize: 12, color: '#6B7066', marginBottom: 20, fontWeight: 300 }}>Tips go directly to your Dasher. 🚗</p>
          <div style={{ background: '#fff', border: '1px solid #DDE8E0', borderRadius: 12, padding: '14px 16px', marginBottom: 20 }}>
            <p style={{ fontSize: 13, color: '#6B7066', margin: 0, lineHeight: 1.6 }}>💳 You won&apos;t be charged until {recipientFirstName} confirms. No money moves until they say yes.</p>
          </div>
          {errorMsg && <p style={{ color: '#B94040', fontSize: 13, marginBottom: 16 }}>{errorMsg}</p>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => { setStep(2); setCurrentGroupIndex(groups.length - 1); setGroupSubStep('meal') }} style={backStyle}>← Back</button>
            <button onClick={handleSubmit} disabled={!name || !email || !phone || loading} style={{ ...btnStyle(!name || !email || !phone || loading), flex: 1 }}>
              {loading ? 'Sending…' : totalDates > 1 ? `Send ${totalDates} Proposals 🧡` : 'Send Proposal 🧡'}
            </button>
          </div>
        </>)}

      </div>

      {/* Footer */}
      <CoordFooter />
    </div>
  )
}

const h2Style: React.CSSProperties = { fontFamily: "'Lora', serif", fontSize: 22, fontWeight: 500, color: '#1E2620', margin: '0 0 6px' }
const subStyle: React.CSSProperties = { fontSize: 14, color: '#6B7066', margin: '0 0 20px', fontWeight: 300 }
const btnStyle = (disabled: boolean): React.CSSProperties => ({ width: '100%', padding: '14px', borderRadius: 10, border: 'none', background: disabled ? '#DDE8E0' : '#3D6B4F', color: disabled ? '#6B7066' : '#fff', fontSize: 14, fontWeight: 500, cursor: disabled ? 'default' : 'pointer', fontFamily: "'DM Sans', sans-serif" })
const backStyle: React.CSSProperties = { padding: '14px 20px', borderRadius: 10, border: '1.5px solid #DDE8E0', background: 'transparent', fontSize: 14, color: '#6B7066', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }
const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: '#6B7066', letterSpacing: 1.5, textTransform: 'uppercase', display: 'block', marginBottom: 8 }
const inputStyle: React.CSSProperties = { width: '100%', padding: '13px 16px', borderRadius: 10, border: '1.5px solid #DDE8E0', fontSize: 16, background: '#fff', outline: 'none', boxSizing: 'border-box', marginBottom: 20, fontFamily: "'DM Sans', sans-serif", color: '#1E2620' }

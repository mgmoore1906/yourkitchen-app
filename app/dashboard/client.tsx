'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

// ─── Share Link ────────────────────────────────────────────────────────────────
function ShareLink({ slug, kitchenName }: { slug: string, kitchenName: string }) {
  const [copied, setCopied] = useState(false)
  const url = typeof window !== 'undefined' ? `${window.location.origin}/k/${slug}` : `/k/${slug}`

  const handleCopy = () => {
    if (navigator.share) {
      navigator.share({
        title: 'My YourKitchen',
        text: 'Send me a meal through my YourKitchen — pick a date, choose a restaurant, and dinner is on its way 🧡',
        url,
      })
    } else {
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2500)
      })
    }
  }

  return (
    <div style={{ background: '#fff', border: '1.5px dashed #6B9E7E', borderRadius: 16, padding: '20px', marginBottom: 16 }}>
      <p style={{ fontSize: 11, fontWeight: 600, color: '#6B7066', letterSpacing: 1.5, textTransform: 'uppercase', margin: '0 0 8px' }}>Your Kitchen Link</p>
      <p style={{ fontFamily: "'Lora', serif", fontSize: 14, color: '#3D6B4F', margin: '0 0 14px', wordBreak: 'break-all' }}>{url}</p>
      <button
        onClick={handleCopy}
        style={{
          width: '100%', padding: '13px', borderRadius: 10, border: 'none',
          background: copied ? '#3D6B4F' : '#1E2620', color: '#fff', fontSize: 14,
          fontWeight: 500, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", transition: 'background 0.2s',
        }}
      >
        {copied ? '✓ Link copied!' : navigator && 'share' in navigator ? '🔗 Share My Kitchen' : '📋 Copy Link'}
      </button>
    </div>
  )
}

// ─── Meal Type Picker ──────────────────────────────────────────────────────────
const MEAL_TYPES = [
  { key: 'breakfast', label: 'Breakfast', emoji: '🌅', color: '#E8834A', light: '#FFF0E8' },
  { key: 'lunch',     label: 'Lunch',     emoji: '☀️',  color: '#4A8FA8', light: '#E8F4F8' },
  { key: 'dinner',    label: 'Dinner',    emoji: '🌙', color: '#3D6B4F', light: '#EAF2ED' },
]

function MealTypePicker({
  dateStr, existingSlots, onPick, onRemove, onCancel,
}: {
  dateStr: string
  existingSlots: any[]
  onPick: (type: string) => void
  onRemove: (slot: any) => void
  onCancel: () => void
}) {
  const d = new Date(dateStr + 'T12:00:00')
  const label = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const existingTypes = existingSlots.map(s => s.meal_type)
  const availableTypes = MEAL_TYPES.filter(m => !existingTypes.includes(m.key))

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(30,38,32,0.5)', zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ background: '#FAFAF5', borderRadius: '20px 20px 0 0', padding: '24px 24px 40px', width: '100%', maxWidth: 500 }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: '#6B7066', letterSpacing: 1.5, textTransform: 'uppercase', margin: '0 0 4px' }}>
          {existingSlots.length > 0 ? 'Manage meal date' : 'Add a meal date'}
        </p>
        <p style={{ fontFamily: "'Lora', serif", fontSize: 17, fontWeight: 500, color: '#1E2620', margin: '0 0 20px' }}>{label}</p>

        {existingSlots.length > 0 && (
          <>
            <p style={{ fontSize: 12, color: '#6B7066', margin: '0 0 10px', fontWeight: 500 }}>TAP TO REMOVE</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {existingSlots.map(slot => {
                const m = MEAL_TYPES.find(x => x.key === slot.meal_type) || MEAL_TYPES[2]
                const isLocked = slot.status === 'claimed' || slot.status === 'confirmed'
                return (
                  <button key={slot.id} onClick={() => !isLocked && onRemove(slot)} style={{
                    background: m.light, border: `2px solid ${m.color}`, borderRadius: 14,
                    padding: '14px 18px', cursor: isLocked ? 'default' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    fontFamily: "'DM Sans', sans-serif", opacity: isLocked ? 0.6 : 1,
                  }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: m.color }}>{m.emoji} {m.label}</span>
                    {isLocked
                      ? <span style={{ fontSize: 11, color: m.color, fontWeight: 500 }}>{slot.status === 'claimed' ? 'PENDING' : 'CONFIRMED'}</span>
                      : <span style={{ fontSize: 18, color: m.color }}>✕</span>
                    }
                  </button>
                )
              })}
            </div>
          </>
        )}

        {availableTypes.length > 0 && (
          <>
            <p style={{ fontSize: 12, color: '#6B7066', margin: '0 0 10px', fontWeight: 500 }}>
              {existingSlots.length > 0 ? 'ADD ANOTHER' : 'WHAT MEAL DO YOU NEED?'}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              {availableTypes.map(m => (
                <button key={m.key} onClick={() => onPick(m.key)} style={{
                  background: '#fff', border: `2px solid ${m.color}`, borderRadius: 14,
                  padding: '16px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center',
                  gap: 14, fontFamily: "'DM Sans', sans-serif", textAlign: 'left',
                }}>
                  <span style={{ fontSize: 26 }}>{m.emoji}</span>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: m.color }}>{m.label}</div>
                    <div style={{ fontSize: 12, color: '#6B7066', fontWeight: 300, marginTop: 2 }}>
                      {m.key === 'breakfast' ? 'First Watch, Toasted Yolk, Harvest Kitchen'
                        : m.key === 'lunch' ? 'Cava, Kebab Shop, Mod Fresh, Harvest Kitchen'
                        : 'Cava, Kebab Shop, Up Thai Kitchen'}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        <button onClick={onCancel} style={{
          width: '100%', padding: '13px', borderRadius: 10, border: '1.5px solid #DDE8E0',
          background: 'transparent', fontSize: 14, color: '#6B7066', cursor: 'pointer',
          fontFamily: "'DM Sans', sans-serif",
        }}>
          Done
        </button>
      </div>
    </div>
  )
}

// ─── Calendar Section ──────────────────────────────────────────────────────────
function CalendarSection({ calendarDates: initialDates, kitchenId }: { calendarDates: any[], kitchenId: string }) {
  const today = new Date()
  const [viewYear, setViewYear]   = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [dates, setDates]         = useState<any[]>(initialDates)
  const [loading, setLoading]     = useState<string | null>(null)
  const [pendingDate, setPendingDate] = useState<string | null>(null)
  const todayStr = today.toISOString().split('T')[0]

  const dateMap: Record<string, any[]> = {}
  dates.forEach(d => {
    if (!dateMap[d.date]) dateMap[d.date] = []
    dateMap[d.date].push(d)
  })

  const monthName  = new Date(viewYear, viewMonth, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const firstDay   = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()

  const prevMonth = () => { if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) } else setViewMonth(m => m - 1) }
  const nextMonth = () => { if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) } else setViewMonth(m => m + 1) }

  const handleDayTap = (dayNum: number) => {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
    if (dateStr < todayStr) return
    setPendingDate(dateStr)
  }

  const handleRemoveSlot = async (slot: any) => {
    setPendingDate(null)
    setLoading(slot.date)
    const res = await fetch('/api/calendar', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date_id: slot.id }) })
    if (res.ok) setDates(prev => prev.filter(d => d.id !== slot.id))
    setLoading(null)
  }

  const handleAddSlot = async (mealType: string) => {
    if (!pendingDate) return
    const dateStr = pendingDate
    setPendingDate(null)
    setLoading(dateStr)
    const res = await fetch('/api/calendar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kitchen_id: kitchenId, date: dateStr, meal_type: mealType }) })
    if (res.ok) { const data = await res.json(); setDates(prev => [...prev, data.date]) }
    setLoading(null)
  }

  const cells: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const getDateState = (dayNum: number) => {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
    return { dateStr, isPast: dateStr < todayStr, isToday: dateStr === todayStr, slots: dateMap[dateStr] || [] }
  }
  const getMealColor       = (mealType: string) => MEAL_TYPES.find(m => m.key === mealType) || MEAL_TYPES[2]
  const getSlotStatusColor = (slot: any) => {
    if (slot.status === 'confirmed') return '#1E2620'
    if (slot.status === 'claimed')   return '#B88B4A'
    return getMealColor(slot.meal_type).color
  }

  const openCount      = dates.filter(d => d.status === 'available').length
  const claimedCount   = dates.filter(d => d.status === 'claimed').length
  const confirmedCount = dates.filter(d => d.status === 'confirmed').length

  return (
    <>
      {pendingDate && (
        <MealTypePicker
          dateStr={pendingDate}
          existingSlots={dateMap[pendingDate] || []}
          onPick={handleAddSlot}
          onRemove={handleRemoveSlot}
          onCancel={() => setPendingDate(null)}
        />
      )}
      <div style={{ background: '#fff', border: '1px solid #DDE8E0', borderRadius: 16, padding: '20px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: '#6B7066', letterSpacing: 1.5, textTransform: 'uppercase', margin: '0 0 4px' }}>Your Calendar</p>
            <p style={{ fontSize: 13, color: '#6B7066', margin: 0, fontWeight: 300 }}>Tap a date to add or manage meal slots</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={prevMonth} style={{ background: '#EAF2ED', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', fontSize: 16, color: '#3D6B4F', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
            <button onClick={nextMonth} style={{ background: '#EAF2ED', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', fontSize: 16, color: '#3D6B4F', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
          </div>
        </div>

        <p style={{ fontFamily: "'Lora', serif", fontSize: 17, fontWeight: 500, color: '#1E2620', margin: '0 0 12px', textAlign: 'center' }}>{monthName}</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
          {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
            <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: '#6B7066', padding: '4px 0' }}>{d}</div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
          {cells.map((day, i) => {
            if (!day) return <div key={i} />
            const { isPast, isToday, slots } = getDateState(day)
            const isLoading = loading === `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const hasSlots  = slots.length > 0
            return (
              <button key={i} onClick={() => !isPast && handleDayTap(day)} disabled={isPast || isLoading} style={{
                background: isLoading ? '#EAF2ED' : hasSlots ? '#F8FAF8' : 'transparent',
                border: isToday ? '2px solid #3D6B4F' : hasSlots ? '1.5px solid #DDE8E0' : '1.5px solid transparent',
                borderRadius: 10, padding: '8px 2px', minHeight: 52,
                cursor: isPast ? 'default' : 'pointer', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 3, transition: 'all 0.1s',
                fontFamily: "'DM Sans', sans-serif", WebkitTapHighlightColor: 'transparent',
              }}>
                <span style={{ fontSize: 13, fontWeight: isToday ? 700 : 500, color: isPast ? '#C8D5CA' : '#1E2620', lineHeight: 1 }}>{day}</span>
                {slots.length > 0 && (
                  <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    {slots.slice(0, 3).map((slot, si) => (
                      <div key={si} style={{ width: 6, height: 6, borderRadius: '50%', background: getSlotStatusColor(slot), flexShrink: 0 }} />
                    ))}
                  </div>
                )}
              </button>
            )
          })}
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 16, paddingTop: 14, borderTop: '1px solid #EAF2ED' }}>
          {[
            { dot: '#E8834A', label: 'Breakfast' },
            { dot: '#4A8FA8', label: 'Lunch' },
            { dot: '#3D6B4F', label: 'Dinner' },
            { dot: '#B88B4A', label: `${claimedCount} pending` },
            { dot: '#1E2620', label: `${confirmedCount} confirmed` },
            { dot: '#C8D5CA', label: `${openCount} open` },
          ].map(({ dot, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: dot, flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: '#6B7066', fontWeight: 500 }}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

// ─── Restaurant Section ────────────────────────────────────────────────────────
const ALL_RESTAURANTS = [
  { id: 'first-watch',  name: 'First Watch',              cuisine: 'American Breakfast & Brunch', emoji: '🥞', doordash_store_id: '927672'   },
  { id: 'toasted-yolk', name: 'The Toasted Yolk Cafe',    cuisine: 'American Breakfast & Brunch', emoji: '🍳', doordash_store_id: '1109805'  },
  { id: 'harvest',      name: 'Harvest Kitchen & Bakery', cuisine: 'Farm-to-Table Brunch',        emoji: '🌿', doordash_store_id: '30324131' },
  { id: 'cava',         name: 'Cava',                     cuisine: 'Mediterranean',               emoji: '🫙', doordash_store_id: '23050039' },
  { id: 'kebab-shop',   name: 'The Kebab Shop',           cuisine: 'Mediterranean',               emoji: '🥙', doordash_store_id: '32660157' },
  { id: 'mod-fresh',    name: 'Mod Fresh',                cuisine: 'Healthy Fast-Casual',         emoji: '🥗', doordash_store_id: '26020728' },
  { id: 'up-thai',      name: 'Up Thai Kitchen',          cuisine: 'Thai',                        emoji: '🍜', doordash_store_id: '1538370'  },
]

function RestaurantSection({ kitchenRestaurants: initialRestaurants, kitchenId }: { kitchenRestaurants: any[], kitchenId: string }) {
  const [restaurants, setRestaurants] = useState<any[]>(initialRestaurants)
  const [loading, setLoading]         = useState<string | null>(null)
  const [expanded, setExpanded]       = useState(false)

  const activeNames = new Set(restaurants.filter(r => r.is_active !== false).map((r: any) => r.name))

  const handleToggle = async (r: typeof ALL_RESTAURANTS[0]) => {
    setLoading(r.id)
    const isActive = activeNames.has(r.name)
    const existing = restaurants.find((kr: any) => kr.name === r.name)

    if (isActive && existing) {
      const res = await fetch('/api/restaurants', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ restaurant_id: existing.id, is_active: false }) })
      if (res.ok) setRestaurants(prev => prev.map((kr: any) => kr.id === existing.id ? { ...kr, is_active: false } : kr))
    } else if (existing) {
      const res = await fetch('/api/restaurants', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ restaurant_id: existing.id, is_active: true }) })
      if (res.ok) setRestaurants(prev => prev.map((kr: any) => kr.id === existing.id ? { ...kr, is_active: true } : kr))
    } else {
      const res = await fetch('/api/restaurants', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kitchen_id: kitchenId, name: r.name, cuisine: r.cuisine, doordash_store_id: r.doordash_store_id }) })
      if (res.ok) { const data = await res.json(); setRestaurants(prev => [...prev, data.restaurant]) }
    }
    setLoading(null)
  }

  const activeCount = ALL_RESTAURANTS.filter(r => activeNames.has(r.name)).length

  return (
    <div style={{ background: '#fff', border: '1px solid #DDE8E0', borderRadius: 16, padding: '20px', marginBottom: 16 }}>
      <button onClick={() => setExpanded(e => !e)} style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 0, fontFamily: "'DM Sans', sans-serif" }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: '#6B7066', letterSpacing: 1.5, textTransform: 'uppercase', margin: '0 0 4px', textAlign: 'left' }}>My Restaurants</p>
          <p style={{ fontSize: 13, color: '#6B7066', margin: 0, fontWeight: 300, textAlign: 'left' }}>{activeCount} of {ALL_RESTAURANTS.length} active</p>
        </div>
        <span style={{ fontSize: 18, color: '#6B7066' }}>{expanded ? '↑' : '↓'}</span>
      </button>

      {expanded && (
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {ALL_RESTAURANTS.map(r => {
            const isActive  = activeNames.has(r.name)
            const isLoading = loading === r.id
            return (
              <button key={r.id} onClick={() => handleToggle(r)} disabled={isLoading} style={{
                background: isActive ? '#EAF2ED' : '#fff',
                border: `2px solid ${isActive ? '#3D6B4F' : '#DDE8E0'}`,
                borderRadius: 14, padding: '14px 16px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 14,
                transition: 'all 0.15s', fontFamily: "'DM Sans', sans-serif", opacity: isLoading ? 0.6 : 1,
              }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: isActive ? '#3D6B4F' : '#EAF2ED', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                  {r.emoji}
                </div>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ fontFamily: "'Lora', serif", fontSize: 14, fontWeight: 600, color: '#1E2620' }}>{r.name}</div>
                  <div style={{ fontSize: 12, color: '#6B7066', fontWeight: 300, marginTop: 2 }}>{r.cuisine}</div>
                </div>
                <div style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${isActive ? '#3D6B4F' : '#DDE8E0'}`, background: isActive ? '#3D6B4F' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, flexShrink: 0 }}>
                  {isLoading ? '…' : isActive ? '✓' : ''}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Dashboard Client ──────────────────────────────────────────────────────────
export default function DashboardClient({
  kitchen,
  pendingProposals,
  confirmedProposals,
  calendarDates,
  kitchenRestaurants,
  userEmail,
}: any) {
  const router = useRouter()
  const [proposals, setProposals]         = useState(pendingProposals)
  const [loading, setLoading]             = useState<string | null>(null)
  const [upgradeLoading, setUpgradeLoading] = useState<string | null>(null)

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00')
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  }

  const handleResponse = async (proposalId: string, action: 'confirm' | 'decline') => {
    setLoading(proposalId)
    const res  = await fetch('/api/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ proposal_id: proposalId, action }) })
    const data = await res.json()
    if (res.ok) {
      setProposals((prev: any[]) => prev.filter((p: any) => p.id !== proposalId))
      if (action === 'confirm' && data.checkout_url) window.open(data.checkout_url, '_blank')
      router.refresh()
    }
    setLoading(null)
  }

  const handleUpgrade = async (plan: string) => {
    setUpgradeLoading(plan)
    const res  = await fetch('/api/stripe-subscription', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan, kitchen_id: kitchen?.id, user_id: kitchen?.organizer_id }) })
    const data = await res.json()
    if (data.url) window.location.href = data.url
    else console.error('Upgrade error:', data.error)
    setUpgradeLoading(null)
  }

  const isSubscribed = ['active', 'trialing', 'lifetime'].includes(kitchen?.subscription_status)
  const isTrialing   = kitchen?.subscription_status === 'trialing'
  const isLifetime   = kitchen?.subscription_plan === 'lifetime'
  const tierLabel    = isLifetime ? '🌟 Founding Member' : isTrialing ? '✨ Care+ Trial' : isSubscribed ? '✅ Care+' : '🎁 Free'

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF5', fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />

      {/* Nav */}
      <div style={{ background: '#1E2620', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 500, letterSpacing: 5, color: '#6B9E7E', textTransform: 'uppercase' }}>Your</div>
          <div style={{ fontFamily: "'Lora', serif", fontSize: 22, fontWeight: 500, color: '#fff' }}>Kitchen</div>
        </div>
        <div style={{ width: 38, height: 38, borderRadius: 12, background: '#3D6B4F', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 14 }}>
          {kitchen.name?.charAt(0) || 'K'}
        </div>
      </div>

      <div style={{ padding: '28px 24px', maxWidth: 500, margin: '0 auto' }}>

        {/* Pending proposals */}
        {proposals.length > 0 && (
          <>
            <p style={{ fontSize: 10, fontWeight: 700, color: '#B94040', letterSpacing: 2, textTransform: 'uppercase', margin: '0 0 12px' }}>
              🔔 {proposals.length} Meal Proposal{proposals.length > 1 ? 's' : ''} Awaiting Your Reply
            </p>
            {proposals.map((p: any) => (
              <div key={p.id} style={{ background: '#fff', border: '2px solid #3D6B4F', borderRadius: 18, padding: '20px', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 12, background: '#EAF2ED', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>🥘</div>
                  <div>
                    <div style={{ fontFamily: "'Lora', serif", fontSize: 16, fontWeight: 600, color: '#1E2620' }}>
                      {p.claims?.guest_coordinators?.full_name} wants to send you dinner
                    </div>
                    <div style={{ fontSize: 12, color: '#6B7066', fontWeight: 300, marginTop: 2 }}>No charge until you confirm</div>
                  </div>
                </div>
                {[
                  ['Meal',  p.menu_items?.name],
                  ['From',  p.kitchen_restaurants?.name],
                  ['Date',  formatDate(p.claims?.calendar_dates?.date)],
                  ['Price', `$${p.menu_items?.price} + delivery`],
                ].map(([l, v]) => (
                  <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #EAF2ED' }}>
                    <span style={{ fontSize: 13, color: '#6B7066', fontWeight: 300 }}>{l}</span>
                    <span style={{ fontSize: 13, color: '#1E2620', fontWeight: 500 }}>{v}</span>
                  </div>
                ))}
                {p.coordinator_note && (
                  <div style={{ background: '#EAF2ED', borderRadius: 10, padding: '10px 14px', margin: '12px 0 0' }}>
                    <p style={{ fontSize: 13, color: '#3D6B4F', margin: 0, fontStyle: 'italic' }}>"{p.coordinator_note}"</p>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                  <button onClick={() => handleResponse(p.id, 'decline')} disabled={loading === p.id} style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1.5px solid #DDE8E0', background: 'transparent', fontSize: 14, color: '#6B7066', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                    ✕ Decline
                  </button>
                  <button onClick={() => handleResponse(p.id, 'confirm')} disabled={loading === p.id} style={{ flex: 2, padding: '12px', borderRadius: 10, border: 'none', background: loading === p.id ? '#6B9E7E' : '#3D6B4F', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                    {loading === p.id ? 'Processing…' : '✓ Confirm — Send It!'}
                  </button>
                </div>
              </div>
            ))}
          </>
        )}

        {/* Confirmed meals — on the way */}
        {confirmedProposals?.length > 0 && (
          <>
            <p style={{ fontSize: 10, fontWeight: 700, color: '#3D6B4F', letterSpacing: 2, textTransform: 'uppercase', margin: '0 0 12px' }}>
              🚗 On the Way
            </p>
            {confirmedProposals.map((p: any) => (
              <div key={p.id} style={{ background: '#EAF2ED', border: '1.5px solid #3D6B4F', borderRadius: 18, padding: '18px 20px', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: '#3D6B4F', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>🧡</div>
                  <div>
                    <div style={{ fontFamily: "'Lora', serif", fontSize: 15, fontWeight: 600, color: '#1E2620' }}>
                      {p.menu_items?.name}
                    </div>
                    <div style={{ fontSize: 12, color: '#3D6B4F', fontWeight: 300, marginTop: 2 }}>
                      from {p.kitchen_restaurants?.name} · sent by {p.claims?.guest_coordinators?.full_name}
                    </div>
                  </div>
                </div>
                {[
                  ['Date',        formatDate(p.claims?.calendar_dates?.date)],
                  ['Delivery ID', p.doordash_delivery_id],
                ].map(([l, v]) => v ? (
                  <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #C8DDD0' }}>
                    <span style={{ fontSize: 12, color: '#6B7066', fontWeight: 300 }}>{l}</span>
                    <span style={{ fontSize: 12, color: '#1E2620', fontWeight: 500 }}>{v}</span>
                  </div>
                ) : null)}
               {p.doordash_tracking_url && (
                <button
                onClick={() => window.open(p.doordash_tracking_url, '_blank')}
                style={{ display: 'block', marginTop: 14, width: '100%', padding: '12px', borderRadius: 10, border: 'none', background: '#3D6B4F', color: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", textAlign: 'center' }}
              >
                🚗 Track My Delivery
              </button>
            )}
              </div>
            ))}
          </>
        )}

        {/* Kitchen heading */}
        <h1 style={{ fontFamily: "'Lora', serif", fontSize: 24, fontWeight: 500, color: '#1E2620', margin: '0 0 4px', letterSpacing: -0.5 }}>
          {kitchen.name} 👋
        </h1>
        <p style={{ fontSize: 14, color: '#6B7066', margin: '0 0 24px', fontWeight: 300 }}>
          Your Kitchen is live. Share the link with your village.
        </p>

        {/* Share link */}
        <ShareLink slug={kitchen.slug} />

        {/* Calendar */}
        <CalendarSection calendarDates={calendarDates} kitchenId={kitchen.id} />

        {/* Restaurants */}
        <RestaurantSection kitchenRestaurants={kitchenRestaurants} kitchenId={kitchen.id} />

        {/* Status cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Status',    value: '✅ Active',                             bg: '#EAF2ED', color: '#3D6B4F' },
            { label: 'Tier',      value: tierLabel,                               bg: '#EAF2ED', color: '#3D6B4F' },
            { label: 'Address',   value: kitchen.address?.split(',')[0] || '—',  bg: '#fff',    color: '#1E2620' },
            { label: 'Household', value: `${kitchen.household_size || '—'} people`, bg: '#fff', color: '#1E2620' },
          ].map(c => (
            <div key={c.label} style={{ background: c.bg, border: '1px solid #DDE8E0', borderRadius: 14, padding: '16px' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#6B7066', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>{c.label}</div>
              <div style={{ fontSize: 14, fontWeight: 500, color: c.color }}>{c.value}</div>
            </div>
          ))}
        </div>

        {/* Upgrade to Care+ */}
        {!isSubscribed && (
          <div style={{ background: '#fff', border: '1.5px solid #3D6B4F', borderRadius: 16, padding: '22px', marginBottom: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 2, color: '#3D6B4F', textTransform: 'uppercase', marginBottom: 6 }}>Upgrade to Care+</div>
            <div style={{ fontFamily: "'Lora', serif", fontSize: 18, fontWeight: 500, color: '#1E2620', marginBottom: 6 }}>Unlimited scheduling, home cook deliveries, and more.</div>
            <div style={{ fontSize: 13, color: '#6B7066', marginBottom: 18, fontWeight: 300, lineHeight: 1.6 }}>14-day free trial on monthly and annual plans. Cancel anytime.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button onClick={() => handleUpgrade('monthly')} disabled={upgradeLoading === 'monthly'} style={{ width: '100%', padding: '13px 16px', borderRadius: 10, border: 'none', background: '#3D6B4F', color: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", textAlign: 'left' }}>
                {upgradeLoading === 'monthly' ? 'Redirecting…' : '✨ Care+ Monthly — $9.99/mo · 14-day free trial'}
              </button>
              <button onClick={() => handleUpgrade('annual')} disabled={upgradeLoading === 'annual'} style={{ width: '100%', padding: '13px 16px', borderRadius: 10, border: '1.5px solid #3D6B4F', background: '#fff', color: '#3D6B4F', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", textAlign: 'left' }}>
                {upgradeLoading === 'annual' ? 'Redirecting…' : '🌿 Early Adopter Annual — $59/yr · Best value'}
              </button>
              <button onClick={() => handleUpgrade('lifetime')} disabled={upgradeLoading === 'lifetime'} style={{ width: '100%', padding: '13px 16px', borderRadius: 10, border: 'none', background: '#B88B4A', color: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", textAlign: 'left' }}>
                {upgradeLoading === 'lifetime' ? 'Redirecting…' : '🌟 Founding Member — $149 one-time · Unlimited forever'}
              </button>
            </div>
          </div>
        )}

        {/* Active subscription banner */}
        {isSubscribed && (
          <div style={{ background: isLifetime ? '#FFF4E8' : '#EAF2ED', border: `1.5px solid ${isLifetime ? '#B88B4A' : '#3D6B4F'}`, borderRadius: 16, padding: '16px 20px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, color: isLifetime ? '#B88B4A' : '#3D6B4F', textTransform: 'uppercase', marginBottom: 4 }}>
                {isLifetime ? 'Founding Member' : isTrialing ? 'Care+ Trial Active' : 'Care+ Active'}
              </div>
              <div style={{ fontSize: 13, color: '#6B7066', fontWeight: 300 }}>
                {isLifetime ? 'Lifetime access — thank you for founding YourKitchen.' : isTrialing ? 'Your free trial is active. Enjoy Care+ features.' : 'Your subscription is active.'}
              </div>
            </div>
            <div style={{ fontSize: 24 }}>{isLifetime ? '🌟' : '✅'}</div>
          </div>
        )}

        {/* Sign out */}
        <form action="/auth/signout" method="post">
          <button type="submit" style={{ width: '100%', padding: '13px', borderRadius: 10, border: '1.5px solid #DDE8E0', background: 'transparent', fontSize: 14, color: '#6B7066', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
            Sign Out
          </button>
        </form>

      </div>
    </div>
  )
}

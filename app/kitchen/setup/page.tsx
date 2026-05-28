'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const RESTAURANTS = [
  { id: 'first-watch',  name: 'First Watch',           cuisine: 'American Breakfast',  emoji: '🥞', meals: ['breakfast'] },
  { id: 'toasted-yolk', name: 'The Toasted Yolk Cafe', cuisine: 'Southern Breakfast',  emoji: '🍳', meals: ['breakfast'] },
  { id: 'harvest',      name: 'Harvest Kitchen & Bakery', cuisine: 'American',          emoji: '🌾', meals: ['breakfast', 'lunch'] },
  { id: 'cava',         name: 'Cava',                  cuisine: 'Mediterranean',        emoji: '🫙', meals: ['lunch', 'dinner'] },
  { id: 'kebab-shop',   name: 'The Kebab Shop',        cuisine: 'Mediterranean',        emoji: '🥙', meals: ['lunch', 'dinner'] },
  { id: 'mod-fresh',    name: 'Mod Fresh',             cuisine: 'American',             emoji: '🥗', meals: ['lunch', 'dinner'] },
  { id: 'up-thai',      name: 'Up Thai Kitchen',       cuisine: 'Thai',                 emoji: '🍜', meals: ['dinner'] },
]

const MEAL_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  breakfast: { label: '🌅 Breakfast', color: '#E8834A', bg: '#FFF0E8' },
  lunch:     { label: '☀️ Lunch',     color: '#4A8FA8', bg: '#E8F4F8' },
  dinner:    { label: '🌙 Dinner',    color: '#3D6B4F', bg: '#EAF2ED' },
}

// All delivery windows including breakfast
const DELIVERY_WINDOWS = [
  { label: '7:00 AM – 9:00 AM',   start: '07:00', end: '09:00', meal: 'breakfast' },
  { label: '8:00 AM – 10:00 AM',  start: '08:00', end: '10:00', meal: 'breakfast' },
  { label: '11:00 AM – 12:30 PM', start: '11:00', end: '12:30', meal: 'lunch' },
  { label: '12:00 PM – 1:30 PM',  start: '12:00', end: '13:30', meal: 'lunch' },
  { label: '5:00 PM – 6:30 PM',   start: '17:00', end: '18:30', meal: 'dinner' },
  { label: '5:30 PM – 7:00 PM',   start: '17:30', end: '19:00', meal: 'dinner' },
  { label: '6:00 PM – 7:30 PM',   start: '18:00', end: '19:30', meal: 'dinner' },
]

type Step = 'restaurants' | 'calendar' | 'delivery' | 'review'

// Date slots: { '2026-06-01': ['dinner'], '2026-06-02': ['breakfast', 'lunch'] }
type DateSlots = Record<string, string[]>

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export default function KitchenSetupPage() {
  const router   = useRouter()
  const supabase = createClient()

  const [step,     setStep]     = useState<Step>('restaurants')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [profile,  setProfile]  = useState<any>(null)

  const [selectedRestaurants, setSelectedRestaurants] = useState<string[]>([])
  const [dateSlots, setDateSlots]       = useState<DateSlots>({})
  const [pickerDate, setPickerDate]     = useState<string | null>(null)
  const [deliveryWindow, setDeliveryWindow] = useState(DELIVERY_WINDOWS[5]) // 5:30–7:00 PM default

  // Request restaurant form
  const [showReqForm, setShowReqForm]   = useState(false)
  const [reqName,     setReqName]       = useState('')
  const [reqCity,     setReqCity]       = useState('')
  const [reqSent,     setReqSent]       = useState(false)
  const [reqLoading,  setReqLoading]    = useState(false)

  const today       = new Date()
  const [viewYear,  setViewYear]  = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const todayStr    = today.toISOString().split('T')[0]
  const monthName   = new Date(viewYear, viewMonth, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const firstDay    = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const prevMonth   = () => { if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) } else setViewMonth(m => m - 1) }
  const nextMonth   = () => { if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) } else setViewMonth(m => m + 1) }

  const cells: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

 useEffect(() => {
  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    // Already has a kitchen — skip setup
    const { data: existing } = await supabase
      .from('kitchens').select('id').eq('organizer_id', user.id).limit(1)
    if (existing && existing.length > 0) {
      router.push('/dashboard')
      return
    }

    const { data } = await supabase
      .from('profiles')
      .select('full_name, street, city, state, zip, household_size, dietary_restrictions')
      .eq('id', user.id).single()
    setProfile(data)
  }
  load()
}, [])

  const toggleRestaurant = (id: string) =>
    setSelectedRestaurants(prev => prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id])

  // Toggle a meal type for a specific date
  const toggleMealSlot = (dateStr: string, mealType: string) => {
    setDateSlots(prev => {
      const current = prev[dateStr] || []
      const updated = current.includes(mealType)
        ? current.filter(m => m !== mealType)
        : [...current, mealType]
      if (updated.length === 0) {
        const { [dateStr]: _, ...rest } = prev
        return rest
      }
      return { ...prev, [dateStr]: updated }
    })
  }

  const address = profile ? `${profile.street}, ${profile.city}, ${profile.state} ${profile.zip}` : ''

  // Flatten dateSlots to array of {date, meal_type} objects
  const calendarDatesPayload = Object.entries(dateSlots).flatMap(([date, meals]) =>
    meals.map(meal_type => ({ date, meal_type }))
  )

  const totalDateCount = Object.keys(dateSlots).length
  const totalSlotCount = calendarDatesPayload.length

  const handleSubmit = async () => {
    setLoading(true); setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: existing } = await supabase
  .from('kitchens')
  .select('id')
  .eq('organizer_id', user.id)
  .limit(1)
if (existing && existing.length > 0) {
  router.push('/dashboard')
  return
}

    const selectedRestaurantData = RESTAURANTS.filter(r => selectedRestaurants.includes(r.id))

    const res = await fetch('/api/onboarding', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id:                  user.id,
        full_name:                profile?.full_name,
        address,
        household_size:           profile?.household_size || '3-4',
        dietary_restrictions:     profile?.dietary_restrictions || [],
        restaurants:              selectedRestaurantData,
        calendar_dates:           calendarDatesPayload,
        delivery_window_start:    deliveryWindow.start,
        delivery_window_end:      deliveryWindow.end,
      }),
    })

    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Something went wrong.'); setLoading(false); return }

    // Small delay to let Supabase propagate before dashboard queries the kitchen
    await new Promise(r => setTimeout(r, 800))
    router.push('/dashboard')
  }

  const submitRestaurantRequest = async () => {
    if (!reqName.trim() || !reqCity.trim()) return
    setReqLoading(true)
    await fetch('/api/request-restaurant', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restaurant_name: reqName, city: reqCity, user_name: profile?.full_name }),
    })
    setReqSent(true); setReqLoading(false)
    setTimeout(() => { setReqSent(false); setShowReqForm(false); setReqName(''); setReqCity('') }, 3000)
  }

  // Detect which meal types are relevant based on selected restaurants
  const availableMealTypes = [...new Set(
    RESTAURANTS.filter(r => selectedRestaurants.includes(r.id)).flatMap(r => r.meals)
  )]

  const steps: Step[]     = ['restaurants', 'calendar', 'delivery', 'review']
  const stepIndex         = steps.indexOf(step)
  const stepLabels        = ['Restaurants', 'Dates', 'Delivery', 'Review']

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF5', fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />

      {/* Nav — no sign out button */}
      <nav style={{ background: '#fff', borderBottom: '0.5px solid #DDE8E0', padding: '14px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
          <span style={{ fontSize: 8, fontWeight: 500, letterSpacing: 5, color: '#6B9E7E', textTransform: 'uppercase' }}>Your</span>
          <span style={{ fontFamily: "'Lora', serif", fontSize: 20, fontWeight: 500, color: '#1E2620', letterSpacing: -0.5 }}>Kitchen</span>
        </div>
        {/* Progress indicators */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {steps.map((s, i) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {i > 0 && <div style={{ width: 20, height: 1, background: '#DDE8E0' }} />}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%',
                  background: i < stepIndex ? '#3D6B4F' : i === stepIndex ? '#1E2620' : '#DDE8E0',
                  color: i <= stepIndex ? '#fff' : '#6B7066',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700,
                }}>
                  {i < stepIndex ? '✓' : i + 1}
                </div>
                <span style={{ fontSize: 11, fontWeight: i === stepIndex ? 600 : 400, color: i === stepIndex ? '#1E2620' : '#6B7066' }}>
                  {stepLabels[i]}
                </span>
              </div>
            </div>
          ))}
        </div>
      </nav>

      <div style={{ maxWidth: 560, margin: '0 auto', padding: '36px 24px 80px' }}>

        {/* ── STEP 1: RESTAURANTS ── */}
        {step === 'restaurants' && (
          <div>
            <p style={eyebrow}>Step 1 of 4</p>
            <h1 style={title}>Which restaurants<br />does your village order from?</h1>
            <p style={sub}>Select all that apply. Your coordinators choose from these when sending meals.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              {RESTAURANTS.map(r => {
                const sel = selectedRestaurants.includes(r.id)
                return (
                  <button key={r.id} onClick={() => toggleRestaurant(r.id)} style={{
                    background: sel ? '#EAF2ED' : '#fff', border: `2px solid ${sel ? '#3D6B4F' : '#DDE8E0'}`,
                    borderRadius: 14, padding: '14px 16px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 14,
                    fontFamily: "'DM Sans', sans-serif", transition: 'all 0.15s', textAlign: 'left',
                  }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: sel ? '#3D6B4F' : '#EAF2ED', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                      {r.emoji}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: "'Lora', serif", fontSize: 14, fontWeight: 600, color: '#1E2620', marginBottom: 4 }}>{r.name}</div>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        {r.meals.map(m => (
                          <span key={m} style={{ background: MEAL_BADGE[m].bg, color: MEAL_BADGE[m].color, fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>
                            {MEAL_BADGE[m].label}
                          </span>
                        ))}
                        <span style={{ fontSize: 11, color: '#6B7066', fontWeight: 300, alignSelf: 'center' }}>{r.cuisine}</span>
                      </div>
                    </div>
                    <div style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${sel ? '#3D6B4F' : '#DDE8E0'}`, background: sel ? '#3D6B4F' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, flexShrink: 0 }}>
                      {sel ? '✓' : ''}
                    </div>
                  </button>
                )
              })}
            </div>

            {selectedRestaurants.length > 0 && (
              <div style={{ background: '#EAF2ED', borderRadius: 12, padding: '12px 16px', marginBottom: 16 }}>
                <p style={{ fontSize: 13, color: '#2D5240', margin: 0 }}>
                  ✓ <strong>{selectedRestaurants.length} restaurant{selectedRestaurants.length > 1 ? 's' : ''}</strong> selected
                  {availableMealTypes.length > 0 && ` · covers ${availableMealTypes.join(', ')}`}
                </p>
              </div>
            )}

            {/* Request a restaurant — dotted concierge card */}
            {!showReqForm ? (
              <button
                onClick={() => setShowReqForm(true)}
                style={{ width: '100%', border: '1.5px dashed #DDE8E0', borderRadius: 14, padding: '14px 18px', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, fontFamily: "'DM Sans', sans-serif", marginBottom: 24, textAlign: 'left' }}
              >
                <div style={{ width: 40, height: 40, borderRadius: 10, background: '#EAF2ED', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>🍽</div>
                <div>
                  <div style={{ fontFamily: "'Lora', serif", fontSize: 13, fontWeight: 500, color: '#1E2620' }}>Don't see your restaurant?</div>
                  <div style={{ fontSize: 12, color: '#6B7066', fontWeight: 300, marginTop: 2 }}>Request it — we'll add it within 24 hours.</div>
                </div>
                <span style={{ marginLeft: 'auto', color: '#6B7066', fontSize: 18 }}>›</span>
              </button>
            ) : (
              <div style={{ border: '1.5px solid #3D6B4F', borderRadius: 14, padding: '16px 18px', marginBottom: 24, background: '#fff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <p style={{ fontFamily: "'Lora', serif", fontSize: 14, fontWeight: 500, color: '#1E2620', margin: 0 }}>Request a restaurant</p>
                  <button onClick={() => setShowReqForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#6B7066' }}>✕</button>
                </div>
                {reqSent ? (
                  <div style={{ background: '#EAF2ED', borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
                    <p style={{ fontSize: 13, color: '#3D6B4F', fontWeight: 600, margin: 0 }}>✅ Request sent! We'll add it within 24 hours.</p>
                  </div>
                ) : (
                  <>
                    <input value={reqName} onChange={e => setReqName(e.target.value)} placeholder="Restaurant name" style={{ ...inputSt, marginBottom: 10 }} />
                    <input value={reqCity} onChange={e => setReqCity(e.target.value)} placeholder="City, TX" style={{ ...inputSt, marginBottom: 12 }} />
                    <button onClick={submitRestaurantRequest} disabled={!reqName || !reqCity || reqLoading}
                      style={{ width: '100%', padding: '11px', background: !reqName || !reqCity || reqLoading ? '#DDE8E0' : '#1E2620', color: !reqName || !reqCity || reqLoading ? '#6B7066' : '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: !reqName || !reqCity || reqLoading ? 'default' : 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                      {reqLoading ? 'Sending…' : 'Send Request →'}
                    </button>
                  </>
                )}
              </div>
            )}

            <button onClick={() => setStep('calendar')} disabled={selectedRestaurants.length === 0} style={btnPrimary(selectedRestaurants.length === 0)}>
              Next: Set My Calendar →
            </button>
          </div>
        )}

        {/* ── STEP 2: CALENDAR with meal type dots ── */}
        {step === 'calendar' && (
          <div>
            <p style={eyebrow}>Step 2 of 4</p>
            <h1 style={title}>Which days do you<br />need meals?</h1>
            <p style={sub}>Tap a date, then select which meals you need that day. Your village sees these as open.</p>

            <div style={{ background: '#fff', border: '1px solid #DDE8E0', borderRadius: 16, padding: '18px', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <button onClick={prevMonth} style={{ background: '#EAF2ED', border: 'none', borderRadius: 8, width: 34, height: 34, cursor: 'pointer', fontSize: 18, color: '#3D6B4F', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
                <p style={{ fontFamily: "'Lora', serif", fontSize: 16, fontWeight: 500, color: '#1E2620', margin: 0 }}>{monthName}</p>
                <button onClick={nextMonth} style={{ background: '#EAF2ED', border: 'none', borderRadius: 8, width: 34, height: 34, cursor: 'pointer', fontSize: 18, color: '#3D6B4F', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 4 }}>
                {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
                  <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#6B7066', padding: '2px 0' }}>{d}</div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
                {cells.map((day, i) => {
                  if (!day) return <div key={i} />
                  const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
                  const isPast    = dateStr <= todayStr
                  const isToday   = dateStr === todayStr
                  const isPicker  = pickerDate === dateStr
                  const slots     = dateSlots[dateStr] || []
                  const hasSlots  = slots.length > 0
                  return (
                    <button key={i}
                      onClick={() => { if (!isPast) setPickerDate(isPicker ? null : dateStr) }}
                      disabled={isPast}
                      style={{
                        background: isPicker ? '#EAF2ED' : hasSlots ? '#F8FAF8' : '#fff',
                        border: `${isPicker || isToday ? 2 : 1}px solid ${isPicker ? '#3D6B4F' : isToday ? '#6B9E7E' : hasSlots ? '#C8DDD0' : '#DDE8E0'}`,
                        borderRadius: 10, padding: '8px 2px', minHeight: 52,
                        cursor: isPast ? 'default' : 'pointer',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        gap: 3, fontFamily: "'DM Sans', sans-serif",
                        opacity: isPast ? 0.3 : 1, transition: 'all 0.1s',
                      }}>
                      <span style={{ fontSize: 13, fontWeight: isToday ? 700 : 500, color: isPicker ? '#3D6B4F' : '#1E2620', lineHeight: 1 }}>{day}</span>
                      {hasSlots ? (
                        <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
                          {slots.map((m, mi) => {
                            const mc = MEAL_BADGE[m]
                            return <div key={mi} style={{ width: 6, height: 6, borderRadius: '50%', background: mc?.color || '#3D6B4F' }} />
                          })}
                        </div>
                      ) : !isPast ? (
                        <div style={{ fontSize: 14, color: '#DDE8E0' }}>+</div>
                      ) : null}
                    </button>
                  )
                })}
              </div>

              {/* Legend */}
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12, paddingTop: 12, borderTop: '0.5px solid #DDE8E0' }}>
                {Object.entries(MEAL_BADGE).map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: v.color }} />
                    <span style={{ fontSize: 10, color: '#6B7066', fontWeight: 500 }}>{v.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Meal type picker for selected date */}
            {pickerDate && (
              <div style={{ background: '#fff', border: '2px solid #3D6B4F', borderRadius: 14, padding: '16px 18px', marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <p style={{ fontFamily: "'Lora', serif", fontSize: 15, fontWeight: 500, color: '#1E2620', margin: 0 }}>{formatDate(pickerDate)}</p>
                  <button onClick={() => setPickerDate(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#6B7066' }}>✕</button>
                </div>
                <p style={{ fontSize: 12, color: '#6B7066', fontWeight: 300, margin: '0 0 12px' }}>Which meals do you need this day?</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {(['breakfast', 'lunch', 'dinner'] as const).map(mealType => {
                    const mb   = MEAL_BADGE[mealType]
                    const isOn = (dateSlots[pickerDate] || []).includes(mealType)
                    // Only show meal types that the selected restaurants cover
                    const isAvail = availableMealTypes.includes(mealType)
                    return (
                      <button key={mealType}
                        onClick={() => { if (isAvail) toggleMealSlot(pickerDate, mealType) }}
                        disabled={!isAvail}
                        style={{
                          background: isOn ? mb.bg : !isAvail ? '#F8F8F8' : '#fff',
                          border: `2px solid ${isOn ? mb.color : !isAvail ? '#EEE' : '#DDE8E0'}`,
                          borderRadius: 10, padding: '12px 8px', cursor: isAvail ? 'pointer' : 'not-allowed',
                          opacity: !isAvail ? 0.35 : 1, fontFamily: "'DM Sans', sans-serif", textAlign: 'center',
                          transition: 'all 0.15s',
                        }}>
                        <div style={{ fontSize: 18, marginBottom: 4 }}>{mb.label.split(' ')[0]}</div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: isOn ? mb.color : !isAvail ? '#BBB' : '#6B7066' }}>
                          {isOn ? '✓ Added' : !isAvail ? 'N/A' : mb.label.split(' ')[1]}
                        </div>
                      </button>
                    )
                  })}
                </div>
                {!availableMealTypes.every(m => m) && (
                  <p style={{ fontSize: 11, color: '#6B7066', margin: '10px 0 0', fontWeight: 300 }}>
                    N/A = no restaurant selected for that meal type
                  </p>
                )}
              </div>
            )}

            {/* Summary */}
            {totalDateCount > 0 && (
              <div style={{ background: '#EAF2ED', borderRadius: 12, padding: '12px 16px', marginBottom: 16 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#3D6B4F', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 8px' }}>
                  {totalDateCount} date{totalDateCount > 1 ? 's' : ''} · {totalSlotCount} meal slot{totalSlotCount > 1 ? 's' : ''}
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {Object.entries(dateSlots).sort(([a],[b]) => a.localeCompare(b)).map(([date, meals]) => (
                    <div key={date} style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#fff', border: '1px solid #C8DDD0', borderRadius: 8, padding: '4px 10px' }}>
                      <span style={{ fontSize: 11, color: '#2D5240', fontWeight: 500 }}>{formatDate(date)}</span>
                      <div style={{ display: 'flex', gap: 2 }}>
                        {meals.map(m => <div key={m} style={{ width: 6, height: 6, borderRadius: '50%', background: MEAL_BADGE[m]?.color || '#3D6B4F' }} />)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStep('restaurants')} style={btnBack}>← Back</button>
              <button onClick={() => setStep('delivery')} disabled={totalSlotCount === 0} style={{ ...btnPrimary(totalSlotCount === 0), flex: 1 }}>
                Next: Delivery Window →
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: DELIVERY WINDOW with breakfast ── */}
        {step === 'delivery' && (
          <div>
            <p style={eyebrow}>Step 3 of 4</p>
            <h1 style={title}>When should meals<br />arrive?</h1>
            <p style={sub}>Choose your preferred delivery window. Coordinators see this when ordering.</p>

            {/* Group windows by meal type */}
            {(['breakfast', 'lunch', 'dinner'] as const).filter(mt => availableMealTypes.includes(mt)).map(mt => {
              const mb      = MEAL_BADGE[mt]
              const windows = DELIVERY_WINDOWS.filter(w => w.meal === mt)
              return (
                <div key={mt} style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <span style={{ background: mb.bg, color: mb.color, fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>{mb.label}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {windows.map(w => {
                      const sel = deliveryWindow.label === w.label
                      return (
                        <button key={w.label} onClick={() => setDeliveryWindow(w)} style={{
                          background: sel ? '#EAF2ED' : '#fff', border: `2px solid ${sel ? '#3D6B4F' : '#DDE8E0'}`,
                          borderRadius: 12, padding: '14px 18px', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          fontFamily: "'DM Sans', sans-serif", transition: 'all 0.15s',
                        }}>
                          <span style={{ fontFamily: "'Lora', serif", fontSize: 15, fontWeight: 500, color: '#1E2620' }}>{w.label}</span>
                          {sel && <span style={{ color: '#3D6B4F', fontSize: 18 }}>✓</span>}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}

            <div style={{ background: '#FFF8E8', border: '1px solid #F0E2B8', borderRadius: 12, padding: '12px 16px', marginBottom: 24 }}>
              <p style={{ fontSize: 13, color: '#7A5800', margin: 0, lineHeight: 1.6 }}>
                ⏰ You can update this anytime in Settings.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStep('calendar')} style={btnBack}>← Back</button>
              <button onClick={() => setStep('review')} style={{ ...btnPrimary(false), flex: 1 }}>Next: Review →</button>
            </div>
          </div>
        )}

        {/* ── STEP 4: REVIEW ── */}
        {step === 'review' && (
          <div>
            <p style={eyebrow}>Step 4 of 4</p>
            <h1 style={title}>Your Kitchen<br />is ready to go live.</h1>
            <p style={sub}>Review everything before we generate your shareable link.</p>

            {[
              {
                label: 'Your details',
                rows: [
                  ['Name', profile?.full_name || '—'],
                  ['Address', address || '—'],
                  ['Household size', profile?.household_size || '—'],
                  ['Dietary restrictions', profile?.dietary_restrictions?.join(', ') || 'None'],
                ],
              },
            ].map(sec => (
              <div key={sec.label} style={{ background: '#fff', border: '0.5px solid #DDE8E0', borderRadius: 16, padding: '18px 20px', marginBottom: 14 }}>
                <p style={sectionLabel}>{sec.label}</p>
                {sec.rows.map(([l, v]) => (
                  <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '0.5px solid #EAF2ED' }}>
                    <span style={{ fontSize: 12, color: '#6B7066', fontWeight: 300 }}>{l}</span>
                    <span style={{ fontSize: 12, color: '#1E2620', fontWeight: 500, textAlign: 'right', maxWidth: '55%' }}>{v}</span>
                  </div>
                ))}
              </div>
            ))}

            <div style={{ background: '#fff', border: '0.5px solid #DDE8E0', borderRadius: 16, padding: '18px 20px', marginBottom: 14 }}>
              <p style={sectionLabel}>Restaurants ({selectedRestaurants.length})</p>
              {RESTAURANTS.filter(r => selectedRestaurants.includes(r.id)).map(r => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '0.5px solid #EAF2ED' }}>
                  <span style={{ fontSize: 18 }}>{r.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#1E2620' }}>{r.name}</div>
                    <div style={{ fontSize: 11, color: '#6B7066', fontWeight: 300 }}>{r.cuisine}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ background: '#fff', border: '0.5px solid #DDE8E0', borderRadius: 16, padding: '18px 20px', marginBottom: 14 }}>
              <p style={sectionLabel}>Open dates ({totalDateCount}) · {totalSlotCount} meal slot{totalSlotCount !== 1 ? 's' : ''}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {Object.entries(dateSlots).sort(([a],[b]) => a.localeCompare(b)).map(([date, meals]) => (
                  <div key={date} style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#EAF2ED', borderRadius: 8, padding: '5px 10px' }}>
                    <span style={{ fontSize: 11, color: '#2D5240', fontWeight: 500 }}>{formatDate(date)}</span>
                    <div style={{ display: 'flex', gap: 2 }}>
                      {meals.map(m => <div key={m} style={{ width: 6, height: 6, borderRadius: '50%', background: MEAL_BADGE[m]?.color || '#3D6B4F' }} />)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: '#fff', border: '0.5px solid #DDE8E0', borderRadius: 16, padding: '18px 20px', marginBottom: 14 }}>
              <p style={sectionLabel}>Delivery window</p>
              <p style={{ fontSize: 14, color: '#1E2620', fontWeight: 500, margin: 0 }}>{deliveryWindow.label}</p>
            </div>

            {error && (
              <div style={{ background: '#FDE8E8', border: '1.5px solid #B94040', borderRadius: 12, padding: '12px 16px', marginBottom: 16 }}>
                <p style={{ fontSize: 13, color: '#B94040', margin: 0 }}>⚠️ {error}</p>
              </div>
            )}

            <div style={{ background: '#1E2620', borderRadius: 16, padding: '18px 20px', marginBottom: 20 }}>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', fontWeight: 300, margin: '0 0 4px', lineHeight: 1.6 }}>
                🔗 Your shareable link will be:
              </p>
              <p style={{ fontFamily: 'monospace', fontSize: 13, color: '#6B9E7E', margin: 0 }}>
                yourkitchen.app/k/{profile?.full_name?.toLowerCase().replace(/\s+/g, '-') || 'your-name'}
              </p>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStep('delivery')} style={btnBack}>← Back</button>
              <button onClick={handleSubmit} disabled={loading} style={{ ...btnPrimary(loading), flex: 1 }}>
                {loading ? 'Creating your Kitchen…' : 'Create My Kitchen 🧡'}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

const eyebrow: React.CSSProperties      = { fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#3D6B4F', margin: '0 0 8px' }
const title: React.CSSProperties        = { fontFamily: "'Lora', serif", fontSize: 28, fontWeight: 500, color: '#1E2620', letterSpacing: -0.5, margin: '0 0 8px', lineHeight: 1.2 }
const sub: React.CSSProperties          = { fontSize: 14, color: '#6B7066', fontWeight: 300, margin: '0 0 28px', lineHeight: 1.6 }
const sectionLabel: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: '#6B7066', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 12px' }
const btnBack: React.CSSProperties      = { padding: '14px 18px', background: 'transparent', color: '#6B7066', border: '1.5px solid #DDE8E0', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }
const inputSt: React.CSSProperties      = { width: '100%', padding: '10px 12px', borderRadius: 9, border: '1.5px solid #DDE8E0', fontSize: 14, fontFamily: "'DM Sans', sans-serif", color: '#1E2620', background: '#FAFAF5', outline: 'none', boxSizing: 'border-box' }
const btnPrimary = (disabled: boolean): React.CSSProperties => ({
  width: '100%', padding: '14px', background: disabled ? '#DDE8E0' : '#1E2620',
  color: disabled ? '#6B7066' : '#fff', border: 'none', borderRadius: 10,
  fontSize: 14, fontWeight: 600, cursor: disabled ? 'default' : 'pointer',
  fontFamily: "'DM Sans', sans-serif", transition: 'background 0.15s',
})

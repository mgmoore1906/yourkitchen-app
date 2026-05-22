'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// ── Restaurants matching /api/onboarding MENU_ITEMS and DOORDASH_STORE_IDS ──
const RESTAURANTS = [
  { id: 'first-watch', name: 'First Watch', cuisine: 'American Breakfast', emoji: '🥞', meals: ['breakfast'] },
  { id: 'toasted-yolk', name: 'The Toasted Yolk Cafe', cuisine: 'Southern Breakfast', emoji: '🍳', meals: ['breakfast'] },
  { id: 'harvest', name: 'Harvest Kitchen & Bakery', cuisine: 'American', emoji: '🌾', meals: ['breakfast', 'lunch'] },
  { id: 'cava', name: 'Cava', cuisine: 'Mediterranean', emoji: '🫙', meals: ['lunch', 'dinner'] },
  { id: 'kebab-shop', name: 'The Kebab Shop', cuisine: 'Mediterranean', emoji: '🥙', meals: ['lunch', 'dinner'] },
  { id: 'mod-fresh', name: 'Mod Fresh', cuisine: 'American', emoji: '🥗', meals: ['lunch', 'dinner'] },
  { id: 'up-thai', name: 'Up Thai Kitchen', cuisine: 'Thai', emoji: '🍜', meals: ['dinner'] },
]

const MEAL_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  breakfast: { label: '🌅 Breakfast', color: '#E8834A', bg: '#FFF0E8' },
  lunch: { label: '☀️ Lunch', color: '#4A8FA8', bg: '#E8F4F8' },
  dinner: { label: '🌙 Dinner', color: '#3D6B4F', bg: '#EAF2ED' },
}

const DELIVERY_WINDOWS = [
  { label: '11:00 AM – 12:30 PM', start: '11:00', end: '12:30', meal: 'lunch' },
  { label: '12:00 PM – 1:30 PM', start: '12:00', end: '13:30', meal: 'lunch' },
  { label: '5:00 PM – 6:30 PM', start: '17:00', end: '18:30', meal: 'dinner' },
  { label: '5:30 PM – 7:00 PM', start: '17:30', end: '19:00', meal: 'dinner' },
  { label: '6:00 PM – 7:30 PM', start: '18:00', end: '19:30', meal: 'dinner' },
]

type Step = 'restaurants' | 'calendar' | 'delivery' | 'review'

function getNextNDays(n: number) {
  const dates = []
  const today = new Date()
  for (let i = 1; i <= n; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    dates.push(d.toISOString().split('T')[0])
  }
  return dates
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export default function KitchenSetupPage() {
  const router = useRouter()
  const supabase = createClient()
  const [step, setStep] = useState<Step>('restaurants')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [profile, setProfile] = useState<{ full_name: string; street: string; city: string; state: string; zip: string; household_size: string; dietary_restrictions: string[] } | null>(null)

  // Selections
  const [selectedRestaurants, setSelectedRestaurants] = useState<string[]>([])
  const [selectedDates, setSelectedDates] = useState<string[]>([])
  const [deliveryWindow, setDeliveryWindow] = useState(DELIVERY_WINDOWS[3]) // default 5:30–7:00

  // Calendar state
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

  const toggleDate = (dateStr: string) => {
    setSelectedDates(prev =>
      prev.includes(dateStr) ? prev.filter(d => d !== dateStr) : [...prev, dateStr]
    )
  }

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data } = await supabase
        .from('profiles')
        .select('full_name, street, city, state, zip, household_size, dietary_restrictions')
        .eq('id', user.id)
        .single()
      setProfile(data)
    }
    load()
  }, [])

  const toggleRestaurant = (id: string) => {
    setSelectedRestaurants(prev =>
      prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
    )
  }

  const address = profile ? `${profile.street}, ${profile.city}, ${profile.state} ${profile.zip}` : ''

  const handleSubmit = async () => {
    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const selectedRestaurantData = RESTAURANTS.filter(r => selectedRestaurants.includes(r.id))

    const res = await fetch('/api/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: user.id,
        full_name: profile?.full_name,
        address,
        household_size: profile?.household_size || '3-4',
        dietary_restrictions: profile?.dietary_restrictions || [],
        restaurants: selectedRestaurantData,
        calendar_dates: selectedDates,
        delivery_window_start: deliveryWindow.start,
        delivery_window_end: deliveryWindow.end,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Something went wrong. Please try again.')
      setLoading(false)
      return
    }

    router.push('/dashboard')
  }

  const steps: Step[] = ['restaurants', 'calendar', 'delivery', 'review']
  const stepIndex = steps.indexOf(step)
  const stepLabels = ['Restaurants', 'Dates', 'Delivery', 'Review']

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF5', fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />

      {/* Nav */}
      <nav style={{ background: '#fff', borderBottom: '0.5px solid #DDE8E0', padding: '14px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
          <span style={{ fontSize: 8, fontWeight: 500, letterSpacing: 5, color: '#6B9E7E', textTransform: 'uppercase' }}>Your</span>
          <span style={{ fontFamily: "'Lora', serif", fontSize: 20, fontWeight: 500, color: '#1E2620', letterSpacing: -0.5 }}>Kitchen</span>
        </div>
        {/* Progress */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {steps.map((s, i) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {i > 0 && <div style={{ width: 20, height: 1, background: '#DDE8E0' }} />}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%',
                  background: i < stepIndex ? '#3D6B4F' : i === stepIndex ? '#1E2620' : '#DDE8E0',
                  color: i <= stepIndex ? '#fff' : '#6B7066',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 700,
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
            <p style={sub}>Select all that apply. Your coordinators will choose from these when sending meals.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
              {RESTAURANTS.map(r => {
                const sel = selectedRestaurants.includes(r.id)
                return (
                  <button key={r.id} onClick={() => toggleRestaurant(r.id)} style={{
                    background: sel ? '#EAF2ED' : '#fff',
                    border: `2px solid ${sel ? '#3D6B4F' : '#DDE8E0'}`,
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
              <div style={{ background: '#EAF2ED', borderRadius: 12, padding: '12px 16px', marginBottom: 20 }}>
                <p style={{ fontSize: 13, color: '#2D5240', margin: 0 }}>
                  ✓ <strong>{selectedRestaurants.length} restaurant{selectedRestaurants.length > 1 ? 's' : ''}</strong> selected — menus auto-loaded with favorites pre-starred.
                </p>
              </div>
            )}

            <button
              onClick={() => setStep('calendar')}
              disabled={selectedRestaurants.length === 0}
              style={btnPrimary(selectedRestaurants.length === 0)}
            >
              Next: Set My Calendar →
            </button>
          </div>
        )}

        {/* ── STEP 2: CALENDAR ── */}
        {step === 'calendar' && (
          <div>
            <p style={eyebrow}>Step 2 of 4</p>
            <h1 style={title}>Which days do you<br />need meals?</h1>
            <p style={sub}>Tap any date to mark it as available. Your village will see these as open to claim.</p>

            {/* Calendar */}
            <div style={{ background: '#fff', border: '1px solid #DDE8E0', borderRadius: 16, padding: '18px', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <button onClick={prevMonth} style={{ background: '#EAF2ED', border: 'none', borderRadius: 8, width: 34, height: 34, cursor: 'pointer', fontSize: 18, color: '#3D6B4F', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
                <p style={{ fontFamily: "'Lora', serif", fontSize: 16, fontWeight: 500, color: '#1E2620', margin: 0 }}>{monthName}</p>
                <button onClick={nextMonth} style={{ background: '#EAF2ED', border: 'none', borderRadius: 8, width: 34, height: 34, cursor: 'pointer', fontSize: 18, color: '#3D6B4F', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 6 }}>
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                  <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#6B7066', padding: '2px 0' }}>{d}</div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
                {cells.map((day, i) => {
                  if (!day) return <div key={i} />
                  const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                  const isPast = dateStr <= todayStr
                  const isSelected = selectedDates.includes(dateStr)
                  const isToday = dateStr === todayStr
                  return (
                    <button key={i}
                      onClick={() => { if (!isPast) toggleDate(dateStr) }}
                      disabled={isPast}
                      style={{
                        background: isSelected ? '#EAF2ED' : '#fff',
                        border: `${isSelected || isToday ? 2 : 1}px solid ${isSelected ? '#3D6B4F' : isToday ? '#6B9E7E' : '#DDE8E0'}`,
                        borderRadius: 10, padding: '10px 2px', minHeight: 44,
                        cursor: isPast ? 'default' : 'pointer',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        gap: 3, fontFamily: "'DM Sans', sans-serif",
                        opacity: isPast ? 0.3 : 1, transition: 'all 0.1s',
                      }}>
                      <span style={{ fontSize: 13, fontWeight: isToday ? 700 : 500, color: isSelected ? '#3D6B4F' : '#1E2620', lineHeight: 1 }}>{day}</span>
                      {isSelected && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#3D6B4F' }} />}
                    </button>
                  )
                })}
              </div>
            </div>

            {selectedDates.length > 0 && (
              <div style={{ background: '#EAF2ED', borderRadius: 12, padding: '12px 16px', marginBottom: 16 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#3D6B4F', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 8px' }}>{selectedDates.length} date{selectedDates.length > 1 ? 's' : ''} selected</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {[...selectedDates].sort().slice(0, 8).map(d => (
                    <span key={d} style={{ background: '#fff', border: '1px solid #C8DDD0', borderRadius: 8, fontSize: 11, color: '#2D5240', padding: '4px 10px', fontWeight: 500 }}>
                      {formatDate(d)}
                    </span>
                  ))}
                  {selectedDates.length > 8 && <span style={{ fontSize: 11, color: '#6B7066', alignSelf: 'center' }}>+{selectedDates.length - 8} more</span>}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStep('restaurants')} style={btnBack}>← Back</button>
              <button onClick={() => setStep('delivery')} disabled={selectedDates.length === 0} style={{ ...btnPrimary(selectedDates.length === 0), flex: 1 }}>
                Next: Delivery Window →
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: DELIVERY WINDOW ── */}
        {step === 'delivery' && (
          <div>
            <p style={eyebrow}>Step 3 of 4</p>
            <h1 style={title}>When should meals<br />arrive?</h1>
            <p style={sub}>Choose your preferred delivery window. Your coordinators will see this when ordering.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
              {DELIVERY_WINDOWS.map(w => {
                const sel = deliveryWindow.label === w.label
                const badge = w.meal === 'lunch' ? MEAL_BADGE.lunch : MEAL_BADGE.dinner
                return (
                  <button key={w.label} onClick={() => setDeliveryWindow(w)} style={{
                    background: sel ? '#EAF2ED' : '#fff',
                    border: `2px solid ${sel ? '#3D6B4F' : '#DDE8E0'}`,
                    borderRadius: 14, padding: '16px 18px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    fontFamily: "'DM Sans', sans-serif", transition: 'all 0.15s',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ background: badge.bg, color: badge.color, fontSize: 9, fontWeight: 700, padding: '3px 9px', borderRadius: 20 }}>{badge.label}</span>
                      <span style={{ fontFamily: "'Lora', serif", fontSize: 15, fontWeight: 500, color: '#1E2620' }}>{w.label}</span>
                    </div>
                    {sel && <span style={{ color: '#3D6B4F', fontSize: 18 }}>✓</span>}
                  </button>
                )
              })}
            </div>

            <div style={{ background: '#FFF8E8', border: '1px solid #F0E2B8', borderRadius: 12, padding: '12px 16px', marginBottom: 24 }}>
              <p style={{ fontSize: 13, color: '#7A5800', margin: 0, lineHeight: 1.6 }}>
                ⏰ You can always update this later in Settings. Your coordinator sees this window when placing an order.
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
            <p style={sub}>Review everything before we create your Kitchen and generate your shareable link.</p>

            {/* Profile card */}
            <div style={{ background: '#fff', border: '0.5px solid #DDE8E0', borderRadius: 16, padding: '18px 20px', marginBottom: 14 }}>
              <p style={sectionLabel}>Your details</p>
              {[
                { label: 'Name', val: profile?.full_name || '—' },
                { label: 'Delivery address', val: address || '—' },
                { label: 'Household size', val: profile?.household_size || '—' },
                { label: 'Dietary restrictions', val: profile?.dietary_restrictions?.join(', ') || 'None' },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '0.5px solid #EAF2ED' }}>
                  <span style={{ fontSize: 12, color: '#6B7066', fontWeight: 300 }}>{row.label}</span>
                  <span style={{ fontSize: 12, color: '#1E2620', fontWeight: 500, textAlign: 'right', maxWidth: '55%' }}>{row.val}</span>
                </div>
              ))}
            </div>

            {/* Restaurants card */}
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

            {/* Dates card */}
            <div style={{ background: '#fff', border: '0.5px solid #DDE8E0', borderRadius: 16, padding: '18px 20px', marginBottom: 14 }}>
              <p style={sectionLabel}>Open dates ({selectedDates.length})</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {[...selectedDates].sort().map(d => (
                  <span key={d} style={{ background: '#EAF2ED', color: '#2D5240', fontSize: 11, fontWeight: 500, padding: '4px 10px', borderRadius: 8 }}>
                    {formatDate(d)}
                  </span>
                ))}
              </div>
            </div>

            {/* Delivery window card */}
            <div style={{ background: '#fff', border: '0.5px solid #DDE8E0', borderRadius: 16, padding: '18px 20px', marginBottom: 24 }}>
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

// ── Styles ────────────────────────────────────────────────────────────────────
const eyebrow: React.CSSProperties = { fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#3D6B4F', margin: '0 0 8px' }
const title: React.CSSProperties = { fontFamily: "'Lora', serif", fontSize: 28, fontWeight: 500, color: '#1E2620', letterSpacing: -0.5, margin: '0 0 8px', lineHeight: 1.2 }
const sub: React.CSSProperties = { fontSize: 14, color: '#6B7066', fontWeight: 300, margin: '0 0 28px', lineHeight: 1.6 }
const sectionLabel: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: '#6B7066', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 12px' }
const btnBack: React.CSSProperties = { padding: '14px 18px', background: 'transparent', color: '#6B7066', border: '1.5px solid #DDE8E0', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }
const btnPrimary = (disabled: boolean): React.CSSProperties => ({
  width: '100%', padding: '14px', background: disabled ? '#DDE8E0' : '#1E2620',
  color: disabled ? '#6B7066' : '#fff', border: 'none', borderRadius: 10,
  fontSize: 14, fontWeight: 600, cursor: disabled ? 'default' : 'pointer',
  fontFamily: "'DM Sans', sans-serif", transition: 'background 0.15s',
})

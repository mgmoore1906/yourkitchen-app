'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const MEAL_BADGE: Record<string, { label: string; color: string; bg: string }> = {
breakfast: { label: '🌅 Breakfast', color: '#E8834A', bg: '#FFF0E8' },
lunch: { label: '☀️ Lunch', color: '#4A8FA8', bg: '#E8F4F8' },
dinner: { label: '🌙 Dinner', color: '#3D6B4F', bg: '#EAF2ED' },
}

const DELIVERY_WINDOWS = [
{ label: '7:00 AM – 9:00 AM', start: '07:00', end: '09:00', meal: 'breakfast' },
{ label: '8:00 AM – 10:00 AM', start: '08:00', end: '10:00', meal: 'breakfast' },
{ label: '11:00 AM – 12:30 PM', start: '11:00', end: '12:30', meal: 'lunch' },
{ label: '12:00 PM – 1:30 PM', start: '12:00', end: '13:30', meal: 'lunch' },
{ label: '5:00 PM – 6:30 PM', start: '17:00', end: '18:30', meal: 'dinner' },
{ label: '5:30 PM – 7:00 PM', start: '17:30', end: '19:00', meal: 'dinner' },
{ label: '6:00 PM – 7:30 PM', start: '18:00', end: '19:30', meal: 'dinner' },
]

type Step = 'address' | 'calendar' | 'delivery' | 'review'
type DateSlots = Record<string, string[]>

function formatDate(dateStr: string) {
return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export default function KitchenSetupPage() {
const router = useRouter()
const supabase = createClient()

const [step, setStep] = useState<Step>('address')
const [loading, setLoading] = useState(false)
const [error, setError] = useState('')
const [profile, setProfile] = useState<any>(null)

// Editable address (pre-filled from profile, confirmed by user)
const [street, setStreet] = useState('')
const [city, setCity] = useState('')
const [state, setState] = useState('TX')
const [zip, setZip] = useState('')
const [addressConfirmed, setAddressConfirmed] = useState(false)

const [dateSlots, setDateSlots] = useState<DateSlots>({})
const [pickerDate, setPickerDate] = useState<string | null>(null)
const [deliveryWindow, setDeliveryWindow] = useState(DELIVERY_WINDOWS[5])

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

const { data: existing } = await supabase
.from('kitchens').select('id').eq('organizer_id', user.id).limit(1)
if (existing && existing.length > 0) { router.push('/dashboard'); return }

const { data } = await supabase
.from('profiles')
.select('full_name, street, city, state, zip, household_size, dietary_restrictions')
.eq('id', user.id).single()
setProfile(data)
if (data) {
setStreet(data.street || '')
setCity(data.city || '')
setState(data.state || 'TX')
setZip(data.zip || '')
}
}
load()
}, [])

const toggleMealSlot = (dateStr: string, mealType: string) => {
setDateSlots(prev => {
const current = prev[dateStr] || []
const updated = current.includes(mealType) ? current.filter(m => m !== mealType) : [...current, mealType]
if (updated.length === 0) { const { [dateStr]: _, ...rest } = prev; return rest }
return { ...prev, [dateStr]: updated }
})
}

const address = `${street}, ${city}, ${state} ${zip}`.replace(/^,\s*/, '').trim()

const calendarDatesPayload = Object.entries(dateSlots).flatMap(([date, meals]) =>
meals.map(meal_type => ({ date, meal_type }))
)
const totalDateCount = Object.keys(dateSlots).length
const totalSlotCount = calendarDatesPayload.length

const handleSubmit = async () => {
setLoading(true); setError('')
const { data: { user } } = await supabase.auth.getUser()
if (!user) { router.push('/login'); return }
const { data: existing } = await supabase.from('kitchens').select('id').eq('organizer_id', user.id).limit(1)
if (existing && existing.length > 0) { router.push('/dashboard'); return }

// Persist confirmed address back to profile so it's the source of truth
await supabase.from('profiles').update({ street, city, state, zip }).eq('id', user.id)

const res = await fetch('/api/onboarding', {
method: 'POST', headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({
user_id: user.id,
full_name: profile?.full_name,
address,
household_size: profile?.household_size || '3-4',
dietary_restrictions: profile?.dietary_restrictions || [],
restaurants: [],               // Path B: no restaurant seeding at setup
calendar_dates: calendarDatesPayload,
delivery_window_start: deliveryWindow.start,
delivery_window_end: deliveryWindow.end,
}),
})

const data = await res.json()
if (!res.ok) { setError(data.error || 'Something went wrong.'); setLoading(false); return }

await new Promise(r => setTimeout(r, 800))
// Path B: land on restaurants so the very next action is adding the first one
router.push('/kitchen/restaurants?welcome=1')
}

const steps: Step[] = ['address', 'calendar', 'delivery', 'review']
const stepIndex = steps.indexOf(step)
const stepLabels = ['Address', 'Dates', 'Delivery', 'Review']
const addressValid = street.trim().length > 3 && city.trim() && zip.trim().length >= 5

return (
<div style={{ minHeight: '100vh', background: '#FAFAF5', fontFamily: "'DM Sans', sans-serif" }}>
<link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />

<nav style={{ background: '#fff', borderBottom: '0.5px solid #DDE8E0', padding: '14px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
<div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
<span style={{ fontSize: 8, fontWeight: 500, letterSpacing: 5, color: '#6B9E7E', textTransform: 'uppercase' }}>Your</span>
<span style={{ fontFamily: "'Lora', serif", fontSize: 20, fontWeight: 500, color: '#1E2620', letterSpacing: -0.5 }}>Kitchen</span>
</div>
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
<span style={{ fontSize: 11, fontWeight: i === stepIndex ? 600 : 400, color: i === stepIndex ? '#1E2620' : '#6B7066' }}>{stepLabels[i]}</span>
</div>
</div>
))}
</div>
</nav>

<div style={{ maxWidth: 560, margin: '0 auto', padding: '36px 24px 80px' }}>

{/* ── STEP 1: CONFIRM ADDRESS ── */}
{step === 'address' && (
<div>
<p style={eyebrow}>Step 1 of 4</p>
<h1 style={title}>Where should<br />meals be delivered?</h1>
<p style={sub}>This is where your village's meals will arrive. Double-check it's right — we use it to find restaurants near you.</p>

<label style={lbl}>Street address</label>
<input value={street} onChange={e => setStreet(e.target.value)} placeholder="1422 Oak Creek Dr" style={inputSt} />

<label style={lbl}>City</label>
<input value={city} onChange={e => setCity(e.target.value)} placeholder="Waller" style={inputSt} />

<div style={{ display: 'flex', gap: 12 }}>
<div style={{ flex: 1 }}>
<label style={lbl}>State</label>
<input value={state} onChange={e => setState(e.target.value)} placeholder="TX" style={inputSt} />
</div>
<div style={{ flex: 1 }}>
<label style={lbl}>ZIP</label>
<input value={zip} onChange={e => setZip(e.target.value)} placeholder="77484" style={inputSt} />
</div>
</div>

{/* Confirmation echo — surfaces a bad address before it becomes a mystery */}
{addressValid && (
<div style={{ background: '#EAF2ED', border: '1px solid #C8DDD0', borderRadius: 12, padding: '14px 16px', margin: '8px 0 20px' }}>
<p style={{ fontSize: 11, fontWeight: 700, color: '#3D6B4F', letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 6px' }}>We'll deliver to</p>
<p style={{ fontSize: 14, color: '#1E2620', fontWeight: 500, margin: '0 0 10px', lineHeight: 1.5 }}>{address}</p>
<label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
<input type="checkbox" checked={addressConfirmed} onChange={e => setAddressConfirmed(e.target.checked)} style={{ width: 16, height: 16, accentColor: '#3D6B4F' }} />
<span style={{ fontSize: 13, color: '#2D5240', fontWeight: 500 }}>Yes, this address is correct</span>
</label>
</div>
)}

<button onClick={() => setStep('calendar')} disabled={!addressValid || !addressConfirmed} style={btnPrimary(!addressValid || !addressConfirmed)}>
Next: Set My Calendar →
</button>
</div>
)}

{/* ── STEP 2: CALENDAR ── */}
{step === 'calendar' && (
<div>
<p style={eyebrow}>Step 2 of 4</p>
<h1 style={title}>Which days do you<br />need meals?</h1>
<p style={sub}>Tap a date, then choose which meals you need that day. Your village sees these as open.</p>

<div style={{ background: '#fff', border: '1px solid #DDE8E0', borderRadius: 16, padding: '18px', marginBottom: 16 }}>
<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
<button onClick={prevMonth} style={navBtn}>‹</button>
<p style={{ fontFamily: "'Lora', serif", fontSize: 16, fontWeight: 500, color: '#1E2620', margin: 0 }}>{monthName}</p>
<button onClick={nextMonth} style={navBtn}>›</button>
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
const isPast = dateStr <= todayStr
const isToday = dateStr === todayStr
const isPicker = pickerDate === dateStr
const slots = dateSlots[dateStr] || []
const hasSlots = slots.length > 0
return (
<button key={i} onClick={() => { if (!isPast) setPickerDate(isPicker ? null : dateStr) }} disabled={isPast}
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
{slots.map((m, mi) => <div key={mi} style={{ width: 6, height: 6, borderRadius: '50%', background: MEAL_BADGE[m]?.color || '#3D6B4F' }} />)}
</div>
) : !isPast ? <div style={{ fontSize: 14, color: '#DDE8E0' }}>+</div> : null}
</button>
)
})}
</div>

<div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12, paddingTop: 12, borderTop: '0.5px solid #DDE8E0' }}>
{Object.entries(MEAL_BADGE).map(([k, v]) => (
<div key={k} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
<div style={{ width: 7, height: 7, borderRadius: '50%', background: v.color }} />
<span style={{ fontSize: 10, color: '#6B7066', fontWeight: 500 }}>{v.label}</span>
</div>
))}
</div>
</div>

{pickerDate && (
<div style={{ background: '#fff', border: '2px solid #3D6B4F', borderRadius: 14, padding: '16px 18px', marginBottom: 16 }}>
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
<p style={{ fontFamily: "'Lora', serif", fontSize: 15, fontWeight: 500, color: '#1E2620', margin: 0 }}>{formatDate(pickerDate)}</p>
<button onClick={() => setPickerDate(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#6B7066' }}>✕</button>
</div>
<p style={{ fontSize: 12, color: '#6B7066', fontWeight: 300, margin: '0 0 12px' }}>Which meals do you need this day?</p>
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
{(['breakfast', 'lunch', 'dinner'] as const).map(mealType => {
const mb = MEAL_BADGE[mealType]
const isOn = (dateSlots[pickerDate] || []).includes(mealType)
return (
<button key={mealType} onClick={() => toggleMealSlot(pickerDate, mealType)}
style={{
background: isOn ? mb.bg : '#fff',
border: `2px solid ${isOn ? mb.color : '#DDE8E0'}`,
borderRadius: 10, padding: '12px 8px', cursor: 'pointer',
fontFamily: "'DM Sans', sans-serif", textAlign: 'center', transition: 'all 0.15s',
}}>
<div style={{ fontSize: 18, marginBottom: 4 }}>{mb.label.split(' ')[0]}</div>
<div style={{ fontSize: 11, fontWeight: 600, color: isOn ? mb.color : '#6B7066' }}>{isOn ? '✓ Added' : mb.label.split(' ')[1]}</div>
</button>
)
})}
</div>
</div>
)}

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
<button onClick={() => setStep('address')} style={btnBack}>← Back</button>
<button onClick={() => setStep('delivery')} disabled={totalSlotCount === 0} style={{ ...btnPrimary(totalSlotCount === 0), flex: 1 }}>Next: Delivery Window →</button>
</div>
</div>
)}

{/* ── STEP 3: DELIVERY ── */}
{step === 'delivery' && (
<div>
<p style={eyebrow}>Step 3 of 4</p>
<h1 style={title}>When should meals<br />arrive?</h1>
<p style={sub}>Choose your preferred delivery window. Coordinators see this when ordering. You can change it anytime.</p>

{(['breakfast', 'lunch', 'dinner'] as const).map(mt => {
const mb = MEAL_BADGE[mt]
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
<h1 style={title}>Your Kitchen<br />is almost ready.</h1>
<p style={sub}>One last look. Next, you'll add the restaurants your village can order from.</p>

<div style={{ background: '#fff', border: '0.5px solid #DDE8E0', borderRadius: 16, padding: '18px 20px', marginBottom: 14 }}>
<p style={sectionLabel}>Your details</p>
{[
['Name', profile?.full_name || '—'],
['Delivery address', address || '—'],
['Household size', profile?.household_size || '—'],
['Dietary restrictions', profile?.dietary_restrictions?.join(', ') || 'None'],
].map(([l, v]) => (
<div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '0.5px solid #EAF2ED' }}>
<span style={{ fontSize: 12, color: '#6B7066', fontWeight: 300 }}>{l}</span>
<span style={{ fontSize: 12, color: '#1E2620', fontWeight: 500, textAlign: 'right', maxWidth: '55%' }}>{v}</span>
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

{/* What comes next — sets the expectation for the restaurant step */}
<div style={{ background: '#FFF8E8', border: '1px solid #F0E2B8', borderRadius: 12, padding: '14px 16px', marginBottom: 20 }}>
<p style={{ fontSize: 13, color: '#7A5800', margin: 0, lineHeight: 1.6 }}>
🏪 <strong>Next up:</strong> add the restaurants your village can order from. Your link goes live as soon as you add the first one.
</p>
</div>

{error && (
<div style={{ background: '#FDE8E8', border: '1.5px solid #B94040', borderRadius: 12, padding: '12px 16px', marginBottom: 16 }}>
<p style={{ fontSize: 13, color: '#B94040', margin: 0 }}>⚠️ {error}</p>
</div>
)}

<div style={{ display: 'flex', gap: 10 }}>
<button onClick={() => setStep('delivery')} style={btnBack}>← Back</button>
<button onClick={handleSubmit} disabled={loading} style={{ ...btnPrimary(loading), flex: 1 }}>
{loading ? 'Creating your Kitchen…' : 'Create Kitchen → Add Restaurants'}
</button>
</div>
</div>
)}

</div>
</div>
)
}

const eyebrow: React.CSSProperties = { fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#3D6B4F', margin: '0 0 8px' }
const title: React.CSSProperties = { fontFamily: "'Lora', serif", fontSize: 28, fontWeight: 500, color: '#1E2620', letterSpacing: -0.5, margin: '0 0 8px', lineHeight: 1.2 }
const sub: React.CSSProperties = { fontSize: 14, color: '#6B7066', fontWeight: 300, margin: '0 0 28px', lineHeight: 1.6 }
const sectionLabel: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: '#6B7066', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 12px' }
const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: '#6B7066', letterSpacing: 1.5, textTransform: 'uppercase', display: 'block', marginBottom: 8 }
const navBtn: React.CSSProperties = { background: '#EAF2ED', border: 'none', borderRadius: 8, width: 34, height: 34, cursor: 'pointer', fontSize: 18, color: '#3D6B4F', display: 'flex', alignItems: 'center', justifyContent: 'center' }
const btnBack: React.CSSProperties = { padding: '14px 18px', background: 'transparent', color: '#6B7066', border: '1.5px solid #DDE8E0', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }
const inputSt: React.CSSProperties = { width: '100%', padding: '13px 16px', borderRadius: 10, border: '1.5px solid #DDE8E0', fontSize: 14, fontFamily: "'DM Sans', sans-serif", color: '#1E2620', background: '#fff', outline: 'none', boxSizing: 'border-box', marginBottom: 16 }
const btnPrimary = (disabled: boolean): React.CSSProperties => ({
width: '100%', padding: '14px', background: disabled ? '#DDE8E0' : '#1E2620',
color: disabled ? '#6B7066' : '#fff', border: 'none', borderRadius: 10,
fontSize: 14, fontWeight: 600, cursor: disabled ? 'default' : 'pointer',
fontFamily: "'DM Sans', sans-serif", transition: 'background 0.15s',
})

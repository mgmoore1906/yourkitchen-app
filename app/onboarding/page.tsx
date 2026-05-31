'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const S = {
sage: '#3D6B4F', sageMid: '#6B9E7E', sageLight: '#EAF2ED',
cream: '#FAFAF5', forest: '#1E2620', stone: '#6B7066',
border: '#DDE8E0', white: '#FFFFFF', amber: '#C17F47', amberLight: '#FBF0E4',
blue: '#4A8FA8',
}

const US_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY']
const DIET_OPTIONS = ['No shellfish', 'No nuts', 'No dairy', 'No gluten', 'Vegetarian', 'Vegan', 'Halal', 'Kosher']

const MEAL_BADGE: Record<string, { label: string; color: string; bg: string }> = {
breakfast: { label: '🌅 Breakfast', color: '#E8834A', bg: '#FFF0E8' },
lunch: { label: '☀️ Lunch', color: '#4A8FA8', bg: '#E8F4F8' },
dinner: { label: '🌙 Dinner', color: '#3D6B4F', bg: '#EAF2ED' },
}

const DELIVERY_WINDOWS = [
{ key: '07:00-09:00', label: '7:00 AM – 9:00 AM', start: '07:00', end: '09:00', meal: 'breakfast' },
{ key: '08:00-10:00', label: '8:00 AM – 10:00 AM', start: '08:00', end: '10:00', meal: 'breakfast' },
{ key: '11:00-12:30', label: '11:00 AM – 12:30 PM', start: '11:00', end: '12:30', meal: 'lunch' },
{ key: '12:00-13:30', label: '12:00 PM – 1:30 PM', start: '12:00', end: '13:30', meal: 'lunch' },
{ key: '17:00-18:30', label: '5:00 PM – 6:30 PM', start: '17:00', end: '18:30', meal: 'dinner' },
{ key: '17:30-19:00', label: '5:30 PM – 7:00 PM', start: '17:30', end: '19:00', meal: 'dinner' },
{ key: '18:00-19:30', label: '6:00 PM – 7:30 PM', start: '18:00', end: '19:30', meal: 'dinner' },
]

const TIERS = [
{ key: 'free', badge: 'Free', name: 'Kitchen', price: '$0', period: '/ always', blurb: 'Start free — 3 restaurants, 60-day calendar.' },
{ key: 'care', badge: 'Care+', name: 'Care+', price: '$9.99', period: '/ month', highlight: 'Most popular', blurb: '10 restaurants, unlimited calendar, full SMS.' },
{ key: 'annual', badge: 'Early Adopter', name: 'Care+ Annual', price: '$59', period: '/ year', highlight: 'Best value', blurb: 'Everything in Care+, 50% off, locked rate.' },
{ key: 'founding', badge: 'Founding', name: 'Lifetime', price: '$149', period: 'once', highlight: 'First 100', blurb: 'Pay once. Every feature, forever.' },
]

type Step = 'profile' | 'address' | 'calendar' | 'delivery' | 'plan' | 'review'
type DateSlots = Record<string, string[]>

function formatDate(dateStr: string) {
return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export default function OnboardingPage() {
const router = useRouter()
const supabase = createClient()
const [mounted, setMounted] = useState(false)

const [step, setStep] = useState<Step>('profile')
const [loading, setLoading] = useState(false)
const [error, setError] = useState('')
const [userId, setUserId] = useState('')

const [form, setForm] = useState({
full_name: '', phone: '', sms_consent: false,
household_adults: 2, household_children: 2,
dietary_restrictions: [] as string[],
street: '', apt: '', city: '', state: 'TX', zip: '',
})
const [addressConfirmed, setAddressConfirmed] = useState(false)
const [selectedTier, setSelectedTier] = useState('free')

const [dateSlots, setDateSlots] = useState<DateSlots>({})
const [pickerDate, setPickerDate] = useState<string | null>(null)
const [breakfastWindows, setBreakfastWindows] = useState<string[]>([])
const [lunchWindows, setLunchWindows] = useState<string[]>([])
const [dinnerWindows, setDinnerWindows] = useState<string[]>(['17:30-19:00'])

const toggleWindow = (meal: 'breakfast'|'lunch'|'dinner', windowKey: string) => {
const setters = { breakfast: setBreakfastWindows, lunch: setLunchWindows, dinner: setDinnerWindows }
const values = { breakfast: breakfastWindows, lunch: lunchWindows, dinner: dinnerWindows }
const current = values[meal]
setters[meal](current.includes(windowKey) ? current.filter(w => w !== windowKey) : [...current, windowKey])
}

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
setMounted(true)
const load = async () => {
const { data: { user } } = await supabase.auth.getUser()
if (!user) { router.push('/login'); return }
setUserId(user.id)
// If they already have a kitchen, onboarding is done — go to dashboard
const { data: existing } = await supabase.from('kitchens').select('id').eq('organizer_id', user.id).limit(1)
if (existing && existing.length > 0) { router.push('/dashboard'); return }
// Pre-fill name from auth metadata if present
const metaName = (user.user_metadata?.full_name as string) || (user.user_metadata?.name as string) || ''
if (metaName) setForm(f => ({ ...f, full_name: metaName }))
}
load()
}, [])

const update = (field: string, value: any) => setForm(prev => ({ ...prev, [field]: value }))
const toggleDiet = (d: string) => setForm(prev => ({
...prev,
dietary_restrictions: prev.dietary_restrictions.includes(d) ? prev.dietary_restrictions.filter(x => x !== d) : [...prev.dietary_restrictions, d],
}))
const toggleMealSlot = (dateStr: string, mealType: string) => {
setDateSlots(prev => {
const current = prev[dateStr] || []
const updated = current.includes(mealType) ? current.filter(m => m !== mealType) : [...current, mealType]
if (updated.length === 0) { const { [dateStr]: _, ...rest } = prev; return rest }
return { ...prev, [dateStr]: updated }
})
}

const address = `${form.street}${form.apt ? ` ${form.apt}` : ''}, ${form.city}, ${form.state} ${form.zip}`.replace(/^,\s*/, '').trim()
const calendarDatesPayload = Object.entries(dateSlots).flatMap(([date, meals]) => meals.map(meal_type => ({ date, meal_type })))
const totalDateCount = Object.keys(dateSlots).length
const totalSlotCount = calendarDatesPayload.length

const addressValid = form.street.trim().length > 3 && form.city.trim() && form.zip.trim().length >= 5
const profileValid = form.full_name.trim() && form.phone.trim() && form.sms_consent

const allSelectedWindowKeys = [...breakfastWindows, ...lunchWindows, ...dinnerWindows]
const hasWindows = allSelectedWindowKeys.length > 0
const defaultWindow = DELIVERY_WINDOWS.find(w => w.key === allSelectedWindowKeys[0]) || DELIVERY_WINDOWS[5]

const handleFinish = async () => {
setLoading(true); setError('')
const { data: { user } } = await supabase.auth.getUser()
if (!user) { router.push('/login'); return }
const { data: existing } = await supabase.from('kitchens').select('id').eq('organizer_id', user.id).limit(1)
if (existing && existing.length > 0) { router.push('/dashboard'); return }

const res = await fetch('/api/onboarding', {
method: 'POST', headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({
user_id: user.id,
full_name: form.full_name.trim(),
phone: form.phone,
sms_consent: form.sms_consent,
address,
street: form.street, apt: form.apt, city: form.city, state: form.state, zip: form.zip,
household_adults: form.household_adults,
household_children: form.household_children,
household_size: `${form.household_adults + form.household_children}`,
dietary_restrictions: form.dietary_restrictions,
tier: selectedTier,
restaurants: [],
calendar_dates: calendarDatesPayload,
breakfast_windows: breakfastWindows,
lunch_windows: lunchWindows,
dinner_windows: dinnerWindows,
delivery_window_start: defaultWindow.start,
delivery_window_end: defaultWindow.end,
}),
})
const data = await res.json()
if (!res.ok) { setError(data.error || 'Something went wrong.'); setLoading(false); return }
await new Promise(r => setTimeout(r, 800))
router.push('/kitchen/restaurants?welcome=1')
}

const steps: Step[] = ['profile', 'address', 'calendar', 'delivery', 'plan', 'review']
const stepIndex = steps.indexOf(step)
const stepLabels = ['Profile', 'Address', 'Dates', 'Delivery', 'Plan', 'Review']

// Prevent SSR from trying to render auth-gated content — causes prerender crash
if (!mounted) return null

return (
<div style={{ minHeight: '100vh', background: S.cream, fontFamily: "'DM Sans', sans-serif" }}>
<link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />

<nav style={{ background: S.white, borderBottom: `0.5px solid ${S.border}`, padding: '14px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
<div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
<span style={{ fontSize: 8, fontWeight: 500, letterSpacing: 5, color: S.sageMid, textTransform: 'uppercase' }}>Your</span>
<span style={{ fontFamily: "'Lora', serif", fontSize: 20, fontWeight: 500, color: S.forest, letterSpacing: -0.5 }}>Kitchen</span>
</div>
<div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
{steps.map((s, i) => (
<div key={s} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
{i > 0 && <div style={{ width: 14, height: 1, background: S.border }} />}
<div style={{
width: 22, height: 22, borderRadius: '50%',
background: i < stepIndex ? S.sage : i === stepIndex ? S.forest : S.border,
color: i <= stepIndex ? S.white : S.stone,
display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700,
}}>{i < stepIndex ? '✓' : i + 1}</div>
</div>
))}
</div>
<button onClick={async () => { await supabase.auth.signOut(); router.push('/signup') }}
style={{ background: 'none', border: 'none', fontSize: 12, fontWeight: 500, color: S.stone, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
Sign out
</button>
</nav>

<div style={{ maxWidth: 560, margin: '0 auto', padding: '36px 24px 80px' }}>

{/* STEP 1: PROFILE */}
{step === 'profile' && (
<div>
<p style={eyebrow}>Step 1 of 6</p>
<h1 style={title}>Tell us about<br />your household</h1>
<p style={sub}>Your village will see your name — never your phone or address.</p>

<label style={lbl}>Your name</label>
<input value={form.full_name} onChange={e => update('full_name', e.target.value)} placeholder="Danielle Moore" style={inputSt} />

<label style={lbl}>Phone number</label>
<input type="tel" value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="(936) 555-0142" style={inputSt} />
<p style={{ fontSize: 11, color: S.stone, fontWeight: 300, margin: '-8px 0 16px' }}>Used only for Y/N meal confirmations via SMS.</p>

<div style={{ background: S.sageLight, border: `1.5px solid ${S.border}`, borderRadius: 10, padding: 16, marginBottom: 20 }}>
<label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer' }}>
<input type="checkbox" checked={form.sms_consent} onChange={e => update('sms_consent', e.target.checked)} style={{ width: 18, height: 18, accentColor: S.sage, flexShrink: 0, marginTop: 2 }} />
<span style={{ fontSize: 12, color: S.stone, lineHeight: 1.6, fontWeight: 300 }}>
I agree to receive recurring SMS from YourKitchen — meal proposals, confirmations, and delivery updates. Message frequency varies. Message &amp; data rates may apply. Reply STOP to opt out, HELP for help. <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: S.sage }}>Terms of Service</a>
</span>
</label>
</div>

<label style={lbl}>Household — adults</label>
<div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
{[1,2,3,4,5,6].map(n => (
<button key={n} onClick={() => update('household_adults', n)}
style={{ flex: 1, padding: '11px 4px', borderRadius: 10, border: 'none', background: form.household_adults === n ? S.sage : S.sageLight, color: form.household_adults === n ? S.white : S.sage, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>{n}</button>
))}
</div>

<label style={lbl}>Household — children</label>
<div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
{[0,1,2,3,4,5].map(n => (
<button key={n} onClick={() => update('household_children', n)}
style={{ flex: 1, padding: '11px 4px', borderRadius: 10, border: 'none', background: form.household_children === n ? S.amber : S.amberLight, color: form.household_children === n ? S.white : S.amber, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>{n}</button>
))}
</div>

<label style={lbl}>Dietary restrictions</label>
<div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 28 }}>
{DIET_OPTIONS.map(d => (
<button key={d} onClick={() => toggleDiet(d)}
style={{ padding: '8px 16px', borderRadius: 20, border: 'none', cursor: 'pointer', background: form.dietary_restrictions.includes(d) ? S.sage : S.sageLight, color: form.dietary_restrictions.includes(d) ? S.white : S.sage, fontSize: 13, fontWeight: 500, fontFamily: "'DM Sans', sans-serif" }}>{d}</button>
))}
</div>

<button onClick={() => setStep('address')} disabled={!profileValid} style={btnPrimary(!profileValid)}>Next: Delivery Address →</button>
</div>
)}

{/* STEP 2: ADDRESS */}
{step === 'address' && (
<div>
<p style={eyebrow}>Step 2 of 6</p>
<h1 style={title}>Where should<br />meals be delivered?</h1>
<p style={sub}>Double-check it's right — we use it to find restaurants near you.</p>

<label style={lbl}>Street address</label>
<input value={form.street} onChange={e => update('street', e.target.value)} placeholder="1422 Oak Creek Dr" style={inputSt} />

<label style={lbl}>Apt / Suite <span style={{ fontWeight: 300, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
<input value={form.apt} onChange={e => update('apt', e.target.value)} placeholder="Apt 4B" style={inputSt} />

<label style={lbl}>City</label>
<input value={form.city} onChange={e => update('city', e.target.value)} placeholder="Waller" style={inputSt} />

<div style={{ display: 'flex', gap: 12 }}>
<div style={{ flex: 1 }}>
<label style={lbl}>State</label>
<select value={form.state} onChange={e => update('state', e.target.value)} style={inputSt}>
{US_STATES.map(s => <option key={s}>{s}</option>)}
</select>
</div>
<div style={{ flex: 1 }}>
<label style={lbl}>ZIP</label>
<input value={form.zip} onChange={e => update('zip', e.target.value)} placeholder="77484" maxLength={5} style={inputSt} />
</div>
</div>

{addressValid && (
<div style={{ background: S.sageLight, border: `1px solid #C8DDD0`, borderRadius: 12, padding: '14px 16px', margin: '4px 0 20px' }}>
<p style={{ fontSize: 11, fontWeight: 700, color: S.sage, letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 6px' }}>We'll deliver to</p>
<p style={{ fontSize: 14, color: S.forest, fontWeight: 500, margin: '0 0 10px', lineHeight: 1.5 }}>{address}</p>
<label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
<input type="checkbox" checked={addressConfirmed} onChange={e => setAddressConfirmed(e.target.checked)} style={{ width: 16, height: 16, accentColor: S.sage }} />
<span style={{ fontSize: 13, color: '#2D5240', fontWeight: 500 }}>Yes, this address is correct</span>
</label>
</div>
)}

<div style={{ display: 'flex', gap: 10 }}>
<button onClick={() => setStep('profile')} style={btnBack}>← Back</button>
<button onClick={() => setStep('calendar')} disabled={!addressValid || !addressConfirmed} style={{ ...btnPrimary(!addressValid || !addressConfirmed), flex: 1 }}>Next: Set My Calendar →</button>
</div>
</div>
)}

{/* STEP 3: CALENDAR */}
{step === 'calendar' && (
<div>
<p style={eyebrow}>Step 3 of 6</p>
<h1 style={title}>Which days do you<br />need meals?</h1>
<p style={sub}>Tap a date, then choose which meals you need. Your village sees these as open.</p>

<div style={{ background: S.white, border: `1px solid ${S.border}`, borderRadius: 16, padding: 18, marginBottom: 16 }}>
<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
<button onClick={prevMonth} style={navBtn}>‹</button>
<p style={{ fontFamily: "'Lora', serif", fontSize: 16, fontWeight: 500, color: S.forest, margin: 0 }}>{monthName}</p>
<button onClick={nextMonth} style={navBtn}>›</button>
</div>
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 3, marginBottom: 4 }}>
{['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: S.stone, padding: '2px 0' }}>{d}</div>)}
</div>
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 3 }}>
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
background: isPicker ? S.sageLight : hasSlots ? '#F8FAF8' : S.white,
border: `${isPicker || isToday ? 2 : 1}px solid ${isPicker ? S.sage : isToday ? S.sageMid : hasSlots ? '#C8DDD0' : S.border}`,
borderRadius: 10, padding: '8px 2px', minHeight: 'clamp(44px,12vw,56px)', cursor: isPast ? 'default' : 'pointer',
display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
fontFamily: "'DM Sans', sans-serif", opacity: isPast ? 0.3 : 1,
}}>
<span style={{ fontSize: 13, fontWeight: isToday ? 700 : 500, color: isPicker ? S.sage : S.forest, lineHeight: 1 }}>{day}</span>
{hasSlots ? (
<div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
{slots.map((m, mi) => <div key={mi} style={{ width: 6, height: 6, borderRadius: '50%', background: MEAL_BADGE[m]?.color || S.sage }} />)}
</div>
) : !isPast ? <div style={{ fontSize: 14, color: S.border }}>+</div> : null}
</button>
)
})}
</div>
<div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12, paddingTop: 12, borderTop: `0.5px solid ${S.border}` }}>
{Object.entries(MEAL_BADGE).map(([k, v]) => (
<div key={k} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
<div style={{ width: 7, height: 7, borderRadius: '50%', background: v.color }} />
<span style={{ fontSize: 10, color: S.stone, fontWeight: 500 }}>{v.label}</span>
</div>
))}
</div>
</div>

{pickerDate && (
<div style={{ background: S.white, border: `2px solid ${S.sage}`, borderRadius: 14, padding: '16px 18px', marginBottom: 16 }}>
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
<p style={{ fontFamily: "'Lora', serif", fontSize: 15, fontWeight: 500, color: S.forest, margin: 0 }}>{formatDate(pickerDate)}</p>
<button onClick={() => setPickerDate(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: S.stone }}>✕</button>
</div>
<p style={{ fontSize: 12, color: S.stone, fontWeight: 300, margin: '0 0 12px' }}>Which meals do you need this day?</p>
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
{(['breakfast', 'lunch', 'dinner'] as const).map(mealType => {
const mb = MEAL_BADGE[mealType]
const isOn = (dateSlots[pickerDate] || []).includes(mealType)
return (
<button key={mealType} onClick={() => toggleMealSlot(pickerDate, mealType)}
style={{ background: isOn ? mb.bg : S.white, border: `2px solid ${isOn ? mb.color : S.border}`, borderRadius: 10, padding: '12px 8px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", textAlign: 'center' }}>
<div style={{ fontSize: 18, marginBottom: 4 }}>{mb.label.split(' ')[0]}</div>
<div style={{ fontSize: 11, fontWeight: 600, color: isOn ? mb.color : S.stone }}>{isOn ? '✓ Added' : mb.label.split(' ')[1]}</div>
</button>
)
})}
</div>
</div>
)}

{totalDateCount > 0 && (
<div style={{ background: S.sageLight, borderRadius: 12, padding: '12px 16px', marginBottom: 16 }}>
<p style={{ fontSize: 11, fontWeight: 700, color: S.sage, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 8px' }}>
{totalDateCount} date{totalDateCount > 1 ? 's' : ''} · {totalSlotCount} meal slot{totalSlotCount > 1 ? 's' : ''}
</p>
<div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
{Object.entries(dateSlots).sort(([a],[b]) => a.localeCompare(b)).map(([date, meals]) => (
<div key={date} style={{ display: 'flex', alignItems: 'center', gap: 4, background: S.white, border: '1px solid #C8DDD0', borderRadius: 8, padding: '4px 10px' }}>
<span style={{ fontSize: 11, color: '#2D5240', fontWeight: 500 }}>{formatDate(date)}</span>
<div style={{ display: 'flex', gap: 2 }}>{meals.map(m => <div key={m} style={{ width: 6, height: 6, borderRadius: '50%', background: MEAL_BADGE[m]?.color || S.sage }} />)}</div>
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

{/* STEP 4: DELIVERY */}
{step === 'delivery' && (
<div>
<p style={eyebrow}>Step 4 of 6</p>
<h1 style={title}>When should<br />meals arrive?</h1>
<p style={sub}>Select all the windows that work for you — your village picks from these. Change them anytime.</p>

{(['breakfast', 'lunch', 'dinner'] as const).map(mt => {
const mb = MEAL_BADGE[mt]
const windows = DELIVERY_WINDOWS.filter(w => w.meal === mt)
const current = { breakfast: breakfastWindows, lunch: lunchWindows, dinner: dinnerWindows }[mt]
return (
<div key={mt} style={{ marginBottom: 20 }}>
<div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
<span style={{ background: mb.bg, color: mb.color, fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>{mb.label}</span>
</div>
<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
{windows.map(w => {
const on = current.includes(w.key)
return (
<button key={w.key} onClick={() => toggleWindow(mt, w.key)}
style={{ background: on ? `${mb.color}15` : S.white, border: `1.5px solid ${on ? mb.color : S.border}`, borderRadius: 12, padding: '13px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, fontFamily: "'DM Sans', sans-serif", textAlign: 'left' }}>
<div style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${on ? mb.color : S.border}`, background: on ? mb.color : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
{on && <span style={{ color: S.white, fontSize: 11, fontWeight: 700 }}>✓</span>}
</div>
<span style={{ fontFamily: "'Lora', serif", fontSize: 15, fontWeight: on ? 600 : 500, color: on ? mb.color : S.forest }}>{w.label}</span>
</button>
)
})}
</div>
</div>
)
})}

<div style={{ display: 'flex', gap: 10 }}>
<button onClick={() => setStep('calendar')} style={btnBack}>← Back</button>
<button onClick={() => setStep('plan')} disabled={!hasWindows} style={{ ...btnPrimary(!hasWindows), flex: 1 }}>Next: Choose a Plan →</button>
</div>
</div>
)}

{/* STEP 5: PLAN */}
{step === 'plan' && (
<div>
<p style={eyebrow}>Step 5 of 6</p>
<h1 style={title}>Choose<br />your plan</h1>
<p style={sub}>Most people start free and upgrade when they see how much their village shows up.</p>

<div style={{ background: S.sageLight, borderRadius: 14, padding: '16px 20px', marginBottom: 20 }}>
<p style={{ fontFamily: "'Lora', serif", fontSize: 15, fontWeight: 500, color: S.forest, margin: '0 0 4px' }}>✦ Every paid plan starts with a 14-day free trial</p>
<p style={{ fontSize: 13, color: S.stone, fontWeight: 300, lineHeight: 1.6, margin: 0 }}>No card required. You're never charged without choosing to upgrade.</p>
</div>

<div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
{TIERS.map(t => {
const sel = selectedTier === t.key
return (
<button key={t.key} onClick={() => setSelectedTier(t.key)}
style={{ background: sel ? S.sageLight : S.white, border: `2px solid ${sel ? S.sage : S.border}`, borderRadius: 14, padding: '16px 18px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", textAlign: 'left', position: 'relative' }}>
{t.highlight && <span style={{ position: 'absolute', top: -9, right: 16, background: t.key === 'founding' ? S.amber : S.sage, color: S.white, fontSize: 10, fontWeight: 700, padding: '2px 10px', borderRadius: 10 }}>{t.highlight}</span>}
<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
<div>
<div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
<span style={{ fontFamily: "'Lora', serif", fontSize: 16, fontWeight: 600, color: S.forest }}>{t.name}</span>
<span style={{ fontSize: 16, fontWeight: 700, color: t.key === 'founding' ? S.amber : S.forest }}>{t.price}</span>
<span style={{ fontSize: 12, color: S.stone, fontWeight: 300 }}>{t.period}</span>
</div>
<p style={{ fontSize: 12, color: S.stone, fontWeight: 300, margin: '4px 0 0', lineHeight: 1.5 }}>{t.blurb}</p>
</div>
<div style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${sel ? S.sage : S.border}`, background: sel ? S.sage : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: S.white, fontSize: 12, flexShrink: 0, marginLeft: 12 }}>
{sel ? '✓' : ''}
</div>
</div>
</button>
)
})}
</div>

<div style={{ display: 'flex', gap: 10 }}>
<button onClick={() => setStep('delivery')} style={btnBack}>← Back</button>
<button onClick={() => setStep('review')} style={{ ...btnPrimary(false), flex: 1 }}>Next: Review →</button>
</div>
<p style={{ fontSize: 11, color: S.stone, textAlign: 'center', margin: '16px 0 0', fontWeight: 300, lineHeight: 1.6 }}>
You can change your plan anytime. Founding Member is limited to the first 100 members.
</p>
</div>
)}

{/* STEP 6: REVIEW */}
{step === 'review' && (
<div>
<p style={eyebrow}>Step 6 of 6</p>
<h1 style={title}>Your Kitchen<br />is almost ready.</h1>
<p style={sub}>One last look. Next, you'll add the restaurants your village can order from.</p>

<div style={{ background: S.white, border: `0.5px solid ${S.border}`, borderRadius: 16, padding: '18px 20px', marginBottom: 14 }}>
<p style={sectionLabel}>Your details</p>
{[
['Name', form.full_name || '—'],
['Phone', form.phone || '—'],
['Delivery address', address || '—'],
['Household', `${form.household_adults} adult${form.household_adults !== 1 ? 's' : ''}, ${form.household_children} child${form.household_children !== 1 ? 'ren' : ''}`],
['Dietary', form.dietary_restrictions.join(', ') || 'None'],
['Plan', TIERS.find(t => t.key === selectedTier)?.name || 'Free'],
].map(([l, v]) => (
<div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `0.5px solid ${S.sageLight}` }}>
<span style={{ fontSize: 12, color: S.stone, fontWeight: 300 }}>{l}</span>
<span style={{ fontSize: 12, color: S.forest, fontWeight: 500, textAlign: 'right', maxWidth: '55%' }}>{v}</span>
</div>
))}
</div>

<div style={{ background: S.white, border: `0.5px solid ${S.border}`, borderRadius: 16, padding: '18px 20px', marginBottom: 14 }}>
<p style={sectionLabel}>Open dates ({totalDateCount}) · {totalSlotCount} slot{totalSlotCount !== 1 ? 's' : ''}</p>
<div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
{Object.entries(dateSlots).sort(([a],[b]) => a.localeCompare(b)).map(([date, meals]) => (
<div key={date} style={{ display: 'flex', alignItems: 'center', gap: 4, background: S.sageLight, borderRadius: 8, padding: '5px 10px' }}>
<span style={{ fontSize: 11, color: '#2D5240', fontWeight: 500 }}>{formatDate(date)}</span>
<div style={{ display: 'flex', gap: 2 }}>{meals.map(m => <div key={m} style={{ width: 6, height: 6, borderRadius: '50%', background: MEAL_BADGE[m]?.color || S.sage }} />)}</div>
</div>
))}
</div>
<div style={{ marginTop: 10, paddingTop: 10, borderTop: `0.5px solid ${S.sageLight}` }}>
<span style={{ fontSize: 12, color: S.stone, fontWeight: 300 }}>Delivery windows: </span>
<span style={{ fontSize: 12, color: S.forest, fontWeight: 500 }}>
{allSelectedWindowKeys.map(k => DELIVERY_WINDOWS.find(w => w.key === k)?.label).filter(Boolean).join(' · ')}
</span>
</div>
</div>

<div style={{ background: S.white, border: `1.5px solid ${S.amber}`, borderRadius: 14, padding: '18px 20px', marginBottom: 20 }}>
<p style={{ fontFamily: "'Lora', serif", fontSize: 15, fontWeight: 600, color: S.forest, margin: '0 0 10px' }}>
🏪 Before you continue — have these ready
</p>
<p style={{ fontSize: 13, color: S.stone, fontWeight: 300, margin: '0 0 14px', lineHeight: 1.7 }}>
The next step is adding your favorite restaurants and the exact dishes your family loves. While we're in pilot, you'll enter this manually — so it helps to have your go-to menus open on your phone before you tap the button below.
</p>
<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
{[
['🍽', '2–5 restaurants', 'Places you order from regularly — takeout or delivery-friendly.'],
['📋', 'Exact dish names', 'As they appear on the menu — your village will see them.'],
['💵', 'Current prices', 'Check the menu or app today — prices change.'],
['👤🧒', 'Adult vs kids dishes', 'Know which meals are for the adults and which are for the kids.'],
].map(([icon, label, desc]) => (
<div key={label} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
<span style={{ fontSize: 16, lineHeight: 1.5, flexShrink: 0 }}>{icon}</span>
<div>
<span style={{ fontSize: 13, fontWeight: 600, color: S.forest }}>{label} </span>
<span style={{ fontSize: 13, color: S.stone, fontWeight: 300 }}>{desc}</span>
</div>
</div>
))}
</div>
<p style={{ fontSize: 12, color: S.stone, fontWeight: 300, margin: '12px 0 0', lineHeight: 1.6, borderTop: `0.5px solid #F0E2B8`, paddingTop: 10 }}>
Not ready right now? No problem — tap the button and you can always come back to add restaurants later. Your link goes live as soon as you add the first one.
</p>
</div>

{error && (
<div style={{ background: '#FDE8E8', border: `1.5px solid #B94040`, borderRadius: 12, padding: '12px 16px', marginBottom: 16 }}>
<p style={{ fontSize: 13, color: '#B94040', margin: 0 }}>⚠️ {error}</p>
</div>
)}

<div style={{ display: 'flex', gap: 10 }}>
<button onClick={() => setStep('plan')} style={btnBack}>← Back</button>
<button onClick={handleFinish} disabled={loading} style={{ ...btnPrimary(loading), flex: 1 }}>
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
fontFamily: "'DM Sans', sans-serif",
})

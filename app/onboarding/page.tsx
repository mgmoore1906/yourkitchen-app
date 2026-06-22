'use client'
import { useState, useEffect, useRef } from 'react'
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
{ key: '19:30-21:00', label: '7:30 PM – 9:00 PM', start: '19:30', end: '21:00', meal: 'dinner' },
]

// During the pilot, only two choices are offered — no feature comparison.
// Pilot Account = full access free. Founding = $200 one-time (3 years of Care+
// that begins at beta launch, so the pilot is a free bonus on top).
// Post-pilot, the full 3-tier / 4-option plan selection returns.
const FOUNDING_PAYMENT_LINK = 'https://buy.stripe.com/5kQ00beDq9XD9BX5w5abK01'

const TIERS = [
{ key: 'trial', badge: 'Pilot', name: 'Pilot Account', price: 'Free', period: 'full access', highlight: 'Pilot', blurb: 'Everything unlocked while we build together. No card, no charge — you help shape YourKitchen.' },
{ key: 'founding', badge: 'Founding', name: 'Founding Member', price: '$200', period: 'one-time', highlight: 'First 250', blurb: 'Back YourKitchen as a founder: permanent badge, founder access, the Founders Gift Box, and 3 years of Care+. Your 3 years starts at beta launch — the pilot is on us.' },
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
use_case: '',
household_adults: 2, household_children: 2,
dietary_restrictions: [] as string[],
street: '', apt: '', city: '', state: 'TX', zip: '',
})
const [addressConfirmed, setAddressConfirmed] = useState(false)
const [addrVerified, setAddrVerified] = useState(false)
const [verifiedAddress, setVerifiedAddress] = useState('')
const [verifying, setVerifying] = useState(false)
const [verifyError, setVerifyError] = useState('')
const [otpSent, setOtpSent] = useState(false)
const [otpCode, setOtpCode] = useState('')
const [otpSending, setOtpSending] = useState(false)
const [otpChecking, setOtpChecking] = useState(false)
const [phoneVerified, setPhoneVerified] = useState(false)
const [otpError, setOtpError] = useState('')
const [pn, setPn] = useState({ a: '', b: '', c: '' })
const pnB = useRef<HTMLInputElement>(null)
const pnC = useRef<HTMLInputElement>(null)
const [selectedTier, setSelectedTier] = useState('trial')

const [dateSlots, setDateSlots] = useState<DateSlots>({})
const [pickerDate, setPickerDate] = useState<string | null>(null)
const [breakfastWindows, setBreakfastWindows] = useState<string[]>([])
const [lunchWindows, setLunchWindows] = useState<string[]>([])
const [dinnerWindows, setDinnerWindows] = useState<string[]>([])

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

// Tap-and-slide multi-date selection (mirrors the dashboard calendar)
const paintingRef = useRef(false)
const dragMovedRef = useRef(false)
const [paintSet, setPaintSet] = useState<Set<string>>(new Set())
const [rangeMeals, setRangeMeals] = useState<Set<string>>(new Set())
const toggleRangeMeal = (mt: string) => setRangeMeals(prev => { const n = new Set(prev); n.has(mt) ? n.delete(mt) : n.add(mt); return n })
const dateAtPoint = (x: number, y: number): string | null => {
const el = document.elementFromPoint(x, y) as HTMLElement | null
const cell = el?.closest?.('[data-cal-date]') as HTMLElement | null
if (!cell || cell.getAttribute('data-cal-past') === '1') return null
return cell.getAttribute('data-cal-date')
}
const beginPaint = (dt: string | null) => { if (!dt) return; paintingRef.current = true; dragMovedRef.current = false; setPaintSet(new Set([dt])) }
const extendPaint = (x: number, y: number) => {
if (!paintingRef.current) return
const dt = dateAtPoint(x, y); if (!dt) return
setPaintSet(prev => { if (prev.has(dt)) return prev; const n = new Set(prev); n.add(dt); if (n.size > 1) dragMovedRef.current = true; return n })
}
const finishPaint = () => { if (!paintingRef.current) return; paintingRef.current = false; if (!dragMovedRef.current) setPaintSet(new Set()) }
const applyRangeMeals = () => {
if (paintSet.size === 0 || rangeMeals.size === 0) return
setDateSlots(prev => { const next = { ...prev }; paintSet.forEach(dt => { next[dt] = [...new Set([...(next[dt] || []), ...rangeMeals])] }); return next })
setPaintSet(new Set()); dragMovedRef.current = false
}
const clearPaintedDays = () => {
setDateSlots(prev => { const next = { ...prev }; paintSet.forEach(dt => { delete next[dt] }); return next })
setPaintSet(new Set()); dragMovedRef.current = false
}

useEffect(() => {
setMounted(true)
const load = async () => {
const { data: { user } } = await supabase.auth.getUser()
if (!user) { router.push('/login'); return }
setUserId(user.id)
// Onboarding "done" is NOT just "has a kitchen" — the kitchen is created at
// finish, BEFORE the restaurants step (which lives at /kitchen/restaurants).
// So a kitchen can exist while setup is still in progress. If we redirect to
// /dashboard on "has kitchen", hitting back/forward into onboarding kicks the
// user out mid-setup. Real "done" = has a kitchen WITH at least one restaurant.
const { data: existing } = await supabase.from('kitchens').select('id').eq('organizer_id', user.id).limit(1)
if (existing && existing.length > 0) {
  const kId = existing[0].id
  const { data: rests } = await supabase.from('kitchen_restaurants').select('id').eq('kitchen_id', kId).limit(1)
  if (rests && rests.length > 0) {
    // Kitchen + at least one restaurant → setup truly complete → dashboard
    router.push('/dashboard'); return
  }
  // Kitchen exists but no restaurants yet → still finishing setup → continue there
  router.push('/kitchen/restaurants?welcome=1'); return
}
// Pre-fill name from auth metadata if present
const metaName = (user.user_metadata?.full_name as string) || (user.user_metadata?.name as string) || ''
if (metaName) setForm(f => ({ ...f, full_name: metaName }))
}
load()
}, [])

const update = (field: string, value: any) => setForm(prev => ({ ...prev, [field]: value }))
const updateAddr = (field: string, value: any) => { setForm(prev => ({ ...prev, [field]: value })); setAddrVerified(false); setAddressConfirmed(false); setVerifyError('') }
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
const verifyAddress = async () => {
  setVerifying(true); setVerifyError(''); setAddrVerified(false)
  try {
    const res = await fetch('/api/validate-address', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address }) })
    const data = await res.json()
    if (data.ok) { setVerifiedAddress(data.formatted); setAddrVerified(true) }
    else if (data.reason === 'imprecise') { setVerifyError('We found a close match but not an exact address. Add the house or building number so a driver can find it.') }
    else { setVerifyError("We couldn't find that address. Double-check the street, city, and ZIP — it needs to be a real, complete delivery address.") }
  } catch { setVerifyError('Could not check the address right now. Please try again.') }
  setVerifying(false)
}
const setPhonePart = (part: 'a' | 'b' | 'c', val: string) => {
  let digits = (val || '').replace(/\D/g, '')
  // Full-number paste into any box: distribute across all three so any format works.
  if (digits.length >= 7) {
    if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1)
    const a = digits.slice(0, 3), b = digits.slice(3, 6), c = digits.slice(6, 10)
    setPn({ a, b, c }); update('phone', `${a}${b}${c}`)
    setOtpSent(false); setPhoneVerified(false); setOtpError(''); setOtpCode('')
    setTimeout(() => pnC.current?.focus(), 0)
    return
  }
  const max = part === 'c' ? 4 : 3
  digits = digits.slice(0, max)
  const next = { ...pn, [part]: digits }
  setPn(next); update('phone', `${next.a}${next.b}${next.c}`)
  setOtpSent(false); setPhoneVerified(false); setOtpError(''); setOtpCode('')
  if (part === 'a' && digits.length === 3) pnB.current?.focus()
  if (part === 'b' && digits.length === 3) pnC.current?.focus()
}
const sendOtp = async () => {
  setOtpSending(true); setOtpError('')
  try {
    const res = await fetch('/api/otp/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: form.phone }) })
    const data = await res.json()
    if (data.ok) { setOtpSent(true) }
    else if (data.error === 'not_configured') setOtpError("Phone verification isn't set up yet (Verify Service SID missing in the app's environment).")
    else setOtpError(`Couldn't send a code${data.code ? ` \u2014 Twilio error ${data.code}` : ''}: ${data.error || 'unknown error'}`)
  } catch { setOtpError('Could not send the code right now. Please try again.') }
  setOtpSending(false)
}
const checkOtp = async () => {
  setOtpChecking(true); setOtpError('')
  try {
    const res = await fetch('/api/otp/check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: form.phone, code: otpCode }) })
    const data = await res.json()
    if (data.ok) { setPhoneVerified(true); setOtpError('') }
    else setOtpError("That code didn't match. Double-check it, or resend a new one.")
  } catch { setOtpError('Could not verify right now. Please try again.') }
  setOtpChecking(false)
}
const calendarDatesPayload = Object.entries(dateSlots).flatMap(([date, meals]) => meals.map(meal_type => ({ date, meal_type })))
const totalDateCount = Object.keys(dateSlots).length
const totalSlotCount = calendarDatesPayload.length

const addressValid = form.street.trim().length > 3 && form.city.trim() && form.zip.trim().length >= 5
const phoneDigits = form.phone.replace(/\D/g, '')
const phoneValid = (phoneDigits.length === 10 || (phoneDigits.length === 11 && phoneDigits.startsWith('1'))) && !/^(\d)\1+$/.test(phoneDigits)
// Phone verification is optional by default; set NEXT_PUBLIC_OTP_REQUIRED=true to make it a hard gate.
const otpRequired = process.env.NEXT_PUBLIC_OTP_REQUIRED === 'true'
const profileValid = !!form.full_name.trim() && phoneValid && (otpRequired ? phoneVerified : true) && form.sms_consent && !!form.use_case

const allSelectedWindowKeys = [...breakfastWindows, ...lunchWindows, ...dinnerWindows]
const hasWindows = allSelectedWindowKeys.length > 0
const defaultWindow = DELIVERY_WINDOWS.find(w => w.key === allSelectedWindowKeys[0]) || DELIVERY_WINDOWS[5]

// Holds the payment tab we open synchronously on click (popup-blocker-safe).
let payTab: Window | null = null

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
address: verifiedAddress || address,
street: form.street, apt: form.apt, city: form.city, state: form.state, zip: form.zip,
household_adults: form.household_adults,
household_children: form.household_children,
household_size: `${form.household_adults + form.household_children}`,
dietary_restrictions: form.dietary_restrictions,
use_case: form.use_case || null,
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
if (!res.ok) {
setError(data.error || 'Something went wrong.')
setLoading(false)
// If we pre-opened a payment tab for a founder but creation failed, close it.
if (payTab && !payTab.closed) payTab.close()
return
}
await new Promise(r => setTimeout(r, 800))
// Founders: the Stripe tab was opened synchronously on click (below) to dodge
// popup blockers. Point it at the payment link now, and continue THIS window
// into kitchen setup with a banner reminding them to finish paying. The account
// is already created as 'trial', so an unpaid founder still has a working pilot
// account — we provision founding status once the payment lands.
if (selectedTier === 'founding') {
// Bank-only ($200 ACH) founding checkout. Fetch the session URL, then point the
// pre-opened tab at it (the tab was opened synchronously on click to dodge popup
// blockers). If it fails, close the tab and continue — the account is already a
// working 'trial', so they can finish founding later from the restaurants banner.
try {
const fcRes = await fetch('/api/founding-checkout', {
method: 'POST', headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ user_id: user.id }),
})
const fcData = await fcRes.json()
if (fcData?.url) {
if (payTab && !payTab.closed) payTab.location.href = fcData.url
else window.open(fcData.url, '_blank')
} else if (payTab && !payTab.closed) { payTab.close() }
} catch { if (payTab && !payTab.closed) payTab.close() }
router.push('/kitchen/restaurants?welcome=1&founding=pending')
return
}
router.push('/kitchen/restaurants?welcome=1')
}

// Fired by the finish button. For founders we MUST open the payment tab here,
// synchronously inside the click gesture, or the browser's popup blocker kills
// it. Open a blank tab now; handleFinish points it at Stripe once the account
// is created (or closes it if creation fails).
const startFinish = () => {
if (selectedTier === 'founding') {
payTab = window.open('about:blank', '_blank')
}
handleFinish()
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
<input value={form.full_name} onChange={e => update('full_name', e.target.value)} placeholder="Megan Pete" style={inputSt} />

<label style={lbl}>Phone number</label>
<div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
<span style={{ color: S.stone, fontSize: 16, fontWeight: 300 }}>(</span>
<input inputMode="numeric" type="tel" value={pn.a} onChange={e => setPhonePart('a', e.target.value)} placeholder="713" maxLength={3} aria-label="Area code" style={phoneBox} />
<span style={{ color: S.stone, fontSize: 16, fontWeight: 300 }}>)</span>
<input ref={pnB} inputMode="numeric" type="tel" value={pn.b} onChange={e => setPhonePart('b', e.target.value)} placeholder="221" maxLength={3} aria-label="Prefix" style={phoneBox} />
<span style={{ color: S.stone, fontSize: 16 }}>-</span>
<input ref={pnC} inputMode="numeric" type="tel" value={pn.c} onChange={e => setPhonePart('c', e.target.value)} placeholder="6000" maxLength={4} aria-label="Line number" style={{ ...phoneBox, width: 86 }} />
</div>
<p style={{ fontSize: 11, color: S.stone, fontWeight: 300, margin: '-8px 0 4px' }}>Used only for Y/N meal confirmations via SMS.</p>
{form.phone.trim() && !phoneValid && (<p style={{ fontSize: 11, color: '#B94040', fontWeight: 400, margin: '0 0 16px' }}>Enter a valid 10-digit US mobile number we can text.</p>)}
{(!form.phone.trim() || phoneValid) && <div style={{ height: 12 }} />}
{phoneValid && !phoneVerified && (
<div style={{ background: S.sageLight, border: `1px solid #C8DDD0`, borderRadius: 12, padding: '14px 16px', margin: '0 0 16px' }}>
{!otpSent ? (
<button onClick={sendOtp} disabled={otpSending} style={{ width: '100%', padding: 11, background: otpSending ? S.border : S.white, color: S.sage, border: `1.5px solid ${S.sage}`, borderRadius: 10, fontSize: 13.5, fontWeight: 600, cursor: otpSending ? 'default' : 'pointer', fontFamily: "'DM Sans',sans-serif" }}>
{otpSending ? 'Sending…' : '📲 Text me a verification code'}
</button>
) : (
<>
<p style={{ fontSize: 12.5, color: S.forest, fontWeight: 500, margin: '0 0 8px' }}>Enter the 6-digit code we texted to {form.phone}.</p>
<div style={{ display: 'flex', gap: 8 }}>
<input value={otpCode} onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" placeholder="123456" maxLength={6} style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: `1px solid ${S.border}`, fontSize: 16, letterSpacing: '0.15em', fontFamily: "'DM Sans',sans-serif", color: S.forest, outline: 'none' }} />
<button onClick={checkOtp} disabled={otpCode.length < 6 || otpChecking} style={{ padding: '10px 18px', background: (otpCode.length < 6 || otpChecking) ? S.border : S.sage, color: S.white, border: 'none', borderRadius: 10, fontSize: 13.5, fontWeight: 600, cursor: (otpCode.length < 6 || otpChecking) ? 'default' : 'pointer', fontFamily: "'DM Sans',sans-serif" }}>
{otpChecking ? '…' : 'Verify'}
</button>
</div>
<button onClick={sendOtp} disabled={otpSending} style={{ background: 'none', border: 'none', color: S.sage, fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: '8px 0 0', fontFamily: "'DM Sans',sans-serif" }}>{otpSending ? 'Resending…' : 'Resend code'}</button>
</>
)}
{otpError && <p style={{ fontSize: 11.5, color: '#B94040', fontWeight: 400, margin: '8px 0 0' }}>{otpError}</p>}
</div>
)}
{phoneVerified && (
<div style={{ display: 'flex', alignItems: 'center', gap: 7, margin: '0 0 16px', color: S.sage, fontSize: 13, fontWeight: 600 }}>
<span style={{ fontSize: 15 }}>✓</span> Phone verified
</div>
)}

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

<label style={lbl}>What's this Kitchen for?</label>
<select value={form.use_case} onChange={e => update('use_case', e.target.value)} style={{ ...inputSt, cursor: 'pointer' }}>
<option value="">Select one…</option>
<option value="new_baby">New baby / postpartum</option>
<option value="illness">Illness, surgery, or treatment</option>
<option value="bereavement">Bereavement / loss</option>
<option value="deployment">Military deployment</option>
<option value="caregiving">Aging parent / caregiving</option>
<option value="celebration">Celebration / milestone</option>
<option value="other">Other</option>
</select>
<p style={{ fontSize: 11, color: S.stone, fontWeight: 300, margin: '-8px 0 20px' }}>Helps your village know how to show up.</p>

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
<input value={form.street} onChange={e => updateAddr('street', e.target.value)} placeholder="414 Milam Street" style={inputSt} />

<label style={lbl}>Apt / Suite <span style={{ fontWeight: 300, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
<input value={form.apt} onChange={e => updateAddr('apt', e.target.value)} placeholder="Apt 4B" style={inputSt} />

<label style={lbl}>City</label>
<input value={form.city} onChange={e => updateAddr('city', e.target.value)} placeholder="Houston" style={inputSt} />

<div style={{ display: 'flex', gap: 12 }}>
<div style={{ flex: 1 }}>
<label style={lbl}>State</label>
<select value={form.state} onChange={e => updateAddr('state', e.target.value)} style={inputSt}>
{US_STATES.map(s => <option key={s}>{s}</option>)}
</select>
</div>
<div style={{ flex: 1 }}>
<label style={lbl}>ZIP</label>
<input value={form.zip} onChange={e => updateAddr('zip', e.target.value)} placeholder="77002" maxLength={5} style={inputSt} />
</div>
</div>

{addressValid && !addrVerified && (
<button onClick={verifyAddress} disabled={verifying} style={{ width: '100%', padding: 13, marginBottom: 14, background: verifying ? S.border : S.sageLight, color: S.sage, border: `1.5px solid ${S.sage}`, borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: verifying ? 'default' : 'pointer', fontFamily: "'DM Sans',sans-serif" }}>
{verifying ? 'Checking address…' : '📍 Verify delivery address'}
</button>
)}
{verifyError && (
<div style={{ background: '#FDE8E8', border: '1px solid #B94040', borderRadius: 12, padding: '12px 14px', marginBottom: 14 }}>
<p style={{ fontSize: 13, color: '#B94040', margin: 0, lineHeight: 1.5 }}>⚠️ {verifyError}</p>
</div>
)}
{addrVerified && (
<div style={{ background: S.sageLight, border: `1px solid #C8DDD0`, borderRadius: 12, padding: '14px 16px', margin: '4px 0 20px' }}>
<p style={{ fontSize: 11, fontWeight: 700, color: S.sage, letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 6px' }}>✓ Verified — we'll deliver to</p>
<p style={{ fontSize: 14, color: S.forest, fontWeight: 500, margin: '0 0 10px', lineHeight: 1.5 }}>{verifiedAddress}</p>
<label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
<input type="checkbox" checked={addressConfirmed} onChange={e => setAddressConfirmed(e.target.checked)} style={{ width: 16, height: 16, accentColor: S.sage }} />
<span style={{ fontSize: 13, color: '#2D5240', fontWeight: 500 }}>Yes, deliver here</span>
</label>
</div>
)}

<div style={{ display: 'flex', gap: 10 }}>
<button onClick={() => setStep('profile')} style={btnBack}>← Back</button>
<button onClick={() => setStep('calendar')} disabled={!addrVerified || !addressConfirmed} style={{ ...btnPrimary(!addressValid || !addressConfirmed), flex: 1 }}>Next: Set My Calendar →</button>
</div>
</div>
)}

{/* STEP 3: CALENDAR */}
{step === 'calendar' && (
<div>
<p style={eyebrow}>Step 3 of 6</p>
<h1 style={title}>Which days do you<br />need meals?</h1>
<p style={sub}>Tap a date — or drag across several — then pick which meals. Your village sees these as open.</p>

<div style={{ background: S.white, border: `1px solid ${S.border}`, borderRadius: 16, padding: 18, marginBottom: 16 }}>
<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
<button onClick={prevMonth} style={navBtn}>‹</button>
<p style={{ fontFamily: "'Lora', serif", fontSize: 16, fontWeight: 500, color: S.forest, margin: 0 }}>{monthName}</p>
<button onClick={nextMonth} style={navBtn}>›</button>
</div>
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 3, marginBottom: 4 }}>
{['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: S.stone, padding: '2px 0' }}>{d}</div>)}
</div>
<div
onPointerDown={(e: any) => { const dt = dateAtPoint(e.clientX, e.clientY); if (dt) beginPaint(dt) }}
onPointerMove={(e: any) => { if (paintingRef.current) { e.preventDefault(); extendPaint(e.clientX, e.clientY) } }}
onPointerUp={finishPaint} onPointerCancel={finishPaint}
style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 3, touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none' }}>
{cells.map((day, i) => {
if (!day) return <div key={i} />
const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
const isPast = dateStr <= todayStr
const isToday = dateStr === todayStr
const isPicker = pickerDate === dateStr
const isPaint = paintSet.has(dateStr)
const slots = dateSlots[dateStr] || []
const hasSlots = slots.length > 0
return (
<button key={i} data-cal-date={dateStr} data-cal-past={isPast ? '1' : '0'} onClick={() => { if (dragMovedRef.current) { dragMovedRef.current = false; return } if (!isPast) setPickerDate(isPicker ? null : dateStr) }} disabled={isPast}
style={{
background: (isPicker || isPaint) ? S.sageLight : hasSlots ? '#F8FAF8' : S.white,
border: (isPicker || isPaint) ? `2px solid ${S.sage}` : isToday ? `2px solid ${S.sageMid}` : hasSlots ? `1px solid #C8DDD0` : '1px solid transparent',
borderRadius: 10, padding: '8px 2px', minHeight: 'clamp(44px,12vw,56px)', cursor: isPast ? 'default' : 'pointer',
display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
fontFamily: "'DM Sans', sans-serif", opacity: isPast ? 0.3 : 1,
}}>
<span style={{ fontSize: 13, fontWeight: isToday ? 700 : 500, color: (isPicker || isPaint) ? S.sage : S.forest, lineHeight: 1 }}>{day}</span>
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

{paintSet.size > 1 && (
<div style={{ background: S.white, border: `2px solid ${S.sage}`, borderRadius: 14, padding: '16px 18px', marginBottom: 16 }}>
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
<p style={{ fontFamily: "'Lora', serif", fontSize: 15, fontWeight: 500, color: S.forest, margin: 0 }}>{paintSet.size} days selected</p>
<button onClick={() => { setPaintSet(new Set()); dragMovedRef.current = false }} aria-label="Cancel selection" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: S.stone, padding: '4px 6px' }}>✕</button>
</div>
<p style={{ fontSize: 12, color: S.stone, fontWeight: 300, margin: '0 0 12px' }}>Which meals do you need on these days?</p>
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
{(['breakfast', 'lunch', 'dinner'] as const).map(mealType => {
const mb = MEAL_BADGE[mealType]
const isOn = rangeMeals.has(mealType)
return (
<button key={mealType} onClick={() => toggleRangeMeal(mealType)}
style={{ background: isOn ? mb.bg : S.white, border: `2px solid ${isOn ? mb.color : S.border}`, borderRadius: 10, padding: '12px 8px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", textAlign: 'center' }}>
<div style={{ fontSize: 18, marginBottom: 4 }}>{mb.label.split(' ')[0]}</div>
<div style={{ fontSize: 11, fontWeight: 600, color: isOn ? mb.color : S.stone }}>{isOn ? '✓ ' + mb.label.split(' ')[1] : mb.label.split(' ')[1]}</div>
</button>
)
})}
</div>
<button onClick={applyRangeMeals} disabled={rangeMeals.size === 0}
style={{ width: '100%', padding: '13px', borderRadius: 10, border: 'none', background: rangeMeals.size === 0 ? S.border : S.sage, color: S.white, fontSize: 14, fontWeight: 600, cursor: rangeMeals.size === 0 ? 'default' : 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
Open these {paintSet.size} days
</button>
<button onClick={clearPaintedDays}
style={{ width: '100%', padding: '10px', marginTop: 8, borderRadius: 10, border: `1.5px solid ${S.border}`, background: S.white, color: S.stone, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
Clear all meals on these days
</button>
</div>
)}

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
{(dateSlots[pickerDate] || []).length > 0 && (
<button onClick={() => { setDateSlots(prev => { const next = { ...prev }; delete next[pickerDate as string]; return next }); setPickerDate(null) }}
style={{ width: '100%', marginTop: 12, padding: '10px', borderRadius: 10, border: `1.5px solid ${S.border}`, background: S.white, color: S.stone, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
Clear this day
</button>
)}
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
<button onClick={() => setStep('plan')} disabled={!hasWindows} style={{ ...btnPrimary(!hasWindows), flex: 1 }}>Next: Join the Pilot →</button>
</div>
</div>
)}

{/* STEP 5: PLAN */}
{step === 'plan' && (
<div>
<p style={eyebrow}>Step 5 of 6</p>
<h1 style={title}>Join<br />the pilot</h1>
<p style={sub}>Pick how you'd like to start. Either way you get full access during the pilot.</p>

<div style={{ background: S.sageLight, borderRadius: 14, padding: '16px 20px', marginBottom: 20 }}>
<p style={{ fontFamily: "'Lora', serif", fontSize: 15, fontWeight: 500, color: S.forest, margin: '0 0 4px' }}>✦ Pilot members get everything, free</p>
<p style={{ fontSize: 13, color: S.stone, fontWeight: 300, lineHeight: 1.6, margin: 0 }}>No card required for a Pilot Account. Founding Members back the build — and their 3 years of Care+ begins at beta launch, so the pilot is a free bonus.</p>
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
Founding Membership is limited to the first 250 supporters. Pilot Accounts can become Founding Members anytime during the pilot.
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
<p style={{ fontFamily: "'Lora', serif", fontSize: 15, fontWeight: 600, color: S.forest, margin: '0 0 8px' }}>
🏪 Before you continue — how you'll add restaurants
</p>
<p style={{ fontSize: 13, color: S.stone, fontWeight: 300, margin: '0 0 14px', lineHeight: 1.7 }}>
On the next screen you'll add the restaurants and dishes your family loves. There are four ways to do it — use whichever is easiest. It helps to have your go-to menus and current prices handy.
</p>
<div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
{[
['1', 'Search and add your favorite restaurant', '— depending on their web layout, the menu may populate automatically.'],
['2', "Paste the restaurant's menu or online-ordering link", "— we'll fill the dishes in for you."],
['3', 'Upload a photo or PDF of the menu', '— snap the takeout menu or attach a file.'],
['4', 'Or type the dishes and prices in by hand', "— quick when it's just a few favorite meals."],
].map(([n, label, desc]) => (
<div key={n} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
<span style={{ flexShrink: 0, width: 20, height: 20, borderRadius: '50%', background: S.sageLight, color: S.sage, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>{n}</span>
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
<button onClick={startFinish} disabled={loading} style={{ ...btnPrimary(loading), flex: 1 }}>
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
const phoneBox: React.CSSProperties = { width: 62, padding: '13px 10px', borderRadius: 10, border: '1.5px solid #DDE8E0', fontSize: 16, fontFamily: "'DM Sans', sans-serif", color: '#1E2620', background: '#fff', outline: 'none', textAlign: 'center', boxSizing: 'border-box' }
const btnPrimary = (disabled: boolean): React.CSSProperties => ({
width: '100%', padding: '14px', background: disabled ? '#DDE8E0' : '#1E2620',
color: disabled ? '#6B7066' : '#fff', border: 'none', borderRadius: 10,
fontSize: 14, fontWeight: 600, cursor: disabled ? 'default' : 'pointer',
fontFamily: "'DM Sans', sans-serif",
})

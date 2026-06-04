'use client'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Suspense } from 'react'

const S = {
sage: '#3D6B4F', sageMid: '#6B9E7E', sageLight: '#EAF2ED',
cream: '#FAFAF5', forest: '#1E2620', stone: '#6B7066',
border: '#DDE8E0', white: '#FFFFFF', amber: '#C17F47',
amberLight: '#FBF0E4', red: '#B94040',
}

const DIETARY_OPTIONS = ['No shellfish', 'No nuts', 'No dairy', 'No gluten', 'Vegetarian', 'Vegan', 'Halal', 'Kosher']

const TIER_BADGES: Record<string, { badge: string; price: string; period: string; color: string; bg: string; desc: string }> = {
free:     { badge: 'Free', price: '$0', period: '/ always', color: '#6B7066', bg: '#F0F0EB', desc: 'Basic access — upgrade anytime.' },
care:     { badge: 'Care+', price: '$9.99', period: '/ month', color: '#3D6B4F', bg: '#EAF2ED', desc: 'Full SMS + unlimited calendar.' },
annual:   { badge: 'Founding Member', price: '$59', period: '/ year', color: '#B88B4A', bg: '#FFF4E8', desc: 'Annual founding rate, locked forever.' },
founding: { badge: 'Founding Member', price: '$149', period: 'lifetime', color: '#B88B4A', bg: '#FFF4E8', desc: 'Lifetime access. Thank you for founding YourKitchen.' },
}

const WINDOW_OPTIONS = {
breakfast: ['07:00-09:00', '08:00-10:00'],
lunch: ['11:00-12:30', '12:00-13:30'],
dinner: ['17:00-18:30', '17:30-19:00', '18:00-19:30'],
}
const WINDOW_LABELS: Record<string, string> = {
'07:00-09:00': '7:00 – 9:00 AM',
'08:00-10:00': '8:00 – 10:00 AM',
'11:00-12:30': '11:00 AM – 12:30 PM',
'12:00-13:30': '12:00 – 1:30 PM',
'17:00-18:30': '5:00 – 6:30 PM',
'17:30-19:00': '5:30 – 7:00 PM',
'18:00-19:30': '6:00 – 7:30 PM',
}
const MEAL_LABELS: Record<string, { label: string; emoji: string; color: string }> = {
breakfast: { label: 'Breakfast', emoji: '🌅', color: '#E8834A' },
lunch: { label: 'Lunch', emoji: '☀️', color: '#4A8FA8' },
dinner: { label: 'Dinner', emoji: '🌙', color: S.sage },
}

function SettingsContent() {
const router = useRouter()
const params = useSearchParams()
const supabase = createClient()

const [loading, setLoading] = useState(true)
const [saving, setSaving] = useState(false)
const [success, setSuccess] = useState('')
const [error, setError] = useState('')
const [passwordLoading, setPasswordLoading] = useState(false)
const [passwordSuccess, setPasswordSuccess] = useState('')
const [currentEmail, setCurrentEmail] = useState('')
const [newEmail, setNewEmail] = useState('')
const [emailLoading, setEmailLoading] = useState(false)
const [emailMsg, setEmailMsg] = useState('')
const [emailErr, setEmailErr] = useState('')
const [deleteConfirm, setDeleteConfirm] = useState(false)
const [deleteLoading, setDeleteLoading] = useState(false)
const [currentTier, setCurrentTier] = useState('free')
const [kitchenId, setKitchenId] = useState('')
const [userId, setUserId] = useState('')

const [form, setForm] = useState({
full_name: '',
phone: '',
street: '',
apt: '',
city: '',
state: 'TX',
zip: '',
household_adults: 2,
household_children: 2,
dietary_restrictions: [] as string[],
})

const [breakfastWindows, setBreakfastWindows] = useState<string[]>(['07:00-09:00'])
const [lunchWindows, setLunchWindows] = useState<string[]>(['11:00-12:30'])
const [dinnerWindows, setDinnerWindows] = useState<string[]>(['17:30-19:00'])

useEffect(() => {
const upgraded = params.get('upgraded')
if (upgraded) {
setSuccess(`Successfully upgraded to ${TIER_BADGES[upgraded]?.badge || upgraded}!`)
setCurrentTier(upgraded)
supabase.auth.getUser().then(({ data: { user } }) => {
if (user) supabase.from('profiles').update({ tier: upgraded }).eq('id', user.id)
})
}
}, [])

useEffect(() => {
const load = async () => {
const { data: { user } } = await supabase.auth.getUser()
if (!user) { router.push('/login'); return }
setUserId(user.id)
setCurrentEmail(user.email || '')

const { data: profile } = await supabase
.from('profiles')
.select('full_name, phone, tier')
.eq('id', user.id)
.single()

const name = profile?.full_name || (user.user_metadata?.full_name as string) || (user.user_metadata?.name as string) || ''

setCurrentTier(profile?.tier || 'free')
setForm(f => ({ ...f, full_name: name, phone: profile?.phone || '' }))

const { data: kitchen } = await supabase
.from('kitchens')
.select('id, address, household_adults, household_children, dietary_restrictions, breakfast_windows, lunch_windows, dinner_windows')
.eq('organizer_id', user.id)
.single()

if (kitchen) {
setKitchenId(kitchen.id)
const addr = kitchen.address || ''
const parsed = parseAddress(addr)
setForm(f => ({
...f,
household_adults: kitchen.household_adults ?? 2,
household_children: kitchen.household_children ?? 2,
dietary_restrictions: kitchen.dietary_restrictions || [],
street: parsed.street,
apt: '',
city: parsed.city,
state: parsed.state,
zip: parsed.zip,
}))
if (kitchen.breakfast_windows?.length) setBreakfastWindows(kitchen.breakfast_windows)
if (kitchen.lunch_windows?.length) setLunchWindows(kitchen.lunch_windows)
if (kitchen.dinner_windows?.length) setDinnerWindows(kitchen.dinner_windows)
}
setLoading(false)
}
load()
}, [])

const toggleDiet = (item: string) =>
setForm(f => ({ ...f, dietary_restrictions: f.dietary_restrictions.includes(item) ? f.dietary_restrictions.filter(d => d !== item) : [...f.dietary_restrictions, item] }))

const toggleWindow = (meal: 'breakfast' | 'lunch' | 'dinner', window: string) => {
const setters = { breakfast: setBreakfastWindows, lunch: setLunchWindows, dinner: setDinnerWindows }
const values = { breakfast: breakfastWindows, lunch: lunchWindows, dinner: dinnerWindows }
const current = values[meal]
setters[meal](current.includes(window) ? current.filter(w => w !== window) : [...current, window])
}

const handleSave = async () => {
if (!form.full_name.trim()) { setError('Name is required.'); return }
setSaving(true); setError(''); setSuccess('')

const res = await fetch('/api/settings', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({
user_id: userId,
full_name: form.full_name.trim(),
phone: form.phone,
address: `${form.street}${form.apt ? ` ${form.apt}` : ''}, ${form.city}, ${form.state} ${form.zip}`.replace(/^,\s*/, '').replace(/,\s*,/g, ',').trim(),
household_adults: form.household_adults,
household_children: form.household_children,
dietary_restrictions: form.dietary_restrictions,
breakfast_windows: breakfastWindows,
lunch_windows: lunchWindows,
dinner_windows: dinnerWindows,
}),
})
const data = await res.json()
if (!res.ok) { setError(data.error || 'Something went wrong.'); setSaving(false); return }
setSuccess('Settings saved.')
setSaving(false)
}

const handleEmailChange = async () => {
const next = newEmail.trim().toLowerCase()
setEmailErr(''); setEmailMsg('')
if (!next) { setEmailErr('Enter a new email address.'); return }
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next)) { setEmailErr('Enter a valid email address.'); return }
if (next === currentEmail.toLowerCase()) { setEmailErr('That is already your email.'); return }
setEmailLoading(true)
// Supabase sends a confirmation link to the NEW address; the change only takes
// effect once the user clicks it. We also keep the profiles table consistent
// after confirmation via the auth callback, but the auth email is the source of truth.
const { error } = await supabase.auth.updateUser({ email: next }, { emailRedirectTo: `${window.location.origin}/auth/callback` })
if (error) { setEmailErr(error.message); setEmailLoading(false); return }
setEmailMsg(`Confirmation link sent to ${next}. Click it to finish changing your email. Until then, keep using ${currentEmail}.`)
setNewEmail('')
setEmailLoading(false)
}

const handlePasswordReset = async () => {
setPasswordLoading(true); setPasswordSuccess('')
const { data: { user } } = await supabase.auth.getUser()
if (!user?.email) { setPasswordLoading(false); return }
await supabase.auth.resetPasswordForEmail(user.email, { redirectTo: `${window.location.origin}/auth/callback` })
setPasswordSuccess(`Reset link sent to ${user.email}.`)
setPasswordLoading(false)
}

const handleDeleteAccount = async () => {
setDeleteLoading(true)
const res = await fetch('/api/delete-account', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ user_id: userId }),
})
if (res.ok) { await supabase.auth.signOut(); router.push('/login') }
else {
const data = await res.json()
setError(data.error || 'Failed to delete account.')
setDeleteLoading(false); setDeleteConfirm(false)
}
}

const activeTier = TIER_BADGES[currentTier] || TIER_BADGES.free

if (loading) return (
<div style={{ minHeight: '100vh', background: S.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans', sans-serif" }}>
<p style={{ color: S.stone, fontSize: 14 }}>Loading settings…</p>
</div>
)

return (
<div style={{ minHeight: '100vh', background: S.cream, fontFamily: "'DM Sans', sans-serif", paddingBottom: 60 }}>
<link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />

<div style={{ background: S.forest, padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
<button onClick={() => router.push('/dashboard')}
style={{ background: S.sage, border: 'none', borderRadius: 10, width: 36, height: 36, cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', color: S.white }}>
‹
</button>
<div>
<div style={{ fontSize: 9, fontWeight: 500, letterSpacing: 5, color: S.sageMid, textTransform: 'uppercase' }}>Your</div>
<div style={{ fontFamily: "'Lora', serif", fontSize: 20, fontWeight: 500, color: S.white }}>Kitchen</div>
</div>
</div>

<div style={{ padding: '28px 24px', maxWidth: 500, margin: '0 auto' }}>
<h1 style={{ fontFamily: "'Lora', serif", fontSize: 26, fontWeight: 500, color: S.forest, margin: '0 0 28px', letterSpacing: -0.5 }}>Settings</h1>

{success && <div style={{ background: S.sageLight, border: `1.5px solid ${S.sage}`, borderRadius: 12, padding: '12px 16px', marginBottom: 20 }}><p style={{ fontSize: 13, color: S.sage, margin: 0 }}>✓ {success}</p></div>}

{/* ── YOUR PLAN (compact — links to /tiers) ── */}
<p style={sLabel}>Your plan</p>
<button onClick={() => router.push('/tiers')}
style={{ width: '100%', background: S.white, border: `2px solid ${activeTier.color}`, borderRadius: 16, padding: '18px 20px', marginBottom: 24, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", textAlign: 'left' }}>
<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
<div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
<span style={{ background: activeTier.bg, color: activeTier.color, fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 20, letterSpacing: '0.05em' }}>{activeTier.badge}</span>
<span style={{ fontFamily: "'Lora', serif", fontSize: 18, fontWeight: 500, color: S.forest }}>{activeTier.price}</span>
<span style={{ fontSize: 12, color: S.stone, fontWeight: 300 }}>{activeTier.period}</span>
</div>
<span style={{ fontSize: 13, fontWeight: 600, color: activeTier.color }}>View plans →</span>
</div>
<p style={{ fontSize: 13, color: S.stone, fontWeight: 300, margin: '8px 0 0' }}>{activeTier.desc}</p>
</button>

{/* ── PROFILE ── */}
<p style={sLabel}>Profile</p>
<label style={lStyle}>Your name *</label>
<input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Danielle Moore" style={iStyle} />
<label style={lStyle}>Phone number</label>
<input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="(936) 555-0142" style={iStyle} />

{/* ── KITCHEN ── */}
<p style={{ ...sLabel, marginTop: 8 }}>Kitchen</p>
<label style={lStyle}>Street address</label>
<input value={form.street} onChange={e => setForm(f => ({ ...f, street: e.target.value }))} placeholder="1422 Oak Creek Dr" style={iStyle} />

<label style={lStyle}>Apt / Suite <span style={{ fontWeight: 300, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
<input value={form.apt} onChange={e => setForm(f => ({ ...f, apt: e.target.value }))} placeholder="Apt 4B" style={iStyle} />

<label style={lStyle}>City</label>
<input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="Waller" style={iStyle} />

<div style={{ display: 'flex', gap: 12 }}>
<div style={{ flex: 1 }}>
<label style={lStyle}>State</label>
<select value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} style={iStyle}>
{US_STATES.map(s => <option key={s}>{s}</option>)}
</select>
</div>
<div style={{ flex: 1 }}>
<label style={lStyle}>ZIP</label>
<input value={form.zip} onChange={e => setForm(f => ({ ...f, zip: e.target.value }))} placeholder="77484" maxLength={5} style={iStyle} />
</div>
</div>
<p style={{ fontSize: 12, color: S.stone, marginTop: 6, marginBottom: 20, fontWeight: 300 }}>We use this to find restaurants near you. Updating it refreshes your delivery area.</p>

<label style={lStyle}>Household — adults</label>
<div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
{[1,2,3,4,5,6].map(n => (
<button key={n} onClick={() => setForm(f => ({ ...f, household_adults: n }))}
style={{ flex: 1, padding: '11px 4px', borderRadius: 10, border: 'none', background: form.household_adults === n ? S.sage : S.sageLight, color: form.household_adults === n ? S.white : S.sage, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>{n}</button>
))}
</div>

<label style={lStyle}>Household — children</label>
<div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
{[0,1,2,3,4,5].map(n => (
<button key={n} onClick={() => setForm(f => ({ ...f, household_children: n }))}
style={{ flex: 1, padding: '11px 4px', borderRadius: 10, border: 'none', background: form.household_children === n ? '#C17F47' : '#FBF0E4', color: form.household_children === n ? S.white : '#C17F47', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>{n}</button>
))}
</div>
<p style={{ fontSize: 12, color: S.stone, fontWeight: 300, margin: '0 0 20px', lineHeight: 1.5 }}>
This is the default for every meal date — your village uses it as a guide. You can adjust any single date when you add it to the calendar.
</p>

<label style={lStyle}>Dietary restrictions</label>
<div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
{DIETARY_OPTIONS.map(d => (
<button key={d} onClick={() => toggleDiet(d)}
style={{ padding: '8px 16px', borderRadius: 20, border: 'none', cursor: 'pointer', background: form.dietary_restrictions.includes(d) ? S.sage : S.sageLight, color: form.dietary_restrictions.includes(d) ? S.white : S.sage, fontSize: 13, fontWeight: 500, fontFamily: "'DM Sans', sans-serif" }}>{d}</button>
))}
</div>

{/* ── DELIVERY WINDOWS ── */}
<p style={{ ...sLabel, marginTop: 8 }}>Delivery windows</p>
<p style={{ fontSize: 13, color: S.stone, fontWeight: 300, margin: '0 0 16px', lineHeight: 1.6 }}>
Select all windows that work for your household. Coordinators will see these when placing an order.
</p>

{(['breakfast', 'lunch', 'dinner'] as const).map(meal => {
const m = MEAL_LABELS[meal]
const current = { breakfast: breakfastWindows, lunch: lunchWindows, dinner: dinnerWindows }[meal]
return (
<div key={meal} style={{ marginBottom: 16 }}>
<div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
<span style={{ fontSize: 14 }}>{m.emoji}</span>
<span style={{ fontSize: 12, fontWeight: 700, color: m.color, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{m.label}</span>
</div>
<div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
{WINDOW_OPTIONS[meal].map(w => {
const on = current.includes(w)
return (
<button key={w} onClick={() => toggleWindow(meal, w)}
style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderRadius: 10, border: `1.5px solid ${on ? m.color : S.border}`, background: on ? `${m.color}15` : S.white, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", textAlign: 'left' }}>
<div style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${on ? m.color : S.border}`, background: on ? m.color : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
{on && <span style={{ color: S.white, fontSize: 11, fontWeight: 700 }}>✓</span>}
</div>
<span style={{ fontSize: 14, color: on ? m.color : S.forest, fontWeight: on ? 600 : 400 }}>{WINDOW_LABELS[w]}</span>
</button>
)
})}
</div>
</div>
)
})}

{error && <div style={{ background: '#FDE8E8', border: `1.5px solid ${S.red}`, borderRadius: 12, padding: '12px 16px', marginBottom: 16, marginTop: 8 }}><p style={{ fontSize: 13, color: S.red, margin: 0 }}>⚠️ {error}</p></div>}

<button onClick={handleSave} disabled={saving}
style={{ width: '100%', padding: '14px', borderRadius: 10, border: 'none', background: saving ? S.sageMid : S.forest, color: S.white, fontSize: 14, fontWeight: 500, cursor: saving ? 'default' : 'pointer', fontFamily: "'DM Sans', sans-serif", marginTop: 8, marginBottom: 24 }}>
{saving ? 'Saving…' : 'Save Changes'}
</button>

{/* ── EMAIL ── */}
<div style={{ background: S.white, border: `1px solid ${S.border}`, borderRadius: 16, padding: '20px', marginBottom: 16 }}>
<p style={sLabel}>Email address</p>
<p style={{ fontSize: 14, color: S.stone, margin: '0 0 14px', fontWeight: 300, lineHeight: 1.6 }}>
Your current email is <strong style={{ color: S.forest, fontWeight: 500 }}>{currentEmail || '—'}</strong>. Changing it sends a confirmation link to the new address.
</p>
{emailMsg && <div style={{ background: S.sageLight, borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}><p style={{ fontSize: 13, color: S.sage, margin: 0, lineHeight: 1.5 }}>✓ {emailMsg}</p></div>}
{emailErr && <div style={{ background: '#FDECEA', borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}><p style={{ fontSize: 13, color: S.red, margin: 0 }}>{emailErr}</p></div>}
<input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="new@email.com" style={{ ...iStyle, marginBottom: 10 }} />
<button onClick={handleEmailChange} disabled={emailLoading || !newEmail.trim()}
style={{ width: '100%', padding: '13px', borderRadius: 10, border: `1.5px solid ${S.border}`, background: 'transparent', fontSize: 14, color: S.forest, cursor: (emailLoading || !newEmail.trim()) ? 'default' : 'pointer', fontFamily: "'DM Sans', sans-serif", opacity: (emailLoading || !newEmail.trim()) ? 0.5 : 1 }}>
{emailLoading ? 'Sending…' : 'Update Email'}
</button>
</div>

{/* ── ACCOUNT ── */}
<div style={{ background: S.white, border: `1px solid ${S.border}`, borderRadius: 16, padding: '20px', marginBottom: 16 }}>
<p style={sLabel}>Account</p>
<p style={{ fontSize: 14, color: S.stone, margin: '0 0 14px', fontWeight: 300, lineHeight: 1.6 }}>
Send a password reset link to your registered email.
</p>
{passwordSuccess && <div style={{ background: S.sageLight, borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}><p style={{ fontSize: 13, color: S.sage, margin: 0 }}>✓ {passwordSuccess}</p></div>}
<button onClick={handlePasswordReset} disabled={passwordLoading}
style={{ width: '100%', padding: '13px', borderRadius: 10, border: `1.5px solid ${S.border}`, background: 'transparent', fontSize: 14, color: S.forest, cursor: passwordLoading ? 'default' : 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
{passwordLoading ? 'Sending…' : 'Send Password Reset Email'}
</button>
</div>

{/* ── DANGER ZONE ── */}
<div style={{ background: S.white, border: `1.5px solid ${S.red}`, borderRadius: 16, padding: '20px' }}>
<p style={{ ...sLabel, color: S.red }}>Danger Zone</p>
<p style={{ fontSize: 14, color: S.stone, margin: '0 0 14px', fontWeight: 300, lineHeight: 1.6 }}>
Permanently delete your account and all Kitchen data. This cannot be undone.
</p>
{deleteConfirm ? (
<div>
<div style={{ background: '#FDE8E8', borderRadius: 10, padding: '14px 16px', marginBottom: 14 }}>
<p style={{ fontSize: 13, color: S.red, margin: 0, fontWeight: 500 }}>⚠️ This will permanently delete your Kitchen, all calendar dates, proposals, and account.</p>
</div>
<div style={{ display: 'flex', gap: 10 }}>
<button onClick={() => setDeleteConfirm(false)} style={{ flex: 1, padding: '13px', borderRadius: 10, border: `1.5px solid ${S.border}`, background: 'transparent', fontSize: 14, color: S.stone, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>Cancel</button>
<button onClick={handleDeleteAccount} disabled={deleteLoading} style={{ flex: 1, padding: '13px', borderRadius: 10, border: 'none', background: deleteLoading ? S.border : S.red, color: S.white, fontSize: 14, fontWeight: 500, cursor: deleteLoading ? 'default' : 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
{deleteLoading ? 'Deleting…' : 'Yes, delete everything'}
</button>
</div>
</div>
) : (
<button onClick={() => setDeleteConfirm(true)} style={{ width: '100%', padding: '13px', borderRadius: 10, border: `1.5px solid ${S.red}`, background: 'transparent', fontSize: 14, color: S.red, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
Delete my account
</button>
)}
</div>
</div>
</div>
)
}

const US_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WV','WI','WY']

// Best-effort parse of a stored "Street, City, ST ZIP" address back into parts,
// so the broken-out form pre-fills when the user opens settings.
function parseAddress(addr: string): { street: string; city: string; state: string; zip: string } {
  const out = { street: '', city: '', state: 'TX', zip: '' }
  if (!addr) return out
  const parts = addr.split(',').map(s => s.trim()).filter(Boolean)
  if (parts.length >= 3) {
    out.street = parts[0]
    out.city = parts[1]
    const m = parts[2].match(/([A-Z]{2})\s*(\d{5})?/)
    if (m) { out.state = m[1]; if (m[2]) out.zip = m[2] }
  } else if (parts.length === 2) {
    out.street = parts[0]; out.city = parts[1]
  } else {
    out.street = addr
  }
  return out
}

export default function SettingsPage() {
return (
<Suspense fallback={<div style={{ minHeight: '100vh', background: '#FAFAF5' }} />}>
<SettingsContent />
</Suspense>
)
}

const sLabel: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: '#6B7066', letterSpacing: 2, textTransform: 'uppercase', margin: '0 0 14px', display: 'block' }
const lStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: '#6B7066', letterSpacing: 1.5, textTransform: 'uppercase', display: 'block', marginBottom: 8 }
const iStyle: React.CSSProperties = { width: '100%', padding: '13px 16px', borderRadius: 10, border: '1.5px solid #DDE8E0', fontSize: 14, background: '#fff', color: '#1E2620', outline: 'none', boxSizing: 'border-box', marginBottom: 20, fontFamily: "'DM Sans', sans-serif" }

'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const S = {
sage: '#3D6B4F', sageMid: '#6B9E7E', sageLight: '#EAF2ED',
cream: '#FAFAF5', forest: '#1E2620', stone: '#6B7066',
border: '#DDE8E0', white: '#FFFFFF', amber: '#B88B4A',
amberLight: '#FFF4E8', amberText: '#7A4F10', red: '#B94040',
}

type Feature = { label: string; included: boolean; limit?: string; limitTone?: 'green'|'amber'|'gray' }
type Section = { title: string; features: Feature[] }

const FREE_SECTIONS: Section[] = [
{ title: 'Calendar', features: [
{ label: 'Active window', included: true, limit: '60 days', limitTone: 'gray' },
{ label: 'Recurring or perpetual calendar', included: false },
]},
{ title: 'Restaurants + meals', features: [
{ label: 'Restaurants', included: true, limit: '3 max', limitTone: 'gray' },
{ label: 'Menu items per restaurant', included: true, limit: '4 max', limitTone: 'gray' },
{ label: 'Personal drop-off / home cook option', included: false },
]},
{ title: 'Delivery', features: [
{ label: 'Courier delivery', included: true },
{ label: 'SMS confirmation flow', included: true },
{ label: 'Tracking link to recipient', included: true },
]},
{ title: 'Sharing + brand', features: [
{ label: 'Shareable kitchen link', included: true },
{ label: 'Social share buttons', included: true },
{ label: 'Custom kitchen URL slug', included: false },
{ label: 'Priority support', included: false },
{ label: 'Active Kitchens', included: true, limit: '1', limitTone: 'gray' },
]},
]

const CARE_SECTIONS: Section[] = [
{ title: 'Calendar', features: [
{ label: 'Active window', included: true, limit: 'Unlimited', limitTone: 'green' },
{ label: 'Recurring date slots', included: true },
{ label: 'Perpetual calendar (long-term care)', included: true },
]},
{ title: 'Restaurants + meals', features: [
{ label: 'Restaurants', included: true, limit: '10 max', limitTone: 'green' },
{ label: 'Menu items per restaurant', included: true, limit: '12 max', limitTone: 'green' },
{ label: 'Personal drop-off / home cook option', included: true },
]},
{ title: 'Delivery', features: [
{ label: 'Courier delivery', included: true },
{ label: 'SMS confirmation flow', included: true },
{ label: 'Tracking link to recipient + coordinator', included: true },
{ label: 'Coordinator thank-you SMS on delivery', included: true },
]},
{ title: 'Sharing + brand', features: [
{ label: 'Shareable kitchen link', included: true },
{ label: 'Social share buttons', included: true },
{ label: 'Custom kitchen URL slug', included: true },
{ label: 'Priority support', included: true },
{ label: 'Multiple active Kitchens', included: true, limit: '3 max', limitTone: 'green' },
]},
]

const FOUNDING_PERKS = [
'3 years of Care+ included — a $160 savings vs paying monthly',
'Founding Member badge on your Kitchen page — yours permanently',
'Direct access to founder — a real feedback loop, not a support ticket',
'Early access to every new feature (beta)',
'Up to 3 active Kitchens',
"Listed in YourKitchen's founding story — your name on the about page",
'First to get Marketplace API integrations when available',
'Access to the private founding members community',
'Founders Gift Box (ships late summer) — T-shirt, kitchen magnets, stickers, marketing cards, plus 90-day premium gift access to give someone in need',
]

export default function TiersPage() {
const router = useRouter()
const supabase = createClient()
const [currentTier, setCurrentTier] = useState('free')
const [userId, setUserId] = useState('')
const [switching, setSwitching] = useState<string | null>(null)
const [error, setError] = useState('')

useEffect(() => {
const load = async () => {
const { data: { user } } = await supabase.auth.getUser()
if (!user) { router.push('/login'); return }
setUserId(user.id)
const { data: profile } = await supabase.from('profiles').select('tier').eq('id', user.id).single()
setCurrentTier(profile?.tier || 'free')
}
load()
}, [])

const handleSwitch = async (tierKey: string) => {
if (tierKey === currentTier) return
setError('')
if (tierKey === 'free') {
setSwitching('free')
await fetch('/api/stripe-subscription', {
method: 'POST', headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ tier: 'free', user_id: userId }),
})
setCurrentTier('free'); setSwitching(null)
return
}
setSwitching(tierKey)
const res = await fetch('/api/stripe-subscription', {
method: 'POST', headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ tier: tierKey, user_id: userId }),
})
const data = await res.json()
if (data.url) window.location.href = data.url
else { setError(data.error || 'Could not start checkout.'); setSwitching(null) }
}

const check = (tone: 'green'|'amber'|'gray' = 'green') => {
const map = { green: { bg: S.sageLight, c: '#2D5240' }, amber: { bg: S.amberLight, c: S.amberText }, gray: { bg: '#F0F0EB', c: S.stone } }
const t = map[tone]
return <span style={{ width: 15, height: 15, borderRadius: '50%', background: t.bg, color: t.c, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1, fontSize: 9, fontWeight: 700 }}>✓</span>
}
const cross = () => <span style={{ width: 15, height: 15, borderRadius: '50%', background: '#F0F0EB', color: S.stone, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1, fontSize: 9 }}>✕</span>

const limitPill = (limit: string, tone: 'green'|'amber'|'gray' = 'gray') => {
const map = { green: { bg: S.sageLight, c: '#2D5240' }, amber: { bg: S.amberLight, c: S.amberText }, gray: { bg: '#F0F0EB', c: S.stone } }
const t = map[tone]
return <span style={{ fontSize: 10, fontWeight: 600, background: t.bg, color: t.c, borderRadius: 10, padding: '1px 8px', marginLeft: 6, whiteSpace: 'nowrap' }}>{limit}</span>
}

const renderSections = (sections: Section[]) => sections.map((sec, si) => (
<div key={sec.title}>
{si > 0 && <hr style={{ border: 'none', borderTop: `0.5px solid ${S.border}`, margin: '12px 0' }} />}
<p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: S.stone, margin: '0 0 8px' }}>{sec.title}</p>
{sec.features.map((f, fi) => (
<div key={fi} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 7, fontSize: 13, color: f.included ? S.forest : S.stone, lineHeight: 1.4 }}>
{f.included ? check(f.limitTone) : cross()}
<span style={{ flex: 1 }}>{f.label}{f.limit && limitPill(f.limit, f.limitTone)}</span>
</div>
))}
</div>
))

const ctaLabel = (key: string, paidLabel: string) =>
switching === key ? 'Loading…' : currentTier === key ? '✓ Current plan' : paidLabel

return (
<div style={{ minHeight: '100vh', background: S.cream, fontFamily: "'DM Sans', sans-serif", paddingBottom: 60 }}>
<link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />
<style>{`
.tier-grid { display: grid; grid-template-columns: 1fr; gap: 14px; }
@media (min-width: 720px) { .tier-grid { grid-template-columns: 1fr 1fr; gap: 12px; align-items: start; } }
@media (min-width: 1080px) { .tier-grid { grid-template-columns: 1fr 1fr 1fr; gap: 12px; align-items: start; max-width: 980px; margin: 0 auto; } }
`}</style>

<nav style={{ background: S.forest, padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 10 }}>
<button onClick={() => router.push('/dashboard')}
style={{ background: S.sage, border: 'none', borderRadius: 10, width: 36, height: 36, cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', color: S.white }}>‹</button>
<div>
<div style={{ fontSize: 9, fontWeight: 500, letterSpacing: 5, color: S.sageMid, textTransform: 'uppercase' }}>Your</div>
<div style={{ fontFamily: "'Lora', serif", fontSize: 20, fontWeight: 500, color: S.white }}>Kitchen</div>
</div>
</nav>

<div style={{ padding: '28px 24px', maxWidth: 1320, margin: '0 auto' }}>
<h1 style={{ fontFamily: "'Lora', serif", fontSize: 28, fontWeight: 500, color: S.forest, margin: '0 0 8px', letterSpacing: -0.5 }}>Plans &amp; pricing</h1>
<p style={{ fontSize: 14, color: S.stone, fontWeight: 300, margin: '0 0 28px', lineHeight: 1.6 }}>
Founding Membership is open to the first 100 supporters — your belief funds the build.
</p>

{error && <div style={{ background: '#FDE8E8', border: `1.5px solid ${S.red}`, borderRadius: 12, padding: '12px 16px', marginBottom: 20 }}><p style={{ fontSize: 13, color: S.red, margin: 0 }}>⚠️ {error}</p></div>}

<div className="tier-grid">

{/* FREE */}
<div style={{ background: S.white, border: `0.5px solid ${S.border}`, borderRadius: 14, padding: '20px', position: 'relative' }}>
<span style={{ display: 'inline-block', fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 8, marginBottom: 10, background: '#F0F0EB', color: S.stone }}>Free</span>
<div style={{ fontSize: 18, fontWeight: 500, color: S.forest, marginBottom: 4 }}>Kitchen</div>
<div style={{ fontSize: 13, color: S.stone, marginBottom: 14 }}><strong style={{ fontSize: 22, fontWeight: 500, color: S.forest }}>$0</strong> / always</div>
{renderSections(FREE_SECTIONS)}
<button onClick={() => handleSwitch('free')} disabled={!!switching || currentTier === 'free'}
style={{ display: 'block', width: '100%', padding: '11px', borderRadius: 8, border: `0.5px solid ${S.border}`, background: '#F0F0EB', color: S.forest, fontSize: 13, fontWeight: 600, cursor: currentTier === 'free' ? 'default' : 'pointer', marginTop: 16, fontFamily: "'DM Sans', sans-serif" }}>
{ctaLabel('free', 'Downgrade to Free')}
</button>
</div>

{/* CARE+ */}
<div style={{ background: S.white, border: `2px solid ${S.sage}`, borderRadius: 14, padding: '20px', position: 'relative' }}>
<span style={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)', background: S.stone, color: S.white, fontSize: 10, fontWeight: 600, padding: '3px 12px', borderRadius: 10, whiteSpace: 'nowrap' }}>Coming soon</span>
<span style={{ display: 'inline-block', fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 8, marginBottom: 10, background: S.sageLight, color: '#2D5240' }}>Care+</span>
<div style={{ fontSize: 18, fontWeight: 500, color: S.forest, marginBottom: 4 }}>Kitchen Care+</div>
<div style={{ fontSize: 13, color: S.stone, marginBottom: 14 }}><strong style={{ fontSize: 22, fontWeight: 500, color: S.forest }}>$9.99</strong> / month</div>
{renderSections(CARE_SECTIONS)}
<button disabled
style={{ display: 'block', width: '100%', padding: '11px', borderRadius: 8, border: `1px solid ${S.border}`, background: '#F0F0EB', color: S.stone, fontSize: 13, fontWeight: 600, cursor: 'default', marginTop: 16, fontFamily: "'DM Sans', sans-serif" }}>
Coming soon
</button>
</div>

{/* FOUNDING — 3-YEAR */}
<div style={{ background: S.forest, border: `2px solid ${S.forest}`, borderRadius: 14, padding: '20px', position: 'relative' }}>
<span style={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)', background: S.amber, color: S.white, fontSize: 10, fontWeight: 600, padding: '3px 12px', borderRadius: 10, whiteSpace: 'nowrap' }}>Limited — first 100</span>
<span style={{ display: 'inline-block', fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 8, marginBottom: 10, background: S.amber, color: S.white }}>Founding Member</span>
<div style={{ fontSize: 18, fontWeight: 500, color: S.white, marginBottom: 4 }}>Founding Package</div>
<div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 14 }}><strong style={{ fontSize: 22, fontWeight: 500, color: S.white }}>$200</strong> <span style={{ fontSize: 11 }}>once · 3 years of Care+ included</span></div>
<p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', margin: '0 0 10px' }}>Everything in Care+, plus</p>
{FOUNDING_PERKS.map((p, i) => (
<div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 7, fontSize: 12, color: 'rgba(255,255,255,0.85)', lineHeight: 1.4 }}>
<span style={{ width: 6, height: 6, borderRadius: '50%', background: S.amber, flexShrink: 0, marginTop: 5 }} />
<span>{p}</span>
</div>
))}
<button onClick={() => handleSwitch('founding')} disabled={!!switching || currentTier === 'founding'}
style={{ display: 'block', width: '100%', padding: '11px', borderRadius: 8, border: 'none', background: S.amber, color: S.white, fontSize: 13, fontWeight: 600, cursor: 'pointer', marginTop: 16, fontFamily: "'DM Sans', sans-serif", opacity: switching ? 0.6 : 1 }}>
{currentTier === 'founding' ? '✓ Current plan' : switching === 'founding' ? 'Loading…' : 'Claim founding membership'}
</button>
</div>

</div>

<p style={{ fontSize: 11, color: S.stone, textAlign: 'center', margin: '24px 0 0', lineHeight: 1.6, fontWeight: 300 }}>
Founding Membership is limited to the first 100 supporters and includes 3 years of Care+. &nbsp;·&nbsp; Founders Gift Box ships late summer. &nbsp;·&nbsp; All tiers include YourKitchen's service fee on orders.
</p>
</div>
</div>
)
}

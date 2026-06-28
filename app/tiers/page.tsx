'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { startFoundingBankCheckout, FOUNDING_CARD_LINK, FOUNDING_CARD_LINKS, type FoundingCircle } from '@/lib/foundingCheckout'

const S = {
sage: '#3D6B4F', sageMid: '#6B9E7E', sageLight: '#EAF2ED',
cream: '#FAFAF5', forest: '#1E2620', stone: '#6B7066',
border: '#DDE8E0', white: '#FFFFFF', amber: '#3D6B4F',
amberLight: '#EAF2ED', amberText: '#2D5240', red: '#B94040',
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

const FOUNDING_CIRCLES: { circle: FoundingCircle; name: string; price: string; term: string; accent: string; badgeBg: string; badgeText: string; perks: string[] }[] = [
  { circle: 'friend',  name: 'Founding Friend',  price: '$200',   term: '3 years of Care+', accent: '#A86B3C', badgeBg: '#A86B3C', badgeText: '#FBF4EB', perks: ['Founders Gift Box, shipped to you', 'Gift 90 days of Care+ to a friend', 'Your name in the Founding story'] },
  { circle: 'patron',  name: 'Founding Patron',  price: '$350',   term: '4 years of Care+', accent: '#8C949B', badgeBg: '#8C949B', badgeText: '#FFFFFF', perks: ['Everything in Friend', 'Bless two friends \u2014 2 gifts, 90 days each'] },
  { circle: 'builder', name: 'Founding Builder', price: '$500',   term: '5 years of Care+', accent: '#C79A45', badgeBg: '#C79A45', badgeText: '#3A2C0A', perks: ['Everything in Patron', '2 gifts of 180 days each', 'A say in the roadmap + a call with the founder'] },
  { circle: 'partner', name: 'Founding Partner', price: '$1,000', term: 'Care+ for life',   accent: '#7C868E', badgeBg: '#4A5258', badgeText: '#FFFFFF', perks: ['Everything in Builder', '3 gifts of 180 days each', 'Permanent recognition as a founder'] },
]

// Pilot: hide the Care (free) and Care+ cards on the pricing page until the
// tiers rework. Flip to true (or remove this gate) to bring them back.
const SHOW_OTHER_TIERS = false

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
// During the Vercel lockout, founding checkout can't run through the API
// (the price-ID env var can't be set), so route founding straight to the
// hosted Stripe Payment Link instead. Account stays as-is; founding status
// is provisioned manually once the payment lands.
if (tierKey === 'founding') {
setSwitching('founding')
await startFoundingBankCheckout(userId)
setSwitching(null)
return
}
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

const handleFounding = async (circle: FoundingCircle) => {
setError('')
setSwitching(`f_${circle}`)
await startFoundingBankCheckout(userId, circle)
setSwitching(null)
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
.founding-grid { display: grid; grid-template-columns: 1fr; gap: 14px; }
@media (min-width: 720px) { .founding-grid { grid-template-columns: 1fr 1fr; gap: 12px; align-items: stretch; } }
@media (min-width: 1080px) { .founding-grid { grid-template-columns: repeat(4, 1fr); gap: 12px; align-items: stretch; max-width: 1180px; margin: 0 auto; } }
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
Four founding circles, one limited group of 250. Your belief funds YourKitchen \u2014 every circle locks in Care+, the badge, and the Founders Gift Box. Pay by bank to keep fees near zero, so more goes into the build.
</p>

{error && <div style={{ background: '#FDE8E8', border: `1.5px solid ${S.red}`, borderRadius: 12, padding: '12px 16px', marginBottom: 20 }}><p style={{ fontSize: 13, color: S.red, margin: 0 }}>⚠️ {error}</p></div>}

<div className="tier-grid">

{SHOW_OTHER_TIERS && (<>
{/* FREE */}
<div style={{ background: S.white, border: `0.5px solid ${S.border}`, borderRadius: 14, padding: '20px', position: 'relative' }}>
<span style={{ display: 'inline-block', fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 8, marginBottom: 10, background: S.sageLight, color: '#2D5240' }}>Care</span>
<div style={{ fontSize: 18, fontWeight: 500, color: S.forest, marginBottom: 4 }}>Kitchen Care</div>
<div style={{ fontSize: 13, color: S.stone, marginBottom: 14 }}><strong style={{ fontSize: 22, fontWeight: 500, color: S.forest }}>Free</strong> / always</div>
{renderSections(FREE_SECTIONS)}
<button onClick={() => handleSwitch('free')} disabled={!!switching || currentTier === 'free'}
style={{ display: 'block', width: '100%', padding: '11px', borderRadius: 8, border: `0.5px solid ${S.border}`, background: '#F0F0EB', color: S.forest, fontSize: 13, fontWeight: 600, cursor: currentTier === 'free' ? 'default' : 'pointer', marginTop: 16, fontFamily: "'DM Sans', sans-serif" }}>
{ctaLabel('free', 'Switch to Care')}
</button>
</div>

{/* CARE+ */}
<div style={{ background: S.white, border: `2px solid ${S.sage}`, borderRadius: 14, padding: '20px', position: 'relative' }}>
<span style={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)', background: S.stone, color: S.white, fontSize: 10, fontWeight: 600, padding: '3px 12px', borderRadius: 10, whiteSpace: 'nowrap' }}>Coming soon</span>
<span style={{ display: 'inline-block', fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 8, marginBottom: 10, background: S.sageLight, color: '#2D5240' }}>Care+</span>
<div style={{ fontSize: 18, fontWeight: 500, color: S.forest, marginBottom: 4 }}>Kitchen Care+</div>
<div style={{ fontSize: 13, color: S.stone, marginBottom: 14 }}><strong style={{ fontSize: 22, fontWeight: 500, color: S.forest }}>$9.99</strong> / month <span style={{ fontSize: 11, color: S.sageMid }}>· or $90/yr</span></div>
{renderSections(CARE_SECTIONS)}
<button disabled
style={{ display: 'block', width: '100%', padding: '11px', borderRadius: 8, border: `1px solid ${S.border}`, background: '#F0F0EB', color: S.stone, fontSize: 13, fontWeight: 600, cursor: 'default', marginTop: 16, fontFamily: "'DM Sans', sans-serif" }}>
Coming soon
</button>
</div>
</>)}

</div>

<div className="founding-grid">
{FOUNDING_CIRCLES.map((fc) => (
<div key={fc.circle} style={{ background: S.white, border: `0.5px solid ${S.border}`, borderRadius: 14, padding: '20px', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
<div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: fc.accent }} />
<span style={{ alignSelf: 'flex-start', display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '4px 11px', borderRadius: 8, marginTop: 4, marginBottom: 12, background: fc.badgeBg, color: fc.badgeText }}>{fc.name}</span>
<div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 2 }}>
<strong style={{ fontFamily: "'Lora', serif", fontSize: 26, fontWeight: 600, color: S.forest, letterSpacing: -0.5 }}>{fc.price}</strong>
<span style={{ fontSize: 12, color: S.stone }}>once</span>
</div>
<div style={{ fontSize: 12, fontWeight: 600, color: S.sage, background: S.sageLight, borderRadius: 8, padding: '7px 10px', textAlign: 'center', margin: '10px 0 12px' }}>{fc.term}</div>
<div style={{ flex: 1 }}>
{fc.perks.map((p, i) => (
<div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, marginBottom: 7, fontSize: 12, color: S.forest, lineHeight: 1.4 }}>
<span style={{ width: 5, height: 5, borderRadius: '50%', background: fc.accent, flexShrink: 0, marginTop: 5 }} />
<span>{p}</span>
</div>
))}
</div>
<button onClick={() => handleFounding(fc.circle)} disabled={!!switching || currentTier === 'founding'}
style={{ display: 'block', width: '100%', padding: '11px', borderRadius: 8, border: 'none', background: S.amber, color: S.white, fontSize: 13, fontWeight: 600, cursor: currentTier === 'founding' ? 'default' : 'pointer', marginTop: 14, fontFamily: "'DM Sans', sans-serif", opacity: switching ? 0.6 : 1 }}>
{currentTier === 'founding' ? '\u2713 Founding member' : switching === `f_${fc.circle}` ? 'Loading\u2026' : 'Pay by bank'}
</button>
{currentTier !== 'founding' && (
<button onClick={() => window.open(`${FOUNDING_CARD_LINKS[fc.circle]}?client_reference_id=${userId}`, '_blank', 'noopener')}
style={{ display: 'block', width: '100%', padding: 0, border: 'none', background: 'transparent', color: S.stone, fontSize: 11, fontWeight: 500, textDecoration: 'underline', cursor: 'pointer', marginTop: 8, fontFamily: "'DM Sans', sans-serif" }}>Prefer to pay by card?</button>
)}
</div>
))}
</div>

<p style={{ fontSize: 11, color: S.stone, textAlign: 'center', margin: '24px 0 0', lineHeight: 1.6, fontWeight: 300 }}>
Founding is limited to 250 supporters across all circles. &nbsp;·&nbsp; Pay by bank (ACH) keeps fees near zero \u2014 more of your gift funds the build. &nbsp;·&nbsp; Founders Gift Box ships late summer. &nbsp;·&nbsp; All plans include YourKitchen's service fee on orders.
</p>
</div>
</div>
)
}

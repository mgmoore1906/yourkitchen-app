'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const S = {
sage: '#3D6B4F', sageMid: '#6B9E7E', sageLight: '#EAF2ED',
cream: '#FAFAF5', forest: '#1E2620', stone: '#6B7066',
border: '#DDE8E0', white: '#FFFFFF', amber: '#C17F47',
amberLight: '#FFF8E8', red: '#B94040', redLight: '#FEE8E8',
}

const MEAL_EMOJI: Record<string, string> = { breakfast: '🌅', lunch: '☀️', dinner: '🌙' }

type MealItem = { name: string; price: number; qty: number; category: 'adult'|'kids' }
type Proposal = {
id: string
status: string
coordinator_note: string | null
coordinator_name: string | null
restaurant_name: string | null
meal_name: string | null
meal_items: MealItem[] | null
meal_type?: string
delivery_date?: string
claims: { calendar_date_id: string; calendar_dates: { date: string; meal_type: string } | null } | null
}

export default function ProposalPage() {
const { id } = useParams<{ id: string }>()
const router = useRouter()
const supabase = createClient()

const [loading, setLoading] = useState(true)
const [proposal, setProposal] = useState<Proposal | null>(null)
const [notFound, setNotFound] = useState(false)
const [confirming, setConfirming] = useState(false)
const [declining, setDeclining] = useState(false)
const [declined, setDeclined] = useState(false)
const [declineNote, setDeclineNote] = useState('')
const [confirmed, setConfirmed] = useState(false)
const [error, setError] = useState('')

useEffect(() => {
const load = async () => {
const { data, error } = await supabase
.from('meal_proposals')
.select(`
id, status, coordinator_note, coordinator_name,
restaurant_name, meal_name, meal_items, delivery_date, meal_type,
claims(calendar_date_id, calendar_dates(date, meal_type))
`)
.eq('id', id)
.single()

if (error || !data) { setNotFound(true); setLoading(false); return }
setProposal(data as any)
if (data.status === 'confirmed') setConfirmed(true)
if (data.status === 'declined') setDeclined(true)
setLoading(false)
}
load()
}, [id])

const handleConfirm = async () => {
setConfirming(true); setError('')
const res = await fetch('/api/confirm', {
method: 'POST', headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ proposal_id: id, action: 'confirm' }),
})
const data = await res.json()
if (!res.ok) { setError(data.error || 'Something went wrong.'); setConfirming(false); return }
setConfirmed(true)
}

const handleDecline = async () => {
setDeclining(true); setError('')
const res = await fetch('/api/confirm', {
method: 'POST', headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ proposal_id: id, action: 'decline', note: declineNote }),
})
const data = await res.json()
if (!res.ok) { setError(data.error || 'Something went wrong.'); setDeclining(false); return }
setDeclined(true)
}

const formatDate = (d: string) =>
new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

const mealType = proposal?.meal_type || proposal?.claims?.calendar_dates?.meal_type || 'dinner'
const coordName = proposal?.coordinator_name || 'Someone'
const date = proposal?.delivery_date || proposal?.claims?.calendar_dates?.date
const mealEmoji = MEAL_EMOJI[mealType] || '🍽'
const items: MealItem[] = Array.isArray(proposal?.meal_items) ? proposal!.meal_items! : []
const hasItems = items.length > 0
const mealSummary = proposal?.meal_name || (hasItems ? items.map(i => i.qty>1?`${i.name} ×${i.qty}`:i.name).join(', ') : 'Meal')

if (loading) return (
<div style={{ minHeight: '100vh', background: S.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans', sans-serif" }}>
<p style={{ color: S.stone, fontSize: 14 }}>Loading proposal…</p>
</div>
)

if (notFound) return (
<Page>
<div style={{ textAlign: 'center', padding: '40px 0' }}>
<div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
<h1 style={titleStyle}>Proposal not found</h1>
<p style={subStyle}>This link may have expired or already been responded to.</p>
<button onClick={() => router.push('/dashboard')} style={btnPrimary}>Go to my Kitchen</button>
</div>
</Page>
)

if (confirmed) return (
<Page>
<div style={{ textAlign: 'center', padding: '16px 0' }}>
<div style={{ fontSize: 56, marginBottom: 14 }}>🧡</div>
<h1 style={titleStyle}>Meal confirmed!</h1>
<p style={subStyle}>The order is being arranged and a courier will be on the way. You'll get a tracking link via SMS when a driver is assigned.</p>
<div style={card}>
{hasItems && (
<div style={{ borderBottom: `0.5px solid ${S.sageLight}`, paddingBottom: 10, marginBottom: 4 }}>
{items.map((it, i) => (
<div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
<span style={{ fontSize: 13, color: S.forest }}>{it.category==='kids'?'🧒':'👤'} {it.name} ×{it.qty}</span>
<span style={{ fontSize: 13, color: S.stone }}>${(it.price*it.qty).toFixed(2)}</span>
</div>
))}
</div>
)}
{[
['Restaurant', proposal?.restaurant_name],
['Date', date ? formatDate(date) : '—'],
['Sent by', coordName],
].map(([l, v]) => (
<div key={l} style={row}>
<span style={rowLabel}>{l}</span>
<span style={rowValue}>{v}</span>
</div>
))}
</div>
<button onClick={() => router.push('/dashboard')} style={{ ...btnPrimary, marginTop: 20 }}>Back to my Kitchen</button>
</div>
</Page>
)

if (declined) return (
<Page>
<div style={{ textAlign: 'center', padding: '16px 0' }}>
<div style={{ fontSize: 56, marginBottom: 14 }}>✕</div>
<h1 style={titleStyle}>Proposal declined</h1>
<p style={subStyle}>{coordName} has been notified. The date is back open for your village to claim.</p>
<button onClick={() => router.push('/dashboard')} style={{ ...btnPrimary, marginTop: 20 }}>Back to my Kitchen</button>
</div>
</Page>
)

if (declining) return (
<Page title="Decline proposal">
<p style={{ ...subStyle, marginBottom: 20 }}>No charge will be applied. {coordName} will be notified.</p>
<div style={{ background: S.amberLight, borderRadius: 12, padding: '14px 16px', marginBottom: 20 }}>
<p style={{ fontSize: 13, color: S.amber, margin: 0, lineHeight: 1.6 }}>
The date will reopen so someone else in your village can claim it.
</p>
</div>
<label style={labelStyle}>Send a note to {coordName} <span style={{ fontWeight: 300, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
<textarea value={declineNote} onChange={e => setDeclineNote(e.target.value)}
placeholder={`e.g. "We're actually going out that night — can you try another day?"`}
style={{ width: '100%', minHeight: 100, borderRadius: 10, border: `1.5px solid ${S.border}`, padding: '12px 14px', fontSize: 14, fontFamily: "'DM Sans', sans-serif", color: S.forest, background: S.white, resize: 'none', outline: 'none', boxSizing: 'border-box', lineHeight: 1.6, marginBottom: 16 }} />
{error && <p style={{ color: S.red, fontSize: 13, marginBottom: 12 }}>{error}</p>}
<div style={{ display: 'flex', gap: 10 }}>
<button onClick={() => setDeclining(false)} style={btnOutline}>← Back</button>
<button onClick={handleDecline} style={{ ...btnPrimary, flex: 1, background: S.red }}>Send &amp; Decline</button>
</div>
</Page>
)

return (
<Page title="Meal proposal">
<div style={{ display: 'flex', alignItems: 'center', gap: 14, background: S.sageLight, borderRadius: 14, padding: '14px 16px', marginBottom: 16 }}>
<div style={{ width: 44, height: 44, borderRadius: 13, background: S.sage, display: 'flex', alignItems: 'center', justifyContent: 'center', color: S.white, fontWeight: 700, fontSize: 17, flexShrink: 0 }}>
{coordName.charAt(0).toUpperCase()}
</div>
<div>
<div style={{ fontFamily: "'Lora', serif", fontSize: 15, fontWeight: 500, color: S.forest }}>
{coordName} wants to send you {mealType}
</div>
<div style={{ fontSize: 12, color: S.stone, fontWeight: 300, marginTop: 2 }}>No charge until you confirm</div>
</div>
</div>

<div style={card}>
<p style={sectionLabel}>Proposed meal</p>
<div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: hasItems ? 12 : 12 }}>
<div style={{ width: 48, height: 48, borderRadius: 12, background: S.sageLight, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>{mealEmoji}</div>
<div>
<div style={{ fontFamily: "'Lora', serif", fontSize: 16, fontWeight: 600, color: S.forest }}>{proposal?.restaurant_name}</div>
<div style={{ fontSize: 13, color: S.stone, fontWeight: 300, marginTop: 2 }}>{hasItems ? `${items.reduce((s,i)=>s+i.qty,0)} items` : mealSummary}</div>
</div>
</div>
{hasItems && (
<div style={{ borderTop: `0.5px solid ${S.sageLight}`, paddingTop: 10, marginBottom: 4 }}>
{items.map((it, i) => (
<div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
<span style={{ fontSize: 13, color: S.forest }}>{it.category==='kids'?'🧒':'👤'} {it.name} ×{it.qty}</span>
<span style={{ fontSize: 13, color: S.stone }}>${(it.price*it.qty).toFixed(2)}</span>
</div>
))}
</div>
)}
{[
['Date', date ? formatDate(date) : '—'],
['Meal type', mealType.charAt(0).toUpperCase() + mealType.slice(1)],
['Paid by', coordName],
].map(([l, v]) => (
<div key={l} style={row}>
<span style={rowLabel}>{l}</span>
<span style={rowValue}>{v}</span>
</div>
))}
</div>

{proposal?.coordinator_note && (
<div style={{ background: S.sageLight, borderRadius: 12, padding: '14px 16px', marginBottom: 16, fontFamily: "'Lora', serif", fontSize: 14, fontStyle: 'italic', color: S.forest, lineHeight: 1.7 }}>
"{proposal.coordinator_note}"
</div>
)}

<div style={{ background: S.white, border: `0.5px solid ${S.border}`, borderRadius: 12, padding: '13px 16px', marginBottom: 24 }}>
<p style={{ fontSize: 13, color: S.stone, margin: 0, lineHeight: 1.6 }}>
📱 Confirming arranges the order and notifies {coordName}. Nothing is charged unless you tap <strong>Confirm.</strong>
</p>
</div>

{error && <p style={{ color: S.red, fontSize: 13, marginBottom: 14 }}>{error}</p>}

<div style={{ display: 'flex', gap: 10 }}>
<button onClick={() => setDeclining(true)} style={btnOutline}>✕ Decline</button>
<button onClick={handleConfirm} disabled={confirming}
style={{ ...btnPrimary, flex: 1, background: confirming ? S.sageMid : S.forest }}>
{confirming ? 'Confirming…' : '✓ Confirm — Send it!'}
</button>
</div>
</Page>
)
}

function Page({ children, title }: { children: React.ReactNode; title?: string }) {
return (
<div style={{ minHeight: '100vh', background: S.cream, fontFamily: "'DM Sans', sans-serif" }}>
<link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />
<nav style={{ background: S.white, borderBottom: `0.5px solid ${S.border}`, padding: '14px 28px', display: 'flex', alignItems: 'center', gap: 10 }}>
<div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
<span style={{ fontSize: 8, fontWeight: 500, letterSpacing: 5, color: S.sageMid, textTransform: 'uppercase' }}>Your</span>
<span style={{ fontFamily: "'Lora', serif", fontSize: 20, fontWeight: 500, color: S.forest }}>Kitchen</span>
</div>
{title && <span style={{ fontSize: 13, color: S.stone, fontWeight: 300, marginLeft: 8 }}>· {title}</span>}
</nav>
<div style={{ maxWidth: 480, margin: '0 auto', padding: '28px 24px 60px' }}>{children}</div>
</div>
)
}

const titleStyle: React.CSSProperties = { fontFamily: "'Lora', serif", fontSize: 26, fontWeight: 500, color: S.forest, margin: '0 0 10px', letterSpacing: -0.5 }
const subStyle: React.CSSProperties = { fontSize: 14, color: S.stone, fontWeight: 300, lineHeight: 1.7, margin: '0 0 20px' }
const card: React.CSSProperties = { background: S.white, border: `0.5px solid ${S.border}`, borderRadius: 14, padding: '16px', marginBottom: 14 }
const row: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `0.5px solid ${S.sageLight}` }
const rowLabel: React.CSSProperties = { fontSize: 13, color: S.stone, fontWeight: 300 }
const rowValue: React.CSSProperties = { fontSize: 13, color: S.forest, fontWeight: 500, textAlign: 'right' }
const sectionLabel: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: S.stone, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 12px' }
const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: S.stone, letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }
const btnPrimary: React.CSSProperties = { width: '100%', padding: '14px', background: S.forest, color: S.white, border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }
const btnOutline: React.CSSProperties = { padding: '14px 20px', background: 'transparent', color: S.stone, border: `1.5px solid ${S.border}`, borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }

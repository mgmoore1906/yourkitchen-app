'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const S = {
sage: '#3D6B4F', sageMid: '#6B9E7E', sageLight: '#EAF2ED',
cream: '#FAFAF5', forest: '#1E2620', stone: '#6B7066',
border: '#DDE8E0', white: '#FFFFFF', amber: '#C17F47',
amberLight: '#FBF0E4', red: '#B94040',
}

const STEPS = [
{ n: 1, icon: '🏠', title: 'Set up your Kitchen', body: 'Add your favorite restaurants, the dates you’d like meals, and any dietary needs. Takes about five minutes.' },
{ n: 2, icon: '🔗', title: 'Share your link', body: 'Send your Kitchen link to friends and family. They pick an open date and choose a meal — no account needed.' },
{ n: 3, icon: '🧡', title: 'Confirm and enjoy', body: 'You get a text to approve each meal. Once you say yes, it’s arranged and delivered to your door.' },
]

const VIDEOS = [
{ id: 'setup', title: 'Setting up your Kitchen', length: '2 min', desc: 'A walkthrough of adding restaurants, meals, and your calendar.' },
{ id: 'share', title: 'Sharing with your village', length: '1 min', desc: 'How to send your link and what your supporters see.' },
{ id: 'confirm', title: 'Confirming a meal', length: '1 min', desc: 'The text-to-confirm flow, start to finish.' },
]

const FAQS = [
{ q: 'Does it cost anything to receive meals?', a: 'No. Setting up a Kitchen and receiving meals is free. The people who send you meals cover the cost of the food and delivery when they place an order.' },
{ q: 'Do my friends need to download anything?', a: 'No. They just open your Kitchen link in any web browser, pick a date, and choose a meal. No app, no account required.' },
{ q: 'Do the restaurants need to be on DoorDash or Uber Eats?', a: 'No. We arrange a courier to pick up from any restaurant that offers takeout, so your favorite local spots work too.' },
{ q: 'What if I need to decline a meal?', a: 'Every meal waits for your yes. If a date doesn’t work, you can decline with one tap and the date reopens for someone else — no charge is ever made.' },
{ q: 'Can I set dietary restrictions?', a: 'Yes. Add them in Settings and they appear as a reminder to anyone choosing a meal for you, so your needs are always front of mind.' },
{ q: 'How is my delivery handled?', a: 'You choose “leave at door” or “hand to me” for each order. For families with a newborn or someone resting, leave-at-door with a text on arrival is the gentlest option.' },
]

function VideoSlot({ v }: { v: { id: string; title: string; length: string; desc: string } }) {
const [showTranscript, setShowTranscript] = useState(false)
return (
<div style={{ background: S.white, border: `1px solid ${S.border}`, borderRadius: 14, overflow: 'hidden', marginBottom: 14 }}>
<div role="img" aria-label={`Tutorial video placeholder: ${v.title}`}
style={{ aspectRatio: '16 / 9', background: S.sageLight, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
<div style={{ width: 52, height: 52, borderRadius: '50%', background: S.sage, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
<span style={{ color: S.white, fontSize: 20, marginLeft: 3 }}>▶</span>
</div>
<span style={{ fontSize: 12, color: S.sage, fontWeight: 500 }}>Video coming soon · {v.length}</span>
</div>
<div style={{ padding: '14px 16px' }}>
<div style={{ fontFamily: "'Lora', serif", fontSize: 15, fontWeight: 600, color: S.forest, marginBottom: 4 }}>{v.title}</div>
<p style={{ fontSize: 13, color: S.stone, fontWeight: 300, margin: '0 0 10px', lineHeight: 1.5 }}>{v.desc}</p>
<button onClick={() => setShowTranscript(t => !t)}
style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: S.sage, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}
aria-expanded={showTranscript}>
<span>📄</span> {showTranscript ? 'Hide transcript' : 'Read transcript'}
</button>
{showTranscript && (
<p style={{ fontSize: 13, color: S.stone, fontWeight: 300, margin: '10px 0 0', lineHeight: 1.6, paddingTop: 10, borderTop: `0.5px solid ${S.border}` }}>
A written transcript will appear here when this tutorial is published — every video on YourKitchen ships with captions and a full transcript for accessibility.
</p>
)}
</div>
</div>
)
}

function FaqItem({ q, a }: { q: string; a: string }) {
const [open, setOpen] = useState(false)
return (
<div style={{ borderBottom: `0.5px solid ${S.border}` }}>
<button onClick={() => setOpen(o => !o)}
style={{ width: '100%', padding: '16px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", textAlign: 'left' }}
aria-expanded={open}>
<span style={{ fontSize: 14, fontWeight: 500, color: S.forest }}>{q}</span>
<span style={{ fontSize: 14, color: S.stone, transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none', flexShrink: 0 }}>▾</span>
</button>
{open && <p style={{ fontSize: 14, color: S.stone, fontWeight: 300, margin: '0 0 16px', lineHeight: 1.7 }}>{a}</p>}
</div>
)
}

export default function HelpPage() {
const router = useRouter()
return (
<div style={{ minHeight: '100vh', background: S.cream, fontFamily: "'DM Sans', sans-serif", paddingBottom: 60 }}>
<link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />

<nav style={{ background: S.forest, padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 10 }}>
<button onClick={() => router.push('/dashboard')} aria-label="Back to dashboard"
style={{ background: S.sage, border: 'none', borderRadius: 10, width: 36, height: 36, cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', color: S.white }}>‹</button>
<div>
<div style={{ fontSize: 9, fontWeight: 500, letterSpacing: 5, color: S.sageMid, textTransform: 'uppercase' }}>Your</div>
<div style={{ fontFamily: "'Lora', serif", fontSize: 20, fontWeight: 500, color: S.white }}>Kitchen</div>
</div>
</nav>

<div style={{ padding: '28px 24px', maxWidth: 600, margin: '0 auto' }}>

{/* Hero */}
<h1 style={{ fontFamily: "'Lora', serif", fontSize: 28, fontWeight: 500, color: S.forest, margin: '0 0 8px', letterSpacing: -0.5 }}>About &amp; Help</h1>
<p style={{ fontSize: 15, color: S.stone, fontWeight: 300, margin: '0 0 32px', lineHeight: 1.7 }}>
YourKitchen helps your people show up with a meal when life gets hard — a new baby, an illness, a loss, a deployment. Here’s how it works.
</p>

{/* How it works */}
<p style={sLabel}>How it works</p>
<div style={{ marginBottom: 36 }}>
{STEPS.map(s => (
<div key={s.n} style={{ display: 'flex', gap: 16, marginBottom: 18, alignItems: 'flex-start' }}>
<div style={{ width: 44, height: 44, borderRadius: 13, background: S.sageLight, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{s.icon}</div>
<div>
<div style={{ fontFamily: "'Lora', serif", fontSize: 16, fontWeight: 600, color: S.forest, marginBottom: 3 }}>{s.title}</div>
<p style={{ fontSize: 14, color: S.stone, fontWeight: 300, margin: 0, lineHeight: 1.6 }}>{s.body}</p>
</div>
</div>
))}
</div>

{/* Tutorials */}
<p style={sLabel}>Video tutorials</p>
<p style={{ fontSize: 13, color: S.stone, fontWeight: 300, margin: '0 0 16px', lineHeight: 1.6 }}>
Short walkthroughs of each part of YourKitchen. Every video includes captions and a full transcript.
</p>
<div style={{ marginBottom: 36 }}>
{VIDEOS.map(v => <VideoSlot key={v.id} v={v} />)}
</div>

{/* FAQ */}
<p style={sLabel}>Frequently asked</p>
<div style={{ background: S.white, border: `1px solid ${S.border}`, borderRadius: 16, padding: '4px 18px', marginBottom: 36 }}>
{FAQS.map((f, i) => <FaqItem key={i} q={f.q} a={f.a} />)}
</div>

{/* Contact */}
<p style={sLabel}>Still need help?</p>
<div style={{ background: S.sageLight, borderRadius: 16, padding: '20px', textAlign: 'center' }}>
<p style={{ fontSize: 14, color: S.forest, fontWeight: 400, margin: '0 0 14px', lineHeight: 1.6 }}>
We’re a small team and we read every message. Reach out any time.
</p>
<a href="mailto:support@yourkitchen.app"
style={{ display: 'inline-block', background: S.sage, color: S.white, textDecoration: 'none', borderRadius: 10, padding: '12px 24px', fontSize: 14, fontWeight: 600 }}>
Email support →
</a>
</div>

<p style={{ fontSize: 11, color: S.stone, textAlign: 'center', margin: '28px 0 0', fontWeight: 300 }}>
<a href="https://yourkitchen.app/privacy" style={{ color: S.stone }}>Privacy</a> &nbsp;·&nbsp;
<a href="https://yourkitchen.app/terms" style={{ color: S.stone }}>Terms</a>
</p>
</div>
</div>
)
}

const sLabel: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: '#6B7066', letterSpacing: 2, textTransform: 'uppercase', margin: '0 0 14px', display: 'block' }

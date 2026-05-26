'use client'
// FILE: app/kitchen/restaurants/page.tsx
// Manage restaurants for an existing Kitchen.
// Includes the "Don't see your restaurant?" request form at the bottom.

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const ALL_RESTAURANTS = [
  { id: 'first-watch',  name: 'First Watch',              emoji: '🥞', cuisine: 'American Breakfast & Brunch',  rating: 4.7 },
  { id: 'toasted-yolk', name: 'The Toasted Yolk Cafe',    emoji: '🍳', cuisine: 'American Breakfast & Brunch',  rating: 4.8 },
  { id: 'harvest',      name: 'Harvest Kitchen & Bakery', emoji: '🌿', cuisine: 'Farm-to-Table Brunch',         rating: 4.9 },
  { id: 'cava',         name: 'Cava',                     emoji: '🫙', cuisine: 'Mediterranean',                rating: 4.7 },
  { id: 'kebab-shop',   name: 'The Kebab Shop',           emoji: '🥙', cuisine: 'Mediterranean',                rating: 4.5 },
  { id: 'mod-fresh',    name: 'Mod Fresh',                emoji: '🥗', cuisine: 'Healthy Fast-Casual',          rating: 4.6 },
  { id: 'up-thai',      name: 'Up Thai Kitchen',          emoji: '🍜', cuisine: 'Thai',                        rating: 4.8 },
]

export default function KitchenRestaurantsPage() {
  const router  = useRouter()
  const supabase = createClient()

  const [kitchenId, setKitchenId]         = useState<string | null>(null)
  const [kitchenSlug, setKitchenSlug]     = useState('')
  const [userName, setUserName]           = useState('')
  const [selected, setSelected]           = useState<string[]>([])
  const [loading, setLoading]             = useState(true)
  const [saving, setSaving]               = useState(false)
  const [saveMsg, setSaveMsg]             = useState('')

  // Request form state
  const [showRequest, setShowRequest]     = useState(false)
  const [reqName, setReqName]             = useState('')
  const [reqCity, setReqCity]             = useState('')
  const [reqNotes, setReqNotes]           = useState('')
  const [reqSending, setReqSending]       = useState(false)
  const [reqMsg, setReqMsg]               = useState('')

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
      setUserName(profile?.full_name || '')

      const { data: kitchen } = await supabase
        .from('kitchens').select('id, slug').eq('organizer_id', user.id).single()
      if (!kitchen) { router.push('/kitchen/setup'); return }
      setKitchenId(kitchen.id)
      setKitchenSlug(kitchen.slug)

      const { data: rests } = await supabase
        .from('kitchen_restaurants')
        .select('restaurant_id')
        .eq('kitchen_id', kitchen.id)
      setSelected(rests?.map((r: any) => r.restaurant_id) || [])
      setLoading(false)
    }
    load()
  }, [])

  const toggle = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const handleSave = async () => {
    if (!kitchenId) return
    setSaving(true); setSaveMsg('')
    const res = await fetch('/api/restaurants', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kitchen_id: kitchenId, restaurant_ids: selected }),
    })
    if (res.ok) { setSaveMsg('Saved!'); setTimeout(() => setSaveMsg(''), 2500) }
    else { setSaveMsg('Something went wrong.') }
    setSaving(false)
  }

  const handleRequest = async () => {
    if (!reqName || !reqCity) return
    setReqSending(true); setReqMsg('')
    const res = await fetch('/api/request-restaurant', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_name: userName,
        kitchen_slug: kitchenSlug,
        restaurant_name: reqName,
        city: reqCity,
        notes: reqNotes,
      }),
    })
    if (res.ok) {
      setReqMsg('Request sent! We\'ll add it within 24 hours.')
      setReqName(''); setReqCity(''); setReqNotes('')
      setShowRequest(false)
    } else {
      setReqMsg('Could not send request. Try again.')
    }
    setReqSending(false)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#FAFAF5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans', sans-serif" }}>
      <p style={{ color: '#6B7066', fontSize: 14 }}>Loading restaurants…</p>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF5', fontFamily: "'DM Sans', sans-serif", padding: '0 0 60px' }}>
      <link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />

      {/* Nav */}
      <nav style={{ background: '#fff', borderBottom: '0.5px solid #DDE8E0', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 10 }}>
        <button onClick={() => router.push('/dashboard')} style={{ background: '#EAF2ED', border: 'none', borderRadius: 10, width: 36, height: 36, cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3D6B4F' }}>‹</button>
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: 8, fontWeight: 500, letterSpacing: 5, color: '#6B9E7E', textTransform: 'uppercase', display: 'block' }}>Your</span>
          <span style={{ fontFamily: "'Lora', serif", fontSize: 20, fontWeight: 500, color: '#1E2620' }}>Kitchen</span>
        </div>
        {saveMsg && <span style={{ fontSize: 12, color: '#3D6B4F', fontWeight: 600 }}>{saveMsg}</span>}
        <button onClick={handleSave} disabled={saving} style={{ background: saving ? '#DDE8E0' : '#3D6B4F', color: '#fff', border: 'none', borderRadius: 10, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: saving ? 'default' : 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </nav>

      <div style={{ padding: '24px', maxWidth: 540, margin: '0 auto' }}>
        <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#3D6B4F', margin: '0 0 6px' }}>My Restaurants</p>
        <h1 style={{ fontFamily: "'Lora', serif", fontSize: 24, fontWeight: 500, color: '#1E2620', margin: '0 0 6px', letterSpacing: -0.5 }}>Your dining list</h1>
        <p style={{ fontSize: 14, color: '#6B7066', margin: '0 0 24px', fontWeight: 300 }}>
          Coordinators order from these. Select up to 5. All delivered via DoorDash.
        </p>

        <p style={{ fontSize: 12, color: '#6B9E7E', margin: '0 0 16px', fontWeight: 600 }}>{selected.length}/5 selected</p>

        {/* Restaurant list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 32 }}>
          {ALL_RESTAURANTS.map(r => {
            const sel = selected.includes(r.id)
            const atLimit = selected.length >= 5 && !sel
            return (
              <button
                key={r.id}
                onClick={() => !atLimit && toggle(r.id)}
                style={{ background: sel ? '#EAF2ED' : '#fff', border: `2px solid ${sel ? '#3D6B4F' : '#DDE8E0'}`, borderRadius: 16, padding: '14px 16px', cursor: atLimit ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 14, transition: 'all 0.15s', fontFamily: "'DM Sans', sans-serif", opacity: atLimit ? 0.45 : 1 }}
              >
                <div style={{ width: 44, height: 44, borderRadius: 12, background: sel ? '#3D6B4F' : '#EAF2ED', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>{r.emoji}</div>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ fontFamily: "'Lora', serif", fontSize: 15, fontWeight: 600, color: '#1E2620' }}>{r.name}</div>
                  <div style={{ fontSize: 12, color: '#6B7066', fontWeight: 300, marginTop: 2 }}>{r.cuisine} · ★ {r.rating} · DoorDash</div>
                </div>
                <div style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${sel ? '#3D6B4F' : '#DDE8E0'}`, background: sel ? '#3D6B4F' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, flexShrink: 0 }}>
                  {sel ? '✓' : ''}
                </div>
              </button>
            )
          })}
        </div>

        {/* ── Restaurant request card ── */}
        {reqMsg && !showRequest && (
          <div style={{ background: '#EAF2ED', border: '1.5px solid #3D6B4F', borderRadius: 14, padding: '14px 18px', marginBottom: 16 }}>
            <p style={{ fontSize: 13, color: '#2D5240', margin: 0 }}>✓ {reqMsg}</p>
          </div>
        )}

        <div style={{ border: '2px dashed #DDE8E0', borderRadius: 16, padding: showRequest ? '20px' : '18px 20px', transition: 'all 0.2s' }}>
          {!showRequest ? (
            <button
              onClick={() => setShowRequest(true)}
              style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, fontFamily: "'DM Sans', sans-serif", padding: 0 }}
            >
              <div style={{ width: 36, height: 36, borderRadius: 10, background: '#EAF2ED', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>🍽</div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1E2620' }}>Don't see your restaurant?</div>
                <div style={{ fontSize: 12, color: '#6B7066', fontWeight: 300, marginTop: 2 }}>Tap to request a restaurant — we'll add it within 24 hours.</div>
              </div>
              <span style={{ color: '#3D6B4F', fontSize: 18, marginLeft: 'auto' }}>+</span>
            </button>
          ) : (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#1E2620', margin: '0 0 2px' }}>Request a restaurant</p>
                  <p style={{ fontSize: 12, color: '#6B7066', margin: 0, fontWeight: 300 }}>We'll add it to your area within 24 hours.</p>
                </div>
                <button onClick={() => setShowRequest(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#6B7066', padding: 0 }}>✕</button>
              </div>

              <label style={labelStyle}>Restaurant name *</label>
              <input value={reqName} onChange={e => setReqName(e.target.value)} placeholder="e.g. Chick-fil-A" style={inputStyle} />

              <label style={labelStyle}>City *</label>
              <input value={reqCity} onChange={e => setReqCity(e.target.value)} placeholder="e.g. Waller, TX" style={inputStyle} />

              <label style={labelStyle}>Notes (optional)</label>
              <textarea
                value={reqNotes}
                onChange={e => setReqNotes(e.target.value)}
                placeholder="Address, website, or anything helpful"
                style={{ ...inputStyle, minHeight: 72, resize: 'none' as const }}
              />

              {reqMsg && <p style={{ fontSize: 12, color: '#B94040', margin: '0 0 12px' }}>{reqMsg}</p>}

              <button
                onClick={handleRequest}
                disabled={!reqName || !reqCity || reqSending}
                style={{ width: '100%', padding: '13px', borderRadius: 10, border: 'none', background: !reqName || !reqCity ? '#DDE8E0' : '#3D6B4F', color: !reqName || !reqCity ? '#6B7066' : '#fff', fontSize: 14, fontWeight: 500, cursor: !reqName || !reqCity ? 'default' : 'pointer', fontFamily: "'DM Sans', sans-serif" }}
              >
                {reqSending ? 'Sending…' : 'Send Request →'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: '#6B7066', letterSpacing: 1.5, textTransform: 'uppercase', display: 'block', marginBottom: 8 }
const inputStyle: React.CSSProperties = { width: '100%', padding: '12px 14px', borderRadius: 10, border: '1.5px solid #DDE8E0', fontSize: 14, background: '#fff', outline: 'none', boxSizing: 'border-box', marginBottom: 16, fontFamily: "'DM Sans', sans-serif", color: '#1E2620' }

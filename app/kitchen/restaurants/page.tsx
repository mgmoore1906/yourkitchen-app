'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const TIER_LIMITS: Record<string, number> = {
  free:     3,
  trial:    10,
  care:     10,
  annual:   10,
  founding: 999,
}

const TIER_LABELS: Record<string, string> = {
  free:     'Free',
  trial:    'Free Trial',
  care:     'Care+',
  annual:   'Early Adopter',
  founding: 'Founding Member',
}

type Restaurant = {
  id: string
  name: string
  cuisine: string
  is_active: boolean
  doordash_store_id: string | null
}

export default function KitchenRestaurantsPage() {
  const router   = useRouter()
  const supabase = createClient()

  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [saveMsg,     setSaveMsg]     = useState('')
  const [kitchenId,   setKitchenId]   = useState('')
  const [kitchenSlug, setKitchenSlug] = useState('')
  const [userName,    setUserName]    = useState('')
  const [userTier,    setUserTier]    = useState('free')
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])

  // Request form
  const [showReq,    setShowReq]    = useState(false)
  const [reqName,    setReqName]    = useState('')
  const [reqCity,    setReqCity]    = useState('')
  const [reqStreet,  setReqStreet]  = useState('')
  const [reqNotes,   setReqNotes]   = useState('')
  const [reqSending, setReqSending] = useState(false)
  const [reqMsg,     setReqMsg]     = useState('')

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, tier')
        .eq('id', user.id)
        .single()

      setUserName(profile?.full_name || '')
      setUserTier(profile?.tier || 'free')

      const { data: kitchen } = await supabase
        .from('kitchens')
        .select('id, slug')
        .eq('organizer_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)

      if (!kitchen || kitchen.length === 0) { router.push('/kitchen/setup'); return }
      const k = kitchen[0]
      setKitchenId(k.id)
      setKitchenSlug(k.slug)

      const { data: rests } = await supabase
        .from('kitchen_restaurants')
        .select('id, name, cuisine, is_active, doordash_store_id')
        .eq('kitchen_id', k.id)
        .order('created_at', { ascending: true })

      setRestaurants(rests || [])
      setLoading(false)
    }
    load()
  }, [])

  const limit       = TIER_LIMITS[userTier] || 3
  const activeCount = restaurants.filter(r => r.is_active).length
  const atLimit     = activeCount >= limit
  const isFree      = userTier === 'free' || userTier === 'trial'

  const toggleActive = async (id: string, currentActive: boolean) => {
    if (!currentActive && atLimit) return // at limit — can't activate more
    const newActive = !currentActive
    setRestaurants(prev => prev.map(r => r.id === id ? { ...r, is_active: newActive } : r))

    const { error } = await supabase
      .from('kitchen_restaurants')
      .update({ is_active: newActive })
      .eq('id', id)

    if (error) {
      // Revert on error
      setRestaurants(prev => prev.map(r => r.id === id ? { ...r, is_active: currentActive } : r))
      setSaveMsg('Could not update. Try again.')
    } else {
      setSaveMsg(newActive ? 'Restaurant activated' : 'Restaurant hidden from coordinators')
      setTimeout(() => setSaveMsg(''), 2500)
    }
  }

  const handleRequest = async () => {
    if (!reqName.trim() || !reqCity.trim()) return
    setReqSending(true); setReqMsg('')
    const res = await fetch('/api/request-restaurant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_name:       userName,
        kitchen_slug:    kitchenSlug,
        restaurant_name: reqName.trim(),
        city:            reqCity.trim(),
        street:          reqStreet.trim(),
        notes:           reqNotes.trim(),
      }),
    })
    if (res.ok) {
      setReqMsg('Request sent! We\'ll add it within 24 hours. 🧡')
      setReqName(''); setReqCity(''); setReqStreet(''); setReqNotes('')
      setShowReq(false)
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
    <div style={{ minHeight: '100vh', background: '#FAFAF5', fontFamily: "'DM Sans', sans-serif", paddingBottom: 60 }}>
      <link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />

      {/* Nav */}
      <nav style={{ background: '#fff', borderBottom: '0.5px solid #DDE8E0', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 10 }}>
        <button onClick={() => router.push('/dashboard')}
          style={{ background: '#EAF2ED', border: 'none', borderRadius: 10, width: 36, height: 36, cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3D6B4F' }}>‹</button>
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: 8, fontWeight: 500, letterSpacing: 5, color: '#6B9E7E', textTransform: 'uppercase', display: 'block' }}>Your</span>
          <span style={{ fontFamily: "'Lora', serif", fontSize: 20, fontWeight: 500, color: '#1E2620' }}>Kitchen</span>
        </div>
        {saveMsg && <span style={{ fontSize: 12, color: '#3D6B4F', fontWeight: 600 }}>{saveMsg}</span>}
      </nav>

      <div style={{ padding: '24px', maxWidth: 540, margin: '0 auto' }}>
        <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#3D6B4F', margin: '0 0 6px' }}>My Restaurants</p>
        <h1 style={{ fontFamily: "'Lora', serif", fontSize: 24, fontWeight: 500, color: '#1E2620', margin: '0 0 6px', letterSpacing: -0.5 }}>Your dining list</h1>
        <p style={{ fontSize: 14, color: '#6B7066', margin: '0 0 20px', fontWeight: 300 }}>
          Coordinators order from active restaurants. Toggle to show or hide.
        </p>

        {/* Tier limit indicator */}
        <div style={{ background: '#fff', border: `1.5px solid ${atLimit && isFree ? '#C17F47' : '#DDE8E0'}`, borderRadius: 14, padding: '14px 16px', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: atLimit && isFree ? 12 : 0 }}>
            <div>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#1E2620' }}>
                {activeCount} / {limit === 999 ? '∞' : limit} restaurants active
              </span>
              <span style={{ fontSize: 12, color: '#6B7066', fontWeight: 300, marginLeft: 8 }}>
                · {TIER_LABELS[userTier]} plan
              </span>
            </div>
            {/* Progress bar */}
            <div style={{ width: 80, height: 6, background: '#EAF2ED', borderRadius: 3, overflow: 'hidden', marginLeft: 12, flexShrink: 0 }}>
              <div style={{
                height: '100%',
                background: atLimit ? '#C17F47' : '#3D6B4F',
                borderRadius: 3,
                width: limit === 999 ? '20%' : `${Math.min((activeCount / limit) * 100, 100)}%`,
                transition: 'width 0.3s',
              }} />
            </div>
          </div>
          {atLimit && isFree && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ fontSize: 12, color: '#C17F47', margin: 0, fontWeight: 500 }}>
                You've reached your {limit}-restaurant limit on the {TIER_LABELS[userTier]} plan.
              </p>
              <button onClick={() => router.push('/settings')}
                style={{ background: '#C17F47', color: '#fff', border: 'none', borderRadius: 20, padding: '5px 14px', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", whiteSpace: 'nowrap', marginLeft: 12 }}>
                Upgrade →
              </button>
            </div>
          )}
        </div>

        {/* Restaurant list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
          {restaurants.map(r => {
            const canActivate = r.is_active || !atLimit
            return (
              <div key={r.id} style={{
                background: '#fff',
                border: `1.5px solid ${r.is_active ? '#3D6B4F' : '#DDE8E0'}`,
                borderRadius: 14, padding: '14px 16px',
                display: 'flex', alignItems: 'center', gap: 14,
                opacity: !r.is_active && atLimit ? 0.5 : 1,
                transition: 'all 0.15s',
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "'Lora', serif", fontSize: 15, fontWeight: 600, color: '#1E2620' }}>{r.name}</div>
                  <div style={{ fontSize: 12, color: '#6B7066', fontWeight: 300, marginTop: 2 }}>
                    {r.cuisine}
                    {r.doordash_store_id && <span style={{ color: '#6B9E7E', marginLeft: 6 }}>· DoorDash ✓</span>}
                  </div>
                </div>
                {/* Toggle */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {r.is_active && (
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#3D6B4F' }}>Active</span>
                  )}
                  {!r.is_active && atLimit && (
                    <span style={{ fontSize: 11, color: '#C17F47', fontWeight: 500 }}>Limit reached</span>
                  )}
                  <button
                    onClick={() => canActivate && toggleActive(r.id, r.is_active)}
                    disabled={!canActivate}
                    style={{
                      width: 48, height: 26, borderRadius: 13, border: 'none',
                      background: r.is_active ? '#3D6B4F' : '#DDE8E0',
                      cursor: canActivate ? 'pointer' : 'not-allowed',
                      position: 'relative', flexShrink: 0, transition: 'background 0.2s',
                    }}>
                    <div style={{
                      width: 20, height: 20, borderRadius: '50%', background: '#fff',
                      position: 'absolute', top: 3,
                      left: r.is_active ? 25 : 3,
                      transition: 'left 0.2s',
                    }} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Request a restaurant */}
        {reqMsg && !showReq && (
          <div style={{ background: '#EAF2ED', border: '1.5px solid #3D6B4F', borderRadius: 14, padding: '14px 18px', marginBottom: 16 }}>
            <p style={{ fontSize: 13, color: '#2D5240', margin: 0 }}>✓ {reqMsg}</p>
          </div>
        )}

        <div style={{ border: '2px dashed #DDE8E0', borderRadius: 16, padding: showReq ? '20px' : '16px 20px' }}>
          {!showReq ? (
            <button onClick={() => setShowReq(true)}
              style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, fontFamily: "'DM Sans', sans-serif", padding: 0 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: '#EAF2ED', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>🍽</div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1E2620' }}>Don't see your restaurant?</div>
                <div style={{ fontSize: 12, color: '#6B7066', fontWeight: 300, marginTop: 2 }}>Request it — we'll add it within 24 hours.</div>
              </div>
              <span style={{ color: '#3D6B4F', fontSize: 18, marginLeft: 'auto' }}>+</span>
            </button>
          ) : (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#1E2620', margin: '0 0 2px' }}>Request a restaurant</p>
                  <p style={{ fontSize: 12, color: '#6B7066', margin: 0, fontWeight: 300 }}>We'll add it within 24 hours.</p>
                </div>
                <button onClick={() => setShowReq(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#6B7066' }}>✕</button>
              </div>
              <label style={lbl}>Restaurant name *</label>
              <input value={reqName} onChange={e => setReqName(e.target.value)} placeholder="e.g. Chick-fil-A" style={inp} />
              <label style={lbl}>Street address or ZIP *</label>
              <input value={reqStreet} onChange={e => setReqStreet(e.target.value)} placeholder="e.g. 1001 McKinney St or 77002" style={inp} />
              <label style={lbl}>City *</label>
              <input value={reqCity} onChange={e => setReqCity(e.target.value)} placeholder="e.g. Houston, TX" style={inp} />
              <label style={lbl}>Notes (optional)</label>
              <textarea value={reqNotes} onChange={e => setReqNotes(e.target.value)} placeholder="Any additional details" style={{ ...inp, minHeight: 72, resize: 'none' as const }} />
              {reqMsg && <p style={{ fontSize: 12, color: '#B94040', margin: '0 0 12px' }}>{reqMsg}</p>}
              <button onClick={handleRequest} disabled={!reqName.trim() || !reqCity.trim() || !reqStreet.trim() || reqSending}
                style={{ width: '100%', padding: '13px', borderRadius: 10, border: 'none', background: !reqName || !reqCity || !reqStreet ? '#DDE8E0' : '#3D6B4F', color: !reqName || !reqCity || !reqStreet ? '#6B7066' : '#fff', fontSize: 14, fontWeight: 500, cursor: !reqName || !reqCity || !reqStreet ? 'default' : 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                {reqSending ? 'Sending…' : 'Send Request →'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: '#6B7066', letterSpacing: 1.5, textTransform: 'uppercase', display: 'block', marginBottom: 8 }
const inp: React.CSSProperties = { width: '100%', padding: '12px 14px', borderRadius: 10, border: '1.5px solid #DDE8E0', fontSize: 14, background: '#fff', outline: 'none', boxSizing: 'border-box', marginBottom: 16, fontFamily: "'DM Sans', sans-serif", color: '#1E2620' }

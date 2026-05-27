'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const S = {
  sage: '#3D6B4F', sageMid: '#6B9E7E', sageLight: '#EAF2ED',
  cream: '#FAFAF5', forest: '#1E2620', stone: '#6B7066',
  border: '#DDE8E0', white: '#FFFFFF', amber: '#C17F47', red: '#B94040',
}

const MEAL_COLORS: Record<string, { color: string; bg: string; label: string; emoji: string }> = {
  breakfast: { color: '#E8834A', bg: '#FFF0E8', label: 'Breakfast', emoji: '🌅' },
  lunch:     { color: '#4A8FA8', bg: '#E8F4F8', label: 'Lunch',     emoji: '☀️' },
  dinner:    { color: '#3D6B4F', bg: '#EAF2ED', label: 'Dinner',    emoji: '🌙' },
}

const TIER_META: Record<string, { badge: string; price: string; color: string; bg: string; star?: boolean }> = {
  free:     { badge: 'Free',            price: '$0 / always',     color: '#3D6B4F', bg: '#EAF2ED' },
  trial:    { badge: 'Free Trial',      price: '14-day Care+',    color: '#4A8FA8', bg: '#DFF0F6' },
  care:     { badge: 'Care+',           price: '$9.99 / mo',      color: '#3D6B4F', bg: '#EAF2ED' },
  annual:   { badge: 'Early Adopter',   price: '$59 / yr',        color: '#6B9E7E', bg: '#EAF2ED' },
  founding: { badge: 'Founding Member', price: '$149 lifetime',   color: '#C17F47', bg: '#FBF0E4', star: true },
}

type CalDate  = { id: string; date: string; meal_type: string; status: string }
type Proposal = { id: string; coordinator_name: string; restaurant_name: string; meal_name: string; delivery_date: string; meal_type: string }
type Kitchen  = { id: string; name: string; slug: string }
type ActiveOrder = { id: string; meal_name: string; restaurant_name: string; doordash_tracking_url: string | null }

function InlineFooter({ onSignOut }: { onSignOut: () => void }) {
  return (
    <footer style={{ background: S.forest, padding: '40px 28px 52px', fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        {/* Sign out row */}
        <div style={{ borderBottom: `0.5px solid rgba(255,255,255,0.1)`, paddingBottom: 20, marginBottom: 24 }}>
          <button
            onClick={onSignOut}
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 9, padding: '10px 20px', fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}
          >
            Sign out
          </button>
        </div>
        {/* Logo + tagline */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 9, fontWeight: 500, letterSpacing: 5, color: S.sageMid, textTransform: 'uppercase', marginBottom: 2 }}>Your</div>
          <div style={{ fontFamily: "'Lora', serif", fontSize: 24, fontWeight: 500, color: S.white, letterSpacing: -0.5, marginBottom: 8 }}>Kitchen</div>
          <p style={{ fontFamily: "'Lora', serif", fontStyle: 'italic', fontSize: 13, color: S.sageMid, margin: '0 0 20px' }}>"Your kitchen, covered."</p>
          <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '5px 0', fontSize: 11, marginBottom: 16 }}>
            {[
              { label: 'yourkitchen.app', href: 'https://yourkitchen.app' },
              { label: 'marques@yourkitchen.app', href: 'mailto:marques@yourkitchen.app' },
              { label: 'FAQ', href: '/faq' },
              { label: 'Terms', href: '/terms' },
              { label: 'Privacy', href: '/privacy' },
            ].map((link, i) => (
              <span key={link.label}>
                {i > 0 && <span style={{ color: 'rgba(255,255,255,0.2)', margin: '0 8px' }}>·</span>}
                <a href={link.href} style={{ color: 'rgba(255,255,255,0.3)', textDecoration: 'none' }}>{link.label}</a>
              </span>
            ))}
          </div>
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.18)', margin: 0 }}>
            © 2026 YourKitchen LLC · Built with love for Danielle · All rights reserved
          </p>
        </div>
      </div>
    </footer>
  )
}

export default function DashboardPage() {
  const router   = useRouter()
  const supabase = createClient()

  const [loading,   setLoading]   = useState(true)
  const [fullName,  setFullName]  = useState('')
  const [userTier,  setUserTier]  = useState('free')
  const [userAddress, setUserAddress] = useState('')
  const [householdSize, setHouseholdSize] = useState('')
  const [kitchen,   setKitchen]   = useState<Kitchen | null>(null)
  const [calDates,  setCalDates]  = useState<CalDate[]>([])
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [activeOrders, setActiveOrders] = useState<ActiveOrder[]>([])
  const [copied,    setCopied]    = useState(false)
  const [kitchenUrl, setKitchenUrl] = useState('')

  const today    = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const [viewYear,  setViewYear]  = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [selectedDate,  setSelectedDate]  = useState<string | null>(null)
  const [adding,   setAdding]     = useState(false)
  const [addError, setAddError]   = useState('')

  const monthName   = new Date(viewYear, viewMonth, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const firstDay    = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const prevMonth   = () => { if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) } else setViewMonth(m => m - 1) }
  const nextMonth   = () => { if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) } else setViewMonth(m => m + 1) }

  const cells: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const loadCalDates = useCallback(async (kitchenId: string) => {
    const { data } = await supabase
      .from('calendar_dates').select('id, date, meal_type, status')
      .eq('kitchen_id', kitchenId).gte('date', todayStr).order('date', { ascending: true })
    setCalDates(data || [])
  }, [todayStr])

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      // Load profile — full name + tier + address
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, tier, street, city, state, zip, household_size')
        .eq('id', user.id).single()

      const name = profile?.full_name || ''
      setFullName(name)
      setUserTier(profile?.tier || 'free')
      if (profile?.city) setUserAddress(`${profile.street || ''}, ${profile.city}, ${profile.state} ${profile.zip}`.replace(/^, /, ''))
      if (profile?.household_size) setHouseholdSize(String(profile.household_size))

      const { data: k } = await supabase
        .from('kitchens').select('id, name, slug').eq('organizer_id', user.id).single()

      if (k) {
        setKitchen(k)
        setKitchenUrl(`${window.location.origin}/k/${k.slug}`)
        await loadCalDates(k.id)

        const { data: props } = await supabase
          .from('meal_proposals')
          .select('id, coordinator_name, restaurant_name, meal_name, delivery_date, meal_type')
          .eq('kitchen_id', k.id).eq('status', 'pending').order('delivery_date', { ascending: true })
        setProposals(props || [])

        // Active / confirmed orders for "Track Delivery" quick action
        const { data: orders } = await supabase
          .from('meal_proposals')
          .select('id, meal_name, restaurant_name, doordash_tracking_url')
          .eq('kitchen_id', k.id).eq('status', 'confirmed')
        setActiveOrders((orders || []) as ActiveOrder[])
      }
      setLoading(false)
    }
    load()
  }, [])

  const copyLink = async () => {
    if (!kitchenUrl) return
    try { await navigator.clipboard.writeText(kitchenUrl) } catch {
      const ta = document.createElement('textarea')
      ta.value = kitchenUrl; ta.style.cssText = 'position:fixed;opacity:0'
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta)
    }
    setCopied(true); setTimeout(() => setCopied(false), 2500)
  }

  const shareLink = async () => {
    if (!kitchenUrl) return
    if (navigator.share) {
      try { await navigator.share({ title: kitchen?.name, text: 'Send me a meal through YourKitchen', url: kitchenUrl }) }
      catch { /* cancelled */ }
    } else { copyLink() }
  }

  const signOut = async () => { await supabase.auth.signOut(); router.push('/login') }

  const dateMap: Record<string, CalDate[]> = {}
  calDates.forEach(d => { if (!dateMap[d.date]) dateMap[d.date] = []; dateMap[d.date].push(d) })

  const handleDateClick = (dateStr: string) => {
    if (dateStr < todayStr) return
    setSelectedDate(prev => prev === dateStr ? null : dateStr); setAddError('')
  }

  const handleAddSlot = async (mealType: string) => {
    if (!kitchen || !selectedDate) return
    setAdding(true); setAddError('')
    const res = await fetch('/api/calendar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kitchen_id: kitchen.id, date: selectedDate, meal_type: mealType }),
    })
    const data = await res.json()
    if (!res.ok) { setAddError(data.error || 'Could not add slot'); setAdding(false); return }
    await loadCalDates(kitchen.id); setAdding(false)
  }

  const handleRemoveSlot = async (dateId: string) => {
    await fetch('/api/calendar', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date_id: dateId }),
    })
    if (kitchen) await loadCalDates(kitchen.id)
  }

  // Proper initials from full name — "Danielle Moore" → "DM"
  const initials = (name: string) => {
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    return (parts[0]?.[0] || '?').toUpperCase()
  }
  const firstName  = fullName.split(' ')[0] || 'there'
  const formatDate = (s: string) => new Date(s + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  const tier = TIER_META[userTier] || TIER_META.free

  if (loading) return (
    <div style={{ minHeight: '100vh', background: S.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans', sans-serif" }}>
      <p style={{ color: S.stone, fontSize: 14 }}>Loading your Kitchen…</p>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: S.cream, fontFamily: "'DM Sans', sans-serif", display: 'flex', flexDirection: 'column' }}>
      <link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />

      {/* Nav — no sign out here */}
      <nav style={{ background: S.white, borderBottom: `0.5px solid ${S.border}`, padding: '14px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
          <span style={{ fontSize: 8, fontWeight: 500, letterSpacing: 5, color: S.sageMid, textTransform: 'uppercase' }}>Your</span>
          <span style={{ fontFamily: "'Lora', serif", fontSize: 20, fontWeight: 500, color: S.forest, letterSpacing: -0.5 }}>Kitchen</span>
        </div>
        {/* Tier badge in nav */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {tier.star && <span style={{ fontSize: 14, color: tier.color }}>★</span>}
          <span style={{ background: tier.bg, color: tier.color, fontSize: 10, fontWeight: 700, padding: '4px 12px', borderRadius: 20, letterSpacing: '0.04em' }}>
            {tier.badge}
          </span>
        </div>
      </nav>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '28px 24px 48px', flex: 1, width: '100%' }}>

        {/* Greeting */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <p style={{ fontSize: 13, color: S.stone, fontWeight: 300, margin: '0 0 3px' }}>Welcome back,</p>
            <h1 style={{ fontFamily: "'Lora', serif", fontSize: 28, fontWeight: 500, color: S.forest, margin: 0, letterSpacing: -0.5 }}>{firstName} 👋</h1>
          </div>
          {/* Proper initials — DM not D */}
          <div style={{ width: 44, height: 44, borderRadius: 13, background: S.sage, display: 'flex', alignItems: 'center', justifyContent: 'center', color: S.white, fontWeight: 700, fontSize: 14 }}>
            {initials(fullName)}
          </div>
        </div>

        {/* No kitchen state */}
        {!kitchen && (
          <div style={{ background: S.forest, borderRadius: 20, padding: '32px', textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 14 }}>🥗</div>
            <h2 style={{ fontFamily: "'Lora', serif", fontSize: 22, fontWeight: 500, color: S.white, margin: '0 0 10px' }}>Set up your Kitchen</h2>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.65)', fontWeight: 300, lineHeight: 1.7, margin: '0 0 22px' }}>
              Add restaurants, set your calendar, and share your link.
            </p>
            <button onClick={() => router.push('/kitchen/setup')}
              style={{ background: S.sage, color: S.white, border: 'none', borderRadius: 12, padding: '13px 28px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
              Set Up My Kitchen →
            </button>
          </div>
        )}

        {kitchen && (<>

          {/* Pending proposals */}
          {proposals.map(p => (
            <div key={p.id} style={{ background: S.forest, borderRadius: 18, padding: '18px 20px', marginBottom: 16 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: S.amber, borderRadius: 20, padding: '3px 10px', fontSize: 9, fontWeight: 700, color: S.white, letterSpacing: '0.06em', marginBottom: 10 }}>
                ACTION NEEDED
              </div>
              <div style={{ fontFamily: "'Lora', serif", fontSize: 17, color: S.white, fontWeight: 500, margin: '0 0 4px' }}>
                {p.coordinator_name} wants to send you dinner
              </div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 14, fontWeight: 300 }}>
                {MEAL_COLORS[p.meal_type]?.emoji} {p.meal_name} · {p.restaurant_name}
              </div>
              <button onClick={() => router.push(`/proposals/${p.id}`)}
                style={{ width: '100%', background: S.sage, color: S.white, border: 'none', borderRadius: 11, padding: '12px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                Review Proposal →
              </button>
            </div>
          ))}

          {/* Share link */}
          <div style={{ background: S.white, border: `0.5px dashed ${S.sageMid}`, borderRadius: 16, padding: '16px 20px', marginBottom: 20 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: S.stone, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 6px' }}>Your Kitchen Link</p>
            <div style={{ fontFamily: 'monospace', fontSize: 13, color: S.sage, marginBottom: 12, wordBreak: 'break-all' }}>
              {kitchenUrl || 'Loading…'}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={copyLink} style={{ flex: 1, padding: '10px', background: copied ? S.sage : S.forest, color: S.white, border: 'none', borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", transition: 'background 0.2s' }}>
                {copied ? '✓ Copied!' : 'Copy Link'}
              </button>
              <button onClick={shareLink} style={{ padding: '10px 16px', background: S.sageLight, color: S.sage, border: 'none', borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                Share
              </button>
            </div>
          </div>

          {/* Calendar */}
          <div style={{ background: S.white, border: `0.5px solid ${S.border}`, borderRadius: 16, padding: '18px', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <p style={{ fontFamily: "'Lora', serif", fontSize: 16, fontWeight: 500, color: S.forest, margin: 0 }}>My Calendar</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button onClick={prevMonth} style={{ background: S.sageLight, border: 'none', borderRadius: 7, width: 30, height: 30, cursor: 'pointer', fontSize: 15, color: S.sage, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
                <span style={{ fontSize: 13, fontWeight: 500, color: S.forest, minWidth: 116, textAlign: 'center' }}>{monthName}</span>
                <button onClick={nextMonth} style={{ background: S.sageLight, border: 'none', borderRadius: 7, width: 30, height: 30, cursor: 'pointer', fontSize: 15, color: S.sage, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 4 }}>
              {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: S.stone, padding: '2px 0' }}>{d}</div>)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
              {cells.map((day, i) => {
                if (!day) return <div key={i} />
                const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
                const isPast = dateStr < todayStr
                const isToday = dateStr === todayStr
                const isSel = selectedDate === dateStr
                const slots = dateMap[dateStr] || []
                return (
                  <button key={i} onClick={() => handleDateClick(dateStr)} disabled={isPast}
                    style={{ background: isSel ? S.sageLight : slots.length ? '#F8FAF8' : S.white, border: `${isSel || isToday ? 2 : 1}px solid ${isSel ? S.sage : isToday ? S.sageMid : slots.length ? '#C8DDD0' : S.border}`, borderRadius: 9, padding: '8px 2px', minHeight: 54, cursor: isPast ? 'default' : 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, fontFamily: "'DM Sans',sans-serif", opacity: isPast ? 0.35 : 1, transition: 'all 0.1s' }}>
                    <span style={{ fontSize: 13, fontWeight: isToday ? 700 : 500, color: isSel ? S.sage : S.forest, lineHeight: 1 }}>{day}</span>
                    {slots.length
                      ? <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>{slots.map((s,si) => <div key={si} style={{ width: 6, height: 6, borderRadius: '50%', background: MEAL_COLORS[s.meal_type]?.color || S.sage }} />)}</div>
                      : !isPast ? <div style={{ fontSize: 14, color: '#DDE8E0' }}>+</div> : null}
                  </button>
                )
              })}
            </div>
            {/* Legend */}
            <div style={{ display: 'flex', gap: 14, marginTop: 12, paddingTop: 12, borderTop: `0.5px solid ${S.border}`, flexWrap: 'wrap' }}>
              {Object.entries(MEAL_COLORS).map(([k,v]) => (
                <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: v.color }} />
                  <span style={{ fontSize: 10, color: S.stone, fontWeight: 500 }}>{v.emoji} {v.label}</span>
                </div>
              ))}
            </div>
            {/* Tier strip */}
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: `0.5px solid ${S.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {tier.star && <span style={{ fontSize: 13, color: tier.color }}>★</span>}
                <span style={{ background: tier.bg, color: tier.color, fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20, letterSpacing: '0.04em' }}>{tier.badge}</span>
                <span style={{ fontSize: 11, color: S.stone, fontWeight: 300 }}>{tier.price}</span>
              </div>
              <button onClick={() => router.push('/settings')}
                style={{ background: 'none', border: 'none', fontSize: 11, color: tier.color, cursor: 'pointer', fontWeight: 600, fontFamily: "'DM Sans', sans-serif", padding: '4px 8px' }}>
                {userTier === 'free' || userTier === 'trial' ? 'Upgrade ›' : 'Manage ›'}
              </button>
            </div>
          </div>

          {/* Add-date panel */}
          {selectedDate && (
            <div style={{ background: S.white, border: `2px solid ${S.sage}`, borderRadius: 16, padding: '18px 20px', marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div>
                  <p style={{ fontSize: 10, fontWeight: 700, color: S.sage, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 2px' }}>Selected date</p>
                  <p style={{ fontFamily: "'Lora',serif", fontSize: 16, fontWeight: 500, color: S.forest, margin: 0 }}>{formatDate(selectedDate)}</p>
                </div>
                <button onClick={() => setSelectedDate(null)} style={{ background: 'none', border: 'none', fontSize: 18, color: S.stone, cursor: 'pointer', padding: 4 }}>✕</button>
              </div>
              {(dateMap[selectedDate] || []).length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <p style={{ fontSize: 10, fontWeight: 600, color: S.stone, letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 8px' }}>Open slots</p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {(dateMap[selectedDate] || []).map(slot => {
                      const mc = MEAL_COLORS[slot.meal_type] || MEAL_COLORS.dinner
                      return (
                        <div key={slot.id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: mc.bg, border: `1px solid ${mc.color}`, borderRadius: 20, padding: '5px 12px 5px 10px' }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: mc.color }}>{mc.emoji} {mc.label}</span>
                          {slot.status === 'available' && <button onClick={() => handleRemoveSlot(slot.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: mc.color, fontSize: 13, padding: 0, lineHeight: 1, marginLeft: 2 }}>✕</button>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              <p style={{ fontSize: 10, fontWeight: 600, color: S.stone, letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 10px' }}>
                {(dateMap[selectedDate] || []).length > 0 ? 'Add another slot' : 'Add a meal slot'}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {Object.entries(MEAL_COLORS).map(([type, mc]) => {
                  const has = (dateMap[selectedDate] || []).some(s => s.meal_type === type)
                  return (
                    <button key={type} onClick={() => !has && !adding && handleAddSlot(type)} disabled={has || adding}
                      style={{ background: has ? '#F5F5F5' : mc.bg, border: `1.5px solid ${has ? '#DDD' : mc.color}`, borderRadius: 10, padding: '12px 8px', cursor: has || adding ? 'default' : 'pointer', opacity: has ? 0.5 : 1, fontFamily: "'DM Sans',sans-serif" }}>
                      <div style={{ fontSize: 18, marginBottom: 4 }}>{mc.emoji}</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: has ? S.stone : mc.color }}>{has ? '✓ Added' : mc.label}</div>
                    </button>
                  )
                })}
              </div>
              {addError && <p style={{ fontSize: 12, color: S.red, margin: '10px 0 0' }}>{addError}</p>}
              {adding && <p style={{ fontSize: 12, color: S.stone, margin: '10px 0 0', fontWeight: 300 }}>Adding…</p>}
            </div>
          )}

          {/* Quick Actions */}
          <p style={{ fontFamily: "'Lora',serif", fontSize: 17, fontWeight: 500, color: S.forest, margin: '4px 0 12px' }}>Quick Actions</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              {
                icon: '🏪', label: 'My Restaurants',
                action: () => router.push('/kitchen/restaurants'),
                badge: null,
              },
              {
                icon: '📋', label: 'Order History',
                action: () => router.push('/kitchen/orders'),
                badge: null,
              },
              {
                icon: '⚙️', label: 'Settings',
                action: () => router.push('/settings'),
                badge: null,
              },
              {
                icon: activeOrders.length > 0 ? '🚗' : '🔔',
                label: activeOrders.length > 0 ? 'Track Delivery' : 'Pending Orders',
                action: () => {
                  if (activeOrders.length === 1 && activeOrders[0].doordash_tracking_url) {
                    window.open(activeOrders[0].doordash_tracking_url, '_blank')
                  } else if (proposals.length === 1) {
                    router.push(`/proposals/${proposals[0].id}`)
                  } else {
                    router.push('/kitchen/orders')
                  }
                },
                badge: proposals.length > 0 ? proposals.length : null,
              },
            ].map(a => (
              <button key={a.label} onClick={a.action}
                style={{ background: S.white, border: `0.5px solid ${S.border}`, borderRadius: 14, padding: '16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", textAlign: 'left', position: 'relative' }}>
                <span style={{ fontSize: 22 }}>{a.icon}</span>
                <span style={{ fontSize: 13, fontWeight: 500, color: S.forest }}>{a.label}</span>
                {a.badge !== null && a.badge > 0 && (
                  <span style={{ position: 'absolute', top: 10, right: 12, background: S.amber, color: S.white, borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>{a.badge}</span>
                )}
              </button>
            ))}
          </div>

          {/* Account summary strip */}
          <div style={{ background: S.white, border: `0.5px solid ${S.border}`, borderRadius: 14, padding: '16px 18px', marginTop: 16 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: S.stone, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 12px' }}>Account</p>
            {[
              { icon: '👤', label: 'Name', val: fullName || '—' },
              { icon: '📍', label: 'Address', val: userAddress || '—' },
              { icon: '🏠', label: 'Household', val: householdSize ? `${householdSize} people` : '—' },
              { icon: '✦',  label: 'Plan', val: `${tier.badge} · ${tier.price}` },
            ].map(r => (
              <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: `0.5px solid ${S.sageLight}` }}>
                <span style={{ fontSize: 16, width: 22, textAlign: 'center', flexShrink: 0 }}>{r.icon}</span>
                <span style={{ fontSize: 12, color: S.stone, fontWeight: 300, width: 70, flexShrink: 0 }}>{r.label}</span>
                <span style={{ fontSize: 13, color: S.forest, fontWeight: 500, flex: 1 }}>{r.val}</span>
              </div>
            ))}
          </div>

        </>)}
      </div>

      {/* Footer with sign out at the bottom */}
      <InlineFooter onSignOut={signOut} />
    </div>
  )
}

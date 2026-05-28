'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// ── Brand ─────────────────────────────────────────────────────────────────────
const S = {
  sage: '#3D6B4F', sageMid: '#6B9E7E', sageLight: '#EAF2ED',
  cream: '#FAFAF5', forest: '#1E2620', stone: '#6B7066',
  border: '#DDE8E0', white: '#FFFFFF', amber: '#C17F47',
  amberLight: '#FBF0E4', red: '#B94040',
}
const MEAL_COLORS: Record<string, { color: string; bg: string; label: string; emoji: string }> = {
  breakfast: { color: '#E8834A', bg: '#FFF0E8', label: 'Breakfast', emoji: '🌅' },
  lunch:     { color: '#4A8FA8', bg: '#E8F4F8', label: 'Lunch',     emoji: '☀️' },
  dinner:    { color: '#3D6B4F', bg: '#EAF2ED', label: 'Dinner',    emoji: '🌙' },
}
const TIER_META: Record<string, { badge: string; price: string; color: string; bg: string; star?: boolean; desc: string }> = {
  free:     { badge: 'Free',            price: '$0 / always',   color: '#3D6B4F', bg: '#EAF2ED', desc: 'Basic access — upgrade anytime.' },
  trial:    { badge: 'Free Trial',      price: '14-day Care+',  color: '#4A8FA8', bg: '#DFF0F6', desc: 'Full Care+ features — trial active.' },
  care:     { badge: 'Care+',           price: '$9.99 / mo',    color: '#3D6B4F', bg: '#EAF2ED', desc: 'Full SMS notifications and expanded calendar.' },
  annual:   { badge: 'Early Adopter',   price: '$59 / yr',      color: '#6B9E7E', bg: '#EAF2ED', desc: 'Annual rate locked in forever.' },
  founding: { badge: 'Founding Member', price: '$149 lifetime', color: '#C17F47', bg: '#FBF0E4', star: true, desc: 'Lifetime access — thank you for founding YourKitchen.' },
}
const TIER_LIMITS: Record<string, number> = { free: 3, trial: 10, care: 10, annual: 10, founding: 999 }
const MINS_PER_MEAL = 95 // 30 prep + 45 cook + 20 clean

// ── Types ──────────────────────────────────────────────────────────────────────
type Tab = 'home' | 'activity' | 'insights' | 'share' | 'village'
type CalDate = { id: string; date: string; meal_type: string; status: string }
type Kitchen = { id: string; name: string; slug: string; address: string | null; household_size: number | null }
type Proposal = {
  id: string; status: string; coordinator_name: string; restaurant_name: string
  meal_name: string; delivery_date: string; meal_type: string; coordinator_note: string | null
  doordash_tracking_url: string | null; doordash_delivery_id: string | null
  doordash_status: string | null; proposed_at: string
}
type VillagePost = { id: string; content: string; posted_at: string }

// ── Bottom Nav ────────────────────────────────────────────────────────────────
function BottomNav({ active, set, badge }: { active: Tab; set: (t: Tab) => void; badge: number }) {
  const tabs: { key: Tab; icon: string; label: string }[] = [
    { key: 'home',     icon: '🏠', label: 'Home' },
    { key: 'activity', icon: '📋', label: 'Activity' },
    { key: 'insights', icon: '📊', label: 'Insights' },
    { key: 'share',    icon: '🔗', label: 'Share' },
    { key: 'village',  icon: '💬', label: 'Village' },
  ]
  return (
    <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: S.white, borderTop: `0.5px solid ${S.border}`, display: 'flex', zIndex: 200, paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      {tabs.map(t => {
        const isActive = active === t.key
        const showBadge = t.key === 'activity' && badge > 0
        return (
          <button key={t.key} onClick={() => set(t.key)}
            style={{ flex: 1, border: 'none', background: 'none', cursor: 'pointer', padding: '10px 0 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, position: 'relative', fontFamily: "'DM Sans', sans-serif" }}>
            {showBadge && (
              <div style={{ position: 'absolute', top: 6, right: '50%', transform: 'translateX(12px)', background: S.amber, color: S.white, borderRadius: '50%', width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700 }}>
                {badge > 9 ? '9+' : badge}
              </div>
            )}
            <div style={{ width: 36, height: 28, borderRadius: 14, background: isActive ? S.sageLight : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}>
              <span style={{ fontSize: 17 }}>{t.icon}</span>
            </div>
            <span style={{ fontSize: 10, fontWeight: isActive ? 700 : 400, color: isActive ? S.sage : S.stone, letterSpacing: '0.02em' }}>{t.label}</span>
          </button>
        )
      })}
    </div>
  )
}

// ── Hamburger Drawer ──────────────────────────────────────────────────────────
function Drawer({ name, tier, onClose, onSignOut, router }: { name: string; tier: any; onClose: () => void; onSignOut: () => void; router: any }) {
  const initial = (name || '?').charAt(0).toUpperCase()
  const items = [
    { icon: '🏪', label: 'My Restaurants',  path: '/kitchen/restaurants' },
    { icon: '📋', label: 'Order History',    path: '/kitchen/orders' },
    { icon: '⚙️', label: 'Settings',          path: '/settings' },
    { icon: '⏰', label: 'Delivery Windows', path: '/settings' },
    { icon: '👥', label: 'Refer a Friend',   path: null },
    { icon: '💬', label: 'Community',         path: null },
    { icon: '❓', label: 'About & Help',      path: null },
  ]
  return (
    <>
      {/* Overlay */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(30,38,32,0.5)', zIndex: 300 }} />
      {/* Drawer panel */}
      <div style={{ position: 'fixed', top: 0, left: 0, bottom: 0, width: 280, background: S.white, zIndex: 301, display: 'flex', flexDirection: 'column', boxShadow: '4px 0 24px rgba(30,38,32,0.15)', animation: 'slideIn 0.22s ease' }}>
        <style>{`@keyframes slideIn{from{transform:translateX(-100%)}to{transform:translateX(0)}}`}</style>

        {/* Header */}
        <div style={{ background: S.forest, padding: '52px 24px 24px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: S.sage, display: 'flex', alignItems: 'center', justifyContent: 'center', color: S.white, fontFamily: "'Lora', serif", fontSize: 20, fontWeight: 600, flexShrink: 0 }}>
            {initial}
          </div>
          <div>
            <div style={{ fontFamily: "'Lora', serif", fontSize: 16, fontWeight: 500, color: S.white, marginBottom: 4 }}>{name || 'My Kitchen'}</div>
            <span style={{ background: tier.bg, color: tier.color, fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>{tier.badge}</span>
          </div>
        </div>

        {/* Menu items */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {items.map(item => (
            <button key={item.label} onClick={() => { onClose(); if (item.path) router.push(item.path) }}
              style={{ width: '100%', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 14, background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", borderBottom: `0.5px solid ${S.border}` }}>
              <span style={{ fontSize: 18, width: 24 }}>{item.icon}</span>
              <span style={{ fontSize: 14, fontWeight: 400, color: S.forest }}>{item.label}</span>
            </button>
          ))}
        </div>

        {/* Sign out */}
        <div style={{ borderTop: `0.5px solid ${S.border}` }}>
          <button onClick={() => { onClose(); onSignOut() }}
            style={{ width: '100%', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 14, background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
            <span style={{ fontSize: 18, width: 24 }}>🔓</span>
            <span style={{ fontSize: 14, color: S.red }}>Sign Out</span>
          </button>
          <div style={{ padding: '12px 24px 28px', display: 'flex', gap: 0, flexWrap: 'wrap' }}>
            {[
              { label: 'yourkitchen.app', href: 'https://yourkitchen.app' },
              { label: 'FAQ',     href: 'https://yourkitchen.app/#faq' },
              { label: 'Privacy', href: 'https://yourkitchen.app/privacy' },
              { label: 'Terms',   href: 'https://yourkitchen.app/terms' },
            ].map((l, i) => (
              <span key={l.label}>
                {i > 0 && <span style={{ color: S.stone, margin: '0 5px', fontSize: 10 }}>·</span>}
                <a href={l.href} style={{ fontSize: 11, color: S.stone, textDecoration: 'none' }}>{l.label}</a>
              </span>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

// ── Notification Panel ─────────────────────────────────────────────────────────
function NotifPanel({ proposals, onClose, router }: { proposals: Proposal[]; onClose: () => void; router: any }) {
  const groups = [
    { key: 'pending',   label: 'Awaiting reply',  items: proposals.filter(p => p.status === 'pending'),   color: S.amber },
    { key: 'confirmed', label: 'On the way',       items: proposals.filter(p => p.status === 'confirmed'), color: S.sage },
    { key: 'declined',  label: 'Declined',         items: proposals.filter(p => p.status === 'declined'),  color: S.stone },
  ].filter(g => g.items.length > 0)

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 150 }} />
      <div style={{ position: 'fixed', top: 58, right: 16, width: 300, background: S.white, borderRadius: 16, boxShadow: '0 8px 32px rgba(30,38,32,0.15)', border: `0.5px solid ${S.border}`, zIndex: 151, overflow: 'hidden', maxHeight: '70vh', overflowY: 'auto' }}>
        <div style={{ padding: '14px 16px', borderBottom: `0.5px solid ${S.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: "'Lora', serif", fontSize: 15, fontWeight: 500, color: S.forest }}>Notifications</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: S.stone, fontSize: 16 }}>✕</button>
        </div>
        {groups.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: S.stone, fontWeight: 300, margin: 0 }}>You're all caught up 🧡</p>
          </div>
        ) : groups.map(g => (
          <div key={g.key}>
            <div style={{ padding: '10px 16px 6px', background: '#FAFAFA' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: g.color, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{g.label} · {g.items.length}</span>
            </div>
            {g.items.slice(0, 3).map(p => (
              <button key={p.id} onClick={() => { onClose(); if (p.status === 'pending') router.push(`/proposals/${p.id}`) }}
                style={{ width: '100%', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', borderBottom: `0.5px solid ${S.border}`, cursor: p.status === 'pending' ? 'pointer' : 'default', fontFamily: "'DM Sans', sans-serif", textAlign: 'left' }}>
                <span style={{ fontSize: 18 }}>{MEAL_COLORS[p.meal_type]?.emoji || '🍽'}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: S.forest }}>{p.meal_name}</div>
                  <div style={{ fontSize: 11, color: S.stone, fontWeight: 300 }}>{p.coordinator_name} · {p.restaurant_name}</div>
                </div>
                {p.status === 'pending' && <span style={{ fontSize: 12, color: g.color }}>›</span>}
              </button>
            ))}
          </div>
        ))}
      </div>
    </>
  )
}

// ── HOME TAB ──────────────────────────────────────────────────────────────────
function HomeTab({
  kitchen, calDates, selectedDate, setSelectedDate,
  adding, addError, handleAddSlot, handleRemoveSlot,
  tier, router, userTier
}: any) {
  const today     = new Date()
  const todayStr  = today.toISOString().split('T')[0]
  const [viewYear,  setViewYear]  = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())

  const monthName   = new Date(viewYear, viewMonth, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const firstDay    = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const prevMonth   = () => { if (viewMonth === 0) { setViewYear((y:number) => y-1); setViewMonth(11) } else setViewMonth((m:number) => m-1) }
  const nextMonth   = () => { if (viewMonth === 11) { setViewYear((y:number) => y+1); setViewMonth(0) } else setViewMonth((m:number) => m+1) }

  const cells: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const dateMap: Record<string, CalDate[]> = {}
  calDates.forEach((d: CalDate) => { if (!dateMap[d.date]) dateMap[d.date] = []; dateMap[d.date].push(d) })

  const formatDate = (s: string) => new Date(s + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div style={{ padding: '16px 20px 16px' }}>
      {/* Calendar hero */}
      <div style={{ background: S.white, border: `0.5px solid ${S.border}`, borderRadius: 18, padding: '16px', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <p style={{ fontFamily: "'Lora', serif", fontSize: 15, fontWeight: 500, color: S.forest, margin: 0 }}>My Calendar</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button onClick={prevMonth} style={{ background: S.sageLight, border: 'none', borderRadius: 7, width: 28, height: 28, cursor: 'pointer', fontSize: 14, color: S.sage, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
            <span style={{ fontSize: 12, fontWeight: 500, color: S.forest, minWidth: 108, textAlign: 'center' }}>{monthName}</span>
            <button onClick={nextMonth} style={{ background: S.sageLight, border: 'none', borderRadius: 7, width: 28, height: 28, cursor: 'pointer', fontSize: 14, color: S.sage, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 3 }}>
          {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
            <div key={d} style={{ textAlign: 'center', fontSize: 9, fontWeight: 700, color: S.stone, padding: '2px 0' }}>{d}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
          {cells.map((day, i) => {
            if (!day) return <div key={i} />
            const dateStr = `${viewYear}-${String(viewMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
            const isPast  = dateStr < todayStr
            const isToday = dateStr === todayStr
            const isSel   = selectedDate === dateStr
            const slots   = dateMap[dateStr] || []
            return (
              <button key={i} onClick={() => { if (!isPast) setSelectedDate((p: string|null) => p === dateStr ? null : dateStr) }} disabled={isPast}
                style={{ background: isSel?S.sageLight:slots.length?'#F8FAF8':S.white, border:`${isSel||isToday?2:1}px solid ${isSel?S.sage:isToday?S.sageMid:slots.length?'#C8DDD0':S.border}`, borderRadius:8, padding:'6px 2px', minHeight:50, cursor:isPast?'default':'pointer', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:2, fontFamily:"'DM Sans',sans-serif", opacity:isPast?0.35:1, transition:'all 0.1s' }}>
                <span style={{ fontSize:12, fontWeight:isToday?700:500, color:isSel?S.sage:S.forest, lineHeight:1 }}>{day}</span>
                {slots.length
                  ? <div style={{ display:'flex', gap:2, flexWrap:'wrap', justifyContent:'center' }}>
                      {slots.map((s:CalDate,si:number) => <div key={si} style={{ width:5, height:5, borderRadius:'50%', background:MEAL_COLORS[s.meal_type]?.color||S.sage }} />)}
                    </div>
                  : !isPast ? <div style={{ fontSize:13, color:'#DDE8E0' }}>+</div> : null}
              </button>
            )
          })}
        </div>
        <div style={{ display:'flex', gap:12, marginTop:10, paddingTop:10, borderTop:`0.5px solid ${S.border}`, flexWrap:'wrap' }}>
          {Object.entries(MEAL_COLORS).map(([k,v]) => (
            <div key={k} style={{ display:'flex', alignItems:'center', gap:3 }}>
              <div style={{ width:6, height:6, borderRadius:'50%', background:v.color }} />
              <span style={{ fontSize:9, color:S.stone, fontWeight:500 }}>{v.emoji} {v.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Add date panel */}
      {selectedDate && (
        <div style={{ background:S.white, border:`2px solid ${S.sage}`, borderRadius:16, padding:'16px', marginBottom:14 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <div>
              <p style={{ fontSize:9, fontWeight:700, color:S.sage, letterSpacing:'0.08em', textTransform:'uppercase', margin:'0 0 2px' }}>Selected date</p>
              <p style={{ fontFamily:"'Lora',serif", fontSize:14, fontWeight:500, color:S.forest, margin:0 }}>{formatDate(selectedDate)}</p>
            </div>
            <button onClick={() => setSelectedDate(null)} style={{ background:'none', border:'none', fontSize:16, color:S.stone, cursor:'pointer', padding:4 }}>✕</button>
          </div>
          {(dateMap[selectedDate]||[]).length > 0 && (
            <div style={{ marginBottom:12 }}>
              <p style={{ fontSize:9, fontWeight:600, color:S.stone, letterSpacing:'0.06em', textTransform:'uppercase', margin:'0 0 6px' }}>Open slots</p>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {(dateMap[selectedDate]||[]).map((slot:CalDate) => {
                  const mc = MEAL_COLORS[slot.meal_type]||MEAL_COLORS.dinner
                  return (
                    <div key={slot.id} style={{ display:'flex', alignItems:'center', gap:5, background:mc.bg, border:`1px solid ${mc.color}`, borderRadius:20, padding:'4px 10px 4px 9px' }}>
                      <span style={{ fontSize:11, fontWeight:600, color:mc.color }}>{mc.emoji} {mc.label}</span>
                      {slot.status === 'available' && <button onClick={() => handleRemoveSlot(slot.id)} style={{ background:'none', border:'none', cursor:'pointer', color:mc.color, fontSize:12, padding:0, lineHeight:1, marginLeft:2 }}>✕</button>}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          <p style={{ fontSize:9, fontWeight:600, color:S.stone, letterSpacing:'0.06em', textTransform:'uppercase', margin:'0 0 8px' }}>
            {(dateMap[selectedDate]||[]).length > 0 ? 'Add another slot' : 'Add a meal slot'}
          </p>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6 }}>
            {Object.entries(MEAL_COLORS).map(([type,mc]) => {
              const has = (dateMap[selectedDate]||[]).some((s:CalDate) => s.meal_type === type)
              return (
                <button key={type} onClick={() => !has&&!adding&&handleAddSlot(type)} disabled={has||adding}
                  style={{ background:has?'#F5F5F5':mc.bg, border:`1.5px solid ${has?'#DDD':mc.color}`, borderRadius:9, padding:'10px 6px', cursor:has||adding?'default':'pointer', opacity:has?0.5:1, fontFamily:"'DM Sans',sans-serif" }}>
                  <div style={{ fontSize:16, marginBottom:3 }}>{mc.emoji}</div>
                  <div style={{ fontSize:11, fontWeight:600, color:has?S.stone:mc.color }}>{has?'✓ Added':mc.label}</div>
                </button>
              )
            })}
          </div>
          {addError && <p style={{ fontSize:11, color:S.red, margin:'8px 0 0' }}>{addError}</p>}
          {adding && <p style={{ fontSize:11, color:S.stone, margin:'8px 0 0', fontWeight:300 }}>Adding…</p>}
        </div>
      )}

      {/* Tier pill */}
      <button onClick={() => router.push('/settings')}
        style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', background:tier.bg, border:`1px solid ${tier.color}22`, borderRadius:14, padding:'12px 16px', cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          {tier.star && <span style={{ fontSize:14, color:tier.color }}>★</span>}
          <span style={{ fontSize:13, fontWeight:600, color:tier.color }}>{tier.badge}</span>
          <span style={{ fontSize:12, color:S.stone, fontWeight:300 }}>{tier.price}</span>
        </div>
        {(userTier === 'free' || userTier === 'trial') && (
          <span style={{ fontSize:11, fontWeight:700, color:tier.color }}>Upgrade ›</span>
        )}
      </button>
    </div>
  )
}

// ── ACTIVITY TAB ──────────────────────────────────────────────────────────────
function ActivityTab({ proposals, router }: { proposals: Proposal[]; router: any }) {
  const onTheWay = proposals.filter(p => p.status === 'confirmed' && p.doordash_status !== 'cancelled')
  const pending  = proposals.filter(p => p.status === 'pending')
  const previous = proposals.filter(p => ['delivered','declined','expired','cancelled'].includes(p.status) || (p.status === 'confirmed' && p.doordash_status === 'cancelled'))
  const fmt = (s: string) => new Date(s + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

  const handleShare = async (p: Proposal, platform: 'instagram' | 'facebook') => {
    const text = `${p.coordinator_name} showed up for my family tonight 🧡\n\n${p.meal_name} from ${p.restaurant_name}\n\nThrough YourKitchen — your kitchen, covered.\n\nyourkitchen.app`
    if (platform === 'facebook') {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent('https://yourkitchen.app')}&quote=${encodeURIComponent(text)}`, '_blank')
    } else {
      try { await navigator.clipboard.writeText(text) } catch {}
      window.open('https://www.instagram.com/', '_blank')
    }
  }

  if (proposals.length === 0) return (
    <div style={{ padding:'48px 24px', textAlign:'center' }}>
      <div style={{ fontSize:40, marginBottom:12 }}>🥗</div>
      <p style={{ fontFamily:"'Lora',serif", fontSize:17, color:S.forest, margin:'0 0 8px' }}>No orders yet</p>
      <p style={{ fontSize:13, color:S.stone, fontWeight:300, margin:0 }}>When your village sends meals, they'll appear here.</p>
    </div>
  )

  return (
    <div style={{ padding:'16px 20px' }}>
      {/* On the Way */}
      {onTheWay.length > 0 && (
        <div style={{ marginBottom:24 }}>
          <p style={sLabel}>🚗 On the Way</p>
          {onTheWay.map(p => (
            <div key={p.id} style={{ background:S.white, border:`1.5px solid ${S.sage}`, borderRadius:14, overflow:'hidden', marginBottom:10 }}>
              <div style={{ padding:'14px 16px', display:'flex', alignItems:'flex-start', gap:12 }}>
                <span style={{ fontSize:20 }}>{MEAL_COLORS[p.meal_type]?.emoji||'🍽'}</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontFamily:"'Lora',serif", fontSize:14, fontWeight:600, color:S.forest }}>{p.meal_name}</div>
                  <div style={{ fontSize:12, color:S.stone, fontWeight:300 }}>{p.restaurant_name} · {fmt(p.delivery_date)}</div>
                  <div style={{ fontSize:12, color:S.stone, fontWeight:300 }}>from <strong style={{ color:S.forest }}>{p.coordinator_name}</strong></div>
                </div>
                <span style={{ background:S.sageLight, color:S.sage, fontSize:9, fontWeight:700, padding:'3px 9px', borderRadius:20 }}>Confirmed</span>
              </div>
              <div style={{ padding:'0 16px 14px', display:'flex', flexDirection:'column', gap:8 }}>
                {p.doordash_tracking_url && (
                  <a href={p.doordash_tracking_url} target="_blank" rel="noopener noreferrer"
                    style={{ display:'block', background:S.forest, color:S.white, borderRadius:9, padding:'10px', fontSize:13, fontWeight:600, textDecoration:'none', textAlign:'center', fontFamily:"'DM Sans',sans-serif" }}>
                    🚗 Track My Delivery
                  </a>
                )}
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={() => handleShare(p, 'instagram')}
                    style={{ flex:1, padding:'9px', borderRadius:9, border:`1px solid ${S.border}`, background:'transparent', fontSize:12, fontWeight:600, color:S.stone, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>
                    📸 Instagram
                  </button>
                  <button onClick={() => handleShare(p, 'facebook')}
                    style={{ flex:1, padding:'9px', borderRadius:9, border:`1px solid ${S.border}`, background:'transparent', fontSize:12, fontWeight:600, color:S.stone, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>
                    👍 Facebook
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pending */}
      {pending.length > 0 && (
        <div style={{ marginBottom:24 }}>
          <p style={sLabel}>⏳ Awaiting Your Reply</p>
          {pending.map(p => (
            <div key={p.id} style={{ background:S.white, border:`1.5px solid ${S.amber}`, borderRadius:14, overflow:'hidden', marginBottom:10 }}>
              <div style={{ padding:'14px 16px', display:'flex', alignItems:'flex-start', gap:12 }}>
                <span style={{ fontSize:20 }}>{MEAL_COLORS[p.meal_type]?.emoji||'🍽'}</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontFamily:"'Lora',serif", fontSize:14, fontWeight:600, color:S.forest }}>{p.meal_name}</div>
                  <div style={{ fontSize:12, color:S.stone, fontWeight:300 }}>{p.restaurant_name} · {fmt(p.delivery_date)}</div>
                  {p.coordinator_note && <p style={{ fontSize:12, color:S.stone, fontStyle:'italic', margin:'5px 0 0', lineHeight:1.5 }}>"{p.coordinator_note}"</p>}
                </div>
                <span style={{ background:S.amberLight, color:S.amber, fontSize:9, fontWeight:700, padding:'3px 9px', borderRadius:20 }}>Pending</span>
              </div>
              <div style={{ padding:'0 16px 14px' }}>
                <button onClick={() => router.push(`/proposals/${p.id}`)}
                  style={{ width:'100%', background:S.forest, color:S.white, border:'none', borderRadius:9, padding:'11px', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>
                  Review Proposal →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Previous */}
      {previous.length > 0 && (
        <div>
          <p style={sLabel}>Previous Orders</p>
          {previous.map(p => (
            <div key={p.id} style={{ background:S.white, border:`0.5px solid ${S.border}`, borderRadius:12, padding:'12px 16px', display:'flex', alignItems:'center', gap:12, marginBottom:8, opacity:['declined','expired'].includes(p.status)?0.65:1 }}>
              <span style={{ fontSize:18 }}>{MEAL_COLORS[p.meal_type]?.emoji||'🍽'}</span>
              <div style={{ flex:1, overflow:'hidden' }}>
                <div style={{ fontFamily:"'Lora',serif", fontSize:13, fontWeight:600, color:S.forest, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.meal_name}</div>
                <div style={{ fontSize:11, color:S.stone, fontWeight:300 }}>{p.restaurant_name} · {fmt(p.delivery_date)}</div>
              </div>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6 }}>
                <span style={{ fontSize:9, fontWeight:700, padding:'3px 9px', borderRadius:20, background:p.status==='delivered'?S.sageLight:'#F5F5F5', color:p.status==='delivered'?S.sage:S.stone }}>
                  {p.status==='delivered'?'🧡 Delivered':p.status==='declined'?'✕ Declined':p.status.charAt(0).toUpperCase()+p.status.slice(1)}
                </span>
                {(p.status==='delivered'||p.status==='confirmed') && (
                  <button onClick={() => handleShare(p, 'instagram')}
                    style={{ fontSize:9, fontWeight:600, color:S.sage, background:'none', border:'none', cursor:'pointer', padding:0, fontFamily:"'DM Sans',sans-serif" }}>
                    Share 📸
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── INSIGHTS TAB ──────────────────────────────────────────────────────────────
function InsightsTab({ proposals, kitchenName }: { proposals: Proposal[]; kitchenName: string }) {
  const delivered = proposals.filter(p => ['confirmed','delivered'].includes(p.status))
  const totalMeals = delivered.length
  const totalMins  = totalMeals * MINS_PER_MEAL
  const totalHours = Math.round(totalMins / 60)
  const workweeks  = (totalMins / (40 * 60)).toFixed(1)

  // Village size
  const uniqueCoords = [...new Set(proposals.map(p => p.coordinator_name).filter(Boolean))]
  const villageSize  = uniqueCoords.length

  // Top coordinator
  const coordCounts: Record<string, number> = {}
  proposals.forEach(p => { if (p.coordinator_name) coordCounts[p.coordinator_name] = (coordCounts[p.coordinator_name]||0)+1 })
  const topCoord = Object.entries(coordCounts).sort((a,b)=>b[1]-a[1])[0]

  // Favorite restaurant
  const restCounts: Record<string, number> = {}
  delivered.forEach(p => { if (p.restaurant_name) restCounts[p.restaurant_name] = (restCounts[p.restaurant_name]||0)+1 })
  const favRest = Object.entries(restCounts).sort((a,b)=>b[1]-a[1])[0]

  // Streak (consecutive weeks with a meal)
  const weekSet = new Set<string>()
  delivered.forEach(p => {
    if (!p.delivery_date) return
    const d = new Date(p.delivery_date + 'T12:00:00')
    const ws = new Date(d); ws.setDate(d.getDate()-d.getDay())
    weekSet.add(ws.toISOString().split('T')[0])
  })
  let streak = 0
  const now = new Date(); const cur = new Date(now); cur.setDate(now.getDate()-now.getDay())
  while (weekSet.has(cur.toISOString().split('T')[0])) { streak++; cur.setDate(cur.getDate()-7) }

  const stats = [
    { emoji:'🧡', label:'Total meals received',  val: totalMeals,                         sub: totalMeals===1?'meal':'meals' },
    { emoji:'👥', label:'Village size',           val: villageSize,                         sub: 'unique coordinators' },
    { emoji:'🏆', label:'Top coordinator',        val: topCoord?.[0]||'—',                 sub: topCoord?`${topCoord[1]} meal${topCoord[1]!==1?'s':''}`:'' },
    { emoji:'🍽', label:'Favorite restaurant',    val: favRest?.[0]||'—',                  sub: favRest?`${favRest[1]} time${favRest[1]!==1?'s':''}`:'' },
    { emoji:'🔥', label:'Streak',                 val: streak>0?`${streak} week${streak!==1?'s':''}` : '—', sub: streak>0?'consecutive weeks':'no streak yet' },
  ]

  return (
    <div style={{ padding:'16px 20px' }}>
      <p style={{ fontFamily:"'Lora',serif", fontSize:20, fontWeight:500, color:S.forest, margin:'0 0 4px', letterSpacing:-0.5 }}>Your Village</p>
      <p style={{ fontSize:13, color:S.stone, fontWeight:300, margin:'0 0 20px' }}>How {kitchenName?.split("'")[0]||'your kitchen'} is being supported.</p>

      {/* Time saved hero */}
      <div style={{ background:S.forest, borderRadius:18, padding:'22px 20px', marginBottom:16, textAlign:'center' }}>
        <p style={{ fontSize:11, fontWeight:600, color:S.sageMid, letterSpacing:'0.1em', textTransform:'uppercase', margin:'0 0 8px' }}>Time back in your day</p>
        <div style={{ fontFamily:"'Lora',serif", fontSize:48, fontWeight:500, color:S.white, lineHeight:1, margin:'0 0 6px' }}>
          {totalHours}
        </div>
        <p style={{ fontSize:16, color:S.sageMid, fontWeight:300, margin:'0 0 8px' }}>hours saved</p>
        {totalMeals > 0 && (
          <p style={{ fontSize:13, color:'rgba(255,255,255,0.5)', fontWeight:300, margin:0, lineHeight:1.6 }}>
            That's nearly {workweeks} full work week{parseFloat(workweeks)!==1?'s':''} back with your family.
          </p>
        )}
        <div style={{ display:'flex', justifyContent:'center', gap:20, marginTop:16, paddingTop:16, borderTop:'0.5px solid rgba(255,255,255,0.1)' }}>
          {[{label:'Prep',mins:30},{label:'Cook',mins:45},{label:'Clean',mins:20}].map(item => (
            <div key={item.label} style={{ textAlign:'center' }}>
              <div style={{ fontSize:16, fontWeight:600, color:S.white }}>{totalMeals*item.mins}</div>
              <div style={{ fontSize:10, color:'rgba(255,255,255,0.4)', fontWeight:300 }}>{item.label} min</div>
            </div>
          ))}
        </div>
      </div>

      {/* Stats grid */}
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {stats.map(s => (
          <div key={s.label} style={{ background:S.white, border:`0.5px solid ${S.border}`, borderRadius:14, padding:'14px 16px', display:'flex', alignItems:'center', gap:14 }}>
            <span style={{ fontSize:24, flexShrink:0 }}>{s.emoji}</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:11, fontWeight:600, color:S.stone, letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:3 }}>{s.label}</div>
              <div style={{ fontFamily:"'Lora',serif", fontSize:16, fontWeight:500, color:S.forest }}>{s.val}</div>
              {s.sub && <div style={{ fontSize:11, color:S.stone, fontWeight:300, marginTop:1 }}>{s.sub}</div>}
            </div>
          </div>
        ))}
      </div>

      {totalMeals === 0 && (
        <div style={{ marginTop:20, background:S.sageLight, borderRadius:14, padding:'20px', textAlign:'center' }}>
          <p style={{ fontSize:14, color:S.sage, margin:0, lineHeight:1.7 }}>
            Once your village starts sending meals, your insights will appear here. Share your Kitchen link to get started. 🧡
          </p>
        </div>
      )}
    </div>
  )
}

// ── SHARE TAB ─────────────────────────────────────────────────────────────────
function ShareTab({ kitchenUrl, kitchen }: { kitchenUrl: string; kitchen: Kitchen }) {
  const [copied, setCopied] = useState(false)
  const [contacts, setContacts] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(kitchenUrl) } catch {
      const ta = document.createElement('textarea'); ta.value=kitchenUrl; ta.style.cssText='position:fixed;opacity:0'
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta)
    }
    setCopied(true); setTimeout(()=>setCopied(false),2500)
  }
  const shareNative = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: kitchen.name, text:'Send me a meal through YourKitchen 🧡', url: kitchenUrl }) }
      catch {}
    } else { copyLink() }
  }

  return (
    <div style={{ padding:'16px 20px' }}>
      <p style={{ fontFamily:"'Lora',serif", fontSize:20, fontWeight:500, color:S.forest, margin:'0 0 4px', letterSpacing:-0.5 }}>Share Your Kitchen</p>
      <p style={{ fontSize:13, color:S.stone, fontWeight:300, margin:'0 0 20px', lineHeight:1.6 }}>
        Let your village know you're open for support. Share your Kitchen link with the people who care about you.
      </p>

      {/* Kitchen link */}
      <div style={{ background:S.white, border:`1.5px dashed ${S.sageMid}`, borderRadius:16, padding:'16px 18px', marginBottom:12 }}>
        <p style={{ fontSize:10, fontWeight:700, color:S.stone, letterSpacing:'0.1em', textTransform:'uppercase', margin:'0 0 8px' }}>Your Kitchen Link</p>
        <div style={{ fontFamily:'monospace', fontSize:13, color:S.sage, marginBottom:12, wordBreak:'break-all', lineHeight:1.5 }}>{kitchenUrl}</div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={copyLink}
            style={{ flex:1, padding:'11px', background:copied?S.sage:S.forest, color:S.white, border:'none', borderRadius:9, fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:"'DM Sans',sans-serif", transition:'background 0.2s' }}>
            {copied?'✓ Copied!':'Copy Link'}
          </button>
          <button onClick={shareNative}
            style={{ padding:'11px 18px', background:S.sageLight, color:S.sage, border:'none', borderRadius:9, fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>
            Share
          </button>
        </div>
      </div>

      {/* QR placeholder */}
      <div style={{ background:S.white, border:`0.5px solid ${S.border}`, borderRadius:16, padding:'20px', marginBottom:12, textAlign:'center' }}>
        <p style={{ fontSize:10, fontWeight:700, color:S.stone, letterSpacing:'0.1em', textTransform:'uppercase', margin:'0 0 12px' }}>QR Code</p>
        <div style={{ width:100, height:100, background:S.sageLight, borderRadius:12, margin:'0 auto 12px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:36 }}>
          🔗
        </div>
        <p style={{ fontSize:12, color:S.stone, fontWeight:300, margin:0 }}>Print or save your QR code to share offline.</p>
        <button style={{ marginTop:10, padding:'8px 20px', borderRadius:9, border:`1px solid ${S.border}`, background:'transparent', fontSize:12, color:S.forest, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>
          Download QR Code
        </button>
      </div>

      {/* Share to social */}
      <div style={{ background:S.white, border:`0.5px solid ${S.border}`, borderRadius:16, padding:'16px 18px' }}>
        <p style={{ fontSize:10, fontWeight:700, color:S.stone, letterSpacing:'0.1em', textTransform:'uppercase', margin:'0 0 12px' }}>Share to Social</p>
        <p style={{ fontSize:13, color:S.stone, fontWeight:300, margin:'0 0 12px', lineHeight:1.6 }}>Let your network know your Kitchen is live.</p>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={() => {
            const text = `My village has a way to show up for me now 🧡\n\nYourKitchen lets the people who love you send dinner from restaurants you love — no coordination needed.\n\nMy Kitchen is live: ${kitchenUrl}\n\n#YourKitchen #MealTrain`
            window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(kitchenUrl)}&quote=${encodeURIComponent(text)}`, '_blank')
          }}
            style={{ flex:1, padding:'12px', borderRadius:10, border:`1px solid ${S.border}`, background:'transparent', fontSize:13, fontWeight:600, color:'#1877F2', cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>
            👍 Facebook
          </button>
          <button onClick={async () => {
            const text = `My village has a way to show up for me now 🧡\n\nMy YourKitchen is live: ${kitchenUrl}\n\n#YourKitchen`
            try { await navigator.clipboard.writeText(text) } catch {}
            window.open('https://www.instagram.com/', '_blank')
          }}
            style={{ flex:1, padding:'12px', borderRadius:10, border:`1px solid ${S.border}`, background:'transparent', fontSize:13, fontWeight:600, color:'#E1306C', cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>
            📸 Instagram
          </button>
        </div>
        <p style={{ fontSize:11, color:S.stone, margin:'8px 0 0', fontWeight:300 }}>Instagram: caption is copied to clipboard, then Instagram opens.</p>
      </div>
    </div>
  )
}

// ── VILLAGE TAB ───────────────────────────────────────────────────────────────
function VillageTab({ kitchen, villagePosts, proposals, onPostUpdate }: { kitchen: Kitchen; villagePosts: VillagePost[]; proposals: Proposal[]; onPostUpdate: () => void }) {
  const supabase = createClient()
  const [newPost, setNewPost] = useState('')
  const [posting, setPosting]  = useState(false)

  const uniqueCoords = Object.values(
    proposals.reduce((acc: any, p) => {
      if (p.coordinator_name && !acc[p.coordinator_name]) {
        acc[p.coordinator_name] = { name: p.coordinator_name, count: 0, lastDate: p.delivery_date }
      }
      if (p.coordinator_name && ['confirmed','delivered'].includes(p.status)) {
        acc[p.coordinator_name].count++
      }
      return acc
    }, {})
  ) as any[]

  const submitPost = async () => {
    if (!newPost.trim() || !kitchen?.id) return
    setPosting(true)
    await supabase.from('village_posts').insert({ kitchen_id: kitchen.id, content: newPost.trim() })
    setNewPost(''); setPosting(false); onPostUpdate()
  }

  const fmt = (s: string) => new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  return (
    <div style={{ padding:'16px 20px' }}>
      <p style={{ fontFamily:"'Lora',serif", fontSize:20, fontWeight:500, color:S.forest, margin:'0 0 4px', letterSpacing:-0.5 }}>Your Village</p>
      <p style={{ fontSize:13, color:S.stone, fontWeight:300, margin:'0 0 20px', lineHeight:1.6 }}>
        Share life updates, say thank you, keep your community close.
      </p>

      {/* Post an update */}
      <div style={{ background:S.white, border:`0.5px solid ${S.border}`, borderRadius:16, padding:'16px', marginBottom:20 }}>
        <p style={{ fontSize:10, fontWeight:700, color:S.stone, letterSpacing:'0.1em', textTransform:'uppercase', margin:'0 0 10px' }}>Share a life update</p>
        <textarea value={newPost} onChange={e=>setNewPost(e.target.value)}
          placeholder="Miles slept 6 hours last night 🎉 First week home is going well..."
          style={{ width:'100%', minHeight:80, borderRadius:10, border:`1.5px solid ${S.border}`, padding:'10px 12px', fontSize:14, fontFamily:"'DM Sans',sans-serif", color:S.forest, background:S.cream, resize:'none', outline:'none', boxSizing:'border-box', lineHeight:1.6, marginBottom:10 }} />
        <button onClick={submitPost} disabled={!newPost.trim()||posting}
          style={{ width:'100%', padding:'11px', borderRadius:9, border:'none', background:!newPost.trim()?S.border:S.forest, color:!newPost.trim()?S.stone:S.white, fontSize:13, fontWeight:600, cursor:!newPost.trim()?'default':'pointer', fontFamily:"'DM Sans',sans-serif" }}>
          {posting?'Sharing…':'Share with your village 🧡'}
        </button>
      </div>

      {/* Update feed */}
      {villagePosts.length > 0 && (
        <div style={{ marginBottom:24 }}>
          <p style={sLabel}>Recent Updates</p>
          {villagePosts.map(post => (
            <div key={post.id} style={{ background:S.white, border:`0.5px solid ${S.border}`, borderRadius:14, padding:'14px 16px', marginBottom:10 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                <div style={{ width:32, height:32, borderRadius:10, background:S.sage, display:'flex', alignItems:'center', justifyContent:'center', color:S.white, fontSize:14, fontWeight:700, flexShrink:0 }}>
                  {kitchen.name?.charAt(0)||'K'}
                </div>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:S.forest }}>{kitchen.name?.split("'")[0]||'You'}</div>
                  <div style={{ fontSize:11, color:S.stone, fontWeight:300 }}>{fmt(post.posted_at)}</div>
                </div>
              </div>
              <p style={{ fontSize:14, color:S.forest, margin:0, lineHeight:1.7 }}>{post.content}</p>
            </div>
          ))}
        </div>
      )}

      {/* Village members */}
      {uniqueCoords.length > 0 && (
        <div>
          <p style={sLabel}>Your Village ({uniqueCoords.length})</p>
          {uniqueCoords.map((coord:any) => (
            <div key={coord.name} style={{ background:S.white, border:`0.5px solid ${S.border}`, borderRadius:12, padding:'12px 16px', display:'flex', alignItems:'center', gap:12, marginBottom:8 }}>
              <div style={{ width:36, height:36, borderRadius:11, background:S.sageLight, display:'flex', alignItems:'center', justifyContent:'center', color:S.sage, fontSize:15, fontWeight:700, flexShrink:0 }}>
                {coord.name.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:600, color:S.forest }}>{coord.name}</div>
                <div style={{ fontSize:11, color:S.stone, fontWeight:300 }}>
                  {coord.count>0?`${coord.count} meal${coord.count!==1?'s':''} sent`:'Invited'}
                </div>
              </div>
              {coord.count>0 && (
                <span style={{ background:S.sageLight, color:S.sage, fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20 }}>🧡</span>
              )}
            </div>
          ))}
        </div>
      )}

      {villagePosts.length===0 && uniqueCoords.length===0 && (
        <div style={{ background:S.sageLight, borderRadius:14, padding:'20px', textAlign:'center' }}>
          <p style={{ fontSize:14, color:S.sage, margin:0, lineHeight:1.7 }}>
            Your village will appear here once people start sending meals. Share your Kitchen link to invite them! 🧡
          </p>
        </div>
      )}
    </div>
  )
}

// ── Shared style ──────────────────────────────────────────────────────────────
const sLabel: React.CSSProperties = { fontSize:10, fontWeight:700, color:'#6B7066', letterSpacing:'0.1em', textTransform:'uppercase', margin:'0 0 10px' }

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const router   = useRouter()
  const supabase = createClient()

  const [activeTab, setActiveTab]     = useState<Tab>('home')
  const [drawerOpen, setDrawerOpen]   = useState(false)
  const [notifOpen, setNotifOpen]     = useState(false)
  const [loading, setLoading]         = useState(true)
  const [fullName, setFullName]       = useState('')
  const [userTier, setUserTier]       = useState('free')
  const [kitchen, setKitchen]         = useState<Kitchen | null>(null)
  const [calDates, setCalDates]       = useState<CalDate[]>([])
  const [allProposals, setAllProposals] = useState<Proposal[]>([])
  const [villagePosts, setVillagePosts] = useState<VillagePost[]>([])
  const [kitchenUrl, setKitchenUrl]   = useState('')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [adding, setAdding]           = useState(false)
  const [addError, setAddError]       = useState('')

  const today    = new Date()
  const todayStr = today.toISOString().split('T')[0]

  const loadCalDates = useCallback(async (kitchenId: string) => {
    const { data } = await supabase.from('calendar_dates')
      .select('id, date, meal_type, status')
      .eq('kitchen_id', kitchenId).gte('date', todayStr).order('date', { ascending: true })
    setCalDates(data || [])
  }, [todayStr])

  const loadProposals = useCallback(async (kitchenId: string) => {
    const { data } = await supabase.from('meal_proposals')
      .select('id, status, coordinator_name, restaurant_name, meal_name, delivery_date, meal_type, coordinator_note, doordash_tracking_url, doordash_delivery_id, doordash_status, proposed_at')
      .eq('kitchen_id', kitchenId)
      .order('proposed_at', { ascending: false })
    setAllProposals((data || []) as Proposal[])
  }, [])

  const loadVillagePosts = useCallback(async (kitchenId: string) => {
    const { data } = await supabase.from('village_posts')
      .select('id, content, posted_at')
      .eq('kitchen_id', kitchenId)
      .order('posted_at', { ascending: false })
    setVillagePosts(data || [])
  }, [])

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase.from('profiles')
        .select('full_name, tier').eq('id', user.id).single()

      const name = profile?.full_name
        || (user.user_metadata?.full_name as string)
        || (user.user_metadata?.name as string) || ''
      setFullName(name)
      setUserTier(profile?.tier || 'free')

      const { data: kitchens } = await supabase.from('kitchens')
        .select('id, name, slug, address, household_size')
        .eq('organizer_id', user.id)
        .order('created_at', { ascending: false }).limit(1)
      const k = kitchens?.[0] || null

      if (k) {
        setKitchen(k)
        setKitchenUrl(`${window.location.origin}/k/${k.slug}`)
        await Promise.all([
          loadCalDates(k.id),
          loadProposals(k.id),
          loadVillagePosts(k.id),
        ])
      }
      setLoading(false)
    }
    load()
  }, [])

  // Real-time proposals
  useEffect(() => {
    if (!kitchen?.id) return
    const ch = supabase.channel(`proposals-${kitchen.id}`)
      .on('postgres_changes', { event:'*', schema:'public', table:'meal_proposals', filter:`kitchen_id=eq.${kitchen.id}` },
        () => loadProposals(kitchen.id))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [kitchen?.id])

  const handleAddSlot = async (mealType: string) => {
    if (!kitchen || !selectedDate) return
    setAdding(true); setAddError('')
    const res = await fetch('/api/calendar', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ kitchen_id:kitchen.id, date:selectedDate, meal_type:mealType }),
    })
    const data = await res.json()
    if (!res.ok) { setAddError(data.error||'Could not add slot'); setAdding(false); return }
    await loadCalDates(kitchen.id); setAdding(false)
  }

  const handleRemoveSlot = async (dateId: string) => {
    await fetch('/api/calendar', { method:'DELETE', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ date_id:dateId }) })
    if (kitchen) await loadCalDates(kitchen.id)
  }

  const signOut = async () => { await supabase.auth.signOut(); router.push('/login') }

  const pendingCount = allProposals.filter(p => p.status === 'pending').length
  const activeCount  = allProposals.filter(p => p.status === 'confirmed' && p.doordash_status !== 'cancelled').length
  const badgeCount   = pendingCount + activeCount
  const tier         = TIER_META[userTier] || TIER_META.free
  const firstName    = (fullName||'').split(' ')[0] || 'there'

  if (loading) return (
    <div style={{ minHeight:'100vh', background:S.cream, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'DM Sans',sans-serif" }}>
      <p style={{ color:S.stone, fontSize:14 }}>Loading your Kitchen…</p>
    </div>
  )

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', background:S.cream, fontFamily:"'DM Sans',sans-serif", overflow:'hidden' }}>
      <link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />

      {/* Hamburger Drawer */}
      {drawerOpen && <Drawer name={fullName} tier={tier} onClose={()=>setDrawerOpen(false)} onSignOut={signOut} router={router} />}

      {/* Notification Panel */}
      {notifOpen && <NotifPanel proposals={allProposals} onClose={()=>setNotifOpen(false)} router={router} />}

      {/* Top Bar */}
      <div style={{ background:S.forest, padding:'14px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0, paddingTop:'calc(14px + env(safe-area-inset-top, 0px))' }}>
        <button onClick={()=>setDrawerOpen(true)}
          style={{ background:'none', border:'none', cursor:'pointer', padding:'4px', display:'flex', flexDirection:'column', gap:4, justifyContent:'center' }}>
          <div style={{ width:20, height:2, background:S.white, borderRadius:2 }} />
          <div style={{ width:14, height:2, background:S.white, borderRadius:2 }} />
          <div style={{ width:18, height:2, background:S.white, borderRadius:2 }} />
        </button>

        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:8, fontWeight:500, letterSpacing:5, color:S.sageMid, textTransform:'uppercase', lineHeight:1 }}>Your</div>
          <div style={{ fontFamily:"'Lora',serif", fontSize:18, fontWeight:500, color:S.white, letterSpacing:-0.5, lineHeight:1.2 }}>
            {kitchen?.name || `${firstName}'s Kitchen`}
          </div>
        </div>

        <button onClick={()=>{ setNotifOpen(o=>!o); }}
          style={{ background:'none', border:'none', cursor:'pointer', position:'relative', padding:4 }}>
          <span style={{ fontSize:20 }}>🔔</span>
          {badgeCount > 0 && (
            <div style={{ position:'absolute', top:0, right:0, background:S.amber, color:S.white, borderRadius:'50%', width:16, height:16, display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:700 }}>
              {badgeCount > 9 ? '9+' : badgeCount}
            </div>
          )}
        </button>
      </div>

      {/* No kitchen */}
      {!kitchen ? (
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
          <div style={{ background:S.forest, borderRadius:20, padding:'32px', textAlign:'center', maxWidth:320 }}>
            <div style={{ fontSize:48, marginBottom:14 }}>🥗</div>
            <h2 style={{ fontFamily:"'Lora',serif", fontSize:22, fontWeight:500, color:S.white, margin:'0 0 10px' }}>Set up your Kitchen</h2>
            <p style={{ fontSize:14, color:'rgba(255,255,255,0.65)', fontWeight:300, lineHeight:1.7, margin:'0 0 22px' }}>
              Add restaurants, set your calendar, and share your link.
            </p>
            <button onClick={()=>router.push('/kitchen/setup')}
              style={{ background:S.sage, color:S.white, border:'none', borderRadius:12, padding:'13px 28px', fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>
              Set Up My Kitchen →
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Tab content */}
          <div style={{ flex:1, overflowY:'auto', paddingBottom:72 }}>
            {activeTab === 'home' && (
              <HomeTab
                kitchen={kitchen} calDates={calDates}
                selectedDate={selectedDate} setSelectedDate={setSelectedDate}
                adding={adding} addError={addError}
                handleAddSlot={handleAddSlot} handleRemoveSlot={handleRemoveSlot}
                tier={tier} router={router} userTier={userTier}
              />
            )}
            {activeTab === 'activity' && <ActivityTab proposals={allProposals} router={router} />}
            {activeTab === 'insights' && <InsightsTab proposals={allProposals} kitchenName={kitchen.name} />}
            {activeTab === 'share' && <ShareTab kitchenUrl={kitchenUrl} kitchen={kitchen} />}
            {activeTab === 'village' && (
              <VillageTab
                kitchen={kitchen} villagePosts={villagePosts}
                proposals={allProposals}
                onPostUpdate={() => loadVillagePosts(kitchen.id)}
              />
            )}
          </div>

          {/* Bottom Nav */}
          <BottomNav active={activeTab} set={setActiveTab} badge={badgeCount} />
        </>
      )}
    </div>
  )
}

'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
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
  free:     { badge: 'Care',            price: '', color: '#3D6B4F', bg: '#EAF2ED', desc: 'Your kitchen, covered.' },
  trial:    { badge: 'Pilot Trial',     price: 'Care+', color: '#4A8FA8', bg: '#DFF0F6', desc: 'Full Care+ access during the pilot.' },
  care:     { badge: 'Care+',           price: '', color: '#3D6B4F', bg: '#EAF2ED', desc: 'The full village and more.' },
  annual:   { badge: 'Care+',           price: '', color: '#3D6B4F', bg: '#EAF2ED', desc: 'The full village and more.' },
  founding: { badge: 'Founding Member', price: '', color: '#C17F47', bg: '#FBF0E4', star: true, desc: 'Thank you for founding YourKitchen.' },
}
const TIER_LIMITS: Record<string, number> = { free: 3, trial: 10, care: 10, annual: 10, founding: 999 }
// Menu items allowed per restaurant by tier
const MEAL_LIMITS: Record<string, number> = { free: 4, trial: 12, care: 12, annual: 12, founding: 999 }
const isFounding = (t: string) => t === 'founding'
const MINS_PER_MEAL = 95

// ── Types ──────────────────────────────────────────────────────────────────────
type Tab = 'home' | 'activity' | 'insights' | 'share' | 'village'
type CalDate  = { id: string; date: string; meal_type: string; status: string }
type Kitchen  = { id: string; name: string; slug: string; address: string | null; household_size: number | null }
type Proposal = {
  id: string; status: string; coordinator_name: string; restaurant_name: string
  meal_name: string; delivery_date: string; meal_type: string; coordinator_note: string | null
  doordash_tracking_url: string | null; doordash_delivery_id: string | null
  doordash_status: string | null; proposed_at: string
}
type VillagePost = { id: string; content: string; author_name: string | null; author_type: string | null; posted_at: string; image_url?: string | null; parent_id?: string | null; reactions?: Record<string,number>; post_type?: string; replies?: VillagePost[] }

// ── Bottom Nav ────────────────────────────────────────────────────────────────
function BottomNav({ active, set, badge }: { active: Tab; set: (t: Tab) => void; badge: number }) {
  // ── SVG icon set — filled/outline per HIG active-state convention ─────────
  const IcHome = ({c,f}:{c:string,f:boolean}) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      {f
        ? <path d="M3 9.5L12 2L21 9.5V20C21 20.55 20.55 21 20 21H15.5V15.5C15.5 14.95 15.05 14.5 14.5 14.5H9.5C8.95 14.5 8.5 14.95 8.5 15.5V21H4C3.45 21 3 20.55 3 20V9.5Z" fill={c}/>
        : <path d="M3 9.5L12 2L21 9.5V20C21 20.55 20.55 21 20 21H15.5V15.5C15.5 14.95 15.05 14.5 14.5 14.5H9.5C8.95 14.5 8.5 14.95 8.5 15.5V21H4C3.45 21 3 20.55 3 20V9.5Z" stroke={c} strokeWidth="1.75" strokeLinejoin="round" fill="none"/>}
    </svg>
  )
  const IcActivity = ({c,f}:{c:string,f:boolean}) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      {f ? (<><rect x="4" y="2" width="16" height="20" rx="2.5" fill={c}/>
              <path d="M8 8H12M8 12H16M8 16H14" stroke="white" strokeWidth="1.6" strokeLinecap="round"/></>)
          : (<><rect x="4" y="2" width="16" height="20" rx="2.5" stroke={c} strokeWidth="1.75" fill="none"/>
              <path d="M8 8H12M8 12H16M8 16H14" stroke={c} strokeWidth="1.6" strokeLinecap="round"/></>)}
    </svg>
  )
  const IcHeart = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" fill="#E8444D"/>
    </svg>
  )
  const IcInsights = ({c,f}:{c:string,f:boolean}) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      {f ? (<><rect x="3" y="13" width="5" height="8" rx="1" fill={c}/>
              <rect x="9.5" y="8" width="5" height="13" rx="1" fill={c}/>
              <rect x="16" y="3" width="5" height="18" rx="1" fill={c}/></>)
          : (<><rect x="3" y="13" width="5" height="8" rx="1" stroke={c} strokeWidth="1.75" fill="none"/>
              <rect x="9.5" y="8" width="5" height="13" rx="1" stroke={c} strokeWidth="1.75" fill="none"/>
              <rect x="16" y="3" width="5" height="18" rx="1" stroke={c} strokeWidth="1.75" fill="none"/></>)}
    </svg>
  )
  const IcVillage = ({c,f}:{c:string,f:boolean}) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      {f
        ? <path d="M21 15C21 15.55 20.55 16 20 16H7L3 20V4C3 3.45 3.45 3 4 3H20C20.55 3 21 3.45 21 4V15Z" fill={c}/>
        : <path d="M21 15C21 15.55 20.55 16 20 16H7L3 20V4C3 3.45 3.45 3 4 3H20C20.55 3 21 3.45 21 4V15Z" stroke={c} strokeWidth="1.75" strokeLinejoin="round" fill="none"/>}
    </svg>
  )
  const tabs: { key: Tab; label: string }[] = [
    { key: 'home',     label: 'Home'     },
    { key: 'activity', label: 'Activity' },
    { key: 'share',    label: 'Share'    },
    { key: 'insights', label: 'Insights' },
    { key: 'village',  label: 'Village'  },
  ]
  return (
    <div style={{ position:'fixed', bottom:0, left:0, right:0, background:S.white, borderTop:`0.5px solid ${S.border}`, display:'flex', zIndex:200, paddingBottom:'env(safe-area-inset-bottom, 0px)' }}>
      {tabs.map(t => {
        const isActive  = active === t.key
        const isShare   = t.key === 'share'
        const showBadge = t.key === 'activity' && badge > 0
        const iconCol   = isActive ? (isShare ? '#E8444D' : S.sage) : S.stone
        return (
          <button key={t.key} onClick={() => set(t.key)}
            style={{ flex:1, border:'none', background:'none', cursor:'pointer', padding:'10px 0 8px', display:'flex', flexDirection:'column', alignItems:'center', gap:3, position:'relative', fontFamily:"'DM Sans',sans-serif", minHeight:44 }}>
            {showBadge && (
              <div style={{ position:'absolute', top:6, right:'50%', transform:'translateX(12px)', background:S.amber, color:S.white, borderRadius:'50%', width:16, height:16, display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:700 }}>
                {badge > 9 ? '9+' : badge}
              </div>
            )}
            <div style={{ width:44, height:28, borderRadius:14, background:isActive?(isShare?'#FDE8E9':S.sageLight):'transparent', display:'flex', alignItems:'center', justifyContent:'center', transition:'background 0.2s' }}>
              {t.key==='home'     && <IcHome c={iconCol} f={isActive}/>}
              {t.key==='activity' && <IcActivity c={iconCol} f={isActive}/>}
              {t.key==='share'    && <IcHeart />}
              {t.key==='insights' && <IcInsights c={iconCol} f={isActive}/>}
              {t.key==='village'  && <IcVillage c={iconCol} f={isActive}/>}
            </div>
            <span style={{ fontSize:10, fontWeight:isActive?600:400, color:isActive?(isShare?'#E8444D':S.sage):S.stone, letterSpacing:'0.02em' }}>{t.label}</span>
          </button>
        )
      })}
    </div>
  )
}

// ── Drawer SVG icons (monochrome, stroke-only, HIG-weight 1.7) ────────────
function DrawerIcon({ name }: { name: string }) {
  const c = S.stone
  const s = { stroke:c, strokeWidth:'1.7', strokeLinecap:'round' as const, strokeLinejoin:'round' as const, fill:'none' }
  const icons: Record<string, React.ReactNode> = {
    'My Restaurants': <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M3 2v7c0 1.1.9 2 2 2s2-.9 2-2V2" {...s}/><path d="M5 11v9M15 2s2 4 2 7-2 7-2 7v2" {...s}/>
    </svg>,
    'Order History': <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" {...s}/><path d="M12 7v5l3 3" {...s}/>
    </svg>,
    'Settings': <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="3" {...s}/><path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" {...s}/>
    </svg>,
    'Delivery Windows': <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" {...s}/><path d="M12 6v6l4 2" {...s}/>
    </svg>,
    'Plans & Pricing': <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" {...s}/>
    </svg>,
    'Share Your Kitchen': <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13" {...s}/>
    </svg>,
    'Refresh': <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <polyline points="23,4 23,10 17,10" {...s}/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" {...s}/>
    </svg>,
    'About & Help': <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" {...s}/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" {...s}/><line x1="12" y1="17" x2="12.01" y2="17" stroke={c} strokeWidth="2" strokeLinecap="round"/>
    </svg>,
    'Sign Out': <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" {...s}/>
    </svg>,
  }
  return <span style={{ width:24, display:'flex', justifyContent:'center', alignItems:'center', flexShrink:0 }}>{icons[name] ?? null}</span>
}

// ── Hamburger Drawer ──────────────────────────────────────────────────────────
function Drawer({ name, tier, kitchenUrl, recipientName, onClose, onSignOut, onShare, onRefresh, router }: { name: string; tier: any; kitchenUrl: string; recipientName: string; onClose: () => void; onSignOut: () => void; onShare: () => void; onRefresh: () => void; router: any }) {
  const initial = (name || '?').charAt(0).toUpperCase()
  const items = [
    { label: 'My Restaurants',   action: () => router.push('/kitchen/restaurants') },
    { label: 'Order History',    action: () => router.push('/kitchen/orders') },
    { label: 'Settings',         action: () => router.push('/settings') },
    { label: 'Delivery Times',   action: () => router.push('/kitchen/delivery') },
    { label: 'Plans & Pricing',  action: () => router.push('/tiers') },
    { label: 'Share Your Kitchen', action: onShare },
    { label: 'Refresh',          action: onRefresh },
    { label: 'About & Help',     action: () => router.push('/help') },
  ]
  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(30,38,32,0.5)', zIndex:300 }} />
      <div style={{ position:'fixed', top:0, left:0, bottom:0, width:'min(280px,88vw)', background:S.white, zIndex:301, display:'flex', flexDirection:'column', boxShadow:'4px 0 24px rgba(30,38,32,0.15)', animation:'slideIn 0.22s ease' }}>
        <style>{`@keyframes slideIn{from{transform:translateX(-100%)}to{transform:translateX(0)}}`}</style>
        <div style={{ background:S.forest, padding:'52px 24px 24px', display:'flex', alignItems:'center', gap:14 }}>
          <div style={{ width:48, height:48, borderRadius:14, background:S.sage, display:'flex', alignItems:'center', justifyContent:'center', color:S.white, fontFamily:"'Lora',serif", fontSize:20, fontWeight:600, flexShrink:0 }}>
            {initial}
          </div>
          <div>
            <div style={{ fontFamily:"'Lora',serif", fontSize:16, fontWeight:500, color:S.white, marginBottom:4 }}>{name || 'My Kitchen'}</div>
            <span style={{ background:tier.bg, color:tier.color, fontSize:10, fontWeight:700, padding:'3px 10px', borderRadius:20 }}>{tier.badge}</span>
          </div>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:'8px 0' }}>
          {items.map(item => (
            <button key={item.label} onClick={() => { onClose(); item.action() }}
              style={{ width:'100%', padding:'14px 24px', display:'flex', alignItems:'center', gap:14, background:'none', border:'none', cursor:'pointer', fontFamily:"'DM Sans',sans-serif", borderBottom:`0.5px solid ${S.border}` }}>
              <DrawerIcon name={item.label}/>
              <span style={{ fontSize:14, fontWeight:400, color:S.forest }}>{item.label}</span>
            </button>
          ))}
        </div>
        <div style={{ borderTop:`0.5px solid ${S.border}` }}>
          <button onClick={() => { onClose(); onSignOut() }}
            style={{ width:'100%', padding:'16px 24px', display:'flex', alignItems:'center', gap:14, background:'none', border:'none', cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>
            <DrawerIcon name="Sign Out"/>
            <span style={{ fontSize:14, color:S.red }}>Sign Out</span>
          </button>
          <div style={{ padding:'12px 24px 28px', display:'flex', gap:0, flexWrap:'wrap' }}>
            {[{label:'yourkitchen.app',href:'https://yourkitchen.app'},{label:'FAQ',href:'https://yourkitchen.app/#faq'},{label:'Privacy',href:'https://yourkitchen.app/privacy'},{label:'Terms',href:'https://yourkitchen.app/terms'}].map((l,i)=>(
              <span key={l.label}>
                {i>0&&<span style={{ color:S.stone,margin:'0 5px',fontSize:10 }}>·</span>}
                <a href={l.href} style={{ fontSize:11,color:S.stone,textDecoration:'none' }}>{l.label}</a>
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
    { key:'pending',   label:'Awaiting reply', items:proposals.filter(p=>p.status==='pending'),   color:S.amber },
    { key:'confirmed', label:'On the way',      items:proposals.filter(p=>p.status==='confirmed'), color:S.sage  },
    { key:'declined',  label:'Declined',        items:proposals.filter(p=>p.status==='declined'),  color:S.stone },
  ].filter(g => g.items.length > 0)

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed',inset:0,zIndex:150 }} />
      <div style={{ position:'fixed',top:58,right:16,width:'min(300px,calc(100vw - 32px))',background:S.white,borderRadius:16,boxShadow:'0 8px 32px rgba(30,38,32,0.15)',border:`0.5px solid ${S.border}`,zIndex:151,overflow:'hidden',maxHeight:'70vh',overflowY:'auto' }}>
        <div style={{ padding:'14px 16px',borderBottom:`0.5px solid ${S.border}`,display:'flex',justifyContent:'space-between',alignItems:'center' }}>
          <span style={{ fontFamily:"'Lora',serif",fontSize:15,fontWeight:500,color:S.forest }}>Notifications</span>
          <button onClick={onClose} style={{ background:'none',border:'none',cursor:'pointer',color:S.stone,fontSize:16 }}>✕</button>
        </div>
        {groups.length === 0 ? (
          <div style={{ padding:'24px',textAlign:'center' }}>
            <p style={{ fontSize:13,color:S.stone,fontWeight:300,margin:0 }}>You're all caught up 🧡</p>
          </div>
        ) : groups.map(g => (
          <div key={g.key}>
            <div style={{ padding:'10px 16px 6px',background:'#FAFAFA' }}>
              <span style={{ fontSize:10,fontWeight:700,color:g.color,letterSpacing:'0.08em',textTransform:'uppercase' }}>{g.label} · {g.items.length}</span>
            </div>
            {g.items.slice(0,3).map(p => (
              <button key={p.id} onClick={() => { onClose(); if(p.status==='pending') router.push(`/proposals/${p.id}`) }}
                style={{ width:'100%',padding:'10px 16px',display:'flex',alignItems:'center',gap:10,background:'none',border:'none',borderBottom:`0.5px solid ${S.border}`,cursor:p.status==='pending'?'pointer':'default',fontFamily:"'DM Sans',sans-serif",textAlign:'left' }}>
                <span style={{ fontSize:18 }}>{MEAL_COLORS[p.meal_type]?.emoji||'🍽'}</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13,fontWeight:500,color:S.forest }}>{p.meal_name}</div>
                  <div style={{ fontSize:11,color:S.stone,fontWeight:300 }}>{p.coordinator_name} · {p.restaurant_name}</div>
                </div>
                {p.status==='pending'&&<span style={{ fontSize:12,color:g.color }}>›</span>}
              </button>
            ))}
          </div>
        ))}
      </div>
    </>
  )
}

// ── HOME TAB ──────────────────────────────────────────────────────────────────
// Founding-member corner ribbon — a diagonal gold stripe across the top-right
// of the calendar card with a small star mark. Shown only for founding kitchens.
function FoundingRibbon() {
  return (
    <div style={{ position:'absolute', top:0, right:0, width:128, height:128, overflow:'hidden', pointerEvents:'none', zIndex:2 }}>
      <div style={{
        position:'absolute', top:20, right:-34, width:150, transform:'rotate(45deg)',
        background:'linear-gradient(135deg,#C9A24B 0%,#B88B4A 50%,#9A7338 100%)',
        color:'#FFF9EE', textAlign:'center', padding:'5px 0',
        fontFamily:"'DM Sans',sans-serif", fontSize:10, fontWeight:700, letterSpacing:'0.08em',
        boxShadow:'0 1px 4px rgba(154,115,56,0.35)', textTransform:'uppercase',
      }}>
        ★ Founding
      </div>
    </div>
  )
}

function HomeTab({ kitchen, calDates, selectedDate, setSelectedDate, adding, addError, handleAddSlot, handleRemoveSlot, tier, router, userTier, onShare }: any) {

  const today     = new Date()
  const todayStr  = today.toISOString().split('T')[0]
  const [viewYear,  setViewYear]  = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())

  const monthName   = new Date(viewYear,viewMonth,1).toLocaleDateString('en-US',{month:'long',year:'numeric'})
  const firstDay    = new Date(viewYear,viewMonth,1).getDay()
  const daysInMonth = new Date(viewYear,viewMonth+1,0).getDate()
  const prevMonth   = () => { if(viewMonth===0){setViewYear((y:number)=>y-1);setViewMonth(11)}else setViewMonth((m:number)=>m-1) }
  const nextMonth   = () => { if(viewMonth===11){setViewYear((y:number)=>y+1);setViewMonth(0)}else setViewMonth((m:number)=>m+1) }

  const cells: (number|null)[] = []
  for(let i=0;i<firstDay;i++) cells.push(null)
  for(let d=1;d<=daysInMonth;d++) cells.push(d)

  const dateMap: Record<string,CalDate[]> = {}
  calDates.forEach((d:CalDate) => { if(!dateMap[d.date])dateMap[d.date]=[];dateMap[d.date].push(d) })

  const formatDate = (s:string) => new Date(s+'T12:00:00').toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})

  return (
    <div style={{ padding:'16px 20px 16px' }}>
      <div style={{ background:S.white,border:`0.5px solid ${isFounding(userTier)?'#E6C99A':S.border}`,borderRadius:18,padding:'16px',marginBottom:14,position:'relative',overflow:'hidden' }}>
        {isFounding(userTier) && <FoundingRibbon/>}
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12 }}>
          <p style={{ fontFamily:"'Lora',serif",fontSize:15,fontWeight:500,color:S.forest,margin:0 }}>My Calendar</p>
          <div style={{ display:'flex',alignItems:'center',gap:6 }}>
            <button onClick={prevMonth} style={{ background:S.sageLight,border:'none',borderRadius:7,width:28,height:28,cursor:'pointer',fontSize:14,color:S.sage,display:'flex',alignItems:'center',justifyContent:'center' }}>‹</button>
            <span style={{ fontSize:12,fontWeight:500,color:S.forest,minWidth:108,textAlign:'center' }}>{monthName}</span>
            <button onClick={nextMonth} style={{ background:S.sageLight,border:'none',borderRadius:7,width:28,height:28,cursor:'pointer',fontSize:14,color:S.sage,display:'flex',alignItems:'center',justifyContent:'center' }}>›</button>
          </div>
        </div>
        <div style={{ display:'grid',gridTemplateColumns:'repeat(7,minmax(0,1fr))',gap:2,marginBottom:3 }}>
          {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d=>(
            <div key={d} style={{ textAlign:'center',fontSize:11,fontWeight:600,color:S.stone,padding:'2px 0' }}>{d}</div>
          ))}
        </div>
        <div style={{ display:'grid',gridTemplateColumns:'repeat(7,minmax(0,1fr))',gap:2 }}>
          {cells.map((day,i) => {
            if(!day) return <div key={i}/>
            const dateStr = `${viewYear}-${String(viewMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
            const isPast  = dateStr < todayStr
            const isToday = dateStr === todayStr
            const isSel   = selectedDate === dateStr
            const slots   = dateMap[dateStr]||[]
            return (
              <button key={i} onClick={() => { if(!isPast) setSelectedDate((p:string|null)=>p===dateStr?null:dateStr) }} disabled={isPast}
                style={{ background:isSel?S.sageLight:slots.length?'#F8FAF8':S.white,border:isSel?`2px solid ${S.sage}`:isToday?`2px solid ${S.sageMid}`:slots.length?`1px solid #C8DDD0`:'1px solid transparent',borderRadius:8,padding:'clamp(3px,1.2vw,6px) 2px',minHeight:'clamp(44px,11vw,54px)',cursor:isPast?'default':'pointer',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:2,fontFamily:"'DM Sans',sans-serif",opacity:isPast?0.35:1,transition:'all 0.1s' }}>
                <span style={{ fontSize:12,fontWeight:isToday?700:500,color:isSel?S.sage:S.forest,lineHeight:1 }}>{day}</span>
                {slots.length
                  ? <div style={{ display:'flex',gap:2,flexWrap:'wrap',justifyContent:'center' }}>
                      {slots.map((s:CalDate,si:number)=><div key={si} style={{ width:5,height:5,borderRadius:'50%',background:MEAL_COLORS[s.meal_type]?.color||S.sage }}/>)}
                    </div>
                  : !isPast?<div style={{ fontSize:13,color:'#DDE8E0' }}>+</div>:null}
              </button>
            )
          })}
        </div>
        <div style={{ display:'flex',gap:12,marginTop:10,paddingTop:10,borderTop:`0.5px solid ${S.border}`,flexWrap:'wrap' }}>
          {Object.entries(MEAL_COLORS).map(([k,v])=>(
            <div key={k} style={{ display:'flex',alignItems:'center',gap:3 }}>
              <div style={{ width:6,height:6,borderRadius:'50%',background:v.color }}/>
              <span style={{ fontSize:9,color:S.stone,fontWeight:500 }}>{v.emoji} {v.label}</span>
            </div>
          ))}
        </div>
      </div>

      {selectedDate && (
        <div style={{ background:S.white,border:`2px solid ${S.sage}`,borderRadius:16,padding:'16px',marginBottom:14 }}>
          <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12 }}>
            <div>
              <p style={{ fontSize:9,fontWeight:700,color:S.sage,letterSpacing:'0.08em',textTransform:'uppercase',margin:'0 0 2px' }}>Selected date</p>
              <p style={{ fontFamily:"'Lora',serif",fontSize:14,fontWeight:500,color:S.forest,margin:0 }}>{formatDate(selectedDate)}</p>
            </div>
            <button onClick={()=>setSelectedDate(null)} style={{ background:'none',border:'none',fontSize:16,color:S.stone,cursor:'pointer',padding:4 }}>✕</button>
          </div>
          {(dateMap[selectedDate]||[]).length>0&&(
            <div style={{ marginBottom:12 }}>
              <p style={{ fontSize:9,fontWeight:600,color:S.stone,letterSpacing:'0.06em',textTransform:'uppercase',margin:'0 0 6px' }}>Open slots</p>
              <div style={{ display:'flex',gap:6,flexWrap:'wrap' }}>
                {(dateMap[selectedDate]||[]).map((slot:CalDate)=>{
                  const mc=MEAL_COLORS[slot.meal_type]||MEAL_COLORS.dinner
                  return (
                    <div key={slot.id} style={{ display:'flex',alignItems:'center',gap:5,background:mc.bg,border:`1px solid ${mc.color}`,borderRadius:20,padding:'4px 10px 4px 9px' }}>
                      <span style={{ fontSize:11,fontWeight:600,color:mc.color }}>{mc.emoji} {mc.label}</span>
                      {slot.status==='available'&&<button onClick={()=>handleRemoveSlot(slot.id)} style={{ background:'none',border:'none',cursor:'pointer',color:mc.color,fontSize:12,padding:0,lineHeight:1,marginLeft:2 }}>✕</button>}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          <p style={{ fontSize:9,fontWeight:600,color:S.stone,letterSpacing:'0.06em',textTransform:'uppercase',margin:'0 0 8px' }}>
            {(dateMap[selectedDate]||[]).length>0?'Add another slot':'Add a meal slot'}
          </p>
          <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6 }}>
            {Object.entries(MEAL_COLORS).map(([type,mc])=>{
              const has=(dateMap[selectedDate]||[]).some((s:CalDate)=>s.meal_type===type)
              return (
                <button key={type} onClick={()=>!has&&!adding&&handleAddSlot(type)} disabled={has||adding}
                  style={{ background:has?'#F5F5F5':mc.bg,border:`1.5px solid ${has?'#DDD':mc.color}`,borderRadius:9,padding:'10px 6px',cursor:has||adding?'default':'pointer',opacity:has?0.5:1,fontFamily:"'DM Sans',sans-serif" }}>
                  <div style={{ fontSize:16,marginBottom:3 }}>{mc.emoji}</div>
                  <div style={{ fontSize:11,fontWeight:600,color:has?S.stone:mc.color }}>{has?'✓ Added':mc.label}</div>
                </button>
              )
            })}
          </div>
          {addError&&<p style={{ fontSize:11,color:S.red,margin:'8px 0 0' }}>{addError}</p>}
          {adding&&<p style={{ fontSize:11,color:S.stone,margin:'8px 0 0',fontWeight:300 }}>Adding…</p>}
        </div>
      )}

      {/* ── Share CTA — fills the void space, most important next action ── */}
      <div style={{ background:S.forest, borderRadius:16, padding:'18px 20px', marginBottom:14 }}>
        <p style={{ fontFamily:"'Lora',serif", fontSize:15, fontWeight:600, color:S.white, margin:'0 0 6px' }}>Share with your village</p>
        <p style={{ fontSize:12, color:'rgba(255,255,255,0.65)', fontWeight:300, margin:'0 0 14px', lineHeight:1.5 }}>Let the people who love you know your kitchen is open.</p>
        <button onClick={onShare}
          style={{ width:'100%', padding:'12px', borderRadius:10, border:'none', background:S.sage, color:S.white, fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>
          Share My Kitchen →
        </button>
      </div>

      <button onClick={()=>{ if(userTier==='free'||userTier==='trial'){ window.open('https://buy.stripe.com/5kQ00beDq9XD9BX5w5abK01','_blank','noopener') } else { router.push('/settings') } }}
        style={{ width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',background:tier.bg,border:`1px solid ${tier.color}22`,borderRadius:14,padding:'12px 16px',cursor:'pointer',fontFamily:"'DM Sans',sans-serif" }}>
        <div style={{ display:'flex',alignItems:'center',gap:8 }}>
          {tier.star&&<span style={{ fontSize:14,color:tier.color }}>★</span>}
          <span style={{ fontSize:13,fontWeight:600,color:tier.color }}>{tier.badge}</span>
          <span style={{ fontSize:12,color:S.stone,fontWeight:300 }}>{tier.price}</span>
        </div>
        {(userTier==='free'||userTier==='trial')&&(
          <span style={{ fontSize:11,fontWeight:700,color:tier.color }}>Become a Founder ›</span>
        )}
      </button>
    </div>
  )
}

// ── ACTIVITY TAB ──────────────────────────────────────────────────────────────
function ActivityTab({ proposals, router }: { proposals: Proposal[]; router: any }) {
  const onTheWay = proposals.filter(p => p.status==='confirmed' && p.doordash_status!=='cancelled')
  const pending  = proposals.filter(p => p.status==='pending')
  const previous = proposals.filter(p => ['delivered','declined','expired','cancelled'].includes(p.status)||(p.status==='confirmed'&&p.doordash_status==='cancelled'))
  const fmt = (s:string) => new Date(s+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})

  const handleShare = async (p: Proposal, platform: 'instagram'|'facebook') => {
    const text = `${p.coordinator_name} showed up for my family tonight 🧡\n\n${p.meal_name} from ${p.restaurant_name}\n\nThrough YourKitchen — your kitchen, covered.\n\nyourkitchen.app`
    if (platform==='facebook') {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent('https://yourkitchen.app')}&quote=${encodeURIComponent(text)}`,'_blank')
    } else {
      try { await navigator.clipboard.writeText(text) } catch {}
      window.open('https://www.instagram.com/','_blank')
    }
  }

  if (proposals.length===0) return (
    <div style={{ padding:'48px 24px',textAlign:'center' }}>
      <div style={{ fontSize:40,marginBottom:12 }}>🥗</div>
      <p style={{ fontFamily:"'Lora',serif",fontSize:17,color:S.forest,margin:'0 0 8px' }}>No orders yet</p>
      <p style={{ fontSize:13,color:S.stone,fontWeight:300,margin:0 }}>When your village sends meals, they'll appear here.</p>
    </div>
  )

  return (
    <div style={{ padding:'16px 20px' }}>
      {onTheWay.length>0&&(
        <div style={{ marginBottom:24 }}>
          <p style={sLabel}>🚗 On the Way</p>
          {onTheWay.map(p=>(
            <div key={p.id} style={{ background:S.white,border:`1.5px solid ${S.sage}`,borderRadius:14,overflow:'hidden',marginBottom:10 }}>
              <div style={{ padding:'14px 16px',display:'flex',alignItems:'flex-start',gap:12 }}>
                <span style={{ fontSize:20 }}>{MEAL_COLORS[p.meal_type]?.emoji||'🍽'}</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontFamily:"'Lora',serif",fontSize:14,fontWeight:600,color:S.forest }}>{p.meal_name}</div>
                  <div style={{ fontSize:12,color:S.stone,fontWeight:300 }}>{p.restaurant_name} · {fmt(p.delivery_date)}</div>
                  <div style={{ fontSize:12,color:S.stone,fontWeight:300 }}>from <strong style={{ color:S.forest }}>{p.coordinator_name}</strong></div>
                </div>
                <span style={{ background:S.sageLight,color:S.sage,fontSize:9,fontWeight:700,padding:'3px 9px',borderRadius:20 }}>Confirmed</span>
              </div>
              <div style={{ padding:'0 16px 14px',display:'flex',flexDirection:'column',gap:8 }}>
                {p.doordash_tracking_url&&(
                  <a href={p.doordash_tracking_url} target="_blank" rel="noopener noreferrer"
                    style={{ display:'block',background:S.forest,color:S.white,borderRadius:9,padding:'10px',fontSize:13,fontWeight:600,textDecoration:'none',textAlign:'center',fontFamily:"'DM Sans',sans-serif" }}>
                    🚗 Track My Delivery
                  </a>
                )}
                <div style={{ display:'flex',gap:8 }}>
                  <button onClick={()=>handleShare(p,'instagram')} style={{ flex:1,padding:'9px',borderRadius:9,border:`1px solid ${S.border}`,background:'transparent',fontSize:12,fontWeight:600,color:S.stone,cursor:'pointer',fontFamily:"'DM Sans',sans-serif" }}>📸 Instagram</button>
                  <button onClick={()=>handleShare(p,'facebook')} style={{ flex:1,padding:'9px',borderRadius:9,border:`1px solid ${S.border}`,background:'transparent',fontSize:12,fontWeight:600,color:S.stone,cursor:'pointer',fontFamily:"'DM Sans',sans-serif" }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{marginRight:5,flexShrink:0}}><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>Share</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {pending.length>0&&(
        <div style={{ marginBottom:24 }}>
          <p style={sLabel}>⏳ Awaiting Your Reply</p>
          {pending.map(p=>(
            <div key={p.id} style={{ background:S.white,border:`1.5px solid ${S.amber}`,borderRadius:14,overflow:'hidden',marginBottom:10 }}>
              <div style={{ padding:'14px 16px',display:'flex',alignItems:'flex-start',gap:12 }}>
                <span style={{ fontSize:20 }}>{MEAL_COLORS[p.meal_type]?.emoji||'🍽'}</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontFamily:"'Lora',serif",fontSize:14,fontWeight:600,color:S.forest }}>{p.meal_name}</div>
                  <div style={{ fontSize:12,color:S.stone,fontWeight:300 }}>{p.restaurant_name} · {fmt(p.delivery_date)}</div>
                  {p.coordinator_note&&<p style={{ fontSize:12,color:S.stone,fontStyle:'italic',margin:'5px 0 0',lineHeight:1.5 }}>"{p.coordinator_note}"</p>}
                </div>
                <span style={{ background:S.amberLight,color:S.amber,fontSize:9,fontWeight:700,padding:'3px 9px',borderRadius:20 }}>Pending</span>
              </div>
              <div style={{ padding:'0 16px 14px' }}>
                <button onClick={()=>router.push(`/proposals/${p.id}`)}
                  style={{ width:'100%',background:S.forest,color:S.white,border:'none',borderRadius:9,padding:'11px',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:"'DM Sans',sans-serif" }}>
                  Review Proposal →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {previous.length>0&&(
        <div>
          <p style={sLabel}>Previous Orders</p>
          {previous.map(p=>(
            <div key={p.id} style={{ background:S.white,border:`0.5px solid ${S.border}`,borderRadius:12,padding:'12px 16px',display:'flex',alignItems:'center',gap:12,marginBottom:8,opacity:['declined','expired'].includes(p.status)?0.65:1 }}>
              <span style={{ fontSize:18 }}>{MEAL_COLORS[p.meal_type]?.emoji||'🍽'}</span>
              <div style={{ flex:1,overflow:'hidden' }}>
                <div style={{ fontFamily:"'Lora',serif",fontSize:13,fontWeight:600,color:S.forest,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{p.meal_name}</div>
                <div style={{ fontSize:11,color:S.stone,fontWeight:300 }}>{p.restaurant_name} · {fmt(p.delivery_date)}</div>
              </div>
              <div style={{ display:'flex',flexDirection:'column',alignItems:'flex-end',gap:6 }}>
                <span style={{ fontSize:9,fontWeight:700,padding:'3px 9px',borderRadius:20,background:p.status==='delivered'?S.sageLight:'#F5F5F5',color:p.status==='delivered'?S.sage:S.stone }}>
                  {p.status==='delivered'?'🧡 Delivered':p.status==='declined'?'✕ Declined':p.status.charAt(0).toUpperCase()+p.status.slice(1)}
                </span>
                {(p.status==='delivered'||p.status==='confirmed')&&(
                  <button onClick={()=>handleShare(p,'instagram')} style={{ fontSize:9,fontWeight:600,color:S.sage,background:'none',border:'none',cursor:'pointer',padding:0,fontFamily:"'DM Sans',sans-serif" }}>Share 📸</button>
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
  const ic = S.sage
  const sv = { stroke:ic, strokeWidth:'1.7', strokeLinecap:'round' as const, strokeLinejoin:'round' as const, fill:'none' }

  const IcHeart   = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" {...sv}/></svg>
  const IcPeople  = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" {...sv}/><circle cx="9" cy="7" r="4" {...sv}/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" {...sv}/></svg>
  const IcTrophy  = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M6 3h12v7a6 6 0 0 1-12 0V3z" {...sv}/><path d="M4 3h2M18 3h2M4 5c0 3 2 5 2 5M20 5c0 3-2 5-2 5M12 15v3M8 21h8" {...sv}/></svg>
  const IcCutlery = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M3 2v7c0 1.1.9 2 2 2s2-.9 2-2V2M5 11v9M13 2s4 5 4 8-4 5-4 5v5" {...sv}/></svg>
  const IcBolt    = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" {...sv}/></svg>

  const delivered    = proposals.filter(p => ['confirmed','delivered'].includes(p.status))
  const totalMeals   = delivered.length
  const totalMins    = totalMeals * MINS_PER_MEAL
  const totalHours   = Math.round(totalMins / 60)
  const workweeks    = (totalMins / (40 * 60)).toFixed(1)
  const uniqueCoords = [...new Set(proposals.map(p=>p.coordinator_name).filter(Boolean))]
  const villageSize  = uniqueCoords.length
  const coordCounts: Record<string,number> = {}
  proposals.forEach(p => { if(p.coordinator_name) coordCounts[p.coordinator_name]=(coordCounts[p.coordinator_name]||0)+1 })
  const topCoord = Object.entries(coordCounts).sort((a,b)=>b[1]-a[1])[0]
  const restCounts: Record<string,number> = {}
  delivered.forEach(p => { if(p.restaurant_name) restCounts[p.restaurant_name]=(restCounts[p.restaurant_name]||0)+1 })
  const favRest = Object.entries(restCounts).sort((a,b)=>b[1]-a[1])[0]
  const weekSet = new Set<string>()
  delivered.forEach(p => {
    if(!p.delivery_date) return
    const d=new Date(p.delivery_date+'T12:00:00')
    const ws=new Date(d); ws.setDate(d.getDate()-d.getDay()); weekSet.add(ws.toISOString().split('T')[0])
  })
  let streak=0; const now=new Date(); const cur=new Date(now); cur.setDate(now.getDate()-now.getDay())
  while(weekSet.has(cur.toISOString().split('T')[0])){ streak++; cur.setDate(cur.getDate()-7) }

  const stats = [
    { icon:<IcHeart/>,   label:'Total meals received', val:totalMeals,                            sub:totalMeals===1?'meal':'meals' },
    { icon:<IcPeople/>,  label:'Village size',          val:villageSize,                            sub:'unique supporters' },
    { icon:<IcTrophy/>,  label:'Top supporter',         val:topCoord?.[0]||'—',                    sub:topCoord?`${topCoord[1]} meal${topCoord[1]!==1?'s':''}`:'' },
    { icon:<IcCutlery/>, label:'Favorite restaurant',   val:favRest?.[0]||'—',                     sub:favRest?`${favRest[1]} time${favRest[1]!==1?'s':''}`:'' },
    { icon:<IcBolt/>,    label:'Streak',                val:streak>0?`${streak} week${streak!==1?'s':''}` :'—', sub:streak>0?'consecutive weeks':'no streak yet' },
  ]

  return (
    <div style={{ padding:'16px 20px' }}>
      <p style={{ fontFamily:"'Lora',serif",fontSize:20,fontWeight:500,color:S.forest,margin:'0 0 4px',letterSpacing:-0.5 }}>Your Village</p>
      <p style={{ fontSize:13,color:S.stone,fontWeight:300,margin:'0 0 20px' }}>How {kitchenName?.split("'")[0]||'your kitchen'} is being supported.</p>
      <div style={{ background:S.forest,borderRadius:18,padding:'22px 20px',marginBottom:16,textAlign:'center' }}>
        <p style={{ fontSize:11,fontWeight:600,color:S.sageMid,letterSpacing:'0.1em',textTransform:'uppercase',margin:'0 0 8px' }}>Time back in your day</p>
        <div style={{ fontFamily:"'Lora',serif",fontSize:48,fontWeight:500,color:S.white,lineHeight:1,margin:'0 0 6px' }}>{totalHours}</div>
        <p style={{ fontSize:16,color:S.sageMid,fontWeight:300,margin:'0 0 8px' }}>hours saved</p>
        {totalMeals>0&&(
          <p style={{ fontSize:13,color:'rgba(255,255,255,0.5)',fontWeight:300,margin:0,lineHeight:1.6 }}>
            That's nearly {workweeks} full work week{parseFloat(workweeks)!==1?'s':''} back with your family.
          </p>
        )}
        <div style={{ display:'flex',justifyContent:'center',gap:20,marginTop:16,paddingTop:16,borderTop:'0.5px solid rgba(255,255,255,0.1)' }}>
          {[{label:'Prep',mins:30},{label:'Cook',mins:45},{label:'Clean',mins:20}].map(item=>(
            <div key={item.label} style={{ textAlign:'center' }}>
              <div style={{ fontSize:16,fontWeight:600,color:S.white }}>{totalMeals*item.mins}</div>
              <div style={{ fontSize:10,color:'rgba(255,255,255,0.4)',fontWeight:300 }}>{item.label} min</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display:'flex',flexDirection:'column',gap:10 }}>
        {stats.map(s=>(
          <div key={s.label} style={{ background:S.white,border:`0.5px solid ${S.border}`,borderRadius:14,padding:'14px 16px',display:'flex',alignItems:'center',gap:14 }}>
            <div style={{ width:28,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center' }}>{s.icon}</div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:11,fontWeight:600,color:S.stone,letterSpacing:'0.06em',textTransform:'uppercase',marginBottom:3 }}>{s.label}</div>
              <div style={{ fontFamily:"'Lora',serif",fontSize:16,fontWeight:500,color:S.forest }}>{s.val}</div>
              {s.sub&&<div style={{ fontSize:11,color:S.stone,fontWeight:300,marginTop:1 }}>{s.sub}</div>}
            </div>
          </div>
        ))}
      </div>
      {totalMeals===0&&(
        <div style={{ marginTop:20,background:S.sageLight,borderRadius:14,padding:'20px',textAlign:'center' }}>
          <p style={{ fontSize:14,color:S.sage,margin:0,lineHeight:1.7 }}>Once your village starts sending meals, your insights will appear here.</p>
        </div>
      )}
    </div>
  )
}
// ── SHARE TAB ─────────────────────────────────────────────────────────────────
function ShareTab({ kitchenUrl, kitchen, restaurantCount, router, proposals }: { kitchenUrl: string; kitchen: Kitchen; restaurantCount: number | null; router: any; proposals: Proposal[] }) {
  const [copied,  setCopied]  = useState(false)
  const [thanked, setThanked] = useState<string | null>(null)

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(kitchenUrl) } catch {
      const ta=document.createElement('textarea');ta.value=kitchenUrl;ta.style.cssText='position:fixed;opacity:0'
      document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta)
    }
    setCopied(true); setTimeout(()=>setCopied(false),2500)
  }
  const shareNative = async () => {
    if(navigator.share){ try { await navigator.share({title:kitchen.name,text:'Send me a meal through YourKitchen 🧡',url:kitchenUrl}) } catch {} }
    else { copyLink() }
  }

  // Monochrome social SVGs — same stroke weight as rest of app
  const sv = { strokeWidth:'1.7', strokeLinecap:'round' as const, strokeLinejoin:'round' as const, fill:'none' }
  const SvgWA = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" stroke={S.stone} {...sv}/></svg>
  const SvgFB = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" stroke={S.stone} {...sv}/></svg>
  const SvgX  = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke={S.stone} strokeWidth="2.2" strokeLinecap="round"/></svg>
  const SvgLI = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4V9h4v2" stroke={S.stone} {...sv}/><rect x="2" y="9" width="4" height="12" stroke={S.stone} {...sv}/><circle cx="4" cy="4" r="2" stroke={S.stone} {...sv}/></svg>

  const socials = [
    { icon:<SvgWA/>, label:'WhatsApp',    action:()=>{ const t=`My village has a way to show up for me now 🧡\n\nSend my family a meal through YourKitchen:\n${kitchenUrl}`; window.open(`https://wa.me/?text=${encodeURIComponent(t)}`,'_blank') } },
    { icon:<SvgFB/>, label:'Facebook',    action:()=>{ window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(kitchenUrl)}`,'_blank') } },
    { icon:<SvgX/>,  label:'Twitter / X', action:()=>{ const t=`My village has a way to show up for us now 🧡 Send my family a meal — no app needed. #YourKitchen`; window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(t)}&url=${encodeURIComponent(kitchenUrl)}`,'_blank') } },
    { icon:<SvgLI/>, label:'LinkedIn',    action:()=>{ window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(kitchenUrl)}`,'_blank') } },
  ]

  // No restaurants yet
  if (restaurantCount === 0) {
    return (
      <div style={{ padding:'16px 20px' }}>
        <p style={{ fontFamily:"'Lora',serif",fontSize:20,fontWeight:500,color:S.forest,margin:'0 0 4px',letterSpacing:-0.5 }}>Share Your Kitchen</p>
        <p style={{ fontSize:13,color:S.stone,fontWeight:300,margin:'0 0 20px',lineHeight:1.6 }}>One quick step before your link is ready.</p>
        <div style={{ background:S.white,border:`1.5px solid ${S.amber}`,borderRadius:16,padding:'22px 20px',textAlign:'center' }}>
          <div style={{ width:52,height:52,borderRadius:14,background:S.amberLight,display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,margin:'0 auto 14px' }}>🏪</div>
          <p style={{ fontFamily:"'Lora',serif",fontSize:17,fontWeight:600,color:S.forest,margin:'0 0 6px' }}>Add one restaurant to start sharing</p>
          <p style={{ fontSize:13,color:S.stone,fontWeight:300,margin:'0 0 18px',lineHeight:1.6 }}>Your village needs at least one place to order from. Add a favorite and your link goes live right away.</p>
          <button onClick={()=>router.push('/kitchen/restaurants')} style={{ padding:'12px 24px',background:S.forest,color:S.white,border:'none',borderRadius:10,fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:"'DM Sans',sans-serif" }}>Add a restaurant →</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding:'16px 20px' }}>
      <p style={{ fontFamily:"'Lora',serif",fontSize:20,fontWeight:500,color:S.forest,margin:'0 0 4px',letterSpacing:-0.5 }}>Share Your Kitchen</p>
      <p style={{ fontSize:13,color:S.stone,fontWeight:300,margin:'0 0 20px',lineHeight:1.6 }}>Let your village know you're open for support.</p>

      {/* ── Copy link ── */}
      <div style={{ background:S.white,border:`0.5px solid ${S.border}`,borderRadius:16,padding:'16px 18px',marginBottom:12 }}>
        <p style={{ fontSize:10,fontWeight:700,color:S.stone,letterSpacing:'0.1em',textTransform:'uppercase',margin:'0 0 8px' }}>Your Link</p>
        <div style={{ fontFamily:'monospace',fontSize:13,color:S.sage,marginBottom:12,wordBreak:'break-all',lineHeight:1.5 }}>{kitchenUrl}</div>
        <div style={{ display:'flex',gap:8 }}>
          <button onClick={copyLink} style={{ flex:1,padding:'12px',background:copied?S.sage:S.forest,color:S.white,border:'none',borderRadius:10,fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",transition:'background 0.2s',minHeight:44 }}>
            {copied?'✓ Copied!':'Copy Link'}
          </button>
          <button onClick={shareNative} style={{ padding:'12px 20px',background:S.sageLight,color:S.sage,border:'none',borderRadius:10,fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",minHeight:44 }}>Share</button>
        </div>
      </div>

      {/* ── Social share ── */}
      <div style={{ background:S.white,border:`0.5px solid ${S.border}`,borderRadius:16,padding:'16px 18px',marginBottom:12 }}>
        <p style={{ fontSize:10,fontWeight:700,color:S.stone,letterSpacing:'0.1em',textTransform:'uppercase',margin:'0 0 14px' }}>Share to</p>
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:8 }}>
          {socials.map(s=>(
            <button key={s.label} onClick={s.action}
              style={{ display:'flex',alignItems:'center',gap:10,padding:'12px 14px',borderRadius:10,border:`0.5px solid ${S.border}`,background:S.white,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",textAlign:'left',minHeight:44 }}>
              {s.icon}
              <span style={{ fontSize:13,fontWeight:500,color:S.forest }}>{s.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Gratitude share (only when meals exist) ── */}
      {(()=>{
        const kindActs=proposals.filter(p=>['confirmed','delivered'].includes(p.status)&&p.coordinator_name).slice(0,5)
        if(kindActs.length===0) return null
        const firstName=kitchen.name?.split("'")[0]||'us'
        return (
          <div style={{ background:S.white,border:`0.5px solid ${S.border}`,borderRadius:16,padding:'16px 18px' }}>
            <p style={{ fontSize:10,fontWeight:700,color:S.stone,letterSpacing:'0.1em',textTransform:'uppercase',margin:'0 0 6px' }}>Share a thank-you</p>
            <p style={{ fontSize:12,color:S.stone,fontWeight:300,margin:'0 0 14px',lineHeight:1.5 }}>Let the world see how your village showed up for you.</p>
            <div style={{ display:'flex',flexDirection:'column',gap:10 }}>
              {kindActs.map(p=>{
                const meal=p.meal_name||'a meal',rest=p.restaurant_name||'',who=p.coordinator_name
                const msg=`${who} sent ${firstName} ${meal}${rest?` from ${rest}`:''} today 🧡 So grateful for the people who show up. #YourKitchen`
                const isThanked=thanked===p.id
                return (
                  <div key={p.id} style={{ border:`0.5px solid ${S.border}`,borderRadius:12,padding:'12px 14px',background:S.cream }}>
                    <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:10 }}>
                      <div style={{ width:34,height:34,borderRadius:10,background:S.sage,display:'flex',alignItems:'center',justifyContent:'center',color:S.white,fontSize:14,fontWeight:700,flexShrink:0 }}>{who.charAt(0).toUpperCase()}</div>
                      <div style={{ flex:1,minWidth:0 }}>
                        <div style={{ fontSize:13,fontWeight:600,color:S.forest }}>{who}</div>
                        <div style={{ fontSize:11,color:S.stone,fontWeight:300,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{meal}{rest?` · ${rest}`:''}</div>
                      </div>
                    </div>
                    <div style={{ display:'flex',gap:6 }}>
                      <button onClick={()=>window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(kitchenUrl)}`,'_blank')} style={{ flex:1,padding:'8px',borderRadius:8,border:`0.5px solid ${S.border}`,background:S.white,color:S.forest,fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",display:'flex',alignItems:'center',justifyContent:'center',gap:6 }}><SvgFB/> Share</button>
                      <button onClick={()=>window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(msg)}`,'_blank')} style={{ flex:1,padding:'8px',borderRadius:8,border:`0.5px solid ${S.border}`,background:S.white,color:S.forest,fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",display:'flex',alignItems:'center',justifyContent:'center',gap:6 }}><SvgX/> Post</button>
                      <button onClick={async()=>{ if(navigator.share){try{await navigator.share({text:msg})}catch{}} else{try{await navigator.clipboard.writeText(msg)}catch{}}; setThanked(p.id);setTimeout(()=>setThanked(null),2000) }} style={{ flex:1,padding:'8px',borderRadius:8,border:`0.5px solid ${S.border}`,background:S.white,color:isThanked?S.sage:S.forest,fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:"'DM Sans',sans-serif" }}>
                        {isThanked?'✓':'More'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}
    </div>
  )
}
// ── VILLAGE TAB ───────────────────────────────────────────────────────────────
function VillageTab({ kitchen, villagePosts, proposals, onPostUpdate }: { kitchen: Kitchen; villagePosts: VillagePost[]; proposals: Proposal[]; onPostUpdate: () => void }) {
  const [newPost, setNewPost]     = useState('')
  const [posting, setPosting]     = useState(false)
  const [photo, setPhoto]         = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [replyTo, setReplyTo]     = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const recipientFirst = kitchen.name?.split(/[\s']/)[0] || 'You'

  const uniqueCoords = Object.values(
    proposals.reduce((acc:any, p) => {
      if(p.coordinator_name&&!acc[p.coordinator_name]) acc[p.coordinator_name]={name:p.coordinator_name,count:0}
      if(p.coordinator_name&&['confirmed','delivered'].includes(p.status)) acc[p.coordinator_name].count++
      return acc
    }, {})
  ) as any[]

  const fmt = (s:string) => {
    const d = new Date(s), now = new Date()
    const diffH = Math.floor((now.getTime()-d.getTime())/3600000)
    if(diffH<1) return 'Just now'
    if(diffH<24) return `${diffH}h ago`
    if(diffH<48) return 'Yesterday'
    return d.toLocaleDateString('en-US',{month:'short',day:'numeric'})
  }

  const pickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 5*1024*1024) { alert('Please choose an image under 5 MB.'); return }
    setPhoto(f)
    setPhotoPreview(URL.createObjectURL(f))
  }
  const clearPhoto = () => { setPhoto(null); setPhotoPreview(null); if(fileRef.current) fileRef.current.value='' }

  const submitPost = async () => {
    if((!newPost.trim()&&!photo)||!kitchen?.id) return
    setPosting(true)
    let image_url: string | null = null
    try {
      if (photo) {
        const fd = new FormData()
        fd.append('file', photo)
        fd.append('kitchen_id', kitchen.id)
        const up = await fetch('/api/village-photo-upload', { method:'POST', body: fd })
        const upJson = await up.json()
        if (upJson.url) image_url = upJson.url
        else { alert(upJson.error || 'Photo upload failed.'); setPosting(false); return }
      }
      const res = await fetch('/api/village-posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kitchen_id: kitchen.id,
          content: newPost.trim(),
          author_name: recipientFirst,
          author_type: 'recipient',
          image_url,
        }),
      })
      const postJson = await res.json().catch(() => ({}))
      if (!res.ok || postJson.error) {
        alert(postJson.error || 'Could not post to your village. Please try again.')
        setPosting(false)
        return
      }
      setNewPost(''); clearPhoto()
      onPostUpdate()
    } finally { setPosting(false) }
  }

  const submitReply = async (parentId: string) => {
    if(!replyText.trim()||!kitchen?.id) return
    await fetch('/api/village-posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kitchen_id: kitchen.id,
        content: replyText.trim(),
        author_name: recipientFirst,
        author_type: 'recipient',
        parent_id: parentId,
      }),
    })
    setReplyText(''); setReplyTo(null); onPostUpdate()
  }

  const react = async (postId: string, emoji: string) => {
    await fetch('/api/village-posts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ post_id: postId, emoji }),
    })
    onPostUpdate()
  }

  const removePost = async (postId: string) => {
    if(!confirm('Remove this from your board?')) return
    await fetch('/api/village-posts', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ post_id: postId, kitchen_id: kitchen.id }),
    })
    onPostUpdate()
  }

  const REACTIONS = ['🧡','👍','😊','🙏']

  const PostCard = ({ post, isReply }: { post: VillagePost; isReply?: boolean }) => {
    const isRecipient = post.author_type==='recipient'
    const isSystem    = post.post_type==='system'
    const authorName  = post.author_name || (isRecipient?recipientFirst:'A supporter')
    const avatarBg    = isSystem ? S.sageLight : isRecipient ? S.sage : S.amber
    const avatarColor = isSystem ? S.sage : S.white
    return (
      <div style={{ background:S.white,border:`0.5px solid ${isSystem?'#DDE8E0':isRecipient?S.border:'#E0C89A'}`,borderRadius:14,padding:'13px 15px',marginBottom:isReply?8:10,marginLeft:isReply?20:0 }}>
        <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:post.content||post.image_url?8:0 }}>
          <div style={{ width:isReply?26:30,height:isReply?26:30,borderRadius:9,background:avatarBg,display:'flex',alignItems:'center',justifyContent:'center',color:avatarColor,fontSize:12,fontWeight:700,flexShrink:0 }}>
            {(authorName||'?').charAt(0).toUpperCase()}
          </div>
          <div style={{ flex:1,minWidth:0 }}>
            <div style={{ fontSize:13,fontWeight:600,color:S.forest }}>{authorName}</div>
            <div style={{ fontSize:11,color:S.stone,fontWeight:300 }}>
              {isSystem?'Meal delivered':isRecipient?'Update':'From your village'} · {fmt(post.posted_at)}
            </div>
          </div>
          {isRecipient && !isSystem && (
            <button onClick={()=>removePost(post.id)} title="Remove"
              style={{ background:'none',border:'none',cursor:'pointer',color:S.stone,fontSize:14,padding:'2px 4px',flexShrink:0,opacity:0.5 }}>✕</button>
          )}
        </div>
        {post.content && <p style={{ fontSize:14,color:S.forest,margin:'0 0 8px',lineHeight:1.6 }}>{post.content}</p>}
        {post.image_url && (
          <img src={post.image_url} alt="" style={{ width:'100%',borderRadius:10,marginBottom:8,display:'block',maxHeight:320,objectFit:'cover' }}/>
        )}
        {/* Reactions row */}
        <div style={{ display:'flex',alignItems:'center',gap:6,flexWrap:'wrap',marginTop:4 }}>
          {post.reactions && Object.entries(post.reactions).filter(([,n])=>n>0).map(([emoji,n])=>(
            <button key={emoji} onClick={()=>react(post.id,emoji)}
              style={{ display:'flex',alignItems:'center',gap:3,background:S.sageLight,border:'none',borderRadius:20,padding:'3px 9px',cursor:'pointer',fontSize:12,fontFamily:"'DM Sans',sans-serif" }}>
              <span>{emoji}</span><span style={{ color:S.sage,fontWeight:600,fontSize:11 }}>{n}</span>
            </button>
          ))}
          <div style={{ display:'flex',gap:2 }}>
            {REACTIONS.map(e=>(
              <button key={e} onClick={()=>react(post.id,e)} title="React"
                style={{ background:'none',border:'none',cursor:'pointer',fontSize:14,padding:'2px 3px',opacity:0.55,lineHeight:1 }}>{e}</button>
            ))}
          </div>
          {!isReply && (
            <button onClick={()=>{ setReplyTo(replyTo===post.id?null:post.id); setReplyText('') }}
              style={{ marginLeft:'auto',background:'none',border:'none',cursor:'pointer',fontSize:12,color:S.stone,fontWeight:500,fontFamily:"'DM Sans',sans-serif" }}>
              {replyTo===post.id?'Cancel':'Reply'}
            </button>
          )}
        </div>
        {/* Reply composer */}
        {replyTo===post.id && (
          <div style={{ marginTop:10,display:'flex',gap:6 }}>
            <input value={replyText} onChange={e=>setReplyText(e.target.value)}
              placeholder="Write a reply…" autoFocus
              onKeyDown={e=>{ if(e.key==='Enter') submitReply(post.id) }}
              style={{ flex:1,borderRadius:9,border:`1.5px solid ${S.border}`,padding:'9px 12px',fontSize:14,fontFamily:"'DM Sans',sans-serif",color:S.forest,background:S.cream,outline:'none',boxSizing:'border-box' }}/>
            <button onClick={()=>submitReply(post.id)} disabled={!replyText.trim()}
              style={{ padding:'9px 16px',borderRadius:9,border:'none',background:!replyText.trim()?S.border:S.sage,color:!replyText.trim()?S.stone:S.white,fontSize:13,fontWeight:600,cursor:!replyText.trim()?'default':'pointer',fontFamily:"'DM Sans',sans-serif",minHeight:40 }}>Send</button>
          </div>
        )}
        {/* Replies */}
        {post.replies && post.replies.length>0 && (
          <div style={{ marginTop:10 }}>
            {post.replies.map(r=><PostCard key={r.id} post={r} isReply/>)}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ padding:'16px 20px' }}>
      <p style={{ fontFamily:"'Lora',serif",fontSize:20,fontWeight:500,color:S.forest,margin:'0 0 4px',letterSpacing:-0.5 }}>Your Village</p>
      <p style={{ fontSize:13,color:S.stone,fontWeight:300,margin:'0 0 20px',lineHeight:1.6 }}>A shared board for your village — meals that arrived, notes, and photos. Post an update or reply to say thanks.</p>

      {/* Composer */}
      <div style={{ background:S.white,border:`0.5px solid ${S.border}`,borderRadius:16,padding:'16px',marginBottom:20 }}>
        <p style={{ fontSize:10,fontWeight:700,color:S.stone,letterSpacing:'0.1em',textTransform:'uppercase',margin:'0 0 10px' }}>Share an update</p>
        <textarea value={newPost} onChange={e=>setNewPost(e.target.value)}
          placeholder="Got the meal — it was perfect, thank you 🧡 Kendrick slept 6 hours last night…"
          style={{ width:'100%',minHeight:72,borderRadius:10,border:`1.5px solid ${S.border}`,padding:'10px 12px',fontSize:14,fontFamily:"'DM Sans',sans-serif",color:S.forest,background:S.cream,resize:'none',outline:'none',boxSizing:'border-box',lineHeight:1.6,marginBottom:10 }}/>
        {photoPreview && (
          <div style={{ position:'relative',marginBottom:10 }}>
            <img src={photoPreview} alt="" style={{ width:'100%',borderRadius:10,display:'block',maxHeight:240,objectFit:'cover' }}/>
            <button onClick={clearPhoto}
              style={{ position:'absolute',top:8,right:8,background:'rgba(30,38,32,0.7)',color:S.white,border:'none',borderRadius:'50%',width:28,height:28,cursor:'pointer',fontSize:14,display:'flex',alignItems:'center',justifyContent:'center' }}>✕</button>
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={pickPhoto} style={{ display:'none' }}/>
        <div style={{ display:'flex',gap:8 }}>
          <button onClick={()=>fileRef.current?.click()}
            style={{ padding:'11px 14px',borderRadius:9,border:`1px solid ${S.border}`,background:S.white,color:S.stone,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",display:'flex',alignItems:'center',gap:6,minHeight:44 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" stroke={S.stone} strokeWidth="1.7"/><circle cx="8.5" cy="8.5" r="1.5" fill={S.stone}/><path d="M21 15l-5-5L5 21" stroke={S.stone} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Photo
          </button>
          <button onClick={submitPost} disabled={(!newPost.trim()&&!photo)||posting}
            style={{ flex:1,padding:'11px',borderRadius:9,border:'none',background:(!newPost.trim()&&!photo)?S.border:S.forest,color:(!newPost.trim()&&!photo)?S.stone:S.white,fontSize:14,fontWeight:600,cursor:(!newPost.trim()&&!photo)?'default':'pointer',fontFamily:"'DM Sans',sans-serif",minHeight:44 }}>
            {posting?'Posting…':'Post to your village 🧡'}
          </button>
        </div>
      </div>

      {/* Feed */}
      {villagePosts.length>0&&(
        <div style={{ marginBottom:24 }}>
          <p style={sLabel}>The board</p>
          {villagePosts.map(post=><PostCard key={post.id} post={post}/>)}
        </div>
      )}

      {/* Village roster */}
      {uniqueCoords.length>0&&(
        <div>
          <p style={sLabel}>Your Village ({uniqueCoords.length})</p>
          {uniqueCoords.map((coord:any)=>(
            <div key={coord.name} style={{ background:S.white,border:`0.5px solid ${S.border}`,borderRadius:12,padding:'12px 16px',display:'flex',alignItems:'center',gap:12,marginBottom:8 }}>
              <div style={{ width:36,height:36,borderRadius:11,background:S.sageLight,display:'flex',alignItems:'center',justifyContent:'center',color:S.sage,fontSize:15,fontWeight:700,flexShrink:0 }}>
                {coord.name.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13,fontWeight:600,color:S.forest }}>{coord.name}</div>
                <div style={{ fontSize:11,color:S.stone,fontWeight:300 }}>{coord.count>0?`${coord.count} meal${coord.count!==1?'s':''} sent`:'Invited'}</div>
              </div>
              {coord.count>0&&<span style={{ background:S.sageLight,color:S.sage,fontSize:11,fontWeight:700,padding:'3px 10px',borderRadius:20 }}>🧡</span>}
            </div>
          ))}
        </div>
      )}

      {villagePosts.length===0&&uniqueCoords.length===0&&(
        <div style={{ background:S.sageLight,borderRadius:14,padding:'20px',textAlign:'center' }}>
          <p style={{ fontSize:14,color:S.sage,margin:0,lineHeight:1.7 }}>Your board comes to life once your village starts sending meals. 🧡</p>
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

  const [activeTab,     setActiveTab]     = useState<Tab>('home')
  const [drawerOpen,    setDrawerOpen]    = useState(false)
  const [notifOpen,     setNotifOpen]     = useState(false)
  const [loading,       setLoading]       = useState(true)
  const [isRefreshing,  setIsRefreshing]  = useState(false)   // ← NEW
  const [pullDistance,  setPullDistance]  = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const touchStartY = useRef(0)
  const pulling = useRef(false)
  const [fullName,      setFullName]      = useState('')
  const [userTier,      setUserTier]      = useState('free')
  const [kitchen,       setKitchen]       = useState<Kitchen | null>(null)
  const [calDates,      setCalDates]      = useState<CalDate[]>([])
  const [allProposals,  setAllProposals]  = useState<Proposal[]>([])
  const [villagePosts,  setVillagePosts]  = useState<VillagePost[]>([])
  const [kitchenUrl,    setKitchenUrl]    = useState('')
  const [restaurantCount, setRestaurantCount] = useState<number | null>(null)
  const [selectedDate,  setSelectedDate]  = useState<string | null>(null)
  const [adding,        setAdding]        = useState(false)
  const [addError,      setAddError]      = useState('')

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
    try {
      const res = await fetch(`/api/village-posts?kitchen_id=${kitchenId}`)
      const json = await res.json()
      setVillagePosts(json.posts || [])
    } catch {
      setVillagePosts([])
    }
  }, [])

  // ── Initial load ────────────────────────────────────────────────────────────
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
        const { count } = await supabase
          .from('kitchen_restaurants')
          .select('id', { count: 'exact', head: true })
          .eq('kitchen_id', k.id)
          .eq('is_active', true)
        setRestaurantCount(count ?? 0)
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

  // ── Realtime subscription + 30-second polling fallback ──────────────────────
  // Realtime needs: ALTER PUBLICATION supabase_realtime ADD TABLE meal_proposals;
  useEffect(() => {
    if (!kitchen?.id) return

    // Subscribe to real-time changes
    const ch = supabase.channel(`proposals-${kitchen.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'meal_proposals',
        filter: `kitchen_id=eq.${kitchen.id}`
      }, () => loadProposals(kitchen.id))
      .subscribe()

    // 30-second polling fallback — keeps bell current if WebSocket drops (especially on mobile)
    const poll = setInterval(() => loadProposals(kitchen.id), 30000)

    return () => {
      supabase.removeChannel(ch)
      clearInterval(poll)
    }
  }, [kitchen?.id])

  // ── Manual refresh ──────────────────────────────────────────────────────────
  const handleRefresh = useCallback(async () => {
    if (!kitchen?.id || isRefreshing) return
    setIsRefreshing(true)
    await Promise.all([
      loadProposals(kitchen.id),
      loadCalDates(kitchen.id),
      loadVillagePosts(kitchen.id),
    ])
    setIsRefreshing(false)
  }, [kitchen?.id, isRefreshing, loadProposals, loadCalDates, loadVillagePosts])

  // ── Pull-to-refresh (mobile) ─────────────────────────────────────────────────
  const PULL_THRESHOLD = 70
  const onTouchStart = (e: React.TouchEvent) => {
    const el = scrollRef.current
    if (el && el.scrollTop <= 0) { touchStartY.current = e.touches[0].clientY; pulling.current = true }
  }
  const onTouchMove = (e: React.TouchEvent) => {
    if (!pulling.current || isRefreshing) return
    const dy = e.touches[0].clientY - touchStartY.current
    if (dy > 0) {
      const damped = Math.min(dy * 0.5, PULL_THRESHOLD + 20)
      setPullDistance(damped)
    }
  }
  const onTouchEnd = async () => {
    if (!pulling.current) return
    pulling.current = false
    if (pullDistance >= PULL_THRESHOLD) { await handleRefresh() }
    setPullDistance(0)
  }

  // ── Calendar handlers ───────────────────────────────────────────────────────
  const handleAddSlot = async (mealType: string) => {
    if (!kitchen || !selectedDate) return
    setAdding(true); setAddError('')
    const res  = await fetch('/api/calendar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kitchen_id: kitchen.id, date: selectedDate, meal_type: mealType }),
    })
    const data = await res.json()
    if (!res.ok) { setAddError(data.error || 'Could not add slot'); setAdding(false); return }
    await loadCalDates(kitchen.id); setAdding(false)
  }

  const handleRemoveSlot = async (dateId: string) => {
    await fetch('/api/calendar', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date_id: dateId }) })
    if (kitchen) await loadCalDates(kitchen.id)
  }

  const signOut = async () => { await supabase.auth.signOut(); router.push('/login') }

  // ── Share kitchen link (native share sheet → clipboard fallback) ─────────────
  const handleShare = useCallback(async () => {
    const url = kitchenUrl || (typeof window !== 'undefined' ? `${window.location.origin}/k/${kitchen?.slug || ''}` : '')
    if (!url) return
    const fn = (fullName || '').split(' ')[0] || 'their family'
    const shareText = `Help bring meals to ${fn}'s family — pick a date and send a meal through their YourKitchen:`
    if (typeof navigator !== 'undefined' && (navigator as any).share) {
      try {
        await (navigator as any).share({ title: `${fn}'s Kitchen`, text: shareText, url })
        return
      } catch { /* user cancelled — fall through to clipboard */ }
    }
    try {
      await navigator.clipboard.writeText(url)
      alert('Kitchen link copied! Share it with your village.')
    } catch {
      alert(`Share this link with your village:\n\n${url}`)
    }
  }, [kitchenUrl, kitchen?.slug, fullName])

  // ── Derived counts ──────────────────────────────────────────────────────────
  const pendingCount = allProposals.filter(p => p.status === 'pending').length
  const activeCount  = allProposals.filter(p => p.status === 'confirmed' && p.doordash_status !== 'cancelled').length
  const badgeCount   = pendingCount + activeCount
  const tier         = TIER_META[userTier] || TIER_META.free
  const firstName    = (fullName || '').split(' ')[0] || 'there'

  if (loading) return (
    <div style={{ minHeight:'100vh',background:S.cream,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:16,fontFamily:"'DM Sans',sans-serif" }}>
      <svg width="44" height="44" viewBox="0 0 44 44" fill="none" aria-label="Loading">
        <circle cx="22" cy="22" r="19" stroke={S.sageLight} strokeWidth="3" />
        <path d="M22 3 a19 19 0 0 1 19 19" stroke={S.sage} strokeWidth="3" strokeLinecap="round">
          <animateTransform attributeName="transform" type="rotate" from="0 22 22" to="360 22 22" dur="0.8s" repeatCount="indefinite" />
        </path>
      </svg>
      <p style={{ color:S.stone,fontSize:13,fontWeight:300 }}>Loading your Kitchen…</p>
    </div>
  )

  return (
    <div style={{ display:'flex',flexDirection:'column',height:'100vh',background:S.cream,fontFamily:"'DM Sans',sans-serif",overflow:'hidden' }}>
      <link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet"/>

      {drawerOpen && <Drawer name={fullName} tier={tier} kitchenUrl={kitchenUrl} recipientName={firstName} onClose={()=>setDrawerOpen(false)} onSignOut={signOut} onShare={handleShare} onRefresh={handleRefresh} router={router}/>}
      {notifOpen  && <NotifPanel proposals={allProposals} onClose={()=>setNotifOpen(false)} router={router}/>}

      {/* Top Bar */}
      <div style={{ background:S.forest,padding:'14px 20px',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0,paddingTop:'calc(14px + env(safe-area-inset-top, 0px))' }}>

        {/* Hamburger */}
        <button onClick={()=>setDrawerOpen(true)}
          style={{ background:'none',border:'none',cursor:'pointer',padding:'10px 8px',display:'flex',flexDirection:'column',gap:4,justifyContent:'center',minWidth:44,minHeight:44,alignItems:'center' }}>
          <div style={{ width:20,height:2,background:S.white,borderRadius:2 }}/>
          <div style={{ width:14,height:2,background:S.white,borderRadius:2 }}/>
          <div style={{ width:18,height:2,background:S.white,borderRadius:2 }}/>
        </button>

        {/* Kitchen name */}
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:8,fontWeight:500,letterSpacing:5,color:S.sageMid,textTransform:'uppercase',lineHeight:1 }}>Your</div>
          <div style={{ fontFamily:"'Lora',serif",fontSize:18,fontWeight:500,color:S.white,letterSpacing:-0.5,lineHeight:1.2 }}>
            {kitchen?.name || `${firstName}'s Kitchen`}
          </div>
        </div>

        {/* Right side: bell */}
        <div style={{ display:'flex',alignItems:'center',gap:2 }}>

          {/* 🔔 Notification bell */}
          <button onClick={()=>setNotifOpen(o=>!o)}
            style={{ background:'none',border:'none',cursor:'pointer',position:'relative',padding:'10px 8px',minWidth:44,minHeight:44,display:'flex',alignItems:'center',justifyContent:'center' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="white" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/><path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="white" strokeWidth="1.75" strokeLinecap="round"/></svg>
            {badgeCount > 0 && (
              <div style={{ position:'absolute',top:0,right:0,background:S.amber,color:S.white,borderRadius:'50%',width:16,height:16,display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:700 }}>
                {badgeCount > 9 ? '9+' : badgeCount}
              </div>
            )}
          </button>
        </div>
      </div>

      {/* No kitchen */}
      {!kitchen ? (
        <div style={{ flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:24 }}>
          <div style={{ background:S.forest,borderRadius:20,padding:'32px',textAlign:'center',maxWidth:320 }}>
            <div style={{ fontSize:48,marginBottom:14 }}>🥗</div>
            <h2 style={{ fontFamily:"'Lora',serif",fontSize:22,fontWeight:500,color:S.white,margin:'0 0 10px' }}>Set up your Kitchen</h2>
            <p style={{ fontSize:14,color:'rgba(255,255,255,0.65)',fontWeight:300,lineHeight:1.7,margin:'0 0 22px' }}>Add restaurants, set your calendar, and share your link.</p>
            <button onClick={()=>router.push('/onboarding')}
              style={{ background:S.sage,color:S.white,border:'none',borderRadius:12,padding:'13px 28px',fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:"'DM Sans',sans-serif" }}>
              Set Up My Kitchen →
            </button>
          </div>
        </div>
      ) : (
        <>
          <div ref={scrollRef} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
            style={{ flex:1,overflowY:'auto',paddingBottom:60,position:'relative' }}>
            {(pullDistance > 0 || isRefreshing) && (
              <div style={{ height:isRefreshing?40:pullDistance, display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',transition:isRefreshing?'height 0.2s':'none' }}>
                <span style={{ fontSize:15,opacity:0.6,transform:`rotate(${pullDistance*3}deg)`,transition:isRefreshing?'none':'transform 0.1s' }}>
                  {isRefreshing ? '⏳' : pullDistance >= 70 ? '↻' : '↓'}
                </span>
              </div>
            )}
            {activeTab==='home'     && <HomeTab kitchen={kitchen} calDates={calDates} selectedDate={selectedDate} setSelectedDate={setSelectedDate} adding={adding} addError={addError} handleAddSlot={handleAddSlot} handleRemoveSlot={handleRemoveSlot} tier={tier} router={router} userTier={userTier} onShare={handleShare}/>}
            {activeTab==='activity' && <ActivityTab proposals={allProposals} router={router}/>}
            {activeTab==='insights' && <InsightsTab proposals={allProposals} kitchenName={kitchen.name}/>}
            {activeTab==='share'    && <ShareTab kitchenUrl={kitchenUrl} kitchen={kitchen} restaurantCount={restaurantCount} router={router} proposals={allProposals}/>}
            {activeTab==='village'  && <VillageTab kitchen={kitchen} villagePosts={villagePosts} proposals={allProposals} onPostUpdate={()=>loadVillagePosts(kitchen.id)}/>}
          </div>
          <BottomNav active={activeTab} set={(t) => { setActiveTab(t); if (scrollRef.current) scrollRef.current.scrollTop = 0 }} badge={badgeCount}/>
        </>
      )}
    </div>
  )
}

'use client'
// FILE: app/k/[slug]/client.tsx
// v5: Inline restaurant+meal selection, distance badges, dynamic tip defaults

import { useState, useEffect } from 'react'
import { haversineDistance, getTipTier } from '@/lib/distance'

const S = {
  sage: '#3D6B4F', sageMid: '#6B9E7E', sageLight: '#EAF2ED',
  cream: '#FAFAF5', forest: '#1E2620', stone: '#6B7066',
  border: '#DDE8E0', white: '#FFFFFF', amber: '#C17F47',
  amberLight: '#FBF0E4', red: '#B94040', redLight: '#FDE8E8',
}
const MEAL_TYPE_LABELS: Record<string, string> = {
  breakfast: '🌅 Breakfast', lunch: '☀️ Lunch', dinner: '🌙 Dinner',
}
const MEAL_TYPE_COLORS: Record<string, { color: string; bg: string }> = {
  breakfast: { color: '#E8834A', bg: '#FFF0E8' },
  lunch:     { color: '#4A8FA8', bg: '#E8F4F8' },
  dinner:    { color: S.sage,    bg: S.sageLight },
}
const DELIVERY_PREFS = [
  { value: 'leave_at_door',     icon: '🚪', title: 'Leave at door',  subtitle: 'Text when arrived — no knock' },
  { value: 'hand_to_recipient', icon: '🤝', title: 'Hand to me',     subtitle: 'Driver hands order directly' },
]

type FavRestaurant = {
  id: string; name: string; address: string | null
  place_id: string | null; lat: number | null; lng: number | null
  favorite_meals: string[]; favorite_meal_prices: number[]
}
type SelectedMeal  = { name: string; price: number; isCustom: boolean }
type GroupSelection = {
  mealType:   string
  slots:      any[]
  restaurant: FavRestaurant | null
  meal:       SelectedMeal | null
  customMeal: string
  customPrice: string
}

// ─────────────────────────────────────────────────────────────────────────────
function MealHistory({ meals, recipientFirstName }: { meals: any[]; recipientFirstName: string }) {
  const [expanded, setExpanded] = useState(false)
  if (!meals?.length) return null
  const sevenAgo  = new Date(Date.now() - 7*24*60*60*1000).toISOString().split('T')[0]
  const recent7   = meals.filter(m => m.delivery_date >= sevenAgo)
  const tally: Record<string,number> = {}
  meals.forEach(m => { tally[m.restaurant_name] = (tally[m.restaurant_name]||0)+1 })
  const sorted = Object.entries(tally).sort((a,b)=>b[1]-a[1])
  const max    = sorted[0]?.[1]||1
  const fmtD   = (d: string) => new Date(d+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})
  return (
    <div style={{ background:S.white,border:`1px solid ${S.border}`,borderRadius:14,marginBottom:20,overflow:'hidden' }}>
      <button onClick={()=>setExpanded(e=>!e)} style={{ width:'100%',padding:'14px 16px',display:'flex',alignItems:'center',justifyContent:'space-between',background:'none',border:'none',cursor:'pointer',fontFamily:"'DM Sans',sans-serif" }}>
        <div style={{ display:'flex',alignItems:'center',gap:10 }}>
          <span style={{ fontSize:16 }}>📋</span>
          <div style={{ textAlign:'left' }}>
            <div style={{ fontSize:13,fontWeight:600,color:S.forest }}>What {recipientFirstName} has received</div>
            <div style={{ fontSize:11,color:recent7.length?S.red:S.stone,fontWeight:300,marginTop:1 }}>
              {recent7.length>0?<span style={{ fontWeight:600 }}>{recent7.length} in last 7 days · tap to see</span>:`${meals.length} total · tap to see`}
            </div>
          </div>
        </div>
        <span style={{ fontSize:14,color:S.stone,transition:'transform 0.2s',transform:expanded?'rotate(180deg)':'none' }}>▾</span>
      </button>
      {expanded && (
        <div style={{ borderTop:`0.5px solid ${S.border}`,padding:'14px 16px' }}>
          {sorted.map(([name,count])=>(
            <div key={name} style={{ display:'flex',alignItems:'center',gap:10,marginBottom:7 }}>
              <span style={{ fontSize:12,color:S.forest,fontWeight:500,width:140,flexShrink:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{name}</span>
              <div style={{ flex:1,height:6,background:S.sageLight,borderRadius:3,overflow:'hidden' }}>
                <div style={{ height:'100%',background:S.sage,borderRadius:3,width:`${(count/max)*100}%` }}/>
              </div>
              <span style={{ fontSize:11,fontWeight:700,color:S.sage,width:20,textAlign:'right',flexShrink:0 }}>{count}×</span>
            </div>
          ))}
          {meals.map((m,i)=>{
            const mc=MEAL_TYPE_COLORS[m.meal_type]||MEAL_TYPE_COLORS.dinner
            const isRecent=m.delivery_date>=sevenAgo
            return (
              <div key={m.id} style={{ display:'flex',alignItems:'center',gap:10,padding:'9px 0',borderBottom:i<meals.length-1?`0.5px solid ${S.sageLight}`:'none' }}>
                <span style={{ background:mc.bg,color:mc.color,fontSize:9,fontWeight:700,padding:'2px 7px',borderRadius:20,flexShrink:0 }}>{MEAL_TYPE_LABELS[m.meal_type]?.split(' ')[1]||m.meal_type}</span>
                <div style={{ flex:1,overflow:'hidden' }}>
                  <div style={{ fontSize:12,fontWeight:500,color:S.forest,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{m.meal_name}</div>
                  <div style={{ fontSize:11,color:S.stone,fontWeight:300 }}>{m.restaurant_name}</div>
                </div>
                <div style={{ display:'flex',alignItems:'center',gap:6,flexShrink:0 }}>
                  {isRecent&&<span style={{ fontSize:9,fontWeight:700,background:S.redLight,color:S.red,borderRadius:20,padding:'2px 6px' }}>Recent</span>}
                  <span style={{ fontSize:11,color:S.stone,fontWeight:300 }}>{fmtD(m.delivery_date)}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function CoordCalendar({ availableDates,selectedIds,onToggle }: { availableDates:any[];selectedIds:Set<string>;onToggle:(s:any)=>void }) {
  const today=new Date()
  const [viewYear,setViewYear]=useState(today.getFullYear())
  const [viewMonth,setViewMonth]=useState(today.getMonth())
  const todayStr=today.toISOString().split('T')[0]
  const monthName=new Date(viewYear,viewMonth,1).toLocaleDateString('en-US',{month:'long',year:'numeric'})
  const firstDay=new Date(viewYear,viewMonth,1).getDay()
  const daysInMonth=new Date(viewYear,viewMonth+1,0).getDate()
  const prev=()=>{ if(viewMonth===0){setViewYear(y=>y-1);setViewMonth(11)}else setViewMonth(m=>m-1) }
  const next=()=>{ if(viewMonth===11){setViewYear(y=>y+1);setViewMonth(0)}else setViewMonth(m=>m+1) }
  const dateMap:Record<string,any[]>={}
  availableDates.forEach(d=>{ if(!dateMap[d.date])dateMap[d.date]=[];dateMap[d.date].push(d) })
  const cells:(number|null)[]=[]
  for(let i=0;i<firstDay;i++)cells.push(null)
  for(let d=1;d<=daysInMonth;d++)cells.push(d)
  return (
    <div style={{ background:S.white,border:`1px solid ${S.border}`,borderRadius:16,padding:'16px',marginBottom:20 }}>
      <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12 }}>
        <button onClick={prev} style={{ background:S.sageLight,border:'none',borderRadius:8,width:32,height:32,cursor:'pointer',fontSize:16,color:S.sage,display:'flex',alignItems:'center',justifyContent:'center' }}>‹</button>
        <p style={{ fontFamily:"'Lora',serif",fontSize:16,fontWeight:500,color:S.forest,margin:0 }}>{monthName}</p>
        <button onClick={next} style={{ background:S.sageLight,border:'none',borderRadius:8,width:32,height:32,cursor:'pointer',fontSize:16,color:S.sage,display:'flex',alignItems:'center',justifyContent:'center' }}>›</button>
      </div>
      <div style={{ display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:3,marginBottom:3 }}>
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d=><div key={d} style={{ textAlign:'center',fontSize:10,fontWeight:600,color:S.stone,padding:'3px 0' }}>{d}</div>)}
      </div>
      <div style={{ display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:3 }}>
        {cells.map((day,i)=>{
          if(!day)return<div key={i}/>
          const ds=`${viewYear}-${String(viewMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
          const isPast=ds<todayStr,isToday=ds===todayStr
          const slots=dateMap[ds]||[],has=slots.length>0
          const isSel=slots.some((s:any)=>selectedIds.has(s.id))
          return (
            <button key={i} onClick={()=>{ if(!has||isPast)return;slots.forEach((s:any)=>onToggle(s)) }} disabled={isPast||!has}
              style={{ background:isSel?S.sageLight:has?'#F8FAF8':'transparent',border:isToday?`2px solid ${S.sage}`:isSel?`2px solid ${S.sage}`:has?`1.5px solid ${S.border}`:`1.5px solid transparent`,borderRadius:10,padding:'8px 2px',minHeight:52,cursor:has&&!isPast?'pointer':'default',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:3,fontFamily:"'DM Sans',sans-serif",opacity:isPast?0.35:1,transition:'all 0.1s' }}>
              <span style={{ fontSize:13,fontWeight:isToday?700:500,color:isPast?'#C8D5CA':isSel?S.sage:S.forest,lineHeight:1 }}>{day}</span>
              {has&&<div style={{ display:'flex',gap:2 }}>{slots.map((s:any,si:number)=>{const mc=MEAL_TYPE_COLORS[s.meal_type]||MEAL_TYPE_COLORS.dinner;return<div key={si} style={{ width:6,height:6,borderRadius:'50%',background:selectedIds.has(s.id)?mc.color:'#C8D5CA' }}/>})}</div>}
            </button>
          )
        })}
      </div>
      <div style={{ display:'flex',gap:12,flexWrap:'wrap',marginTop:14,paddingTop:12,borderTop:`1px solid ${S.sageLight}` }}>
        {[{dot:'#E8834A',label:'Breakfast'},{dot:'#4A8FA8',label:'Lunch'},{dot:S.sage,label:'Dinner'},{dot:'#C8D5CA',label:'Not selected'}].map(({dot,label})=>(
          <div key={label} style={{ display:'flex',alignItems:'center',gap:5 }}>
            <div style={{ width:7,height:7,borderRadius:'50%',background:dot }}/>
            <span style={{ fontSize:11,color:S.stone,fontWeight:500 }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function CoordFooter() {
  return (
    <footer style={{ background:S.forest,padding:'48px 24px',textAlign:'center',marginTop:40,fontFamily:"'DM Sans',sans-serif" }}>
      <div style={{ fontSize:9,fontWeight:500,letterSpacing:5,color:S.sageMid,textTransform:'uppercase',marginBottom:2 }}>Your</div>
      <div style={{ fontFamily:"'Lora',serif",fontSize:24,fontWeight:500,color:S.white,letterSpacing:-0.5,marginBottom:8 }}>Kitchen</div>
      <p style={{ fontFamily:"'Lora',serif",fontStyle:'italic',fontSize:13,color:S.sageMid,margin:'0 0 16px' }}>"Your kitchen, covered."</p>
      <p style={{ fontSize:10,color:'rgba(255,255,255,0.18)',margin:0 }}>© 2026 YourKitchen LLC</p>
    </footer>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
export default function CoordKitchenClient({ kitchen, availableDates, recentMeals=[] }: any) {
  const [step,               setStep]               = useState<1|2|3>(1)
  const [selectedIds,        setSelectedIds]        = useState<Set<string>>(new Set())
  const [groups,             setGroups]             = useState<GroupSelection[]>([])
  const [currentGroupIdx,    setCurrentGroupIdx]    = useState(0)
  const [favorites,          setFavorites]          = useState<FavRestaurant[]>([])
  const [loadingFavs,        setLoadingFavs]        = useState(true)
  // Step 3 fields
  const [name,               setName]               = useState('')
  const [email,              setEmail]              = useState('')
  const [phone,              setPhone]              = useState('')
  const [note,               setNote]               = useState('')
  const [tipAmount,          setTipAmount]          = useState(300)
  const [tipInitialized,     setTipInitialized]     = useState(false)
  const [deliveryPreference, setDeliveryPreference] = useState<'leave_at_door'|'hand_to_recipient'>('leave_at_door')
  const [deliveryNote,       setDeliveryNote]       = useState('')
  const [loading,            setLoading]            = useState(false)
  const [errorMsg,           setErrorMsg]           = useState('')

  const sevenAgo        = new Date(Date.now()-7*24*60*60*1000).toISOString().split('T')[0]
  const recentRestNames = new Set(recentMeals.filter((m:any)=>m.delivery_date>=sevenAgo).map((m:any)=>m.restaurant_name?.toLowerCase()))
  const selectedSlots   = availableDates.filter((d:any)=>selectedIds.has(d.id))
  const recipientFirst  = kitchen.name?.split("'")[0]||'them'

  useEffect(()=>{
    fetch(`/api/restaurants/favorites?slug=${kitchen.slug}`)
      .then(r=>r.json()).then(d=>{ setFavorites(d.favorites||[]); setLoadingFavs(false) })
      .catch(()=>setLoadingFavs(false))
  },[kitchen.slug])

  const toggleSlot = (slot:any) => setSelectedIds(prev=>{ const n=new Set(prev);if(n.has(slot.id))n.delete(slot.id);else n.add(slot.id);return n })
  const removeSlot = (id:string) => setSelectedIds(prev=>{ const n=new Set(prev);n.delete(id);return n })

  const buildGroups = (): GroupSelection[] => {
    const order=['breakfast','lunch','dinner']
    const map:Record<string,any[]>={}
    selectedSlots.forEach((s:any)=>{ const mt=s.meal_type||'dinner';if(!map[mt])map[mt]=[];map[mt].push(s) })
    return order.filter(mt=>map[mt]).map(mt=>({ mealType:mt,slots:map[mt],restaurant:null,meal:null,customMeal:'',customPrice:'' }))
  }

  const handleProceed = () => { const g=buildGroups();setGroups(g);setCurrentGroupIdx(0);setStep(2) }
  const currentGroup  = groups[currentGroupIdx]
  const updateGroup   = (i:number,u:Partial<GroupSelection>)=>setGroups(prev=>prev.map((g,idx)=>idx===i?{...g,...u}:g))

  // When restaurant is selected, auto-set tip default based on distance
  const handleRestaurantSelect = (fav: FavRestaurant) => {
    const miles = kitchen.latitude && kitchen.longitude && fav.lat && fav.lng
      ? haversineDistance(kitchen.latitude, kitchen.longitude, fav.lat, fav.lng)
      : null
    updateGroup(currentGroupIdx, { restaurant:fav, meal:null, customMeal:'', customPrice:'' })
    if (!tipInitialized && miles !== null) {
      const tier = getTipTier(miles)
      setTipAmount(tier.default)
      setTipInitialized(true)
    }
  }

  const handleMealSelect = (meal: SelectedMeal) => {
    updateGroup(currentGroupIdx, { meal, customMeal:'', customPrice:'' })
  }

  const handleGroupNext = () => {
    if (currentGroupIdx<groups.length-1) setCurrentGroupIdx(i=>i+1)
    else setStep(3)
  }

  const getNotePlaceholder = () => {
    const types=[...new Set(selectedSlots.map((s:any)=>s.meal_type))]
    if(types.includes('breakfast')&&types.includes('dinner')) return "Starting your day and ending it with a little love 🧡"
    if(types.includes('breakfast')) return "Hope this breakfast starts your day with a little warmth 🌅"
    if(types.includes('lunch')) return "Thinking of you today — hope this gives you a moment to breathe ☀️"
    return "Hope dinner tonight is one less thing to worry about 🧡"
  }

  // Price estimate for Step 3
  const mealSubtotal = groups.reduce((sum,g)=>{
    const price = g.meal?.price || parseFloat(g.customPrice||'0') || 0
    return sum + price * g.slots.length
  },0)
  const platformFee  = Math.round(mealSubtotal * 0.03 * 100) / 100
  const deliveryFee  = 5.99
  const tipDollars   = tipAmount / 100
  const grandTotal   = mealSubtotal + platformFee + deliveryFee + tipDollars

  // Distance for currently active restaurant (for warning)
  const activeRestaurant = currentGroup?.restaurant
  const activeMiles = activeRestaurant && kitchen.latitude && kitchen.longitude && activeRestaurant.lat && activeRestaurant.lng
    ? haversineDistance(kitchen.latitude, kitchen.longitude, activeRestaurant.lat, activeRestaurant.lng)
    : null
  const activeTipTier = activeMiles !== null ? getTipTier(activeMiles) : null

  const handleSubmit = async () => {
    setLoading(true); setErrorMsg('')
    const proposals = groups.flatMap(g=>g.slots.map((slot:any)=>({
      calendar_date_id:   slot.id,
      restaurant_name:    g.restaurant?.name,
      restaurant_address: g.restaurant?.address,
      place_id:           g.restaurant?.place_id,
      menu_item_name:     g.meal?.name     || g.customMeal,
      menu_item_price:    g.meal?.price    || parseFloat(g.customPrice||'0') || 15,
      delivery_date:      slot.date,
      meal_type:          slot.meal_type,
    })))
    try {
      const res=await fetch('/api/proposal',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ name,email,phone,note,proposals,kitchen_slug:kitchen.slug,tip_amount:tipAmount,delivery_preference:deliveryPreference,delivery_note:deliveryNote.trim()||null,use_places:true }),
      })
      const data=await res.json()
      if(!res.ok){ setErrorMsg(data.error||'Something went wrong.');setLoading(false);return }
      window.location.href=data.checkout_url
    } catch(err:any){ setErrorMsg('Network error. Please try again.');setLoading(false) }
  }

  const totalDates = groups.reduce((sum,g)=>sum+g.slots.length,0)
  const groupReady = (g:GroupSelection)=>g.restaurant&&(g.meal||g.customMeal.trim())

  return (
    <div style={{ minHeight:'100vh',background:S.cream,fontFamily:"'DM Sans',sans-serif",display:'flex',flexDirection:'column' }}>
      <link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet"/>

      <div style={{ background:S.forest,padding:'20px 24px',textAlign:'center' }}>
        <div style={{ fontSize:9,fontWeight:500,letterSpacing:5,color:S.sageMid,textTransform:'uppercase' }}>Your</div>
        <div style={{ fontFamily:"'Lora',serif",fontSize:24,fontWeight:500,color:S.white }}>Kitchen</div>
      </div>
      <div style={{ background:S.white,borderBottom:`1px solid ${S.border}`,padding:'20px 24px',textAlign:'center' }}>
        <h1 style={{ fontFamily:"'Lora',serif",fontSize:22,fontWeight:500,color:S.forest,margin:'0 0 4px' }}>{kitchen.name}</h1>
        {kitchen.dietary_restrictions?.length>0&&(
          <div style={{ display:'flex',gap:6,justifyContent:'center',flexWrap:'wrap',marginTop:10 }}>
            {kitchen.dietary_restrictions.map((d:string)=>(
              <span key={d} style={{ background:S.sageLight,color:S.sage,borderRadius:20,fontSize:11,fontWeight:500,padding:'4px 12px' }}>⚠️ {d}</span>
            ))}
          </div>
        )}
      </div>

      <div style={{ display:'flex',gap:6,padding:'20px 24px 0',maxWidth:500,margin:'0 auto',width:'100%' }}>
        {[1,2,3].map(i=><div key={i} style={{ flex:1,height:4,borderRadius:4,background:i<=step?S.sage:S.border,transition:'background 0.3s' }}/>)}
      </div>

      <div style={{ padding:'24px',maxWidth:500,margin:'0 auto',flex:1,width:'100%' }}>

        {/* ── Step 1: Dates ── */}
        {step===1&&(<>
          <h2 style={h2}>Choose your dates</h2>
          <p style={sub}>Tap any highlighted date to claim it.</p>
          <MealHistory meals={recentMeals} recipientFirstName={recipientFirst}/>
          {availableDates.length===0?(
            <div style={{ background:S.sageLight,borderRadius:14,padding:'20px',textAlign:'center',marginBottom:20 }}>
              <p style={{ color:S.sage,margin:0 }}>No open dates right now. Check back soon!</p>
            </div>
          ):(
            <CoordCalendar availableDates={availableDates} selectedIds={selectedIds} onToggle={toggleSlot}/>
          )}
          {selectedSlots.length>0&&(
            <div style={{ background:S.sageLight,borderRadius:14,padding:'14px 16px',marginBottom:16 }}>
              <p style={{ fontSize:11,fontWeight:600,color:S.sage,letterSpacing:1.5,textTransform:'uppercase',margin:'0 0 10px' }}>{selectedSlots.length} date{selectedSlots.length>1?'s':''} selected</p>
              {selectedSlots.map((slot:any)=>{
                const mc=MEAL_TYPE_COLORS[slot.meal_type]||MEAL_TYPE_COLORS.dinner
                const d=new Date(slot.date+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})
                return (
                  <div key={slot.id} style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6 }}>
                    <div style={{ display:'flex',alignItems:'center',gap:8 }}>
                      <span style={{ background:mc.bg,color:mc.color,borderRadius:20,fontSize:10,fontWeight:600,padding:'2px 8px',border:`1px solid ${mc.color}` }}>{MEAL_TYPE_LABELS[slot.meal_type]}</span>
                      <span style={{ fontSize:13,color:S.forest,fontWeight:500 }}>{d}</span>
                    </div>
                    <button onClick={()=>removeSlot(slot.id)} style={{ background:'none',border:'none',cursor:'pointer',color:S.stone,fontSize:16,padding:'0 4px' }}>✕</button>
                  </div>
                )
              })}
            </div>
          )}
          <button onClick={handleProceed} disabled={selectedSlots.length===0} style={btn(selectedSlots.length===0)}>
            {selectedSlots.length===0?'Select at least one date':`Next: Choose Meals → (${selectedSlots.length} date${selectedSlots.length>1?'s':''})`}
          </button>
          <div style={{ marginTop:24,paddingTop:24,borderTop:`0.5px solid ${S.border}`,textAlign:'center' }}>
            <p style={{ fontSize:12,color:S.stone,fontWeight:300,margin:'0 0 8px',lineHeight:1.6 }}>Does someone you love need their village to show up?</p>
            <a href="/signup" style={{ fontSize:13,color:S.sage,fontWeight:500,textDecoration:'none' }}>Create a free Kitchen →</a>
          </div>
        </>)}

        {/* ── Step 2: Restaurant + Meal (inline) ── */}
        {step===2&&currentGroup&&(<>
          {groups.length>1&&(
            <div style={{ background:S.white,border:`1px solid ${S.border}`,borderRadius:12,padding:'12px 16px',marginBottom:16 }}>
              <p style={{ fontSize:11,fontWeight:600,color:S.stone,letterSpacing:1.5,textTransform:'uppercase',margin:'0 0 10px' }}>
                Meal group {currentGroupIdx+1} of {groups.length}
              </p>
              <div style={{ display:'flex',gap:8 }}>
                {groups.map((g,i)=>{const mc=MEAL_TYPE_COLORS[g.mealType]||MEAL_TYPE_COLORS.dinner;const done=i<currentGroupIdx,cur=i===currentGroupIdx;return(
                  <div key={i} style={{ flex:1 }}>
                    <div style={{ height:4,borderRadius:4,background:done||cur?mc.color:S.border,opacity:cur?1:done?1:0.4,transition:'all 0.3s' }}/>
                    <p style={{ fontSize:10,color:cur?mc.color:S.stone,fontWeight:cur?600:400,margin:'4px 0 0',textAlign:'center' }}>{MEAL_TYPE_LABELS[g.mealType]}</p>
                  </div>
                )})}
              </div>
            </div>
          )}

          <h2 style={h2}>{groups.length>1?`Choose a ${currentGroup.mealType} restaurant & meal`:'Choose a restaurant & meal'}</h2>
          <p style={sub}>{recipientFirst}'s saved favorites — tap to expand and select a meal</p>

          {loadingFavs&&<div style={{ padding:'20px',textAlign:'center',color:S.stone,fontSize:13 }}>Loading…</div>}

          {!loadingFavs&&favorites.length===0&&(
            <div style={{ background:S.sageLight,borderRadius:14,padding:'20px',textAlign:'center' }}>
              <p style={{ fontSize:14,color:S.sage,margin:'0 0 8px',fontFamily:"'Lora',serif" }}>{recipientFirst} hasn't added favorites yet</p>
              <p style={{ fontSize:12,color:S.stone,margin:0,fontWeight:300,lineHeight:1.6 }}>Ask them to set up restaurants and meals in their Kitchen dashboard.</p>
            </div>
          )}

          {!loadingFavs&&favorites.map(fav=>{
            const isSelected = currentGroup.restaurant?.id===fav.id
            const miles      = kitchen.latitude&&kitchen.longitude&&fav.lat&&fav.lng
              ? haversineDistance(kitchen.latitude,kitchen.longitude,fav.lat,fav.lng) : null
            const tipTier    = miles!==null?getTipTier(miles):null
            const isRecent   = recentRestNames.has(fav.name?.toLowerCase())
            const hasMeals   = fav.favorite_meals?.length>0

            return (
              <div key={fav.id} style={{ background:S.white,border:`2px solid ${isSelected?S.sage:S.border}`,borderRadius:14,marginBottom:10,overflow:'hidden',transition:'all 0.15s' }}>

                {/* Restaurant header — tap to select/expand */}
                <button onClick={()=>handleRestaurantSelect(isSelected?{...fav,id:''}:fav)}
                  style={{ width:'100%',padding:'14px 16px',display:'flex',alignItems:'center',gap:12,background:isSelected?S.sageLight:'transparent',border:'none',cursor:'pointer',fontFamily:"'DM Sans',sans-serif",textAlign:'left' }}>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex',alignItems:'center',gap:6,flexWrap:'wrap',marginBottom:3 }}>
                      <span style={{ fontFamily:"'Lora',serif",fontSize:15,fontWeight:600,color:S.forest }}>{fav.name}</span>
                      {/* Distance badge */}
                      {miles!==null&&(
                        <span style={{ fontSize:10,fontWeight:700,color:tipTier!.badge.color,background:tipTier!.badge.bg,borderRadius:20,padding:'2px 8px' }}>
                          {tipTier!.badge.text}
                        </span>
                      )}
                      {isRecent&&<span style={{ fontSize:9,fontWeight:700,background:S.redLight,color:S.red,borderRadius:20,padding:'2px 7px' }}>Ordered recently</span>}
                    </div>
                    {fav.address&&<div style={{ fontSize:12,color:S.stone,fontWeight:300,marginBottom:4 }}>{fav.address}</div>}
                    {/* Meal preview pills */}
                    {hasMeals?(
                      <div style={{ display:'flex',gap:4,flexWrap:'wrap' }}>
                        {fav.favorite_meals.slice(0,3).map((meal,i)=>(
                          <span key={i} style={{ fontSize:10,background:S.amberLight,color:S.amber,borderRadius:20,padding:'2px 8px',fontWeight:600 }}>
                            ⭐ {meal} · ${(fav.favorite_meal_prices[i]||15).toFixed(2)}
                          </span>
                        ))}
                        {fav.favorite_meals.length>3&&<span style={{ fontSize:10,color:S.stone }}>+{fav.favorite_meals.length-3} more</span>}
                      </div>
                    ):(
                      <span style={{ fontSize:10,color:S.stone,fontWeight:300 }}>No meals saved — you'll enter the dish name</span>
                    )}
                  </div>
                  <span style={{ color:isSelected?S.sage:S.stone,fontSize:18,flexShrink:0,transition:'transform 0.2s',transform:isSelected?'rotate(0deg)':'rotate(-90deg)' }}>
                    {isSelected?'✓':'›'}
                  </span>
                </button>

                {/* Inline meal selection — only when restaurant is selected */}
                {isSelected&&(
                  <div style={{ borderTop:`0.5px solid ${S.border}`,padding:'14px 16px',background:'#FAFDF9' }}>

                    {/* Distance tip warning */}
                    {tipTier?.warning&&(
                      <div style={{ background: miles!<10?'#FFF8E8':S.redLight, border:`1px solid ${miles!<10?'#F0E2B8':'#F5C0C0'}`, borderRadius:10, padding:'10px 14px', marginBottom:14 }}>
                        <p style={{ fontSize:12,color:miles!<10?'#7A5800':S.red,margin:0,fontWeight:500 }}>{tipTier.warning}</p>
                      </div>
                    )}

                    {/* 7-day repeat warning */}
                    {recentMeals.filter((m:any)=>m.delivery_date>=sevenAgo&&m.restaurant_name?.toLowerCase()===fav.name.toLowerCase()).length>0&&(
                      <div style={{ background:'#FFF8E8',border:'1px solid #F0E2B8',borderRadius:10,padding:'10px 14px',marginBottom:14 }}>
                        <p style={{ fontSize:12,fontWeight:600,color:'#7A5800',margin:'0 0 4px' }}>⚠️ Ordered from here in the last 7 days</p>
                        {recentMeals.filter((m:any)=>m.delivery_date>=sevenAgo&&m.restaurant_name?.toLowerCase()===fav.name.toLowerCase()).map((m:any)=>(
                          <p key={m.id} style={{ fontSize:12,color:'#7A5800',margin:'2px 0 0',fontWeight:300 }}>
                            · {m.meal_name} ({new Date(m.delivery_date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})})
                          </p>
                        ))}
                      </div>
                    )}

                    {/* Saved favorite meals */}
                    {hasMeals?(
                      <>
                        <p style={{ fontSize:10,fontWeight:700,color:S.stone,letterSpacing:'0.1em',textTransform:'uppercase',margin:'0 0 10px' }}>⭐ {recipientFirst}'s favorites</p>
                        <div style={{ display:'flex',flexDirection:'column',gap:8,marginBottom:14 }}>
                          {fav.favorite_meals.map((meal,i)=>{
                            const price=fav.favorite_meal_prices[i]||15
                            const isMealSel=currentGroup.meal?.name===meal
                            return (
                              <button key={i} onClick={()=>handleMealSelect({name:meal,price,isCustom:false})}
                                style={{ width:'100%',background:isMealSel?S.sageLight:S.white,border:`2px solid ${isMealSel?S.sage:S.border}`,borderRadius:11,padding:'11px 14px',cursor:'pointer',display:'flex',alignItems:'center',gap:12,fontFamily:"'DM Sans',sans-serif",textAlign:'left',transition:'all 0.1s' }}>
                                <span style={{ fontSize:18 }}>⭐</span>
                                <div style={{ flex:1 }}>
                                  <div style={{ fontFamily:"'Lora',serif",fontSize:14,fontWeight:600,color:S.forest }}>{meal}</div>
                                  <div style={{ fontSize:11,color:S.stone,fontWeight:300,marginTop:1 }}>{recipientFirst}'s favorite</div>
                                </div>
                                <span style={{ fontSize:15,fontWeight:700,color:S.sage,flexShrink:0 }}>${price.toFixed(2)}</span>
                                {isMealSel&&<span style={{ color:S.sage,fontSize:18 }}>✓</span>}
                              </button>
                            )
                          })}
                        </div>
                        <div style={{ display:'flex',alignItems:'center',gap:8,margin:'0 0 12px' }}>
                          <div style={{ flex:1,height:0.5,background:S.border }}/>
                          <span style={{ fontSize:11,color:S.stone }}>or enter a different dish</span>
                          <div style={{ flex:1,height:0.5,background:S.border }}/>
                        </div>
                      </>
                    ):(
                      <div style={{ background:S.amberLight,border:`1px solid ${S.amber}`,borderRadius:10,padding:'10px 14px',marginBottom:14 }}>
                        <p style={{ fontSize:12,fontWeight:600,color:'#7A5800',margin:'0 0 2px' }}>No meals saved yet</p>
                        <p style={{ fontSize:12,color:'#7A5800',margin:0,fontWeight:300,lineHeight:1.5 }}>
                          Enter the exact dish name below. Be specific so {recipientFirst} recognizes it.
                        </p>
                      </div>
                    )}

                    {/* Custom meal entry */}
                    <div style={{ display:'flex',gap:8 }}>
                      <input value={currentGroup.customMeal}
                        onChange={e=>updateGroup(currentGroupIdx,{customMeal:e.target.value,meal:null})}
                        placeholder={`Exact dish name from ${fav.name}`}
                        style={{ flex:1,padding:'10px 12px',borderRadius:9,border:`1.5px solid ${S.border}`,fontSize:13,fontFamily:"'DM Sans',sans-serif",color:S.forest,outline:'none' }}
                      />
                      <div style={{ position:'relative',flexShrink:0 }}>
                        <span style={{ position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',fontSize:13,color:S.stone }}>$</span>
                        <input type="number" value={currentGroup.customPrice}
                          onChange={e=>updateGroup(currentGroupIdx,{customPrice:e.target.value})}
                          placeholder="0.00"
                          style={{ width:76,padding:'10px 10px 10px 22px',borderRadius:9,border:`1.5px solid ${S.border}`,fontSize:13,fontFamily:"'DM Sans',sans-serif",color:S.forest,outline:'none' }}
                        />
                      </div>
                    </div>

                  </div>
                )}
              </div>
            )
          })}

          <div style={{ display:'flex',gap:10,marginTop:16 }}>
            <button onClick={()=>{ if(currentGroupIdx>0)setCurrentGroupIdx(i=>i-1);else setStep(1) }} style={back}>← Back</button>
            <button onClick={handleGroupNext} disabled={!groupReady(currentGroup)} style={{ ...btn(!groupReady(currentGroup)),flex:1 }}>
              {currentGroupIdx<groups.length-1?`Next: ${MEAL_TYPE_LABELS[groups[currentGroupIdx+1]?.mealType]} →`:'Next: Your Info →'}
            </button>
          </div>
        </>)}

        {/* ── Step 3: Info + Submit ── */}
        {step===3&&(<>
          <h2 style={h2}>Almost done!</h2>
          <p style={sub}>Let {recipientFirst} know who's sending dinner.</p>

          {/* Order summary */}
          <div style={{ background:S.sageLight,borderRadius:14,padding:'16px',marginBottom:20 }}>
            {groups.map((g,i)=>{const mc=MEAL_TYPE_COLORS[g.mealType]||MEAL_TYPE_COLORS.dinner;return(
              <div key={g.mealType} style={{ paddingBottom:i<groups.length-1?10:0,marginBottom:i<groups.length-1?10:0,borderBottom:i<groups.length-1?'1px solid #C8DDD0':'none' }}>
                <span style={{ background:mc.bg,color:mc.color,borderRadius:20,fontSize:10,fontWeight:600,padding:'2px 8px',border:`1px solid ${mc.color}`,display:'inline-block',marginBottom:6 }}>{MEAL_TYPE_LABELS[g.mealType]} · {g.slots.length} date{g.slots.length>1?'s':''}</span>
                <div style={{ fontSize:13,color:S.sage,fontWeight:600 }}>{g.meal?.name||g.customMeal}</div>
                <div style={{ fontSize:12,color:S.sageMid,fontWeight:300 }}>{g.restaurant?.name}</div>
              </div>
            )})}
          </div>

          <label style={lbl}>Your name</label>
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="Marques" style={inp}/>
          <label style={lbl}>Your email</label>
          <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" style={inp}/>
          <label style={lbl}>Your phone</label>
          <input type="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="(555) 123-4567" style={inp}/>
          <p style={{ fontSize:12,color:S.stone,marginTop:-16,marginBottom:20,fontWeight:300 }}>We'll text you when your meal is delivered.</p>

          <label style={lbl}>Personal note (optional)</label>
          <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder={getNotePlaceholder()} style={{ ...inp,minHeight:90,resize:'none' as const }}/>

          <label style={lbl}>Delivery preference</label>
          <p style={{ fontSize:12,color:S.stone,fontWeight:300,marginTop:-4,marginBottom:10,lineHeight:1.5 }}>For families with a sleeping newborn, "leave at door" is the kinder choice.</p>
          <div style={{ display:'flex',gap:10,marginBottom:20 }}>
            {DELIVERY_PREFS.map(pref=>(
              <button key={pref.value} onClick={()=>setDeliveryPreference(pref.value as any)}
                style={{ flex:1,padding:'14px 12px',borderRadius:12,border:`2px solid ${deliveryPreference===pref.value?S.sage:S.border}`,background:deliveryPreference===pref.value?S.sageLight:S.white,cursor:'pointer',textAlign:'left',fontFamily:"'DM Sans',sans-serif",transition:'all 0.15s' }}>
                <div style={{ fontSize:22,marginBottom:6 }}>{pref.icon}</div>
                <div style={{ fontSize:13,fontWeight:600,color:deliveryPreference===pref.value?S.sage:S.forest,marginBottom:3 }}>{pref.title}</div>
                <div style={{ fontSize:11,color:S.stone,fontWeight:300,lineHeight:1.4 }}>{pref.subtitle}</div>
              </button>
            ))}
          </div>

          <label style={lbl}>Delivery note <span style={{ fontWeight:300,textTransform:'none',letterSpacing:0 }}>(optional)</span></label>
          <input value={deliveryNote} onChange={e=>setDeliveryNote(e.target.value)} placeholder="Gate code 4521 · leave at back door" style={inp}/>

          {/* Dynamic tip selector */}
          <label style={lbl}>Tip for your Dasher</label>
          {activeTipTier?.warning&&(
            <div style={{ background:activeMiles!<10?'#FFF8E8':S.redLight,border:`1px solid ${activeMiles!<10?'#F0E2B8':'#F5C0C0'}`,borderRadius:10,padding:'10px 14px',marginBottom:10 }}>
              <p style={{ fontSize:12,color:activeMiles!<10?'#7A5800':S.red,margin:0,fontWeight:500 }}>{activeTipTier.warning}</p>
            </div>
          )}
          <div style={{ display:'flex',gap:8,marginBottom:8 }}>
            {(activeTipTier?.options||[{label:'No tip',value:0},{label:'$2',value:200},{label:'$3',value:300},{label:'$5',value:500}]).map(opt=>(
              <button key={opt.value} onClick={()=>setTipAmount(opt.value)}
                style={{ flex:1,padding:'11px 4px',borderRadius:10,border:'none',background:tipAmount===opt.value?S.sage:S.sageLight,color:tipAmount===opt.value?S.white:S.sage,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",transition:'all 0.15s' }}>
                {opt.label}
              </button>
            ))}
          </div>
          <p style={{ fontSize:12,color:S.stone,marginBottom:20,fontWeight:300 }}>Tips go directly to your Dasher. 🚗</p>

          {/* Price breakdown */}
          {mealSubtotal > 0 && (
            <div style={{ background:S.white,border:`1px solid ${S.border}`,borderRadius:14,padding:'14px 16px',marginBottom:20 }}>
              <p style={{ fontSize:11,fontWeight:700,color:S.stone,letterSpacing:'0.08em',textTransform:'uppercase',margin:'0 0 10px' }}>Price estimate</p>
              {groups.map(g=>{
                const price=g.meal?.price||parseFloat(g.customPrice||'0')||0
                if(!price)return null
                return (
                  <div key={g.mealType} style={{ display:'flex',justifyContent:'space-between',marginBottom:4 }}>
                    <span style={{ fontSize:13,color:S.stone }}>{g.meal?.name||g.customMeal} ×{g.slots.length}</span>
                    <span style={{ fontSize:13,color:S.forest,fontWeight:500 }}>${(price*g.slots.length).toFixed(2)}</span>
                  </div>
                )
              })}
              <div style={{ display:'flex',justifyContent:'space-between',marginBottom:4 }}>
                <span style={{ fontSize:13,color:S.stone }}>Delivery fee</span>
                <span style={{ fontSize:13,color:S.forest }}>${deliveryFee.toFixed(2)}</span>
              </div>
              <div style={{ display:'flex',justifyContent:'space-between',marginBottom:4 }}>
                <span style={{ fontSize:13,color:S.stone }}>Dasher tip</span>
                <span style={{ fontSize:13,color:S.forest }}>${tipDollars.toFixed(2)}</span>
              </div>
              <div style={{ display:'flex',justifyContent:'space-between',marginBottom:4 }}>
                <span style={{ fontSize:13,color:S.stone }}>Platform fee (3%)</span>
                <span style={{ fontSize:13,color:S.forest }}>${platformFee.toFixed(2)}</span>
              </div>
              <div style={{ height:0.5,background:S.border,margin:'8px 0' }}/>
              <div style={{ display:'flex',justifyContent:'space-between' }}>
                <span style={{ fontSize:14,fontWeight:700,color:S.forest }}>Estimated total</span>
                <span style={{ fontSize:14,fontWeight:700,color:S.sage }}>${grandTotal.toFixed(2)}</span>
              </div>
              <p style={{ fontSize:11,color:S.stone,margin:'8px 0 0',fontWeight:300,lineHeight:1.5 }}>
                Price reflects what {recipientFirst} saved. Actual price may vary slightly.
              </p>
            </div>
          )}

          <div style={{ background:S.white,border:`1px solid ${S.border}`,borderRadius:12,padding:'14px 16px',marginBottom:20 }}>
            <p style={{ fontSize:13,color:S.stone,margin:0,lineHeight:1.6 }}>💳 You won't be charged until {recipientFirst} confirms. No money moves until they say yes.</p>
          </div>

          {errorMsg&&<p style={{ color:S.red,fontSize:13,marginBottom:16 }}>{errorMsg}</p>}

          <div style={{ display:'flex',gap:10 }}>
            <button onClick={()=>{ setStep(2);setCurrentGroupIdx(groups.length-1) }} style={back}>← Back</button>
            <button onClick={handleSubmit} disabled={!name||!email||!phone||loading} style={{ ...btn(!name||!email||!phone||loading),flex:1 }}>
              {loading?'Sending…':totalDates>1?`Send ${totalDates} Proposals 🧡`:'Send Proposal 🧡'}
            </button>
          </div>
        </>)}

      </div>
      <CoordFooter/>
    </div>
  )
}

const h2:  React.CSSProperties = { fontFamily:"'Lora',serif",fontSize:22,fontWeight:500,color:'#1E2620',margin:'0 0 6px' }
const sub: React.CSSProperties = { fontSize:14,color:'#6B7066',margin:'0 0 20px',fontWeight:300 }
const btn  = (d:boolean): React.CSSProperties => ({ width:'100%',padding:'14px',borderRadius:10,border:'none',background:d?'#DDE8E0':'#3D6B4F',color:d?'#6B7066':'#fff',fontSize:14,fontWeight:500,cursor:d?'default':'pointer',fontFamily:"'DM Sans',sans-serif" })
const back: React.CSSProperties = { padding:'14px 20px',borderRadius:10,border:`1.5px solid #DDE8E0`,background:'transparent',fontSize:14,color:'#6B7066',cursor:'pointer',fontFamily:"'DM Sans',sans-serif" }
const lbl:  React.CSSProperties = { fontSize:11,fontWeight:600,color:'#6B7066',letterSpacing:1.5,textTransform:'uppercase',display:'block',marginBottom:8 }
const inp:  React.CSSProperties = { width:'100%',padding:'13px 16px',borderRadius:10,border:'1.5px solid #DDE8E0',fontSize:16,background:'#fff',outline:'none',boxSizing:'border-box',marginBottom:20,fontFamily:"'DM Sans',sans-serif",color:'#1E2620' }

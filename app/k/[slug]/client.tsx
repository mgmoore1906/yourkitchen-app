'use client'
// FILE: app/k/[slug]/client.tsx
// v7: Multi-item cart, adult/kids sections, household composition, qty selectors

import { useState, useEffect, useRef } from 'react'
import { haversineDistance, getTipTier } from '@/lib/distance'

// ── Coordinator palette — warm amber/wheat (distinct from recipient's sage/forest) ──
const S = {
// Coordinator accent
amber:      '#B87333',   // warm copper-amber — primary action color
amberMid:   '#D4956A',   // mid amber
amberLight: '#F5ECD8',   // warm cream tint
amberBorder:'#E0C89A',   // warm tan border
// Coordinator background
cream:      '#FDFAF5',   // warm cream (slightly warmer than recipient)
warmWhite:  '#FFFCF5',   // card backgrounds
// Coordinator text
mahogany:   '#5C3317',   // dark warm brown — headings/buttons (replaces forest)
walnut:     '#7A5C3A',   // medium warm brown — body text (replaces stone)
// Functional
white:      '#FFFFFF',
border:     '#E0C89A',   // warm tan
red:        '#B94040',
redLight:   '#FDE8E8',
blue:       '#4A8FA8',
blueLight:  '#E8F4F8',
// Keep for meal-type color coding
sage:       '#3D6B4F',   // still used for dinner meal type dots
sageLight:  '#EAF2ED',
forest:     '#1E2620',
stone:      '#6B7066',
}
const MEAL_TYPE_LABELS: Record<string, string> = {
breakfast: '🌅 Breakfast', lunch: '☀️ Lunch', dinner: '🌙 Dinner',
}
const MEAL_TYPE_COLORS: Record<string, { color: string; bg: string }> = {
breakfast: { color: '#E8834A', bg: '#FFF0E8' },
lunch: { color: '#4A8FA8', bg: '#E8F4F8' },
dinner: { color: S.sage, bg: S.sageLight },
}
const DELIVERY_PREFS = [
{ value: 'leave_at_door', icon: '🚪', title: 'Leave at door', subtitle: 'Text when arrived — no knock' },
{ value: 'hand_to_recipient', icon: '🤝', title: 'Hand to me', subtitle: 'Driver hands order directly' },
]

// Distance-based courier delivery fee estimate
function getDeliveryFee(miles: number | null): number {
if (miles === null) return 6.99
if (miles < 4) return 4.99
if (miles < 7) return 6.99
if (miles < 10) return 8.99
return 11.99
}

type FavRestaurant = {
id: string; name: string; address: string | null
place_id: string | null; lat: number | null; lng: number | null
favorite_meals: string[]; favorite_meal_prices: number[]
favorite_meal_categories: string[]
}
type CartItem = { name: string; price: number; qty: number; category: 'adult'|'kids'; isCustom: boolean }
type GroupSelection = {
mealType: string; slots: any[]
restaurant: FavRestaurant | null
cart: CartItem[]
customMeal: string; customPrice: string; customCategory: 'adult'|'kids'
}

// ─────────────────────────────────────────────────────────────────────────────
function MealHistory({ meals, recipientFirstName }: { meals: any[]; recipientFirstName: string }) {
const [expanded, setExpanded] = useState(false)
if (!meals?.length) return null
const sevenAgo = new Date(Date.now() - 7*24*60*60*1000).toISOString().split('T')[0]
const recent7 = meals.filter(m => m.delivery_date >= sevenAgo)
const tally: Record<string,number> = {}
meals.forEach(m => { tally[m.restaurant_name] = (tally[m.restaurant_name]||0)+1 })
const sorted = Object.entries(tally).sort((a,b)=>b[1]-a[1])
const max = sorted[0]?.[1]||1
const fmtD = (d: string) => new Date(d+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})
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
<div style={{ flex:1,height:6,background:S.amberBorder,borderRadius:3,overflow:'hidden' }}>
<div style={{ height:'100%',background:S.amber,borderRadius:3,width:`${(count/max)*100}%` }}/>
</div>
<span style={{ fontSize:11,fontWeight:700,color:S.amber,width:20,textAlign:'right',flexShrink:0 }}>{count}×</span>
</div>
))}
{meals.map((m,i)=>{
const mc=MEAL_TYPE_COLORS[m.meal_type]||MEAL_TYPE_COLORS.dinner
const isRecent=m.delivery_date>=sevenAgo
return (
<div key={m.id} style={{ display:'flex',alignItems:'center',gap:10,padding:'9px 0',borderBottom:i<meals.length-1?`0.5px solid ${S.amberBorder}`:'none' }}>
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
<button onClick={prev} style={{ background:S.amberLight,border:'none',borderRadius:8,width:32,height:32,cursor:'pointer',fontSize:16,color:S.amber,display:'flex',alignItems:'center',justifyContent:'center' }}>‹</button>
<p style={{ fontFamily:"'Lora',serif",fontSize:16,fontWeight:500,color:S.forest,margin:0 }}>{monthName}</p>
<button onClick={next} style={{ background:S.amberLight,border:'none',borderRadius:8,width:32,height:32,cursor:'pointer',fontSize:16,color:S.amber,display:'flex',alignItems:'center',justifyContent:'center' }}>›</button>
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
style={{ background:isSel?S.amberLight:has?'#F8FAF8':'transparent',border:isToday?`2px solid ${S.amber}`:isSel?`2px solid ${S.amber}`:has?`1.5px solid ${S.border}`:`1.5px solid transparent`,borderRadius:10,padding:'8px 2px',minHeight:52,cursor:has&&!isPast?'pointer':'default',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:3,fontFamily:"'DM Sans',sans-serif",opacity:isPast?0.35:1,transition:'all 0.1s' }}>
<span style={{ fontSize:13,fontWeight:isToday?700:500,color:isPast?'#C8D5CA':isSel?S.amber:S.mahogany,lineHeight:1 }}>{day}</span>
{has&&<div style={{ display:'flex',gap:2 }}>{slots.map((s:any,si:number)=>{const mc=MEAL_TYPE_COLORS[s.meal_type]||MEAL_TYPE_COLORS.dinner;return<div key={si} style={{ width:6,height:6,borderRadius:'50%',background:selectedIds.has(s.id)?mc.color:'#C8D5CA' }}/>})}</div>}
</button>
)
})}
</div>
<div style={{ display:'flex',gap:12,flexWrap:'wrap',marginTop:14,paddingTop:12,borderTop:`1px solid ${S.amberBorder}` }}>
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
<footer style={{ background:S.mahogany,padding:'48px 24px',textAlign:'center',marginTop:40,fontFamily:"'DM Sans',sans-serif" }}>
<div style={{ fontFamily:"'Lora',serif",fontSize:20,fontWeight:500,color:S.white,letterSpacing:-0.5,marginBottom:6 }}>YourKitchen</div>
<p style={{ fontFamily:"'Lora',serif",fontStyle:'italic',fontSize:13,color:'rgba(255,255,255,0.55)',margin:'0 0 16px' }}>"Your kitchen, covered."</p>
<p style={{ fontSize:10,color:'rgba(255,255,255,0.2)',margin:0 }}>© 2026 YourKitchen LLC</p>
</footer>
)
}

// Qty stepper used in cart sections
function QtyStepper({ qty, onAdd, onSub }: { qty:number; onAdd:()=>void; onSub:()=>void }) {
if (qty === 0) {
return (
<button onClick={onAdd} style={{ background:S.amber,border:'none',borderRadius:8,color:S.white,fontSize:13,fontWeight:600,padding:'7px 14px',cursor:'pointer',fontFamily:"'DM Sans',sans-serif",flexShrink:0 }}>Add</button>
)
}
return (
<div style={{ display:'flex',alignItems:'center',gap:0,flexShrink:0,border:`1.5px solid ${S.amber}`,borderRadius:8,overflow:'hidden' }}>
<button onClick={onSub} style={{ background:S.amberLight,border:'none',color:S.amber,fontSize:18,fontWeight:600,width:30,height:32,cursor:'pointer',lineHeight:1,display:'flex',alignItems:'center',justifyContent:'center' }}>−</button>
<span style={{ fontSize:14,fontWeight:700,color:S.amber,width:28,textAlign:'center' }}>{qty}</span>
<button onClick={onAdd} style={{ background:S.amberLight,border:'none',color:S.amber,fontSize:18,fontWeight:600,width:30,height:32,cursor:'pointer',lineHeight:1,display:'flex',alignItems:'center',justifyContent:'center' }}>+</button>
</div>
)
}

// ─────────────────────────────────────────────────────────────────────────────
export default function CoordKitchenClient({ kitchen, availableDates, recentMeals=[] }: any) {
const [step, setStep] = useState<1|2|3>(1)
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
const [groups, setGroups] = useState<GroupSelection[]>([])
const [currentGroupIdx, setCurrentGroupIdx] = useState(0)
const [favorites, setFavorites] = useState<FavRestaurant[]>([])
const [loadingFavs, setLoadingFavs] = useState(true)
const [name, setName] = useState('')
const [email, setEmail] = useState('')
const [phone, setPhone] = useState('')
const [note, setNote] = useState('')
const [tipAmount, setTipAmount] = useState(300)
const [tipInitialized, setTipInitialized] = useState(false)
const [showTipAdjust, setShowTipAdjust] = useState(false)
const [deliveryPreference, setDeliveryPreference] = useState<'leave_at_door'|'hand_to_recipient'>('leave_at_door')
const [deliveryNote, setDeliveryNote] = useState('')
const [loading, setLoading] = useState(false)
const [errorMsg, setErrorMsg] = useState('')

const isPoppingRef = useRef(false)

const KH_ADULTS = kitchen.household_adults ?? 2
const KH_CHILDREN = kitchen.household_children ?? 2

const sevenAgo = new Date(Date.now()-7*24*60*60*1000).toISOString().split('T')[0]
const recentRestNames = new Set(recentMeals.filter((m:any)=>m.delivery_date>=sevenAgo).map((m:any)=>m.restaurant_name?.toLowerCase()))
const selectedSlots = availableDates.filter((d:any)=>selectedIds.has(d.id))
const recipientFirst = kitchen.name?.split("'")[0]||'them'

useEffect(()=>{
fetch(`/api/restaurants/favorites?slug=${kitchen.slug}`)
.then(r=>r.json()).then(d=>{ setFavorites(d.favorites||[]); setLoadingFavs(false) })
.catch(()=>setLoadingFavs(false))
},[kitchen.slug])

useEffect(()=>{
window.history.pushState({ ykStep:1, ykGroup:0 }, '')
const handlePop = () => {
isPoppingRef.current = true
setStep(prev => {
if (prev === 3) { window.history.pushState({ ykStep:2 }, ''); return 2 }
if (prev === 2) {
setCurrentGroupIdx(gi => { if (gi > 0) { window.history.pushState({ ykStep:2, ykGroup:gi-1 }, ''); return gi - 1 } return 0 })
if (currentGroupIdx === 0) { window.history.pushState({ ykStep:1 }, ''); return 1 }
return 2
}
return 1
})
setTimeout(() => { isPoppingRef.current = false }, 50)
}
window.addEventListener('popstate', handlePop)
return () => window.removeEventListener('popstate', handlePop)
}, [currentGroupIdx])

const goToStep = (s: 1|2|3, groupIdx = 0) => {
if (!isPoppingRef.current) window.history.pushState({ ykStep:s, ykGroup:groupIdx }, '')
setStep(s)
}

const toggleSlot = (slot:any) => setSelectedIds(prev=>{ const n=new Set(prev);if(n.has(slot.id))n.delete(slot.id);else n.add(slot.id);return n })
const removeSlot = (id:string) => setSelectedIds(prev=>{ const n=new Set(prev);n.delete(id);return n })

const buildGroups = (): GroupSelection[] => {
const order=['breakfast','lunch','dinner']
const map:Record<string,any[]>={}
selectedSlots.forEach((s:any)=>{ const mt=s.meal_type||'dinner';if(!map[mt])map[mt]=[];map[mt].push(s) })
return order.filter(mt=>map[mt]).map(mt=>({ mealType:mt,slots:map[mt],restaurant:null,cart:[],customMeal:'',customPrice:'',customCategory:'adult' as const }))
}

const handleProceed = () => { const g=buildGroups(); setGroups(g); setCurrentGroupIdx(0); goToStep(2, 0) }

const currentGroup = groups[currentGroupIdx]
const updateGroup = (i:number,u:Partial<GroupSelection>)=>setGroups(prev=>prev.map((g,idx)=>idx===i?{...g,...u}:g))

// Composition for a group (slot override → kitchen default)
const groupComposition = (g:GroupSelection) => {
const slot = g.slots[0]
const adults = (slot?.adults ?? KH_ADULTS)
const children = (slot?.children ?? KH_CHILDREN)
return { adults, children, total: adults+children }
}

const handleRestaurantSelect = (fav: FavRestaurant) => {
const miles = kitchen.latitude && kitchen.longitude && fav.lat && fav.lng
? haversineDistance(kitchen.latitude, kitchen.longitude, fav.lat, fav.lng) : null
updateGroup(currentGroupIdx, { restaurant:fav, cart:[], customMeal:'', customPrice:'', customCategory:'adult' })
if (!tipInitialized && miles !== null) {
const tier = getTipTier(miles); setTipAmount(tier.default); setTipInitialized(true)
}
}

// ── Cart helpers (operate on currentGroup) ──
const cartGet = (name:string, category:string) => currentGroup.cart.find(c=>c.name===name&&c.category===category)
const cartAdd = (item:{name:string;price:number;category:'adult'|'kids';isCustom:boolean}) => {
const existing = cartGet(item.name, item.category)
if (existing) {
updateGroup(currentGroupIdx, { cart: currentGroup.cart.map(c=>c.name===item.name&&c.category===item.category?{...c,qty:c.qty+1}:c) })
} else {
updateGroup(currentGroupIdx, { cart: [...currentGroup.cart, {...item, qty:1}] })
}
}
const cartSub = (name:string, category:string) => {
const existing = cartGet(name, category)
if (!existing) return
if (existing.qty>1) {
updateGroup(currentGroupIdx, { cart: currentGroup.cart.map(c=>c.name===name&&c.category===category?{...c,qty:c.qty-1}:c) })
} else {
updateGroup(currentGroupIdx, { cart: currentGroup.cart.filter(c=>!(c.name===name&&c.category===category)) })
}
}
const cartCount = (cart:CartItem[]) => cart.reduce((s,c)=>s+c.qty,0)
const cartTotal = (cart:CartItem[]) => cart.reduce((s,c)=>s+c.price*c.qty,0)

const addCustomToCart = () => {
const nm = currentGroup.customMeal.trim()
const pr = parseFloat(currentGroup.customPrice||'0')||0
if (!nm || pr<=0) return
cartAdd({ name:nm, price:pr, category:currentGroup.customCategory, isCustom:true })
updateGroup(currentGroupIdx, { customMeal:'', customPrice:'' })
}

const handleGroupNext = () => {
if (currentGroupIdx < groups.length-1) {
setCurrentGroupIdx(i => i+1)
window.history.pushState({ ykStep:2, ykGroup:currentGroupIdx+1 }, '')
} else { goToStep(3) }
}

const getNotePlaceholder = () => {
const types=[...new Set(selectedSlots.map((s:any)=>s.meal_type))]
if(types.includes('breakfast')&&types.includes('dinner')) return "Starting your day and ending it with a little love 🧡"
if(types.includes('breakfast')) return "Hope this breakfast starts your day with a little warmth 🌅"
if(types.includes('lunch')) return "Thinking of you today — hope this gives you a moment to breathe ☀️"
return "Hope dinner tonight is one less thing to worry about 🧡"
}

const activeMiles = (() => {
const fav = groups.find(g => g.restaurant)?.restaurant
if (!fav || !kitchen.latitude || !kitchen.longitude || !fav.lat || !fav.lng) return null
return haversineDistance(kitchen.latitude, kitchen.longitude, fav.lat, fav.lng)
})()
const activeTipTier = activeMiles !== null ? getTipTier(activeMiles) : null
const deliveryFee = getDeliveryFee(activeMiles)

// Price estimate — sum of cart × qty × dates per group
const mealSubtotal = groups.reduce((sum,g)=> sum + cartTotal(g.cart) * g.slots.length, 0)
const platformFee = Math.round(mealSubtotal * 0.03 * 100) / 100
const tipDollars = tipAmount / 100
const grandTotal = mealSubtotal + platformFee + deliveryFee + tipDollars

const handleSubmit = async () => {
setLoading(true); setErrorMsg('')
const proposals = groups.flatMap(g=>g.slots.map((slot:any)=>({
calendar_date_id: slot.id,
restaurant_name: g.restaurant?.name,
restaurant_address: g.restaurant?.address,
place_id: g.restaurant?.place_id,
meal_items: g.cart.map(c=>({ name:c.name, price:c.price, qty:c.qty, category:c.category })),
menu_item_name: g.cart.map(c=>c.qty>1?`${c.name} ×${c.qty}`:c.name).join(', '),
menu_item_price: cartTotal(g.cart),
delivery_date: slot.date,
meal_type: slot.meal_type,
})))
try {
const res=await fetch('/api/proposal',{
method:'POST', headers:{'Content-Type':'application/json'},
body:JSON.stringify({ name,email,phone,note,proposals,kitchen_slug:kitchen.slug,tip_amount:tipAmount,delivery_preference:deliveryPreference,delivery_note:deliveryNote.trim()||null,use_places:true }),
})
const data=await res.json()
if(!res.ok){ setErrorMsg(data.error||'Something went wrong.');setLoading(false);return }
window.location.href=data.checkout_url
} catch(err:any){ setErrorMsg('Network error. Please try again.');setLoading(false) }
}

const totalDates = groups.reduce((sum,g)=>sum+g.slots.length,0)
const groupReady = (g:GroupSelection)=> !!g.restaurant && g.cart.length>0

return (
<div style={{ minHeight:'100vh',background:S.cream,fontFamily:"'DM Sans',sans-serif",display:'flex',flexDirection:'column' }}>
<link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet"/>

<div style={{ background:S.mahogany, padding:'16px 24px', textAlign:'center' }}>
<div style={{ fontSize:10, fontWeight:400, letterSpacing:3, color:'rgba(255,255,255,0.5)', textTransform:'uppercase', marginBottom:4 }}>Sending a meal to</div>
<div style={{ fontFamily:"'Lora',serif", fontSize:26, fontWeight:600, color:S.white, letterSpacing:-0.5 }}>{kitchen.name}</div>
<div style={{ fontSize:10, fontWeight:300, color:'rgba(255,255,255,0.45)', marginTop:6, letterSpacing:1 }}>via YourKitchen</div>
</div>
{kitchen.dietary_restrictions?.length>0&&(
<div style={{ background:S.amberLight, borderBottom:`1px solid ${S.amberBorder}`, padding:'12px 24px' }}>
<div style={{ display:'flex',gap:6,justifyContent:'center',flexWrap:'wrap' }}>
{kitchen.dietary_restrictions.map((d:string)=>(
<span key={d} style={{ background:S.warmWhite,color:S.mahogany,borderRadius:20,fontSize:11,fontWeight:600,padding:'4px 12px',border:`1px solid ${S.amberBorder}` }}>⚠️ {d}</span>
))}
</div>
</div>
)}

<div style={{ display:'flex',gap:6,padding:'16px 24px 0',maxWidth:500,margin:'0 auto',width:'100%' }}>
{[1,2,3].map(i=><div key={i} style={{ flex:1,height:4,borderRadius:4,background:i<=step?S.amber:S.amberBorder,transition:'background 0.3s' }}/>)}
</div>

<div style={{ padding:'24px',maxWidth:500,margin:'0 auto',flex:1,width:'100%' }}>

{/* ── Step 1 ── */}
{step===1&&(<>
<h2 style={h2}>Choose your dates</h2>
<p style={sub}>Tap any highlighted date to claim it.</p>
<MealHistory meals={recentMeals} recipientFirstName={recipientFirst}/>
{availableDates.length===0?(
<div style={{ background:S.amberLight,borderRadius:14,padding:'20px',textAlign:'center',marginBottom:20,border:`1px solid ${S.amberBorder}` }}>
<p style={{ color:S.mahogany,margin:0 }}>No open dates right now. Check back soon!</p>
</div>
):(
<CoordCalendar availableDates={availableDates} selectedIds={selectedIds} onToggle={toggleSlot}/>
)}
{selectedSlots.length>0&&(
<div style={{ background:S.amberLight,borderRadius:14,padding:'14px 16px',marginBottom:16,border:`1px solid ${S.amberBorder}` }}>
<p style={{ fontSize:11,fontWeight:600,color:S.amber,letterSpacing:1.5,textTransform:'uppercase',margin:'0 0 10px' }}>{selectedSlots.length} date{selectedSlots.length>1?'s':''} selected</p>
{selectedSlots.map((slot:any)=>{
const mc=MEAL_TYPE_COLORS[slot.meal_type]||MEAL_TYPE_COLORS.dinner
const d=new Date(slot.date+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})
const a=slot.adults??KH_ADULTS, c=slot.children??KH_CHILDREN
return (
<div key={slot.id} style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6 }}>
<div style={{ display:'flex',alignItems:'center',gap:8,flexWrap:'wrap' }}>
<span style={{ background:mc.bg,color:mc.color,borderRadius:20,fontSize:10,fontWeight:600,padding:'2px 8px',border:`1px solid ${mc.color}` }}>{MEAL_TYPE_LABELS[slot.meal_type]}</span>
<span style={{ fontSize:13,color:S.mahogany,fontWeight:500 }}>{d}</span>
<span style={{ fontSize:11,color:S.walnut,fontWeight:400 }}>· 👤{a} 🧒{c}</span>
</div>
<button onClick={()=>removeSlot(slot.id)} style={{ background:'none',border:'none',cursor:'pointer',color:S.walnut,fontSize:16,padding:'0 4px' }}>✕</button>
</div>
)
})}
</div>
)}
<button onClick={handleProceed} disabled={selectedSlots.length===0} style={btn(selectedSlots.length===0)}>
{selectedSlots.length===0?'Select at least one date':`Next: Choose Meals → (${selectedSlots.length} date${selectedSlots.length>1?'s':''})`}
</button>
<div style={{ marginTop:24,paddingTop:24,borderTop:`0.5px solid ${S.amberBorder}`,textAlign:'center' }}>
<p style={{ fontSize:12,color:S.walnut,fontWeight:300,margin:'0 0 8px',lineHeight:1.6 }}>Does someone you love need their village to show up?</p>
<a href="/signup" style={{ fontSize:13,color:S.amber,fontWeight:500,textDecoration:'none' }}>Create a free Kitchen →</a>
</div>
</>)}

{/* ── Step 2 ── */}
{step===2&&currentGroup&&(<>
{groups.length>1&&(
<div style={{ background:S.white,border:`1px solid ${S.border}`,borderRadius:12,padding:'12px 16px',marginBottom:16 }}>
<p style={{ fontSize:11,fontWeight:600,color:S.stone,letterSpacing:1.5,textTransform:'uppercase',margin:'0 0 10px' }}>Meal group {currentGroupIdx+1} of {groups.length}</p>
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
<h2 style={h2}>{groups.length>1?`Choose a ${currentGroup.mealType} restaurant`:'Choose a restaurant'}</h2>
<p style={sub}>{recipientFirst}'s saved favorites — tap to expand</p>

{/* Household composition chip */}
{(() => {
const comp = groupComposition(currentGroup)
return (
<div style={{ background:S.blueLight,border:`1px solid ${S.blue}33`,borderRadius:12,padding:'12px 16px',marginBottom:16,display:'flex',alignItems:'center',gap:10 }}>
<span style={{ fontSize:20 }}>🍽</span>
<div>
<div style={{ fontSize:13,fontWeight:600,color:S.forest }}>{recipientFirst}'s household · {comp.total} {comp.total===1?'person':'people'}</div>
<div style={{ fontSize:12,color:S.stone,fontWeight:300,marginTop:1 }}>👤 {comp.adults} adult{comp.adults!==1?'s':''} · 🧒 {comp.children} {comp.children===1?'child':'children'} — order for as many as feels right</div>
</div>
</div>
)
})()}

{loadingFavs&&<div style={{ padding:'20px',textAlign:'center',color:S.stone,fontSize:13 }}>Loading…</div>}

{!loadingFavs&&favorites.length===0&&(
<div style={{ background:S.amberLight,borderRadius:14,padding:'20px',textAlign:'center' }}>
<p style={{ fontSize:14,color:S.mahogany,margin:'0 0 8px',fontFamily:"'Lora',serif" }}>{recipientFirst} hasn't added favorites yet</p>
<p style={{ fontSize:12,color:S.stone,margin:0,fontWeight:300,lineHeight:1.6 }}>Ask them to set up restaurants and meals in their Kitchen dashboard.</p>
</div>
)}

{!loadingFavs&&favorites.map(fav=>{
const isSelected = currentGroup.restaurant?.id===fav.id
const miles = kitchen.latitude&&kitchen.longitude&&fav.lat&&fav.lng
? haversineDistance(kitchen.latitude,kitchen.longitude,fav.lat,fav.lng) : null
const tipTier = miles!==null?getTipTier(miles):null
const isRecent = recentRestNames.has(fav.name?.toLowerCase())
const hasMeals = fav.favorite_meals?.length>0

// Split meals by category
const allMeals = (fav.favorite_meals||[]).map((m,i)=>({ name:m, price:fav.favorite_meal_prices?.[i]||15, category:(fav.favorite_meal_categories?.[i]||'adult') as 'adult'|'kids' }))
const adultMeals = allMeals.filter(m=>m.category==='adult')
const kidsMeals = allMeals.filter(m=>m.category==='kids')

return (
<div key={fav.id} style={{ background:S.white,border:`2px solid ${isSelected?S.amber:S.amberBorder}`,borderRadius:14,marginBottom:10,overflow:'hidden',transition:'all 0.15s' }}>
<button onClick={()=>handleRestaurantSelect(isSelected?{...fav,id:''}:fav)}
style={{ width:'100%',padding:'14px 16px',display:'flex',alignItems:'center',gap:12,background:isSelected?S.amberLight:'transparent',border:'none',cursor:'pointer',fontFamily:"'DM Sans',sans-serif",textAlign:'left' }}>
<div style={{ flex:1 }}>
<div style={{ display:'flex',alignItems:'center',gap:6,flexWrap:'wrap',marginBottom:3 }}>
<span style={{ fontFamily:"'Lora',serif",fontSize:15,fontWeight:600,color:S.forest }}>{fav.name}</span>
{miles!==null&&<span style={{ fontSize:10,fontWeight:700,color:tipTier!.badge.color,background:tipTier!.badge.bg,borderRadius:20,padding:'2px 8px' }}>{tipTier!.badge.text}</span>}
{isRecent&&<span style={{ fontSize:9,fontWeight:700,background:S.redLight,color:S.red,borderRadius:20,padding:'2px 7px' }}>Ordered recently</span>}
</div>
{fav.address&&<div style={{ fontSize:12,color:S.stone,fontWeight:300,marginBottom:4 }}>{fav.address}</div>}
{hasMeals?(
<div style={{ fontSize:11,color:S.stone,fontWeight:300 }}>{adultMeals.length} adult · {kidsMeals.length} kids meal{kidsMeals.length!==1?'s':''} saved</div>
):(
<span style={{ fontSize:10,color:S.stone,fontWeight:300 }}>No meals saved — you'll enter the dish name</span>
)}
</div>
<span style={{ color:isSelected?S.amber:S.walnut,fontSize:18,flexShrink:0,transition:'transform 0.2s',transform:isSelected?'rotate(0deg)':'rotate(-90deg)' }}>
{isSelected?'✓':'›'}
</span>
</button>

{isSelected&&(
<div style={{ borderTop:`0.5px solid ${S.border}`,padding:'14px 16px',background:'#FAFDF9' }}>
{kitchen.dietary_restrictions?.length>0&&(
<div style={{ background:S.blueLight,border:`1px solid ${S.blue}40`,borderRadius:10,padding:'10px 14px',marginBottom:14 }}>
<p style={{ fontSize:12,color:'#2A6175',margin:'0 0 4px',fontWeight:600 }}>💙 A note on {recipientFirst}'s needs</p>
<p style={{ fontSize:12,color:'#2A6175',margin:0,fontWeight:400,lineHeight:1.5 }}>
{recipientFirst} has noted: {kitchen.dietary_restrictions.join(', ')}. Please double-check the dish you choose works for them.
</p>
</div>
)}
{tipTier?.warning&&(
<div style={{ background:miles!<10?'#FFF8E8':S.redLight,border:`1px solid ${miles!<10?'#F0E2B8':'#F5C0C0'}`,borderRadius:10,padding:'10px 14px',marginBottom:14 }}>
<p style={{ fontSize:12,color:miles!<10?'#7A5800':S.red,margin:0,fontWeight:500 }}>{tipTier.warning}</p>
</div>
)}
{recentMeals.filter((m:any)=>m.delivery_date>=sevenAgo&&m.restaurant_name?.toLowerCase()===fav.name.toLowerCase()).length>0&&(
<div style={{ background:'#FFF8E8',border:'1px solid #F0E2B8',borderRadius:10,padding:'10px 14px',marginBottom:14 }}>
<p style={{ fontSize:12,fontWeight:600,color:'#7A5800',margin:'0 0 4px' }}>⚠️ Ordered from here in the last 7 days</p>
</div>
)}

{/* ── ADULTS SECTION ── */}
{adultMeals.length>0&&(<>
<p style={{ fontSize:10,fontWeight:700,color:S.amber,letterSpacing:'0.1em',textTransform:'uppercase',margin:'0 0 10px' }}>👤 For the adults</p>
<div style={{ display:'flex',flexDirection:'column',gap:8,marginBottom:16 }}>
{adultMeals.map((m,i)=>{
const qty=cartGet(m.name,'adult')?.qty||0
return (
<div key={i} style={{ background:qty>0?S.amberLight:S.warmWhite,border:`2px solid ${qty>0?S.amber:S.amberBorder}`,borderRadius:11,padding:'11px 14px',display:'flex',alignItems:'center',gap:12,transition:'all 0.1s' }}>
<div style={{ flex:1 }}>
<div style={{ fontFamily:"'Lora',serif",fontSize:14,fontWeight:600,color:S.forest }}>{m.name}</div>
<div style={{ fontSize:13,fontWeight:700,color:S.amber,marginTop:1 }}>${m.price.toFixed(2)}</div>
</div>
<QtyStepper qty={qty} onAdd={()=>cartAdd({name:m.name,price:m.price,category:'adult',isCustom:false})} onSub={()=>cartSub(m.name,'adult')}/>
</div>
)
})}
</div>
</>)}

{/* ── KIDS SECTION ── */}
{kidsMeals.length>0&&(<>
<p style={{ fontSize:10,fontWeight:700,color:S.amber,letterSpacing:'0.1em',textTransform:'uppercase',margin:'0 0 10px' }}>🧒 For the kids</p>
<div style={{ display:'flex',flexDirection:'column',gap:8,marginBottom:16 }}>
{kidsMeals.map((m,i)=>{
const qty=cartGet(m.name,'kids')?.qty||0
return (
<div key={i} style={{ background:qty>0?S.amberLight:S.white,border:`2px solid ${qty>0?S.amber:S.border}`,borderRadius:11,padding:'11px 14px',display:'flex',alignItems:'center',gap:12,transition:'all 0.1s' }}>
<div style={{ flex:1 }}>
<div style={{ fontFamily:"'Lora',serif",fontSize:14,fontWeight:600,color:S.forest }}>{m.name}</div>
<div style={{ fontSize:13,fontWeight:700,color:S.amber,marginTop:1 }}>${m.price.toFixed(2)}</div>
</div>
{qty===0?(
<button onClick={()=>cartAdd({name:m.name,price:m.price,category:'kids',isCustom:false})} style={{ background:S.amber,border:'none',borderRadius:8,color:S.white,fontSize:13,fontWeight:600,padding:'7px 14px',cursor:'pointer',fontFamily:"'DM Sans',sans-serif",flexShrink:0 }}>Add</button>
):(
<div style={{ display:'flex',alignItems:'center',flexShrink:0,border:`1.5px solid ${S.amber}`,borderRadius:8,overflow:'hidden' }}>
<button onClick={()=>cartSub(m.name,'kids')} style={{ background:S.amberLight,border:'none',color:S.amber,fontSize:18,fontWeight:600,width:30,height:32,cursor:'pointer',lineHeight:1 }}>−</button>
<span style={{ fontSize:14,fontWeight:700,color:S.amber,width:28,textAlign:'center' }}>{qty}</span>
<button onClick={()=>cartAdd({name:m.name,price:m.price,category:'kids',isCustom:false})} style={{ background:S.amberLight,border:'none',color:S.amber,fontSize:18,fontWeight:600,width:30,height:32,cursor:'pointer',lineHeight:1 }}>+</button>
</div>
)}
</div>
)
})}
</div>
</>)}

{/* ── CUSTOM ITEM ── */}
<div style={{ display:'flex',alignItems:'center',gap:8,margin:'4px 0 10px' }}>
<div style={{ flex:1,height:0.5,background:S.border }}/>
<span style={{ fontSize:11,color:S.stone }}>add a different dish</span>
<div style={{ flex:1,height:0.5,background:S.border }}/>
</div>
<div style={{ display:'flex',gap:6,marginBottom:8 }}>
{(['adult','kids'] as const).map(cat=>(
<button key={cat} onClick={()=>updateGroup(currentGroupIdx,{customCategory:cat})}
style={{ flex:1,padding:'8px',borderRadius:8,border:`1.5px solid ${currentGroup.customCategory===cat?(cat==='adult'?S.amber:S.amber):S.amberBorder}`,background:currentGroup.customCategory===cat?S.amberLight:S.warmWhite,color:currentGroup.customCategory===cat?S.amber:S.walnut,fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:"'DM Sans',sans-serif" }}>
{cat==='adult'?'👤 Adult':'🧒 Kids'}
</button>
))}
</div>
<div style={{ display:'flex',gap:8 }}>
<input value={currentGroup.customMeal} onChange={e=>updateGroup(currentGroupIdx,{customMeal:e.target.value})}
placeholder={`Exact dish from ${fav.name}`}
style={{ flex:1,padding:'10px 12px',borderRadius:9,border:`1.5px solid ${S.border}`,fontSize:13,fontFamily:"'DM Sans',sans-serif",color:S.forest,outline:'none' }}/>
<div style={{ position:'relative',flexShrink:0 }}>
<span style={{ position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',fontSize:13,color:S.stone }}>$</span>
<input type="number" value={currentGroup.customPrice} onChange={e=>updateGroup(currentGroupIdx,{customPrice:e.target.value})}
placeholder="0.00"
style={{ width:72,padding:'10px 10px 10px 22px',borderRadius:9,border:`1.5px solid ${S.border}`,fontSize:13,fontFamily:"'DM Sans',sans-serif",color:S.forest,outline:'none' }}/>
</div>
<button onClick={addCustomToCart} disabled={!currentGroup.customMeal.trim()||!(parseFloat(currentGroup.customPrice||'0')>0)}
style={{ background:(!currentGroup.customMeal.trim()||!(parseFloat(currentGroup.customPrice||'0')>0))?S.border:S.amber,border:'none',borderRadius:9,color:S.white,fontSize:13,fontWeight:600,padding:'10px 14px',cursor:'pointer',fontFamily:"'DM Sans',sans-serif",flexShrink:0 }}>Add</button>
</div>

{/* ── CART SUMMARY ── */}
{currentGroup.cart.length>0&&(
<div style={{ background:S.white,border:`1.5px solid ${S.amberBorder}`,borderRadius:12,padding:'14px 16px',marginTop:16 }}>
<p style={{ fontSize:10,fontWeight:700,color:S.stone,letterSpacing:'0.08em',textTransform:'uppercase',margin:'0 0 10px' }}>Your order</p>
{currentGroup.cart.map((c,i)=>(
<div key={i} style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6 }}>
<span style={{ fontSize:13,color:S.forest }}>
<span style={{ fontSize:10,marginRight:4 }}>{c.category==='kids'?'🧒':'👤'}</span>
{c.name} <span style={{ color:S.stone }}>×{c.qty}</span>
</span>
<span style={{ fontSize:13,fontWeight:600,color:S.forest }}>${(c.price*c.qty).toFixed(2)}</span>
</div>
))}
<div style={{ height:0.5,background:S.border,margin:'8px 0' }}/>
<div style={{ display:'flex',justifyContent:'space-between',alignItems:'center' }}>
<span style={{ fontSize:13,fontWeight:700,color:S.forest }}>{cartCount(currentGroup.cart)} item{cartCount(currentGroup.cart)>1?'s':''}{groups.length>0&&currentGroup.slots.length>1?` × ${currentGroup.slots.length} dates`:''}</span>
<span style={{ fontSize:14,fontWeight:700,color:S.amber }}>${cartTotal(currentGroup.cart).toFixed(2)}{currentGroup.slots.length>1?'/date':''}</span>
</div>
{(() => {
const comp = groupComposition(currentGroup)
const count = cartCount(currentGroup.cart)
let msg = ''
if (count >= comp.total && comp.total>1) msg = 'Feeding the whole household 🧡'
else if (count === 1) msg = `Just for ${recipientFirst} today`
else if (count < comp.total) msg = `${count} of ${comp.total} covered`
return msg ? <p style={{ fontSize:12,color:S.amber,fontWeight:500,margin:'8px 0 0',textAlign:'center' }}>{msg}</p> : null
})()}
</div>
)}
</div>
)}
</div>
)
})}

<div style={{ display:'flex',gap:10,marginTop:16 }}>
<button onClick={()=>{ if(currentGroupIdx>0){setCurrentGroupIdx(i=>i-1)}else{goToStep(1)} }} style={back}>← Back</button>
<button onClick={handleGroupNext} disabled={!groupReady(currentGroup)} style={{ ...btn(!groupReady(currentGroup)),flex:1 }}>
{currentGroupIdx<groups.length-1?`Next: ${MEAL_TYPE_LABELS[groups[currentGroupIdx+1]?.mealType]} →`:'Next: Your Info →'}
</button>
</div>
</>)}

{/* ── Step 3 ── */}
{step===3&&(<>
<h2 style={h2}>Almost done!</h2>
<p style={sub}>Let {recipientFirst} know who's sending love.</p>

<div style={{ background:S.amberLight,borderRadius:14,padding:'16px',marginBottom:20 }}>
{groups.map((g,i)=>{const mc=MEAL_TYPE_COLORS[g.mealType]||MEAL_TYPE_COLORS.dinner;return(
<div key={g.mealType} style={{ paddingBottom:i<groups.length-1?10:0,marginBottom:i<groups.length-1?10:0,borderBottom:i<groups.length-1?'1px solid #C8DDD0':'none' }}>
<span style={{ background:mc.bg,color:mc.color,borderRadius:20,fontSize:10,fontWeight:600,padding:'2px 8px',border:`1px solid ${mc.color}`,display:'inline-block',marginBottom:6 }}>{MEAL_TYPE_LABELS[g.mealType]} · {g.slots.length} date{g.slots.length>1?'s':''}</span>
<div style={{ fontSize:12,color:S.walnut,fontWeight:300,marginBottom:4 }}>{g.restaurant?.name}</div>
{g.cart.map((c,ci)=>(
<div key={ci} style={{ fontSize:13,color:S.mahogany,fontWeight:500 }}>{c.category==='kids'?'🧒':'👤'} {c.name} ×{c.qty}</div>
))}
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
style={{ flex:1,padding:'14px 12px',borderRadius:12,border:`2px solid ${deliveryPreference===pref.value?S.amber:S.amberBorder}`,background:deliveryPreference===pref.value?S.amberLight:S.warmWhite,cursor:'pointer',textAlign:'left',fontFamily:"'DM Sans',sans-serif",transition:'all 0.15s' }}>
<div style={{ fontSize:22,marginBottom:6 }}>{pref.icon}</div>
<div style={{ fontSize:13,fontWeight:600,color:deliveryPreference===pref.value?S.amber:S.mahogany,marginBottom:3 }}>{pref.title}</div>
<div style={{ fontSize:11,color:S.stone,fontWeight:300,lineHeight:1.4 }}>{pref.subtitle}</div>
</button>
))}
</div>

<label style={lbl}>Delivery note <span style={{ fontWeight:300,textTransform:'none',letterSpacing:0 }}>(optional)</span></label>
<input value={deliveryNote} onChange={e=>setDeliveryNote(e.target.value)} placeholder="Gate code 4521 · leave at back door" style={inp}/>

<label style={lbl}>Tip for your Dasher</label>
<div style={{ background:S.amberLight,border:`1.5px solid ${S.amberBorder}`,borderRadius:14,padding:'14px 16px',marginBottom:12 }}>
<div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6 }}>
<div>
<p style={{ fontSize:14,fontWeight:700,color:S.forest,margin:'0 0 3px' }}>🚗 Recommended tip: ${(activeTipTier?.default||300)/100}</p>
<p style={{ fontSize:12,color:S.stone,margin:0,fontWeight:300,lineHeight:1.5 }}>
{activeMiles !== null ? `For a ${activeMiles.toFixed(1)} mi delivery — helps ensure quick pickup` : 'Helps ensure prompt pickup and a happy Dasher'}
</p>
</div>
<span style={{ fontSize:22,fontWeight:700,color:S.sage,marginLeft:16,flexShrink:0 }}>${tipDollars.toFixed(2)}</span>
</div>
{activeTipTier?.warning&&(
<div style={{ background:'rgba(255,255,255,0.6)',borderRadius:8,padding:'8px 10px',marginTop:8 }}>
<p style={{ fontSize:11,color:activeMiles!<10?'#7A5800':S.red,margin:0,fontWeight:600 }}>{activeTipTier.warning}</p>
</div>
)}
</div>
<button onClick={()=>setShowTipAdjust(s=>!s)} style={{ background:'none',border:'none',cursor:'pointer',fontSize:12,color:S.stone,fontFamily:"'DM Sans',sans-serif",padding:'0 0 14px',display:'flex',alignItems:'center',gap:4 }}>
<span>{showTipAdjust?'▲':'▼'}</span><span>{showTipAdjust?'Hide':'Adjust tip'}</span>
</button>
{showTipAdjust&&(
<div style={{ display:'flex',gap:8,marginBottom:20 }}>
{(activeTipTier?.options||[{label:'No tip',value:0},{label:'$2',value:200},{label:'$3',value:300},{label:'$5',value:500}]).map(opt=>(
<button key={opt.value} onClick={()=>setTipAmount(opt.value)}
style={{ flex:1,padding:'11px 4px',borderRadius:10,border:'none',background:tipAmount===opt.value?S.sage:S.sageLight,color:tipAmount===opt.value?S.white:S.sage,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",transition:'all 0.15s' }}>
{opt.label}
</button>
))}
</div>
)}

{/* Price breakdown */}
{mealSubtotal > 0 && (
<div style={{ background:S.white,border:`1px solid ${S.border}`,borderRadius:14,padding:'14px 16px',marginBottom:20 }}>
<p style={{ fontSize:11,fontWeight:700,color:S.stone,letterSpacing:'0.08em',textTransform:'uppercase',margin:'0 0 10px' }}>Price estimate</p>
{groups.map(g=>{
const sub=cartTotal(g.cart)*g.slots.length
if(!sub)return null
return (
<div key={g.mealType} style={{ display:'flex',justifyContent:'space-between',marginBottom:4 }}>
<span style={{ fontSize:13,color:S.stone }}>{MEAL_TYPE_LABELS[g.mealType]?.split(' ')[1]}: {cartCount(g.cart)} item{cartCount(g.cart)>1?'s':''}{g.slots.length>1?` × ${g.slots.length}`:''}</span>
<span style={{ fontSize:13,color:S.forest,fontWeight:500 }}>${sub.toFixed(2)}</span>
</div>
)
})}
<div style={{ display:'flex',justifyContent:'space-between',marginBottom:4 }}>
<span style={{ fontSize:13,color:S.stone }}>Courier delivery fee</span>
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
<span style={{ fontSize:14,fontWeight:700,color:S.amber }}>${grandTotal.toFixed(2)}</span>
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
<button onClick={()=>goToStep(2)} style={back}>← Back</button>
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

const h2: React.CSSProperties = { fontFamily:"'Lora',serif",fontSize:22,fontWeight:500,color:'#5C3317',margin:'0 0 6px' }
const sub: React.CSSProperties = { fontSize:14,color:'#7A5C3A',margin:'0 0 20px',fontWeight:300 }
const btn = (d:boolean): React.CSSProperties => ({ width:'100%',padding:'14px',borderRadius:10,border:'none',background:d?'#E0C89A':'#5C3317',color:d?'#7A5C3A':'#fff',fontSize:14,fontWeight:500,cursor:d?'default':'pointer',fontFamily:"'DM Sans',sans-serif" })
const back: React.CSSProperties = { padding:'14px 20px',borderRadius:10,border:`1.5px solid #E0C89A`,background:'transparent',fontSize:14,color:'#7A5C3A',cursor:'pointer',fontFamily:"'DM Sans',sans-serif" }
const lbl: React.CSSProperties = { fontSize:11,fontWeight:600,color:'#7A5C3A',letterSpacing:1.5,textTransform:'uppercase',display:'block',marginBottom:8 }
const inp: React.CSSProperties = { width:'100%',padding:'13px 16px',borderRadius:10,border:'1.5px solid #E0C89A',fontSize:16,background:'#FFFCF5',outline:'none',boxSizing:'border-box',marginBottom:20,fontFamily:"'DM Sans',sans-serif",color:'#5C3317' }

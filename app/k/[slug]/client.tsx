'use client'
// FILE: app/k/[slug]/client.tsx
// v3: Google Places search + recipient favorites + 7-day recent meals warning

import { useState, useEffect, useCallback } from 'react'

const S = {
  sage: '#3D6B4F', sageMid: '#6B9E7E', sageLight: '#EAF2ED',
  cream: '#FAFAF5', forest: '#1E2620', stone: '#6B7066',
  border: '#DDE8E0', white: '#FFFFFF', amber: '#C17F47',
  amberLight: '#FBF0E4', red: '#B94040',
}

const MEAL_TYPE_LABELS: Record<string, string> = {
  breakfast: '🌅 Breakfast', lunch: '☀️ Lunch', dinner: '🌙 Dinner',
}
const MEAL_TYPE_COLORS: Record<string, { color: string; bg: string }> = {
  breakfast: { color: '#E8834A', bg: '#FFF0E8' },
  lunch:     { color: '#4A8FA8', bg: '#E8F4F8' },
  dinner:    { color: '#3D6B4F', bg: '#EAF2ED' },
}
const TIP_OPTIONS = [
  { label: 'No tip', value: 0 }, { label: '$2', value: 200 },
  { label: '$3', value: 300 }, { label: '$5', value: 500 },
]
const DELIVERY_PREFS = [
  { value: 'leave_at_door',     icon: '🚪', title: 'Leave at door',  subtitle: 'Text me when arrived — do not knock or ring' },
  { value: 'hand_to_recipient', icon: '🤝', title: 'Hand to me',     subtitle: 'Driver should hand the order directly' },
]

type PlaceResult = {
  place_id: string; name: string; address: string
  rating: number | null; is_open: boolean | null
}
type MenuItem = {
  id: string; name: string; description: string
  price: number; category: string; is_favorite?: boolean
}
type Group = {
  mealType: string; slots: any[]
  restaurant: PlaceResult | null
  menuItem:   MenuItem | null
  customMeal: string
}

// ── Sub-components ─────────────────────────────────────────────────────────
function MealHistory({ meals, recipientFirstName }: { meals: any[]; recipientFirstName: string }) {
  const [expanded, setExpanded] = useState(false)
  if (!meals || meals.length === 0) return null
  const tally: Record<string, number> = {}
  meals.forEach(m => { tally[m.restaurant_name] = (tally[m.restaurant_name] || 0) + 1 })
  const sorted = Object.entries(tally).sort((a, b) => b[1] - a[1])
  const max    = sorted[0]?.[1] || 1
  const fmtD   = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return (
    <div style={{ background: '#fff', border: '1px solid #DDE8E0', borderRadius: 14, marginBottom: 20, overflow: 'hidden' }}>
      <button onClick={() => setExpanded(e => !e)} style={{ width: '100%', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 16 }}>📋</span>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1E2620' }}>What {recipientFirstName} has received</div>
            <div style={{ fontSize: 11, color: '#6B7066', fontWeight: 300, marginTop: 1 }}>{meals.length} meal{meals.length > 1 ? 's' : ''} · tap to avoid repeats</div>
          </div>
        </div>
        <span style={{ fontSize: 14, color: '#6B7066', transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'none' }}>▾</span>
      </button>
      {expanded && (
        <div style={{ borderTop: '0.5px solid #DDE8E0', padding: '14px 16px' }}>
          {sorted.map(([name, count]) => (
            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 7 }}>
              <span style={{ fontSize: 12, color: '#1E2620', fontWeight: 500, width: 140, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
              <div style={{ flex: 1, height: 6, background: '#EAF2ED', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', background: '#3D6B4F', borderRadius: 3, width: `${(count / max) * 100}%` }} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#3D6B4F', width: 20, textAlign: 'right', flexShrink: 0 }}>{count}×</span>
            </div>
          ))}
          {meals.map((m, i) => {
            const mc = MEAL_TYPE_COLORS[m.meal_type] || MEAL_TYPE_COLORS.dinner
            return (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: i < meals.length - 1 ? '0.5px solid #EAF2ED' : 'none' }}>
                <span style={{ background: mc.bg, color: mc.color, fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 20, flexShrink: 0 }}>{MEAL_TYPE_LABELS[m.meal_type]?.split(' ')[1] || m.meal_type}</span>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#1E2620', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.meal_name}</div>
                  <div style={{ fontSize: 11, color: '#6B7066', fontWeight: 300 }}>{m.restaurant_name}</div>
                </div>
                <span style={{ fontSize: 11, color: '#6B7066', fontWeight: 300, flexShrink: 0 }}>{fmtD(m.delivery_date)}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function CoordCalendar({ availableDates, selectedIds, onToggle }: { availableDates: any[]; selectedIds: Set<string>; onToggle: (s: any) => void }) {
  const today = new Date()
  const [viewYear, setViewYear]   = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const todayStr    = today.toISOString().split('T')[0]
  const monthName   = new Date(viewYear, viewMonth, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const firstDay    = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const prevMonth   = () => { if (viewMonth === 0) { setViewYear(y=>y-1); setViewMonth(11) } else setViewMonth(m=>m-1) }
  const nextMonth   = () => { if (viewMonth === 11) { setViewYear(y=>y+1); setViewMonth(0) } else setViewMonth(m=>m+1) }
  const dateMap: Record<string, any[]> = {}
  availableDates.forEach(d => { if (!dateMap[d.date]) dateMap[d.date]=[]; dateMap[d.date].push(d) })
  const cells: (number|null)[] = []
  for (let i=0;i<firstDay;i++) cells.push(null)
  for (let d=1;d<=daysInMonth;d++) cells.push(d)
  return (
    <div style={{ background:'#fff',border:'1px solid #DDE8E0',borderRadius:16,padding:'16px',marginBottom:20 }}>
      <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12 }}>
        <button onClick={prevMonth} style={{ background:'#EAF2ED',border:'none',borderRadius:8,width:32,height:32,cursor:'pointer',fontSize:16,color:'#3D6B4F',display:'flex',alignItems:'center',justifyContent:'center' }}>‹</button>
        <p style={{ fontFamily:"'Lora',serif",fontSize:16,fontWeight:500,color:'#1E2620',margin:0 }}>{monthName}</p>
        <button onClick={nextMonth} style={{ background:'#EAF2ED',border:'none',borderRadius:8,width:32,height:32,cursor:'pointer',fontSize:16,color:'#3D6B4F',display:'flex',alignItems:'center',justifyContent:'center' }}>›</button>
      </div>
      <div style={{ display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:3,marginBottom:3 }}>
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d=><div key={d} style={{ textAlign:'center',fontSize:10,fontWeight:600,color:'#6B7066',padding:'3px 0' }}>{d}</div>)}
      </div>
      <div style={{ display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:3 }}>
        {cells.map((day,i)=>{
          if (!day) return <div key={i}/>
          const ds=`${viewYear}-${String(viewMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
          const isPast=ds<todayStr,isToday=ds===todayStr
          const slots=dateMap[ds]||[],hasSlots=slots.length>0
          const isSel=slots.some((s:any)=>selectedIds.has(s.id))
          return (
            <button key={i} onClick={()=>{ if(!hasSlots||isPast)return;slots.forEach((s:any)=>onToggle(s)) }} disabled={isPast||!hasSlots}
              style={{ background:isSel?'#EAF2ED':hasSlots?'#F8FAF8':'transparent',border:isToday?'2px solid #3D6B4F':isSel?'2px solid #3D6B4F':hasSlots?'1.5px solid #DDE8E0':'1.5px solid transparent',borderRadius:10,padding:'8px 2px',minHeight:52,cursor:hasSlots&&!isPast?'pointer':'default',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:3,fontFamily:"'DM Sans',sans-serif",opacity:isPast?0.35:1,transition:'all 0.1s' }}>
              <span style={{ fontSize:13,fontWeight:isToday?700:500,color:isPast?'#C8D5CA':isSel?'#3D6B4F':'#1E2620',lineHeight:1 }}>{day}</span>
              {hasSlots&&<div style={{ display:'flex',gap:2 }}>{slots.map((s:any,si:number)=>{const mc=MEAL_TYPE_COLORS[s.meal_type]||MEAL_TYPE_COLORS.dinner;return<div key={si} style={{ width:6,height:6,borderRadius:'50%',background:selectedIds.has(s.id)?mc.color:'#C8D5CA',flexShrink:0 }}/>})}</div>}
            </button>
          )
        })}
      </div>
      <div style={{ display:'flex',gap:12,flexWrap:'wrap',marginTop:14,paddingTop:12,borderTop:'1px solid #EAF2ED' }}>
        {[{dot:'#E8834A',label:'Breakfast'},{dot:'#4A8FA8',label:'Lunch'},{dot:'#3D6B4F',label:'Dinner'},{dot:'#C8D5CA',label:'Not selected'}].map(({dot,label})=>(
          <div key={label} style={{ display:'flex',alignItems:'center',gap:5 }}><div style={{ width:7,height:7,borderRadius:'50%',background:dot,flexShrink:0 }}/><span style={{ fontSize:11,color:'#6B7066',fontWeight:500 }}>{label}</span></div>
        ))}
      </div>
    </div>
  )
}

// ── Restaurant Search ─────────────────────────────────────────────────────────
function RestaurantSearch({
  kitchen, mealType, onSelect, currentRestaurant
}: {
  kitchen: any; mealType: string; onSelect: (r: PlaceResult, items: MenuItem[]) => void; currentRestaurant: PlaceResult | null
}) {
  const [query,       setQuery]       = useState('')
  const [results,     setResults]     = useState<PlaceResult[]>([])
  const [menuItems,   setMenuItems]   = useState<MenuItem[]>([])
  const [searching,   setSearching]   = useState(false)
  const [loadingMenu, setLoadingMenu] = useState(false)
  const [searched,    setSearched]    = useState(false)
  const [noMenu,      setNoMenu]      = useState(false)

  const defaultQuery: Record<string, string> = {
    breakfast: 'breakfast brunch',
    lunch:     'lunch restaurant',
    dinner:    'dinner restaurant',
  }

  const search = useCallback(async (q?: string) => {
    const searchQ = q ?? query ?? defaultQuery[mealType]
    if (!kitchen?.latitude || !kitchen?.longitude) return
    setSearching(true); setSearched(true)
    try {
      const res  = await fetch(`/api/restaurants/search?lat=${kitchen.latitude}&lng=${kitchen.longitude}&query=${encodeURIComponent(searchQ)}`)
      const data = await res.json()
      setResults(data.restaurants || [])
    } catch {
      setResults([])
    }
    setSearching(false)
  }, [query, mealType, kitchen])

  // Auto-search on mount
  useEffect(() => { search(defaultQuery[mealType]) }, [mealType])

  const handleSelect = async (place: PlaceResult) => {
    setLoadingMenu(true); setNoMenu(false)
    try {
      const res  = await fetch(`/api/restaurants/menu?name=${encodeURIComponent(place.name)}&slug=${encodeURIComponent(kitchen.slug || '')}`)
      const data = await res.json()
      if (data.items && data.items.length > 0) {
        setMenuItems(data.items)
        onSelect(place, data.items)
      } else {
        // No chain match and no saved favorites — go straight to free text
        setNoMenu(true)
        onSelect(place, [])
      }
    } catch {
      setNoMenu(true)
      onSelect(place, [])
    }
    setLoadingMenu(false)
  }

  const priceLabel = (level: number | null) => level ? '$'.repeat(level) : ''

  return (
    <div>
      {/* Search bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search()}
          placeholder={`Search near recipient — try "thai food" or "Chipotle"`}
          style={{ flex: 1, padding: '12px 14px', borderRadius: 10, border: '1.5px solid #DDE8E0', fontSize: 14, fontFamily: "'DM Sans', sans-serif", color: '#1E2620', outline: 'none' }}
        />
        <button onClick={() => search()} disabled={searching}
          style={{ padding: '12px 18px', borderRadius: 10, border: 'none', background: searching ? '#DDE8E0' : '#3D6B4F', color: '#fff', fontSize: 13, fontWeight: 600, cursor: searching ? 'default' : 'pointer', fontFamily: "'DM Sans', sans-serif", flexShrink: 0 }}>
          {searching ? '…' : 'Search'}
        </button>
      </div>

      {/* Results */}
      {searching && (
        <div style={{ padding: '20px', textAlign: 'center', color: '#6B7066', fontSize: 13 }}>Finding restaurants near {kitchen?.address?.split(',')[1]?.trim() || 'recipient'}…</div>
      )}

      {!searching && results.length === 0 && searched && (
        <div style={{ background: '#EAF2ED', borderRadius: 12, padding: '16px', textAlign: 'center' }}>
          <p style={{ color: '#3D6B4F', margin: 0, fontSize: 13 }}>No results — try a different search term.</p>
        </div>
      )}

      {!searching && results.map(place => (
        <button key={place.place_id}
          onClick={() => handleSelect(place)}
          disabled={loadingMenu}
          style={{ width: '100%', background: currentRestaurant?.place_id === place.place_id ? '#EAF2ED' : '#fff', border: `2px solid ${currentRestaurant?.place_id === place.place_id ? '#3D6B4F' : '#DDE8E0'}`, borderRadius: 14, padding: '14px 16px', cursor: loadingMenu ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 14, fontFamily: "'DM Sans', sans-serif", marginBottom: 8, textAlign: 'left' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
              <span style={{ fontFamily: "'Lora', serif", fontSize: 15, fontWeight: 600, color: '#1E2620' }}>{place.name}</span>
              {place.is_open === true  && <span style={{ fontSize: 9, fontWeight: 700, background: '#EAF2ED', color: '#3D6B4F', borderRadius: 20, padding: '2px 7px' }}>Open</span>}
              {place.is_open === false && <span style={{ fontSize: 9, fontWeight: 700, background: '#FDE8E8', color: '#B94040', borderRadius: 20, padding: '2px 7px' }}>Closed</span>}
            </div>
            <div style={{ fontSize: 12, color: '#6B7066', fontWeight: 300 }}>{place.address}</div>
            {place.rating && <div style={{ fontSize: 11, color: '#C17F47', fontWeight: 500, marginTop: 2 }}>★ {place.rating}</div>}
          </div>
          {loadingMenu && currentRestaurant?.place_id === place.place_id
            ? <span style={{ color: '#6B7066', fontSize: 12 }}>Loading…</span>
            : currentRestaurant?.place_id === place.place_id
              ? <span style={{ color: '#3D6B4F', fontSize: 20 }}>✓</span>
              : null}
        </button>
      ))}
    </div>
  )
}

// ── Menu Selector ─────────────────────────────────────────────────────────────
function MenuSelector({
  restaurant, menuItems, currentItem, onSelect, customMeal, onCustomChange
}: {
  restaurant: PlaceResult; menuItems: MenuItem[]; currentItem: MenuItem | null
  onSelect: (item: MenuItem) => void; customMeal: string; onCustomChange: (v: string) => void
}) {
  const [showCustom, setShowCustom] = useState(menuItems.length === 0)

  if (menuItems.length === 0) {
    return (
      <div>
        <div style={{ background: '#FBF0E4', border: '1px solid #E8C88A', borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
          <p style={{ fontSize: 13, color: '#7A5800', margin: '0 0 6px', fontWeight: 600 }}>Enter the exact dish name</p>
          <p style={{ fontSize: 12, color: '#7A5800', margin: 0, fontWeight: 300, lineHeight: 1.5 }}>
            Be specific so the recipient recognizes it and the restaurant can prepare it — e.g. "Smash Burger with fries" not just "burger."
          </p>
        </div>
        <input
          value={customMeal}
          onChange={e => onCustomChange(e.target.value)}
          placeholder={`Exact dish name from ${restaurant.name}`}
          style={{ width: '100%', padding: '13px 16px', borderRadius: 10, border: '1.5px solid #DDE8E0', fontSize: 14, fontFamily: "'DM Sans', sans-serif", color: '#1E2620', outline: 'none', boxSizing: 'border-box' }}
        />
        <p style={{ fontSize: 11, color: '#6B7066', marginTop: 6, fontWeight: 300, lineHeight: 1.5 }}>
          💡 Tip: Ask the recipient to add their go-to meals for this restaurant in their dashboard — next time coordinators will see them automatically.
        </p>
      </div>
    )
  }

  const categories = [...new Set(menuItems.map(i => i.category))]

  return (
    <div>
      {categories.map(cat => (
        <div key={cat} style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: '#6B7066', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 8px' }}>{cat}</p>
          {menuItems.filter(i => i.category === cat).map(item => (
            <button key={item.id} onClick={() => onSelect(item)}
              style={{ width: '100%', background: currentItem?.id === item.id ? '#EAF2ED' : '#fff', border: `2px solid ${currentItem?.id === item.id ? '#3D6B4F' : '#DDE8E0'}`, borderRadius: 12, padding: '12px 14px', cursor: 'pointer', textAlign: 'left', display: 'flex', gap: 12, alignItems: 'flex-start', fontFamily: "'DM Sans', sans-serif", marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "'Lora', serif", fontSize: 14, fontWeight: 600, color: '#1E2620' }}>
                  {item.is_favorite ? '⭐ ' : ''}{item.name}
                </div>
                <div style={{ fontSize: 12, color: '#6B7066', fontWeight: 300, marginTop: 2, lineHeight: 1.4 }}>{item.description}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#3D6B4F' }}>${item.price.toFixed(2)}</span>
                {currentItem?.id === item.id && <span style={{ color: '#3D6B4F', fontSize: 16 }}>✓</span>}
              </div>
            </button>
          ))}
        </div>
      ))}
      <button onClick={() => setShowCustom(s => !s)} style={{ background: 'none', border: 'none', color: '#3D6B4F', fontSize: 12, fontWeight: 500, cursor: 'pointer', padding: '4px 0', fontFamily: "'DM Sans', sans-serif", textDecoration: 'underline' }}>
        {showCustom ? 'Hide custom entry' : "Don't see the item? Enter a custom meal"}
      </button>
      {showCustom && (
        <div style={{ marginTop: 10 }}>
          <input
            value={customMeal}
            onChange={e => onCustomChange(e.target.value)}
            placeholder={`Enter item name from ${restaurant.name}`}
            style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1.5px solid #DDE8E0', fontSize: 14, fontFamily: "'DM Sans', sans-serif", color: '#1E2620', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
      )}
    </div>
  )
}

function CoordFooter() {
  return (
    <footer style={{ background: '#1E2620', padding: '48px 24px', textAlign: 'center', marginTop: 40, fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ fontSize: 9, fontWeight: 500, letterSpacing: 5, color: '#6B9E7E', textTransform: 'uppercase', marginBottom: 2 }}>Your</div>
      <div style={{ fontFamily: "'Lora', serif", fontSize: 24, fontWeight: 500, color: '#fff', letterSpacing: -0.5, marginBottom: 8 }}>Kitchen</div>
      <p style={{ fontFamily: "'Lora', serif", fontStyle: 'italic', fontSize: 13, color: '#6B9E7E', margin: '0 0 20px' }}>"Your kitchen, covered."</p>
      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.18)', margin: 0 }}>© 2026 YourKitchen LLC · All rights reserved</p>
    </footer>
  )
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
export default function CoordKitchenClient({ kitchen, availableDates, recentMeals = [] }: any) {
  const [step,               setStep]               = useState<1|2|3>(1)
  const [selectedIds,        setSelectedIds]        = useState<Set<string>>(new Set())
  const [groups,             setGroups]             = useState<Group[]>([])
  const [currentGroupIndex,  setCurrentGroupIndex]  = useState(0)
  const [groupSubStep,       setGroupSubStep]       = useState<'restaurant'|'menu'>('restaurant')
  const [favorites,          setFavorites]          = useState<any[]>([])
  const [name,               setName]               = useState('')
  const [email,              setEmail]              = useState('')
  const [phone,              setPhone]              = useState('')
  const [note,               setNote]               = useState('')
  const [tipAmount,          setTipAmount]          = useState(300)
  const [deliveryPreference, setDeliveryPreference] = useState<'leave_at_door'|'hand_to_recipient'>('leave_at_door')
  const [deliveryNote,       setDeliveryNote]       = useState('')
  const [loading,            setLoading]            = useState(false)
  const [submitted,          setSubmitted]          = useState(false)
  const [errorMsg,           setErrorMsg]           = useState('')

  // Fetch recipient's favorite restaurants
  useEffect(() => {
    fetch(`/api/restaurants/favorites?slug=${kitchen.slug}`)
      .then(r => r.json())
      .then(d => setFavorites(d.favorites || []))
      .catch(() => {})
  }, [kitchen.slug])

  // 7-day recent meals for coordinator warning
  const sevenDaysAgo    = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const recentMeals7    = recentMeals.filter((m: any) => m.delivery_date >= sevenDaysAgo)
  const recentRestNames = new Set(recentMeals7.map((m: any) => m.restaurant_name?.toLowerCase()))
  const recentMealNames = new Set(recentMeals7.map((m: any) => m.meal_name?.toLowerCase()))

  const selectedSlots      = availableDates.filter((d: any) => selectedIds.has(d.id))
  const recipientFirstName = kitchen.name?.split("'")[0] || 'them'

  const toggleSlot = (slot: any) => setSelectedIds(prev => { const n=new Set(prev);if(n.has(slot.id))n.delete(slot.id);else n.add(slot.id);return n })
  const removeSlot = (id: string) => setSelectedIds(prev => { const n=new Set(prev);n.delete(id);return n })

  const buildGroups = (): Group[] => {
    const order = ['breakfast','lunch','dinner']
    const map: Record<string,any[]> = {}
    selectedSlots.forEach((s:any)=>{ const mt=s.meal_type||'dinner';if(!map[mt])map[mt]=[];map[mt].push(s) })
    return order.filter(mt=>map[mt]).map(mt=>({ mealType:mt, slots:map[mt], restaurant:null, menuItem:null, customMeal:'' }))
  }

  const handleProceedToGroups = () => { const g=buildGroups();setGroups(g);setCurrentGroupIndex(0);setGroupSubStep('restaurant');setStep(2) }
  const currentGroup  = groups[currentGroupIndex]
  const updateGroup   = (i: number, u: Partial<Group>) => setGroups(prev=>prev.map((g,idx)=>idx===i?{...g,...u}:g))

  const handleRestaurantSelect = (r: PlaceResult, items: MenuItem[]) => {
    updateGroup(currentGroupIndex, { restaurant: r, menuItem: null, customMeal: '' })
    // Store menu items on the group for display
    setGroups(prev => prev.map((g,i) => i===currentGroupIndex ? {...g, restaurant:r, menuItem:null, customMeal:'', menuItems:items} as any : g))
    setGroupSubStep('menu')
  }

  const handleGroupNext = () => {
    if (currentGroupIndex < groups.length - 1) { setCurrentGroupIndex(i=>i+1); setGroupSubStep('restaurant') }
    else setStep(3)
  }
  const handleGroupBack = () => {
    if (groupSubStep==='menu') setGroupSubStep('restaurant')
    else if (currentGroupIndex>0) { setCurrentGroupIndex(i=>i-1);setGroupSubStep('menu') }
    else setStep(1)
  }

  const getNotePlaceholder = () => {
    const types = [...new Set(selectedSlots.map((s:any)=>s.meal_type))]
    if (types.includes('breakfast')&&types.includes('dinner')) return "Starting your day and ending it with a little love 🧡"
    if (types.includes('breakfast')) return "Hope this breakfast starts your day with a little warmth 🌅"
    if (types.includes('lunch')) return "Thinking of you today — hope this gives you a moment to breathe ☀️"
    return "Hope dinner tonight is one less thing to worry about 🧡"
  }

  const handleSubmit = async () => {
    setLoading(true); setErrorMsg('')
    const proposals = groups.flatMap(g => g.slots.map((slot: any) => ({
      calendar_date_id:  slot.id,
      place_id:          g.restaurant?.place_id,
      restaurant_name:   g.restaurant?.name,
      restaurant_address: g.restaurant?.address,
      menu_item_name:    g.menuItem?.name || (g as any).customMeal,
      menu_item_price:   g.menuItem?.price || 15,
      delivery_date:     slot.date,
      meal_type:         slot.meal_type,
    })))
    try {
      const res = await fetch('/api/proposal', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, email, phone, note, proposals,
          kitchen_slug:        kitchen.slug,
          tip_amount:          tipAmount,
          delivery_preference: deliveryPreference,
          delivery_note:       deliveryNote.trim() || null,
          use_places:          true, // flag for proposal route to handle differently
        }),
      })
      const data = await res.json()
      if (!res.ok) { setErrorMsg(data.error || 'Something went wrong.'); setLoading(false); return }
      window.location.href = data.checkout_url
    } catch (err: any) { setErrorMsg('Network error. Please try again.'); setLoading(false) }
  }

  const totalDates = groups.reduce((sum, g) => sum + g.slots.length, 0)
  const currentMenuItems = (currentGroup as any)?.menuItems || []
  const groupReady = (g: Group & { menuItems?: MenuItem[] }) =>
    g.restaurant && (g.menuItem || (g as any).customMeal?.trim())

  return (
    <div style={{ minHeight:'100vh',background:'#FAFAF5',fontFamily:"'DM Sans',sans-serif",display:'flex',flexDirection:'column' }}>
      <link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet"/>

      {/* Header */}
      <div style={{ background:'#1E2620',padding:'20px 24px',textAlign:'center' }}>
        <div style={{ fontSize:9,fontWeight:500,letterSpacing:5,color:'#6B9E7E',textTransform:'uppercase' }}>Your</div>
        <div style={{ fontFamily:"'Lora',serif",fontSize:24,fontWeight:500,color:'#fff' }}>Kitchen</div>
      </div>

      <div style={{ background:'#fff',borderBottom:'1px solid #DDE8E0',padding:'20px 24px',textAlign:'center' }}>
        <h1 style={{ fontFamily:"'Lora',serif",fontSize:22,fontWeight:500,color:'#1E2620',margin:'0 0 4px' }}>{kitchen.name}</h1>
        {kitchen.dietary_restrictions?.length > 0 && (
          <div style={{ display:'flex',gap:6,justifyContent:'center',flexWrap:'wrap',marginTop:10 }}>
            {kitchen.dietary_restrictions.map((d:string)=>(
              <span key={d} style={{ background:'#EAF2ED',color:'#3D6B4F',borderRadius:20,fontSize:11,fontWeight:500,padding:'4px 12px' }}>⚠️ {d}</span>
            ))}
          </div>
        )}
      </div>

      <div style={{ display:'flex',gap:6,padding:'20px 24px 0',maxWidth:500,margin:'0 auto',width:'100%' }}>
        {[1,2,3].map(i=><div key={i} style={{ flex:1,height:4,borderRadius:4,background:i<=step?'#3D6B4F':'#DDE8E0',transition:'background 0.3s' }}/>)}
      </div>

      <div style={{ padding:'24px',maxWidth:500,margin:'0 auto',flex:1,width:'100%' }}>

        {/* Step 1 — Date selection */}
        {step===1 && (<>
          <h2 style={h2}>Choose your dates</h2>
          <p style={sub}>Tap any highlighted date to claim it.</p>
          <MealHistory meals={recentMeals} recipientFirstName={recipientFirstName}/>
          {availableDates.length===0 ? (
            <div style={{ background:'#EAF2ED',borderRadius:14,padding:'20px',textAlign:'center',marginBottom:20 }}>
              <p style={{ color:'#3D6B4F',margin:0 }}>No open dates right now. Check back soon!</p>
            </div>
          ) : (
            <CoordCalendar availableDates={availableDates} selectedIds={selectedIds} onToggle={toggleSlot}/>
          )}
          {selectedSlots.length > 0 && (
            <div style={{ background:'#EAF2ED',borderRadius:14,padding:'14px 16px',marginBottom:16 }}>
              <p style={{ fontSize:11,fontWeight:600,color:'#3D6B4F',letterSpacing:1.5,textTransform:'uppercase',margin:'0 0 10px' }}>{selectedSlots.length} date{selectedSlots.length>1?'s':''} selected</p>
              {selectedSlots.map((slot:any)=>{
                const mc=MEAL_TYPE_COLORS[slot.meal_type]||MEAL_TYPE_COLORS.dinner
                const d=new Date(slot.date+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})
                return(
                  <div key={slot.id} style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6 }}>
                    <div style={{ display:'flex',alignItems:'center',gap:8 }}>
                      <span style={{ background:mc.bg,color:mc.color,borderRadius:20,fontSize:10,fontWeight:600,padding:'2px 8px',border:`1px solid ${mc.color}` }}>{MEAL_TYPE_LABELS[slot.meal_type]}</span>
                      <span style={{ fontSize:13,color:'#1E2620',fontWeight:500 }}>{d}</span>
                    </div>
                    <button onClick={()=>removeSlot(slot.id)} style={{ background:'none',border:'none',cursor:'pointer',color:'#6B7066',fontSize:16,padding:'0 4px' }}>✕</button>
                  </div>
                )
              })}
            </div>
          )}
          <button onClick={handleProceedToGroups} disabled={selectedSlots.length===0} style={btn(selectedSlots.length===0)}>
            {selectedSlots.length===0?'Select at least one date':`Next: Choose Meals → (${selectedSlots.length} date${selectedSlots.length>1?'s':''})`}
          </button>
          <div style={{ marginTop:24,paddingTop:24,borderTop:'0.5px solid #DDE8E0',textAlign:'center' }}>
            <p style={{ fontSize:12,color:'#6B7066',fontWeight:300,margin:'0 0 8px',lineHeight:1.6 }}>Does someone you love need their village to show up?</p>
            <a href="/signup" style={{ fontSize:13,color:'#3D6B4F',fontWeight:500,textDecoration:'none',fontFamily:"'DM Sans',sans-serif" }}>Create a free Kitchen →</a>
          </div>
        </>)}

        {/* Step 2 — Restaurant + meal */}
        {step===2 && currentGroup && (<>
          {groups.length > 1 && (
            <div style={{ background:'#fff',border:'1px solid #DDE8E0',borderRadius:12,padding:'12px 16px',marginBottom:16 }}>
              <p style={{ fontSize:11,fontWeight:600,color:'#6B7066',letterSpacing:1.5,textTransform:'uppercase',margin:'0 0 10px' }}>Meal group {currentGroupIndex+1} of {groups.length}</p>
              <div style={{ display:'flex',gap:8 }}>
                {groups.map((g,i)=>{const mc=MEAL_TYPE_COLORS[g.mealType]||MEAL_TYPE_COLORS.dinner;const isDone=i<currentGroupIndex,isCur=i===currentGroupIndex;return(
                  <div key={i} style={{ flex:1 }}>
                    <div style={{ height:4,borderRadius:4,background:isDone||isCur?mc.color:'#DDE8E0',opacity:isCur?1:isDone?1:0.4,transition:'all 0.3s' }}/>
                    <p style={{ fontSize:10,color:isCur?mc.color:'#6B7066',fontWeight:isCur?600:400,margin:'4px 0 0',textAlign:'center' }}>{MEAL_TYPE_LABELS[g.mealType]}</p>
                  </div>
                )})}
              </div>
            </div>
          )}

          {groupSubStep==='restaurant' && (<>
            <h2 style={h2}>{groups.length>1?`Choose a ${currentGroup.mealType} restaurant`:'Choose a restaurant'}</h2>
            <p style={sub}>Searching near {kitchen.address?.split(',').slice(1,2).join(',').trim() || 'recipient'} — {currentGroup.slots.map((s:any)=>new Date(s.date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})).join(', ')}</p>

            {/* ⭐ Recipient's favorites */}
            {favorites.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: S.stone, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 10px' }}>⭐ {recipientFirstName}'s favorites</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {favorites.map((fav: any) => {
                    const orderedRecently = recentRestNames.has(fav.name?.toLowerCase())
                    return (
                      <button key={fav.id}
                        onClick={() => {
                          const place: PlaceResult = { place_id: fav.place_id || fav.id, name: fav.name, address: fav.address || '', rating: null, is_open: null }
                          handleRestaurantSelect(place, [])
                        }}
                        style={{ width: '100%', background: currentGroup.restaurant?.name === fav.name ? S.sageLight : S.white, border: `2px solid ${currentGroup.restaurant?.name === fav.name ? S.sage : S.border}`, borderRadius: 14, padding: '14px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, fontFamily: "'DM Sans', sans-serif", textAlign: 'left' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                            <span style={{ fontSize: 9, fontWeight: 700, background: S.amberLight, color: S.amber, borderRadius: 20, padding: '2px 8px' }}>⭐ Favorite</span>
                            {orderedRecently && <span style={{ fontSize: 9, fontWeight: 700, background: '#FDE8E8', color: S.red, borderRadius: 20, padding: '2px 8px' }}>Ordered recently</span>}
                          </div>
                          <div style={{ fontFamily: "'Lora', serif", fontSize: 15, fontWeight: 600, color: S.forest }}>{fav.name}</div>
                          {fav.address && <div style={{ fontSize: 12, color: S.stone, fontWeight: 300 }}>{fav.address}</div>}
                        </div>
                        {currentGroup.restaurant?.name === fav.name && <span style={{ color: S.sage, fontSize: 20 }}>✓</span>}
                      </button>
                    )
                  })}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '16px 0 10px' }}>
                  <div style={{ flex: 1, height: 0.5, background: S.border }} />
                  <span style={{ fontSize: 11, color: S.stone }}>or search all restaurants</span>
                  <div style={{ flex: 1, height: 0.5, background: S.border }} />
                </div>
              </div>
            )}
            <RestaurantSearch
              kitchen={kitchen} mealType={currentGroup.mealType}
              currentRestaurant={currentGroup.restaurant}
              onSelect={handleRestaurantSelect}
            />
            <div style={{ marginTop:16 }}>
              <button onClick={handleGroupBack} style={back}>← Back</button>
            </div>
          </>)}

          {groupSubStep==='menu' && currentGroup.restaurant && (<>
            <h2 style={h2}>Select a meal</h2>
            <p style={sub}>from <strong>{currentGroup.restaurant.name}</strong></p>

            {/* 7-day recent orders warning */}
            {recentMeals7.filter((m: any) => m.restaurant_name?.toLowerCase() === currentGroup.restaurant!.name.toLowerCase()).length > 0 && (
              <div style={{ background: '#FFF8E8', border: '1px solid #F0E2B8', borderRadius: 12, padding: '12px 14px', marginBottom: 16 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: '#7A5800', margin: '0 0 6px' }}>⚠️ Ordered from here in the last 7 days</p>
                {recentMeals7.filter((m: any) => m.restaurant_name?.toLowerCase() === currentGroup.restaurant!.name.toLowerCase()).map((m: any) => (
                  <p key={m.id} style={{ fontSize: 12, color: '#7A5800', margin: '0 0 2px', fontWeight: 300 }}>· {m.meal_name} ({new Date(m.delivery_date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})})</p>
                ))}
              </div>
            )}
            <MenuSelector
              restaurant={currentGroup.restaurant}
              menuItems={currentMenuItems}
              currentItem={currentGroup.menuItem}
              onSelect={item => updateGroup(currentGroupIndex, { menuItem:item, customMeal:'' })}
              customMeal={(currentGroup as any).customMeal || ''}
              onCustomChange={v => updateGroup(currentGroupIndex, { customMeal:v, menuItem:null } as any)}
            />
            <div style={{ display:'flex',gap:10,marginTop:20 }}>
              <button onClick={handleGroupBack} style={back}>← Back</button>
              <button
                onClick={handleGroupNext}
                disabled={!groupReady(currentGroup as any)}
                style={{ ...btn(!groupReady(currentGroup as any)), flex:1 }}>
                {currentGroupIndex<groups.length-1?`Next: ${MEAL_TYPE_LABELS[groups[currentGroupIndex+1]?.mealType]} →`:'Next: Your Info →'}
              </button>
            </div>
          </>)}
        </>)}

        {/* Step 3 — Info + submit */}
        {step===3 && (<>
          <h2 style={h2}>Almost done!</h2>
          <p style={sub}>Let {recipientFirstName} know who's sending dinner.</p>

          <div style={{ background:'#EAF2ED',borderRadius:14,padding:'16px',marginBottom:20 }}>
            {groups.map((g,i)=>{const mc=MEAL_TYPE_COLORS[g.mealType]||MEAL_TYPE_COLORS.dinner;return(
              <div key={g.mealType} style={{ paddingBottom:i<groups.length-1?10:0,marginBottom:i<groups.length-1?10:0,borderBottom:i<groups.length-1?'1px solid #C8DDD0':'none' }}>
                <span style={{ background:mc.bg,color:mc.color,borderRadius:20,fontSize:10,fontWeight:600,padding:'2px 8px',border:`1px solid ${mc.color}`,display:'inline-block',marginBottom:6 }}>{MEAL_TYPE_LABELS[g.mealType]} · {g.slots.length} date{g.slots.length>1?'s':''}</span>
                <div style={{ fontSize:13,color:'#3D6B4F',fontWeight:600 }}>{g.menuItem?.name||(g as any).customMeal}</div>
                <div style={{ fontSize:12,color:'#6B9E7E',fontWeight:300 }}>{g.restaurant?.name}</div>
              </div>
            )})}
          </div>

          <label style={lbl}>Your name</label>
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="Marques" style={inp}/>
          <label style={lbl}>Your email</label>
          <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" style={inp}/>
          <label style={lbl}>Your phone</label>
          <input type="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="(555) 123-4567" style={inp}/>
          <p style={{ fontSize:12,color:'#6B7066',marginTop:-16,marginBottom:20,fontWeight:300 }}>We'll text you when your meal is delivered.</p>

          <label style={lbl}>Personal note (optional)</label>
          <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder={getNotePlaceholder()} style={{ ...inp,minHeight:90,resize:'none' as const }}/>

          {/* Delivery preference */}
          <label style={lbl}>Delivery preference</label>
          <p style={{ fontSize:12,color:'#6B7066',fontWeight:300,marginTop:-4,marginBottom:10,lineHeight:1.5 }}>For families with a sleeping newborn, "leave at door" is often the kinder choice.</p>
          <div style={{ display:'flex',gap:10,marginBottom:20 }}>
            {DELIVERY_PREFS.map(pref=>(
              <button key={pref.value} onClick={()=>setDeliveryPreference(pref.value as any)}
                style={{ flex:1,padding:'14px 12px',borderRadius:12,border:`2px solid ${deliveryPreference===pref.value?'#3D6B4F':'#DDE8E0'}`,background:deliveryPreference===pref.value?'#EAF2ED':'#fff',cursor:'pointer',textAlign:'left',fontFamily:"'DM Sans',sans-serif",transition:'all 0.15s' }}>
                <div style={{ fontSize:22,marginBottom:6 }}>{pref.icon}</div>
                <div style={{ fontSize:13,fontWeight:600,color:deliveryPreference===pref.value?'#3D6B4F':'#1E2620',marginBottom:3 }}>{pref.title}</div>
                <div style={{ fontSize:11,color:'#6B7066',fontWeight:300,lineHeight:1.4 }}>{pref.subtitle}</div>
              </button>
            ))}
          </div>

          <label style={lbl}>Delivery note <span style={{ fontWeight:300,textTransform:'none',letterSpacing:0 }}>(optional)</span></label>
          <input value={deliveryNote} onChange={e=>setDeliveryNote(e.target.value)} placeholder="Gate code 4521 · leave at back door" style={inp}/>

          <label style={lbl}>Add a tip for your Dasher</label>
          <div style={{ display:'flex',gap:8,marginBottom:8 }}>
            {TIP_OPTIONS.map(opt=>(
              <button key={opt.value} onClick={()=>setTipAmount(opt.value)}
                style={{ flex:1,padding:'11px 4px',borderRadius:10,border:'none',background:tipAmount===opt.value?'#3D6B4F':'#EAF2ED',color:tipAmount===opt.value?'#fff':'#3D6B4F',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",transition:'all 0.15s' }}>
                {opt.label}
              </button>
            ))}
          </div>
          <p style={{ fontSize:12,color:'#6B7066',marginBottom:20,fontWeight:300 }}>Tips go directly to your Dasher. 🚗</p>

          <div style={{ background:'#fff',border:'1px solid #DDE8E0',borderRadius:12,padding:'14px 16px',marginBottom:20 }}>
            <p style={{ fontSize:13,color:'#6B7066',margin:0,lineHeight:1.6 }}>💳 You won't be charged until {recipientFirstName} confirms. No money moves until they say yes.</p>
          </div>

          {errorMsg && <p style={{ color:'#B94040',fontSize:13,marginBottom:16 }}>{errorMsg}</p>}

          <div style={{ display:'flex',gap:10 }}>
            <button onClick={()=>{ setStep(2);setCurrentGroupIndex(groups.length-1);setGroupSubStep('menu') }} style={back}>← Back</button>
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
const btn  = (d: boolean): React.CSSProperties => ({ width:'100%',padding:'14px',borderRadius:10,border:'none',background:d?'#DDE8E0':'#3D6B4F',color:d?'#6B7066':'#fff',fontSize:14,fontWeight:500,cursor:d?'default':'pointer',fontFamily:"'DM Sans',sans-serif" })
const back: React.CSSProperties = { padding:'14px 20px',borderRadius:10,border:'1.5px solid #DDE8E0',background:'transparent',fontSize:14,color:'#6B7066',cursor:'pointer',fontFamily:"'DM Sans',sans-serif" }
const lbl:  React.CSSProperties = { fontSize:11,fontWeight:600,color:'#6B7066',letterSpacing:1.5,textTransform:'uppercase',display:'block',marginBottom:8 }
const inp:  React.CSSProperties = { width:'100%',padding:'13px 16px',borderRadius:10,border:'1.5px solid #DDE8E0',fontSize:16,background:'#fff',outline:'none',boxSizing:'border-box',marginBottom:20,fontFamily:"'DM Sans',sans-serif",color:'#1E2620' }

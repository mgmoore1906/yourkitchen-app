'use client'
import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { haversineDistance, formatDistance } from '@/lib/distance'
import InfoTip from '@/app/components/infotip'

const S = {
sage: '#3D6B4F', sageMid: '#6B9E7E', sageLight: '#EAF2ED',
cream: '#FAFAF5', forest: '#1E2620', stone: '#6B7066',
border: '#DDE8E0', white: '#FFFFFF', amber: '#C17F47',
amberLight: '#FBF0E4', red: '#B94040', redLight: '#FDE8E8',
}

const TIER_LIMITS: Record<string, number> = { free: 3, trial: 10, care: 10, annual: 10, founding: 999 }
const MEAL_LIMITS: Record<string, number> = { free: 4, trial: 12, care: 12, annual: 12, founding: 999 }
const TIER_LABELS: Record<string, string> = { free: 'Free', trial: 'Free Trial', care: 'Care+', annual: 'Early Adopter', founding: 'Founding Member' }

type Restaurant = {
id: string; name: string; cuisine: string; is_active: boolean; pickup_preferred: boolean
place_id: string | null; address: string | null
lat: number | null; lng: number | null
favorite_meals: string[]; favorite_meal_prices: number[]; favorite_meal_categories: string[]; favorite_meal_notes: string[]
}
type PlaceResult = {
place_id: string; name: string; address: string
lat: number | null; lng: number | null
rating: number | null; is_open: boolean | null
}

type ParsedItem = { name: string; price: number; category: 'adult' | 'kids'; note: string }
type ReviewItem = { name: string; price: string; category: 'adult' | 'kids'; note: string; sel?: boolean }

function distanceFromKitchen(r: { lat: number | null; lng: number | null }, kitLat: number, kitLng: number): number | null {
if (!r.lat || !r.lng) return null
return haversineDistance(kitLat, kitLng, r.lat, r.lng)
}

function DistanceBadge({ miles }: { miles: number | null }) {
if (miles === null) return null
const color = miles < 7 ? S.sage : miles < 10 ? S.amber : S.red
const bg = miles < 7 ? S.sageLight : miles < 10 ? S.amberLight : S.redLight
return (
<span style={{ fontSize: 11, fontWeight: 700, color, background: bg, borderRadius: 20, padding: '2px 8px', marginLeft: 6 }}>
{formatDistance(miles)}
</span>
)
}

function KitchenRestaurantsContent() {
const router = useRouter()
const searchParams = useSearchParams()
const isOnboarding = searchParams.get('welcome') === '1'
const foundingPending = searchParams.get('founding') === 'pending'
const supabase = createClient()

const [loading, setLoading] = useState(true)
const [kitchenId, setKitchenId] = useState('')
const [kitchenLat, setKitchenLat] = useState<number | null>(null)
const [kitchenLng, setKitchenLng] = useState<number | null>(null)
const [userTier, setUserTier] = useState('free')
const [restaurants, setRestaurants] = useState<Restaurant[]>([])
const [saveMsg, setSaveMsg] = useState('')
const [expandedId, setExpandedId] = useState<string | null>(null)
const [newMealName, setNewMealName] = useState<Record<string, string>>({})
const [newMealPrice, setNewMealPrice] = useState<Record<string, string>>({})
const [newMealCategory, setNewMealCategory] = useState<Record<string, 'adult'|'kids'>>({})
const [newMealNote, setNewMealNote] = useState<Record<string, string>>({})
const [editMeal, setEditMeal] = useState<{ rId: string; idx: number; name: string; price: string; category: 'adult'|'kids'; note: string } | null>(null)
const [savingMeals, setSavingMeals] = useState<string | null>(null)
const [deleting, setDeleting] = useState<string | null>(null)
const [shakingLimit, setShakingLimit] = useState(false)
const [searchQuery, setSearchQuery] = useState('')
const [searchResults, setSearchResults]= useState<PlaceResult[]>([])
const [searching, setSearching] = useState(false)
const [adding, setAdding] = useState<string | null>(null)
const [listOpen, setListOpen] = useState(false)
const [searchOpen, setSearchOpen] = useState(false)
const [autofillOpen, setAutofillOpen] = useState<Record<string, boolean>>({})
const [autofillUrl, setAutofillUrl] = useState<Record<string, string>>({})
const [autofillBusy, setAutofillBusy] = useState<string | null>(null)
const [autofillError, setAutofillError] = useState<Record<string, string>>({})
const [reviewItems, setReviewItems] = useState<Record<string, ReviewItem[]>>({})
const [addingAll, setAddingAll] = useState<string | null>(null)

useEffect(() => {
const load = async () => {
const { data: { user } } = await supabase.auth.getUser()
if (!user) { router.push('/login'); return }
const { data: profile } = await supabase.from('profiles').select('tier').eq('id', user.id).single()
setUserTier(profile?.tier || 'free')
const { data: kitchen } = await supabase.from('kitchens')
.select('id, latitude, longitude').eq('organizer_id', user.id)
.order('created_at', { ascending: false }).limit(1)
if (!kitchen || kitchen.length === 0) { router.push('/kitchen/setup'); return }
const k = kitchen[0]
setKitchenId(k.id)
setKitchenLat(k.latitude || null)
setKitchenLng(k.longitude || null)
await loadRestaurants(k.id)
setLoading(false)
}
load()
}, [])

const loadRestaurants = async (kId: string) => {
const { data } = await supabase
.from('kitchen_restaurants')
.select('id, name, cuisine, is_active, place_id, address, lat, lng, favorite_meals, favorite_meal_prices, favorite_meal_categories, pickup_preferred')
.eq('kitchen_id', kId).is('deleted_at', null).order('created_at', { ascending: true })
const mapped = (data || []).map((r: any) => ({
...r,
favorite_meals: r.favorite_meals || [],
favorite_meal_prices: r.favorite_meal_prices || [],
favorite_meal_categories: r.favorite_meal_categories || [],
favorite_meal_notes: r.favorite_meal_notes || [],
pickup_preferred: r.pickup_preferred ?? false,
}))
setRestaurants(mapped)
return mapped
}

const limit: number = 5 // pilot cap on restaurants (overrides TIER_LIMITS during pilot)
const activeCount = restaurants.filter(r => r.is_active).length
const atLimit = activeCount >= limit
const shakeLimit = () => { setShakingLimit(true); setTimeout(() => setShakingLimit(false), 600) }

const searchRestaurants = useCallback(async () => {
if (!searchQuery.trim() || !kitchenLat || !kitchenLng) return
setSearching(true)
try {
const res = await fetch(`/api/restaurants/search?lat=${kitchenLat}&lng=${kitchenLng}&query=${encodeURIComponent(searchQuery)}`)
const data = await res.json()
setSearchResults(data.restaurants || [])
} catch { setSearchResults([]) }
setSearching(false)
}, [searchQuery, kitchenLat, kitchenLng])

const addFavorite = async (place: PlaceResult) => {
if (atLimit) { shakeLimit(); return }
setAdding(place.place_id)
const res = await fetch('/api/restaurants/favorites', {
method: 'POST', headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({
kitchen_id: kitchenId, place_id: place.place_id,
name: place.name, address: place.address,
lat: place.lat, lng: place.lng,
}),
})
const data = await res.json()
if (data.success) {
const updated = await loadRestaurants(kitchenId)
setListOpen(true)
setSaveMsg(`${place.name} added!`)
setTimeout(() => setSaveMsg(''), 3000)
setSearchResults(prev => prev.filter(r => r.place_id !== place.place_id))
// Auto-expand the newly added restaurant so meal entry is immediate
const newRest = updated.find((r: any) => r.place_id === place.place_id)
if (newRest) {
setExpandedId(newRest.id)
// Give the DOM a tick to render, then scroll the expanded panel into view
setTimeout(() => {
const el = document.getElementById(`restaurant-${newRest.id}`)
if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}, 100)
// Pull the menu automatically from the restaurant's website (fire-and-forget)
autoImportMenu(newRest.id, place.place_id, place.name)
}
}
setAdding(null)
}

const toggleActive = async (id: string, currentActive: boolean) => {
if (!currentActive && atLimit) { shakeLimit(); return }
const newActive = !currentActive
setRestaurants(prev => prev.map(r => r.id === id ? { ...r, is_active: newActive } : r))
await fetch('/api/restaurants/favorites', {
method: 'PATCH', headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ restaurant_id: id, is_active: newActive }),
})
setSaveMsg(newActive ? 'Shown to your village ✓' : 'Hidden from your village')
setTimeout(() => setSaveMsg(''), 2500)
}

const togglePickup = async (id: string, current: boolean) => {
const next = !current
setRestaurants(prev => prev.map(r => r.id === id ? { ...r, pickup_preferred: next } : r))
await fetch('/api/restaurants/favorites', {
method: 'PATCH', headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ restaurant_id: id, pickup_preferred: next }),
})
setSaveMsg(next ? 'Pickup preferred for this spot 🥡' : 'Delivery default restored')
setTimeout(() => setSaveMsg(''), 2500)
}

const deleteRestaurant = async (id: string, name: string) => {
if (!confirm(`Remove ${name}?`)) return
setDeleting(id)
const res = await fetch('/api/restaurants/favorites', {
method: 'DELETE', headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ restaurant_id: id }),
})
const data = await res.json()
if (data.success) {
setRestaurants(prev => prev.filter(r => r.id !== id))
setSaveMsg(`${name} removed`)
setTimeout(() => setSaveMsg(''), 2500)
} else {
setSaveMsg(data.error || 'Could not remove — please try again')
setTimeout(() => setSaveMsg(''), 3500)
}
setDeleting(null)
}

const deleteAll = async () => {
if (!confirm('Remove ALL favorites? This cannot be undone.')) return
const res = await fetch('/api/restaurants/favorites', {
method: 'DELETE', headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ kitchen_id: kitchenId, delete_all: true }),
})
const data = await res.json()
if (data.success) { setRestaurants([]); setSaveMsg('All favorites removed'); setTimeout(() => setSaveMsg(''), 3000) }
}

const addMeal = async (restaurantId: string) => {
const mealLimit = MEAL_LIMITS[userTier] || 4
const restForLimit = restaurants.find(r => r.id === restaurantId)
if (restForLimit && (restForLimit.favorite_meals?.length || 0) >= mealLimit) {
alert(`Your plan allows up to ${mealLimit} meals per restaurant. Upgrade to Care+ for more.`)
return
}
const name = (newMealName[restaurantId] || '').trim()
const price = parseFloat(newMealPrice[restaurantId] || '0') || 15
const category = newMealCategory[restaurantId] || 'adult'
const noteText = (newMealNote[restaurantId] || '').trim()
if (!name) return
setSavingMeals(restaurantId)
const rest = restaurants.find(r => r.id === restaurantId)!
const updatedMeals = [...(rest.favorite_meals || []), name]
const updatedPrices = [...(rest.favorite_meal_prices || []), price]
const updatedCategories = [...(rest.favorite_meal_categories || []), category]
const updatedNotes = [...(rest.favorite_meal_notes || []), noteText]
const res = await fetch('/api/restaurants/favorites', {
method: 'PATCH', headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ restaurant_id: restaurantId, favorite_meals: updatedMeals, favorite_meal_prices: updatedPrices, favorite_meal_categories: updatedCategories, favorite_meal_notes: updatedNotes }),
})
const data = await res.json()
if (data.success) {
setRestaurants(prev => prev.map(r => r.id === restaurantId
? { ...r, favorite_meals: updatedMeals, favorite_meal_prices: updatedPrices, favorite_meal_categories: updatedCategories, favorite_meal_notes: updatedNotes } : r))
setNewMealName(prev => ({ ...prev, [restaurantId]: '' }))
setNewMealPrice(prev => ({ ...prev, [restaurantId]: '' }))
setNewMealCategory(prev => ({ ...prev, [restaurantId]: 'adult' }))
setNewMealNote(prev => ({ ...prev, [restaurantId]: '' }))
}
setSavingMeals(null)
}

const removeMeal = async (restaurantId: string, index: number) => {
const rest = restaurants.find(r => r.id === restaurantId)!
const updatedMeals = rest.favorite_meals.filter((_, i) => i !== index)
const updatedPrices = rest.favorite_meal_prices.filter((_, i) => i !== index)
const updatedCategories = (rest.favorite_meal_categories || []).filter((_, i) => i !== index)
const updatedNotes = (rest.favorite_meal_notes || []).filter((_, i) => i !== index)
await fetch('/api/restaurants/favorites', {
method: 'PATCH', headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ restaurant_id: restaurantId, favorite_meals: updatedMeals, favorite_meal_prices: updatedPrices, favorite_meal_categories: updatedCategories, favorite_meal_notes: updatedNotes }),
})
setRestaurants(prev => prev.map(r => r.id === restaurantId
? { ...r, favorite_meals: updatedMeals, favorite_meal_prices: updatedPrices, favorite_meal_categories: updatedCategories, favorite_meal_notes: updatedNotes } : r))
}

const startEditMeal = (r: any, i: number) => {
setEditMeal({ rId: r.id, idx: i, name: r.favorite_meals?.[i] || '', price: String(r.favorite_meal_prices?.[i] ?? ''), category: (r.favorite_meal_categories?.[i] === 'kids' ? 'kids' : 'adult'), note: r.favorite_meal_notes?.[i] || '' })
}
const saveEditMeal = async (restaurantId: string) => {
if (!editMeal) return
const name = editMeal.name.trim()
if (!name) return
const rest = restaurants.find(r => r.id === restaurantId)!
const i = editMeal.idx
const price = parseFloat(editMeal.price || '0') || 15
const meals = [...(rest.favorite_meals || [])]; meals[i] = name
const prices = [...(rest.favorite_meal_prices || [])]; prices[i] = price
const cats = [...(rest.favorite_meal_categories || [])]; cats[i] = editMeal.category
const notes = [...(rest.favorite_meal_notes || [])]; notes[i] = editMeal.note.trim()
setSavingMeals(restaurantId)
await fetch('/api/restaurants/favorites', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ restaurant_id: restaurantId, favorite_meals: meals, favorite_meal_prices: prices, favorite_meal_categories: cats, favorite_meal_notes: notes }) })
setRestaurants(prev => prev.map(r => r.id === restaurantId ? { ...r, favorite_meals: meals, favorite_meal_prices: prices, favorite_meal_categories: cats, favorite_meal_notes: notes } : r))
setSavingMeals(null)
setEditMeal(null)
}

const fileToBase64 = (file: File) => new Promise<{ data: string; type: string }>((resolve, reject) => {
const reader = new FileReader()
reader.onload = () => {
const result = String(reader.result || '')
const comma = result.indexOf(',')
resolve({ data: comma >= 0 ? result.slice(comma + 1) : result, type: file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg') })
}
reader.onerror = () => reject(new Error('Could not read that file'))
reader.readAsDataURL(file)
})

// Auto-import: right after a restaurant is added, look up its website from Google and run it
// through the menu importer. Populates the review list on success; silent if nothing is found
// (the manual paste / photo / type options stay available).
const autoImportMenu = async (restaurantId: string, placeId: string | null, name: string) => {
  if (!placeId) return
  setAutofillOpen(p => ({ ...p, [restaurantId]: true }))
  setAutofillBusy(restaurantId)
  try {
    const wr = await fetch(`/api/restaurants/website?place_id=${encodeURIComponent(placeId)}`)
    const wd = await wr.json()
    const website: string | null = wd?.website || null
    if (website) {
      const res = await fetch('/api/menu-parse', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: website, restaurantName: name }),
      })
      const data = await res.json()
      if (res.ok && data?.success && Array.isArray(data.items) && data.items.length > 0) {
        setReviewItems(p => ({ ...p, [restaurantId]: (data.items as ParsedItem[]).map((i) => ({ name: i.name, price: (Number(i.price) || 0).toFixed(2), category: i.category, note: i.note })) }))
        setAutofillOpen(p => ({ ...p, [restaurantId]: false }))
      }
    }
  } catch {
    // silent — manual options remain
  }
  setAutofillBusy(null)
}

const parseMenu = async (restaurantId: string, opts: { url?: string; file?: File }) => {
const rest = restaurants.find(r => r.id === restaurantId)
if (!rest) return
if (!opts.url && !opts.file) return
setAutofillBusy(restaurantId)
setAutofillError(p => ({ ...p, [restaurantId]: '' }))
try {
let body: Record<string, unknown> = { restaurantName: rest.name }
if (opts.file) {
const { data, type } = await fileToBase64(opts.file)
body = { ...body, imageBase64: data, imageMediaType: type }
} else {
body = { ...body, url: opts.url }
}
const res = await fetch('/api/menu-parse', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
const data = await res.json()
if (!res.ok || !data.success) {
setAutofillError(p => ({ ...p, [restaurantId]: data.error || 'Could not read that menu \u2014 try a photo instead.' }))
} else if (!Array.isArray(data.items) || data.items.length === 0) {
setAutofillError(p => ({ ...p, [restaurantId]: 'No menu items found there. Try a clearer photo or a different link.' }))
} else {
setReviewItems(p => ({ ...p, [restaurantId]: (data.items as ParsedItem[]).map((i) => ({ name: i.name, price: (Number(i.price) || 0).toFixed(2), category: i.category, note: i.note })) }))
setAutofillOpen(p => ({ ...p, [restaurantId]: false }))
}
} catch {
setAutofillError(p => ({ ...p, [restaurantId]: 'Something went wrong reading that menu.' }))
}
setAutofillBusy(null)
}

const updateReviewItem = (restaurantId: string, idx: number, patch: Partial<ReviewItem>) => {
setReviewItems(p => ({ ...p, [restaurantId]: (p[restaurantId] || []).map((it, i) => i === idx ? { ...it, ...patch } : it) }))
}
const removeReviewItem = (restaurantId: string, idx: number) => {
setReviewItems(p => {
const next = (p[restaurantId] || []).filter((_, i) => i !== idx)
const n = { ...p }
if (next.length === 0) { delete n[restaurantId] } else { n[restaurantId] = next }
return n
})
}

const reviewPaintingRef = useRef(false)
const reviewDragMovedRef = useRef(false)
const reviewPaintRid = useRef<string | null>(null)
const reviewPaintStart = useRef<number | null>(null)
const rowAtPoint = (x: number, y: number): number | null => {
const el = document.elementFromPoint(x, y) as HTMLElement | null
const row = el?.closest('[data-review-idx]') as HTMLElement | null
if (!row) return null
const n = parseInt(row.getAttribute('data-review-idx') || '', 10)
return Number.isNaN(n) ? null : n
}
const beginReviewPaint = (rid: string, idx: number) => {
reviewPaintingRef.current = true
reviewDragMovedRef.current = false
reviewPaintRid.current = rid
reviewPaintStart.current = idx
}
const extendReviewPaint = (x: number, y: number) => {
if (!reviewPaintingRef.current) return
const idx = rowAtPoint(x, y)
const rid = reviewPaintRid.current
const start = reviewPaintStart.current
if (idx === null || rid === null || start === null) return
if (idx !== start) reviewDragMovedRef.current = true
const lo = Math.min(start, idx), hi = Math.max(start, idx)
setReviewItems(p => ({ ...p, [rid]: (p[rid] || []).map((it, i) => (i >= lo && i <= hi) ? { ...it, sel: true } : it) }))
}
const finishReviewPaint = () => { reviewPaintingRef.current = false }
const selectAllReview = (restaurantId: string, on: boolean) => {
setReviewItems(p => ({ ...p, [restaurantId]: (p[restaurantId] || []).map(it => ({ ...it, sel: on })) }))
}
const deleteSelectedReview = (restaurantId: string) => {
setReviewItems(p => {
const next = (p[restaurantId] || []).filter(it => !it.sel)
const n = { ...p }
if (next.length === 0) { delete n[restaurantId] } else { n[restaurantId] = next }
return n
})
}
const addAllReviewed = async (restaurantId: string) => {
const rest = restaurants.find(r => r.id === restaurantId)
const items = reviewItems[restaurantId] || []
if (!rest || items.length === 0) return
const mealLimit = MEAL_LIMITS[userTier] || 4
const current = rest.favorite_meals?.length || 0
const available = Math.max(0, mealLimit - current)
let toAdd = items.filter(it => it.name.trim())
let trimmedNote = ''
if (toAdd.length > available) {
toAdd = toAdd.slice(0, available)
trimmedNote = ' (capped to your plan limit \u2014 upgrade to Care+ for more)'
}
if (toAdd.length === 0) {
alert(`You're at your meal limit for ${rest.name}. Upgrade to Care+ to add more.`)
return
}
setAddingAll(restaurantId)
const updatedMeals = [...(rest.favorite_meals || []), ...toAdd.map(i => i.name.trim())]
const updatedPrices = [...(rest.favorite_meal_prices || []), ...toAdd.map(i => Math.max(0, parseFloat(i.price) || 0))]
const updatedCategories = [...(rest.favorite_meal_categories || []), ...toAdd.map(i => i.category === 'kids' ? 'kids' : 'adult')]
const updatedNotes = [...(rest.favorite_meal_notes || []), ...toAdd.map(i => (i.note || '').trim())]
const res = await fetch('/api/restaurants/favorites', {
method: 'PATCH', headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ restaurant_id: restaurantId, favorite_meals: updatedMeals, favorite_meal_prices: updatedPrices, favorite_meal_categories: updatedCategories, favorite_meal_notes: updatedNotes }),
})
const data = await res.json()
if (data.success) {
setRestaurants(prev => prev.map(r => r.id === restaurantId ? { ...r, favorite_meals: updatedMeals, favorite_meal_prices: updatedPrices, favorite_meal_categories: updatedCategories, favorite_meal_notes: updatedNotes } : r))
setReviewItems(p => { const n = { ...p }; delete n[restaurantId]; return n })
setSaveMsg(`Added ${toAdd.length} meal${toAdd.length !== 1 ? 's' : ''}${trimmedNote}`)
setTimeout(() => setSaveMsg(''), 4000)
}
setAddingAll(null)
}

const alreadySaved = (place: PlaceResult) =>
restaurants.some(r => !!place.place_id && r.place_id === place.place_id)

if (loading) return (
<div style={{ minHeight: '100vh', background: S.cream, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, fontFamily: "'DM Sans', sans-serif" }}>
<svg width="44" height="44" viewBox="0 0 44 44" fill="none" aria-label="Loading">
<circle cx="22" cy="22" r="19" stroke={S.sageLight} strokeWidth="3" />
<path d="M22 3 a19 19 0 0 1 19 19" stroke={S.sage} strokeWidth="3" strokeLinecap="round">
<animateTransform attributeName="transform" type="rotate" from="0 22 22" to="360 22 22" dur="0.8s" repeatCount="indefinite" />
</path>
</svg>
<p style={{ color: S.stone, fontSize: 13, fontWeight: 300 }}>Loading…</p>
</div>
)

return (
<div style={{ minHeight: '100vh', background: S.cream, fontFamily: "'DM Sans', sans-serif", paddingBottom: 60 }}>
<link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />
<style>{`
@keyframes shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-6px)} 40%{transform:translateX(6px)} 60%{transform:translateX(-4px)} 80%{transform:translateX(4px)} }
.shake { animation: shake 0.5s ease; }
`}</style>

<nav style={{ background: S.white, borderBottom: `0.5px solid ${S.border}`, padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 10 }}>
<button onClick={() => { if (!(isOnboarding && activeCount === 0)) router.push('/dashboard') }} disabled={isOnboarding && activeCount === 0}
style={{ background: S.sageLight, border: 'none', borderRadius: 10, width: 36, height: 36, cursor: (isOnboarding && activeCount === 0) ? 'not-allowed' : 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', color: (isOnboarding && activeCount === 0) ? S.border : S.sage, opacity: (isOnboarding && activeCount === 0) ? 0.5 : 1 }}>‹</button>
<div style={{ flex: 1 }}>
<span style={{ fontSize: 8, fontWeight: 500, letterSpacing: 5, color: S.sageMid, textTransform: 'uppercase', display: 'block' }}>Your</span>
<span style={{ fontFamily: "'Lora', serif", fontSize: 20, fontWeight: 500, color: S.forest }}>Kitchen</span>
</div>
{saveMsg && <span style={{ fontSize: 12, color: S.sage, fontWeight: 600 }}>{saveMsg}</span>}
</nav>

<div style={{ padding: '24px', maxWidth: 540, margin: '0 auto' }}>
{foundingPending && (
<div style={{ background: '#FFF4E8', border: '1.5px solid #B88B4A', borderRadius: 12, padding: '14px 16px', marginBottom: 20, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
<span style={{ fontSize: 18, lineHeight: 1 }}>💳</span>
<div style={{ flex: 1 }}>
<p style={{ fontSize: 14, fontWeight: 600, color: '#7A4F10', margin: '0 0 3px' }}>Your founding checkout is open in another tab</p>
<p style={{ fontSize: 12.5, color: '#7A4F10', fontWeight: 300, lineHeight: 1.55, margin: 0 }}>Finish your $200 payment there to lock in your Founding Member benefits — permanent badge, founder access, the Founders Gift Box, and 3 years of Care+ starting at beta launch. Set up your kitchen here in the meantime.</p>
<a href="https://buy.stripe.com/5kQ00beDq9XD9BX5w5abK01" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: 8, fontSize: 12.5, fontWeight: 600, color: '#7A4F10', textDecoration: 'underline' }}>Reopen checkout →</a>
</div>
</div>
)}
<p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: S.sage, margin: '0 0 6px' }}>My Restaurants</p>
<h1 style={{ fontFamily: "'Lora', serif", fontSize: 24, fontWeight: 500, color: S.forest, margin: '0 0 6px', letterSpacing: -0.5 }}>Favorite restaurants<InfoTip label="How to edit meals" text={"To edit a meal, open a restaurant with its ✏️ Meals button, then tap any saved dish to change its name, price, adult/kids tag, or add a prep note."}/></h1>
<p style={{ fontSize: 14, color: S.stone, margin: '0 0 16px', fontWeight: 300, lineHeight: 1.6 }}>
Add favorites and save your go-to meals with prices. Tag each as an adult or kids meal so your village always knows what to order.
</p>
<div style={{ background: S.sageLight, borderRadius: 12, padding: '12px 16px', marginBottom: 12 }}>
<p style={{ fontSize: 13, color: S.sage, margin: 0, lineHeight: 1.6, fontWeight: 400 }}>
📋 <strong>A quick note:</strong> while we're in pilot, you'll add your favorite dishes and their prices yourself. Slightly inconvenient, but not forever.
</p>
</div>
<div style={{ background: S.white, border: `1px solid ${S.border}`, borderRadius: 12, padding: '12px 16px', marginBottom: 20 }}>
<p style={{ fontSize: 12, fontWeight: 700, color: S.forest, letterSpacing: '0.04em', textTransform: 'uppercase', margin: '0 0 8px' }}>Four ways to add a menu</p>
<div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
<p style={{ fontSize: 13, color: S.stone, margin: 0, lineHeight: 1.5, fontWeight: 400 }}><strong style={{ color: S.sage }}>1.</strong> Search and add your favorite restaurant, depending on their web layout, the menu may populate.</p>
<p style={{ fontSize: 13, color: S.stone, margin: 0, lineHeight: 1.5, fontWeight: 400 }}><strong style={{ color: S.sage }}>2.</strong> Paste the restaurant's menu or online-ordering link and we'll fill it in.</p>
<p style={{ fontSize: 13, color: S.stone, margin: 0, lineHeight: 1.5, fontWeight: 400 }}><strong style={{ color: S.sage }}>3.</strong> Upload a photo or PDF of the menu.</p>
<p style={{ fontSize: 13, color: S.stone, margin: 0, lineHeight: 1.5, fontWeight: 400 }}><strong style={{ color: S.sage }}>4.</strong> Or type the dishes and prices in by hand.</p>
</div>
</div>

{/* Tier limit */}
<div className={shakingLimit ? 'shake' : ''}
style={{ background: S.white, border: `1.5px solid ${shakingLimit ? S.red : atLimit ? S.amber : S.border}`, borderRadius: 14, padding: '14px 16px', marginBottom: 20, transition: 'border-color 0.2s' }}>
<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: atLimit ? 10 : 0 }}>
<span style={{ fontSize: 13, fontWeight: 600, color: shakingLimit ? S.red : S.forest }}>
{activeCount} / {limit === 999 ? '∞' : limit} active · {TIER_LABELS[userTier]}
</span>
<div style={{ width: 80, height: 6, background: S.sageLight, borderRadius: 3, overflow: 'hidden', marginLeft: 12 }}>
<div style={{ height: '100%', background: atLimit ? S.amber : S.sage, borderRadius: 3, width: limit === 999 ? '20%' : `${Math.min((activeCount / limit) * 100, 100)}%`, transition: 'width 0.3s' }} />
</div>
</div>
{atLimit && userTier !== 'founding' && (
<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
<p style={{ fontSize: 12, color: S.amber, margin: 0, fontWeight: 500 }}>Limit reached — upgrade to add more.</p>
<button onClick={() => router.push('/settings')}
style={{ background: S.amber, color: S.white, border: 'none', borderRadius: 20, padding: '5px 14px', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", whiteSpace: 'nowrap', marginLeft: 12 }}>
Upgrade →
</button>
</div>
)}
</div>

{/* Saved favorites */}
{restaurants.length > 0 && (
<div style={{ marginBottom: 28 }}>
<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: listOpen ? 12 : 0 }}>
<div style={{ display:'flex', alignItems:'center', gap:6 }}>
<button onClick={() => setListOpen(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'DM Sans', sans-serif" }}>
<p style={{ fontSize: 11, fontWeight: 600, color: S.stone, letterSpacing: '0.08em', textTransform: 'uppercase', margin: 0 }}>
Your favorites ({restaurants.length})
</p>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ transform: listOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}><path d="M6 9l6 6 6-6" stroke={S.stone} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
</button>
<InfoTip align="left" label="About your favorites" text={"The restaurants you've saved. Tap a row's toggle to show or hide it from your village — only visible spots appear on your kitchen for supporters to order from."}/>
</div>
{listOpen && (
<button onClick={deleteAll}
style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: S.red, fontWeight: 500, fontFamily: "'DM Sans', sans-serif", padding: '4px 8px' }}>
Clear all
</button>
)}
</div>

{listOpen && (
<div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
{restaurants.map(r => {
const isExpanded = expandedId === r.id
const miles = kitchenLat && kitchenLng ? distanceFromKitchen(r, kitchenLat, kitchenLng) : null
const mealCat = newMealCategory[r.id] || 'adult'
return (
<div key={r.id} id={`restaurant-${r.id}`} style={{ background: S.white, border: `1px solid ${r.is_active ? '#CFE0D4' : S.border}`, borderRadius: 20, overflow: 'hidden', boxShadow: '0 1px 2px rgba(30,38,32,0.04), 0 10px 30px rgba(30,38,32,0.05)' }}>
<div style={{ padding: '16px 18px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
<div style={{ flex: 1, cursor: 'pointer', minWidth: 0 }} onClick={() => setExpandedId(isExpanded ? null : r.id)}>
<div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 4 }}>
<span style={{ fontFamily: "'Lora', serif", fontSize: 17, fontWeight: 600, color: S.forest, letterSpacing: '-0.01em' }}>{r.name}</span>
{miles !== null && <DistanceBadge miles={miles} />}
{r.favorite_meals?.length > 0
? <span style={{ fontSize: 10.5, fontWeight: 600, background: S.amberLight, color: S.amber, borderRadius: 999, padding: '2.5px 9px' }}>{r.favorite_meals.length} meal{r.favorite_meals.length !== 1 ? 's' : ''}</span>
: <span style={{ fontSize: 10.5, fontWeight: 600, background: S.redLight, color: S.red, borderRadius: 999, padding: '2.5px 9px' }}>No meals yet</span>}
</div>
<div style={{ fontSize: 12, color: S.stone, fontWeight: 300, lineHeight: 1.5 }}>
{r.address || r.cuisine}
{r.is_active && <span style={{ color: S.sageMid, marginLeft: 6 }}>· Visible to your village ✓</span>}
</div>
</div>
<div style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
<button onClick={() => setExpandedId(isExpanded ? null : r.id)}
style={{ background: isExpanded ? S.sageLight : 'none', border: `1px solid ${isExpanded ? '#D5E5DA' : S.border}`, borderRadius: 9, padding: '6px 13px', fontSize: 12, fontWeight: 600, color: isExpanded ? S.sage : S.stone, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
{isExpanded ? 'Done' : '✏️ Meals'}
</button>
<button onClick={() => (r.is_active || !atLimit) ? toggleActive(r.id, r.is_active) : shakeLimit()}
style={{ width: 44, height: 25, borderRadius: 999, border: 'none', background: r.is_active ? S.sage : S.border, cursor: 'pointer', position: 'relative', flexShrink: 0, transition: 'background 0.2s' }}>
<div style={{ width: 19, height: 19, borderRadius: '50%', background: S.white, position: 'absolute', top: 3, left: r.is_active ? 22 : 3, transition: 'left 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.15)' }} />
</button>
<button onClick={() => deleteRestaurant(r.id, r.name)} disabled={deleting === r.id}
style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#A7ADA3', fontSize: 16, padding: '3px', opacity: deleting === r.id ? 0.4 : 1 }}>🗑</button>
</div>
</div>

{isExpanded && (
<div style={{ borderTop: '1px solid #EEF1EC', padding: '18px', background: '#F4F9F5' }}>
<p style={{ fontSize: 11, fontWeight: 600, color: S.sage, letterSpacing: '0.07em', textTransform: 'uppercase', margin: '0 0 11px' }}>Their favorite meals</p>

{reviewItems[r.id] ? (
<div style={{ marginBottom: 14 }}>
<p style={{ fontSize: 14, fontWeight: 600, color: S.forest, margin: 0 }}>We found {reviewItems[r.id].length} dish{reviewItems[r.id].length !== 1 ? 'es' : ''} — keep your favorites</p>
{reviewItems[r.id].length > 0 && reviewItems[r.id].every(it => (parseFloat(it.price) || 0) === 0) ? (
<div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', margin: '9px 0 13px', padding: '9px 11px', background: S.amberLight, borderRadius: 10, fontSize: 11.5, color: '#8A5A2E', lineHeight: 1.5 }}>
<span>💡</span><span><b style={{ fontWeight: 600 }}>This spot didn’t share prices.</b> Type them in, or snap a photo of the order screen. Keep 10 or fewer.</span>
</div>
) : (
<p style={{ fontSize: 11.5, color: reviewItems[r.id].length > 10 ? S.amber : S.stone, fontWeight: 400, margin: '6px 0 12px', lineHeight: 1.5 }}>{reviewItems[r.id].length > 10 ? `Pick your family’s favorites — keep 10 or fewer. Remove ${reviewItems[r.id].length - 10} more.` : 'Edit anything that looks off, drop what you don’t want, then add them.'}</p>
)}
{reviewItems[r.id].length > 1 && (
<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '2px 0 4px' }}>
<button onClick={() => selectAllReview(r.id, reviewItems[r.id].some(it => !it.sel))}
style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: S.sage, padding: '4px 2px', fontFamily: "'DM Sans', sans-serif" }}>
{reviewItems[r.id].some(it => !it.sel) ? 'Select all' : 'Deselect all'}
</button>
{reviewItems[r.id].some(it => it.sel) && (
<button onClick={() => deleteSelectedReview(r.id)}
style={{ background: S.redLight, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: S.red, padding: '6px 12px', borderRadius: 999, fontFamily: "'DM Sans', sans-serif" }}>
Delete selected ({reviewItems[r.id].filter(it => it.sel).length})
</button>
)}
</div>
)}
{reviewItems[r.id].length > 1 && !reviewItems[r.id].some(it => it.sel) && (<p style={{ fontSize: 11, color: S.stone, fontWeight: 300, margin: '0 0 8px', lineHeight: 1.4 }}>Press a checkbox and drag to select several at once.</p>)}
<div style={{ display: 'flex', flexDirection: 'column', gap: 7, margin: '11px 0', userSelect: 'none', WebkitUserSelect: 'none' }}>
{reviewItems[r.id].map((it, idx) => {
const k = it.category === 'kids'
return (
<div key={idx} data-review-idx={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, background: it.sel ? S.sageLight : S.white, border: `1px solid ${it.sel ? S.sageMid : S.border}`, borderRadius: 11, padding: '8px 10px' }}>
<button
onPointerDown={(e:any)=>{ try{ e.currentTarget.setPointerCapture(e.pointerId) }catch{}; beginReviewPaint(r.id, idx) }}
onPointerMove={(e:any)=>{ if(reviewPaintingRef.current){ e.preventDefault(); extendReviewPaint(e.clientX, e.clientY) } }}
onPointerUp={finishReviewPaint} onPointerCancel={finishReviewPaint}
onClick={() => { if(reviewDragMovedRef.current){ reviewDragMovedRef.current=false; return } updateReviewItem(r.id, idx, { sel: !it.sel }) }}
aria-label={it.sel ? 'Deselect' : 'Select'}
style={{ flexShrink: 0, width: 22, height: 22, borderRadius: 6, border: `1.6px solid ${it.sel ? S.sage : '#C3CCC5'}`, background: it.sel ? S.sage : 'transparent', cursor: 'grab', display: 'flex', alignItems: 'center', justifyContent: 'center', color: S.white, fontSize: 12, fontWeight: 700, padding: 0, lineHeight: 1, touchAction: 'none' }}>{it.sel ? '✓' : ''}</button>
<button onClick={() => updateReviewItem(r.id, idx, { category: k ? 'adult' : 'kids' })} title="Toggle adult / kids"
style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: 0, flexShrink: 0, width: 18, textAlign: 'center' }}>{k ? '🧒' : '👤'}</button>
<input value={it.name} onChange={e => updateReviewItem(r.id, idx, { name: e.target.value })}
style={{ flex: 1, minWidth: 0, padding: '7px 9px', borderRadius: 8, border: `1px solid ${S.border}`, fontSize: 12.5, fontFamily: "'DM Sans', sans-serif", color: S.forest, outline: 'none' }} />
<div style={{ position: 'relative', flexShrink: 0 }}>
<span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: S.stone }}>$</span>
<input type="text" inputMode="decimal" value={it.price} onChange={e => updateReviewItem(r.id, idx, { price: e.target.value })} onBlur={e => updateReviewItem(r.id, idx, { price: (parseFloat(e.target.value) || 0).toFixed(2) })}
style={{ width: 84, padding: '7px 6px 7px 18px', borderRadius: 8, border: `1px solid ${S.border}`, fontSize: 12.5, fontFamily: "'DM Sans', sans-serif", color: S.forest, outline: 'none' }} />
</div>
<button onClick={() => removeReviewItem(r.id, idx)} aria-label="Drop this item"
style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#A7ADA3', fontSize: 13, padding: '2px 3px', flexShrink: 0 }}>✕</button>
</div>
)
})}
</div>
<div style={{ display: 'flex', gap: 8 }}>
<button onClick={() => addAllReviewed(r.id)} disabled={reviewItems[r.id].length === 0 || reviewItems[r.id].length > 10 || addingAll === r.id}
style={{ flex: 1, padding: 11, borderRadius: 11, border: 'none', background: (reviewItems[r.id].length === 0 || reviewItems[r.id].length > 10) ? S.border : S.sage, color: S.white, fontSize: 13, fontWeight: 600, cursor: (reviewItems[r.id].length === 0 || reviewItems[r.id].length > 10) ? 'default' : 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
{addingAll === r.id ? 'Adding…' : reviewItems[r.id].length > 10 ? `Remove ${reviewItems[r.id].length - 10} to add` : `Add these ${reviewItems[r.id].length}`}
</button>
<button onClick={() => { setReviewItems(p => { const n = { ...p }; delete n[r.id]; return n }); setAutofillError(p => ({ ...p, [r.id]: '' })) }}
style={{ padding: '11px 15px', borderRadius: 11, border: `1px solid ${S.border}`, background: S.white, color: S.stone, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
Discard
</button>
</div>
</div>
) : autofillBusy === r.id ? (
<div style={{ background: S.white, border: `1px solid ${S.border}`, borderRadius: 14, padding: '30px 18px', marginBottom: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
<svg width="32" height="32" viewBox="0 0 50 50" aria-hidden="true">
<circle cx="25" cy="25" r="20" fill="none" stroke={S.sageLight} strokeWidth="5" />
<circle cx="25" cy="25" r="20" fill="none" stroke={S.sage} strokeWidth="5" strokeLinecap="round" strokeDasharray="70 130">
<animateTransform attributeName="transform" attributeType="XML" type="rotate" from="0 25 25" to="360 25 25" dur="0.9s" repeatCount="indefinite" />
</circle>
</svg>
<p style={{ fontSize: 15, fontWeight: 600, color: S.forest, margin: '16px 0 0' }}>Reading the menu…</p>
<p style={{ fontSize: 12.5, color: S.stone, fontWeight: 300, margin: '3px 0 0' }}>Finding your favorites — about 20 seconds.</p>
</div>
) : (
<div style={{ background: S.white, border: `1px solid ${S.border}`, borderRadius: 14, padding: 14, marginBottom: 14 }}>
<h4 style={{ fontSize: 13.5, fontWeight: 600, color: S.forest, margin: 0 }}>Pull the menu for me</h4>
<p style={{ fontSize: 11.5, color: S.stone, fontWeight: 300, lineHeight: 1.55, margin: '6px 0 11px' }}>Paste an ordering link or a menu photo and we’ll read the dishes and prices.</p>
<div style={{ display: 'flex', gap: 8 }}>
<input value={autofillUrl[r.id] || ''} onChange={e => setAutofillUrl(p => ({ ...p, [r.id]: e.target.value }))} onKeyDown={e => e.key === 'Enter' && parseMenu(r.id, { url: (autofillUrl[r.id] || '').trim() })}
placeholder="Paste ordering or menu link…"
style={{ flex: 1, minWidth: 0, padding: '11px 13px', borderRadius: 11, border: `1px solid ${S.border}`, fontSize: 13, fontFamily: "'DM Sans', sans-serif", color: S.forest, outline: 'none', background: S.white }} />
<button onClick={() => parseMenu(r.id, { url: (autofillUrl[r.id] || '').trim() })} disabled={!(autofillUrl[r.id] || '').trim()}
style={{ padding: '11px 15px', borderRadius: 11, border: 'none', background: !(autofillUrl[r.id] || '').trim() ? S.border : S.sage, color: S.white, fontSize: 13, fontWeight: 600, cursor: !(autofillUrl[r.id] || '').trim() ? 'default' : 'pointer', fontFamily: "'DM Sans', sans-serif", flexShrink: 0 }}>
Import
</button>
</div>
<label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 11, fontSize: 12.5, fontWeight: 600, color: S.sage, cursor: 'pointer' }}>
📷 Upload a photo or PDF of the menu
<input type="file" accept="image/*,application/pdf,.pdf" onChange={e => { const f = e.target.files?.[0]; if (f) parseMenu(r.id, { file: f }); e.target.value = '' }} style={{ display: 'none' }} />
</label>
<div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 12, padding: '9px 11px', background: S.amberLight, borderRadius: 10, fontSize: 11.5, color: '#8A5A2E', lineHeight: 1.5 }}>
<span>💡</span><span><b style={{ fontWeight: 600 }}>Big chains often won’t share prices</b> (Chick-fil-A, Jason’s Deli…). Add those by hand below, or snap a photo of the order screen.</span>
</div>
{autofillError[r.id] && <p style={{ fontSize: 12, color: S.red, fontWeight: 400, margin: '10px 0 0', lineHeight: 1.5 }}>{autofillError[r.id]}</p>}
</div>
)}

{r.favorite_meals?.length > 0 ? (
<div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
{r.favorite_meals.map((meal, i) => {
const cat = (r.favorite_meal_categories?.[i] || 'adult')
const isKids = cat === 'kids'
const isEditing = !!editMeal && editMeal.rId === r.id && editMeal.idx === i
return (
<div key={i} style={{ background: isKids ? S.amberLight : S.sageLight, border: `1px solid ${isKids ? S.amber : S.sage}`, borderRadius: 10, padding: '8px 12px' }}>
{isEditing ? (
<div>
<div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
{(['adult','kids'] as const).map(c2 => (
<button key={c2} onClick={() => setEditMeal(m => m ? { ...m, category: c2 } : m)}
style={{ flex: 1, padding: '8px', borderRadius: 9, border: `1.5px solid ${editMeal!.category===c2?(c2==='adult'?S.sage:S.amber):S.border}`, background: editMeal!.category===c2?(c2==='adult'?S.sageLight:S.amberLight):S.white, color: editMeal!.category===c2?(c2==='adult'?S.sage:S.amber):S.stone, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
{c2==='adult'?'👤 Adult':'🧒 Kids'}
</button>
))}
</div>
<div style={{ display: 'flex', gap: 8 }}>
<input value={editMeal!.name} onChange={e => setEditMeal(m => m ? { ...m, name: e.target.value } : m)} onKeyDown={e => e.key==='Enter'&&saveEditMeal(r.id)} autoFocus
style={{ flex: 1, padding: '9px 11px', borderRadius: 9, border: `1.5px solid ${S.border}`, fontSize: 13, fontFamily: "'DM Sans', sans-serif", color: S.forest, outline: 'none' }} />
<div style={{ position: 'relative', flexShrink: 0 }}>
<span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: S.stone }}>$</span>
<input type="text" inputMode="decimal" value={editMeal!.price} onChange={e => setEditMeal(m => m ? { ...m, price: e.target.value } : m)} onKeyDown={e => e.key==='Enter'&&saveEditMeal(r.id)}
style={{ width: 96, padding: '9px 10px 9px 22px', borderRadius: 9, border: `1.5px solid ${S.border}`, fontSize: 13, fontFamily: "'DM Sans', sans-serif", color: S.forest, outline: 'none' }} />
</div>
</div>
<input value={editMeal!.note} onChange={e => setEditMeal(m => m ? { ...m, note: e.target.value } : m)} onKeyDown={e => e.key==='Enter'&&saveEditMeal(r.id)}
placeholder="How they like it — e.g. no onions, sub wheat toast"
style={{ width: '100%', boxSizing: 'border-box', marginTop: 8, padding: '9px 11px', borderRadius: 9, border: `1.5px dashed ${S.border}`, fontSize: 12.5, fontFamily: "'DM Sans', sans-serif", color: S.forest, outline: 'none' }} />
<div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
<button onClick={() => saveEditMeal(r.id)} disabled={!editMeal!.name.trim()||savingMeals===r.id}
style={{ flex: 1, padding: '9px', borderRadius: 9, border: 'none', background: !editMeal!.name.trim()?S.border:S.sage, color: S.white, fontSize: 13, fontWeight: 600, cursor: !editMeal!.name.trim()?'default':'pointer', fontFamily: "'DM Sans', sans-serif" }}>
{savingMeals===r.id?'Saving…':'Save changes'}
</button>
<button onClick={() => setEditMeal(null)}
style={{ padding: '9px 16px', borderRadius: 9, border: `1.5px solid ${S.border}`, background: S.white, color: S.stone, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
Cancel
</button>
</div>
</div>
) : (<>
<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
<span style={{ fontSize: 14 }}>{isKids ? '🧒' : '👤'}</span>
<button onClick={() => startEditMeal(r, i)} style={{ flex: 1, textAlign: 'left', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 13, color: S.forest, fontWeight: 500, fontFamily: "'DM Sans', sans-serif" }}>{meal}</button>
<span style={{ fontSize: 11, fontWeight: 700, color: isKids ? S.amber : S.sage, background: S.white, borderRadius: 20, padding: '2px 7px' }}>{isKids ? 'KIDS' : 'ADULT'}</span>
<span style={{ fontSize: 13, fontWeight: 700, color: isKids ? S.amber : S.sage }}>${(r.favorite_meal_prices[i] || 15).toFixed(2)}</span>
<button onClick={() => startEditMeal(r, i)} aria-label="Edit this meal" style={{ background: 'none', border: 'none', cursor: 'pointer', color: isKids ? S.amber : S.sage, fontSize: 13, padding: '2px 5px' }}>✎</button>
<button onClick={() => removeMeal(r.id, i)} aria-label="Remove this meal" style={{ background: 'none', border: 'none', cursor: 'pointer', color: isKids ? S.amber : S.sage, fontSize: 14, padding: '2px 6px' }}>✕</button>
</div>
{(r.favorite_meal_notes?.[i] || '').trim() && (
<div onClick={() => startEditMeal(r, i)} style={{ fontSize: 11.5, color: S.stone, fontWeight: 300, marginTop: 5, paddingLeft: 22, lineHeight: 1.5, fontStyle: 'italic', cursor: 'pointer' }}>
&ldquo;{r.favorite_meal_notes[i]}&rdquo;
</div>
)}
</>)}
</div>
)
})}
</div>
) : null}

{/* Adult / Kids toggle */}
<div style={{ display: 'flex', gap: 7, margin: '14px 0 9px' }}>
{(['adult','kids'] as const).map(cat => (
<button key={cat} onClick={() => setNewMealCategory(p => ({ ...p, [r.id]: cat }))}
style={{ flex: 1, padding: 10, borderRadius: 11, border: `1px solid ${mealCat===cat?(cat==='adult'?S.sage:S.amber):S.border}`, background: mealCat===cat?(cat==='adult'?S.sageLight:S.amberLight):S.white, color: mealCat===cat?(cat==='adult'?S.sage:S.amber):S.stone, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
{cat==='adult'?'👤 Adult meal':'🧒 Kids meal'}
</button>
))}
</div>

<div style={{ display: 'flex', gap: 8 }}>
<input value={newMealName[r.id] || ''} onChange={e => setNewMealName(p => ({ ...p, [r.id]: e.target.value }))} onKeyDown={e => e.key==='Enter'&&addMeal(r.id)}
placeholder={mealCat==='kids'?'e.g. Kids mac & cheese':'e.g. Smash Burger with fries'}
style={{ flex: 1, minWidth: 0, padding: '11px 13px', borderRadius: 11, border: `1px solid ${S.border}`, fontSize: 13, fontFamily: "'DM Sans', sans-serif", color: S.forest, outline: 'none' }} />
<div style={{ position: 'relative', flexShrink: 0 }}>
<span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: S.stone }}>$</span>
<input type="text" inputMode="decimal" value={newMealPrice[r.id] || ''} onChange={e => setNewMealPrice(p => ({ ...p, [r.id]: e.target.value }))} onKeyDown={e => e.key==='Enter'&&addMeal(r.id)}
placeholder="0.00"
style={{ width: 92, padding: '11px 10px 11px 22px', borderRadius: 11, border: `1px solid ${S.border}`, fontSize: 13, fontFamily: "'DM Sans', sans-serif", color: S.forest, outline: 'none' }} />
</div>
<button onClick={() => addMeal(r.id)} disabled={!(newMealName[r.id]||'').trim()||savingMeals===r.id}
style={{ padding: '11px 15px', borderRadius: 11, border: 'none', background: !(newMealName[r.id]||'').trim()?S.border:(mealCat==='kids'?S.amber:S.sage), color: S.white, fontSize: 13, fontWeight: 600, cursor: !(newMealName[r.id]||'').trim()?'default':'pointer', fontFamily: "'DM Sans', sans-serif", flexShrink: 0 }}>
{savingMeals===r.id?'…':'Add'}
</button>
</div>

<input value={newMealNote[r.id] || ''} onChange={e => setNewMealNote(p => ({ ...p, [r.id]: e.target.value }))} onKeyDown={e => e.key==='Enter'&&addMeal(r.id)}
placeholder="How they like it — no onions, sub wheat toast…"
style={{ width: '100%', boxSizing: 'border-box', marginTop: 8, padding: '11px 13px', borderRadius: 11, border: `1px dashed ${S.border}`, fontSize: 12.5, fontFamily: "'DM Sans', sans-serif", color: S.forest, outline: 'none' }} />

{/* Prefer pickup — moved to the bottom: what it is -> add meals -> how it is sent */}
<div style={{ display: 'flex', alignItems: 'center', gap: 13, marginTop: 18, paddingTop: 16, borderTop: '1px solid #EEF1EC' }}>
<div style={{ width: 34, height: 34, borderRadius: 10, background: r.pickup_preferred ? S.sageLight : '#EFF3ED', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>🥡</div>
<div style={{ flex: 1 }}>
<div style={{ fontSize: 13, fontWeight: 600, color: S.forest }}>Prefer pickup here</div>
<div style={{ fontSize: 11.5, color: S.stone, fontWeight: 300, marginTop: 1 }}>No courier fee — you grab it yourself.</div>
</div>
<button onClick={() => togglePickup(r.id, !!r.pickup_preferred)}
style={{ width: 44, height: 25, borderRadius: 999, border: 'none', background: r.pickup_preferred ? S.sage : S.border, cursor: 'pointer', position: 'relative', flexShrink: 0, transition: 'background 0.2s' }}>
<div style={{ width: 19, height: 19, borderRadius: '50%', background: S.white, position: 'absolute', top: 3, left: r.pickup_preferred ? 22 : 3, transition: 'left 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.15)' }} />
</button>
</div>
</div>
)}
</div>
)
})}
</div>
)}
</div>
)}

{/* Search & add */}
<div style={{ background: S.white, border: `1.5px solid ${S.border}`, borderRadius: 16, padding: '20px' }}>
<button onClick={() => setSearchOpen(v => !v)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: "'DM Sans', sans-serif" }}>
<p style={{ fontSize: 13, fontWeight: 600, color: S.forest, margin: 0 }}>
{restaurants.length === 0 ? 'Add your first favorites' : '+ Add more restaurants'}
</p>
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ transform: (searchOpen || restaurants.length === 0 || isOnboarding) ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}><path d="M6 9l6 6 6-6" stroke={S.stone} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
</button>
{(searchOpen || restaurants.length === 0 || isOnboarding) && (<>
<p style={{ fontSize: 12, color: S.stone, fontWeight: 300, margin: '12px 0 14px', lineHeight: 1.6 }}>
Restaurants over 7 miles may need a larger tip for expedited service.
</p>
{!kitchenLat && (
<div style={{ background: S.amberLight, borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
<p style={{ fontSize: 12, color: S.amber, margin: 0 }}>Add your delivery address in Settings to enable nearby search.</p>
</div>
)}
<div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
<input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => e.key==='Enter'&&searchRestaurants()}
placeholder="e.g. Chipotle, Thai food, pizza"
disabled={!kitchenLat}
style={{ flex: 1, padding: '12px 14px', borderRadius: 10, border: `1.5px solid ${S.border}`, fontSize: 14, fontFamily: "'DM Sans', sans-serif", color: S.forest, outline: 'none', background: kitchenLat ? S.white : '#F5F5F5' }} />
<button onClick={searchRestaurants} disabled={!kitchenLat||searching||!searchQuery.trim()}
style={{ padding: '12px 18px', borderRadius: 10, border: 'none', background: !searchQuery.trim()||!kitchenLat?S.border:S.sage, color: S.white, fontSize: 13, fontWeight: 600, cursor: !searchQuery.trim()?'default':'pointer', fontFamily: "'DM Sans', sans-serif", flexShrink: 0 }}>
{searching ? '…' : 'Search'}
</button>
</div>
{searchResults.length > 0 && (
<div>
<p style={{ fontSize: 11, fontWeight: 700, color: S.stone, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 10px' }}>Within 8 miles</p>
<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
{[...searchResults].sort((a, b) => {
const da = kitchenLat && kitchenLng && a.lat && a.lng ? haversineDistance(kitchenLat, kitchenLng, a.lat, a.lng) : Infinity
const db = kitchenLat && kitchenLng && b.lat && b.lng ? haversineDistance(kitchenLat, kitchenLng, b.lat, b.lng) : Infinity
return da - db
}).map(place => {
const saved = alreadySaved(place)
const isAdding = adding === place.place_id
const miles = kitchenLat && kitchenLng && place.lat && place.lng
? haversineDistance(kitchenLat, kitchenLng, place.lat, place.lng)
: null
const distColor = miles === null ? S.stone : miles < 7 ? S.sage : miles < 10 ? S.amber : S.red
const distBg = miles === null ? S.border : miles < 7 ? S.sageLight : miles < 10 ? S.amberLight : S.redLight
return (
<div key={place.place_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, border: `1px solid ${saved ? S.sageLight : S.border}`, background: saved ? S.sageLight : S.white }}>
<div style={{ flex: 1 }}>
<div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
<span style={{ fontSize: 14, fontWeight: 600, color: S.forest }}>{place.name}</span>
{miles !== null && (
<span style={{ fontSize: 11, fontWeight: 700, color: distColor, background: distBg, borderRadius: 20, padding: '2px 8px' }}>
{formatDistance(miles)}
{miles >= 7 && miles < 10 && ' · larger tip recommended'}
{miles >= 10 && ' · very long delivery'}
</span>
)}
</div>
<div style={{ fontSize: 12, color: S.stone, fontWeight: 300 }}>
{place.address}
{place.rating && <span style={{ color: S.amber, marginLeft: 8 }}>★ {place.rating}</span>}
{place.is_open === true && <span style={{ color: S.sage, marginLeft: 8, fontWeight: 500 }}>Open now</span>}
{place.is_open === false && <span style={{ color: S.red, marginLeft: 8 }}>Closed</span>}
</div>
</div>
{saved ? (
<span style={{ fontSize: 11, fontWeight: 700, color: S.sage, padding: '4px 12px', borderRadius: 20, background: S.sageLight }}>✓ Saved</span>
) : (
<button onClick={() => atLimit ? shakeLimit() : !isAdding && addFavorite(place)} disabled={isAdding}
style={{ padding: '8px 16px', borderRadius: 20, border: 'none', background: atLimit ? S.redLight : S.sage, color: atLimit ? S.red : S.white, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", flexShrink: 0 }}>
{isAdding ? '…' : atLimit ? 'Limit reached' : '+ Add'}
</button>
)}
</div>
)
})}
</div>
</div>
)}
</>)}
</div>

<button onClick={() => { if (!(isOnboarding && activeCount === 0)) router.push('/dashboard') }} disabled={isOnboarding && activeCount === 0}
style={{ width: '100%', marginTop: 24, padding: '15px', borderRadius: 12, border: 'none', background: (isOnboarding && activeCount === 0) ? S.border : S.forest, color: (isOnboarding && activeCount === 0) ? S.stone : S.white, fontSize: 15, fontWeight: 600, cursor: (isOnboarding && activeCount === 0) ? 'not-allowed' : 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
{activeCount > 0 ? '✓ Done — Go to my Kitchen' : isOnboarding ? 'Add a restaurant to continue' : 'Go to my Kitchen'}
</button>
{isOnboarding && activeCount === 0 && (
<p style={{ fontSize: 12, color: S.stone, fontWeight: 300, textAlign: 'center', margin: '10px 0 0', lineHeight: 1.5 }}>
Search above and tap <strong>+ Add</strong> on one restaurant to finish setting up your Kitchen.
</p>
)}
</div>
</div>
)
}

export default function KitchenRestaurantsPage() {
return (
<Suspense fallback={<div style={{ minHeight: '100vh', background: '#FAFAF5' }} />}>
<KitchenRestaurantsContent />
</Suspense>
)
}

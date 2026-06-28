'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

const C = {
  sage: '#3D6B4F', sageMid: '#6B9E7E', sageLight: '#EAF2ED',
  cream: '#FAFAF5', forest: '#1E2620', stone: '#6B7066',
  border: '#DDE8E0', white: '#FFFFFF', gold: '#C17F47', heart: '#C0463B',
  serif: "'Lora', Georgia, serif", sans: "'DM Sans', system-ui, sans-serif",
}

function e164(raw: string): string | null {
  const d = (raw || '').replace(/\D/g, '')
  if (d.length === 10) return '+1' + d
  if (d.length === 11 && d.startsWith('1')) return '+' + d
  return null
}

const isoOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const money = (n: number) => `$${(Number(n) || 0).toFixed(2).replace(/\.00$/, '')}`

type Kitchen = { id: string; name: string; slug: string; address: string | null; latitude?: number | null; longitude?: number | null }
type PlaceResult = { place_id: string; name: string; address: string | null; lat: number | null; lng: number | null; cuisine?: string }
type Restaurant = {
  id: string; name: string; cuisine: string | null; place_id: string | null; address: string | null; is_active: boolean
  favorite_meals: string[]; favorite_meal_prices: number[]; favorite_meal_categories: string[]
  favorite_meal_notes: string[]; favorite_meal_tags: string[]
}
type ReviewItem = { name: string; price: string; kids: boolean; sel: boolean }
type CalDate = { id: string; date: string; status: string; meal_type: string }

const WEEK = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export default function MyKitchenPage() {
  const supabase = createClient()

  const [phase, setPhase] = useState<'loading' | 'phone' | 'code' | 'ready'>('loading')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [kitchen, setKitchen] = useState<Kitchen | null>(null)
  const [noKitchen, setNoKitchen] = useState(false)
  const [address, setAddress] = useState('')
  const [savedAddr, setSavedAddr] = useState(false)

  // ── Catalog ──
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<PlaceResult[]>([])
  const [searching, setSearching] = useState(false)
  const [adding, setAdding] = useState<string | null>(null)
  const [review, setReview] = useState<{ rId: string; name: string; items: ReviewItem[] } | null>(null)
  const [reviewBusy, setReviewBusy] = useState(false)
  const [mealDraft, setMealDraft] = useState<Record<string, { name: string; price: string; kids: boolean }>>({})
  const [mealBusy, setMealBusy] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  // ── Calendar ──
  const [dates, setDates] = useState<CalDate[]>([])
  const [dateBusy, setDateBusy] = useState<string | null>(null)

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2500) }

  const loadRestaurants = useCallback(async (kitchenId: string): Promise<Restaurant[]> => {
    try {
      const res = await fetch(`/api/restaurants/favorites?kitchen_id=${kitchenId}`)
      const data = await res.json()
      const list: Restaurant[] = data.favorites || []
      setRestaurants(list)
      return list
    } catch { setRestaurants([]); return [] }
  }, [])

  const loadDates = useCallback(async (kitchenId: string) => {
    try {
      const res = await fetch(`/api/calendar?kitchen_id=${kitchenId}`)
      const data = await res.json()
      setDates(data.dates || [])
    } catch { setDates([]) }
  }, [])

  const loadKitchen = useCallback(async () => {
    try {
      const res = await fetch('/api/recipient/kitchen')
      const data = await res.json()
      if (res.ok && data.kitchens?.length) {
        const k: Kitchen = data.kitchens[0]
        setKitchen(k)
        setAddress(k.address || '')
        setNoKitchen(false)
        loadRestaurants(k.id)
        loadDates(k.id)
      } else {
        setNoKitchen(true)
      }
    } catch {
      setNoKitchen(true)
    }
    setPhase('ready')
  }, [loadRestaurants, loadDates])

  // If they already have a session, skip the login and go straight to their kitchen.
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser()
      if (data?.user) await loadKitchen()
      else setPhase('phone')
    })()
  }, [supabase, loadKitchen])

  async function sendCode() {
    setError(null)
    const p = e164(phone)
    if (!p) { setError('Enter a valid US mobile number.'); return }
    setBusy(true)
    const { error: e } = await supabase.auth.signInWithOtp({ phone: p })
    setBusy(false)
    if (e) { setError(e.message || 'Could not send the code.'); return }
    setPhase('code')
  }

  async function verify() {
    setError(null)
    const p = e164(phone)
    if (!p || !code.trim()) { setError('Enter the code we texted you.'); return }
    setBusy(true)
    const { error: e } = await supabase.auth.verifyOtp({ phone: p, token: code.trim(), type: 'sms' })
    if (e) { setBusy(false); setError(e.message || 'That code didn’t match.'); return }
    await loadKitchen()
    setBusy(false)
  }

  async function saveAddress() {
    if (!kitchen) return
    setError(null); setSavedAddr(false); setBusy(true)
    try {
      const res = await fetch('/api/recipient/kitchen', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kitchen_id: kitchen.id, address: address.trim() }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) setError(data.error || 'Could not save the address.')
      else { setSavedAddr(true); setTimeout(() => setSavedAddr(false), 2200) }
    } catch (e: any) {
      setError(e?.message || 'Network error.')
    } finally {
      setBusy(false)
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setKitchen(null); setNoKitchen(false); setPhone(''); setCode(''); setPhase('phone')
    setRestaurants([]); setDates([]); setSearchResults([]); setSearchQuery('')
  }

  // ── Catalog actions ──
  const runSearch = async () => {
    if (!searchQuery.trim() || !kitchen) return
    setSearching(true)
    try {
      const q = encodeURIComponent(searchQuery.trim())
      const geo = (kitchen.latitude && kitchen.longitude) ? `lat=${kitchen.latitude}&lng=${kitchen.longitude}&` : ''
      const res = await fetch(`/api/restaurants/search?${geo}query=${q}`)
      const data = await res.json()
      setSearchResults(data.restaurants || [])
    } catch { setSearchResults([]) }
    setSearching(false)
  }

  const patchMeals = async (rId: string, meals: string[], prices: number[], cats: string[], notes: string[], tags: string[]) => {
    setRestaurants(prev => prev.map(r => r.id === rId
      ? { ...r, favorite_meals: meals, favorite_meal_prices: prices, favorite_meal_categories: cats, favorite_meal_notes: notes, favorite_meal_tags: tags }
      : r))
    await fetch('/api/restaurants/favorites', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restaurant_id: rId, favorite_meals: meals, favorite_meal_prices: prices, favorite_meal_categories: cats, favorite_meal_notes: notes, favorite_meal_tags: tags }),
    })
  }

  const autoImport = async (rId: string, placeId: string, name: string) => {
    try {
      const wr = await fetch(`/api/restaurants/website?place_id=${encodeURIComponent(placeId)}`)
      const wd = await wr.json()
      if (!wd?.website) return
      const res = await fetch('/api/menu-parse', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: wd.website, restaurantName: name }),
      })
      const data = await res.json()
      if (res.ok && data?.success && Array.isArray(data.items) && data.items.length) {
        setReview({
          rId, name,
          items: (data.items as any[]).slice(0, 20).map(i => ({
            name: String(i.name || '').slice(0, 60),
            price: (Number(i.price) || 0).toFixed(2),
            kids: i.category === 'kids',
            sel: true,
          })).filter(i => i.name),
        })
      }
    } catch {
      // silent — manual meal entry stays available
    }
  }

  const addRestaurant = async (p: PlaceResult) => {
    if (!kitchen) return
    setAdding(p.place_id)
    try {
      const res = await fetch('/api/restaurants/favorites', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kitchen_id: kitchen.id, place_id: p.place_id, name: p.name, address: p.address, lat: p.lat, lng: p.lng }),
      })
      const data = await res.json()
      if (data.success) {
        const list = await loadRestaurants(kitchen.id)
        setSearchResults(rs => rs.filter(r => r.place_id !== p.place_id))
        flash(`${p.name} added`)
        const newRest = list.find(r => r.place_id === p.place_id) || list.find(r => r.name === p.name)
        if (newRest && p.place_id) autoImport(newRest.id, p.place_id, p.name)
      } else {
        flash(data.error || 'Could not add that spot')
      }
    } catch { flash('Network error') }
    setAdding(null)
  }

  const saveReview = async () => {
    if (!review) return
    const rest = restaurants.find(r => r.id === review.rId)
    if (!rest) { setReview(null); return }
    const picked = review.items.filter(i => i.sel && i.name.trim())
    if (!picked.length) { setReview(null); return }
    setReviewBusy(true)
    const meals = [...(rest.favorite_meals || []), ...picked.map(i => i.name.trim())]
    const prices = [...(rest.favorite_meal_prices || []), ...picked.map(i => parseFloat(i.price) || 15)]
    const cats = [...(rest.favorite_meal_categories || []), ...picked.map(i => i.kids ? 'kids' : 'adult')]
    const notes = [...(rest.favorite_meal_notes || []), ...picked.map(() => '')]
    const tags = [...(rest.favorite_meal_tags || []), ...picked.map(() => '')]
    await patchMeals(review.rId, meals, prices, cats, notes, tags)
    setReviewBusy(false)
    setReview(null)
    flash(`${picked.length} meal${picked.length > 1 ? 's' : ''} added`)
  }

  const addMeal = async (rId: string) => {
    const d = mealDraft[rId]
    if (!d || !d.name.trim()) return
    const rest = restaurants.find(r => r.id === rId)
    if (!rest) return
    setMealBusy(rId)
    const meals = [...(rest.favorite_meals || []), d.name.trim()]
    const prices = [...(rest.favorite_meal_prices || []), parseFloat(d.price) || 15]
    const cats = [...(rest.favorite_meal_categories || []), d.kids ? 'kids' : 'adult']
    const notes = [...(rest.favorite_meal_notes || []), '']
    const tags = [...(rest.favorite_meal_tags || []), '']
    await patchMeals(rId, meals, prices, cats, notes, tags)
    setMealDraft(p => ({ ...p, [rId]: { name: '', price: '', kids: false } }))
    setMealBusy(null)
  }

  const removeMeal = async (rId: string, idx: number) => {
    const rest = restaurants.find(r => r.id === rId)
    if (!rest) return
    const meals = (rest.favorite_meals || []).filter((_, i) => i !== idx)
    const prices = (rest.favorite_meal_prices || []).filter((_, i) => i !== idx)
    const cats = (rest.favorite_meal_categories || []).filter((_, i) => i !== idx)
    const notes = (rest.favorite_meal_notes || []).filter((_, i) => i !== idx)
    const tags = (rest.favorite_meal_tags || []).filter((_, i) => i !== idx)
    await patchMeals(rId, meals, prices, cats, notes, tags)
  }

  const removeRestaurant = async (rId: string, name: string) => {
    if (!confirm(`Remove ${name} from your kitchen?`)) return
    setRestaurants(prev => prev.filter(r => r.id !== rId))
    if (review?.rId === rId) setReview(null)
    await fetch('/api/restaurants/favorites', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restaurant_id: rId }),
    })
    flash(`${name} removed`)
  }

  // ── Calendar actions ──
  const cells = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const start = new Date(today); start.setDate(today.getDate() - today.getDay())
    return Array.from({ length: 56 }, (_, i) => {
      const d = new Date(start); d.setDate(start.getDate() + i)
      return {
        iso: isoOf(d),
        dom: d.getDate(),
        past: d < today,
        monthStart: d.getDate() === 1,
        month: d.toLocaleDateString(undefined, { month: 'short' }),
      }
    })
  }, [])

  const dateByIso = useMemo(() => {
    const m = new Map<string, CalDate>()
    for (const d of dates) m.set(d.date, d)
    return m
  }, [dates])

  const openCount = dates.length

  const toggleDate = async (iso: string) => {
    if (!kitchen) return
    const existing = dateByIso.get(iso)
    setDateBusy(iso)
    try {
      if (existing) {
        if (existing.status !== 'available') { flash('That day is already claimed by your village'); setDateBusy(null); return }
        await fetch('/api/calendar', {
          method: 'DELETE', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date_id: existing.id }),
        })
        setDates(prev => prev.filter(d => d.id !== existing.id))
      } else {
        const res = await fetch('/api/calendar', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kitchen_id: kitchen.id, date: iso, meal_type: 'dinner' }),
        })
        const data = await res.json()
        if (data.success && data.date) {
          setDates(prev => [...prev, { id: data.date.id, date: iso, status: 'available', meal_type: 'dinner' }])
        } else if (data.error) {
          flash(data.error)
        }
      }
    } catch { flash('Network error') }
    setDateBusy(null)
  }

  // ── Styles ──
  const input: React.CSSProperties = {
    width: '100%', fontFamily: C.sans, fontSize: 15, color: C.forest,
    padding: '11px 13px', borderRadius: 10, border: `1px solid ${C.border}`,
    background: C.white, outline: 'none', boxSizing: 'border-box',
  }
  const primaryBtn: React.CSSProperties = {
    fontFamily: C.sans, fontSize: 15, fontWeight: 600, color: C.white,
    background: busy ? C.sageMid : C.sage, border: 'none', borderRadius: 10,
    padding: '13px 16px', cursor: busy ? 'default' : 'pointer', width: '100%',
  }
  const card: React.CSSProperties = {
    background: C.white, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24,
  }
  const eyebrow: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: C.sage, marginBottom: 10,
  }
  const smallBtn: React.CSSProperties = {
    fontFamily: C.sans, fontSize: 13, fontWeight: 600, borderRadius: 9, padding: '8px 12px', cursor: 'pointer',
  }

  return (
    <div style={{ minHeight: '100vh', background: C.cream, padding: '40px 18px', fontFamily: C.sans }}>
      <div style={{ maxWidth: 460, margin: '0 auto' }}>

        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.sageMid, marginBottom: 8 }}>
            Your kitchen
          </div>
          <h1 style={{ fontFamily: C.serif, fontWeight: 600, fontSize: 26, color: C.forest, lineHeight: 1.2, margin: 0 }}>
            {phase === 'ready' && kitchen ? kitchen.name : 'Set up your kitchen'}
          </h1>
        </div>

        {phase === 'loading' && (
          <div style={{ ...card, color: C.stone, fontSize: 14 }}>One moment…</div>
        )}

        {phase === 'phone' && (
          <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ fontSize: 14, color: C.stone, lineHeight: 1.6, margin: 0 }}>
              Enter the mobile number your kitchen was set up with. We’ll text you a code — no password.
            </p>
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(555) 123-4567" inputMode="tel" style={input} />
            {error && <div style={{ fontSize: 13, color: C.heart }}>{error}</div>}
            <button onClick={sendCode} disabled={busy} style={primaryBtn}>{busy ? 'Sending…' : 'Text me a code'}</button>
          </div>
        )}

        {phase === 'code' && (
          <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ fontSize: 14, color: C.stone, lineHeight: 1.6, margin: 0 }}>
              We texted a code to {phone}. Enter it below.
            </p>
            <input value={code} onChange={e => setCode(e.target.value)} placeholder="6-digit code" inputMode="numeric" style={input} />
            {error && <div style={{ fontSize: 13, color: C.heart }}>{error}</div>}
            <button onClick={verify} disabled={busy} style={primaryBtn}>{busy ? 'Checking…' : 'Verify'}</button>
            <button onClick={() => { setPhase('phone'); setCode(''); setError(null) }} style={{ background: 'transparent', border: 'none', color: C.sage, fontFamily: C.sans, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Use a different number
            </button>
          </div>
        )}

        {phase === 'ready' && noKitchen && (
          <div style={{ ...card }}>
            <div style={{ fontFamily: C.serif, fontSize: 18, fontWeight: 600, color: C.forest, marginBottom: 6 }}>
              No kitchen yet for this number.
            </div>
            <p style={{ fontSize: 14, color: C.stone, lineHeight: 1.6 }}>
              Whoever is setting up meals for you will create your kitchen — then you can come back here to add your favorites. If you think this is a mistake, double-check the number.
            </p>
            <button onClick={signOut} style={{ marginTop: 16, background: 'transparent', border: `1px solid ${C.border}`, color: C.sage, fontFamily: C.sans, fontSize: 13, fontWeight: 600, borderRadius: 10, padding: '10px 16px', cursor: 'pointer' }}>
              Try another number
            </button>
          </div>
        )}

        {phase === 'ready' && kitchen && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Delivery address */}
            <div style={card}>
              <div style={eyebrow}>Where should meals go?</div>
              <label style={{ display: 'block', fontFamily: C.sans, fontSize: 13, fontWeight: 600, color: C.forest, marginBottom: 6 }}>
                Delivery address
              </label>
              <input value={address} onChange={e => setAddress(e.target.value)} placeholder="123 Main St, City, ST 00000" style={input} />
              {error && <div style={{ fontSize: 13, color: C.heart, marginTop: 8 }}>{error}</div>}
              <button onClick={saveAddress} disabled={busy} style={{ ...primaryBtn, marginTop: 12 }}>
                {busy ? 'Saving…' : savedAddr ? 'Saved ✓' : 'Save address'}
              </button>
            </div>

            {/* Restaurants */}
            <div style={card}>
              <div style={eyebrow}>Your restaurants</div>
              <p style={{ fontSize: 13, color: C.stone, lineHeight: 1.6, margin: '0 0 12px' }}>
                Add the places you love. We’ll try to pull in their menu automatically — you can also type meals in yourself.
              </p>

              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') runSearch() }}
                  placeholder="Search a restaurant…"
                  style={input}
                />
                <button onClick={runSearch} disabled={searching || !searchQuery.trim()} style={{ ...smallBtn, color: C.white, background: searching ? C.sageMid : C.sage, border: 'none', whiteSpace: 'nowrap', padding: '8px 16px' }}>
                  {searching ? '…' : 'Search'}
                </button>
              </div>

              {searchResults.length > 0 && (
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {searchResults.map(p => (
                    <div key={p.place_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: C.forest, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                        {p.address && <div style={{ fontSize: 12, color: C.stone, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.address}</div>}
                      </div>
                      <button onClick={() => addRestaurant(p)} disabled={adding === p.place_id} style={{ ...smallBtn, color: C.sage, background: C.sageLight, border: 'none', whiteSpace: 'nowrap' }}>
                        {adding === p.place_id ? 'Adding…' : 'Add'}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {restaurants.length === 0 && searchResults.length === 0 && (
                <div style={{ marginTop: 12, fontSize: 13, color: C.stone, fontStyle: 'italic' }}>
                  No restaurants yet — search above to add your first.
                </div>
              )}

              {restaurants.length > 0 && (
                <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {restaurants.map(r => {
                    const draft = mealDraft[r.id] || { name: '', price: '', kids: false }
                    const meals = r.favorite_meals || []
                    return (
                      <div key={r.id} style={{ border: `1px solid ${C.border}`, borderRadius: 12, padding: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                          <div style={{ fontFamily: C.serif, fontSize: 16, fontWeight: 600, color: C.forest }}>{r.name}</div>
                          <button onClick={() => removeRestaurant(r.id, r.name)} style={{ background: 'transparent', border: 'none', color: C.stone, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                            Remove
                          </button>
                        </div>

                        {/* Review imported menu */}
                        {review && review.rId === r.id && (
                          <div style={{ marginTop: 10, background: C.sageLight, borderRadius: 10, padding: 12 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: C.forest, marginBottom: 8 }}>
                              We found these on their menu — pick the ones to keep:
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
                              {review.items.map((it, i) => (
                                <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.forest, cursor: 'pointer' }}>
                                  <input
                                    type="checkbox"
                                    checked={it.sel}
                                    onChange={e => setReview(rv => rv ? { ...rv, items: rv.items.map((x, j) => j === i ? { ...x, sel: e.target.checked } : x) } : rv)}
                                  />
                                  <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.name}</span>
                                  <span style={{ color: C.stone }}>{money(parseFloat(it.price) || 0)}</span>
                                </label>
                              ))}
                            </div>
                            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                              <button onClick={saveReview} disabled={reviewBusy} style={{ ...smallBtn, color: C.white, background: C.sage, border: 'none' }}>
                                {reviewBusy ? 'Adding…' : 'Add selected'}
                              </button>
                              <button onClick={() => setReview(null)} style={{ ...smallBtn, color: C.stone, background: 'transparent', border: `1px solid ${C.border}` }}>
                                Skip
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Meals */}
                        {meals.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                            {meals.map((m, i) => {
                              const kids = (r.favorite_meal_categories || [])[i] === 'kids'
                              const price = (r.favorite_meal_prices || [])[i]
                              return (
                                <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: kids ? '#FFF4E8' : C.sageLight, color: kids ? C.gold : C.sage, borderRadius: 999, padding: '5px 10px', fontSize: 12.5, fontWeight: 600 }}>
                                  {m}{typeof price === 'number' ? ` · ${money(price)}` : ''}
                                  <button onClick={() => removeMeal(r.id, i)} aria-label={`Remove ${m}`} style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 13, lineHeight: 1, padding: 0 }}>×</button>
                                </span>
                              )
                            })}
                          </div>
                        )}

                        {/* Add a meal manually */}
                        <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                          <input
                            value={draft.name}
                            onChange={e => setMealDraft(p => ({ ...p, [r.id]: { ...draft, name: e.target.value } }))}
                            onKeyDown={e => { if (e.key === 'Enter') addMeal(r.id) }}
                            placeholder="Add a meal"
                            style={{ ...input, flex: 1, minWidth: 130, fontSize: 14, padding: '9px 11px' }}
                          />
                          <input
                            value={draft.price}
                            onChange={e => setMealDraft(p => ({ ...p, [r.id]: { ...draft, price: e.target.value } }))}
                            onKeyDown={e => { if (e.key === 'Enter') addMeal(r.id) }}
                            placeholder="$"
                            inputMode="decimal"
                            style={{ ...input, width: 64, fontSize: 14, padding: '9px 11px' }}
                          />
                          <button
                            onClick={() => setMealDraft(p => ({ ...p, [r.id]: { ...draft, kids: !draft.kids } }))}
                            style={{ ...smallBtn, border: `1px solid ${C.border}`, background: draft.kids ? '#FFF4E8' : C.white, color: draft.kids ? C.gold : C.stone, padding: '8px 10px' }}
                          >
                            {draft.kids ? 'Kids' : 'Adult'}
                          </button>
                          <button onClick={() => addMeal(r.id)} disabled={mealBusy === r.id || !draft.name.trim()} style={{ ...smallBtn, color: C.white, background: C.sage, border: 'none', padding: '8px 14px' }}>
                            {mealBusy === r.id ? '…' : 'Add'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Calendar */}
            <div style={card}>
              <div style={eyebrow}>Pick your dinner days</div>
              <p style={{ fontSize: 13, color: C.stone, lineHeight: 1.6, margin: '0 0 12px' }}>
                Tap a day to open it for dinner. Tap again to close it. Your village can only send on the days you’ve opened.
                {openCount > 0 ? ` You have ${openCount} day${openCount > 1 ? 's' : ''} open.` : ''}
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 5 }}>
                {WEEK.map((w, i) => (
                  <div key={`h${i}`} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: C.stone }}>{w}</div>
                ))}
                {cells.map(c => {
                  const rec = dateByIso.get(c.iso)
                  const open = !!rec
                  const claimed = !!rec && rec.status !== 'available'
                  const disabled = c.past || dateBusy === c.iso
                  const bg = claimed ? C.gold : open ? C.sage : C.white
                  const fg = (claimed || open) ? C.white : (c.past ? '#C7CFC9' : C.forest)
                  return (
                    <button
                      key={c.iso}
                      onClick={() => !disabled && toggleDate(c.iso)}
                      disabled={disabled}
                      title={claimed ? 'Claimed by your village' : open ? 'Open — tap to close' : c.past ? '' : 'Tap to open for dinner'}
                      style={{
                        aspectRatio: '1 / 1', borderRadius: 9, border: `1px solid ${open || claimed ? 'transparent' : C.border}`,
                        background: bg, color: fg, fontFamily: C.sans, fontSize: 13, fontWeight: open || claimed ? 700 : 500,
                        cursor: disabled ? 'default' : 'pointer', opacity: c.past ? 0.45 : 1,
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', lineHeight: 1.1, padding: 0,
                      }}
                    >
                      {c.monthStart && <span style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '0.03em', opacity: 0.8 }}>{c.month}</span>}
                      {c.dom}
                    </button>
                  )
                })}
              </div>

              <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 12, color: C.stone }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 11, height: 11, borderRadius: 3, background: C.sage, display: 'inline-block' }} /> Open</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 11, height: 11, borderRadius: 3, background: C.gold, display: 'inline-block' }} /> Claimed</span>
              </div>
            </div>

            <button onClick={signOut} style={{ background: 'transparent', border: 'none', color: C.stone, fontFamily: C.sans, fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 4 }}>
              Sign out
            </button>
          </div>
        )}
      </div>

      {toast && (
        <div style={{ position: 'fixed', left: '50%', bottom: 24, transform: 'translateX(-50%)', background: C.forest, color: C.white, fontFamily: C.sans, fontSize: 13.5, fontWeight: 600, padding: '10px 18px', borderRadius: 999, boxShadow: '0 6px 20px rgba(0,0,0,0.16)', zIndex: 50 }}>
          {toast}
        </div>
      )}
    </div>
  )
}

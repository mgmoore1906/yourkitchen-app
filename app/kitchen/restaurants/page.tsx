'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const S = {
  sage: '#3D6B4F', sageMid: '#6B9E7E', sageLight: '#EAF2ED',
  cream: '#FAFAF5', forest: '#1E2620', stone: '#6B7066',
  border: '#DDE8E0', white: '#FFFFFF', amber: '#C17F47',
  amberLight: '#FBF0E4', red: '#B94040', redLight: '#FDE8E8',
}

const TIER_LIMITS: Record<string, number> = {
  free: 3, trial: 10, care: 10, annual: 10, founding: 999,
}
const TIER_LABELS: Record<string, string> = {
  free: 'Free', trial: 'Free Trial', care: 'Care+',
  annual: 'Early Adopter', founding: 'Founding Member',
}

type Restaurant = {
  id: string; name: string; cuisine: string
  is_active: boolean; doordash_store_id: string | null
  place_id: string | null; address: string | null
  favorite_meals: string[]
}
type PlaceResult = {
  place_id: string; name: string; address: string
  rating: number | null; is_open: boolean | null
}

export default function KitchenRestaurantsPage() {
  const router   = useRouter()
  const supabase = createClient()

  const [loading,      setLoading]      = useState(true)
  const [kitchenId,    setKitchenId]    = useState('')
  const [kitchenLat,   setKitchenLat]   = useState<number | null>(null)
  const [kitchenLng,   setKitchenLng]   = useState<number | null>(null)
  const [userTier,     setUserTier]     = useState('free')
  const [restaurants,  setRestaurants]  = useState<Restaurant[]>([])
  const [saveMsg,      setSaveMsg]      = useState('')
  const [expandedId,   setExpandedId]   = useState<string | null>(null)
  const [newMeal,      setNewMeal]      = useState<Record<string, string>>({})
  const [savingMeals,  setSavingMeals]  = useState<string | null>(null)
  const [deleting,     setDeleting]     = useState<string | null>(null)

  // Search state
  const [searchQuery,   setSearchQuery]   = useState('')
  const [searchResults, setSearchResults] = useState<PlaceResult[]>([])
  const [searching,     setSearching]     = useState(false)
  const [adding,        setAdding]        = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: profile } = await supabase
        .from('profiles').select('tier').eq('id', user.id).single()
      setUserTier(profile?.tier || 'free')
      const { data: kitchen } = await supabase
        .from('kitchens').select('id, latitude, longitude')
        .eq('organizer_id', user.id)
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
      .select('id, name, cuisine, is_active, doordash_store_id, place_id, address, favorite_meals')
      .eq('kitchen_id', kId)
      .order('created_at', { ascending: true })
    setRestaurants((data || []).map((r: any) => ({ ...r, favorite_meals: r.favorite_meals || [] })))
  }

  const limit       = TIER_LIMITS[userTier] || 3
  const activeCount = restaurants.filter(r => r.is_active).length
  const atLimit     = activeCount >= limit

  const searchRestaurants = useCallback(async () => {
    if (!searchQuery.trim() || !kitchenLat || !kitchenLng) return
    setSearching(true)
    try {
      const res  = await fetch(`/api/restaurants/search?lat=${kitchenLat}&lng=${kitchenLng}&query=${encodeURIComponent(searchQuery)}`)
      const data = await res.json()
      setSearchResults(data.restaurants || [])
    } catch { setSearchResults([]) }
    setSearching(false)
  }, [searchQuery, kitchenLat, kitchenLng])

  const addFavorite = async (place: PlaceResult) => {
    if (atLimit) return
    setAdding(place.place_id)
    const res = await fetch('/api/restaurants/favorites', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kitchen_id: kitchenId, place_id: place.place_id, name: place.name, address: place.address, cuisine: 'Restaurant' }),
    })
    const data = await res.json()
    if (data.success) {
      await loadRestaurants(kitchenId)
      setSaveMsg(`${place.name} added!`)
      setTimeout(() => setSaveMsg(''), 3000)
      setSearchResults(prev => prev.filter(r => r.place_id !== place.place_id))
    }
    setAdding(null)
  }

  const toggleActive = async (id: string, currentActive: boolean) => {
    if (!currentActive && atLimit) return
    const newActive = !currentActive
    setRestaurants(prev => prev.map(r => r.id === id ? { ...r, is_active: newActive } : r))
    await supabase.from('kitchen_restaurants').update({ is_active: newActive }).eq('id', id)
    setSaveMsg(newActive ? 'Shown to coordinators' : 'Hidden from coordinators')
    setTimeout(() => setSaveMsg(''), 2500)
  }

  const deleteRestaurant = async (id: string, name: string) => {
    if (!confirm(`Remove ${name} from your favorites?`)) return
    setDeleting(id)
    await fetch('/api/restaurants/favorites', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restaurant_id: id }),
    })
    setRestaurants(prev => prev.filter(r => r.id !== id))
    setSaveMsg(`${name} removed`)
    setTimeout(() => setSaveMsg(''), 2500)
    setDeleting(null)
  }

  const addMeal = async (restaurantId: string) => {
    const meal = (newMeal[restaurantId] || '').trim()
    if (!meal) return
    setSavingMeals(restaurantId)
    const rest    = restaurants.find(r => r.id === restaurantId)!
    const updated = [...(rest.favorite_meals || []), meal]
    await fetch('/api/restaurants/favorites', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restaurant_id: restaurantId, favorite_meals: updated }),
    })
    setRestaurants(prev => prev.map(r => r.id === restaurantId ? { ...r, favorite_meals: updated } : r))
    setNewMeal(prev => ({ ...prev, [restaurantId]: '' }))
    setSavingMeals(null)
  }

  const removeMeal = async (restaurantId: string, meal: string) => {
    const rest    = restaurants.find(r => r.id === restaurantId)!
    const updated = rest.favorite_meals.filter(m => m !== meal)
    await fetch('/api/restaurants/favorites', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restaurant_id: restaurantId, favorite_meals: updated }),
    })
    setRestaurants(prev => prev.map(r => r.id === restaurantId ? { ...r, favorite_meals: updated } : r))
  }

  const alreadySaved = (place: PlaceResult) =>
    restaurants.some(r => r.place_id === place.place_id || r.name.toLowerCase() === place.name.toLowerCase())

  if (loading) return (
    <div style={{ minHeight: '100vh', background: S.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans', sans-serif" }}>
      <p style={{ color: S.stone, fontSize: 14 }}>Loading restaurants…</p>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: S.cream, fontFamily: "'DM Sans', sans-serif", paddingBottom: 60 }}>
      <link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />

      {/* Nav */}
      <nav style={{ background: S.white, borderBottom: `0.5px solid ${S.border}`, padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 10 }}>
        <button onClick={() => router.push('/dashboard')}
          style={{ background: S.sageLight, border: 'none', borderRadius: 10, width: 36, height: 36, cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', color: S.sage }}>‹</button>
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: 8, fontWeight: 500, letterSpacing: 5, color: S.sageMid, textTransform: 'uppercase', display: 'block' }}>Your</span>
          <span style={{ fontFamily: "'Lora', serif", fontSize: 20, fontWeight: 500, color: S.forest }}>Kitchen</span>
        </div>
        {saveMsg && <span style={{ fontSize: 12, color: S.sage, fontWeight: 600 }}>{saveMsg}</span>}
      </nav>

      <div style={{ padding: '24px', maxWidth: 540, margin: '0 auto' }}>
        <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: S.sage, margin: '0 0 6px' }}>My Restaurants</p>
        <h1 style={{ fontFamily: "'Lora', serif", fontSize: 24, fontWeight: 500, color: S.forest, margin: '0 0 6px', letterSpacing: -0.5 }}>Favorite restaurants</h1>
        <p style={{ fontSize: 14, color: S.stone, margin: '0 0 20px', fontWeight: 300, lineHeight: 1.6 }}>
          Add your favorites and list your go-to meals at each one. Coordinators will see exactly what to order.
        </p>

        {/* Tier limit */}
        <div style={{ background: S.white, border: `1.5px solid ${atLimit ? S.amber : S.border}`, borderRadius: 14, padding: '14px 16px', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: atLimit ? 10 : 0 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: S.forest }}>{activeCount} / {limit === 999 ? '∞' : limit} active · {TIER_LABELS[userTier]}</span>
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

        {/* Saved restaurants */}
        {restaurants.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: S.stone, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 12px' }}>Your favorites ({restaurants.length})</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {restaurants.map(r => {
                const isExpanded = expandedId === r.id
                return (
                  <div key={r.id} style={{ background: S.white, border: `1.5px solid ${r.is_active ? S.sage : S.border}`, borderRadius: 14, overflow: 'hidden', transition: 'all 0.15s' }}>

                    {/* Restaurant header row */}
                    <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => setExpandedId(isExpanded ? null : r.id)}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontFamily: "'Lora', serif", fontSize: 15, fontWeight: 600, color: S.forest }}>{r.name}</span>
                          {r.favorite_meals?.length > 0 && (
                            <span style={{ fontSize: 9, fontWeight: 700, background: S.amberLight, color: S.amber, borderRadius: 20, padding: '2px 8px' }}>
                              {r.favorite_meals.length} meal{r.favorite_meals.length !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: S.stone, fontWeight: 300, marginTop: 2 }}>
                          {r.address || r.cuisine}
                          {r.is_active && <span style={{ color: S.sageMid, marginLeft: 6 }}>· shown to coordinators ✓</span>}
                        </div>
                      </div>

                      {/* Actions */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {/* Expand to manage meals */}
                        <button onClick={() => setExpandedId(isExpanded ? null : r.id)}
                          style={{ background: isExpanded ? S.sageLight : 'none', border: `1px solid ${isExpanded ? S.sage : S.border}`, borderRadius: 8, padding: '5px 10px', fontSize: 11, fontWeight: 600, color: isExpanded ? S.sage : S.stone, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                          {isExpanded ? 'Done' : '✏️ Meals'}
                        </button>

                        {/* Toggle active */}
                        <button onClick={() => (r.is_active || !atLimit) && toggleActive(r.id, r.is_active)}
                          disabled={!r.is_active && atLimit}
                          style={{ width: 44, height: 24, borderRadius: 12, border: 'none', background: r.is_active ? S.sage : S.border, cursor: (!r.is_active && atLimit) ? 'not-allowed' : 'pointer', position: 'relative', flexShrink: 0, transition: 'background 0.2s' }}>
                          <div style={{ width: 18, height: 18, borderRadius: '50%', background: S.white, position: 'absolute', top: 3, left: r.is_active ? 23 : 3, transition: 'left 0.2s' }} />
                        </button>

                        {/* Delete */}
                        <button onClick={() => deleteRestaurant(r.id, r.name)}
                          disabled={deleting === r.id}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: S.stone, fontSize: 16, padding: '4px', lineHeight: 1, opacity: deleting === r.id ? 0.5 : 1 }}
                          title="Remove from favorites">
                          🗑
                        </button>
                      </div>
                    </div>

                    {/* Expanded — manage favorite meals */}
                    {isExpanded && (
                      <div style={{ borderTop: `0.5px solid ${S.border}`, padding: '16px', background: '#FAFDF9' }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: S.sage, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 10px' }}>
                          Favorite meals at {r.name}
                        </p>
                        <p style={{ fontSize: 12, color: S.stone, fontWeight: 300, margin: '0 0 12px', lineHeight: 1.6 }}>
                          Add real dish names so coordinators know exactly what to order. Be specific — "Smash Burger with fries" not just "burger."
                        </p>

                        {/* Current saved meals */}
                        {r.favorite_meals?.length > 0 ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                            {r.favorite_meals.map(meal => (
                              <div key={meal} style={{ display: 'flex', alignItems: 'center', gap: 6, background: S.sageLight, border: `1px solid ${S.sage}`, borderRadius: 20, padding: '5px 12px' }}>
                                <span style={{ fontSize: 13, color: S.forest, fontWeight: 500 }}>⭐ {meal}</span>
                                <button onClick={() => removeMeal(r.id, meal)}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: S.sage, fontSize: 13, padding: 0, lineHeight: 1 }}>✕</button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ background: S.amberLight, borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
                            <p style={{ fontSize: 12, color: S.amber, margin: 0, fontWeight: 500 }}>
                              No meals saved yet. Coordinators will be asked to enter the meal name manually.
                            </p>
                          </div>
                        )}

                        {/* Add a meal */}
                        <div style={{ display: 'flex', gap: 8 }}>
                          <input
                            value={newMeal[r.id] || ''}
                            onChange={e => setNewMeal(prev => ({ ...prev, [r.id]: e.target.value }))}
                            onKeyDown={e => e.key === 'Enter' && addMeal(r.id)}
                            placeholder={`e.g. "Smash Burger with fries" or "Chicken Sandwich"`}
                            style={{ flex: 1, padding: '10px 14px', borderRadius: 9, border: `1.5px solid ${S.border}`, fontSize: 13, fontFamily: "'DM Sans', sans-serif", color: S.forest, outline: 'none' }}
                          />
                          <button
                            onClick={() => addMeal(r.id)}
                            disabled={!(newMeal[r.id] || '').trim() || savingMeals === r.id}
                            style={{ padding: '10px 16px', borderRadius: 9, border: 'none', background: !(newMeal[r.id] || '').trim() ? S.border : S.sage, color: S.white, fontSize: 13, fontWeight: 600, cursor: !(newMeal[r.id] || '').trim() ? 'default' : 'pointer', fontFamily: "'DM Sans', sans-serif", flexShrink: 0 }}>
                            {savingMeals === r.id ? '…' : '+ Add'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Add from Google Places */}
        <div style={{ background: S.white, border: `1.5px solid ${S.border}`, borderRadius: 16, padding: '20px' }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: S.forest, margin: '0 0 4px' }}>
            {restaurants.length === 0 ? 'Add your first favorite restaurants' : '+ Add more restaurants'}
          </p>
          <p style={{ fontSize: 12, color: S.stone, fontWeight: 300, margin: '0 0 14px', lineHeight: 1.6 }}>
            Search any restaurant near your delivery address. Coordinators will see these when sending meals.
          </p>

          {!kitchenLat && (
            <div style={{ background: S.amberLight, borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
              <p style={{ fontSize: 12, color: S.amber, margin: 0 }}>Add your delivery address in Settings to search nearby restaurants.</p>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && searchRestaurants()}
              placeholder="Search — e.g. Chipotle, Thai food, pizza near me"
              disabled={!kitchenLat}
              style={{ flex: 1, padding: '12px 14px', borderRadius: 10, border: `1.5px solid ${S.border}`, fontSize: 14, fontFamily: "'DM Sans', sans-serif", color: S.forest, outline: 'none', background: kitchenLat ? S.white : '#F5F5F5' }}
            />
            <button onClick={searchRestaurants} disabled={!kitchenLat || searching || !searchQuery.trim()}
              style={{ padding: '12px 18px', borderRadius: 10, border: 'none', background: !searchQuery.trim() || !kitchenLat ? S.border : S.sage, color: S.white, fontSize: 13, fontWeight: 600, cursor: !searchQuery.trim() ? 'default' : 'pointer', fontFamily: "'DM Sans', sans-serif", flexShrink: 0 }}>
              {searching ? '…' : 'Search'}
            </button>
          </div>

          {searchResults.length > 0 && (
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, color: S.stone, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 10px' }}>Results — 15 miles away</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {searchResults.map(place => {
                  const saved    = alreadySaved(place)
                  const isAdding = adding === place.place_id
                  return (
                    <div key={place.place_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, border: `1px solid ${saved ? S.sageLight : S.border}`, background: saved ? S.sageLight : S.white }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: S.forest }}>{place.name}</div>
                        <div style={{ fontSize: 12, color: S.stone, fontWeight: 300, marginTop: 2 }}>
                          {place.address}
                          {place.rating && <span style={{ color: S.amber, marginLeft: 8 }}>★ {place.rating}</span>}
                          {place.is_open === true  && <span style={{ color: S.sage, marginLeft: 8, fontWeight: 500 }}>Open</span>}
                          {place.is_open === false && <span style={{ color: S.red,  marginLeft: 8 }}>Closed</span>}
                        </div>
                      </div>
                      {saved ? (
                        <span style={{ fontSize: 11, fontWeight: 700, color: S.sage, background: S.sageLight, padding: '4px 12px', borderRadius: 20 }}>✓ Saved</span>
                      ) : (
                        <button onClick={() => !atLimit && !isAdding && addFavorite(place)} disabled={atLimit || isAdding}
                          style={{ padding: '8px 16px', borderRadius: 20, border: 'none', background: atLimit ? S.border : S.sage, color: S.white, fontSize: 12, fontWeight: 600, cursor: atLimit ? 'default' : 'pointer', fontFamily: "'DM Sans', sans-serif", flexShrink: 0 }}>
                          {isAdding ? '…' : atLimit ? 'Limit' : '+ Add'}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

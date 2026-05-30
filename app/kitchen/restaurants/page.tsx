'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const S = {
  sage: '#3D6B4F', sageMid: '#6B9E7E', sageLight: '#EAF2ED',
  cream: '#FAFAF5', forest: '#1E2620', stone: '#6B7066',
  border: '#DDE8E0', white: '#FFFFFF', amber: '#C17F47',
  amberLight: '#FBF0E4', red: '#B94040',
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
}
type PlaceResult = {
  place_id: string; name: string; address: string
  rating: number | null; is_open: boolean | null
}

export default function KitchenRestaurantsPage() {
  const router   = useRouter()
  const supabase = createClient()

  const [loading,     setLoading]     = useState(true)
  const [kitchenId,   setKitchenId]   = useState('')
  const [kitchenSlug, setKitchenSlug] = useState('')
  const [kitchenLat,  setKitchenLat]  = useState<number | null>(null)
  const [kitchenLng,  setKitchenLng]  = useState<number | null>(null)
  const [userName,    setUserName]    = useState('')
  const [userTier,    setUserTier]    = useState('free')
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [saveMsg,     setSaveMsg]     = useState('')

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
        .from('profiles').select('full_name, tier').eq('id', user.id).single()

      setUserName(profile?.full_name || '')
      setUserTier(profile?.tier || 'free')

      const { data: kitchen } = await supabase
        .from('kitchens')
        .select('id, slug, latitude, longitude')
        .eq('organizer_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)

      if (!kitchen || kitchen.length === 0) { router.push('/kitchen/setup'); return }
      const k = kitchen[0]
      setKitchenId(k.id)
      setKitchenSlug(k.slug)
      setKitchenLat(k.latitude || null)
      setKitchenLng(k.longitude || null)

      const { data: rests } = await supabase
        .from('kitchen_restaurants')
        .select('id, name, cuisine, is_active, doordash_store_id, place_id, address')
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
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        kitchen_id: kitchenId,
        place_id:   place.place_id,
        name:       place.name,
        address:    place.address,
        cuisine:    'Restaurant',
      }),
    })
    const data = await res.json()
    if (data.success) {
      // Refresh restaurants list
      const { data: rests } = await supabase
        .from('kitchen_restaurants')
        .select('id, name, cuisine, is_active, doordash_store_id, place_id, address')
        .eq('kitchen_id', kitchenId)
        .order('created_at', { ascending: true })
      setRestaurants(rests || [])
      setSaveMsg(`${place.name} added to your favorites!`)
      setTimeout(() => setSaveMsg(''), 3000)
      // Remove from search results
      setSearchResults(prev => prev.filter(r => r.place_id !== place.place_id))
    }
    setAdding(null)
  }

  const toggleActive = async (id: string, currentActive: boolean) => {
    if (!currentActive && atLimit) return
    const newActive = !currentActive
    setRestaurants(prev => prev.map(r => r.id === id ? { ...r, is_active: newActive } : r))
    const { error } = await supabase
      .from('kitchen_restaurants')
      .update({ is_active: newActive })
      .eq('id', id)
    if (error) {
      setRestaurants(prev => prev.map(r => r.id === id ? { ...r, is_active: currentActive } : r))
    } else {
      setSaveMsg(newActive ? 'Restaurant shown to coordinators' : 'Restaurant hidden from coordinators')
      setTimeout(() => setSaveMsg(''), 2500)
    }
  }

  const alreadySaved = (placeId: string) =>
    restaurants.some(r => r.place_id === placeId || r.name === searchResults.find(s => s.place_id === placeId)?.name)

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
        <p style={{ fontSize: 14, color: S.stone, margin: '0 0 20px', fontWeight: 300 }}>
          Coordinators order from your active favorites. Add any restaurant near you.
        </p>

        {/* Tier limit */}
        <div style={{ background: S.white, border: `1.5px solid ${atLimit ? S.amber : S.border}`, borderRadius: 14, padding: '14px 16px', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: atLimit ? 12 : 0 }}>
            <div>
              <span style={{ fontSize: 13, fontWeight: 600, color: S.forest }}>
                {activeCount} / {limit === 999 ? '∞' : limit} restaurants active
              </span>
              <span style={{ fontSize: 12, color: S.stone, fontWeight: 300, marginLeft: 8 }}>
                · {TIER_LABELS[userTier]}
              </span>
            </div>
            <div style={{ width: 80, height: 6, background: S.sageLight, borderRadius: 3, overflow: 'hidden', marginLeft: 12, flexShrink: 0 }}>
              <div style={{ height: '100%', background: atLimit ? S.amber : S.sage, borderRadius: 3, width: limit === 999 ? '20%' : `${Math.min((activeCount / limit) * 100, 100)}%`, transition: 'width 0.3s' }} />
            </div>
          </div>
          {atLimit && userTier !== 'founding' && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ fontSize: 12, color: S.amber, margin: 0, fontWeight: 500 }}>
                Limit reached — upgrade to add more.
              </p>
              <button onClick={() => router.push('/settings')}
                style={{ background: S.amber, color: S.white, border: 'none', borderRadius: 20, padding: '5px 14px', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", whiteSpace: 'nowrap', marginLeft: 12 }}>
                Upgrade →
              </button>
            </div>
          )}
        </div>

        {/* Current favorites */}
        {restaurants.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: S.stone, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 12px' }}>Your favorites</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {restaurants.map(r => {
                const canActivate = r.is_active || !atLimit
                return (
                  <div key={r.id} style={{ background: S.white, border: `1.5px solid ${r.is_active ? S.sage : S.border}`, borderRadius: 14, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14, opacity: !r.is_active && atLimit ? 0.5 : 1, transition: 'all 0.15s' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: "'Lora', serif", fontSize: 15, fontWeight: 600, color: S.forest }}>{r.name}</div>
                      <div style={{ fontSize: 12, color: S.stone, fontWeight: 300, marginTop: 2 }}>
                        {r.address || r.cuisine}
                        {r.is_active && <span style={{ color: S.sageMid, marginLeft: 6 }}>· shown to coordinators ✓</span>}
                      </div>
                    </div>
                    {!r.is_active && atLimit && (
                      <span style={{ fontSize: 11, color: S.amber, fontWeight: 500 }}>Limit reached</span>
                    )}
                    <button onClick={() => canActivate && toggleActive(r.id, r.is_active)} disabled={!canActivate}
                      style={{ width: 48, height: 26, borderRadius: 13, border: 'none', background: r.is_active ? S.sage : S.border, cursor: canActivate ? 'pointer' : 'not-allowed', position: 'relative', flexShrink: 0, transition: 'background 0.2s' }}>
                      <div style={{ width: 20, height: 20, borderRadius: '50%', background: S.white, position: 'absolute', top: 3, left: r.is_active ? 25 : 3, transition: 'left 0.2s' }} />
                    </button>
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
              placeholder="Search — e.g. Chipotle, Thai food, pizza"
              disabled={!kitchenLat}
              style={{ flex: 1, padding: '12px 14px', borderRadius: 10, border: `1.5px solid ${S.border}`, fontSize: 14, fontFamily: "'DM Sans', sans-serif", color: S.forest, outline: 'none', background: kitchenLat ? S.white : '#F5F5F5' }}
            />
            <button onClick={searchRestaurants} disabled={!kitchenLat || searching || !searchQuery.trim()}
              style={{ padding: '12px 18px', borderRadius: 10, border: 'none', background: searching || !searchQuery.trim() || !kitchenLat ? S.border : S.sage, color: S.white, fontSize: 13, fontWeight: 600, cursor: searching || !searchQuery.trim() ? 'default' : 'pointer', fontFamily: "'DM Sans', sans-serif", flexShrink: 0 }}>
              {searching ? '…' : 'Search'}
            </button>
          </div>

          {searchResults.length > 0 && (
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, color: S.stone, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 10px' }}>Search results</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {searchResults.map(place => {
                  const saved     = alreadySaved(place.place_id)
                  const isAdding  = adding === place.place_id
                  const cantAdd   = atLimit || saved
                  return (
                    <div key={place.place_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, border: `1px solid ${saved ? S.sageLight : S.border}`, background: saved ? S.sageLight : S.white }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: S.forest }}>{place.name}</div>
                        <div style={{ fontSize: 12, color: S.stone, fontWeight: 300, marginTop: 2 }}>
                          {place.address}
                          {place.rating && <span style={{ color: S.amber, marginLeft: 8 }}>★ {place.rating}</span>}
                          {place.is_open === true  && <span style={{ color: S.sage,   marginLeft: 8, fontWeight: 500 }}>Open</span>}
                          {place.is_open === false && <span style={{ color: S.red,    marginLeft: 8 }}>Closed</span>}
                        </div>
                      </div>
                      {saved ? (
                        <span style={{ fontSize: 11, fontWeight: 700, color: S.sage, background: S.sageLight, padding: '4px 12px', borderRadius: 20 }}>⭐ Saved</span>
                      ) : (
                        <button onClick={() => !cantAdd && addFavorite(place)} disabled={cantAdd || isAdding}
                          style={{ padding: '8px 16px', borderRadius: 20, border: 'none', background: cantAdd ? S.border : S.sage, color: cantAdd ? S.stone : S.white, fontSize: 12, fontWeight: 600, cursor: cantAdd ? 'default' : 'pointer', fontFamily: "'DM Sans', sans-serif", flexShrink: 0 }}>
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

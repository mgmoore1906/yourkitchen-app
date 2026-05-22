'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const S = {
  sage: '#3D6B4F', sageMid: '#6B9E7E', sageLight: '#EAF2ED',
  cream: '#FAFAF5', forest: '#1E2620', stone: '#6B7066',
  border: '#DDE8E0', white: '#FFFFFF', red: '#B94040',
}

type MenuItem = { id: string; name: string; description: string; price: number; is_favorite: boolean }
type Restaurant = { id: string; name: string; cuisine: string; is_active: boolean; doordash_store_id: string; menu_items: MenuItem[] }

export default function RestaurantsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [kitchenId, setKitchenId] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [toggling, setToggling] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: kitchen } = await supabase
        .from('kitchens').select('id').eq('organizer_id', user.id).single()
      if (!kitchen) { router.push('/dashboard'); return }

      setKitchenId(kitchen.id)

      const { data: rests } = await supabase
        .from('kitchen_restaurants')
        .select('id, name, cuisine, is_active, doordash_store_id, menu_items(id, name, description, price, is_favorite)')
        .eq('kitchen_id', kitchen.id)
        .order('name')

      setRestaurants(rests || [])
      setLoading(false)
    }
    load()
  }, [])

  const toggleActive = async (restId: string, current: boolean) => {
    setToggling(restId)
    await fetch('/api/restaurants', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restaurant_id: restId, is_active: !current }),
    })
    setRestaurants(prev => prev.map(r => r.id === restId ? { ...r, is_active: !current } : r))
    setToggling(null)
  }

  const active = restaurants.filter(r => r.is_active)
  const inactive = restaurants.filter(r => !r.is_active)

  if (loading) return (
    <div style={{ minHeight: '100vh', background: S.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans', sans-serif" }}>
      <p style={{ color: S.stone, fontSize: 14 }}>Loading restaurants…</p>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: S.cream, fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />

      <nav style={{ background: S.white, borderBottom: `0.5px solid ${S.border}`, padding: '14px 28px', display: 'flex', alignItems: 'center', gap: 14, position: 'sticky', top: 0, zIndex: 100 }}>
        <button onClick={() => router.push('/dashboard')} style={{ background: 'none', border: `1.5px solid ${S.border}`, borderRadius: 9, width: 34, height: 34, cursor: 'pointer', fontSize: 16, color: S.stone, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
        <div>
          <div style={{ fontSize: 8, fontWeight: 500, letterSpacing: 5, color: S.sageMid, textTransform: 'uppercase' }}>Your</div>
          <div style={{ fontFamily: "'Lora', serif", fontSize: 20, fontWeight: 500, color: S.forest, letterSpacing: -0.5 }}>Kitchen</div>
        </div>
      </nav>

      <div style={{ maxWidth: 580, margin: '0 auto', padding: '32px 24px 80px' }}>
        <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: S.sage, margin: '0 0 6px' }}>My Kitchen</p>
        <h1 style={{ fontFamily: "'Lora', serif", fontSize: 26, fontWeight: 500, color: S.forest, margin: '0 0 4px', letterSpacing: -0.5 }}>My Restaurants</h1>
        <p style={{ fontSize: 14, color: S.stone, fontWeight: 300, margin: '0 0 28px' }}>Your coordinators order from these. Toggle any off to hide it from your village.</p>

        {/* Active */}
        <p style={{ fontSize: 11, fontWeight: 700, color: S.stone, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 10px' }}>Active ({active.length})</p>
        {active.map(r => (
          <RestaurantCard key={r.id} r={r} expanded={expanded} setExpanded={setExpanded} toggling={toggling} toggleActive={toggleActive} />
        ))}

        {/* Inactive */}
        {inactive.length > 0 && (
          <>
            <p style={{ fontSize: 11, fontWeight: 700, color: S.stone, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '20px 0 10px' }}>Hidden ({inactive.length})</p>
            {inactive.map(r => (
              <RestaurantCard key={r.id} r={r} expanded={expanded} setExpanded={setExpanded} toggling={toggling} toggleActive={toggleActive} />
            ))}
          </>
        )}

        <div style={{ background: S.sageLight, borderRadius: 12, padding: '14px 18px', marginTop: 24 }}>
          <p style={{ fontSize: 13, color: S.sage, margin: 0, lineHeight: 1.6 }}>
            🍽 Want to add a new restaurant? Email <strong>marques@yourkitchen.app</strong> with the restaurant name and your city — we'll add it within 24 hours.
          </p>
        </div>
      </div>
    </div>
  )
}

function RestaurantCard({ r, expanded, setExpanded, toggling, toggleActive }: any) {
  const S = { sage: '#3D6B4F', sageLight: '#EAF2ED', forest: '#1E2620', stone: '#6B7066', border: '#DDE8E0', white: '#FFFFFF' }
  const isExpanded = expanded === r.id
  return (
    <div style={{ background: S.white, border: `0.5px solid ${r.is_active ? S.border : '#EEE'}`, borderRadius: 14, marginBottom: 10, overflow: 'hidden', opacity: r.is_active ? 1 : 0.6 }}>
      <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Lora', serif", fontSize: 15, fontWeight: 600, color: S.forest }}>{r.name}</div>
          <div style={{ fontSize: 12, color: S.stone, fontWeight: 300, marginTop: 2 }}>{r.cuisine} · {r.menu_items?.length || 0} menu items</div>
        </div>
        <button
          onClick={() => setExpanded(isExpanded ? null : r.id)}
          style={{ background: S.sageLight, border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 11, fontWeight: 600, color: S.sage, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}
        >
          {isExpanded ? 'Hide' : 'Menu'}
        </button>
        <button
          onClick={() => toggleActive(r.id, r.is_active)}
          disabled={toggling === r.id}
          style={{
            width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
            background: r.is_active ? S.sage : '#DDE8E0', position: 'relative', transition: 'background 0.2s',
          }}
        >
          <div style={{
            width: 18, height: 18, borderRadius: '50%', background: '#fff',
            position: 'absolute', top: 3, left: r.is_active ? 23 : 3, transition: 'left 0.2s',
          }} />
        </button>
      </div>
      {isExpanded && (
        <div style={{ borderTop: `0.5px solid ${S.border}`, padding: '12px 16px' }}>
          {(r.menu_items || []).map((item: any) => (
            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '8px 0', borderBottom: `0.5px solid #EAF2ED` }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: S.forest }}>{item.is_favorite ? '⭐ ' : ''}{item.name}</div>
                <div style={{ fontSize: 11, color: S.stone, fontWeight: 300, marginTop: 2, lineHeight: 1.4 }}>{item.description}</div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: S.sage, flexShrink: 0, marginLeft: 12 }}>${item.price}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

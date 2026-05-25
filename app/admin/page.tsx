'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// ── Only this email can access /admin ──────────────────────────────────────
const ADMIN_EMAIL = 'marques@yourkitchen.app'

const S = {
  sage: '#3D6B4F', sageMid: '#6B9E7E', sageLight: '#EAF2ED',
  cream: '#FAFAF5', forest: '#1E2620', stone: '#6B7066',
  border: '#DDE8E0', white: '#FFFFFF', red: '#B94040',
  amber: '#C17F47', amberLight: '#FFF8E8',
}

type Restaurant = {
  id: string
  name: string
  cuisine: string
  is_active: boolean
  doordash_store_id: string | null
  menu_items: MenuItem[]
}
type MenuItem = {
  id: string
  name: string
  description: string
  price: number
  is_favorite: boolean
}
type Kitchen = {
  id: string
  name: string
  slug: string
}

export default function AdminPage() {
  const router = useRouter()
  const supabase = createClient()

  const [checking, setChecking]     = useState(true)
  const [authorized, setAuthorized] = useState(false)

  // Kitchen lookup
  const [slugInput, setSlugInput]   = useState('')
  const [kitchen, setKitchen]       = useState<Kitchen | null>(null)
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [lookupError, setLookupError] = useState('')
  const [looking, setLooking]       = useState(false)

  // Add restaurant form
  const [showRestForm, setShowRestForm] = useState(false)
  const [restForm, setRestForm]     = useState({
    name: '', cuisine: '', address: '', phone: '', doordash_store_id: '',
  })
  const [savingRest, setSavingRest] = useState(false)
  const [restError, setRestError]   = useState('')

  // Add menu item form
  const [activeRestId, setActiveRestId] = useState<string | null>(null)
  const [itemForm, setItemForm]     = useState({
    name: '', description: '', price: '', is_favorite: false,
  })
  const [savingItem, setSavingItem] = useState(false)
  const [itemError, setItemError]   = useState('')
  const [expandedRest, setExpandedRest] = useState<string | null>(null)

  // ── Auth gate ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || user.email !== ADMIN_EMAIL) {
        router.push('/dashboard')
        return
      }
      setAuthorized(true)
      setChecking(false)
    }
    check()
  }, [])

  // ── Lookup kitchen by slug ─────────────────────────────────────────────────
  const lookupKitchen = async () => {
    if (!slugInput.trim()) return
    setLooking(true); setLookupError(''); setKitchen(null); setRestaurants([])
    const { data: k } = await supabase
      .from('kitchens')
      .select('id, name, slug')
      .eq('slug', slugInput.trim().toLowerCase())
      .single()
    if (!k) { setLookupError('Kitchen not found. Check the slug and try again.'); setLooking(false); return }
    setKitchen(k)
    await loadRestaurants(k.id)
    setLooking(false)
  }

  const loadRestaurants = async (kitchenId: string) => {
    const { data } = await supabase
      .from('kitchen_restaurants')
      .select('id, name, cuisine, is_active, doordash_store_id, menu_items(id, name, description, price, is_favorite)')
      .eq('kitchen_id', kitchenId)
      .order('name')
    setRestaurants((data || []) as Restaurant[])
  }

  // ── Add restaurant ─────────────────────────────────────────────────────────
  const addRestaurant = async () => {
    if (!kitchen || !restForm.name.trim() || !restForm.cuisine.trim()) return
    setSavingRest(true); setRestError('')
    const { error } = await supabase.from('kitchen_restaurants').insert({
      kitchen_id: kitchen.id,
      name: restForm.name.trim(),
      cuisine: restForm.cuisine.trim(),
      address: restForm.address.trim() || null,
      phone: restForm.phone.trim() || null,
      doordash_store_id: restForm.doordash_store_id.trim() || null,
      is_active: true,
    })
    if (error) { setRestError(error.message); setSavingRest(false); return }
    await loadRestaurants(kitchen.id)
    setRestForm({ name: '', cuisine: '', address: '', phone: '', doordash_store_id: '' })
    setShowRestForm(false)
    setSavingRest(false)
  }

  // ── Add menu item ──────────────────────────────────────────────────────────
  const addMenuItem = async (restId: string) => {
    if (!itemForm.name.trim() || !itemForm.price) return
    setSavingItem(true); setItemError('')
    const { error } = await supabase.from('menu_items').insert({
      kitchen_restaurant_id: restId,
      name: itemForm.name.trim(),
      description: itemForm.description.trim() || null,
      price: parseFloat(itemForm.price),
      is_favorite: itemForm.is_favorite,
    })
    if (error) { setItemError(error.message); setSavingItem(false); return }
    await loadRestaurants(kitchen!.id)
    setItemForm({ name: '', description: '', price: '', is_favorite: false })
    setActiveRestId(null)
    setSavingItem(false)
  }

  // ── Toggle restaurant active ───────────────────────────────────────────────
  const toggleActive = async (restId: string, current: boolean) => {
    await supabase.from('kitchen_restaurants').update({ is_active: !current }).eq('id', restId)
    setRestaurants(prev => prev.map(r => r.id === restId ? { ...r, is_active: !current } : r))
  }

  // ── Delete menu item ───────────────────────────────────────────────────────
  const deleteItem = async (itemId: string) => {
    await supabase.from('menu_items').delete().eq('id', itemId)
    if (kitchen) await loadRestaurants(kitchen.id)
  }

  // ── Loading / unauthorized ─────────────────────────────────────────────────
  if (checking) return (
    <div style={{ minHeight: '100vh', background: S.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans', sans-serif" }}>
      <p style={{ color: S.stone }}>Checking access…</p>
    </div>
  )

  if (!authorized) return null

  return (
    <div style={{ minHeight: '100vh', background: S.cream, fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />

      {/* Nav */}
      <nav style={{ background: S.forest, padding: '14px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 8, fontWeight: 500, letterSpacing: 5, color: S.sageMid, textTransform: 'uppercase' }}>Your</div>
          <div style={{ fontFamily: "'Lora', serif", fontSize: 20, fontWeight: 500, color: S.white }}>Kitchen</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ background: S.amber, color: S.white, fontSize: 10, fontWeight: 700, padding: '4px 12px', borderRadius: 20, letterSpacing: '0.06em' }}>ADMIN</span>
          <button onClick={() => router.push('/dashboard')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 13, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
            ← Dashboard
          </button>
        </div>
      </nav>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px 80px' }}>
        <h1 style={{ fontFamily: "'Lora', serif", fontSize: 26, fontWeight: 500, color: S.forest, margin: '0 0 6px', letterSpacing: -0.5 }}>
          Restaurant Admin
        </h1>
        <p style={{ fontSize: 14, color: S.stone, fontWeight: 300, margin: '0 0 28px' }}>
          Look up any Kitchen by slug, add restaurants, and seed menu items.
        </p>

        {/* Kitchen lookup */}
        <div style={{ background: S.white, border: `0.5px solid ${S.border}`, borderRadius: 14, padding: '20px', marginBottom: 24 }}>
          <p style={label}>Kitchen slug</p>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              value={slugInput}
              onChange={e => setSlugInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && lookupKitchen()}
              placeholder="danielle-moore"
              style={inputSt}
            />
            <button onClick={lookupKitchen} disabled={looking} style={btnPrimary(looking || !slugInput.trim())}>
              {looking ? 'Looking…' : 'Look up'}
            </button>
          </div>
          {lookupError && <p style={{ color: S.red, fontSize: 12, margin: '8px 0 0' }}>{lookupError}</p>}

          {kitchen && (
            <div style={{ marginTop: 14, padding: '12px 14px', background: S.sageLight, borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontFamily: "'Lora', serif", fontSize: 15, fontWeight: 500, color: S.forest }}>{kitchen.name}</div>
                <div style={{ fontSize: 12, color: S.stone, fontWeight: 300 }}>slug: {kitchen.slug} · {restaurants.length} restaurant{restaurants.length !== 1 ? 's' : ''}</div>
              </div>
              <span style={{ fontSize: 18 }}>✓</span>
            </div>
          )}
        </div>

        {kitchen && (<>

          {/* Restaurant list */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <p style={{ fontFamily: "'Lora', serif", fontSize: 18, fontWeight: 500, color: S.forest, margin: 0 }}>
              Restaurants
            </p>
            <button onClick={() => setShowRestForm(f => !f)} style={{
              background: showRestForm ? S.border : S.forest, color: showRestForm ? S.stone : S.white,
              border: 'none', borderRadius: 9, padding: '8px 16px', fontSize: 12, fontWeight: 600,
              cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
            }}>
              {showRestForm ? 'Cancel' : '+ Add Restaurant'}
            </button>
          </div>

          {/* Add restaurant form */}
          {showRestForm && (
            <div style={{ background: S.white, border: `2px solid ${S.sage}`, borderRadius: 14, padding: '20px', marginBottom: 16 }}>
              <p style={{ fontFamily: "'Lora', serif", fontSize: 15, fontWeight: 500, color: S.forest, margin: '0 0 16px' }}>New restaurant</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <p style={label}>Name *</p>
                  <input value={restForm.name} onChange={e => setRestForm(f => ({ ...f, name: e.target.value }))} placeholder="Peli Peli Kitchen" style={inputSt} />
                </div>
                <div>
                  <p style={label}>Cuisine *</p>
                  <input value={restForm.cuisine} onChange={e => setRestForm(f => ({ ...f, cuisine: e.target.value }))} placeholder="South African" style={inputSt} />
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <p style={label}>Full address (for DoorDash pickup)</p>
                <input value={restForm.address} onChange={e => setRestForm(f => ({ ...f, address: e.target.value }))} placeholder="1001 McKinney St, Houston, TX 77002" style={inputSt} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <p style={label}>Phone (optional)</p>
                  <input value={restForm.phone} onChange={e => setRestForm(f => ({ ...f, phone: e.target.value }))} placeholder="(713) 555-0100" style={inputSt} />
                </div>
                <div>
                  <p style={label}>DoorDash Store ID (optional)</p>
                  <input value={restForm.doordash_store_id} onChange={e => setRestForm(f => ({ ...f, doordash_store_id: e.target.value }))} placeholder="927672" style={inputSt} />
                </div>
              </div>
              {restError && <p style={{ color: S.red, fontSize: 12, margin: '0 0 12px' }}>{restError}</p>}
              <button onClick={addRestaurant} disabled={savingRest || !restForm.name || !restForm.cuisine} style={btnPrimary(savingRest || !restForm.name || !restForm.cuisine)}>
                {savingRest ? 'Adding…' : 'Add Restaurant'}
              </button>
            </div>
          )}

          {/* Restaurant cards */}
          {restaurants.length === 0 ? (
            <div style={{ background: S.white, border: `0.5px dashed ${S.border}`, borderRadius: 14, padding: '28px', textAlign: 'center' }}>
              <p style={{ fontSize: 14, color: S.stone, fontWeight: 300, margin: 0 }}>No restaurants yet. Add the first one above.</p>
            </div>
          ) : restaurants.map(r => (
            <div key={r.id} style={{ background: S.white, border: `0.5px solid ${r.is_active ? S.border : '#EEE'}`, borderRadius: 14, marginBottom: 12, overflow: 'hidden', opacity: r.is_active ? 1 : 0.7 }}>

              {/* Restaurant header */}
              <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "'Lora', serif", fontSize: 15, fontWeight: 600, color: S.forest }}>{r.name}</div>
                  <div style={{ fontSize: 12, color: S.stone, fontWeight: 300, marginTop: 2 }}>
                    {r.cuisine}
                    {r.doordash_store_id && <span style={{ marginLeft: 8, color: S.sageMid }}>· DoorDash ID: {r.doordash_store_id}</span>}
                    <span style={{ marginLeft: 8 }}>· {r.menu_items?.length || 0} items</span>
                  </div>
                </div>
                <button onClick={() => setExpandedRest(expandedRest === r.id ? null : r.id)}
                  style={{ background: S.sageLight, border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 11, fontWeight: 600, color: S.sage, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                  {expandedRest === r.id ? 'Collapse' : 'Expand'}
                </button>
                <button onClick={() => { setActiveRestId(activeRestId === r.id ? null : r.id); setExpandedRest(r.id) }}
                  style={{ background: S.forest, border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 11, fontWeight: 600, color: S.white, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                  + Item
                </button>
                {/* Toggle switch */}
                <button onClick={() => toggleActive(r.id, r.is_active)}
                  style={{ width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', background: r.is_active ? S.sage : '#DDE8E0', position: 'relative', flexShrink: 0 }}>
                  <div style={{ width: 18, height: 18, borderRadius: '50%', background: S.white, position: 'absolute', top: 3, left: r.is_active ? 23 : 3, transition: 'left 0.2s' }} />
                </button>
              </div>

              {/* Add menu item form */}
              {activeRestId === r.id && (
                <div style={{ borderTop: `0.5px solid ${S.border}`, padding: '14px 16px', background: '#FAFFF8' }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: S.sage, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 12px' }}>Add menu item</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10, marginBottom: 10 }}>
                    <div>
                      <p style={label}>Item name *</p>
                      <input value={itemForm.name} onChange={e => setItemForm(f => ({ ...f, name: e.target.value }))} placeholder="Peri-Peri Chicken Plate" style={inputSt} />
                    </div>
                    <div>
                      <p style={label}>Price *</p>
                      <input type="number" value={itemForm.price} onChange={e => setItemForm(f => ({ ...f, price: e.target.value }))} placeholder="18.00" style={inputSt} />
                    </div>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <p style={label}>Description</p>
                    <input value={itemForm.description} onChange={e => setItemForm(f => ({ ...f, description: e.target.value }))} placeholder="Half rotisserie chicken, rice pilaf, peri-peri sauce" style={inputSt} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                    <input type="checkbox" id={`fav-${r.id}`} checked={itemForm.is_favorite} onChange={e => setItemForm(f => ({ ...f, is_favorite: e.target.checked }))} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                    <label htmlFor={`fav-${r.id}`} style={{ fontSize: 13, color: S.forest, cursor: 'pointer' }}>⭐ Mark as recipient favorite (shown first to coordinators)</label>
                  </div>
                  {itemError && <p style={{ color: S.red, fontSize: 12, margin: '0 0 10px' }}>{itemError}</p>}
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={() => setActiveRestId(null)} style={{ padding: '10px 16px', background: 'transparent', color: S.stone, border: `1.5px solid ${S.border}`, borderRadius: 9, fontSize: 12, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>Cancel</button>
                    <button onClick={() => addMenuItem(r.id)} disabled={savingItem || !itemForm.name || !itemForm.price}
                      style={btnPrimary(savingItem || !itemForm.name || !itemForm.price)}>
                      {savingItem ? 'Adding…' : 'Add Item'}
                    </button>
                  </div>
                </div>
              )}

              {/* Menu items list */}
              {expandedRest === r.id && (r.menu_items?.length > 0) && (
                <div style={{ borderTop: `0.5px solid ${S.border}`, padding: '12px 16px' }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: S.stone, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 10px' }}>
                    Menu ({r.menu_items.length} items)
                  </p>
                  {r.menu_items.map(item => (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0', borderBottom: `0.5px solid #EAF2ED` }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: S.forest }}>{item.is_favorite ? '⭐ ' : ''}{item.name}</div>
                        <div style={{ fontSize: 11, color: S.stone, fontWeight: 300, marginTop: 2, lineHeight: 1.4 }}>{item.description}</div>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: S.sage, flexShrink: 0 }}>${item.price}</div>
                      <button onClick={() => deleteItem(item.id)}
                        style={{ background: 'none', border: `1px solid #EEE`, borderRadius: 6, padding: '3px 8px', fontSize: 11, color: S.stone, cursor: 'pointer', flexShrink: 0 }}>
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

        </>)}
      </div>
    </div>
  )
}

const label: React.CSSProperties = { fontSize: 10, fontWeight: 600, color: '#6B7066', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 6px' }
const inputSt: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 9, border: '1.5px solid #DDE8E0', fontSize: 14, fontFamily: "'DM Sans', sans-serif", color: '#1E2620', background: '#fff', outline: 'none', boxSizing: 'border-box' }
const btnPrimary = (disabled: boolean): React.CSSProperties => ({
  padding: '11px 20px', background: disabled ? '#DDE8E0' : '#1E2620', color: disabled ? '#6B7066' : '#fff',
  border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 600,
  cursor: disabled ? 'default' : 'pointer', fontFamily: "'DM Sans', sans-serif", whiteSpace: 'nowrap' as const,
})

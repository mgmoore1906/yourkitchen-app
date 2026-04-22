'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const MENU_ITEMS: Record<string, { id: string; name: string; desc: string; price: number }[]> = {
  '1': [
    { id: '101', name: 'Peri-Peri Chicken Plate', desc: 'Half rotisserie chicken, rice pilaf, peri-peri sauce', price: 18 },
    { id: '102', name: 'Cape Malay Curry', desc: 'Slow-cooked lamb, fragrant rice, sambals', price: 22 },
    { id: '103', name: 'Braai Burger & Fries', desc: 'Grass-fed beef, chimichurri, hand-cut fries', price: 16 },
  ],
  '2': [
    { id: '201', name: 'Fajita Family Pack', desc: 'Beef & chicken, 12 tortillas, all fixings', price: 42 },
    { id: '202', name: 'Enchilada Plate', desc: 'Cheese & chicken enchiladas, rice & beans', price: 16 },
    { id: '203', name: 'Street Tacos & Queso', desc: '3 street tacos, chorizo queso, fresh guac', price: 19 },
  ],
  '3': [
    { id: '301', name: 'Chicken Shawarma Plate', desc: 'Marinated chicken, hummus, tabbouleh, pita', price: 17 },
    { id: '302', name: 'Lamb Kofta', desc: 'Spiced lamb skewers, tzatziki, roasted veg', price: 21 },
    { id: '303', name: 'Falafel Bowl', desc: 'Crispy falafel, couscous, pickled veg, tahini', price: 14 },
  ],
  '4': [
    { id: '401', name: 'Family Nugget Tray', desc: '64-count nuggets, 4 sauces, waffle fries', price: 34 },
    { id: '402', name: 'Classic Sandwich Meal', desc: 'Classic sandwich, fries, lemonade', price: 12 },
    { id: '403', name: 'Grilled Market Salad', desc: 'Grilled chicken, blueberries, harvest dressing', price: 11 },
  ],
  '5': [
    { id: '501', name: 'Tour of Italy', desc: 'Chicken parmigiana, lasagna, fettuccine alfredo', price: 22 },
    { id: '502', name: 'Five Cheese Ziti', desc: 'Ziti, five cheese marinara, mozzarella', price: 16 },
    { id: '503', name: 'Chicken Alfredo', desc: 'Grilled chicken, fettuccine, creamy alfredo', price: 18 },
  ],
}

export default function OnboardingFavorites() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [restaurants, setRestaurants] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState(0)
  const [favorites, setFavorites] = useState<string[]>([])

  useEffect(() => {
    const data = JSON.parse(localStorage.getItem('yk_onboarding') || '{}')
    if (data.restaurants) setRestaurants(data.restaurants)
  }, [])

  const toggleFav = (id: string) => {
    setFavorites(f =>
      f.includes(id) ? f.filter(x => x !== id) : [...f, id]
    )
  }

  const handleFinish = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const onboarding = JSON.parse(localStorage.getItem('yk_onboarding') || '{}')

    // Generate slug from name
    const slug = onboarding.full_name
      ?.toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '') || `kitchen-${Date.now()}`

    // Create kitchen
    const { data: kitchen, error: kitchenError } = await supabase
      .from('kitchens')
      .insert({
        organizer_id: user.id,
        recipient_id: user.id,
        name: `${onboarding.full_name}'s Kitchen`,
        slug,
        address: onboarding.address,
        household_size: parseInt(onboarding.household_size?.split('-')[0] || '3'),
        dietary_restrictions: onboarding.dietary_restrictions || [],
        status: 'active',
        tier: 'trial',
        trial_started_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (kitchenError || !kitchen) {
      console.error(kitchenError)
      setLoading(false)
      return
    }

    // Save restaurants
    for (const r of onboarding.restaurants || []) {
      const { data: rest } = await supabase
        .from('kitchen_restaurants')
        .insert({
          kitchen_id: kitchen.id,
          name: r.name,
          cuisine: r.cuisine,
        })
        .select()
        .single()

      if (rest) {
        // Save menu items
        const items = MENU_ITEMS[r.id] || []
        for (const item of items) {
          await supabase.from('menu_items').insert({
            kitchen_restaurant_id: rest.id,
            name: item.name,
            description: item.desc,
            price: item.price,
            is_favorite: favorites.includes(item.id),
          })
        }
      }
    }

    // Save calendar dates
    for (const date of onboarding.calendar_dates || []) {
      await supabase.from('calendar_dates').insert({
        kitchen_id: kitchen.id,
        date,
        status: 'available',
        delivery_window_start: onboarding.delivery_window_start || '17:30',
        delivery_window_end: onboarding.delivery_window_end || '19:00',
      })
    }

    localStorage.removeItem('yk_onboarding')
    router.push(`/dashboard?kitchen=${kitchen.id}`)
    setLoading(false)
  }

  const activeRestaurant = restaurants[activeTab]
  const menuItems = activeRestaurant ? MENU_ITEMS[activeRestaurant.id] || [] : []

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF5',
                  fontFamily: "'DM Sans', sans-serif", padding: '0 0 40px' }}>
      <link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #DDE8E0',
                    padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => router.back()}
          style={{ background: '#EAF2ED', border: 'none', borderRadius: 10,
                   width: 36, height: 36, cursor: 'pointer', fontSize: 18,
                   display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3D6B4F' }}>
          ‹
        </button>
        <div>
          <div style={{ fontSize: 9, fontWeight: 500, letterSpacing: 5,
                        color: '#6B9E7E', textTransform: 'uppercase' }}>Your</div>
          <div style={{ fontFamily: "'Lora', serif", fontSize: 20,
                        fontWeight: 500, color: '#1E2620' }}>Kitchen</div>
        </div>
      </div>

      {/* Progress */}
      <div style={{ display: 'flex', gap: 6, padding: '20px 24px 0' }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{ flex: 1, height: 4, borderRadius: 4,
                                background: '#3D6B4F' }} />
        ))}
      </div>

      <div style={{ padding: '24px 24px 0', maxWidth: 500, margin: '0 auto' }}>
        <p style={{ fontSize: 10, fontWeight: 500, letterSpacing: 3,
                    color: '#3D6B4F', textTransform: 'uppercase', margin: '0 0 8px' }}>
          Step 4 of 4
        </p>
        <h1 style={{ fontFamily: "'Lora', serif", fontSize: 26, fontWeight: 500,
                     color: '#1E2620', margin: '0 0 6px', letterSpacing: -0.5 }}>
          What do you love to eat?
        </h1>
        <p style={{ fontSize: 14, color: '#6B7066', margin: '0 0 24px', fontWeight: 300 }}>
          Star your favorites — coordinators will see these when ordering for you.
        </p>

        {/* Restaurant tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20,
                      overflowX: 'auto', paddingBottom: 4 }}>
          {restaurants.map((r, i) => (
            <button key={r.id} onClick={() => setActiveTab(i)}
              style={{ background: activeTab === i ? '#3D6B4F' : '#EAF2ED',
                       color: activeTab === i ? '#fff' : '#3D6B4F',
                       border: 'none', borderRadius: 20, padding: '8px 16px',
                       fontSize: 12, fontWeight: 700, cursor: 'pointer',
                       whiteSpace: 'nowrap', fontFamily: "'DM Sans', sans-serif" }}>
              {r.emoji} {r.name.split(' ')[0]}
            </button>
          ))}
        </div>

        {/* Menu items */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          {menuItems.map(item => (
            <button key={item.id} onClick={() => toggleFav(item.id)}
              style={{ background: favorites.includes(item.id) ? '#EAF2ED' : '#fff',
                       border: `2px solid ${favorites.includes(item.id) ? '#3D6B4F' : '#DDE8E0'}`,
                       borderRadius: 14, padding: '14px 16px', cursor: 'pointer',
                       textAlign: 'left', display: 'flex', gap: 12,
                       alignItems: 'flex-start', transition: 'all 0.15s',
                       fontFamily: "'DM Sans', sans-serif" }}>
              <div style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                            border: `2px solid ${favorites.includes(item.id) ? '#3D6B4F' : '#DDE8E0'}`,
                            background: favorites.includes(item.id) ? '#3D6B4F' : 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#fff', fontSize: 12, marginTop: 2 }}>
                {favorites.includes(item.id) ? '★' : ''}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "'Lora', serif", fontSize: 14,
                              fontWeight: 600, color: '#1E2620' }}>{item.name}</div>
                <div style={{ fontSize: 12, color: '#6B7066', fontWeight: 300,
                              marginTop: 2 }}>{item.desc}</div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600,
                            color: '#3D6B4F', flexShrink: 0 }}>${item.price}</div>
            </button>
          ))}
        </div>

        {favorites.length > 0 && (
          <div style={{ background: '#EAF2ED', borderRadius: 12,
                        padding: '14px 16px', marginBottom: 20 }}>
            <p style={{ fontSize: 13, color: '#3D6B4F', margin: 0 }}>
              ⭐ <strong>{favorites.length} favorites</strong> saved across your restaurants.
            </p>
          </div>
        )}

        <button onClick={handleFinish} disabled={loading}
          style={{ width: '100%', padding: '14px', borderRadius: 10, border: 'none',
                   background: loading ? '#6B9E7E' : '#3D6B4F', color: '#fff',
                   fontSize: 14, fontWeight: 500, cursor: loading ? 'default' : 'pointer',
                   fontFamily: "'DM Sans', sans-serif" }}>
          {loading ? 'Creating your Kitchen…' : 'Finish Setup — Share My Kitchen →'}
        </button>
      </div>
    </div>
  )
}
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const MENU_ITEMS: Record<string, { id: string; name: string; desc: string; price: number }[]> = {
  'first-watch': [
    { id: 'fw-1', name: 'Lemon Ricotta Pancakes', desc: 'Fluffy lemon-ricotta pancakes with seasonal berries and whipped cream.', price: 13.99 },
    { id: 'fw-2', name: 'Avocado Toast', desc: 'Smashed avocado on multigrain toast with lemon, chili flakes, and fresh fruit.', price: 10.99 },
    { id: 'fw-3', name: 'Chickichanga', desc: 'Breakfast burrito with scrambled eggs, chicken, avocado, cheddar, and salsa — pan-fried crispy.', price: 12.49 },
    { id: 'fw-4', name: 'A.M. Superfoods Bowl', desc: 'Tri-colored quinoa, roasted sweet potatoes, avocado, kale, and lemon-tahini dressing.', price: 13.49 },
  ],
  'toasted-yolk': [
    { id: 'ty-1', name: 'Shrimp & Grits', desc: 'Signature cheese grits topped with sautéed garlic shrimp, bacon, cilantro, and diced tomatoes.', price: 15.99 },
    { id: 'ty-2', name: 'Chicken & Waffles', desc: "Crispy tenders on a Belgian waffle with cheddar and jalapeños, drizzled with Mike's Hot Honey.", price: 15.99 },
    { id: 'ty-3', name: 'Banana Foster French Toast', desc: 'Belgian waffle-style French toast with banana custard, caramel sauce, and vanilla wafer crumbles.', price: 16.99 },
    { id: 'ty-4', name: 'Brisket Scramble', desc: 'Scrambled eggs with smoked brisket and cheesy hashbrown casserole.', price: 15.49 },
  ],
  'harvest': [
    { id: 'hk-1', name: 'Hot Chicken Benedict', desc: 'Crispy hot chicken on sourdough English muffins with poached eggs, hollandaise, and Harvest potatoes.', price: 17.99 },
    { id: 'hk-2', name: 'Avocado & Goat Cheese Toast', desc: 'Sourdough toast with smashed avocado, arugula, fried goat cheese medallion, poached egg, and hollandaise.', price: 15.99 },
    { id: 'hk-3', name: 'Huevos Rancheros', desc: 'Crispy corn tostadas with avocado, black beans, over-easy eggs, red and green salsa, queso fresco, and grits.', price: 16.49 },
    { id: 'hk-4', name: 'Chicken Salad Avocado Toast', desc: 'Multigrain toast with chicken salad, fresh blueberries, candied pecans, and balsamic reduction.', price: 15.99 },
  ],
  'cava': [
    { id: 'cv-1', name: 'Harissa Avocado Bowl', desc: 'Harissa honey chicken over basmati rice with Crazy Feta, hummus, avocado, and hot harissa vinaigrette.', price: 13.49 },
    { id: 'cv-2', name: 'Chicken + Rice Bowl', desc: 'Grilled chicken over basmati rice with hummus, cucumber, tomato, feta, and lemon herb tahini.', price: 12.49 },
    { id: 'cv-3', name: 'Spicy Lamb + Avocado Bowl', desc: 'Spiced lamb meatballs over SuperGreens and lentils with creamy avocado, Crazy Feta, and skhug sauce.', price: 13.49 },
    { id: 'cv-4', name: 'Falafel Crunch Bowl', desc: 'Crispy falafel over roasted veggies and lentils with hummus, pickled onions, and lemon herb tahini.', price: 12.49 },
  ],
  'kebab-shop': [
    { id: 'ks-1', name: 'The Wrap', desc: 'Your choice of protein and rice wrapped in charred flatbread grilled at 700°. Add hummus, feta, and sauces.', price: 15.60 },
    { id: 'ks-2', name: 'Grains Bowl', desc: 'Protein over herbed grains with roasted veggies, hummus, and signature Mediterranean sauces.', price: 15.60 },
    { id: 'ks-3', name: 'Plate', desc: 'Double protein over rice with two sides — hummus, tabouli, or falafel.', price: 17.76 },
    { id: 'ks-4', name: 'Kebab Fries', desc: 'Loaded fries with your choice of protein, feta, sauces, and fresh toppings.', price: 15.60 },
  ],
  'mod-fresh': [
    { id: 'mf-1', name: 'Create-Your-Own Salad', desc: 'Start with romaine or mixed greens and build with unlimited fresh toppings and house dressings.', price: 10.99 },
    { id: 'mf-2', name: 'Create-Your-Own Pizza', desc: 'MOD-size 11" thin crust with unlimited toppings from 40+ options. Baked fresh in minutes.', price: 12.99 },
    { id: 'mf-3', name: 'Greek Signature Salad', desc: 'Romaine, feta, red onion, olives, pepperoncini, tomatoes, cucumbers, chickpeas, and Greek vinaigrette.', price: 10.99 },
    { id: 'mf-4', name: 'Mad Dog Pizza', desc: 'Tomato sauce, mozzarella, Italian sausage, pepperoni, and spicy buffalo finish.', price: 12.99 },
  ],
  'up-thai': [
    { id: 'ut-1', name: 'Pad Thai', desc: 'Classic thin rice noodles with tamarind sauce, bean sprouts, egg, green onion, and crushed peanuts.', price: 15.95 },
    { id: 'ut-2', name: 'Basil Fried Rice', desc: 'Jasmine rice stir-fried with Thai basil, bell pepper, onion, egg, and your choice of protein.', price: 14.95 },
    { id: 'ut-3', name: 'Massaman Curry', desc: 'Rich coconut milk curry with potatoes, peanuts, and your choice of chicken or beef.', price: 15.95 },
    { id: 'ut-4', name: 'Pad See Ew', desc: 'Wide rice noodles stir-fried in sweet soy sauce with Chinese broccoli, egg, and your choice of protein.', price: 15.95 },
  ],
}

export default function OnboardingFavorites() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
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
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const onboarding = JSON.parse(localStorage.getItem('yk_onboarding') || '{}')

    const res = await fetch('/api/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: user.id,
        full_name: onboarding.full_name,
        address: onboarding.address,
        household_size: onboarding.household_size,
        dietary_restrictions: onboarding.dietary_restrictions || [],
        restaurants: onboarding.restaurants || [],
        calendar_dates: onboarding.calendar_dates || [],
        delivery_window_start: onboarding.delivery_window_start,
        delivery_window_end: onboarding.delivery_window_end,
        favorites,
      }),
    })

    const data = await res.json()

    if (!res.ok || data.error) {
      setError(data.error || 'Something went wrong. Please try again.')
      setLoading(false)
      return
    }

    localStorage.removeItem('yk_onboarding')
    router.push('/dashboard')
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
          {menuItems.length === 0 ? (
            <p style={{ fontSize: 14, color: '#6B7066', textAlign: 'center', padding: '20px 0' }}>
              No menu items for this restaurant yet.
            </p>
          ) : menuItems.map(item => (
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

        {error && (
          <div style={{ background: '#FDE8E8', border: '1.5px solid #B94040',
                        borderRadius: 12, padding: '14px 16px', marginBottom: 20 }}>
            <p style={{ fontSize: 13, color: '#B94040', margin: 0 }}>⚠️ {error}</p>
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

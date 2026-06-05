import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { geocodeAddress } from '@/lib/geocode'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const MENU_ITEMS: Record<string, { name: string; description: string; price: number; is_favorite: boolean }[]> = {
  'first-watch': [
    { name: 'Lemon Ricotta Pancakes', description: 'Fluffy lemon-ricotta pancakes with seasonal berries and whipped cream.', price: 13.99, is_favorite: true },
    { name: 'Avocado Toast', description: 'Smashed avocado on multigrain toast with lemon, chili flakes, and fresh fruit.', price: 10.99, is_favorite: true },
    { name: 'Chickichanga', description: 'Breakfast burrito with scrambled eggs, chicken, avocado, cheddar, and salsa.', price: 12.49, is_favorite: false },
    { name: 'A.M. Superfoods Bowl', description: 'Tri-colored quinoa, roasted sweet potatoes, avocado, kale, and lemon-tahini dressing.', price: 13.49, is_favorite: false },
  ],
  'toasted-yolk': [
    { name: 'Shrimp & Grits', description: 'Signature cheese grits topped with sautéed garlic shrimp, bacon, cilantro, and diced tomatoes.', price: 15.99, is_favorite: true },
    { name: 'Chicken & Waffles', description: "Crispy tenders on a Belgian waffle with cheddar and jalapeños, drizzled with Mike's Hot Honey.", price: 15.99, is_favorite: true },
    { name: 'Banana Foster French Toast', description: 'Belgian waffle-style French toast with banana custard, caramel sauce, and vanilla wafer crumbles.', price: 16.99, is_favorite: false },
    { name: 'Brisket Scramble', description: 'Scrambled eggs with smoked brisket and cheesy hashbrown casserole.', price: 15.49, is_favorite: false },
  ],
  'harvest': [
    { name: 'Hot Chicken Benedict', description: 'Crispy hot chicken on sourdough English muffins with poached eggs, hollandaise, and Harvest potatoes.', price: 17.99, is_favorite: true },
    { name: 'Avocado & Goat Cheese Toast', description: 'Sourdough toast with smashed avocado, arugula, fried goat cheese medallion, poached egg, and hollandaise.', price: 15.99, is_favorite: true },
    { name: 'Huevos Rancheros', description: 'Crispy corn tostadas with avocado, black beans, over-easy eggs, red and green salsa, queso fresco, and grits.', price: 16.49, is_favorite: false },
    { name: 'Chicken Salad Avocado Toast', description: 'Multigrain toast with chicken salad, fresh blueberries, candied pecans, and balsamic reduction.', price: 15.99, is_favorite: false },
  ],
  'cava': [
    { name: 'Harissa Avocado Bowl', description: 'Harissa honey chicken over basmati rice with Crazy Feta, hummus, avocado, and hot harissa vinaigrette.', price: 13.49, is_favorite: true },
    { name: 'Chicken + Rice Bowl', description: 'Grilled chicken over basmati rice with hummus, cucumber, tomato, feta, and lemon herb tahini.', price: 12.49, is_favorite: true },
    { name: 'Spicy Lamb + Avocado Bowl', description: 'Spiced lamb meatballs over SuperGreens and lentils with creamy avocado, Crazy Feta, and skhug sauce.', price: 13.49, is_favorite: false },
    { name: 'Falafel Crunch Bowl', description: 'Crispy falafel over roasted veggies and lentils with hummus, pickled onions, and lemon herb tahini.', price: 12.49, is_favorite: false },
  ],
  'kebab-shop': [
    { name: 'The Wrap', description: 'Your choice of protein and rice wrapped in charred flatbread grilled at 700°.', price: 15.60, is_favorite: true },
    { name: 'Grains Bowl', description: 'Protein over herbed grains with roasted veggies, hummus, and signature Mediterranean sauces.', price: 15.60, is_favorite: true },
    { name: 'Plate', description: 'Double protein over rice with two sides — hummus, tabouli, or falafel.', price: 17.76, is_favorite: false },
    { name: 'Kebab Fries', description: 'Loaded fries with your choice of protein, feta, sauces, and fresh toppings.', price: 15.60, is_favorite: false },
  ],
  'mod-fresh': [
    { name: 'Create-Your-Own Salad', description: 'Start with romaine or mixed greens and build with unlimited fresh toppings and house dressings.', price: 10.99, is_favorite: true },
    { name: 'Create-Your-Own Pizza', description: 'MOD-size 11" thin crust with unlimited toppings from 40+ options. Baked fresh in minutes.', price: 12.99, is_favorite: true },
    { name: 'Greek Signature Salad', description: 'Romaine, feta, red onion, olives, pepperoncini, tomatoes, cucumbers, chickpeas, and Greek vinaigrette.', price: 10.99, is_favorite: false },
    { name: 'Mad Dog Pizza', description: 'Tomato sauce, mozzarella, Italian sausage, pepperoni, and spicy buffalo finish.', price: 12.99, is_favorite: false },
  ],
  'up-thai': [
    { name: 'Pad Thai', description: 'Classic thin rice noodles with tamarind sauce, bean sprouts, egg, green onion, and crushed peanuts.', price: 15.95, is_favorite: true },
    { name: 'Basil Fried Rice', description: 'Jasmine rice stir-fried with Thai basil, bell pepper, onion, egg, and your choice of protein.', price: 14.95, is_favorite: true },
    { name: 'Massaman Curry', description: 'Rich coconut milk curry with potatoes, peanuts, and your choice of chicken or beef.', price: 15.95, is_favorite: true },
    { name: 'Pad See Ew', description: 'Wide rice noodles stir-fried in sweet soy sauce with Chinese broccoli, egg, and your choice of protein.', price: 15.95, is_favorite: false },
  ],
}

const DOORDASH_STORE_IDS: Record<string, string> = {
  'first-watch': '927672',
  'toasted-yolk': '1109805',
  'harvest': '30324131',
  'cava': '23050039',
  'kebab-shop': '32660157',
  'mod-fresh': '26020728',
  'up-thai': '1538370',
}

export async function POST(request: Request) {
  try {
    const {
      user_id, full_name, phone, sms_consent, address,
      street, apt, city, state, zip,
      household_size, household_adults, household_children,
      dietary_restrictions, tier, restaurants, calendar_dates,
      breakfast_windows, lunch_windows, dinner_windows,
      delivery_window_start, delivery_window_end, favorites
    } = await request.json()

    if (!user_id || !full_name) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Update profile with everything collected in onboarding
    await supabase.from('profiles').upsert({
      id: user_id,
      full_name,
      phone: phone || null,
      sms_consent: sms_consent ?? false,
      street: street || null,
      apt: apt || null,
      city: city || null,
      state: state || null,
      zip: zip || null,
      household_size: household_size || null,
      dietary_restrictions: dietary_restrictions || [],
      tier: tier || 'free',
    }, { onConflict: 'id' })

    // Geocode the delivery address → lat/lng (Places API). Non-blocking: if this
    // fails, the kitchen still gets created; the user can fix the address in Settings.
    const coords = await geocodeAddress(address || '')

    // Generate unique slug
    const baseSlug = full_name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    let slug = baseSlug
    let attempt = 0
    while (true) {
      const { data: existing } = await supabase.from('kitchens').select('id').eq('slug', slug).single()
      if (!existing) break
      attempt++
      slug = `${baseSlug}-${attempt}`
    }

    // Create kitchen — now with geocoded coordinates so Places search works immediately
    const { data: kitchen, error: kitchenError } = await supabase
      .from('kitchens')
      .insert({
        organizer_id: user_id,
        recipient_id: user_id,
        name: `${full_name}'s Kitchen`,
        slug,
        address,
        latitude: coords?.lat ?? null,
        longitude: coords?.lng ?? null,
        household_size: parseInt(household_size?.toString().split('-')[0] || '3'),
        household_adults: household_adults ?? 2,
        household_children: household_children ?? 2,
        dietary_restrictions: dietary_restrictions || [],
        breakfast_windows: breakfast_windows || [],
        lunch_windows: lunch_windows || [],
        dinner_windows: dinner_windows || ['17:30-19:00'],
        status: 'active',
        tier: (tier && tier !== 'free') ? 'trial' : 'free',
        trial_started_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (kitchenError || !kitchen) {
      console.error('Kitchen error:', kitchenError)
      return NextResponse.json({ error: kitchenError?.message || 'Failed to create kitchen' }, { status: 500 })
    }

    // Create restaurants + menu items
    for (const r of (restaurants || [])) {
      const { data: rest } = await supabase
        .from('kitchen_restaurants')
        .insert({
          kitchen_id: kitchen.id,
          name: r.name,
          cuisine: r.cuisine,
          is_active: true,
          doordash_store_id: DOORDASH_STORE_IDS[r.id] || null,
        })
        .select()
        .single()

      if (rest) {
        const items = MENU_ITEMS[r.id] || []
        for (const item of items) {
          await supabase.from('menu_items').insert({
            kitchen_restaurant_id: rest.id,
            name: item.name,
            description: item.description,
            price: item.price,
            is_favorite: favorites?.includes(`${r.id.split('-')[0]}-${items.indexOf(item) + 1}`) || item.is_favorite,
          })
        }
      }
    }

    // Create calendar dates
    // Client sends [{ date, meal_type }] — pull the string off slot.date and persist meal_type.
for (const slot of (calendar_dates || [])) {
  const { error: calErr } = await supabase.from('calendar_dates').insert({
    kitchen_id: kitchen.id,
    date: slot.date,
    meal_type: slot.meal_type,
    status: 'available',
    delivery_window_start: delivery_window_start || '17:30',
    delivery_window_end: delivery_window_end || '19:00',
  })
  if (calErr) console.error('calendar_date insert failed:', calErr.message, slot)
}

    return NextResponse.json({ success: true, kitchen_id: kitchen.id, slug: kitchen.slug })

  } catch (err: any) {
    console.error('Onboarding error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

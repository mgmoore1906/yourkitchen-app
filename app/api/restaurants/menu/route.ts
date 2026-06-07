import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getChainMenu } from '@/lib/chain-menus'
export const dynamic = 'force-dynamic'
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const name       = searchParams.get('name')       || ''
  const kitchenSlug = searchParams.get('slug')       || ''
  const kitchenId   = searchParams.get('kitchen_id') || ''

  // 1. Check kitchen's saved favorite meals for this restaurant
  if (kitchenSlug || kitchenId) {
    let kId = kitchenId
    if (!kId && kitchenSlug) {
      const { data: k } = await supabase
        .from('kitchens').select('id').eq('slug', kitchenSlug).single()
      kId = k?.id || ''
    }

    if (kId) {
      const { data: rest } = await supabase
        .from('kitchen_restaurants')
        .select('favorite_meals')
        .eq('kitchen_id', kId)
        .ilike('name', `%${name}%`)
        .single()

      if (rest?.favorite_meals && rest.favorite_meals.length > 0) {
        const items = rest.favorite_meals.map((meal: string, i: number) => ({
          id:          `saved-${i}`,
          name:        meal,
          description: `Saved favorite from ${name}`,
          price:       0, // recipient-specified, price filled at checkout
          category:    '⭐ Recipient Favorites',
          is_favorite: true,
        }))
        return NextResponse.json({ items, source: 'saved_favorites', matched: true })
      }
    }
  }

  // 2. Check chain menu library
  const chainItems = getChainMenu(name)
  if (chainItems) {
    return NextResponse.json({ items: chainItems, source: 'library', matched: true })
  }

  // 3. No match anywhere — return empty, coordinator enters free text
  // NEVER return generic placeholder items
  return NextResponse.json({ items: [], source: 'none', matched: false })
}

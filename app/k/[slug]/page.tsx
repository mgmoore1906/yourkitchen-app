import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import CoordKitchenClient from './client'

type Props = {
  params: Promise<{ slug: string }>
}

export default async function KitchenPage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()

  // Kitchen + restaurants + calendar dates
  const { data: kitchen } = await supabase
    .from('kitchens')
    .select(`
      *,
      kitchen_restaurants (
        *,
        menu_items (*)
      ),
      calendar_dates (*)
    `)
    .eq('slug', slug)
    .eq('status', 'active')
    .single()

  if (!kitchen) notFound()

  const activeRestaurants = kitchen.kitchen_restaurants?.filter(
    (r: any) => r.is_active !== false
  ) || []

  const availableDates = kitchen.calendar_dates
    ?.filter((d: any) => d.status === 'available')
    .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())

  // Recent meal history — last 30 days so coordinator avoids repeats
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const { data: recentMeals } = await supabase
    .from('meal_proposals')
    .select('id, coordinator_name, restaurant_name, meal_name, delivery_date, meal_type, status')
    .eq('kitchen_id', kitchen.id)
    .in('status', ['confirmed', 'delivered'])
    .gte('delivery_date', thirtyDaysAgo.toISOString().split('T')[0])
    .order('delivery_date', { ascending: false })
    .limit(10)

  return (
    <CoordKitchenClient
      kitchen={kitchen}
      availableDates={availableDates || []}
      restaurants={activeRestaurants}
      recentMeals={recentMeals || []}
    />
  )
}

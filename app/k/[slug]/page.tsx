import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import CoordKitchenClient from './client'

type Props = {
  params: Promise<{ slug: string }>
}

// Open Graph metadata so a shared kitchen link unfurls into a warm, branded
// preview card everywhere it's pasted — Facebook, iMessage, WhatsApp, Slack.
// Facebook ignores any custom "quote" text (deprecated), so the preview is
// driven entirely by these tags + the page URL.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()
  const { data: kitchen } = await supabase
    .from('kitchens')
    .select('name')
    .eq('slug', slug)
    .single()

  const firstName = kitchen?.name?.split(/[\s']/)[0] || 'a friend'
  const title = kitchen?.name ? `${firstName}'s Kitchen — send a meal 🧡` : 'YourKitchen — send a meal 🧡'
  const description = `${firstName}'s village has a way to show up. Pick a date and send ${firstName} a home-delivered meal — no app needed, just open the link.`
  const url = `https://app.yourkitchen.app/k/${slug}`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      siteName: 'YourKitchen',
      type: 'website',
      images: [{ url: 'https://raw.githubusercontent.com/mgmoore1906/yourkitchen/main/og-image.png', width: 1200, height: 630, alt: 'YourKitchen' }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['https://raw.githubusercontent.com/mgmoore1906/yourkitchen/main/og-image.png'],
    },
  }
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

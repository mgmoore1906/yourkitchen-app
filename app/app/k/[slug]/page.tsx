import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import CoordKitchenClient from './client'

type Props = {
  params: Promise<{ slug: string }>
}

export default async function KitchenPage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()

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

  const availableDates = kitchen.calendar_dates
    ?.filter((d: any) => d.status === 'available')
    .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())

  return (
    <CoordKitchenClient
      kitchen={kitchen}
      availableDates={availableDates || []}
      restaurants={kitchen.kitchen_restaurants || []}
    />
  )
}

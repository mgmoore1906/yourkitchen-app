import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DashboardClient from './client'

export default async function Dashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: kitchen } = await supabase
    .from('kitchens')
    .select('*')
    .eq('organizer_id', user.id)
    .single()

  if (!kitchen) redirect('/onboarding/profile')

  const { data: pendingProposals } = await supabase
    .from('meal_proposals')
    .select(`
      *,
      claims(*, calendar_dates(*), guest_coordinators(*)),
      kitchen_restaurants(*),
      menu_items(*)
    `)
    .eq('status', 'pending')
    .order('proposed_at', { ascending: false })

  // Confirmed proposals with tracking links — last 14 days
  const twoWeeksAgo = new Date()
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)
  const { data: confirmedProposals } = await supabase
    .from('meal_proposals')
    .select(`
      *,
      claims(*, calendar_dates(*), guest_coordinators(*)),
      kitchen_restaurants(*),
      menu_items(*)
    `)
    .eq('status', 'confirmed')
    .not('doordash_tracking_url', 'is', null)
    .gte('responded_at', twoWeeksAgo.toISOString())
    .order('responded_at', { ascending: false })

  const from = new Date()
  from.setMonth(from.getMonth() - 1)
  const to = new Date()
  to.setMonth(to.getMonth() + 6)

  const { data: calendarDates } = await supabase
    .from('calendar_dates')
    .select('*')
    .eq('kitchen_id', kitchen.id)
    .gte('date', from.toISOString().split('T')[0])
    .lte('date', to.toISOString().split('T')[0])
    .order('date', { ascending: true })

  const { data: kitchenRestaurants } = await supabase
    .from('kitchen_restaurants')
    .select('*')
    .eq('kitchen_id', kitchen.id)
    .order('created_at', { ascending: true })

  return (
    <DashboardClient
      kitchen={kitchen}
      pendingProposals={pendingProposals || []}
      confirmedProposals={confirmedProposals || []}
      calendarDates={calendarDates || []}
      kitchenRestaurants={kitchenRestaurants || []}
      userEmail={user.email || ''}
    />
  )
}

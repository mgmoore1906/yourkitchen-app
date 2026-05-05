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

  // Fetch calendar dates — 3 months back through 6 months ahead
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

  return (
    <DashboardClient
      kitchen={kitchen}
      pendingProposals={pendingProposals || []}
      calendarDates={calendarDates || []}
      userEmail={user.email || ''}
    />
  )
}

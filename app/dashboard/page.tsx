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

  return (
    <DashboardClient
      kitchen={kitchen}
      pendingProposals={pendingProposals || []}
      userEmail={user.email || ''}
    />
  )
}
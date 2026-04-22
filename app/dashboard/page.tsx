import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function Dashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div style={{ padding: 40, fontFamily: "'DM Sans', sans-serif" }}>
      <h1 style={{ fontFamily: "'Lora', serif" }}>Welcome to YourKitchen</h1>
      <p style={{ color: '#6B7066' }}>Logged in as: {user.email}</p>
    </div>
  )
}
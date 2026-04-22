import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

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

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF5',
                  fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />

      {/* Nav */}
      <div style={{ background: '#1E2620', padding: '16px 24px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 500, letterSpacing: 5,
                        color: '#6B9E7E', textTransform: 'uppercase' }}>Your</div>
          <div style={{ fontFamily: "'Lora', serif", fontSize: 22,
                        fontWeight: 500, color: '#fff' }}>Kitchen</div>
        </div>
        <div style={{ width: 38, height: 38, borderRadius: 12, background: '#3D6B4F',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontWeight: 700, fontSize: 14 }}>
          {kitchen.name?.charAt(0) || 'K'}
        </div>
      </div>

      <div style={{ padding: '28px 24px', maxWidth: 500, margin: '0 auto' }}>
        {/* Welcome */}
        <h1 style={{ fontFamily: "'Lora', serif", fontSize: 26, fontWeight: 500,
                     color: '#1E2620', margin: '0 0 4px', letterSpacing: -0.5 }}>
          {kitchen.name} 👋
        </h1>
        <p style={{ fontSize: 14, color: '#6B7066', margin: '0 0 28px', fontWeight: 300 }}>
          Your Kitchen is live. Share the link with your village.
        </p>

        {/* Share link */}
        <div style={{ background: '#fff', border: '1.5px dashed #6B9E7E',
                      borderRadius: 16, padding: '20px', marginBottom: 20 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: '#6B7066',
                      letterSpacing: 1.5, textTransform: 'uppercase', margin: '0 0 8px' }}>
            Your Kitchen Link
          </p>
          <p style={{ fontFamily: "'Lora', serif", fontSize: 15, color: '#3D6B4F',
                      margin: '0 0 14px', wordBreak: 'break-all' }}>
            yourkitchen.app/k/{kitchen.slug}
          </p>
          <div style={{ background: '#EAF2ED', borderRadius: 10, padding: '12px 16px' }}>
            <p style={{ fontSize: 13, color: '#3D6B4F', margin: 0 }}>
              🔗 Share this link with your village — they can claim dates and send you meals.
            </p>
          </div>
        </div>

        {/* Status cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Status', value: '✅ Active', bg: '#EAF2ED', color: '#3D6B4F' },
            { label: 'Tier', value: '🎁 Trial', bg: '#EAF2ED', color: '#3D6B4F' },
            { label: 'Address', value: kitchen.address?.split(',')[0] || '—', bg: '#fff', color: '#1E2620' },
            { label: 'Household', value: `${kitchen.household_size || '—'} people`, bg: '#fff', color: '#1E2620' },
          ].map(c => (
            <div key={c.label} style={{ background: c.bg, border: '1px solid #DDE8E0',
                                        borderRadius: 14, padding: '16px' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#6B7066',
                            letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>
                {c.label}
              </div>
              <div style={{ fontSize: 14, fontWeight: 500, color: c.color }}>
                {c.value}
              </div>
            </div>
          ))}
        </div>

        {/* Dietary restrictions */}
        {kitchen.dietary_restrictions?.length > 0 && (
          <div style={{ background: '#fff', border: '1px solid #DDE8E0',
                        borderRadius: 14, padding: '16px', marginBottom: 20 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: '#6B7066',
                        letterSpacing: 1, textTransform: 'uppercase', margin: '0 0 10px' }}>
              Dietary Restrictions
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {kitchen.dietary_restrictions.map((d: string) => (
                <span key={d} style={{ background: '#EAF2ED', color: '#3D6B4F',
                                       borderRadius: 20, fontSize: 12, fontWeight: 500,
                                       padding: '6px 14px' }}>
                  {d}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Sign out */}
        <form action="/auth/signout" method="post">
          <button type="submit"
            style={{ width: '100%', padding: '13px', borderRadius: 10,
                     border: '1.5px solid #DDE8E0', background: 'transparent',
                     fontSize: 14, color: '#6B7066', cursor: 'pointer',
                     fontFamily: "'DM Sans', sans-serif" }}>
            Sign Out
          </button>
        </form>
      </div>
    </div>
  )
}
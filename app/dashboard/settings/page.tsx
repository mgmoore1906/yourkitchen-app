'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const S = {
  sage: '#3D6B4F', sageMid: '#6B9E7E', sageLight: '#EAF2ED',
  cream: '#FAFAF5', forest: '#1E2620', stone: '#6B7066',
  border: '#DDE8E0', white: '#FFFFFF', amber: '#C17F47',
  amberLight: '#FFF8E8', red: '#B94040',
}

type Kitchen = {
  id: string
  name: string
  slug: string
  address: string
  household_size: number
}

type CalendarDate = {
  id: string
  date: string
  meal_type: 'breakfast' | 'lunch' | 'dinner'
  status: string
}

type Proposal = {
  id: string
  coordinator_name: string
  restaurant_name: string
  meal_name: string
  delivery_date: string
  meal_type: string
  status: string
}

export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [userName, setUserName] = useState('')
  const [kitchen, setKitchen] = useState<Kitchen | null>(null)
  const [openDates, setOpenDates] = useState<CalendarDate[]>([])
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      // Load profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single()

      setUserName(profile?.full_name?.split(' ')[0] || 'there')

      // Load kitchen
      const { data: kitchenData } = await supabase
        .from('kitchens')
        .select('id, name, slug, address, household_size')
        .eq('organizer_id', user.id)
        .single()

      if (kitchenData) {
        setKitchen(kitchenData)

        // Load open dates
        const { data: dates } = await supabase
          .from('calendar_dates')
          .select('id, date, meal_type, status')
          .eq('kitchen_id', kitchenData.id)
          .eq('status', 'available')
          .gte('date', new Date().toISOString().split('T')[0])
          .order('date', { ascending: true })
          .limit(6)

        setOpenDates(dates || [])

        // Load pending proposals
        const { data: proposalData } = await supabase
          .from('meal_proposals')
          .select('id, coordinator_name, restaurant_name, meal_name, delivery_date, meal_type, status')
          .eq('kitchen_id', kitchenData.id)
          .eq('status', 'pending')
          .order('delivery_date', { ascending: true })

        setProposals(proposalData || [])
      }

      setLoading(false)
    }
    load()
  }, [])

  const kitchenUrl = kitchen ? `yourkitchen.app/k/${kitchen.slug}` : ''

  const copyLink = () => {
    navigator.clipboard.writeText(`https://${kitchenUrl}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00')
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  const mealEmoji = (type: string) => ({ breakfast: '🌅', lunch: '☀️', dinner: '🌙' }[type] || '🍽')
  const mealColor = (type: string) => ({
    breakfast: '#E8A020', lunch: '#4A8FA8', dinner: '#3D6B4F'
  }[type] || S.sage)

  const initials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  if (loading) return (
    <div style={{ minHeight: '100vh', background: S.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans', sans-serif" }}>
      <p style={{ color: S.stone, fontSize: 14 }}>Loading your Kitchen…</p>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: S.cream, fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />

      {/* Nav */}
      <nav style={{ background: S.white, borderBottom: `0.5px solid ${S.border}`, padding: '14px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
          <span style={{ fontSize: 8, fontWeight: 500, letterSpacing: 5, color: S.sageMid, textTransform: 'uppercase' }}>Your</span>
          <span style={{ fontFamily: "'Lora', serif", fontSize: 20, fontWeight: 500, color: S.forest, letterSpacing: -0.5 }}>Kitchen</span>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={() => router.push('/settings')} style={{ background: 'none', border: `1.5px solid ${S.border}`, borderRadius: 9, padding: '7px 14px', fontSize: 12, fontWeight: 600, color: S.stone, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>Settings</button>
          <button
            onClick={async () => { await supabase.auth.signOut(); router.push('/login') }}
            style={{ background: 'none', border: 'none', fontSize: 12, fontWeight: 500, color: S.stone, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}
          >Sign out</button>
        </div>
      </nav>

      <div style={{ maxWidth: 620, margin: '0 auto', padding: '32px 24px 80px' }}>

        {/* Greeting */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
          <div>
            <p style={{ fontSize: 13, color: S.stone, fontWeight: 300, margin: '0 0 3px' }}>Welcome back,</p>
            <h1 style={{ fontFamily: "'Lora', serif", fontSize: 28, fontWeight: 500, color: S.forest, margin: 0, letterSpacing: -0.5 }}>{userName} 👋</h1>
          </div>
          <div style={{ width: 44, height: 44, borderRadius: 13, background: S.sage, display: 'flex', alignItems: 'center', justifyContent: 'center', color: S.white, fontWeight: 700, fontSize: 15 }}>
            {initials(userName)}
          </div>
        </div>

        {/* ── NO KITCHEN STATE ── */}
        {!kitchen && (
          <div>
            <div style={{ background: S.forest, borderRadius: 20, padding: '28px 28px 24px', marginBottom: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 14 }}>🥗</div>
              <h2 style={{ fontFamily: "'Lora', serif", fontSize: 22, fontWeight: 500, color: S.white, margin: '0 0 10px' }}>Set up your Kitchen</h2>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.65)', fontWeight: 300, lineHeight: 1.7, margin: '0 0 22px', maxWidth: 360, marginLeft: 'auto', marginRight: 'auto' }}>
                Your Kitchen is where your village shows up. Add restaurants, set your calendar, and share your link — your people will take it from there.
              </p>
              <button
                onClick={() => router.push('/kitchen/setup')}
                style={{ background: S.sage, color: S.white, border: 'none', borderRadius: 12, padding: '13px 28px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}
              >
                Set Up My Kitchen →
              </button>
            </div>
            <div style={{ background: S.white, border: `0.5px solid ${S.border}`, borderRadius: 16, padding: '18px 20px' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: S.stone, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 12px' }}>How it works</p>
              {[
                { n: '1', t: 'Set your calendar', s: 'Choose which dates you need meals delivered.' },
                { n: '2', t: 'Pick your restaurants', s: 'Your village will order from these via DoorDash.' },
                { n: '3', t: 'Share your Kitchen link', s: 'They claim dates, pick meals, and send dinner.' },
                { n: '4', t: 'Reply Y to confirm', s: 'DoorDash handles the rest. Dinner arrives.' },
              ].map(step => (
                <div key={step.n} style={{ display: 'flex', gap: 14, marginBottom: 14, alignItems: 'flex-start' }}>
                  <div style={{ width: 26, height: 26, borderRadius: '50%', background: S.sageLight, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Lora', serif", fontSize: 13, fontWeight: 600, color: S.sage, flexShrink: 0, marginTop: 1 }}>{step.n}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: S.forest }}>{step.t}</div>
                    <div style={{ fontSize: 12, color: S.stone, fontWeight: 300, marginTop: 2 }}>{step.s}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── KITCHEN EXISTS ── */}
        {kitchen && (
          <div>

            {/* Pending proposals — action needed */}
            {proposals.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                {proposals.map(p => (
                  <div key={p.id} style={{ background: S.forest, borderRadius: 18, padding: '18px 20px', marginBottom: 10 }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: S.amber, borderRadius: 20, padding: '3px 10px', fontSize: 9, fontWeight: 700, color: S.white, letterSpacing: '0.06em', marginBottom: 10 }}>
                      ACTION NEEDED
                    </div>
                    <div style={{ fontFamily: "'Lora', serif", fontSize: 17, color: S.white, fontWeight: 500, margin: '0 0 4px' }}>
                      {p.coordinator_name} wants to send you dinner
                    </div>
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 14, fontWeight: 300 }}>
                      {mealEmoji(p.meal_type)} {p.meal_name} · {p.restaurant_name} · {formatDate(p.delivery_date)}
                    </div>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', margin: '0 0 14px', fontWeight: 300 }}>No charge until you confirm.</p>
                    <button
                      onClick={() => router.push(`/proposals/${p.id}`)}
                      style={{ width: '100%', background: S.sage, color: S.white, border: 'none', borderRadius: 11, padding: '12px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}
                    >
                      Review Proposal →
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Kitchen share link */}
            <div style={{ background: S.white, border: `0.5px dashed ${S.sageMid}`, borderRadius: 16, padding: '18px 20px', marginBottom: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: S.stone, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 6px' }}>Your Kitchen Link</p>
              <div style={{ fontFamily: 'monospace', fontSize: 13, color: S.sage, marginBottom: 12, wordBreak: 'break-all' }}>{kitchenUrl}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={copyLink}
                  style={{ flex: 1, padding: '10px', background: copied ? S.sage : S.forest, color: S.white, border: 'none', borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif', transition: 'background 0.2s" }}
                >
                  {copied ? '✓ Copied!' : 'Copy Link'}
                </button>
                <button
                  onClick={() => navigator.share?.({ title: kitchen.name, url: `https://${kitchenUrl}` })}
                  style={{ padding: '10px 16px', background: S.sageLight, color: S.sage, border: 'none', borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}
                >
                  Share
                </button>
              </div>
            </div>

            {/* Open dates */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <p style={{ fontFamily: "'Lora', serif", fontSize: 17, fontWeight: 500, color: S.forest, margin: 0 }}>Open Dates</p>
                <button onClick={() => router.push('/kitchen/calendar')} style={{ background: 'none', border: 'none', fontSize: 12, color: S.sage, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>Manage →</button>
              </div>

              {openDates.length === 0 ? (
                <div style={{ background: S.white, border: `0.5px solid ${S.border}`, borderRadius: 14, padding: '24px', textAlign: 'center' }}>
                  <p style={{ fontSize: 14, color: S.stone, fontWeight: 300, margin: '0 0 14px' }}>No open dates yet — add some so your village can claim them.</p>
                  <button onClick={() => router.push('/kitchen/calendar')} style={{ background: S.sage, color: S.white, border: 'none', borderRadius: 9, padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>+ Add Dates</button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {openDates.map(d => (
                    <div key={d.id} style={{ background: S.white, border: `0.5px solid ${S.border}`, borderRadius: 13, padding: '13px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 18 }}>{mealEmoji(d.meal_type)}</span>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 500, color: S.forest }}>{formatDate(d.date)}</div>
                          <div style={{ fontSize: 11, color: S.stone, fontWeight: 300, marginTop: 1, textTransform: 'capitalize' }}>{d.meal_type}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: mealColor(d.meal_type) }} />
                        <span style={{ fontSize: 11, fontWeight: 700, color: mealColor(d.meal_type), letterSpacing: '0.05em' }}>OPEN</span>
                      </div>
                    </div>
                  ))}
                  <button onClick={() => router.push('/kitchen/calendar')} style={{ background: 'none', border: `1.5px dashed ${S.border}`, borderRadius: 13, padding: '13px', fontSize: 13, fontWeight: 600, color: S.stone, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>+ Add More Dates</button>
                </div>
              )}
            </div>

            {/* Quick actions */}
            <div>
              <p style={{ fontFamily: "'Lora', serif", fontSize: 17, fontWeight: 500, color: S.forest, margin: '0 0 12px' }}>Quick Actions</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { icon: '🏪', label: 'My Restaurants', path: '/kitchen/restaurants' },
                  { icon: '📅', label: 'My Calendar', path: '/kitchen/calendar' },
                  { icon: '📋', label: 'Order History', path: '/kitchen/orders' },
                  { icon: '⚙️', label: 'Settings', path: '/settings' },
                ].map(a => (
                  <button key={a.path} onClick={() => router.push(a.path)} style={{ background: S.white, border: `0.5px solid ${S.border}`, borderRadius: 14, padding: '16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", transition: 'border-color 0.15s' }}>
                    <span style={{ fontSize: 22 }}>{a.icon}</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: S.forest }}>{a.label}</span>
                  </button>
                ))}
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  )
}

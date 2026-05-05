'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

// ─── Calendar Section ────────────────────────────────────────────────────────

function CalendarSection({ calendarDates: initialDates, kitchenId }: { calendarDates: any[], kitchenId: string }) {
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [dates, setDates] = useState<any[]>(initialDates)
  const [loading, setLoading] = useState<string | null>(null)

  const todayStr = today.toISOString().split('T')[0]

  // Build a map of date string → calendar_date record
  const dateMap: Record<string, any> = {}
  dates.forEach(d => { dateMap[d.date] = d })

  const monthName = new Date(viewYear, viewMonth, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const firstDay = new Date(viewYear, viewMonth, 1).getDay() // 0=Sun
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  const handleDayTap = async (dayNum: number) => {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
    const isPast = dateStr < todayStr
    if (isPast) return

    const existing = dateMap[dateStr]

    // If claimed or confirmed — read only
    if (existing && (existing.status === 'claimed' || existing.status === 'confirmed')) return

    setLoading(dateStr)

    if (existing && existing.status === 'available') {
      // Remove it
      const res = await fetch('/api/calendar', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date_id: existing.id }),
      })
      if (res.ok) {
        setDates(prev => prev.filter(d => d.date !== dateStr))
      }
    } else {
      // Add it
      const res = await fetch('/api/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kitchen_id: kitchenId, date: dateStr }),
      })
      if (res.ok) {
        const data = await res.json()
        setDates(prev => [...prev, data.date])
      }
    }
    setLoading(null)
  }

  // Build grid cells
  const cells: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const getDateState = (dayNum: number) => {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
    const isPast = dateStr < todayStr
    const isToday = dateStr === todayStr
    const record = dateMap[dateStr]
    return { dateStr, isPast, isToday, record, status: record?.status || null }
  }

  const statusColor = (status: string | null, isPast: boolean) => {
    if (isPast) return { bg: 'transparent', text: '#C8D5CA', dot: null }
    if (!status) return { bg: 'transparent', text: '#1E2620', dot: null }
    if (status === 'available') return { bg: '#EAF2ED', text: '#3D6B4F', dot: '#3D6B4F' }
    if (status === 'claimed') return { bg: '#FFF4E0', text: '#B88B4A', dot: '#B88B4A' }
    if (status === 'confirmed') return { bg: '#1E2620', text: '#fff', dot: '#6B9E7E' }
    return { bg: 'transparent', text: '#1E2620', dot: null }
  }

  // Count summary
  const openCount = dates.filter(d => d.status === 'available').length
  const claimedCount = dates.filter(d => d.status === 'claimed').length
  const confirmedCount = dates.filter(d => d.status === 'confirmed').length

  return (
    <div style={{ background: '#fff', border: '1px solid #DDE8E0', borderRadius: 16, padding: '20px', marginBottom: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: '#6B7066', letterSpacing: 1.5, textTransform: 'uppercase', margin: '0 0 4px' }}>Your Calendar</p>
          <p style={{ fontSize: 13, color: '#6B7066', margin: 0, fontWeight: 300 }}>Tap a date to open it for meal claims</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={prevMonth} style={{ background: '#EAF2ED', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', fontSize: 16, color: '#3D6B4F', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
          <button onClick={nextMonth} style={{ background: '#EAF2ED', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', fontSize: 16, color: '#3D6B4F', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
        </div>
      </div>

      {/* Month label */}
      <p style={{ fontFamily: "'Lora', serif", fontSize: 17, fontWeight: 500, color: '#1E2620', margin: '0 0 12px', textAlign: 'center' }}>{monthName}</p>

      {/* Day headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: '#6B7066', padding: '4px 0' }}>{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
        {cells.map((day, i) => {
          if (!day) return <div key={i} />
          const { dateStr, isPast, isToday, status } = getDateState(day)
          const colors = statusColor(status, isPast)
          const isLoading = loading === dateStr
          const isInteractive = !isPast && status !== 'claimed' && status !== 'confirmed'

          return (
            <button
              key={i}
              onClick={() => handleDayTap(day)}
              disabled={isPast || isLoading}
              style={{
                background: isLoading ? '#EAF2ED' : colors.bg,
                border: isToday ? '2px solid #3D6B4F' : '1.5px solid transparent',
                borderRadius: 10,
                padding: '10px 2px',
                minHeight: 48,
                cursor: isInteractive ? 'pointer' : 'default',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                transition: 'all 0.1s',
                fontFamily: "'DM Sans', sans-serif",
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <span style={{ fontSize: 14, fontWeight: isToday ? 700 : 500, color: colors.text, lineHeight: 1 }}>{day}</span>
              {colors.dot && (
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: colors.dot, flexShrink: 0 }} />
              )}
            </button>
          )
        })}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginTop: 16, paddingTop: 14, borderTop: '1px solid #EAF2ED', flexWrap: 'wrap' }}>
        {[
          { dot: '#3D6B4F', bg: '#EAF2ED', label: `${openCount} open` },
          { dot: '#B88B4A', bg: '#FFF4E0', label: `${claimedCount} pending` },
          { dot: '#6B9E7E', bg: '#1E2620', label: `${confirmedCount} confirmed` },
        ].map(({ dot, bg, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: dot, border: `2px solid ${bg}`, boxShadow: `0 0 0 1px ${dot}` }} />
            <span style={{ fontSize: 11, color: '#6B7066', fontWeight: 500 }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Dashboard Client ────────────────────────────────────────────────────────

export default function DashboardClient({ kitchen, pendingProposals, calendarDates, userEmail }: any) {
  const router = useRouter()
  const [proposals, setProposals] = useState(pendingProposals)
  const [loading, setLoading] = useState<string | null>(null)
  const [upgradeLoading, setUpgradeLoading] = useState<string | null>(null)

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00')
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  }

  const handleResponse = async (proposalId: string, action: 'confirm' | 'decline') => {
    setLoading(proposalId)
    const res = await fetch('/api/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proposal_id: proposalId, action }),
    })
    const data = await res.json()
    if (res.ok) {
      setProposals((prev: any[]) => prev.filter((p: any) => p.id !== proposalId))
      if (action === 'confirm' && data.checkout_url) {
        window.open(data.checkout_url, '_blank')
      }
      router.refresh()
    }
    setLoading(null)
  }

  const handleUpgrade = async (plan: string) => {
    setUpgradeLoading(plan)
    const res = await fetch('/api/stripe-subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plan,
        kitchen_id: kitchen?.id,
        user_id: kitchen?.organizer_id,
      }),
    })
    const data = await res.json()
    if (data.url) {
      window.location.href = data.url
    } else {
      console.error('Upgrade error:', data.error)
    }
    setUpgradeLoading(null)
  }

  const isSubscribed = ['active', 'trialing', 'lifetime'].includes(kitchen?.subscription_status)
  const isTrialing = kitchen?.subscription_status === 'trialing'
  const isLifetime = kitchen?.subscription_plan === 'lifetime'
  const tierLabel = isLifetime ? '🌟 Founding Member' : isTrialing ? '✨ Care+ Trial' : isSubscribed ? '✅ Care+' : '🎁 Free'

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF5', fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />

      {/* Nav */}
      <div style={{ background: '#1E2620', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 500, letterSpacing: 5, color: '#6B9E7E', textTransform: 'uppercase' }}>Your</div>
          <div style={{ fontFamily: "'Lora', serif", fontSize: 22, fontWeight: 500, color: '#fff' }}>Kitchen</div>
        </div>
        <div style={{ width: 38, height: 38, borderRadius: 12, background: '#3D6B4F', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 14 }}>
          {kitchen.name?.charAt(0) || 'K'}
        </div>
      </div>

      <div style={{ padding: '28px 24px', maxWidth: 500, margin: '0 auto' }}>

        {/* Pending proposals */}
        {proposals.length > 0 && (
          <>
            <p style={{ fontSize: 10, fontWeight: 700, color: '#B94040', letterSpacing: 2, textTransform: 'uppercase', margin: '0 0 12px' }}>
              🔔 {proposals.length} Meal Proposal{proposals.length > 1 ? 's' : ''} Awaiting Your Reply
            </p>
            {proposals.map((p: any) => (
              <div key={p.id} style={{ background: '#fff', border: '2px solid #3D6B4F', borderRadius: 18, padding: '20px', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 12, background: '#EAF2ED', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>🥘</div>
                  <div>
                    <div style={{ fontFamily: "'Lora', serif", fontSize: 16, fontWeight: 600, color: '#1E2620' }}>
                      {p.claims?.guest_coordinators?.full_name} wants to send you dinner
                    </div>
                    <div style={{ fontSize: 12, color: '#6B7066', fontWeight: 300, marginTop: 2 }}>No charge until you confirm</div>
                  </div>
                </div>
                {[
                  ['Meal', p.menu_items?.name],
                  ['From', p.kitchen_restaurants?.name],
                  ['Date', formatDate(p.claims?.calendar_dates?.date)],
                  ['Price', `$${p.menu_items?.price} + delivery`],
                ].map(([l, v]) => (
                  <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #EAF2ED' }}>
                    <span style={{ fontSize: 13, color: '#6B7066', fontWeight: 300 }}>{l}</span>
                    <span style={{ fontSize: 13, color: '#1E2620', fontWeight: 500 }}>{v}</span>
                  </div>
                ))}
                {p.coordinator_note && (
                  <div style={{ background: '#EAF2ED', borderRadius: 10, padding: '10px 14px', margin: '12px 0 0' }}>
                    <p style={{ fontSize: 13, color: '#3D6B4F', margin: 0, fontStyle: 'italic' }}>"{p.coordinator_note}"</p>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                  <button onClick={() => handleResponse(p.id, 'decline')} disabled={loading === p.id}
                    style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1.5px solid #DDE8E0', background: 'transparent', fontSize: 14, color: '#6B7066', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                    ✕ Decline
                  </button>
                  <button onClick={() => handleResponse(p.id, 'confirm')} disabled={loading === p.id}
                    style={{ flex: 2, padding: '12px', borderRadius: 10, border: 'none', background: loading === p.id ? '#6B9E7E' : '#3D6B4F', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                    {loading === p.id ? 'Processing…' : '✓ Confirm — Send It!'}
                  </button>
                </div>
              </div>
            ))}
          </>
        )}

        {/* Kitchen heading */}
        <h1 style={{ fontFamily: "'Lora', serif", fontSize: 24, fontWeight: 500, color: '#1E2620', margin: '0 0 4px', letterSpacing: -0.5 }}>
          {kitchen.name} 👋
        </h1>
        <p style={{ fontSize: 14, color: '#6B7066', margin: '0 0 24px', fontWeight: 300 }}>
          Your Kitchen is live. Share the link with your village.
        </p>

        {/* Share link */}
        <div style={{ background: '#fff', border: '1.5px dashed #6B9E7E', borderRadius: 16, padding: '20px', marginBottom: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: '#6B7066', letterSpacing: 1.5, textTransform: 'uppercase', margin: '0 0 8px' }}>Your Kitchen Link</p>
          <p style={{ fontFamily: "'Lora', serif", fontSize: 15, color: '#3D6B4F', margin: '0 0 14px', wordBreak: 'break-all' }}>
            yourkitchen.app/k/{kitchen.slug}
          </p>
          <div style={{ background: '#EAF2ED', borderRadius: 10, padding: '12px 16px' }}>
            <p style={{ fontSize: 13, color: '#3D6B4F', margin: 0 }}>
              🔗 Share this link with your village — they can claim dates and send you meals.
            </p>
          </div>
        </div>

        {/* Calendar */}
        <CalendarSection calendarDates={calendarDates} kitchenId={kitchen.id} />

        {/* Status cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Status', value: '✅ Active', bg: '#EAF2ED', color: '#3D6B4F' },
            { label: 'Tier', value: tierLabel, bg: '#EAF2ED', color: '#3D6B4F' },
            { label: 'Address', value: kitchen.address?.split(',')[0] || '—', bg: '#fff', color: '#1E2620' },
            { label: 'Household', value: `${kitchen.household_size || '—'} people`, bg: '#fff', color: '#1E2620' },
          ].map(c => (
            <div key={c.label} style={{ background: c.bg, border: '1px solid #DDE8E0', borderRadius: 14, padding: '16px' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#6B7066', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>{c.label}</div>
              <div style={{ fontSize: 14, fontWeight: 500, color: c.color }}>{c.value}</div>
            </div>
          ))}
        </div>

        {/* Upgrade to Care+ */}
        {!isSubscribed && (
          <div style={{ background: '#fff', border: '1.5px solid #3D6B4F', borderRadius: 16, padding: '22px', marginBottom: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 2, color: '#3D6B4F', textTransform: 'uppercase', marginBottom: 6 }}>Upgrade to Care+</div>
            <div style={{ fontFamily: "'Lora', serif", fontSize: 18, fontWeight: 500, color: '#1E2620', marginBottom: 6 }}>Unlimited scheduling, home cook deliveries, and more.</div>
            <div style={{ fontSize: 13, color: '#6B7066', marginBottom: 18, fontWeight: 300, lineHeight: 1.6 }}>14-day free trial on monthly and annual plans. Cancel anytime.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button onClick={() => handleUpgrade('monthly')} disabled={upgradeLoading === 'monthly'}
                style={{ width: '100%', padding: '13px 16px', borderRadius: 10, border: 'none', background: '#3D6B4F', color: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", textAlign: 'left' }}>
                {upgradeLoading === 'monthly' ? 'Redirecting…' : '✨ Care+ Monthly — $9.99/mo · 14-day free trial'}
              </button>
              <button onClick={() => handleUpgrade('annual')} disabled={upgradeLoading === 'annual'}
                style={{ width: '100%', padding: '13px 16px', borderRadius: 10, border: '1.5px solid #3D6B4F', background: '#fff', color: '#3D6B4F', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", textAlign: 'left' }}>
                {upgradeLoading === 'annual' ? 'Redirecting…' : '🌿 Early Adopter Annual — $59/yr · Best value'}
              </button>
              <button onClick={() => handleUpgrade('lifetime')} disabled={upgradeLoading === 'lifetime'}
                style={{ width: '100%', padding: '13px 16px', borderRadius: 10, border: 'none', background: '#B88B4A', color: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", textAlign: 'left' }}>
                {upgradeLoading === 'lifetime' ? 'Redirecting…' : '🌟 Founding Member — $149 one-time · Unlimited forever'}
              </button>
            </div>
          </div>
        )}

        {/* Active subscription banner */}
        {isSubscribed && (
          <div style={{ background: isLifetime ? '#FFF4E8' : '#EAF2ED', border: `1.5px solid ${isLifetime ? '#B88B4A' : '#3D6B4F'}`, borderRadius: 16, padding: '16px 20px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, color: isLifetime ? '#B88B4A' : '#3D6B4F', textTransform: 'uppercase', marginBottom: 4 }}>
                {isLifetime ? 'Founding Member' : isTrialing ? 'Care+ Trial Active' : 'Care+ Active'}
              </div>
              <div style={{ fontSize: 13, color: '#6B7066', fontWeight: 300 }}>
                {isLifetime ? 'Lifetime access — thank you for founding YourKitchen.' : isTrialing ? 'Your free trial is active. Enjoy Care+ features.' : 'Your subscription is active.'}
              </div>
            </div>
            <div style={{ fontSize: 24 }}>{isLifetime ? '🌟' : '✅'}</div>
          </div>
        )}

        {/* Sign out */}
        <form action="/auth/signout" method="post">
          <button type="submit" style={{ width: '100%', padding: '13px', borderRadius: 10, border: '1.5px solid #DDE8E0', background: 'transparent', fontSize: 14, color: '#6B7066', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
            Sign Out
          </button>
        </form>
      </div>
    </div>
  )
}

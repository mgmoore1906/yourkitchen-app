'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DashboardClient({ kitchen, pendingProposals, userEmail }: any) {
  const router = useRouter()
  const [proposals, setProposals] = useState(pendingProposals)
  const [loading, setLoading] = useState<string | null>(null)

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

    if (res.ok) {
      setProposals((prev: any[]) => prev.filter((p: any) => p.id !== proposalId))
      router.refresh()
    }
    setLoading(null)
  }

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

        {/* Kitchen info */}
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

        {/* Status cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Status', value: '✅ Active', bg: '#EAF2ED', color: '#3D6B4F' },
            { label: 'Tier', value: '🎁 Trial', bg: '#EAF2ED', color: '#3D6B4F' },
            { label: 'Address', value: kitchen.address?.split(',')[0] || '—', bg: '#fff', color: '#1E2620' },
            { label: 'Household', value: `${kitchen.household_size || '—'} people`, bg: '#fff', color: '#1E2620' },
          ].map(c => (
            <div key={c.label} style={{ background: c.bg, border: '1px solid #DDE8E0', borderRadius: 14, padding: '16px' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#6B7066', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>{c.label}</div>
              <div style={{ fontSize: 14, fontWeight: 500, color: c.color }}>{c.value}</div>
            </div>
          ))}
        </div>

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
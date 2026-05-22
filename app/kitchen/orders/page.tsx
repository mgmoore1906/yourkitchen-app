'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const S = {
  sage: '#3D6B4F', sageMid: '#6B9E7E', sageLight: '#EAF2ED',
  cream: '#FAFAF5', forest: '#1E2620', stone: '#6B7066',
  border: '#DDE8E0', white: '#FFFFFF', amber: '#C17F47',
  amberLight: '#FFF8E8', sky: '#4A8FA8', skyLight: '#DFF0F6',
  red: '#B94040', redLight: '#FEE8E8',
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; emoji: string }> = {
  pending:   { label: 'Awaiting confirmation', color: S.amber, bg: S.amberLight, emoji: '⏳' },
  confirmed: { label: 'Confirmed', color: S.sky, bg: S.skyLight, emoji: '✅' },
  delivered: { label: 'Delivered', color: S.sage, bg: S.sageLight, emoji: '🧡' },
  declined:  { label: 'Declined', color: S.stone, bg: '#F5F5F5', emoji: '✕' },
  expired:   { label: 'Expired', color: S.stone, bg: '#F5F5F5', emoji: '⌛' },
  cancelled: { label: 'Cancelled', color: S.red, bg: S.redLight, emoji: '🚫' },
}

const MEAL_EMOJI: Record<string, string> = { breakfast: '🌅', lunch: '☀️', dinner: '🌙' }

type Proposal = {
  id: string
  coordinator_name: string
  restaurant_name: string
  meal_name: string
  delivery_date: string
  meal_type: string
  status: string
  note: string
  doordash_tracking_url: string
  created_at: string
}

export default function OrdersPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [filter, setFilter] = useState<string>('all')

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: kitchen } = await supabase
        .from('kitchens').select('id').eq('organizer_id', user.id).single()
      if (!kitchen) { router.push('/dashboard'); return }

      const { data } = await supabase
        .from('meal_proposals')
        .select('id, coordinator_name, restaurant_name, meal_name, delivery_date, meal_type, status, note, doordash_tracking_url, created_at')
        .eq('kitchen_id', kitchen.id)
        .order('delivery_date', { ascending: false })

      setProposals(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00')
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  const filters = ['all', 'pending', 'confirmed', 'delivered', 'declined', 'expired']
  const filtered = filter === 'all' ? proposals : proposals.filter(p => p.status === filter)

  const stats = {
    total: proposals.length,
    delivered: proposals.filter(p => p.status === 'delivered').length,
    pending: proposals.filter(p => p.status === 'pending').length,
    confirmed: proposals.filter(p => p.status === 'confirmed').length,
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: S.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans', sans-serif" }}>
      <p style={{ color: S.stone, fontSize: 14 }}>Loading order history…</p>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: S.cream, fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />

      <nav style={{ background: S.white, borderBottom: `0.5px solid ${S.border}`, padding: '14px 28px', display: 'flex', alignItems: 'center', gap: 14, position: 'sticky', top: 0, zIndex: 100 }}>
        <button onClick={() => router.push('/dashboard')} style={{ background: 'none', border: `1.5px solid ${S.border}`, borderRadius: 9, width: 34, height: 34, cursor: 'pointer', fontSize: 16, color: S.stone, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
        <div>
          <div style={{ fontSize: 8, fontWeight: 500, letterSpacing: 5, color: S.sageMid, textTransform: 'uppercase' }}>Your</div>
          <div style={{ fontFamily: "'Lora', serif", fontSize: 20, fontWeight: 500, color: S.forest, letterSpacing: -0.5 }}>Kitchen</div>
        </div>
      </nav>

      <div style={{ maxWidth: 580, margin: '0 auto', padding: '32px 24px 80px' }}>
        <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: S.sage, margin: '0 0 6px' }}>My Kitchen</p>
        <h1 style={{ fontFamily: "'Lora', serif", fontSize: 26, fontWeight: 500, color: S.forest, margin: '0 0 28px', letterSpacing: -0.5 }}>Order History</h1>

        {/* Stats */}
        {proposals.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 24 }}>
            {[
              { label: 'Total', val: stats.total, color: S.forest },
              { label: 'Delivered', val: stats.delivered, color: S.sage },
              { label: 'Confirmed', val: stats.confirmed, color: S.sky },
              { label: 'Pending', val: stats.pending, color: S.amber },
            ].map(stat => (
              <div key={stat.label} style={{ background: S.white, border: `0.5px solid ${S.border}`, borderRadius: 12, padding: '14px 12px', textAlign: 'center' }}>
                <div style={{ fontFamily: "'Lora', serif", fontSize: 22, fontWeight: 500, color: stat.color }}>{stat.val}</div>
                <div style={{ fontSize: 10, color: S.stone, fontWeight: 500, marginTop: 2 }}>{stat.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Filter tabs */}
        {proposals.length > 0 && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 20, overflowX: 'auto', paddingBottom: 4 }}>
            {filters.map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                background: filter === f ? S.forest : S.white,
                color: filter === f ? S.white : S.stone,
                border: `1px solid ${filter === f ? S.forest : S.border}`,
                borderRadius: 20, padding: '6px 14px', fontSize: 12, fontWeight: 600,
                cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", whiteSpace: 'nowrap',
              }}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        )}

        {/* Orders list */}
        {filtered.length === 0 && proposals.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 24px', background: S.white, borderRadius: 16, border: `0.5px solid ${S.border}` }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🥗</div>
            <p style={{ fontFamily: "'Lora', serif", fontSize: 17, color: S.forest, margin: '0 0 8px' }}>No orders yet</p>
            <p style={{ fontSize: 13, color: S.stone, fontWeight: 300, margin: 0 }}>When your village sends meals, they'll appear here.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px', background: S.white, borderRadius: 14, border: `0.5px solid ${S.border}` }}>
            <p style={{ fontSize: 13, color: S.stone, margin: 0 }}>No {filter} orders.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map(p => {
              const sc = STATUS_CONFIG[p.status] || STATUS_CONFIG.pending
              return (
                <div key={p.id} style={{ background: S.white, border: `0.5px solid ${S.border}`, borderRadius: 14, overflow: 'hidden' }}>
                  {/* Header */}
                  <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <span style={{ fontSize: 22, flexShrink: 0, marginTop: 2 }}>{MEAL_EMOJI[p.meal_type] || '🍽'}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: "'Lora', serif", fontSize: 15, fontWeight: 600, color: S.forest, marginBottom: 2 }}>{p.meal_name}</div>
                      <div style={{ fontSize: 12, color: S.stone, fontWeight: 300 }}>{p.restaurant_name}</div>
                      <div style={{ fontSize: 12, color: S.stone, fontWeight: 300, marginTop: 1 }}>
                        {formatDate(p.delivery_date)} · from <strong style={{ color: S.forest, fontWeight: 500 }}>{p.coordinator_name}</strong>
                      </div>
                    </div>
                    <div style={{ background: sc.bg, color: sc.color, fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 20, letterSpacing: '0.05em', flexShrink: 0 }}>
                      {sc.emoji} {sc.label}
                    </div>
                  </div>

                  {/* Note */}
                  {p.note && (
                    <div style={{ margin: '0 16px 12px', background: '#FAFAF5', borderRadius: 10, padding: '10px 12px' }}>
                      <p style={{ fontSize: 12, color: S.stone, fontStyle: 'italic', margin: 0, lineHeight: 1.6 }}>"{p.note}"</p>
                    </div>
                  )}

                  {/* Tracking link */}
                  {p.doordash_tracking_url && p.status === 'confirmed' && (
                    <div style={{ margin: '0 16px 14px' }}>
                      <a href={p.doordash_tracking_url} target="_blank" rel="noopener noreferrer"
                        style={{ display: 'block', background: S.sageLight, color: S.sage, borderRadius: 9, padding: '9px 14px', fontSize: 12, fontWeight: 600, textDecoration: 'none', textAlign: 'center' }}>
                        🚗 Track your DoorDash delivery →
                      </a>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

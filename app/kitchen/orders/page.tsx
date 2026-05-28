'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const S = {
  sage: '#3D6B4F', sageMid: '#6B9E7E', sageLight: '#EAF2ED',
  cream: '#FAFAF5', forest: '#1E2620', stone: '#6B7066',
  border: '#DDE8E0', white: '#FFFFFF', amber: '#C17F47',
  amberLight: '#FFF8E8', sky: '#4A8FA8', skyLight: '#DFF0F6',
  red: '#B94040',
}
const MEAL_EMOJI: Record<string, string> = { breakfast: '🌅', lunch: '☀️', dinner: '🌙' }

type Proposal = {
  id: string
  coordinator_name: string
  restaurant_name: string
  meal_name: string
  delivery_date: string
  meal_type: string
  proposed_at: string
  status: string
  coordinator_note: string | null
  doordash_tracking_url: string | null
  doordash_delivery_id: string | null
  created_at: string
}

function formatDate(s: string) {
  return new Date(s + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 10, fontWeight: 700, color: S.stone, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 12px' }}>
      {children}
    </p>
  )
}

export default function OrdersPage() {
  const router   = useRouter()
  const supabase = createClient()
  const [loading,   setLoading]   = useState(true)
  const [proposals, setProposals] = useState<Proposal[]>([])

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data} = await supabase
        .from('kitchens').select('id, coordinator_name, restaurant_name, meal_name, delivery_date, meal_type, status, coordinator_note, doordash_tracking_url, doordash_delivery_id, proposed_at')
.eq('kitchen_id', kitchens[0].id)
.order('proposed_at', { ascending: false }).limit(1)
      if (!kitchens || kitchens.length === 0) { router.push('/dashboard'); return }

      const { data } = await supabase
        .from('meal_proposals')
        .select('id, coordinator_name, restaurant_name, meal_name, delivery_date, meal_type, status, coordinator_note, doordash_tracking_url, doordash_delivery_id, created_at')
        .eq('kitchen_id', kitchens[0].id)
        .order('created_at', { ascending: false })
      setProposals((data || []) as Proposal[])
      setLoading(false)
    }
    load()
  }, [])

  const onTheWay  = proposals.filter(p => p.status === 'confirmed')
  const pending   = proposals.filter(p => p.status === 'pending')
  const previous  = proposals.filter(p => ['delivered','declined','expired','cancelled','failed'].includes(p.status))

  const totalPending = pending.length + onTheWay.length

  if (loading) return (
    <div style={{ minHeight: '100vh', background: S.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans', sans-serif" }}>
      <p style={{ color: S.stone, fontSize: 14 }}>Loading…</p>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: S.cream, fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />

      <nav style={{ background: S.white, borderBottom: `0.5px solid ${S.border}`, padding: '14px 28px', display: 'flex', alignItems: 'center', gap: 14, position: 'sticky', top: 0, zIndex: 100 }}>
        <button onClick={() => router.push('/dashboard')}
          style={{ background: 'none', border: `1.5px solid ${S.border}`, borderRadius: 9, width: 34, height: 34, cursor: 'pointer', fontSize: 16, color: S.stone, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
        <div>
          <div style={{ fontSize: 8, fontWeight: 500, letterSpacing: 5, color: S.sageMid, textTransform: 'uppercase' }}>Your</div>
          <div style={{ fontFamily: "'Lora', serif", fontSize: 20, fontWeight: 500, color: S.forest }}>Kitchen</div>
        </div>
        {totalPending > 0 && (
          <div style={{ marginLeft: 'auto', background: S.amber, color: S.white, borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 700 }}>
            {totalPending} need{totalPending === 1 ? 's' : ''} attention
          </div>
        )}
      </nav>

      <div style={{ maxWidth: 580, margin: '0 auto', padding: '28px 24px 80px' }}>
        <h1 style={{ fontFamily: "'Lora', serif", fontSize: 26, fontWeight: 500, color: S.forest, margin: '0 0 28px', letterSpacing: -0.5 }}>Order History</h1>

        {proposals.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 24px', background: S.white, borderRadius: 16, border: `0.5px solid ${S.border}` }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🥗</div>
            <p style={{ fontFamily: "'Lora', serif", fontSize: 17, color: S.forest, margin: '0 0 8px' }}>No orders yet</p>
            <p style={{ fontSize: 13, color: S.stone, fontWeight: 300, margin: 0 }}>When your village sends meals, they'll appear here.</p>
          </div>
        ) : (<>

          {/* ── ON THE WAY ── */}
          {onTheWay.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <SectionLabel>🚗 On the Way</SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {onTheWay.map(p => (
                  <div key={p.id} style={{ background: S.white, border: `1.5px solid ${S.sage}`, borderRadius: 14, overflow: 'hidden' }}>
                    <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <span style={{ fontSize: 22, flexShrink: 0 }}>{MEAL_EMOJI[p.meal_type] || '🍽'}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: "'Lora', serif", fontSize: 15, fontWeight: 600, color: S.forest }}>{p.meal_name}</div>
                        <div style={{ fontSize: 12, color: S.stone, fontWeight: 300 }}>{p.restaurant_name}</div>
                        <div style={{ fontSize: 12, color: S.stone, fontWeight: 300, marginTop: 2 }}>
                          {formatDate(p.delivery_date)} · from <strong style={{ color: S.forest, fontWeight: 500 }}>{p.coordinator_name}</strong>
                        </div>
                        {p.doordash_delivery_id && (
                          <div style={{ fontSize: 11, color: S.stone, fontFamily: 'monospace', marginTop: 4, wordBreak: 'break-all' }}>
                            ID: {p.doordash_delivery_id}
                          </div>
                        )}
                      </div>
                      <span style={{ background: S.sageLight, color: S.sage, fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 20, flexShrink: 0 }}>Confirmed</span>
                    </div>
                    {p.doordash_tracking_url && (
                      <div style={{ padding: '0 16px 14px' }}>
                        <a href={p.doordash_tracking_url} target="_blank" rel="noopener noreferrer"
                          style={{ display: 'block', background: S.forest, color: S.white, borderRadius: 9, padding: '10px', fontSize: 13, fontWeight: 600, textDecoration: 'none', textAlign: 'center', fontFamily: "'DM Sans', sans-serif" }}>
                          🚗 Track My Delivery
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── PENDING ── */}
          {pending.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <SectionLabel>⏳ Awaiting Your Reply</SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {pending.map(p => (
                  <div key={p.id} style={{ background: S.white, border: `1.5px solid ${S.amber}`, borderRadius: 14, overflow: 'hidden' }}>
                    <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <span style={{ fontSize: 22, flexShrink: 0 }}>{MEAL_EMOJI[p.meal_type] || '🍽'}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: "'Lora', serif", fontSize: 15, fontWeight: 600, color: S.forest }}>{p.meal_name}</div>
                        <div style={{ fontSize: 12, color: S.stone, fontWeight: 300 }}>{p.restaurant_name}</div>
                        <div style={{ fontSize: 12, color: S.stone, fontWeight: 300, marginTop: 2 }}>
                          {formatDate(p.delivery_date)} · from <strong style={{ color: S.forest, fontWeight: 500 }}>{p.coordinator_name}</strong>
                        </div>
                        {p.coordinator_note && (
                          <p style={{ fontSize: 12, color: S.stone, fontStyle: 'italic', margin: '6px 0 0', lineHeight: 1.5 }}>"{p.coordinator_note}"</p>
                        )}
                      </div>
                      <span style={{ background: S.amberLight, color: S.amber, fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 20, flexShrink: 0 }}>Pending</span>
                    </div>
                    <div style={{ padding: '0 16px 14px' }}>
                      <p style={{ fontSize: 12, color: S.stone, margin: '0 0 10px', fontWeight: 300 }}>No charge until you confirm.</p>
                      <button onClick={() => router.push(`/proposals/${p.id}`)}
                        style={{ width: '100%', background: S.forest, color: S.white, border: 'none', borderRadius: 9, padding: '11px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                        Review Proposal →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── PREVIOUS ── */}
          {previous.length > 0 && (
            <div>
              <SectionLabel>Previous Orders</SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {previous.map(p => {
                  const isDelivered = p.status === 'delivered'
                  const isDeclined  = p.status === 'declined'
                  return (
                    <div key={p.id} style={{ background: S.white, border: `0.5px solid ${S.border}`, borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, opacity: isDeclined || p.status === 'expired' ? 0.65 : 1 }}>
                      <span style={{ fontSize: 20, flexShrink: 0 }}>{MEAL_EMOJI[p.meal_type] || '🍽'}</span>
                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        <div style={{ fontFamily: "'Lora', serif", fontSize: 14, fontWeight: 600, color: S.forest, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.meal_name}</div>
                        <div style={{ fontSize: 12, color: S.stone, fontWeight: 300 }}>
                          {p.restaurant_name} · {formatDate(p.delivery_date)}
                        </div>
                      </div>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, flexShrink: 0,
                        background: isDelivered ? S.sageLight : '#F5F5F5',
                        color: isDelivered ? S.sage : S.stone,
                      }}>
                        {isDelivered ? '🧡 Delivered' : isDeclined ? '✕ Declined' : p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

        </>)}
      </div>
    </div>
  )
}

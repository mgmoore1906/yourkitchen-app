'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const S = {
  sage: '#3D6B4F', sageMid: '#6B9E7E', sageLight: '#EAF2ED',
  cream: '#FAFAF5', forest: '#1E2620', stone: '#6B7066',
  border: '#DDE8E0', white: '#FFFFFF', amber: '#C17F47',
  amberLight: '#FBF0E4', red: '#B94040', redLight: '#FDE8E8',
  blue: '#2B6CB0', blueLight: '#E8F0FD',
}

const MEAL_EMOJI: Record<string, string> = {
  breakfast: '🌅', lunch: '☀️', dinner: '🌙',
}

type Order = {
  id: string
  status: string
  delivery_status: string | null
  meal_type: string
  delivery_date: string
  delivery_preference: string | null
  delivery_note: string | null
  coordinator_name: string
  restaurant_name: string
  meal_name: string
  tip_amount: number | null
  doordash_tracking_url: string | null
  doordash_delivery_id: string | null
  kitchen_name: string
  kitchen_address: string
  proposed_at: string
}

export default function AdminPage() {
  const router   = useRouter()
  const supabase = createClient()
  const [loading,      setLoading]      = useState(true)
  const [orders,       setOrders]       = useState<Order[]>([])
  const [dispatching,  setDispatching]  = useState<string | null>(null)
  const [dispatchMsg,  setDispatchMsg]  = useState<Record<string, string>>({})
  const [adminSecret,  setAdminSecret]  = useState('')
  const [authed,       setAuthed]       = useState(false)
  const [authErr,      setAuthErr]      = useState('')
  const [filter,       setFilter]       = useState<'awaiting' | 'all'>('awaiting')

  const loadOrders = useCallback(async () => {
    const { data } = await supabase
      .from('meal_proposals')
      .select(`
        id, status, delivery_status, meal_type, delivery_date,
        delivery_preference, delivery_note,
        coordinator_name, restaurant_name, meal_name,
        tip_amount, doordash_tracking_url, doordash_delivery_id,
        proposed_at,
        kitchens:kitchen_id(name, address)
      `)
      .eq('status', 'confirmed')
      .order('delivery_date', { ascending: true })

    const mapped = (data || []).map((r: any) => ({
      ...r,
      kitchen_name:    r.kitchens?.name    || '',
      kitchen_address: r.kitchens?.address || '',
    }))
    setOrders(mapped)
    setLoading(false)
  }, [])

  useEffect(() => {
    // Check if already authed in session
    const saved = sessionStorage.getItem('yk_admin_secret')
    if (saved) { setAdminSecret(saved); setAuthed(true); loadOrders() }
    else setLoading(false)
  }, [])

  const handleAuth = async () => {
    setAuthErr('')
    // Verify against env via a simple test dispatch call with wrong id
    const res = await fetch('/api/dispatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-secret': adminSecret },
      body: JSON.stringify({ proposal_id: 'auth-test' }),
    })
    if (res.status === 401) { setAuthErr('Wrong admin secret'); return }
    // 404 means auth passed (proposal not found, but we authenticated)
    sessionStorage.setItem('yk_admin_secret', adminSecret)
    setAuthed(true)
    loadOrders()
  }

  const handleDispatch = async (orderId: string) => {
    setDispatching(orderId)
    setDispatchMsg(m => ({ ...m, [orderId]: '' }))
    try {
      const res = await fetch('/api/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': adminSecret },
        body: JSON.stringify({ proposal_id: orderId }),
      })
      const data = await res.json()
      if (res.ok) {
        setDispatchMsg(m => ({ ...m, [orderId]: `✅ Dispatched! Order: ${data.orderNumber}${data.trackingUrl ? ' · ' + data.trackingUrl : ''}` }))
        await loadOrders()
      } else {
        setDispatchMsg(m => ({ ...m, [orderId]: `❌ ${data.error}` }))
      }
    } catch (err: any) {
      setDispatchMsg(m => ({ ...m, [orderId]: `❌ ${err.message}` }))
    }
    setDispatching(null)
  }

  const awaiting  = orders.filter(o => !o.delivery_status || o.delivery_status === 'awaiting_dispatch')
  const dispatched = orders.filter(o => o.delivery_status === 'dispatched')
  const visible   = filter === 'awaiting' ? awaiting : orders

  const fmt = (s: string) => new Date(s + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric'
  })

  // ── Auth screen ─────────────────────────────────────────────────────────────
  if (!authed) return (
    <div style={{ minHeight: '100vh', background: S.forest, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Lora:wght@400;500;600&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />
      <div style={{ background: S.cream, borderRadius: 20, padding: 40, width: 340 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 4, color: S.sageMid, textTransform: 'uppercase', marginBottom: 4 }}>Your</div>
          <div style={{ fontFamily: "'Lora', serif", fontSize: 28, fontWeight: 500, color: S.forest }}>Kitchen</div>
          <div style={{ fontSize: 12, color: S.stone, marginTop: 6 }}>Admin · Dispatch Panel</div>
        </div>
        <input
          type="password"
          value={adminSecret}
          onChange={e => setAdminSecret(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAuth()}
          placeholder="Admin secret"
          style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: `1.5px solid ${S.border}`, fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: 'none', marginBottom: 12, background: S.white }}
        />
        {authErr && <p style={{ fontSize: 12, color: S.red, margin: '0 0 10px', textAlign: 'center' }}>{authErr}</p>}
        <button onClick={handleAuth}
          style={{ width: '100%', padding: 13, borderRadius: 10, border: 'none', background: S.forest, color: S.white, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
          Sign In
        </button>
      </div>
    </div>
  )

  // ── Main panel ──────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: S.cream, fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Lora:wght@400;500;600&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />

      {/* Top bar */}
      <div style={{ background: S.forest, padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 500, letterSpacing: 4, color: S.sageMid, textTransform: 'uppercase' }}>Your</div>
          <div style={{ fontFamily: "'Lora', serif", fontSize: 20, fontWeight: 500, color: S.white, lineHeight: 1.1 }}>Kitchen · Admin</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ background: S.red, color: S.white, borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 700 }}>
            {awaiting.length} need dispatch
          </div>
          <button onClick={() => loadOrders()}
            style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8, padding: '8px 14px', color: S.white, fontSize: 12, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
            Refresh
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 20px' }}>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {(['awaiting', 'all'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{ padding: '8px 18px', borderRadius: 20, border: `1.5px solid ${filter === f ? S.sage : S.border}`, background: filter === f ? S.sageLight : S.white, color: filter === f ? S.sage : S.stone, fontSize: 13, fontWeight: filter === f ? 700 : 400, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
              {f === 'awaiting' ? `🔴 Needs dispatch (${awaiting.length})` : `All confirmed (${orders.length})`}
            </button>
          ))}
        </div>

        {loading && <p style={{ color: S.stone, fontSize: 14, textAlign: 'center', padding: 40 }}>Loading orders…</p>}

        {!loading && visible.length === 0 && (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
            <p style={{ fontFamily: "'Lora', serif", fontSize: 18, color: S.forest, margin: '0 0 8px' }}>All caught up</p>
            <p style={{ fontSize: 13, color: S.stone }}>No orders waiting for dispatch.</p>
          </div>
        )}

        {visible.map(order => {
          const isAwaiting   = !order.delivery_status || order.delivery_status === 'awaiting_dispatch'
          const isDispatching_ = dispatching === order.id
          const msg          = dispatchMsg[order.id]

          return (
            <div key={order.id} style={{ background: S.white, border: `2px solid ${isAwaiting ? S.red : S.border}`, borderRadius: 16, padding: 20, marginBottom: 14 }}>

              {/* Header row */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 18 }}>{MEAL_EMOJI[order.meal_type] || '🍽'}</span>
                    <span style={{ fontFamily: "'Lora', serif", fontSize: 16, fontWeight: 600, color: S.forest }}>{order.meal_name}</span>
                  </div>
                  <div style={{ fontSize: 13, color: S.stone }}>
                    {order.restaurant_name} · {fmt(order.delivery_date)}
                  </div>
                  <div style={{ fontSize: 12, color: S.stone, marginTop: 2 }}>
                    from <strong style={{ color: S.forest }}>{order.coordinator_name}</strong>
                  </div>
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '4px 12px', borderRadius: 20, background: isAwaiting ? S.redLight : S.sageLight, color: isAwaiting ? S.red : S.sage }}>
                  {isAwaiting ? '🔴 Needs dispatch' : '✅ Dispatched'}
                </span>
              </div>

              {/* Delivery details */}
              <div style={{ background: S.cream, borderRadius: 10, padding: '12px 14px', marginBottom: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: S.stone, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 3 }}>Delivery address</div>
                  <div style={{ fontSize: 13, color: S.forest }}>{order.kitchen_name}</div>
                  <div style={{ fontSize: 12, color: S.stone }}>{order.kitchen_address}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: S.stone, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 3 }}>Delivery preference</div>
                  <div style={{ fontSize: 13, color: S.forest }}>
                    {order.delivery_preference === 'hand_to_recipient' ? '🤝 Hand to recipient' : '🚪 Leave at door (no knock)'}
                  </div>
                  {order.delivery_note && <div style={{ fontSize: 12, color: S.stone, fontStyle: 'italic' }}>"{order.delivery_note}"</div>}
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: S.stone, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 3 }}>Tip</div>
                  <div style={{ fontSize: 13, color: S.forest }}>${((order.tip_amount || 0) / 100).toFixed(2)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: S.stone, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 3 }}>Meal type</div>
                  <div style={{ fontSize: 13, color: S.forest }}>{order.meal_type?.charAt(0).toUpperCase() + order.meal_type?.slice(1)}</div>
                </div>
              </div>

              {/* Checklist for Marques */}
              {isAwaiting && (
                <div style={{ background: S.amberLight, border: `1px solid ${S.amber}`, borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: S.amber, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Before you tap Dispatch</div>
                  <div style={{ fontSize: 13, color: S.forest, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div>☐ &nbsp;Order placed at <strong>{order.restaurant_name}</strong></div>
                    <div>☐ &nbsp;Order name: <strong>{order.coordinator_name || 'YourKitchen'}</strong></div>
                    <div>☐ &nbsp;Delivery address confirmed: <strong>{order.kitchen_address}</strong></div>
                    <div>☐ &nbsp;Delivery preference noted: <strong>{order.delivery_preference === 'hand_to_recipient' ? 'Hand to recipient' : 'Leave at door — no knock'}</strong></div>
                  </div>
                </div>
              )}

              {/* Tracking link if dispatched */}
              {order.doordash_tracking_url && (
                <a href={order.doordash_tracking_url} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'block', background: S.blueLight, color: S.blue, borderRadius: 9, padding: '10px 14px', fontSize: 13, fontWeight: 600, textDecoration: 'none', marginBottom: 10, textAlign: 'center' }}>
                  🚗 Track this order
                </a>
              )}

              {/* Dispatch button */}
              {isAwaiting && (
                <button
                  onClick={() => handleDispatch(order.id)}
                  disabled={isDispatching_}
                  style={{ width: '100%', padding: 14, background: isDispatching_ ? S.border : S.forest, color: isDispatching_ ? S.stone : S.white, border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: isDispatching_ ? 'default' : 'pointer', fontFamily: "'DM Sans', sans-serif", transition: 'background 0.2s' }}>
                  {isDispatching_ ? '⏳ Dispatching…' : '🚀 Dispatch to Shipday →'}
                </button>
              )}

              {/* Result message */}
              {msg && (
                <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 9, background: msg.startsWith('✅') ? S.sageLight : S.redLight, color: msg.startsWith('✅') ? S.sage : S.red, fontSize: 13, fontWeight: 500 }}>
                  {msg}
                </div>
              )}

            </div>
          )
        })}
      </div>
    </div>
  )
}

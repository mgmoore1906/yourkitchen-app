'use client'
import { useState, useEffect } from 'react'

// ── Dispatcher (helper) view ───────────────────────────────────────────────
// A read-only screen for trusted helpers who place food orders. Reads ONLY from
// /api/dispatcher-orders (scoped DISPATCHER_SECRET), which never returns recipient
// phone/email or payment data. Helpers enter their dispatcher key once; it is held
// in component state for the session only (never written to storage).
//
// This page intentionally has NO dispatch or cancel buttons — placing the courier
// order via Shipday stays with the owner. Helpers use this to see WHAT to order and
// WHERE it goes, then place the food order with the restaurant.

const S = {
  sage: '#3D6B4F', sageMid: '#6B9E7E', sageLight: '#EAF2ED',
  cream: '#FAFAF5', forest: '#1E2620', stone: '#6B7066',
  border: '#DDE8E0', white: '#FFFFFF', amber: '#C17F47',
  amberLight: '#F5EBDD', red: '#B23A3A', redLight: '#F7E4E1',
}
const FONT = "'DM Sans', sans-serif"
const MEAL_ORDER: Record<string, number> = { breakfast: 0, lunch: 1, dinner: 2 }

type Order = {
  id: string; status: string; delivery_status: string | null
  meal_type: string; delivery_date: string
  delivery_preference: string; delivery_note: string | null
  coordinator_name: string; restaurant_name: string
  restaurant_address: string; restaurant_phone: string
  meal_name: string; meal_items: any; tip_amount: number | null
  tracking_url: string
  recipient_first_name: string; delivery_address: string
}

const fmtDate = (d: string) => {
  if (!d) return ''
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}
const mealEmoji = (t: string) => t === 'breakfast' ? '🍳' : t === 'lunch' ? '🥗' : '🍽️'

function renderItems(items: any): string {
  if (!items) return ''
  if (Array.isArray(items)) {
    return items.map((it: any) => {
      if (typeof it === 'string') return it
      const qty = it.quantity || it.qty || 1
      const name = it.name || it.meal_name || ''
      return qty > 1 ? `${name} ×${qty}` : name
    }).filter(Boolean).join(', ')
  }
  if (typeof items === 'string') return items
  return ''
}

export default function DispatcherPage() {
  const [key, setKey] = useState('')
  const [authed, setAuthed] = useState(false)
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function load(secret: string) {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/dispatcher-orders', { headers: { 'x-dispatcher-secret': secret } })
      if (res.status === 401) { setError('That dispatcher key is not valid.'); setAuthed(false); setLoading(false); return }
      if (!res.ok) { const j = await res.json().catch(() => ({})); setError(j.error || 'Failed to load orders.'); setLoading(false); return }
      const j = await res.json()
      setOrders(j.orders || [])
      setAuthed(true)
    } catch (e: any) {
      setError(e.message || 'Failed to load orders.')
    } finally {
      setLoading(false)
    }
  }

  // Auto-refresh every 60s once authed, so helpers see new confirmed orders.
  useEffect(() => {
    if (!authed || !key) return
    const t = setInterval(() => load(key), 60000)
    return () => clearInterval(t)
  }, [authed, key])

  // Group by date, soonest first; within a date, by meal type.
  const byDate: Record<string, Order[]> = {}
  orders.forEach(o => { (byDate[o.delivery_date] ||= []).push(o) })
  const dates = Object.keys(byDate).sort()
  for (const d of dates) byDate[d].sort((a, b) => (MEAL_ORDER[a.meal_type] ?? 3) - (MEAL_ORDER[b.meal_type] ?? 3))

  const wrap: React.CSSProperties = { fontFamily: FONT, background: S.cream, minHeight: '100vh', color: S.forest }

  // ── Key entry ──
  if (!authed) {
    return (
      <div style={wrap}>
        <div style={{ maxWidth: 420, margin: '0 auto', padding: '80px 24px' }}>
          <div style={{ fontSize: 9, fontWeight: 500, letterSpacing: 5, color: S.sageMid, textTransform: 'uppercase' }}>Your</div>
          <div style={{ fontFamily: "'Lora', serif", fontSize: 26, fontWeight: 500, color: S.forest, marginBottom: 4 }}>Kitchen</div>
          <p style={{ fontSize: 14, color: S.stone, margin: '8px 0 28px' }}>Dispatcher access — enter your helper key to see orders that need placing.</p>
          <input
            type="password" value={key} placeholder="Dispatcher key"
            onChange={e => setKey(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') load(key) }}
            style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: `1px solid ${S.border}`, fontSize: 15, fontFamily: FONT, marginBottom: 12, boxSizing: 'border-box' }}
          />
          <button onClick={() => load(key)} disabled={!key || loading}
            style={{ width: '100%', padding: '12px', borderRadius: 10, border: 'none', background: S.sage, color: S.white, fontSize: 15, fontWeight: 600, cursor: key && !loading ? 'pointer' : 'default', opacity: key && !loading ? 1 : 0.6, fontFamily: FONT }}>
            {loading ? 'Loading…' : 'View orders'}
          </button>
          {error && <p style={{ color: S.red, fontSize: 13, marginTop: 12 }}>{error}</p>}
          <p style={{ fontSize: 12, color: S.stone, marginTop: 24, lineHeight: 1.6 }}>
            These orders contain recipients&rsquo; delivery addresses. Please keep them confidential and use them only to place meals.
          </p>
        </div>
      </div>
    )
  }

  // ── Orders list ──
  const total = orders.length
  return (
    <div style={wrap}>
      <div style={{ background: S.white, borderBottom: `1px solid ${S.border}`, padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10 }}>
        <div>
          <span style={{ fontFamily: "'Lora', serif", fontSize: 18, fontWeight: 500, color: S.forest }}>Dispatch</span>
          <span style={{ fontSize: 13, color: S.stone, marginLeft: 10 }}>{total} order{total === 1 ? '' : 's'} to place</span>
        </div>
        <button onClick={() => load(key)} disabled={loading}
          style={{ padding: '7px 14px', borderRadius: 8, border: `1.5px solid ${S.border}`, background: S.white, color: S.forest, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>
          {loading ? 'Refreshing…' : '↻ Refresh'}
        </button>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 20px' }}>
        {error && <p style={{ color: S.red, fontSize: 13, marginBottom: 16 }}>{error}</p>}
        {total === 0 && !loading && (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
            <p style={{ fontSize: 15, color: S.stone }}>No confirmed orders waiting right now.</p>
          </div>
        )}

        {dates.map(date => (
          <div key={date} style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ flex: 1, height: 0.5, background: S.border }} />
              <div style={{ fontSize: 13, fontWeight: 700, color: S.forest }}>{fmtDate(date)}</div>
              <div style={{ flex: 1, height: 0.5, background: S.border }} />
            </div>

            {byDate[date].map(order => {
              const items = renderItems(order.meal_items)
              return (
                <div key={order.id} style={{ background: S.white, border: `1px solid ${S.border}`, borderRadius: 16, padding: 20, marginBottom: 12 }}>
                  {/* Header: what + from whom */}
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 16 }}>{mealEmoji(order.meal_type)}</span>
                      <span style={{ fontSize: 15, fontWeight: 700, color: S.forest, textTransform: 'capitalize' }}>{order.meal_type}</span>
                    </div>
                    <div style={{ fontSize: 14, color: S.forest, fontWeight: 600 }}>{order.restaurant_name}</div>
                    {order.restaurant_address && <div style={{ fontSize: 12, color: S.stone, marginTop: 1 }}>📍 {order.restaurant_address}</div>}
                    {order.restaurant_phone && <div style={{ fontSize: 12, color: S.stone, marginTop: 1 }}>📞 {order.restaurant_phone}</div>}
                    <div style={{ fontSize: 12, color: S.stone, marginTop: 2 }}>from <strong style={{ color: S.forest }}>{order.coordinator_name}</strong></div>
                  </div>

                  {/* What to order */}
                  <div style={{ background: S.sageLight, borderRadius: 10, padding: '12px 14px', marginBottom: 12 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: S.sage, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Order this</div>
                    <div style={{ fontSize: 14, color: S.forest, fontWeight: 600 }}>{order.meal_name}</div>
                    {items && <div style={{ fontSize: 13, color: S.stone, marginTop: 2 }}>{items}</div>}
                  </div>

                  {/* Where + how */}
                  <div style={{ background: S.cream, borderRadius: 10, padding: '12px 14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: S.stone, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 3 }}>Deliver to</div>
                      <div style={{ fontSize: 13, color: S.forest }}>{order.recipient_first_name}</div>
                      <div style={{ fontSize: 12, color: S.stone }}>{order.delivery_address}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: S.stone, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 3 }}>Preference</div>
                      <div style={{ fontSize: 13, color: S.forest }}>{order.delivery_preference === 'hand_to_recipient' ? '🤝 Hand to recipient' : '🚪 Leave at door'}</div>
                      {order.delivery_note && <div style={{ fontSize: 12, color: S.stone, fontStyle: 'italic', marginTop: 2 }}>&ldquo;{order.delivery_note}&rdquo;</div>}
                    </div>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: S.stone, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 3 }}>Tip</div>
                      <div style={{ fontSize: 13, color: S.forest }}>${(((order.tip_amount || 0)) / 100).toFixed(2)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: S.stone, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 3 }}>Status</div>
                      <div style={{ fontSize: 13, color: order.delivery_status && order.delivery_status !== 'awaiting_dispatch' ? S.sage : S.amber }}>
                        {order.delivery_status && order.delivery_status !== 'awaiting_dispatch' ? '✅ Dispatched' : '🟡 Awaiting dispatch'}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

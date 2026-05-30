'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

const S = {
  sage: '#3D6B4F', sageMid: '#6B9E7E', sageLight: '#EAF2ED',
  cream: '#FAFAF5', forest: '#1E2620', stone: '#6B7066',
  border: '#DDE8E0', white: '#FFFFFF', amber: '#C17F47',
  amberLight: '#FBF0E4', red: '#B94040', redLight: '#FDE8E8',
  blue: '#2B6CB0', blueLight: '#E8F0FD',
}

const MEAL_EMOJI: Record<string, string> = { breakfast: '🌅', lunch: '☀️', dinner: '🌙' }
const MEAL_ORDER: Record<string, number> = { breakfast: 0, lunch: 1, dinner: 2 }

type Filter = 'today' | 'tomorrow' | 'week' | 'all'

type Order = {
  id: string; status: string; delivery_status: string | null
  meal_type: string; delivery_date: string
  delivery_preference: string | null; delivery_note: string | null
  coordinator_name: string; restaurant_name: string; meal_name: string
  tip_amount: number | null; doordash_tracking_url: string | null
  doordash_delivery_id: string | null; kitchen_name: string; kitchen_address: string
}

// Date helpers
const toDateStr = (d: Date) => d.toISOString().split('T')[0]
const TODAY     = toDateStr(new Date())
const TOMORROW  = toDateStr(new Date(Date.now() + 86400000))
const IN7DAYS   = toDateStr(new Date(Date.now() + 7 * 86400000))

function sortByMealType(a: Order, b: Order) {
  const dateDiff = a.delivery_date.localeCompare(b.delivery_date)
  if (dateDiff !== 0) return dateDiff
  return (MEAL_ORDER[a.meal_type] ?? 3) - (MEAL_ORDER[b.meal_type] ?? 3)
}

function friendlyDate(dateStr: string): string {
  if (dateStr === TODAY)    return 'Today'
  if (dateStr === TOMORROW) return 'Tomorrow'
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  })
}

export default function AdminPage() {
  const supabase         = createClient()
  const [loading,        setLoading]       = useState(true)
  const [orders,         setOrders]        = useState<Order[]>([])
  const [dispatching,    setDispatching]   = useState<string | null>(null)
  const [cancelling,     setCancelling]    = useState<string | null>(null)
  const [msgs,           setMsgs]          = useState<Record<string, string>>({})
  const [adminSecret,    setAdminSecret]   = useState('')
  const [authed,         setAuthed]        = useState(false)
  const [authErr,        setAuthErr]       = useState('')
  const [filter,         setFilter]        = useState<Filter>('today')
  const [cancelReasons,  setCancelReasons] = useState<Record<string, string>>({})

  const loadOrders = useCallback(async () => {
    const { data } = await supabase
      .from('meal_proposals')
      .select(`
        id, status, delivery_status, meal_type, delivery_date,
        delivery_preference, delivery_note,
        coordinator_name, restaurant_name, meal_name,
        tip_amount, doordash_tracking_url, doordash_delivery_id,
        kitchens:kitchen_id(name, address)
      `)
      .eq('status', 'confirmed')
      .order('delivery_date', { ascending: true })
    setOrders((data || []).map((r: any) => ({
      ...r,
      kitchen_name:    r.kitchens?.name    || '',
      kitchen_address: r.kitchens?.address || '',
    })))
    setLoading(false)
  }, [])

  useEffect(() => {
    const saved = sessionStorage.getItem('yk_admin_secret')
    if (saved) { setAdminSecret(saved); setAuthed(true); loadOrders() }
    else setLoading(false)
  }, [])

  // ── Tab counts ────────────────────────────────────────────────────────────
  const needsDispatch = (o: Order) => !o.delivery_status || o.delivery_status === 'awaiting_dispatch'

  const todayOrders    = orders.filter(o => o.delivery_date === TODAY).sort(sortByMealType)
  const tomorrowOrders = orders.filter(o => o.delivery_date === TOMORROW).sort(sortByMealType)
  const weekOrders     = orders.filter(o => o.delivery_date > TOMORROW && o.delivery_date <= IN7DAYS).sort(sortByMealType)
  const allOrders      = [...orders].sort(sortByMealType)

  const tabCounts: Record<Filter, number> = {
    today:    todayOrders.length,
    tomorrow: tomorrowOrders.length,
    week:     weekOrders.length,
    all:      allOrders.length,
  }
  const urgentToday = todayOrders.filter(needsDispatch).length

  const visible = filter === 'today'    ? todayOrders
                : filter === 'tomorrow' ? tomorrowOrders
                : filter === 'week'     ? weekOrders
                : allOrders

  // ── Auth ──────────────────────────────────────────────────────────────────
  const handleAuth = async () => {
    setAuthErr('')
    const res = await fetch('/api/dispatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-secret': adminSecret },
      body: JSON.stringify({ proposal_id: 'auth-test' }),
    })
    if (res.status === 401) { setAuthErr('Wrong admin secret'); return }
    sessionStorage.setItem('yk_admin_secret', adminSecret)
    setAuthed(true); loadOrders()
  }

  // ── Dispatch ──────────────────────────────────────────────────────────────
  const handleDispatch = async (orderId: string) => {
    setDispatching(orderId); setMsgs(m => ({ ...m, [orderId]: '' }))
    try {
      const res  = await fetch('/api/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': adminSecret },
        body: JSON.stringify({ proposal_id: orderId }),
      })
      const data = await res.json()
      if (res.ok) {
        setMsgs(m => ({ ...m, [orderId]: `✅ Dispatched! ${data.orderNumber}${data.trackingUrl ? ' · ' + data.trackingUrl : ''}` }))
        await loadOrders()
      } else {
        setMsgs(m => ({ ...m, [orderId]: `❌ ${data.error}` }))
      }
    } catch (err: any) {
      setMsgs(m => ({ ...m, [orderId]: `❌ ${err.message}` }))
    }
    setDispatching(null)
  }

  // ── Cancel ────────────────────────────────────────────────────────────────
  const handleCancel = async (orderId: string) => {
    const reason = cancelReasons[orderId]?.trim() || 'Order cancelled'
    if (!confirm(`Cancel this order?\n\nReason: ${reason}\n\nThis will void the charge and SMS both parties.`)) return
    setCancelling(orderId); setMsgs(m => ({ ...m, [orderId]: '' }))
    try {
      const res  = await fetch('/api/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': adminSecret },
        body: JSON.stringify({ proposal_id: orderId, reason }),
      })
      const data = await res.json()
      if (res.ok) {
        const note = data.stripeResult === 'refunded' ? ' · Refund issued'
          : data.stripeResult === 'authorization_cancelled' ? ' · Card not charged' : ''
        setMsgs(m => ({ ...m, [orderId]: `✅ Cancelled${note}` }))
        await loadOrders()
      } else {
        setMsgs(m => ({ ...m, [orderId]: `❌ ${data.error}` }))
      }
    } catch (err: any) {
      setMsgs(m => ({ ...m, [orderId]: `❌ ${err.message}` }))
    }
    setCancelling(null)
  }

  // ── Auth screen ───────────────────────────────────────────────────────────
  if (!authed) return (
    <div style={{ minHeight: '100vh', background: S.forest, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Lora:wght@400;500;600&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />
      <div style={{ background: S.cream, borderRadius: 20, padding: 40, width: 340 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 4, color: S.sageMid, textTransform: 'uppercase', marginBottom: 4 }}>Your</div>
          <div style={{ fontFamily: "'Lora', serif", fontSize: 28, fontWeight: 500, color: S.forest }}>Kitchen</div>
          <div style={{ fontSize: 12, color: S.stone, marginTop: 6 }}>Admin · Dispatch Panel</div>
        </div>
        <input type="password" value={adminSecret}
          onChange={e => setAdminSecret(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAuth()}
          placeholder="Admin secret"
          style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: `1.5px solid ${S.border}`, fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: 'none', marginBottom: 12, background: S.white }} />
        {authErr && <p style={{ fontSize: 12, color: S.red, margin: '0 0 10px', textAlign: 'center' }}>{authErr}</p>}
        <button onClick={handleAuth}
          style={{ width: '100%', padding: 13, borderRadius: 10, border: 'none', background: S.forest, color: S.white, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
          Sign In
        </button>
      </div>
    </div>
  )

  // ── Main ──────────────────────────────────────────────────────────────────
  const TABS: { key: Filter; label: string; emoji: string }[] = [
    { key: 'today',    label: 'Today',     emoji: '🔴' },
    { key: 'tomorrow', label: 'Tomorrow',  emoji: '🟡' },
    { key: 'week',     label: 'This week', emoji: '📅' },
    { key: 'all',      label: 'All',       emoji: '✓'  },
  ]

  return (
    <div style={{ minHeight: '100vh', background: S.cream, fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Lora:wght@400;500;600&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />

      {/* Top bar */}
      <div style={{ background: S.forest, padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 500, letterSpacing: 4, color: S.sageMid, textTransform: 'uppercase' }}>Your</div>
          <div style={{ fontFamily: "'Lora', serif", fontSize: 20, fontWeight: 500, color: S.white, lineHeight: 1.1 }}>Kitchen · Admin</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {urgentToday > 0 && (
            <div style={{ background: S.red, color: S.white, borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 700 }}>
              🔴 {urgentToday} due today
            </div>
          )}
          <button onClick={() => loadOrders()}
            style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8, padding: '8px 14px', color: S.white, fontSize: 12, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
            Refresh
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ background: S.white, borderBottom: `1px solid ${S.border}`, padding: '0 24px', display: 'flex', gap: 0, overflowX: 'auto' }}>
        {TABS.map(tab => {
          const count     = tabCounts[tab.key]
          const isActive  = filter === tab.key
          const urgentCount = tab.key === 'today'
            ? todayOrders.filter(needsDispatch).length
            : tab.key === 'tomorrow'
            ? tomorrowOrders.filter(needsDispatch).length
            : 0
          return (
            <button key={tab.key} onClick={() => setFilter(tab.key)}
              style={{ padding: '14px 20px', background: 'none', border: 'none', borderBottom: `3px solid ${isActive ? S.sage : 'transparent'}`, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", color: isActive ? S.sage : S.stone, fontWeight: isActive ? 700 : 400, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, transition: 'color 0.15s' }}>
              {tab.label}
              {count > 0 && (
                <span style={{ background: urgentCount > 0 ? S.red : isActive ? S.sage : S.border, color: urgentCount > 0 || isActive ? S.white : S.stone, borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
                  {urgentCount > 0 ? `${urgentCount} urgent` : count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 20px' }}>

        {loading && <p style={{ color: S.stone, fontSize: 14, textAlign: 'center', padding: 40 }}>Loading orders…</p>}

        {!loading && visible.length === 0 && (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>
              {filter === 'today' ? '🎉' : filter === 'tomorrow' ? '😌' : '📭'}
            </div>
            <p style={{ fontFamily: "'Lora', serif", fontSize: 18, color: S.forest, margin: '0 0 8px' }}>
              {filter === 'today' ? 'Nothing due today' : filter === 'tomorrow' ? 'Nothing tomorrow' : 'No orders here'}
            </p>
            <p style={{ fontSize: 13, color: S.stone }}>
              {filter === 'today' ? 'Check back later or refresh.' : 'Switch tabs to see upcoming orders.'}
            </p>
          </div>
        )}

        {/* Group by date within "week" and "all" tabs */}
        {visible.length > 0 && (() => {
          // Group orders by date
          const dateGroups: Record<string, Order[]> = {}
          visible.forEach(o => {
            if (!dateGroups[o.delivery_date]) dateGroups[o.delivery_date] = []
            dateGroups[o.delivery_date].push(o)
          })
          const sortedDates = Object.keys(dateGroups).sort()

          return (
            <>
              {sortedDates.map(date => {
                const dateOrders    = dateGroups[date]
                const pendingInDate = dateOrders.filter(needsDispatch).length
                const isToday       = date === TODAY
                const isTomorrow    = date === TOMORROW

                return (
                  <div key={date} style={{ marginBottom: 28 }}>
                    {/* Date header — only show when multiple dates visible */}
                    {(filter === 'week' || filter === 'all') && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                        <div style={{ flex: 1, height: 0.5, background: S.border }} />
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: isToday ? S.red : isTomorrow ? S.amber : S.stone }}>
                            {friendlyDate(date)}
                          </span>
                          {pendingInDate > 0 && (
                            <span style={{ fontSize: 10, fontWeight: 700, background: isToday ? S.redLight : S.amberLight, color: isToday ? S.red : S.amber, borderRadius: 20, padding: '2px 8px' }}>
                              {pendingInDate} need dispatch
                            </span>
                          )}
                        </div>
                        <div style={{ flex: 1, height: 0.5, background: S.border }} />
                      </div>
                    )}

                    {dateOrders.map(order => {
                      const isAwaiting     = needsDispatch(order)
                      const isDispatching_ = dispatching === order.id
                      const isCancelling_  = cancelling  === order.id
                      const msg            = msgs[order.id]

                      return (
                        <div key={order.id} style={{ background: S.white, border: `2px solid ${isAwaiting ? S.red : S.border}`, borderRadius: 16, padding: 20, marginBottom: 12, opacity: isAwaiting ? 1 : 0.75 }}>

                          {/* Header */}
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                <span style={{ fontSize: 18 }}>{MEAL_EMOJI[order.meal_type] || '🍽'}</span>
                                <span style={{ fontFamily: "'Lora', serif", fontSize: 16, fontWeight: 600, color: S.forest }}>{order.meal_name}</span>
                              </div>
                              <div style={{ fontSize: 13, color: S.stone }}>
                                {order.restaurant_name}
                                {(filter === 'week' || filter === 'all') && (
                                  <span style={{ color: isAwaiting && order.delivery_date === TODAY ? S.red : S.stone }}>
                                    {' '}· {friendlyDate(order.delivery_date)}
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: 12, color: S.stone, marginTop: 2 }}>
                                from <strong style={{ color: S.forest }}>{order.coordinator_name}</strong>
                              </div>
                            </div>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '4px 12px', borderRadius: 20, background: isAwaiting ? S.redLight : S.sageLight, color: isAwaiting ? S.red : S.sage, flexShrink: 0 }}>
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
                              <div style={{ fontSize: 10, fontWeight: 700, color: S.stone, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 3 }}>Preference</div>
                              <div style={{ fontSize: 13, color: S.forest }}>
                                {order.delivery_preference === 'hand_to_recipient' ? '🤝 Hand to recipient' : '🚪 Leave at door'}
                              </div>
                              {order.delivery_note && <div style={{ fontSize: 12, color: S.stone, fontStyle: 'italic' }}>"{order.delivery_note}"</div>}
                            </div>
                            <div>
                              <div style={{ fontSize: 10, fontWeight: 700, color: S.stone, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 3 }}>Tip</div>
                              <div style={{ fontSize: 13, color: S.forest }}>${((order.tip_amount || 0) / 100).toFixed(2)}</div>
                            </div>
                            <div>
                              <div style={{ fontSize: 10, fontWeight: 700, color: S.stone, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 3 }}>Meal</div>
                              <div style={{ fontSize: 13, color: S.forest }}>{order.meal_type?.charAt(0).toUpperCase() + order.meal_type?.slice(1)}</div>
                            </div>
                          </div>

                          {/* Pre-dispatch checklist */}
                          {isAwaiting && (
                            <div style={{ background: S.amberLight, border: `1px solid ${S.amber}`, borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: S.amber, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Before you dispatch</div>
                              <div style={{ fontSize: 13, color: S.forest, display: 'flex', flexDirection: 'column', gap: 5 }}>
                                <div>☐ &nbsp;Order placed at <strong>{order.restaurant_name}</strong></div>
                                <div>☐ &nbsp;Name on order: <strong>{order.coordinator_name}</strong></div>
                                <div>☐ &nbsp;Address: <strong>{order.kitchen_address}</strong></div>
                                <div>☐ &nbsp;Preference: <strong>{order.delivery_preference === 'hand_to_recipient' ? 'Hand to recipient' : 'Leave at door — no knock'}</strong></div>
                              </div>
                            </div>
                          )}

                          {/* Tracking link */}
                          {order.doordash_tracking_url && (
                            <a href={order.doordash_tracking_url} target="_blank" rel="noopener noreferrer"
                              style={{ display: 'block', background: S.blueLight, color: S.blue, borderRadius: 9, padding: '10px 14px', fontSize: 13, fontWeight: 600, textDecoration: 'none', marginBottom: 10, textAlign: 'center' }}>
                              🚗 Track this order
                            </a>
                          )}

                          {/* Actions */}
                          {isAwaiting && (
                            <>
                              <button onClick={() => handleDispatch(order.id)} disabled={isDispatching_ || isCancelling_}
                                style={{ width: '100%', padding: 14, background: isDispatching_ ? S.border : S.forest, color: isDispatching_ ? S.stone : S.white, border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: isDispatching_ ? 'default' : 'pointer', fontFamily: "'DM Sans', sans-serif", transition: 'background 0.2s', marginBottom: 10 }}>
                                {isDispatching_ ? '⏳ Dispatching…' : '🚀 Dispatch to Shipday →'}
                              </button>

                              <div style={{ borderTop: `0.5px solid ${S.border}`, paddingTop: 12 }}>
                                <p style={{ fontSize: 11, fontWeight: 700, color: S.stone, letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 8px' }}>Cancel order</p>
                                <div style={{ display: 'flex', gap: 8 }}>
                                  <input
                                    value={cancelReasons[order.id] || ''}
                                    onChange={e => setCancelReasons(r => ({ ...r, [order.id]: e.target.value }))}
                                    placeholder="Reason (e.g. restaurant closed)"
                                    style={{ flex: 1, padding: '9px 12px', borderRadius: 9, border: `1.5px solid ${S.border}`, fontSize: 13, fontFamily: "'DM Sans', sans-serif", color: S.forest, outline: 'none' }}
                                  />
                                  <button onClick={() => handleCancel(order.id)} disabled={isDispatching_ || isCancelling_}
                                    style={{ padding: '9px 16px', borderRadius: 9, border: `1.5px solid ${S.red}`, background: isCancelling_ ? S.border : S.redLight, color: isCancelling_ ? S.stone : S.red, fontSize: 13, fontWeight: 600, cursor: isCancelling_ ? 'default' : 'pointer', fontFamily: "'DM Sans', sans-serif", flexShrink: 0 }}>
                                    {isCancelling_ ? '⏳' : '✕ Cancel'}
                                  </button>
                                </div>
                                <p style={{ fontSize: 11, color: S.stone, margin: '6px 0 0', fontWeight: 300 }}>
                                  Voids charge · re-opens calendar date · SMS both parties
                                </p>
                              </div>
                            </>
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
                )
              })}
            </>
          )
        })()}

      </div>
    </div>
  )
}

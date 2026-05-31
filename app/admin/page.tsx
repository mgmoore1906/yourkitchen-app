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
type AdminView = 'dispatch' | 'analytics'

type Order = {
  id: string; status: string; delivery_status: string | null
  meal_type: string; delivery_date: string
  delivery_preference: string | null; delivery_note: string | null
  coordinator_name: string; restaurant_name: string; meal_name: string
  tip_amount: number | null; doordash_tracking_url: string | null
  doordash_delivery_id: string | null; kitchen_name: string; kitchen_address: string
  restaurant_address?: string; restaurant_phone?: string
}

type AnalyticsData = { kitchens: any[]; proposals: any[]; profiles: any[] }

const toDateStr = (d: Date) => d.toISOString().split('T')[0]
const TODAY = toDateStr(new Date())
const TOMORROW = toDateStr(new Date(Date.now() + 86400000))
const IN7DAYS = toDateStr(new Date(Date.now() + 7 * 86400000))

function sortByMealType(a: Order, b: Order) {
  const dateDiff = a.delivery_date.localeCompare(b.delivery_date)
  if (dateDiff !== 0) return dateDiff
  return (MEAL_ORDER[a.meal_type] ?? 3) - (MEAL_ORDER[b.meal_type] ?? 3)
}

function friendlyDate(dateStr: string): string {
  if (dateStr === TODAY) return 'Today'
  if (dateStr === TOMORROW) return 'Tomorrow'
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function fmtMoney(cents: number) { return '$' + (cents / 100).toFixed(2) }

// ── Metric card ─────────────────────────────────────────────────────────────
function Metric({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{ background: S.white, border: `0.5px solid ${S.border}`, borderRadius: 14, padding: '16px 18px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: S.stone, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: "'Lora',serif", fontSize: 28, fontWeight: 600, color: color || S.forest, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: S.stone, fontWeight: 300, marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

// ── Card wrapper ──────────────────────────────────────────────────────────────
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: S.white, border: `0.5px solid ${S.border}`, borderRadius: 14, padding: '16px 18px' }}>
      <p style={{ fontSize: 10, fontWeight: 700, color: S.stone, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 14px' }}>{title}</p>
      {children}
    </div>
  )
}

// ── Bar row ─────────────────────────────────────────────────────────────────
function BarRow({ label, count, max, color, icon }: { label: string; count: number; max: number; color: string; icon?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
      {icon && <span style={{ fontSize: 14 }}>{icon}</span>}
      <span style={{ fontSize: 12, fontWeight: 600, color: S.forest, width: 80, flexShrink: 0, textTransform: 'capitalize' }}>{label}</span>
      <div style={{ flex: 1, height: 8, background: S.sageLight, borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', background: color, borderRadius: 4, width: max > 0 ? `${(count / max) * 100}%` : '0%' }} />
      </div>
      <span style={{ fontSize: 12, color: S.stone, width: 24, textAlign: 'right' }}>{count}</span>
    </div>
  )
}

// ── Analytics tab ─────────────────────────────────────────────────────────────
function AnalyticsTab() {
  const supabase = createClient()
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d')

  const loadData = useCallback(async () => {
    setLoading(true)
    const cutoff = range === '7d' ? new Date(Date.now() - 7 * 86400000).toISOString()
      : range === '30d' ? new Date(Date.now() - 30 * 86400000).toISOString()
      : range === '90d' ? new Date(Date.now() - 90 * 86400000).toISOString()
      : '2020-01-01T00:00:00Z'

    const [k, p, pr] = await Promise.all([
      supabase.from('kitchens').select('id,name,slug,tier,created_at,address,organizer_id,household_adults,household_children'),
      supabase.from('meal_proposals').select('id,status,delivery_status,meal_type,delivery_date,coordinator_name,restaurant_name,meal_name,tip_amount,stripe_amount,created_at,kitchen_id').gte('created_at', cutoff),
      supabase.from('profiles').select('id,full_name,created_at,tier,phone,sms_consent').gte('created_at', cutoff),
    ])
    setData({ kitchens: k.data || [], proposals: p.data || [], profiles: pr.data || [] })
    setLoading(false)
  }, [range])

  useEffect(() => { loadData() }, [loadData])

  const exportCSV = (rows: any[], filename: string) => {
    if (!rows.length) return
    const headers = Object.keys(rows[0])
    const csv = [headers.join(','), ...rows.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click()
  }

  const exportXLSX = (rows: any[], filename: string) => {
    if (!rows.length) return
    const headers = Object.keys(rows[0])
    let html = '<table><tr>' + headers.map(h => `<th>${h}</th>`).join('') + '</tr>'
    rows.forEach(r => { html += '<tr>' + headers.map(h => `<td>${r[h] ?? ''}</td>`).join('') + '</tr>' })
    html += '</table>'
    const blob = new Blob([html], { type: 'application/vnd.ms-excel' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename + '.xls'; a.click()
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: S.stone }}>Loading analytics…</div>
  if (!data) return null

  const proposals = data.proposals
  const confirmed = proposals.filter(p => ['confirmed', 'delivered'].includes(p.status))
  const delivered = proposals.filter(p => p.status === 'delivered')
  const cancelled = proposals.filter(p => ['cancelled', 'declined', 'expired'].includes(p.status))

  const gmv = confirmed.reduce((s, p) => s + (p.stripe_amount || 0), 0)
  const platformFee = Math.round(gmv * 0.03)
  const tipsTotal = confirmed.reduce((s, p) => s + (p.tip_amount || 0), 0)
  const driverFees = confirmed.length * 699

  const convRate = proposals.length ? Math.round((confirmed.length / proposals.length) * 100) : 0
  const cancelRate = proposals.length ? Math.round((cancelled.length / proposals.length) * 100) : 0

  const mealBreakdown = ['breakfast', 'lunch', 'dinner'].map(mt => ({ type: mt, count: confirmed.filter(p => p.meal_type === mt).length }))

  const restCounts: Record<string, number> = {}
  confirmed.forEach(p => { if (p.restaurant_name) restCounts[p.restaurant_name] = (restCounts[p.restaurant_name] || 0) + 1 })
  const topRests = Object.entries(restCounts).sort((a, b) => b[1] - a[1]).slice(0, 5)

  const suppCounts: Record<string, number> = {}
  confirmed.forEach(p => { if (p.coordinator_name) suppCounts[p.coordinator_name] = (suppCounts[p.coordinator_name] || 0) + 1 })
  const topSupps = Object.entries(suppCounts).sort((a, b) => b[1] - a[1]).slice(0, 5)

  const tierCounts: Record<string, number> = {}
  data.kitchens.forEach(k => { tierCounts[k.tier || 'free'] = (tierCounts[k.tier || 'free'] || 0) + 1 })

  const onboardingTimes = data.kitchens.filter(k => k.created_at).map(k => {
    const prof = data.profiles.find(p => p.id === k.organizer_id)
    if (!prof?.created_at) return null
    const mins = Math.round((new Date(k.created_at).getTime() - new Date(prof.created_at).getTime()) / 60000)
    return mins > 0 && mins < 120 ? mins : null
  }).filter(Boolean) as number[]
  const avgOnboarding = onboardingTimes.length ? Math.round(onboardingTimes.reduce((s, t) => s + t, 0) / onboardingTimes.length) : null

  const exportRows = proposals.map(p => ({
    id: p.id, status: p.status, delivery_status: p.delivery_status || '',
    meal_type: p.meal_type, delivery_date: p.delivery_date,
    restaurant: p.restaurant_name || '', meal: p.meal_name || '', supporter: p.coordinator_name || '',
    order_amount_cents: p.stripe_amount || 0, order_amount_dollars: ((p.stripe_amount || 0) / 100).toFixed(2),
    tip_cents: p.tip_amount || 0, tip_dollars: ((p.tip_amount || 0) / 100).toFixed(2),
    platform_fee_cents: Math.round((p.stripe_amount || 0) * 0.03),
    created_at: p.created_at, kitchen_id: p.kitchen_id || '',
  }))

  const kitchenExportRows = data.kitchens.map(k => ({
    id: k.id, name: k.name, slug: k.slug, tier: k.tier || 'free',
    address: k.address || '', household_adults: k.household_adults || 0, household_children: k.household_children || 0,
    created_at: k.created_at, total_orders: confirmed.filter(p => p.kitchen_id === k.id).length,
    total_gmv_cents: confirmed.filter(p => p.kitchen_id === k.id).reduce((s: number, p: any) => s + (p.stripe_amount || 0), 0),
  }))

  const rangeLabels: Record<string, string> = { '7d': 'Last 7 days', '30d': 'Last 30 days', '90d': 'Last 90 days', all: 'All time' }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 20px' }}>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h2 style={{ fontFamily: "'Lora',serif", fontSize: 20, fontWeight: 500, color: S.forest, margin: 0 }}>Analytics &amp; Investor Metrics</h2>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['7d', '30d', '90d', 'all'] as const).map(r => (
            <button key={r} onClick={() => setRange(r)}
              style={{ padding: '6px 14px', borderRadius: 20, border: `1.5px solid ${range === r ? S.sage : S.border}`, background: range === r ? S.sageLight : S.white, color: range === r ? S.sage : S.stone, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>
              {rangeLabels[r]}
            </button>
          ))}
        </div>
      </div>

      <p style={{ fontSize: 10, fontWeight: 700, color: S.stone, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 12px' }}>Revenue</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
        <Metric label="Gross Merchandise Value" value={fmtMoney(gmv)} sub={`${confirmed.length} confirmed orders`} color={S.forest} />
        <Metric label="Platform Fee Revenue (3%)" value={fmtMoney(platformFee)} sub="YourKitchen net" color={S.sage} />
        <Metric label="Tips Paid to Drivers" value={fmtMoney(tipsTotal)} sub="Passed through 100%" color={S.amber} />
        <Metric label="Est. Driver Fees" value={fmtMoney(driverFees)} sub={`~$6.99 × ${confirmed.length} orders`} color={S.stone} />
      </div>

      <p style={{ fontSize: 10, fontWeight: 700, color: S.stone, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 12px' }}>Orders</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
        <Metric label="Total Proposals" value={proposals.length} sub="All submitted" />
        <Metric label="Confirmed" value={confirmed.length} sub={`${convRate}% conversion`} color={S.sage} />
        <Metric label="Delivered" value={delivered.length} sub="Fully complete" />
        <Metric label="Cancelled / Declined" value={cancelled.length} sub={`${cancelRate}% cancel rate`} color={S.red} />
      </div>

      <p style={{ fontSize: 10, fontWeight: 700, color: S.stone, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 12px' }}>Users &amp; Kitchens</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
        <Metric label="Total Kitchens" value={data.kitchens.length} sub="Active recipients" />
        <Metric label="New Profiles" value={data.profiles.length} sub={`In ${rangeLabels[range].toLowerCase()}`} />
        <Metric label="SMS Consent Rate" value={data.profiles.length ? Math.round((data.profiles.filter(p => p.sms_consent).length / data.profiles.length) * 100) + '%' : '—'} sub="A2P compliance" />
        <Metric label="Avg Onboarding Time" value={avgOnboarding ? avgOnboarding + 'm' : '—'} sub="Profile → kitchen created" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <Card title="Kitchen Tiers">
          {Object.entries(tierCounts).map(([tier, count]) => (
            <BarRow key={tier} label={tier} count={count} max={data.kitchens.length}
              color={tier === 'founding' ? S.amber : tier === 'care' || tier === 'annual' ? S.sage : S.stone} />
          ))}
        </Card>
        <Card title="Meals by Type">
          {mealBreakdown.map(({ type, count }) => (
            <BarRow key={type} label={type} count={count} max={confirmed.length} icon={MEAL_EMOJI[type]}
              color={type === 'breakfast' ? '#E8834A' : type === 'lunch' ? '#4A8FA8' : S.sage} />
          ))}
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <Card title="Top Restaurants">
          {topRests.length === 0 ? <p style={{ fontSize: 13, color: S.stone }}>No data yet</p> : topRests.map(([name, count]) => (
            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: S.forest, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: S.sage, flexShrink: 0 }}>{count} orders</span>
            </div>
          ))}
        </Card>
        <Card title="Top Supporters">
          {topSupps.length === 0 ? <p style={{ fontSize: 13, color: S.stone }}>No data yet</p> : topSupps.map(([name, count]) => (
            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{ width: 30, height: 30, borderRadius: 9, background: S.sageLight, display: 'flex', alignItems: 'center', justifyContent: 'center', color: S.sage, fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                {name.charAt(0).toUpperCase()}
              </div>
              <span style={{ fontSize: 13, color: S.forest, flex: 1 }}>{name}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: S.amber, flexShrink: 0 }}>{count} 🧡</span>
            </div>
          ))}
        </Card>
      </div>

      <div style={{ background: S.white, border: `0.5px solid ${S.border}`, borderRadius: 14, padding: '16px 18px', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: S.stone, letterSpacing: '0.1em', textTransform: 'uppercase', margin: 0 }}>All Orders ({proposals.length})</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => exportCSV(exportRows, `yourkitchen-orders-${range}-${TODAY}.csv`)}
              style={{ padding: '6px 14px', borderRadius: 8, border: `1.5px solid ${S.border}`, background: S.white, color: S.forest, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>↓ CSV</button>
            <button onClick={() => exportXLSX(exportRows, `yourkitchen-orders-${range}-${TODAY}`)}
              style={{ padding: '6px 14px', borderRadius: 8, border: `1.5px solid ${S.sage}`, background: S.sageLight, color: S.sage, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>↓ Excel</button>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${S.border}` }}>
                {['Date', 'Meal', 'Restaurant', 'Supporter', 'Amount', 'Tip', 'Status'].map(h => (
                  <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: S.stone, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {proposals.slice(0, 50).map((p, i) => (
                <tr key={p.id} style={{ borderBottom: `0.5px solid ${S.border}`, background: i % 2 === 0 ? S.white : S.cream }}>
                  <td style={{ padding: '8px 10px', color: S.stone, whiteSpace: 'nowrap' }}>{p.delivery_date || '—'}</td>
                  <td style={{ padding: '8px 10px' }}>{MEAL_EMOJI[p.meal_type] || ''} {p.meal_name || '—'}</td>
                  <td style={{ padding: '8px 10px', color: S.forest }}>{p.restaurant_name || '—'}</td>
                  <td style={{ padding: '8px 10px', color: S.forest }}>{p.coordinator_name || '—'}</td>
                  <td style={{ padding: '8px 10px', color: S.forest, whiteSpace: 'nowrap' }}>{p.stripe_amount ? fmtMoney(p.stripe_amount) : '—'}</td>
                  <td style={{ padding: '8px 10px', color: S.amber, whiteSpace: 'nowrap' }}>{p.tip_amount ? fmtMoney(p.tip_amount) : '—'}</td>
                  <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: p.status === 'confirmed' || p.status === 'delivered' ? S.sageLight : p.status === 'pending' ? S.amberLight : S.redLight, color: p.status === 'confirmed' || p.status === 'delivered' ? S.sage : p.status === 'pending' ? S.amber : S.red }}>{p.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {proposals.length > 50 && <p style={{ fontSize: 12, color: S.stone, margin: '10px 0 0', textAlign: 'center' }}>Showing 50 of {proposals.length} — export for full data</p>}
        </div>
      </div>

      <div style={{ background: S.white, border: `0.5px solid ${S.border}`, borderRadius: 14, padding: '16px 18px', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: S.stone, letterSpacing: '0.1em', textTransform: 'uppercase', margin: 0 }}>Kitchens ({data.kitchens.length})</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => exportCSV(kitchenExportRows, `yourkitchen-kitchens-${TODAY}.csv`)}
              style={{ padding: '6px 14px', borderRadius: 8, border: `1.5px solid ${S.border}`, background: S.white, color: S.forest, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>↓ CSV</button>
            <button onClick={() => exportXLSX(kitchenExportRows, `yourkitchen-kitchens-${TODAY}`)}
              style={{ padding: '6px 14px', borderRadius: 8, border: `1.5px solid ${S.sage}`, background: S.sageLight, color: S.sage, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>↓ Excel</button>
          </div>
        </div>
      </div>

      <p style={{ fontSize: 11, color: S.stone, fontWeight: 300, textAlign: 'center', marginTop: 16, lineHeight: 1.6 }}>
        Data pulled live from Supabase. GMV, fees, and tips are in cents — exports convert to dollars. Avg onboarding time = profile created_at → kitchen created_at.
      </p>
    </div>
  )
}

// ── Dispatch tab ──────────────────────────────────────────────────────────────
function DispatchTab(props: any) {
  const { orders, loading, filter, setFilter, dispatching, cancelling, msgs, cancelReasons, setCancelReasons, handleDispatch, handleCancel } = props
  const needsDispatch = (o: Order) => !o.delivery_status || o.delivery_status === 'awaiting_dispatch'

  const todayOrders = orders.filter((o: Order) => o.delivery_date === TODAY).sort(sortByMealType)
  const tomorrowOrders = orders.filter((o: Order) => o.delivery_date === TOMORROW).sort(sortByMealType)
  const weekOrders = orders.filter((o: Order) => o.delivery_date > TOMORROW && o.delivery_date <= IN7DAYS).sort(sortByMealType)
  const allOrders = [...orders].sort(sortByMealType)

  const tabCounts: Record<Filter, number> = {
    today: todayOrders.length, tomorrow: tomorrowOrders.length, week: weekOrders.length, all: allOrders.length,
  }

  const visible = filter === 'today' ? todayOrders : filter === 'tomorrow' ? tomorrowOrders : filter === 'week' ? weekOrders : allOrders

  const TABS: { key: Filter; label: string }[] = [
    { key: 'today', label: 'Today' }, { key: 'tomorrow', label: 'Tomorrow' },
    { key: 'week', label: 'This week' }, { key: 'all', label: 'All' },
  ]

  const dateGroups: Record<string, Order[]> = {}
  visible.forEach((o: Order) => { if (!dateGroups[o.delivery_date]) dateGroups[o.delivery_date] = []; dateGroups[o.delivery_date].push(o) })
  const sortedDates = Object.keys(dateGroups).sort()

  return (
    <>
      <div style={{ background: S.white, borderBottom: `1px solid ${S.border}`, padding: '0 24px', display: 'flex', gap: 0, overflowX: 'auto' }}>
        {TABS.map(tab => {
          const count = tabCounts[tab.key]
          const isActive = filter === tab.key
          const urgentCount = tab.key === 'today' ? todayOrders.filter(needsDispatch).length : tab.key === 'tomorrow' ? tomorrowOrders.filter(needsDispatch).length : 0
          return (
            <button key={tab.key} onClick={() => setFilter(tab.key)}
              style={{ padding: '14px 20px', background: 'none', border: 'none', borderBottom: `3px solid ${isActive ? S.sage : 'transparent'}`, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", color: isActive ? S.sage : S.stone, fontWeight: isActive ? 700 : 400, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
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
            <div style={{ fontSize: 40, marginBottom: 12 }}>{filter === 'today' ? '🎉' : filter === 'tomorrow' ? '😌' : '📭'}</div>
            <p style={{ fontFamily: "'Lora',serif", fontSize: 18, color: S.forest, margin: '0 0 8px' }}>
              {filter === 'today' ? 'Nothing due today' : filter === 'tomorrow' ? 'Nothing tomorrow' : 'No orders here'}
            </p>
            <p style={{ fontSize: 13, color: S.stone }}>{filter === 'today' ? 'Check back later or refresh.' : 'Switch tabs to see upcoming orders.'}</p>
          </div>
        )}

        {sortedDates.map(date => {
          const dateOrders = dateGroups[date]
          const pendingInDate = dateOrders.filter(needsDispatch).length
          const isToday = date === TODAY
          const isTomorrow = date === TOMORROW
          return (
            <div key={date} style={{ marginBottom: 28 }}>
              {(filter === 'week' || filter === 'all') && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <div style={{ flex: 1, height: 0.5, background: S.border }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: isToday ? S.red : isTomorrow ? S.amber : S.stone }}>{friendlyDate(date)}</span>
                    {pendingInDate > 0 && <span style={{ fontSize: 10, fontWeight: 700, background: isToday ? S.redLight : S.amberLight, color: isToday ? S.red : S.amber, borderRadius: 20, padding: '2px 8px' }}>{pendingInDate} need dispatch</span>}
                  </div>
                  <div style={{ flex: 1, height: 0.5, background: S.border }} />
                </div>
              )}
              {dateOrders.map((order: Order) => {
                const isAwaiting = needsDispatch(order)
                const isDispatching_ = dispatching === order.id
                const isCancelling_ = cancelling === order.id
                const msg = msgs[order.id]
                return (
                  <div key={order.id} style={{ background: S.white, border: `2px solid ${isAwaiting ? S.red : S.border}`, borderRadius: 16, padding: 20, marginBottom: 12, opacity: isAwaiting ? 1 : 0.75 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 18 }}>{MEAL_EMOJI[order.meal_type] || '🍽'}</span>
                          <span style={{ fontFamily: "'Lora',serif", fontSize: 16, fontWeight: 600, color: S.forest }}>{order.meal_name}</span>
                        </div>
                        <div style={{ fontSize: 13, color: S.stone }}>
                          {order.restaurant_name}
                          {(filter === 'week' || filter === 'all') && <span style={{ color: isAwaiting && order.delivery_date === TODAY ? S.red : S.stone }}> · {friendlyDate(order.delivery_date)}</span>}
                        </div>
                        {order.restaurant_address && <div style={{ fontSize: 12, color: S.stone, marginTop: 1 }}>📍 {order.restaurant_address}</div>}
                        <div style={{ fontSize: 12, color: S.stone, marginTop: 2 }}>from <strong style={{ color: S.forest }}>{order.coordinator_name}</strong></div>
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '4px 12px', borderRadius: 20, background: isAwaiting ? S.redLight : S.sageLight, color: isAwaiting ? S.red : S.sage, flexShrink: 0 }}>
                        {isAwaiting ? '🔴 Needs dispatch' : '✅ Dispatched'}
                      </span>
                    </div>

                    <div style={{ background: S.cream, borderRadius: 10, padding: '12px 14px', marginBottom: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: S.stone, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 3 }}>Delivery address</div>
                        <div style={{ fontSize: 13, color: S.forest }}>{order.kitchen_name}</div>
                        <div style={{ fontSize: 12, color: S.stone }}>{order.kitchen_address}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: S.stone, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 3 }}>Preference</div>
                        <div style={{ fontSize: 13, color: S.forest }}>{order.delivery_preference === 'hand_to_recipient' ? '🤝 Hand to recipient' : '🚪 Leave at door'}</div>
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

                    {isAwaiting && (
                      <div style={{ background: S.amberLight, border: `1px solid ${S.amber}`, borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: S.amber, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Before you dispatch</div>
                        <div style={{ fontSize: 13, color: S.forest, display: 'flex', flexDirection: 'column', gap: 5 }}>
                          <div>☐ &nbsp;Order placed at <strong>{order.restaurant_name}</strong></div>
                          {order.restaurant_address && <div style={{ paddingLeft: 22, fontSize: 12, color: S.stone, marginTop: -2 }}>📍 {order.restaurant_address}{order.restaurant_phone ? ` · ${order.restaurant_phone}` : ''}</div>}
                          <div>☐ &nbsp;Name on order: <strong>{order.coordinator_name}</strong></div>
                          <div>☐ &nbsp;Deliver to: <strong>{order.kitchen_address}</strong></div>
                          <div>☐ &nbsp;Preference: <strong>{order.delivery_preference === 'hand_to_recipient' ? 'Hand to recipient' : 'Leave at door — no knock'}</strong></div>
                        </div>
                      </div>
                    )}

                    {order.doordash_tracking_url && (
                      <a href={order.doordash_tracking_url} target="_blank" rel="noopener noreferrer"
                        style={{ display: 'block', background: S.blueLight, color: S.blue, borderRadius: 9, padding: '10px 14px', fontSize: 13, fontWeight: 600, textDecoration: 'none', marginBottom: 10, textAlign: 'center' }}>
                        🚗 Track this order
                      </a>
                    )}

                    {isAwaiting && (
                      <>
                        <button onClick={() => handleDispatch(order.id)} disabled={isDispatching_ || isCancelling_}
                          style={{ width: '100%', padding: 14, background: isDispatching_ ? S.border : S.forest, color: isDispatching_ ? S.stone : S.white, border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: isDispatching_ ? 'default' : 'pointer', fontFamily: "'DM Sans',sans-serif", marginBottom: 10 }}>
                          {isDispatching_ ? '⏳ Dispatching…' : '🚀 Dispatch to Shipday →'}
                        </button>
                        <div style={{ borderTop: `0.5px solid ${S.border}`, paddingTop: 12 }}>
                          <p style={{ fontSize: 11, fontWeight: 700, color: S.stone, letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 8px' }}>Cancel order</p>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <input value={cancelReasons[order.id] || ''} onChange={(e: any) => setCancelReasons((r: any) => ({ ...r, [order.id]: e.target.value }))} placeholder="Reason (e.g. restaurant closed)"
                              style={{ flex: 1, padding: '9px 12px', borderRadius: 9, border: `1.5px solid ${S.border}`, fontSize: 13, fontFamily: "'DM Sans',sans-serif", color: S.forest, outline: 'none' }} />
                            <button onClick={() => handleCancel(order.id)} disabled={isDispatching_ || isCancelling_}
                              style={{ padding: '9px 16px', borderRadius: 9, border: `1.5px solid ${S.red}`, background: isCancelling_ ? S.border : S.redLight, color: isCancelling_ ? S.stone : S.red, fontSize: 13, fontWeight: 600, cursor: isCancelling_ ? 'default' : 'pointer', fontFamily: "'DM Sans',sans-serif", flexShrink: 0 }}>
                              {isCancelling_ ? '⏳' : '✕ Cancel'}
                            </button>
                          </div>
                          <p style={{ fontSize: 11, color: S.stone, margin: '6px 0 0', fontWeight: 300 }}>Voids charge · re-opens calendar date · SMS both parties</p>
                        </div>
                      </>
                    )}

                    {msg && <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 9, background: msg.startsWith('✅') ? S.sageLight : S.redLight, color: msg.startsWith('✅') ? S.sage : S.red, fontSize: 13, fontWeight: 500 }}>{msg}</div>}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </>
  )
}

// ── Main admin page ───────────────────────────────────────────────────────────
export default function AdminPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState<Order[]>([])
  const [dispatching, setDispatching] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState<string | null>(null)
  const [msgs, setMsgs] = useState<Record<string, string>>({})
  const [adminSecret, setAdminSecret] = useState('')
  const [authed, setAuthed] = useState(false)
  const [authErr, setAuthErr] = useState('')
  const [filter, setFilter] = useState<Filter>('today')
  const [cancelReasons, setCancelReasons] = useState<Record<string, string>>({})
  const [view, setView] = useState<AdminView>('dispatch')

  const loadOrders = useCallback(async (secret?: string) => {
    const key = secret || sessionStorage.getItem('yk_admin_secret') || ''
    try {
      const res = await fetch('/api/admin-orders', { headers: { 'x-admin-secret': key } })
      const json = await res.json()
      setOrders(json.orders || [])
    } catch {
      setOrders([])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    const saved = sessionStorage.getItem('yk_admin_secret')
    if (saved) { setAdminSecret(saved); setAuthed(true); loadOrders(saved) }
    else setLoading(false)
  }, [])

  const needsDispatch = (o: Order) => !o.delivery_status || o.delivery_status === 'awaiting_dispatch'
  const urgentToday = orders.filter(o => o.delivery_date === TODAY && needsDispatch(o)).length

  const handleAuth = async () => {
    setAuthErr('')
    const res = await fetch('/api/dispatch', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-secret': adminSecret }, body: JSON.stringify({ proposal_id: 'auth-test' }) })
    if (res.status === 401) { setAuthErr('Wrong admin secret'); return }
    sessionStorage.setItem('yk_admin_secret', adminSecret)
    setAuthed(true); loadOrders(adminSecret)
  }

  const handleDispatch = async (orderId: string) => {
    setDispatching(orderId); setMsgs(m => ({ ...m, [orderId]: '' }))
    try {
      const res = await fetch('/api/dispatch', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-secret': adminSecret }, body: JSON.stringify({ proposal_id: orderId }) })
      const data = await res.json()
      if (res.ok) { setMsgs(m => ({ ...m, [orderId]: `✅ Dispatched! ${data.orderNumber}${data.trackingUrl ? ' · ' + data.trackingUrl : ''}` })); await loadOrders() }
      else { setMsgs(m => ({ ...m, [orderId]: `❌ ${data.error}` })) }
    } catch (err: any) { setMsgs(m => ({ ...m, [orderId]: `❌ ${err.message}` })) }
    setDispatching(null)
  }

  const handleCancel = async (orderId: string) => {
    const reason = cancelReasons[orderId]?.trim() || 'Order cancelled'
    if (!confirm(`Cancel this order?\n\nReason: ${reason}\n\nThis will void the charge and SMS both parties.`)) return
    setCancelling(orderId); setMsgs(m => ({ ...m, [orderId]: '' }))
    try {
      const res = await fetch('/api/cancel', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-secret': adminSecret }, body: JSON.stringify({ proposal_id: orderId, reason }) })
      const data = await res.json()
      if (res.ok) {
        const note = data.stripeResult === 'refunded' ? ' · Refund issued' : data.stripeResult === 'authorization_cancelled' ? ' · Card not charged' : ''
        setMsgs(m => ({ ...m, [orderId]: `✅ Cancelled${note}` })); await loadOrders()
      } else { setMsgs(m => ({ ...m, [orderId]: `❌ ${data.error}` })) }
    } catch (err: any) { setMsgs(m => ({ ...m, [orderId]: `❌ ${err.message}` })) }
    setCancelling(null)
  }

  if (!authed) return (
    <div style={{ minHeight: '100vh', background: S.forest, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans',sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Lora:wght@400;500;600&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />
      <div style={{ background: S.cream, borderRadius: 20, padding: 40, width: 340 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 4, color: S.sageMid, textTransform: 'uppercase', marginBottom: 4 }}>Your</div>
          <div style={{ fontFamily: "'Lora',serif", fontSize: 28, fontWeight: 500, color: S.forest }}>Kitchen</div>
          <div style={{ fontSize: 12, color: S.stone, marginTop: 6 }}>Admin · Dispatch + Analytics</div>
        </div>
        <input type="password" value={adminSecret} onChange={e => setAdminSecret(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAuth()} placeholder="Admin secret"
          style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: `1.5px solid ${S.border}`, fontSize: 14, fontFamily: "'DM Sans',sans-serif", outline: 'none', marginBottom: 12, background: S.white }} />
        {authErr && <p style={{ fontSize: 12, color: S.red, margin: '0 0 10px', textAlign: 'center' }}>{authErr}</p>}
        <button onClick={handleAuth} style={{ width: '100%', padding: 13, borderRadius: 10, border: 'none', background: S.forest, color: S.white, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>Sign In</button>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: S.cream, fontFamily: "'DM Sans',sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Lora:wght@400;500;600&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />

      <div style={{ background: S.forest, padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 500, letterSpacing: 4, color: S.sageMid, textTransform: 'uppercase' }}>Your</div>
          <div style={{ fontFamily: "'Lora',serif", fontSize: 20, fontWeight: 500, color: S.white, lineHeight: 1.1 }}>Kitchen · Admin</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {urgentToday > 0 && <div style={{ background: S.red, color: S.white, borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 700 }}>🔴 {urgentToday} due today</div>}
          <button onClick={() => loadOrders()} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8, padding: '8px 14px', color: S.white, fontSize: 12, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>Refresh</button>
        </div>
      </div>

      <div style={{ background: S.white, borderBottom: `1px solid ${S.border}`, padding: '0 24px', display: 'flex', gap: 0 }}>
        {[{ key: 'dispatch', label: '🚀 Dispatch' }, { key: 'analytics', label: '📊 Analytics' }].map(({ key, label }) => (
          <button key={key} onClick={() => setView(key as AdminView)}
            style={{ padding: '14px 24px', background: 'none', border: 'none', borderBottom: `3px solid ${view === key ? S.sage : 'transparent'}`, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", color: view === key ? S.sage : S.stone, fontWeight: view === key ? 700 : 400, fontSize: 14 }}>
            {label}
          </button>
        ))}
      </div>

      {view === 'dispatch' && (
        <DispatchTab orders={orders} loading={loading} filter={filter} setFilter={setFilter} dispatching={dispatching} cancelling={cancelling} msgs={msgs} cancelReasons={cancelReasons} setCancelReasons={setCancelReasons} handleDispatch={handleDispatch} handleCancel={handleCancel} />
      )}
      {view === 'analytics' && <AnalyticsTab />}
    </div>
  )
}

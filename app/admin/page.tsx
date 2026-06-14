'use client'
import { useState, useEffect, useCallback, Fragment } from 'react'
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
  meal_type: string; delivery_date: string; delivery_time: string | null
  delivery_preference: string | null; delivery_note: string | null
  coordinator_name: string; restaurant_name: string; meal_name: string
  tip_amount: number | null; doordash_tracking_url: string | null
  doordash_delivery_id: string | null; kitchen_name: string; kitchen_address: string
  restaurant_address?: string; restaurant_phone?: string; is_pickup?: boolean
  meal_items?: any[]; stripe_amount?: number | null
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
  const d = new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  if (dateStr === TODAY) return `Today · ${d}`
  if (dateStr === TOMORROW) return `Tomorrow · ${d}`
  return d
}

const DEFAULT_TIME: Record<string, string> = { breakfast: '08:30', lunch: '12:30', dinner: '18:30' }
function prettyTime(t: string | null | undefined, mealType: string): string {
  const raw = (t && String(t).trim()) ? String(t).split('-')[0].trim() : (DEFAULT_TIME[mealType] || '18:30')
  const [hStr, m] = raw.split(':')
  let h = parseInt(hStr, 10)
  if (isNaN(h)) return 'soon'
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12; if (h === 0) h = 12
  return `${h}:${m || '00'} ${ampm}`
}
function zipOf(addr: string | null | undefined): string {
  const m = String(addr || '').match(/\b(\d{5})(?:-\d{4})?\b/)
  return m ? m[1] : ''
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
function Card({ title, children, collapsible }: { title: string; children: React.ReactNode; collapsible?: boolean }) {
  const [open, setOpen] = useState(true)
  const tStyle = { fontSize: 10, fontWeight: 700 as const, color: S.stone, letterSpacing: '0.1em', textTransform: 'uppercase' as const, margin: 0 }
  return (
    <div style={{ background: S.white, border: `0.5px solid ${S.border}`, borderRadius: 14, padding: '16px 18px' }}>
      {collapsible ? (
        <button onClick={() => setOpen(o => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', padding: 0, cursor: 'pointer', marginBottom: open ? 14 : 0 }}>
          <p style={tStyle}>{title}</p>
          <span style={{ color: S.stone, fontSize: 11 }}>{open ? '▾' : '▸'}</span>
        </button>
      ) : (
        <p style={{ ...tStyle, marginBottom: 14 }}>{title}</p>
      )}
      {(!collapsible || open) && children}
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
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d')
  const [secOpen, setSecOpen] = useState<Record<string, boolean>>({ orders: true, kitchens: true, shipday: true })
  const [openOrder, setOpenOrder] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const key = sessionStorage.getItem('yk_admin_secret') || ''
      const res = await fetch(`/api/admin-analytics?range=${range}`, { headers: { 'x-admin-secret': key } })
      const json = await res.json()
      setData({ kitchens: json.kitchens || [], proposals: json.proposals || [], profiles: json.profiles || [] })
    } catch {
      setData({ kitchens: [], proposals: [], profiles: [] })
    }
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
  const cancelled = proposals.filter(p => ['cancelled', 'declined'].includes(p.status))
  const expired = proposals.filter(p => p.status === 'expired')
  const purchased = proposals.filter(p => !!p.payment_intent_id)

  const gmv = confirmed.reduce((s, p) => s + (p.stripe_amount || 0), 0)
  // Service-fee revenue estimate. Fee model = 5% of (meal+courier+tip) + $0.99,
  // charged on top, so it's ~4.7% of the final total + ~$0.94 per order. This is
  // an estimate; exact per-order margin needs the fee stored as its own column.
  const platformFee = confirmed.reduce((s, p) => s + (p.stripe_amount ? Math.round((p.stripe_amount || 0) * 0.0472 + 94) : 0), 0)
  const tipsTotal = confirmed.reduce((s, p) => s + (p.tip_amount || 0), 0)
  const driverFees = confirmed.length * 649

  const convRate = proposals.length ? Math.round((confirmed.length / proposals.length) * 100) : 0
  const cancelRate = purchased.length ? Math.round((cancelled.length / purchased.length) * 100) : 0

  const mealBreakdown = ['breakfast', 'lunch', 'dinner'].map(mt => ({ type: mt, count: confirmed.filter(p => p.meal_type === mt).length }))

  const restCounts: Record<string, number> = {}
  confirmed.forEach(p => { if (p.restaurant_name) restCounts[p.restaurant_name] = (restCounts[p.restaurant_name] || 0) + 1 })
  const topRests = Object.entries(restCounts).sort((a, b) => b[1] - a[1]).slice(0, 5)
  const dispatchedCt = proposals.filter((p: any) => p.delivery_status === 'dispatched').length
  const deliveredCt = proposals.filter((p: any) => p.doordash_status === 'delivered' || p.status === 'delivered').length
  const failedCt = proposals.filter((p: any) => p.doordash_status === 'cancelled' || p.status === 'delivery_failed').length
  const inTransitCt = proposals.filter((p: any) => p.delivery_status === 'dispatched' && p.doordash_status !== 'delivered' && p.doordash_status !== 'cancelled' && p.status !== 'delivered').length
  const successRate = (deliveredCt + failedCt) ? Math.round((deliveredCt / (deliveredCt + failedCt)) * 100) : 0
  const tipRows = purchased.filter((p: any) => p.tip_amount)
  const totalTips = tipRows.reduce((acc: number, p: any) => acc + (p.tip_amount || 0), 0)
  const avgTip = tipRows.length ? totalTips / tipRows.length : 0
  const ddCounts: Record<string, number> = {}
  proposals.forEach((p: any) => { if (p.doordash_status) ddCounts[p.doordash_status] = (ddCounts[p.doordash_status] || 0) + 1 })
  const ddRows = Object.entries(ddCounts).sort((a, b) => b[1] - a[1])
  const ddMax = Math.max(1, ...ddRows.map(r => r[1]))

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

  const exportRows = purchased.map(p => ({
    id: p.id, status: p.status, delivery_status: p.delivery_status || '',
    meal_type: p.meal_type, delivery_date: p.delivery_date,
    restaurant: p.restaurant_name || '', meal: p.meal_name || '', supporter: p.coordinator_name || '',
    order_amount_cents: p.stripe_amount || 0, order_amount_dollars: ((p.stripe_amount || 0) / 100).toFixed(2),
    tip_cents: p.tip_amount || 0, tip_dollars: ((p.tip_amount || 0) / 100).toFixed(2),
    service_fee_cents: p.stripe_amount ? Math.round((p.stripe_amount || 0) * 0.0472 + 94) : 0,
    proposed_at: p.proposed_at, kitchen_id: p.kitchen_id || '',
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
        <Metric label="Service Fee Revenue" value={fmtMoney(platformFee)} sub="YourKitchen net (est.)" color={S.sage} />
        <Metric label="Tips Paid to Drivers" value={fmtMoney(tipsTotal)} sub="Passed through 100%" color={S.amber} />
        <Metric label="Est. Driver Fees" value={fmtMoney(driverFees)} sub={`~$6.49 × ${confirmed.length} orders`} color={S.stone} />
      </div>

      <p style={{ fontSize: 10, fontWeight: 700, color: S.stone, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 12px' }}>Orders</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
        <Metric label="Total Proposals" value={proposals.length} sub="All submitted" />
        <Metric label="Confirmed" value={confirmed.length} sub={`${convRate}% conversion`} color={S.sage} />
        <Metric label="Delivered" value={delivered.length} sub="Fully complete" />
        <Metric label="Cancelled / Declined" value={cancelled.length} sub={`${cancelRate}% cancel rate`} color={S.red} />
        <Metric label="Expired (unpaid)" value={expired.length} sub="never purchased" color={S.stone} />
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
        <Card title="Top Restaurants" collapsible>
          {topRests.length === 0 ? <p style={{ fontSize: 13, color: S.stone }}>No data yet</p> : topRests.map(([name, count]) => (
            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: S.forest, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: S.sage, flexShrink: 0 }}>{count} orders</span>
            </div>
          ))}
        </Card>
        <Card title="Top Supporters" collapsible>
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
        <button onClick={() => setSecOpen(s => ({ ...s, shipday: !s.shipday }))} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', padding: 0, cursor: 'pointer', marginBottom: secOpen.shipday ? 14 : 0 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: S.stone, letterSpacing: '0.1em', textTransform: 'uppercase', margin: 0 }}>Delivery &amp; Dispatch · Shipday</p>
          <span style={{ color: S.stone, fontSize: 11 }}>{secOpen.shipday ? '▾' : '▸'}</span>
        </button>
        {secOpen.shipday && (<>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 12 }}>
            <Metric label="Dispatched" value={dispatchedCt} sub="sent to courier" />
            <Metric label="Delivered" value={deliveredCt} sub={`${successRate}% success`} />
            <Metric label="In transit" value={inTransitCt} sub="en route now" color={S.amber} />
            <Metric label="Failed / cancelled" value={failedCt} sub="courier issues" color={failedCt ? S.red : S.stone} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12, marginBottom: ddRows.length ? 16 : 4 }}>
            <Metric label="Driver tips (passed through)" value={fmtMoney(totalTips)} sub="100% to drivers" color={S.amber} />
            <Metric label="Avg tip / delivery" value={avgTip ? fmtMoney(avgTip) : '—'} sub={`${tipRows.length} tipped`} />
          </div>
          {ddRows.length > 0 && (
            <>
              <p style={{ fontSize: 10, fontWeight: 700, color: S.stone, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '4px 0 10px' }}>Courier status breakdown</p>
              {ddRows.map(([st, ct]) => (
                <BarRow key={st} label={st.replace(/_/g, ' ')} count={ct} max={ddMax} color={st === 'delivered' ? S.sage : st === 'cancelled' ? S.red : S.stone} />
              ))}
            </>
          )}
          <p style={{ fontSize: 11, color: S.stone, fontWeight: 300, margin: '12px 0 0', lineHeight: 1.5 }}>Driver tips are tracked per order (100% pass-through). Per-order courier cost and door-to-door times aren&rsquo;t captured yet &mdash; your weekly Shipday statement is the source of truth for actual DoorDash/Uber charges. I can add capture so those populate here going forward.</p>
        </>)}
      </div>

      <div style={{ background: S.white, border: `0.5px solid ${S.border}`, borderRadius: 14, padding: '16px 18px', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <button onClick={() => setSecOpen(s => ({ ...s, orders: !s.orders }))} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}><span style={{ color: S.stone, fontSize: 11 }}>{secOpen.orders ? '▾' : '▸'}</span><p style={{ fontSize: 10, fontWeight: 700, color: S.stone, letterSpacing: '0.1em', textTransform: 'uppercase', margin: 0 }}>All Orders ({purchased.length})</p></button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => exportCSV(exportRows, `yourkitchen-orders-${range}-${TODAY}.csv`)}
              style={{ padding: '6px 14px', borderRadius: 8, border: `1.5px solid ${S.border}`, background: S.white, color: S.forest, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>↓ CSV</button>
            <button onClick={() => exportXLSX(exportRows, `yourkitchen-orders-${range}-${TODAY}`)}
              style={{ padding: '6px 14px', borderRadius: 8, border: `1.5px solid ${S.sage}`, background: S.sageLight, color: S.sage, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>↓ Excel</button>
          </div>
        </div>
        <div style={{ display: secOpen.orders ? 'block' : 'none', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${S.border}` }}>
                {['Date', 'Meal', 'Restaurant', 'Supporter', 'Amount', 'Tip', 'Status'].map(h => (
                  <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: S.stone, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {purchased.slice(0, 50).map((p, i) => {
                const it: any[] = Array.isArray((p as any).meal_items) ? (p as any).meal_items : []
                const foodCents = it.reduce((s: number, m: any) => s + Math.round((m.price || 0) * 100) * (m.qty || 1), 0)
                const tipC = (p as any).tip_amount || 0
                const totalC = (p as any).stripe_amount || 0
                const feesC = totalC - foodCents - tipC
                const underpaid = totalC > 0 && totalC < foodCents + tipC
                const isOpen = openOrder === p.id
                return (
                <Fragment key={p.id}>
                <tr onClick={() => setOpenOrder(o => o === p.id ? null : p.id)} style={{ borderBottom: `0.5px solid ${S.border}`, background: i % 2 === 0 ? S.white : S.cream, cursor: 'pointer' }}>
                  <td style={{ padding: '8px 10px', color: S.stone, whiteSpace: 'nowrap' }}><span style={{ color: S.sage, marginRight: 4 }}>{isOpen ? '▾' : '▸'}</span>{p.delivery_date || '—'}</td>
                  <td style={{ padding: '8px 10px' }}>{MEAL_EMOJI[p.meal_type] || ''} {p.meal_name || '—'}</td>
                  <td style={{ padding: '8px 10px', color: S.forest }}>{p.restaurant_name || '—'}</td>
                  <td style={{ padding: '8px 10px', color: S.forest }}>{p.coordinator_name || '—'}</td>
                  <td style={{ padding: '8px 10px', color: underpaid ? S.red : S.forest, whiteSpace: 'nowrap', fontWeight: underpaid ? 700 : 400 }}>{totalC ? fmtMoney(totalC) : '—'}{underpaid && <span title="Underpaid" style={{ marginLeft: 4 }}>⚠</span>}</td>
                  <td style={{ padding: '8px 10px', color: S.amber, whiteSpace: 'nowrap' }}>{tipC ? fmtMoney(tipC) : '—'}</td>
                  <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: p.status === 'confirmed' || p.status === 'delivered' ? S.sageLight : p.status === 'pending' ? S.amberLight : S.redLight, color: p.status === 'confirmed' || p.status === 'delivered' ? S.sage : p.status === 'pending' ? S.amber : S.red }}>{p.status}</span>
                  </td>
                </tr>
                {isOpen && (
                <tr style={{ background: S.cream }}>
                  <td colSpan={7} style={{ padding: '2px 10px 14px 24px' }}>
                    <div style={{ background: S.white, border: `0.5px solid ${S.border}`, borderRadius: 10, padding: '12px 14px', maxWidth: 360 }}>
                      <p style={{ fontSize: 10, fontWeight: 700, color: S.stone, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 10px' }}>Checkout invoice</p>
                      {it.length > 0 ? it.map((m: any, idx: number) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: S.forest, marginBottom: 5 }}>
                          <span style={{ paddingRight: 12 }}>{m.name || 'Item'}{(m.qty || 1) > 1 ? ` ×${m.qty}` : ''}</span>
                          <span style={{ whiteSpace: 'nowrap' }}>{fmtMoney(Math.round((m.price || 0) * 100) * (m.qty || 1))}</span>
                        </div>
                      )) : <div style={{ fontSize: 12, color: S.stone, marginBottom: 5 }}>No itemized food saved on this order</div>}
                      <div style={{ borderTop: `0.5px solid ${S.border}`, margin: '8px 0', paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 12, color: S.stone }}><span>Food subtotal</span><span>{fmtMoney(foodCents)}</span></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: S.stone, marginBottom: 5 }}><span>Tip (100% to driver)</span><span>{tipC ? fmtMoney(tipC) : '—'}</span></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: feesC < 0 ? S.red : S.stone, marginBottom: 5 }}><span>Delivery + service</span><span>{fmtMoney(feesC)}</span></div>
                      <div style={{ borderTop: `1.5px solid ${S.border}`, marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, color: S.forest }}><span>Total paid</span><span>{fmtMoney(totalC)}</span></div>
                      {underpaid && <div style={{ marginTop: 10, fontSize: 12, fontWeight: 700, color: S.red, background: S.redLight, borderRadius: 8, padding: '7px 10px' }}>⚠ Underpaid — total is less than food + tip. Check this order.</div>}
                    </div>
                  </td>
                </tr>
                )}
                </Fragment>
                )
              })}
            </tbody>
          </table>
          {purchased.length > 50 && <p style={{ fontSize: 12, color: S.stone, margin: '10px 0 0', textAlign: 'center' }}>Showing 50 of {purchased.length} — export for full data</p>}
        </div>
      </div>

      <div style={{ background: S.white, border: `0.5px solid ${S.border}`, borderRadius: 14, padding: '16px 18px', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={() => setSecOpen(s => ({ ...s, kitchens: !s.kitchens }))} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}><span style={{ color: S.stone, fontSize: 11 }}>{secOpen.kitchens ? '▾' : '▸'}</span><p style={{ fontSize: 10, fontWeight: 700, color: S.stone, letterSpacing: '0.1em', textTransform: 'uppercase', margin: 0 }}>Kitchens ({data.kitchens.length})</p></button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => exportCSV(kitchenExportRows, `yourkitchen-kitchens-${TODAY}.csv`)}
              style={{ padding: '6px 14px', borderRadius: 8, border: `1.5px solid ${S.border}`, background: S.white, color: S.forest, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>↓ CSV</button>
            <button onClick={() => exportXLSX(kitchenExportRows, `yourkitchen-kitchens-${TODAY}`)}
              style={{ padding: '6px 14px', borderRadius: 8, border: `1.5px solid ${S.sage}`, background: S.sageLight, color: S.sage, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>↓ Excel</button>
          </div>
        </div>
        {secOpen.kitchens && (
        <div style={{ overflowX: 'auto', marginTop: 14 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${S.border}` }}>
                {['Kitchen', 'Tier', 'Household', 'Created'].map(h => (
                  <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: S.stone, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.kitchens.map((k: any, i: number) => (
                <tr key={k.id} style={{ borderBottom: `0.5px solid ${S.border}`, background: i % 2 === 0 ? S.white : S.cream }}>
                  <td style={{ padding: '8px 10px', color: S.forest }}>{k.name || k.slug || '—'}</td>
                  <td style={{ padding: '8px 10px' }}><span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: k.tier === 'founding' ? S.amberLight : S.sageLight, color: k.tier === 'founding' ? S.amber : S.sage }}>{k.tier || 'care'}</span></td>
                  <td style={{ padding: '8px 10px', color: S.stone, whiteSpace: 'nowrap' }}>{(k.household_adults || 0)}A · {(k.household_children || 0)}C</td>
                  <td style={{ padding: '8px 10px', color: S.stone, whiteSpace: 'nowrap' }}>{k.created_at ? new Date(k.created_at).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </div>

      <p style={{ fontSize: 11, color: S.stone, fontWeight: 300, textAlign: 'center', marginTop: 16, lineHeight: 1.6 }}>
        Data pulled live from Supabase. GMV, fees, and tips are in cents — exports convert to dollars. Avg onboarding time = profile created_at → kitchen created_at.
      </p>
    </div>
  )
}

// ── Dispatch tab ──────────────────────────────────────────────────────────────
function DispatchTab(props: any) {
  const { orders, loading, filter, setFilter, dispatching, cancelling, msgs, cancelReasons, setCancelReasons, cancelType, setCancelType, cancelListed, setCancelListed, cancelCorrect, setCancelCorrect, handleDispatch, handleCancel } = props
  const needsDispatch = (o: Order) => (!o.delivery_status || o.delivery_status === 'awaiting_dispatch') && !o.is_pickup

  const [groupBy, setGroupBy] = useState<'time' | 'recipient' | 'zip'>('time')
  const [needsOnly, setNeedsOnly] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const toggleIn = (set: Set<string>, setter: (s: Set<string>) => void, key: string) => { const n = new Set(set); if (n.has(key)) n.delete(key); else n.add(key); setter(n) }

  const todayOrders = orders.filter((o: Order) => o.delivery_date === TODAY)
  const tomorrowOrders = orders.filter((o: Order) => o.delivery_date === TOMORROW)
  const weekOrders = orders.filter((o: Order) => o.delivery_date > TOMORROW && o.delivery_date <= IN7DAYS)
  const allOrders = [...orders]
  const tabCounts: Record<Filter, number> = { today: todayOrders.length, tomorrow: tomorrowOrders.length, week: weekOrders.length, all: allOrders.length }
  const TABS: { key: Filter; label: string }[] = [{ key: 'today', label: 'Today' }, { key: 'tomorrow', label: 'Tomorrow' }, { key: 'week', label: 'This week' }, { key: 'all', label: 'All' }]

  let scope: Order[] = filter === 'today' ? todayOrders : filter === 'tomorrow' ? tomorrowOrders : filter === 'week' ? weekOrders : allOrders
  if (needsOnly) scope = scope.filter(needsDispatch)
  const dayList = Array.from(new Set(scope.map((o: Order) => o.delivery_date))).sort()
  const visible: Order[] = selectedDate ? scope.filter((o: Order) => o.delivery_date === selectedDate) : scope

  const dateGroups: Record<string, Order[]> = {}
  visible.forEach((o: Order) => { if (!dateGroups[o.delivery_date]) dateGroups[o.delivery_date] = []; dateGroups[o.delivery_date].push(o) })
  const sortedDates = Object.keys(dateGroups).sort()

  const MEAL_LANES: [string, string][] = [['breakfast', '\U0001F305 Breakfast'], ['lunch', '\u2600\uFE0F Lunch'], ['dinner', '\U0001F319 Dinner']]
  function laneGroups(dayOrders: Order[]): { key: string; label: string; items: Order[] }[] {
    if (groupBy === 'time') {
      return MEAL_LANES.map(([mt, label]) => ({ key: mt, label, items: dayOrders.filter(o => o.meal_type === mt).sort(sortByMealType) })).filter(g => g.items.length > 0)
    }
    if (groupBy === 'recipient') {
      const m: Record<string, Order[]> = {}
      dayOrders.forEach(o => { const k = o.kitchen_name || '\u2014'; if (!m[k]) m[k] = []; m[k].push(o) })
      return Object.keys(m).sort().map(name => ({ key: 'r:' + name, label: name + (zipOf(m[name][0].kitchen_address) ? ' \u00B7 ' + zipOf(m[name][0].kitchen_address) : ''), items: m[name].sort(sortByMealType) }))
    }
    const m: Record<string, Order[]> = {}
    dayOrders.forEach(o => { const z = zipOf(o.kitchen_address) || 'No zip'; if (!m[z]) m[z] = []; m[z].push(o) })
    return Object.keys(m).sort().map(z => ({ key: 'z:' + z, label: '\U0001F4CD ' + z, items: m[z].sort((a, b) => (a.kitchen_name || '').localeCompare(b.kitchen_name || '') || sortByMealType(a, b)) }))
  }

  const dayChipStyle = (on: boolean): React.CSSProperties => ({ flexShrink: 0, padding: '8px 12px', borderRadius: 12, border: `1.5px solid ${on ? S.sage : S.border}`, background: on ? S.sageLight : S.white, color: on ? S.sage : S.stone, fontSize: 12, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", textAlign: 'center', lineHeight: 1.3 })

  return (
    <>
      <div style={{ background: S.white, borderBottom: `1px solid ${S.border}`, padding: '0 24px', display: 'flex', gap: 0, overflowX: 'auto' }}>
        {TABS.map(tab => {
          const count = tabCounts[tab.key]
          const isActive = filter === tab.key
          const urgentCount = tab.key === 'today' ? todayOrders.filter(needsDispatch).length : tab.key === 'tomorrow' ? tomorrowOrders.filter(needsDispatch).length : 0
          return (
            <button key={tab.key} onClick={() => { setFilter(tab.key); setSelectedDate('') }}
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

      <div style={{ maxWidth: 820, margin: '0 auto', padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: S.stone, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Group by</span>
          {([['time', 'Time'], ['recipient', 'Recipient'], ['zip', 'Zip']] as [any, string][]).map(([k, l]) => (
            <button key={k} onClick={() => setGroupBy(k)}
              style={{ padding: '6px 12px', borderRadius: 20, border: `1.5px solid ${groupBy === k ? S.sage : S.border}`, background: groupBy === k ? S.sageLight : S.white, color: groupBy === k ? S.sage : S.stone, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>{l}</button>
          ))}
          <div style={{ flex: 1 }} />
          <button onClick={() => setNeedsOnly(v => !v)}
            style={{ padding: '6px 12px', borderRadius: 20, border: `1.5px solid ${needsOnly ? S.red : S.border}`, background: needsOnly ? S.redLight : S.white, color: needsOnly ? S.red : S.stone, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>
            {needsOnly ? '\u2713 ' : ''}Needs dispatch
          </button>
        </div>

        {dayList.length > 1 && (
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6, marginBottom: 16 }}>
            <button onClick={() => setSelectedDate('')} style={dayChipStyle(selectedDate === '')}>
              <div style={{ fontWeight: 700 }}>All days</div>
              <div style={{ fontSize: 10, opacity: 0.8 }}>{scope.length} orders</div>
            </button>
            {dayList.map(d => {
              const ods = scope.filter((o: Order) => o.delivery_date === d)
              const need = ods.filter(needsDispatch).length
              const sel = selectedDate === d
              return (
                <button key={d} onClick={() => setSelectedDate(sel ? '' : d)} style={dayChipStyle(sel)}>
                  <div style={{ fontWeight: 700 }}>{friendlyDate(d)}</div>
                  <div style={{ fontSize: 10, color: need > 0 ? S.red : S.stone }}>{ods.length} \u00B7 {need} to ship</div>
                </button>
              )
            })}
          </div>
        )}

        {loading && <p style={{ color: S.stone, fontSize: 14, textAlign: 'center', padding: 40 }}>Loading orders\u2026</p>}

        {!loading && visible.length === 0 && (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>{needsOnly ? '\u2705' : '\U0001F4ED'}</div>
            <p style={{ fontFamily: "'Lora',serif", fontSize: 18, color: S.forest, margin: '0 0 8px' }}>{needsOnly ? 'Nothing waiting to ship' : 'No orders here'}</p>
            <p style={{ fontSize: 13, color: S.stone }}>Switch tabs or clear filters to see more.</p>
          </div>
        )}

        {sortedDates.map(date => {
          const dayOrders = dateGroups[date]
          const pendingInDate = dayOrders.filter(needsDispatch).length
          const isToday = date === TODAY
          const isTomorrow = date === TOMORROW
          const lanes = laneGroups(dayOrders)
          return (
            <div key={date} style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: isToday ? S.red : isTomorrow ? S.amber : S.forest }}>{friendlyDate(date)}</span>
                <span style={{ fontSize: 12, color: S.stone }}>{dayOrders.length} orders</span>
                {pendingInDate > 0 && <span style={{ fontSize: 10, fontWeight: 700, background: isToday ? S.redLight : S.amberLight, color: isToday ? S.red : S.amber, borderRadius: 20, padding: '2px 8px' }}>{pendingInDate} need dispatch</span>}
                <div style={{ flex: 1, height: 0.5, background: S.border }} />
              </div>

              {lanes.map(lane => {
                const laneKey = date + '|' + lane.key
                const isCollapsed = collapsed.has(laneKey)
                const laneNeed = lane.items.filter(needsDispatch).length
                return (
                  <div key={laneKey} style={{ marginBottom: 10 }}>
                    <button onClick={() => toggleIn(collapsed, setCollapsed, laneKey)}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, background: S.cream, border: `1px solid ${S.border}`, borderRadius: 10, padding: '9px 12px', cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: S.forest }}>{lane.label}</span>
                      <span style={{ fontSize: 12, color: S.stone }}>{lane.items.length}</span>
                      {laneNeed > 0 && <span style={{ fontSize: 10, fontWeight: 700, background: S.redLight, color: S.red, borderRadius: 20, padding: '2px 8px' }}>{laneNeed} to ship</span>}
                      <div style={{ flex: 1 }} />
                      <span style={{ fontSize: 12, color: S.stone }}>{isCollapsed ? '\u25B8' : '\u25BE'}</span>
                    </button>

                    {!isCollapsed && lane.items.map((order: Order) => {
                      const isAwaiting = needsDispatch(order)
                      const isPickupOrder = !!order.is_pickup
                      const isExpanded = expanded.has(order.id)
                      const isDispatching_ = dispatching === order.id
                      const isCancelling_ = cancelling === order.id
                      const msg = msgs[order.id]
                      const dotColor = isAwaiting ? S.red : isPickupOrder ? S.blue : S.sage
                      return (
                        <div key={order.id} style={{ border: `1px solid ${isAwaiting ? S.red : S.border}`, borderRadius: 12, marginBottom: 8, overflow: 'hidden', background: S.white }}>
                          <div onClick={() => toggleIn(expanded, setExpanded, order.id)}
                            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px', cursor: 'pointer' }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: S.forest, width: 62, flexShrink: 0 }}>{prettyTime(order.delivery_time, order.meal_type)}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: S.forest, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{order.kitchen_name || '\u2014'}{zipOf(order.kitchen_address) && <span style={{ fontWeight: 400, color: S.stone }}> \u00B7 {zipOf(order.kitchen_address)}</span>}</div>
                              <div style={{ fontSize: 12, color: S.stone, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{MEAL_EMOJI[order.meal_type] || '\U0001F37D'} {order.meal_name} \u00B7 {order.restaurant_name}</div>
                            </div>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
                            {isAwaiting && (
                              <button onClick={(e) => { e.stopPropagation(); handleDispatch(order.id) }} disabled={isDispatching_ || isCancelling_}
                                style={{ flexShrink: 0, padding: '6px 12px', background: isDispatching_ ? S.border : S.forest, color: isDispatching_ ? S.stone : S.white, border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: isDispatching_ ? 'default' : 'pointer', fontFamily: "'DM Sans',sans-serif" }}>
                                {isDispatching_ ? '\u23F3' : '\U0001F680 Ship'}
                              </button>
                            )}
                            <span style={{ fontSize: 12, color: S.stone, flexShrink: 0 }}>{isExpanded ? '\u25BE' : '\u25B8'}</span>
                          </div>

                          {isExpanded && (
                            <div style={{ padding: '0 14px 14px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                <span style={{ fontSize: 12, color: S.stone }}>from <strong style={{ color: S.forest }}>{order.coordinator_name}</strong></span>
                                <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: isAwaiting ? S.redLight : isPickupOrder ? S.blueLight : S.sageLight, color: isAwaiting ? S.red : isPickupOrder ? S.blue : S.sage }}>{isAwaiting ? '\U0001F534 Needs dispatch' : isPickupOrder ? '\U0001F961 Pickup' : '\u2705 Dispatched'}</span>
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

                    {(() => {
                      const it: any[] = Array.isArray((order as any).meal_items) ? (order as any).meal_items : []
                      const foodCents = it.reduce((s: number, m: any) => s + Math.round((m.price || 0) * 100) * (m.qty || 1), 0)
                      const tipC = order.tip_amount || 0
                      const totalC = (order as any).stripe_amount || 0
                      const feesC = totalC - foodCents - tipC
                      const underpaid = totalC > 0 && totalC < foodCents + tipC
                      return (
                        <div style={{ background: S.white, border: `1px solid ${S.border}`, borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: S.stone, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>Order &amp; invoice</div>
                          {it.length > 0 ? it.map((m: any, idx: number) => (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: S.forest, marginBottom: 5 }}>
                              <span style={{ paddingRight: 12 }}>{(m.qty || 1) > 1 ? `${m.qty}× ` : ''}{m.name || 'Item'}</span>
                              <span style={{ whiteSpace: 'nowrap' }}>${(((Math.round((m.price || 0) * 100) * (m.qty || 1))) / 100).toFixed(2)}</span>
                            </div>
                          )) : <div style={{ fontSize: 13, color: S.stone, marginBottom: 5 }}>No itemized food saved on this order</div>}
                          <div style={{ borderTop: `0.5px solid ${S.border}`, margin: '8px 0', paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 12, color: S.stone }}><span>Food subtotal</span><span>${(foodCents / 100).toFixed(2)}</span></div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: S.stone, marginBottom: 4 }}><span>Tip (100% to driver)</span><span>${(tipC / 100).toFixed(2)}</span></div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: feesC < 0 ? S.red : S.stone, marginBottom: 4 }}><span>Delivery + service</span><span>${(feesC / 100).toFixed(2)}</span></div>
                          <div style={{ borderTop: `1.5px solid ${S.border}`, marginTop: 6, paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700, color: underpaid ? S.red : S.forest }}><span>Total paid</span><span>${(totalC / 100).toFixed(2)}{underpaid ? ' ⚠' : ''}</span></div>
                          {underpaid && <div style={{ marginTop: 10, fontSize: 12, fontWeight: 700, color: S.red, background: S.redLight, borderRadius: 8, padding: '7px 10px' }}>⚠ Underpaid — total is less than food + tip. Check before dispatching.</div>}
                        </div>
                      )
                    })()}

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

                    {isPickupOrder && (
                      <div style={{ background: S.blueLight, border: `1px solid ${S.blue}`, borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: S.blue, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>🥡 Pickup order — place at restaurant</div>
                        <div style={{ fontSize: 13, color: S.forest, display: 'flex', flexDirection: 'column', gap: 5 }}>
                          <div>☐ &nbsp;Place a <strong>PICKUP</strong> order at <strong>{order.restaurant_name}</strong></div>
                          {order.restaurant_address && <div style={{ paddingLeft: 22, fontSize: 12, color: S.stone, marginTop: -2 }}>📍 {order.restaurant_address}{order.restaurant_phone ? ` · ${order.restaurant_phone}` : ''}</div>}
                          <div>☐ &nbsp;Name on order: <strong>{order.coordinator_name}</strong></div>
                          <div>☐ &nbsp;No courier — recipient picks it up</div>
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
                        <button onClick={() => handleDispatch(order.id)} disabled={isDispatching_ || isCancelling_}
                          style={{ width: '100%', padding: 14, background: isDispatching_ ? S.border : S.forest, color: isDispatching_ ? S.stone : S.white, border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: isDispatching_ ? 'default' : 'pointer', fontFamily: "'DM Sans',sans-serif", marginBottom: 10 }}>
                          {isDispatching_ ? '⏳ Dispatching…' : '🚀 Dispatch to Shipday →'}
                        </button>
                    )}
                    {!isAwaiting && !isPickupOrder && (
                        <button onClick={() => handleDispatch(order.id, true)} disabled={isDispatching_ || isCancelling_}
                          style={{ width: '100%', padding: 14, background: isDispatching_ ? S.border : S.amber, color: S.white, border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: isDispatching_ ? 'default' : 'pointer', fontFamily: "'DM Sans',sans-serif", marginBottom: 10 }}>
                          {isDispatching_ ? '⏳ Redispatching…' : '🔄 Redispatch (resend courier)'}
                        </button>
                    )}
                    {(isAwaiting || isPickupOrder) && (
                        <div style={{ borderTop: `0.5px solid ${S.border}`, paddingTop: 12 }}>
                          <p style={{ fontSize: 11, fontWeight: 700, color: S.stone, letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 8px' }}>Cancel order</p>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                            {([['price_mismatch','Price mismatch'],['item_unavailable','Item unavailable'],['restaurant_unavailable','Restaurant closed'],['other','Other']] as any).map(([code, label]: any) => {
                              const on = (cancelType[order.id] || 'other') === code
                              return (
                                <button key={code} onClick={() => setCancelType((t: any) => ({ ...t, [order.id]: code }))}
                                  style={{ padding: '6px 11px', borderRadius: 20, border: `1.5px solid ${on ? S.red : S.border}`, background: on ? S.redLight : S.white, color: on ? S.red : S.stone, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>{label}</button>
                              )
                            })}
                          </div>
                          {(cancelType[order.id] || 'other') === 'price_mismatch' ? (
                            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                              <input value={cancelListed[order.id] || ''} onChange={(e: any) => setCancelListed((r: any) => ({ ...r, [order.id]: e.target.value }))} placeholder="Listed $ (opt)" inputMode="decimal"
                                style={{ flex: 1, minWidth: 0, padding: '9px 12px', borderRadius: 9, border: `1.5px solid ${S.border}`, fontSize: 13, fontFamily: "'DM Sans',sans-serif", color: S.forest, outline: 'none' }} />
                              <input value={cancelCorrect[order.id] || ''} onChange={(e: any) => setCancelCorrect((r: any) => ({ ...r, [order.id]: e.target.value }))} placeholder="Correct $ *" inputMode="decimal"
                                style={{ flex: 1, minWidth: 0, padding: '9px 12px', borderRadius: 9, border: `1.5px solid ${S.red}`, fontSize: 13, fontFamily: "'DM Sans',sans-serif", color: S.forest, outline: 'none' }} />
                            </div>
                          ) : (
                            <input value={cancelReasons[order.id] || ''} onChange={(e: any) => setCancelReasons((r: any) => ({ ...r, [order.id]: e.target.value }))} placeholder="Note (optional)"
                              style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 9, border: `1.5px solid ${S.border}`, fontSize: 13, fontFamily: "'DM Sans',sans-serif", color: S.forest, outline: 'none', marginBottom: 8 }} />
                          )}
                          <button onClick={() => handleCancel(order.id)} disabled={isDispatching_ || isCancelling_}
                            style={{ width: '100%', padding: '10px 16px', borderRadius: 9, border: `1.5px solid ${S.red}`, background: isCancelling_ ? S.border : S.redLight, color: isCancelling_ ? S.stone : S.red, fontSize: 13, fontWeight: 600, cursor: isCancelling_ ? 'default' : 'pointer', fontFamily: "'DM Sans',sans-serif" }}>
                            {isCancelling_ ? '⏳ Cancelling…' : '✕ Cancel order'}
                          </button>
                          <p style={{ fontSize: 11, color: S.stone, margin: '6px 0 0', fontWeight: 300 }}>{(cancelType[order.id] || 'other') === 'price_mismatch' ? 'Corrects the saved price · re-opens date · emails the coordinator to resend' : 'Voids charge · re-opens date · SMS both parties'}</p>
                        </div>
                    )}

                    {msg && <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 9, background: msg.startsWith('✅') ? S.sageLight : S.redLight, color: msg.startsWith('✅') ? S.sage : S.red, fontSize: 13, fontWeight: 500 }}>{msg}</div>}
                            </div>
                          )}
                        </div>
                      )
                    })}
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
  const [cancelType, setCancelType] = useState<Record<string, string>>({})
  const [cancelListed, setCancelListed] = useState<Record<string, string>>({})
  const [cancelCorrect, setCancelCorrect] = useState<Record<string, string>>({})
  const [view, setView] = useState<AdminView>('dispatch')
  const [refreshTick, setRefreshTick] = useState(0)
  const [backfilling, setBackfilling] = useState(false)
  const [backfillMsg, setBackfillMsg] = useState('')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const loadOrders = useCallback(async (secret?: string) => {
    const key = secret || sessionStorage.getItem('yk_admin_secret') || ''
    try {
      const res = await fetch('/api/admin-orders', { headers: { 'x-admin-secret': key } })
      const json = await res.json()
      setOrders(json.orders || [])
      setLastUpdated(new Date())
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

  // Live feed: poll the dispatch view every 20s so confirmed orders appear without a manual refresh.
  useEffect(() => {
    if (!authed || view !== 'dispatch') return
    const id = setInterval(() => { loadOrders() }, 20000)
    return () => clearInterval(id)
  }, [authed, view, loadOrders])

  const needsDispatch = (o: Order) => (!o.delivery_status || o.delivery_status === 'awaiting_dispatch') && !o.is_pickup
  const urgentToday = orders.filter(o => o.delivery_date === TODAY && needsDispatch(o)).length

  const handleAuth = async () => {
    setAuthErr('')
    const res = await fetch('/api/dispatch', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-secret': adminSecret }, body: JSON.stringify({ proposal_id: 'auth-test' }) })
    if (res.status === 401) { setAuthErr('Wrong admin secret'); return }
    sessionStorage.setItem('yk_admin_secret', adminSecret)
    setAuthed(true); loadOrders(adminSecret)
  }

  const handleDispatch = async (orderId: string, force?: boolean) => {
    if (force && !window.confirm('Redispatch sends a NEW courier order (and a new charge). Cancel the old order in your Shipday dashboard first. Continue?')) return
    setDispatching(orderId); setMsgs(m => ({ ...m, [orderId]: '' }))
    try {
      const res = await fetch('/api/dispatch', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-secret': adminSecret }, body: JSON.stringify({ proposal_id: orderId, force: !!force }) })
      const data = await res.json()
      if (res.ok) { setMsgs(m => ({ ...m, [orderId]: `✅ Dispatched! ${data.orderNumber}${data.trackingUrl ? ' · ' + data.trackingUrl : ''}` })); await loadOrders() }
      else { setMsgs(m => ({ ...m, [orderId]: `❌ ${data.error}` })) }
    } catch (err: any) { setMsgs(m => ({ ...m, [orderId]: `❌ ${err.message}` })) }
    setDispatching(null)
  }

  const handleCancel = async (orderId: string) => {
    const code = cancelType[orderId] || 'other'
    const REASON_TEXT: Record<string, string> = { price_mismatch: 'Menu price was out of date', item_unavailable: 'Item was unavailable', restaurant_unavailable: 'Restaurant was unavailable', other: cancelReasons[orderId]?.trim() || 'Order cancelled' }
    const reason = REASON_TEXT[code]
    if (code === 'price_mismatch' && !(cancelCorrect[orderId] || '').trim()) { setMsgs(m => ({ ...m, [orderId]: '❌ Enter the correct price first' })); return }
    const emailNote = code === 'price_mismatch' ? '\n\nWe will correct the saved menu price and email the coordinator to resend.' : ''
    if (!confirm(`Cancel this order?\n\nReason: ${reason}${emailNote}\n\nThis voids the charge and notifies both parties.`)) return
    setCancelling(orderId); setMsgs(m => ({ ...m, [orderId]: '' }))
    try {
      const res = await fetch('/api/cancel', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-secret': adminSecret }, body: JSON.stringify({ proposal_id: orderId, reason, reason_code: code, listed_price: cancelListed[orderId] || null, correct_price: cancelCorrect[orderId] || null }) })
      const data = await res.json()
      if (res.ok) {
        const note = data.stripeResult === 'refunded' ? ' · Refund issued' : data.stripeResult === 'authorization_cancelled' ? ' · Card not charged' : ''
        const mailed = code === 'price_mismatch' ? ' · Emails sent' : ''
        setMsgs(m => ({ ...m, [orderId]: `✅ Cancelled${note}${mailed}` })); setOrders(prev => prev.filter(o => o.id !== orderId)); await loadOrders()
      } else { setMsgs(m => ({ ...m, [orderId]: `❌ ${data.error}` })) }
    } catch (err: any) { setMsgs(m => ({ ...m, [orderId]: `❌ ${err.message}` })) }
    setCancelling(null)
  }

  const runBackfill = async () => {
    if (!confirm('Fix all restaurant addresses now? This is a one-time cleanup — safe to run, but only needed once.')) return
    setBackfilling(true); setBackfillMsg('Fixing addresses…')
    try {
      const res = await fetch('/api/admin-backfill-addresses', {
        method: 'POST',
        headers: { 'x-admin-secret': adminSecret || sessionStorage.getItem('yk_admin_secret') || '' },
      })
      const data = await res.json()
      if (!res.ok) { setBackfillMsg(`❌ ${data.error || 'Failed'}`); setBackfilling(false); return }
      const s = data.summary || {}
      setBackfillMsg(`✅ Done — ${s.updated || 0} fixed · ${s.skipped || 0} already complete · ${s.failed || 0} failed`)
      // If any failed, surface the first failure reason (usually "details failed" = Places Details API not enabled)
      const firstFail = (data.results || []).find((r: any) => r.status !== 'updated' && r.status !== undefined && r.status.includes('fail'))
      if (firstFail) setBackfillMsg(m => m + ` · e.g. "${firstFail.name}": ${firstFail.status}`)
      await loadOrders()
    } catch (err: any) {
      setBackfillMsg(`❌ ${err.message}`)
    }
    setBackfilling(false)
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
      <style>{`@keyframes ykpulse { 0% { box-shadow: 0 0 0 0 rgba(91,208,138,0.6) } 70% { box-shadow: 0 0 0 6px rgba(91,208,138,0) } 100% { box-shadow: 0 0 0 0 rgba(91,208,138,0) } }`}</style>

      <div style={{ background: S.forest, padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 500, letterSpacing: 4, color: S.sageMid, textTransform: 'uppercase' }}>Your</div>
          <div style={{ fontFamily: "'Lora',serif", fontSize: 20, fontWeight: 500, color: S.white, lineHeight: 1.1 }}>Kitchen · Admin</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {urgentToday > 0 && <div style={{ background: S.red, color: S.white, borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 700 }}>🔴 {urgentToday} due today</div>}
          <button onClick={runBackfill} disabled={backfilling} title="One-time: fetch full addresses for existing restaurants"
            style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8, padding: '8px 14px', color: S.white, fontSize: 12, cursor: backfilling ? 'default' : 'pointer', fontFamily: "'DM Sans',sans-serif", opacity: backfilling ? 0.6 : 1 }}>
            {backfilling ? 'Fixing…' : 'Fix Addresses'}
          </button>
          {authed && view === 'dispatch' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: S.sageMid, fontSize: 11 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#5BD08A', animation: 'ykpulse 1.8s infinite' }} />
              <span>Live{lastUpdated ? ` · ${lastUpdated.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : ''}</span>
            </div>
          )}
          <button onClick={() => { if (view === 'analytics') setRefreshTick(t => t + 1); else loadOrders() }} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8, padding: '8px 14px', color: S.white, fontSize: 12, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>Refresh</button>
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

      {backfillMsg && (
        <div style={{ background: backfillMsg.startsWith('❌') ? '#FDECEA' : '#EAF2ED', borderBottom: `1px solid ${S.border}`, padding: '10px 24px', fontSize: 13, color: backfillMsg.startsWith('❌') ? S.red : S.forest, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{backfillMsg}</span>
          <button onClick={() => setBackfillMsg('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: S.stone, fontSize: 14 }}>✕</button>
        </div>
      )}

      {view === 'dispatch' && (
        <DispatchTab orders={orders} loading={loading} filter={filter} setFilter={setFilter} dispatching={dispatching} cancelling={cancelling} msgs={msgs} cancelReasons={cancelReasons} setCancelReasons={setCancelReasons} cancelType={cancelType} setCancelType={setCancelType} cancelListed={cancelListed} setCancelListed={setCancelListed} cancelCorrect={cancelCorrect} setCancelCorrect={setCancelCorrect} handleDispatch={handleDispatch} handleCancel={handleCancel} />
      )}
      {view === 'analytics' && <AnalyticsTab key={refreshTick} />}
    </div>
  )
}

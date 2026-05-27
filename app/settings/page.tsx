'use client'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Suspense } from 'react'

const S = {
  sage: '#3D6B4F', sageMid: '#6B9E7E', sageLight: '#EAF2ED',
  cream: '#FAFAF5', forest: '#1E2620', stone: '#6B7066',
  border: '#DDE8E0', white: '#FFFFFF', amber: '#C17F47',
  amberLight: '#FBF0E4', red: '#B94040',
}

const DIETARY_OPTIONS = ['No shellfish', 'No nuts', 'No dairy', 'No gluten', 'Vegetarian', 'Vegan', 'Halal', 'Kosher']

const TIERS = [
  {
    key: 'free', badge: 'Free', price: '$0', period: '/ always',
    color: S.sage, bg: S.sageLight,
    desc: 'Basic access — upgrade anytime.',
    highlights: ['60-day calendar', '3 restaurants', '4 menu items each', 'Push notifications'],
  },
  {
    key: 'care', badge: 'Care+', price: '$9.99', period: '/ month',
    color: S.sage, bg: S.sageLight, highlight: 'Most popular',
    desc: 'Full SMS + expanded calendar.',
    highlights: ['Unlimited calendar', '10 restaurants', '12 menu items each', 'SMS + push', 'Home cook option', '3 active Kitchens'],
  },
  {
    key: 'annual', badge: 'Early Adopter', price: '$59', period: '/ year',
    color: S.sageMid, bg: S.sageLight, highlight: 'Best value',
    desc: 'Annual rate locked forever.',
    highlights: ['Everything in Care+', 'Save 50% vs monthly', 'Locked-in rate', 'Early feature access'],
  },
  {
    key: 'founding', badge: 'Founding Member', price: '$149', period: 'lifetime',
    color: S.amber, bg: S.amberLight, highlight: 'Limited — 100 spots',
    desc: 'Lifetime access. Thank you for founding YourKitchen.',
    highlights: ['Everything in Care+', 'Lifetime price lock', 'Unlimited Kitchens', 'Direct founder access', 'Vote on features', 'Listed on about page'],
  },
]

// Delivery window options per meal type
const WINDOW_OPTIONS = {
  breakfast: ['07:00-09:00', '08:00-10:00'],
  lunch:     ['11:00-12:30', '12:00-13:30'],
  dinner:    ['17:00-18:30', '17:30-19:00', '18:00-19:30'],
}
const WINDOW_LABELS: Record<string, string> = {
  '07:00-09:00': '7:00 – 9:00 AM',
  '08:00-10:00': '8:00 – 10:00 AM',
  '11:00-12:30': '11:00 AM – 12:30 PM',
  '12:00-13:30': '12:00 – 1:30 PM',
  '17:00-18:30': '5:00 – 6:30 PM',
  '17:30-19:00': '5:30 – 7:00 PM',
  '18:00-19:30': '6:00 – 7:30 PM',
}
const MEAL_LABELS: Record<string, { label: string; emoji: string; color: string }> = {
  breakfast: { label: 'Breakfast', emoji: '🌅', color: '#E8834A' },
  lunch:     { label: 'Lunch',     emoji: '☀️', color: '#4A8FA8' },
  dinner:    { label: 'Dinner',    emoji: '🌙', color: S.sage },
}

function SettingsContent() {
  const router   = useRouter()
  const params   = useSearchParams()
  const supabase = createClient()

  const [loading,        setLoading]        = useState(true)
  const [saving,         setSaving]         = useState(false)
  const [success,        setSuccess]        = useState('')
  const [error,          setError]          = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [deleteConfirm,  setDeleteConfirm]  = useState(false)
  const [deleteLoading,  setDeleteLoading]  = useState(false)
  const [currentTier,    setCurrentTier]    = useState('free')
  const [showAllPlans,   setShowAllPlans]   = useState(false)
  const [switchingTier,  setSwitchingTier]  = useState<string | null>(null)
  const [kitchenId,      setKitchenId]      = useState('')
  const [userId,         setUserId]         = useState('')

  const [form, setForm] = useState({
    full_name:             '',
    phone:                 '',
    street:                '',
    apt:                   '',
    city:                  '',
    state:                 'TX',
    zip:                   '',
    household_size:        4,
    dietary_restrictions:  [] as string[],
  })

  // Delivery windows — multiple per meal type
  const [breakfastWindows, setBreakfastWindows] = useState<string[]>(['07:00-09:00'])
  const [lunchWindows,     setLunchWindows]     = useState<string[]>(['11:00-12:30'])
  const [dinnerWindows,    setDinnerWindows]    = useState<string[]>(['17:30-19:00'])

  useEffect(() => {
    // Handle successful upgrade redirect from Stripe
    const upgraded = params.get('upgraded')
    if (upgraded) {
      setSuccess(`Successfully upgraded to ${TIERS.find(t => t.key === upgraded)?.badge || upgraded}!`)
      setCurrentTier(upgraded)
      // Update DB
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) supabase.from('profiles').update({ tier: upgraded }).eq('id', user.id)
      })
    }
  }, [])

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, phone, tier')
        .eq('id', user.id)
        .single()

      // Use Google metadata as fallback for name
      const name = profile?.full_name || (user.user_metadata?.full_name as string) || (user.user_metadata?.name as string) || ''

      setCurrentTier(profile?.tier || 'free')
      setForm(f => ({ ...f, full_name: name, phone: profile?.phone || '' }))

      const { data: kitchen } = await supabase
        .from('kitchens')
        .select('id, address, household_size, dietary_restrictions, breakfast_windows, lunch_windows, dinner_windows')
        .eq('organizer_id', user.id)
        .single()

      if (kitchen) {
        setKitchenId(kitchen.id)
        // Parse address back to fields (stored as "street, city, state zip")
        const addr = kitchen.address || ''
        setForm(f => ({
          ...f,
          household_size:       kitchen.household_size || 4,
          dietary_restrictions: kitchen.dietary_restrictions || [],
          street:               addr,
        }))
        if (kitchen.breakfast_windows?.length) setBreakfastWindows(kitchen.breakfast_windows)
        if (kitchen.lunch_windows?.length)     setLunchWindows(kitchen.lunch_windows)
        if (kitchen.dinner_windows?.length)    setDinnerWindows(kitchen.dinner_windows)
      }
      setLoading(false)
    }
    load()
  }, [])

  const toggleDiet = (item: string) =>
    setForm(f => ({ ...f, dietary_restrictions: f.dietary_restrictions.includes(item) ? f.dietary_restrictions.filter(d => d !== item) : [...f.dietary_restrictions, item] }))

  const toggleWindow = (meal: 'breakfast' | 'lunch' | 'dinner', window: string) => {
    const setters = { breakfast: setBreakfastWindows, lunch: setLunchWindows, dinner: setDinnerWindows }
    const values  = { breakfast: breakfastWindows,    lunch: lunchWindows,    dinner: dinnerWindows }
    const current = values[meal]
    setters[meal](current.includes(window) ? current.filter(w => w !== window) : [...current, window])
  }

  const handleSave = async () => {
    if (!form.full_name.trim()) { setError('Name is required.'); return }
    setSaving(true); setError(''); setSuccess('')

    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id:              userId,
        full_name:            form.full_name.trim(),
        phone:                form.phone,
        address:              form.street,
        household_size:       form.household_size,
        dietary_restrictions: form.dietary_restrictions,
        breakfast_windows:    breakfastWindows,
        lunch_windows:        lunchWindows,
        dinner_windows:       dinnerWindows,
      }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Something went wrong.'); setSaving(false); return }
    setSuccess('Settings saved.')
    setSaving(false)
  }

  const handlePlanSwitch = async (tierKey: string) => {
    if (tierKey === currentTier) return
    if (tierKey === 'free') {
      // Downgrade — just update DB
      setSwitchingTier('free')
      await fetch('/api/stripe-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: 'free', user_id: userId }),
      })
      setCurrentTier('free')
      setSwitchingTier(null)
      return
    }
    setSwitchingTier(tierKey)
    const res = await fetch('/api/stripe-subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier: tierKey, user_id: userId }),
    })
    const data = await res.json()
    if (data.url) {
      window.location.href = data.url
    } else {
      setError(data.error || 'Could not start checkout.')
      setSwitchingTier(null)
    }
  }

  const handlePasswordReset = async () => {
    setPasswordLoading(true); setPasswordSuccess('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) { setPasswordLoading(false); return }
    await supabase.auth.resetPasswordForEmail(user.email, { redirectTo: `${window.location.origin}/auth/callback` })
    setPasswordSuccess(`Reset link sent to ${user.email}.`)
    setPasswordLoading(false)
  }

  const handleDeleteAccount = async () => {
    setDeleteLoading(true)
    const res = await fetch('/api/delete-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId }),
    })
    if (res.ok) { await supabase.auth.signOut(); router.push('/login') }
    else {
      const data = await res.json()
      setError(data.error || 'Failed to delete account.')
      setDeleteLoading(false); setDeleteConfirm(false)
    }
  }

  const activeTier = TIERS.find(t => t.key === currentTier) || TIERS[0]

  if (loading) return (
    <div style={{ minHeight: '100vh', background: S.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans', sans-serif" }}>
      <p style={{ color: S.stone, fontSize: 14 }}>Loading settings…</p>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: S.cream, fontFamily: "'DM Sans', sans-serif", paddingBottom: 60 }}>
      <link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />

      {/* Nav */}
      <div style={{ background: S.forest, padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => router.push('/dashboard')}
          style={{ background: S.sage, border: 'none', borderRadius: 10, width: 36, height: 36, cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', color: S.white }}>
          ‹
        </button>
        <div>
          <div style={{ fontSize: 9, fontWeight: 500, letterSpacing: 5, color: S.sageMid, textTransform: 'uppercase' }}>Your</div>
          <div style={{ fontFamily: "'Lora', serif", fontSize: 20, fontWeight: 500, color: S.white }}>Kitchen</div>
        </div>
      </div>

      <div style={{ padding: '28px 24px', maxWidth: 500, margin: '0 auto' }}>
        <h1 style={{ fontFamily: "'Lora', serif", fontSize: 26, fontWeight: 500, color: S.forest, margin: '0 0 28px', letterSpacing: -0.5 }}>Settings</h1>

        {success && <div style={{ background: S.sageLight, border: `1.5px solid ${S.sage}`, borderRadius: 12, padding: '12px 16px', marginBottom: 20 }}><p style={{ fontSize: 13, color: S.sage, margin: 0 }}>✓ {success}</p></div>}

        {/* ── YOUR PLAN ── */}
        <p style={sLabel}>Your plan</p>

        {/* Current plan */}
        <div style={{ background: S.white, border: `2px solid ${activeTier.color}`, borderRadius: 16, padding: '18px 20px', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ background: activeTier.bg, color: activeTier.color, fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 20, letterSpacing: '0.05em' }}>{activeTier.badge}</span>
              <span style={{ fontFamily: "'Lora', serif", fontSize: 18, fontWeight: 500, color: S.forest }}>{activeTier.price}</span>
              <span style={{ fontSize: 12, color: S.stone, fontWeight: 300 }}>{activeTier.period}</span>
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, color: activeTier.color }}>✓ Active</span>
          </div>
          <p style={{ fontSize: 13, color: S.stone, fontWeight: 300, margin: 0 }}>{activeTier.desc}</p>
        </div>

        <button onClick={() => setShowAllPlans(v => !v)}
          style={{ width: '100%', padding: '11px', borderRadius: 10, border: `1.5px solid ${S.border}`, background: 'transparent', fontSize: 13, color: S.forest, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", marginBottom: 24 }}>
          {showAllPlans ? 'Hide plan options ▲' : 'Change plan ▼'}
        </button>

        {showAllPlans && (
          <div style={{ marginBottom: 28 }}>
            <div style={{ background: S.sageLight, borderRadius: 12, padding: '12px 16px', marginBottom: 14 }}>
              <p style={{ fontSize: 13, color: '#2D5240', margin: 0, fontWeight: 500 }}>
                ✦ Every paid plan starts with a 14-day free trial — no card required.
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {TIERS.map(tier => {
                const isCurrent  = tier.key === currentTier
                const isSwitching = switchingTier === tier.key
                return (
                  <div key={tier.key} style={{ background: S.white, border: `${isCurrent ? 2 : 1.5}px solid ${isCurrent ? tier.color : S.border}`, borderRadius: 14, padding: '16px 18px', position: 'relative', overflow: 'hidden' }}>
                    {tier.highlight && (
                      <div style={{ position: 'absolute', top: 0, right: 0, background: tier.color, color: S.white, fontSize: 9, fontWeight: 700, padding: '3px 12px', borderBottomLeftRadius: 8, letterSpacing: '0.06em' }}>
                        {tier.highlight.toUpperCase()}
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                      <div>
                        <span style={{ background: tier.bg, color: tier.color, fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20, display: 'inline-block', marginBottom: 6 }}>{tier.badge}</span>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                          <span style={{ fontFamily: "'Lora', serif", fontSize: 20, fontWeight: 500, color: tier.key === 'founding' ? tier.color : S.forest }}>{tier.price}</span>
                          <span style={{ fontSize: 12, color: S.stone, fontWeight: 300 }}>{tier.period}</span>
                        </div>
                      </div>
                      {isCurrent ? (
                        <span style={{ background: tier.bg, color: tier.color, fontSize: 11, fontWeight: 700, padding: '6px 14px', borderRadius: 20 }}>Current</span>
                      ) : (
                        <button onClick={() => handlePlanSwitch(tier.key)} disabled={!!switchingTier}
                          style={{ background: tier.color, color: S.white, border: 'none', borderRadius: 20, padding: '7px 18px', fontSize: 12, fontWeight: 600, cursor: switchingTier ? 'default' : 'pointer', fontFamily: "'DM Sans', sans-serif", opacity: switchingTier ? 0.6 : 1 }}>
                          {isSwitching ? 'Loading…' : tier.key === 'free' ? 'Downgrade' : 'Select →'}
                        </button>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {tier.highlights.map(h => (
                        <span key={h} style={{ background: tier.bg, color: tier.color, fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: 20 }}>✓ {h}</span>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── PROFILE ── */}
        <p style={sLabel}>Profile</p>
        <label style={lStyle}>Your name *</label>
        <input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Danielle Moore" style={iStyle} />
        <label style={lStyle}>Phone number</label>
        <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="(936) 555-0142" style={iStyle} />

        {/* ── KITCHEN ── */}
        <p style={{ ...sLabel, marginTop: 8 }}>Kitchen</p>
        <label style={lStyle}>Delivery address</label>
        <input value={form.street} onChange={e => setForm(f => ({ ...f, street: e.target.value }))} placeholder="1422 Oak Creek Dr, Waller, TX 77484" style={iStyle} />

        <label style={lStyle}>Household size</label>
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {[1,2,3,4,5,6].map(n => (
            <button key={n} onClick={() => setForm(f => ({ ...f, household_size: n }))}
              style={{ flex: 1, padding: '11px 4px', borderRadius: 10, border: 'none', background: form.household_size === n ? S.sage : S.sageLight, color: form.household_size === n ? S.white : S.sage, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>{n}</button>
          ))}
        </div>

        <label style={lStyle}>Dietary restrictions</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
          {DIETARY_OPTIONS.map(d => (
            <button key={d} onClick={() => toggleDiet(d)}
              style={{ padding: '8px 16px', borderRadius: 20, border: 'none', cursor: 'pointer', background: form.dietary_restrictions.includes(d) ? S.sage : S.sageLight, color: form.dietary_restrictions.includes(d) ? S.white : S.sage, fontSize: 13, fontWeight: 500, fontFamily: "'DM Sans', sans-serif" }}>{d}</button>
          ))}
        </div>

        {/* ── DELIVERY WINDOWS ── */}
        <p style={{ ...sLabel, marginTop: 8 }}>Delivery windows</p>
        <p style={{ fontSize: 13, color: S.stone, fontWeight: 300, margin: '0 0 16px', lineHeight: 1.6 }}>
          Select all windows that work for your household. Coordinators will see these when placing an order.
        </p>

        {(['breakfast', 'lunch', 'dinner'] as const).map(meal => {
          const m       = MEAL_LABELS[meal]
          const current = { breakfast: breakfastWindows, lunch: lunchWindows, dinner: dinnerWindows }[meal]
          return (
            <div key={meal} style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <span style={{ fontSize: 14 }}>{m.emoji}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: m.color, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{m.label}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {WINDOW_OPTIONS[meal].map(w => {
                  const on = current.includes(w)
                  return (
                    <button key={w} onClick={() => toggleWindow(meal, w)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderRadius: 10, border: `1.5px solid ${on ? m.color : S.border}`, background: on ? `${m.color}15` : S.white, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", textAlign: 'left' }}>
                      <div style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${on ? m.color : S.border}`, background: on ? m.color : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {on && <span style={{ color: S.white, fontSize: 11, fontWeight: 700 }}>✓</span>}
                      </div>
                      <span style={{ fontSize: 14, color: on ? m.color : S.forest, fontWeight: on ? 600 : 400 }}>{WINDOW_LABELS[w]}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}

        {error && <div style={{ background: '#FDE8E8', border: `1.5px solid ${S.red}`, borderRadius: 12, padding: '12px 16px', marginBottom: 16, marginTop: 8 }}><p style={{ fontSize: 13, color: S.red, margin: 0 }}>⚠️ {error}</p></div>}

        <button onClick={handleSave} disabled={saving}
          style={{ width: '100%', padding: '14px', borderRadius: 10, border: 'none', background: saving ? S.sageMid : S.forest, color: S.white, fontSize: 14, fontWeight: 500, cursor: saving ? 'default' : 'pointer', fontFamily: "'DM Sans', sans-serif", marginTop: 8, marginBottom: 24 }}>
          {saving ? 'Saving…' : 'Save Changes'}
        </button>

        {/* ── ACCOUNT ── */}
        <div style={{ background: S.white, border: `1px solid ${S.border}`, borderRadius: 16, padding: '20px', marginBottom: 16 }}>
          <p style={sLabel}>Account</p>
          <p style={{ fontSize: 14, color: S.stone, margin: '0 0 14px', fontWeight: 300, lineHeight: 1.6 }}>
            Send a password reset link to your registered email.
          </p>
          {passwordSuccess && <div style={{ background: S.sageLight, borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}><p style={{ fontSize: 13, color: S.sage, margin: 0 }}>✓ {passwordSuccess}</p></div>}
          <button onClick={handlePasswordReset} disabled={passwordLoading}
            style={{ width: '100%', padding: '13px', borderRadius: 10, border: `1.5px solid ${S.border}`, background: 'transparent', fontSize: 14, color: S.forest, cursor: passwordLoading ? 'default' : 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
            {passwordLoading ? 'Sending…' : 'Send Password Reset Email'}
          </button>
        </div>

        {/* ── DANGER ZONE ── */}
        <div style={{ background: S.white, border: `1.5px solid ${S.red}`, borderRadius: 16, padding: '20px' }}>
          <p style={{ ...sLabel, color: S.red }}>Danger Zone</p>
          <p style={{ fontSize: 14, color: S.stone, margin: '0 0 14px', fontWeight: 300, lineHeight: 1.6 }}>
            Permanently delete your account and all Kitchen data. This cannot be undone.
          </p>
          {deleteConfirm ? (
            <div>
              <div style={{ background: '#FDE8E8', borderRadius: 10, padding: '14px 16px', marginBottom: 14 }}>
                <p style={{ fontSize: 13, color: S.red, margin: 0, fontWeight: 500 }}>⚠️ This will permanently delete your Kitchen, all calendar dates, proposals, and account.</p>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setDeleteConfirm(false)} style={{ flex: 1, padding: '13px', borderRadius: 10, border: `1.5px solid ${S.border}`, background: 'transparent', fontSize: 14, color: S.stone, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>Cancel</button>
                <button onClick={handleDeleteAccount} disabled={deleteLoading} style={{ flex: 1, padding: '13px', borderRadius: 10, border: 'none', background: deleteLoading ? S.border : S.red, color: S.white, fontSize: 14, fontWeight: 500, cursor: deleteLoading ? 'default' : 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                  {deleteLoading ? 'Deleting…' : 'Yes, delete everything'}
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setDeleteConfirm(true)} style={{ width: '100%', padding: '13px', borderRadius: 10, border: `1.5px solid ${S.red}`, background: 'transparent', fontSize: 14, color: S.red, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
              Delete my account
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#FAFAF5' }} />}>
      <SettingsContent />
    </Suspense>
  )
}

const sLabel: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: '#6B7066', letterSpacing: 2, textTransform: 'uppercase', margin: '0 0 14px', display: 'block' }
const lStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: '#6B7066', letterSpacing: 1.5, textTransform: 'uppercase', display: 'block', marginBottom: 8 }
const iStyle: React.CSSProperties = { width: '100%', padding: '13px 16px', borderRadius: 10, border: '1.5px solid #DDE8E0', fontSize: 14, background: '#fff', color: '#1E2620', outline: 'none', boxSizing: 'border-box', marginBottom: 20, fontFamily: "'DM Sans', sans-serif" }

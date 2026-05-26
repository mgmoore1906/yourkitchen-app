'use client'
// FILE: app/settings/page.tsx
// Added: "Your Plan" section at the top with full tier comparison and plan switching.
// Everything below the plan section is unchanged from the original.

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const DIETARY_OPTIONS = ['No shellfish', 'No nuts', 'No dairy', 'No gluten', 'Vegetarian', 'Vegan', 'Halal', 'Kosher']

// ── Tier definitions ──────────────────────────────────────────────────────────
const TIERS = [
  {
    key: 'free', badge: 'Free', price: '$0', period: '/ always',
    color: '#3D6B4F', bg: '#EAF2ED',
    highlights: ['60-day calendar', '3 restaurants', '4 menu items each', 'Push notifications'],
  },
  {
    key: 'care', badge: 'Care+', price: '$9.99', period: '/ month',
    color: '#3D6B4F', bg: '#EAF2ED', highlight: 'Most popular',
    highlights: ['Unlimited calendar', '10 restaurants', '12 menu items each', 'SMS + push', 'Home cook option', '3 active Kitchens'],
  },
  {
    key: 'annual', badge: 'Early Adopter', price: '$59', period: '/ year',
    color: '#6B9E7E', bg: '#EAF2ED', highlight: 'Best value',
    highlights: ['Everything in Care+', 'Save 50% vs monthly', 'Locked-in annual rate', 'Early feature access', 'Early Adopter badge'],
  },
  {
    key: 'founding', badge: 'Founding Member', price: '$149', period: 'lifetime',
    color: '#C17F47', bg: '#FBF0E4', highlight: 'Limited',
    highlights: ['Everything in Care+', 'Lifetime price lock', 'Unlimited Kitchens', 'Direct founder access', 'Vote on features', 'Listed on about page'],
  },
]

const TIER_LABELS: Record<string, string> = {
  free: 'Free', care: 'Care+', annual: 'Early Adopter', founding: 'Founding Member',
}

export default function SettingsPage() {
  const router  = useRouter()
  const supabase = createClient()

  const [loading, setLoading]               = useState(true)
  const [saving, setSaving]                 = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [success, setSuccess]               = useState('')
  const [error, setError]                   = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [deleteConfirm, setDeleteConfirm]   = useState(false)
  const [deleteLoading, setDeleteLoading]   = useState(false)
  const [currentTier, setCurrentTier]       = useState('free')
  const [switchingTier, setSwitchingTier]   = useState<string | null>(null)
  const [showAllPlans, setShowAllPlans]     = useState(false)

  const [form, setForm] = useState({
    full_name: '', phone: '', address: '', household_size: 4,
    dietary_restrictions: [] as string[],
  })

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, phone, subscription_tier')
        .eq('id', user.id).single()

      const { data: kitchen } = await supabase
        .from('kitchens')
        .select('address, household_size, dietary_restrictions')
        .eq('organizer_id', user.id).single()

      setCurrentTier(profile?.subscription_tier || 'free')
      setForm({
        full_name: profile?.full_name || '',
        phone: profile?.phone || '',
        address: kitchen?.address || '',
        household_size: kitchen?.household_size || 4,
        dietary_restrictions: kitchen?.dietary_restrictions || [],
      })
      setLoading(false)
    }
    load()
  }, [])

  const toggleDiet = (item: string) => {
    setForm(f => ({ ...f, dietary_restrictions: f.dietary_restrictions.includes(item) ? f.dietary_restrictions.filter(d => d !== item) : [...f.dietary_restrictions, item] }))
  }

  const handleSave = async () => {
    setSaving(true); setError(''); setSuccess('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const res = await fetch('/api/settings', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id, ...form }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Something went wrong.') }
    else { router.push('/dashboard') }
    setSaving(false)
  }

  const handlePlanSwitch = async (tierKey: string) => {
    if (tierKey === currentTier) return
    setSwitchingTier(tierKey)
    try {
      const res = await fetch('/api/stripe-subscription', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: tierKey }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url  // Stripe checkout
      } else if (data.success) {
        setCurrentTier(tierKey)
        setShowAllPlans(false)
      } else {
        setError(data.error || 'Could not switch plan.')
      }
    } catch {
      setError('Network error. Please try again.')
    }
    setSwitchingTier(null)
  }

  const handlePasswordReset = async () => {
    setPasswordLoading(true); setPasswordSuccess('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) { setPasswordLoading(false); return }
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, { redirectTo: `${window.location.origin}/auth/callback` })
    if (!error) { setPasswordSuccess(`Password reset email sent to ${user.email}.`) }
    setPasswordLoading(false)
  }

  const handleDeleteAccount = async () => {
    setDeleteLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const res = await fetch('/api/delete-account', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id }),
    })
    if (res.ok) { await supabase.auth.signOut(); router.push('/login') }
    else { const data = await res.json(); setError(data.error || 'Failed to delete account.'); setDeleteLoading(false); setDeleteConfirm(false) }
  }

  const activeTier = TIERS.find(t => t.key === currentTier) || TIERS[0]

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#FAFAF5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans', sans-serif" }}>
      <p style={{ color: '#6B7066', fontSize: 14 }}>Loading settings…</p>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF5', fontFamily: "'DM Sans', sans-serif", padding: '0 0 60px' }}>
      <link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />

      {/* Nav */}
      <div style={{ background: '#1E2620', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => router.push('/dashboard')} style={{ background: '#3D6B4F', border: 'none', borderRadius: 10, width: 36, height: 36, cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>‹</button>
        <div>
          <div style={{ fontSize: 9, fontWeight: 500, letterSpacing: 5, color: '#6B9E7E', textTransform: 'uppercase' }}>Your</div>
          <div style={{ fontFamily: "'Lora', serif", fontSize: 20, fontWeight: 500, color: '#fff' }}>Kitchen</div>
        </div>
      </div>

      <div style={{ padding: '28px 24px', maxWidth: 500, margin: '0 auto' }}>
        <h1 style={{ fontFamily: "'Lora', serif", fontSize: 26, fontWeight: 500, color: '#1E2620', margin: '0 0 28px', letterSpacing: -0.5 }}>Settings</h1>

        {/* ── YOUR PLAN ─────────────────────────────────────────────────── */}
        <p style={sectionLabel}>Your plan</p>

        {/* Current plan card */}
        <div style={{ background: '#fff', border: `2px solid ${activeTier.color}`, borderRadius: 16, padding: '18px 20px', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ background: activeTier.bg, color: activeTier.color, fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 20, letterSpacing: '0.05em' }}>
                {activeTier.badge}
              </span>
              <span style={{ fontFamily: "'Lora', serif", fontSize: 18, fontWeight: 500, color: '#1E2620' }}>{activeTier.price}</span>
              <span style={{ fontSize: 12, color: '#6B7066', fontWeight: 300 }}>{activeTier.period}</span>
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, color: activeTier.color }}>✓ Active</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {activeTier.highlights.map(h => (
              <span key={h} style={{ background: activeTier.bg, color: activeTier.color, fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: 20 }}>{h}</span>
            ))}
          </div>
        </div>

        {/* Toggle to see all plans */}
        <button
          onClick={() => setShowAllPlans(v => !v)}
          style={{ width: '100%', padding: '12px', borderRadius: 10, border: '1.5px solid #DDE8E0', background: 'transparent', fontSize: 13, color: '#1E2620', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
        >
          {showAllPlans ? 'Hide plan options ▲' : 'Compare all plans ▼'}
        </button>

        {/* Full plan comparison — shown when expanded */}
        {showAllPlans && (
          <div style={{ marginBottom: 28 }}>
            <div style={{ background: '#EAF2ED', borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
              <p style={{ fontSize: 13, color: '#2D5240', margin: 0, fontWeight: 500 }}>✦ Every paid plan starts with a 14-day free trial — no card required.</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {TIERS.map(tier => {
                const isCurrent = tier.key === currentTier
                const isSwitching = switchingTier === tier.key
                return (
                  <div
                    key={tier.key}
                    style={{ background: '#fff', border: `${isCurrent ? 2 : 1.5}px solid ${isCurrent ? tier.color : '#DDE8E0'}`, borderRadius: 14, padding: '16px 18px', position: 'relative', overflow: 'hidden' }}
                  >
                    {tier.highlight && (
                      <div style={{ position: 'absolute', top: 0, right: 0, background: tier.color, color: '#fff', fontSize: 9, fontWeight: 700, padding: '3px 12px', borderBottomLeftRadius: 8, letterSpacing: '0.06em' }}>{tier.highlight.toUpperCase()}</div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                      <div>
                        <span style={{ background: tier.bg, color: tier.color, fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20, letterSpacing: '0.05em', display: 'inline-block', marginBottom: 6 }}>{tier.badge}</span>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                          <span style={{ fontFamily: "'Lora', serif", fontSize: 22, fontWeight: 500, color: tier.key === 'founding' ? tier.color : '#1E2620' }}>{tier.price}</span>
                          <span style={{ fontSize: 12, color: '#6B7066', fontWeight: 300 }}>{tier.period}</span>
                        </div>
                      </div>
                      {isCurrent ? (
                        <span style={{ background: tier.bg, color: tier.color, fontSize: 11, fontWeight: 700, padding: '6px 14px', borderRadius: 20 }}>Current plan</span>
                      ) : (
                        <button
                          onClick={() => handlePlanSwitch(tier.key)}
                          disabled={!!switchingTier}
                          style={{ background: tier.color, color: '#fff', border: 'none', borderRadius: 20, padding: '6px 16px', fontSize: 12, fontWeight: 600, cursor: switchingTier ? 'default' : 'pointer', fontFamily: "'DM Sans', sans-serif", opacity: switchingTier ? 0.6 : 1 }}
                        >
                          {isSwitching ? 'Loading…' : tier.key === 'free' ? 'Downgrade' : 'Select'}
                        </button>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {tier.highlights.map(h => (
                        <div key={h} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ color: tier.color, fontSize: 11, fontWeight: 700, flexShrink: 0 }}>✓</span>
                          <span style={{ fontSize: 13, color: '#1E2620', fontWeight: 300 }}>{h}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── PROFILE ───────────────────────────────────────────────────── */}
        <p style={sectionLabel}>Profile</p>
        <label style={labelStyle}>Your name</label>
        <input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Danielle Moore" style={inputStyle} />
        <label style={labelStyle}>Phone number</label>
        <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+1 (555) 123-4567" style={inputStyle} />

        {/* ── KITCHEN ───────────────────────────────────────────────────── */}
        <p style={{ ...sectionLabel, marginTop: 8 }}>Kitchen</p>
        <label style={labelStyle}>Delivery address</label>
        <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="1422 Oak Creek Dr, Waller, TX 77484" style={inputStyle} />
        <label style={labelStyle}>Household size</label>
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {[1,2,3,4,5,6].map(n => (
            <button key={n} onClick={() => setForm(f => ({ ...f, household_size: n }))} style={{ flex: 1, padding: '11px 4px', borderRadius: 10, border: 'none', background: form.household_size === n ? '#3D6B4F' : '#EAF2ED', color: form.household_size === n ? '#fff' : '#3D6B4F', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>{n}</button>
          ))}
        </div>
        <label style={labelStyle}>Dietary restrictions</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 28 }}>
          {DIETARY_OPTIONS.map(d => (
            <button key={d} onClick={() => toggleDiet(d)} style={{ padding: '8px 16px', borderRadius: 20, border: 'none', cursor: 'pointer', background: form.dietary_restrictions.includes(d) ? '#3D6B4F' : '#EAF2ED', color: form.dietary_restrictions.includes(d) ? '#fff' : '#3D6B4F', fontSize: 13, fontWeight: 500, fontFamily: "'DM Sans', sans-serif" }}>{d}</button>
          ))}
        </div>

        {error && <div style={{ background: '#FDE8E8', border: '1.5px solid #B94040', borderRadius: 12, padding: '12px 16px', marginBottom: 16 }}><p style={{ fontSize: 13, color: '#B94040', margin: 0 }}>⚠️ {error}</p></div>}
        {success && <div style={{ background: '#EAF2ED', border: '1.5px solid #3D6B4F', borderRadius: 12, padding: '12px 16px', marginBottom: 16 }}><p style={{ fontSize: 13, color: '#3D6B4F', margin: 0 }}>✓ {success}</p></div>}

        <button onClick={handleSave} disabled={saving} style={{ width: '100%', padding: '14px', borderRadius: 10, border: 'none', background: saving ? '#6B9E7E' : '#3D6B4F', color: '#fff', fontSize: 14, fontWeight: 500, cursor: saving ? 'default' : 'pointer', fontFamily: "'DM Sans', sans-serif", marginBottom: 24 }}>
          {saving ? 'Saving…' : 'Save Changes'}
        </button>

        {/* ── ACCOUNT ───────────────────────────────────────────────────── */}
        <div style={{ background: '#fff', border: '1px solid #DDE8E0', borderRadius: 16, padding: '20px', marginBottom: 16 }}>
          <p style={sectionLabel}>Account</p>
          <p style={{ fontSize: 14, color: '#6B7066', margin: '0 0 14px', fontWeight: 300, lineHeight: 1.6 }}>Click below to receive a password reset link at your registered email address.</p>
          {passwordSuccess && <div style={{ background: '#EAF2ED', borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}><p style={{ fontSize: 13, color: '#3D6B4F', margin: 0 }}>✓ {passwordSuccess}</p></div>}
          <button onClick={handlePasswordReset} disabled={passwordLoading} style={{ width: '100%', padding: '13px', borderRadius: 10, border: '1.5px solid #DDE8E0', background: 'transparent', fontSize: 14, color: '#1E2620', cursor: passwordLoading ? 'default' : 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
            {passwordLoading ? 'Sending…' : 'Send Password Reset Email'}
          </button>
        </div>

        {/* ── DANGER ZONE ───────────────────────────────────────────────── */}
        <div style={{ background: '#fff', border: '1.5px solid #B94040', borderRadius: 16, padding: '20px' }}>
          <p style={{ ...sectionLabel, color: '#B94040' }}>Danger Zone</p>
          <p style={{ fontSize: 14, color: '#6B7066', margin: '0 0 14px', fontWeight: 300, lineHeight: 1.6 }}>Permanently delete your account and all Kitchen data. This cannot be undone.</p>
          {deleteConfirm ? (
            <div>
              <div style={{ background: '#FDE8E8', borderRadius: 10, padding: '14px 16px', marginBottom: 14 }}>
                <p style={{ fontSize: 13, color: '#B94040', margin: 0, fontWeight: 500 }}>⚠️ This will permanently delete your Kitchen, all calendar dates, proposals, and account. There is no way to recover this data.</p>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setDeleteConfirm(false)} style={{ flex: 1, padding: '13px', borderRadius: 10, border: '1.5px solid #DDE8E0', background: 'transparent', fontSize: 14, color: '#6B7066', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>Cancel</button>
                <button onClick={handleDeleteAccount} disabled={deleteLoading} style={{ flex: 1, padding: '13px', borderRadius: 10, border: 'none', background: deleteLoading ? '#DDE8E0' : '#B94040', color: '#fff', fontSize: 14, fontWeight: 500, cursor: deleteLoading ? 'default' : 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                  {deleteLoading ? 'Deleting…' : 'Yes, delete everything'}
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setDeleteConfirm(true)} style={{ width: '100%', padding: '13px', borderRadius: 10, border: '1.5px solid #B94040', background: 'transparent', fontSize: 14, color: '#B94040', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>Delete my account</button>
          )}
        </div>
      </div>
    </div>
  )
}

const sectionLabel: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: '#6B7066', letterSpacing: 2, textTransform: 'uppercase', margin: '0 0 16px', display: 'block' }
const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: '#6B7066', letterSpacing: 1.5, textTransform: 'uppercase', display: 'block', marginBottom: 8 }
const inputStyle: React.CSSProperties = { width: '100%', padding: '13px 16px', borderRadius: 10, border: '1.5px solid #DDE8E0', fontSize: 16, background: '#fff', color: '#1E2620', outline: 'none', boxSizing: 'border-box', marginBottom: 20, fontFamily: "'DM Sans', sans-serif" }

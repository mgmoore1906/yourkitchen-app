'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const DIETARY_OPTIONS = ['No shellfish', 'No nuts', 'No dairy', 'No gluten', 'Vegetarian', 'Vegan', 'Halal', 'Kosher']

export default function SettingsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    address: '',
    household_size: 4,
    dietary_restrictions: [] as string[],
  })

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, phone')
        .eq('id', user.id)
        .single()

      const { data: kitchen } = await supabase
        .from('kitchens')
        .select('address, household_size, dietary_restrictions')
        .eq('organizer_id', user.id)
        .single()

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
    setForm(f => ({
      ...f,
      dietary_restrictions: f.dietary_restrictions.includes(item)
        ? f.dietary_restrictions.filter(d => d !== item)
        : [...f.dietary_restrictions, item],
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setSuccess('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id, ...form }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Something went wrong.')
    } else {
      setSuccess('Settings saved successfully.')
    }
    setSaving(false)
  }

  const handlePasswordReset = async () => {
    setPasswordLoading(true)
    setPasswordSuccess('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) { setPasswordLoading(false); return }

    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/auth/callback`,
    })

    if (!error) {
      setPasswordSuccess(`Password reset email sent to ${user.email}. Check your inbox.`)
    }
    setPasswordLoading(false)
  }

  const handleDeleteAccount = async () => {
    setDeleteLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const res = await fetch('/api/delete-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id }),
    })

    if (res.ok) {
      await supabase.auth.signOut()
      router.push('/login')
    } else {
      const data = await res.json()
      setError(data.error || 'Failed to delete account.')
      setDeleteLoading(false)
      setDeleteConfirm(false)
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#FAFAF5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans', sans-serif" }}>
        <p style={{ color: '#6B7066', fontSize: 14 }}>Loading settings…</p>
      </div>
    )
  }

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
        <h1 style={{ fontFamily: "'Lora', serif", fontSize: 26, fontWeight: 500, color: '#1E2620', margin: '0 0 6px', letterSpacing: -0.5 }}>Settings</h1>
        <p style={{ fontSize: 14, color: '#6B7066', margin: '0 0 28px', fontWeight: 300 }}>Update your profile and Kitchen details.</p>

        {/* Profile section */}
        <p style={sectionLabel}>Profile</p>

        <label style={labelStyle}>Your name</label>
        <input
          value={form.full_name}
          onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
          placeholder="Danielle Moor"
          style={inputStyle}
        />

        <label style={labelStyle}>Phone number</label>
        <input
          type="tel"
          value={form.phone}
          onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
          placeholder="+1 (555) 123-4567"
          style={inputStyle}
        />

        {/* Kitchen section */}
        <p style={{ ...sectionLabel, marginTop: 8 }}>Kitchen</p>

        <label style={labelStyle}>Delivery address</label>
        <input
          value={form.address}
          onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
          placeholder="1234 Johnson Lane, Hockley, TX 77447"
          style={inputStyle}
        />

        <label style={labelStyle}>Household size</label>
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {[1, 2, 3, 4, 5, 6].map(n => (
            <button key={n} onClick={() => setForm(f => ({ ...f, household_size: n }))} style={{
              flex: 1, padding: '11px 4px', borderRadius: 10, border: 'none',
              background: form.household_size === n ? '#3D6B4F' : '#EAF2ED',
              color: form.household_size === n ? '#fff' : '#3D6B4F',
              fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
            }}>{n}</button>
          ))}
        </div>

        <label style={labelStyle}>Dietary restrictions</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 28 }}>
          {DIETARY_OPTIONS.map(d => (
            <button key={d} onClick={() => toggleDiet(d)} style={{
              padding: '8px 16px', borderRadius: 20, border: 'none', cursor: 'pointer',
              background: form.dietary_restrictions.includes(d) ? '#3D6B4F' : '#EAF2ED',
              color: form.dietary_restrictions.includes(d) ? '#fff' : '#3D6B4F',
              fontSize: 13, fontWeight: 500, fontFamily: "'DM Sans', sans-serif",
            }}>{d}</button>
          ))}
        </div>

        {error && (
          <div style={{ background: '#FDE8E8', border: '1.5px solid #B94040', borderRadius: 12, padding: '12px 16px', marginBottom: 16 }}>
            <p style={{ fontSize: 13, color: '#B94040', margin: 0 }}>⚠️ {error}</p>
          </div>
        )}

        {success && (
          <div style={{ background: '#EAF2ED', border: '1.5px solid #3D6B4F', borderRadius: 12, padding: '12px 16px', marginBottom: 16 }}>
            <p style={{ fontSize: 13, color: '#3D6B4F', margin: 0 }}>✓ {success}</p>
          </div>
        )}

        <button onClick={handleSave} disabled={saving} style={{
          width: '100%', padding: '14px', borderRadius: 10, border: 'none',
          background: saving ? '#6B9E7E' : '#3D6B4F', color: '#fff',
          fontSize: 14, fontWeight: 500, cursor: saving ? 'default' : 'pointer',
          fontFamily: "'DM Sans', sans-serif", marginBottom: 24,
        }}>
          {saving ? 'Saving…' : 'Save Changes'}
        </button>

        {/* Password reset */}
        <div style={{ background: '#fff', border: '1px solid #DDE8E0', borderRadius: 16, padding: '20px', marginBottom: 16 }}>
          <p style={sectionLabel}>Account</p>
          <p style={{ fontSize: 14, color: '#6B7066', margin: '0 0 14px', fontWeight: 300, lineHeight: 1.6 }}>
            Click below to receive a password reset link at your registered email address.
          </p>
          {passwordSuccess && (
            <div style={{ background: '#EAF2ED', borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
              <p style={{ fontSize: 13, color: '#3D6B4F', margin: 0 }}>✓ {passwordSuccess}</p>
            </div>
          )}
          <button onClick={handlePasswordReset} disabled={passwordLoading} style={{
            width: '100%', padding: '13px', borderRadius: 10,
            border: '1.5px solid #DDE8E0', background: 'transparent',
            fontSize: 14, color: '#1E2620', cursor: passwordLoading ? 'default' : 'pointer',
            fontFamily: "'DM Sans', sans-serif",
          }}>
            {passwordLoading ? 'Sending…' : 'Send Password Reset Email'}
          </button>
        </div>

        {/* Danger zone */}
        <div style={{ background: '#fff', border: '1.5px solid #B94040', borderRadius: 16, padding: '20px', marginBottom: 16 }}>
          <p style={{ ...sectionLabel, color: '#B94040' }}>Danger Zone</p>
          <p style={{ fontSize: 14, color: '#6B7066', margin: '0 0 14px', fontWeight: 300, lineHeight: 1.6 }}>
            Permanently delete your account and all Kitchen data. This cannot be undone.
          </p>
          {deleteConfirm ? (
            <div>
              <div style={{ background: '#FDE8E8', borderRadius: 10, padding: '14px 16px', marginBottom: 14 }}>
                <p style={{ fontSize: 13, color: '#B94040', margin: 0, fontWeight: 500 }}>
                  ⚠️ This will permanently delete your Kitchen, all calendar dates, proposals, and account. There is no way to recover this data.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setDeleteConfirm(false)} style={{ flex: 1, padding: '13px', borderRadius: 10, border: '1.5px solid #DDE8E0', background: 'transparent', fontSize: 14, color: '#6B7066', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                  Cancel
                </button>
                <button onClick={handleDeleteAccount} disabled={deleteLoading} style={{ flex: 1, padding: '13px', borderRadius: 10, border: 'none', background: deleteLoading ? '#DDE8E0' : '#B94040', color: '#fff', fontSize: 14, fontWeight: 500, cursor: deleteLoading ? 'default' : 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                  {deleteLoading ? 'Deleting…' : 'Yes, delete everything'}
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setDeleteConfirm(true)} style={{ width: '100%', padding: '13px', borderRadius: 10, border: '1.5px solid #B94040', background: 'transparent', fontSize: 14, color: '#B94040', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
              Delete my account
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

const sectionLabel: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: '#6B7066', letterSpacing: 2,
  textTransform: 'uppercase', margin: '0 0 16px', display: 'block',
}
const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: '#6B7066', letterSpacing: 1.5,
  textTransform: 'uppercase', display: 'block', marginBottom: 8,
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '13px 16px', borderRadius: 10,
  border: '1.5px solid #DDE8E0', fontSize: 16,
  background: '#fff', color: '#1E2620', outline: 'none',
  boxSizing: 'border-box', marginBottom: 20,
  fontFamily: "'DM Sans', sans-serif",
}

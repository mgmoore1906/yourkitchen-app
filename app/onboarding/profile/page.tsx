'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const DIETARY_OPTIONS = [
  'No shellfish', 'No nuts', 'No dairy', 'No gluten',
  'Vegetarian', 'Vegan', 'Halal', 'Kosher'
]

export default function OnboardingProfile() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    full_name: '',
    address: '',
    household_size: '3-4',
    dietary_restrictions: [] as string[],
  })

  const toggleDiet = (item: string) => {
    setForm(f => ({
      ...f,
      dietary_restrictions: f.dietary_restrictions.includes(item)
        ? f.dietary_restrictions.filter(d => d !== item)
        : [...f.dietary_restrictions, item]
    }))
  }

  const handleNext = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      full_name: form.full_name,
    })

    if (!error) {
      localStorage.setItem('yk_onboarding', JSON.stringify(form))
      router.push('/onboarding/calendar')
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF5', 
                  fontFamily: "'DM Sans', sans-serif", padding: '0 0 40px' }}>
      <link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />
      
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #DDE8E0', 
                    padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 500, letterSpacing: 5, 
                        color: '#6B9E7E', textTransform: 'uppercase' }}>Your</div>
          <div style={{ fontFamily: "'Lora', serif", fontSize: 20, 
                        fontWeight: 500, color: '#1E2620' }}>Kitchen</div>
        </div>
      </div>

      {/* Progress */}
      <div style={{ display: 'flex', gap: 6, padding: '20px 24px 0' }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{ flex: 1, height: 4, borderRadius: 4,
                                background: i === 0 ? '#3D6B4F' : '#DDE8E0' }} />
        ))}
      </div>

      <div style={{ padding: '24px 24px 0', maxWidth: 500, margin: '0 auto' }}>
        <p style={{ fontSize: 10, fontWeight: 500, letterSpacing: 3, 
                    color: '#3D6B4F', textTransform: 'uppercase', margin: '0 0 8px' }}>
          Step 1 of 4
        </p>
        <h1 style={{ fontFamily: "'Lora', serif", fontSize: 26, fontWeight: 500,
                     color: '#1E2620', margin: '0 0 6px', letterSpacing: -0.5 }}>
          Tell us about your household
        </h1>
        <p style={{ fontSize: 14, color: '#6B7066', margin: '0 0 28px', fontWeight: 300 }}>
          This helps your village know what you need.
        </p>

        {/* Full name */}
        <label style={labelStyle}>Your name</label>
        <input
          value={form.full_name}
          onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
          placeholder="Danielle Moore"
          style={inputStyle}
        />

        {/* Address */}
        <label style={labelStyle}>Delivery address</label>
        <input
          value={form.address}
          onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
          placeholder="1422 Oak Creek Dr, Waller, TX 77484"
          style={inputStyle}
        />

        {/* Household size */}
        <label style={labelStyle}>Household size</label>
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {['1-2', '3-4', '5-6', '7+'].map(s => (
            <button key={s} onClick={() => setForm(f => ({ ...f, household_size: s }))}
              style={{ flex: 1, padding: '11px 4px', borderRadius: 10, border: 'none',
                       background: form.household_size === s ? '#3D6B4F' : '#EAF2ED',
                       color: form.household_size === s ? '#fff' : '#3D6B4F',
                       fontSize: 13, fontWeight: 600, cursor: 'pointer',
                       fontFamily: "'DM Sans', sans-serif" }}>
              {s}
            </button>
          ))}
        </div>

        {/* Dietary restrictions */}
        <label style={labelStyle}>Dietary restrictions</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 32 }}>
          {DIETARY_OPTIONS.map(d => (
            <button key={d} onClick={() => toggleDiet(d)}
              style={{ padding: '8px 16px', borderRadius: 20, border: 'none', cursor: 'pointer',
                       background: form.dietary_restrictions.includes(d) ? '#3D6B4F' : '#EAF2ED',
                       color: form.dietary_restrictions.includes(d) ? '#fff' : '#3D6B4F',
                       fontSize: 13, fontWeight: 500, fontFamily: "'DM Sans', sans-serif" }}>
              {d}
            </button>
          ))}
        </div>

        <button onClick={handleNext} disabled={!form.full_name || !form.address || loading}
          style={{ width: '100%', padding: '14px', borderRadius: 10, border: 'none',
                   background: !form.full_name || !form.address ? '#DDE8E0' : '#3D6B4F',
                   color: !form.full_name || !form.address ? '#6B7066' : '#fff',
                   fontSize: 14, fontWeight: 500, cursor: !form.full_name || !form.address ? 'default' : 'pointer',
                   fontFamily: "'DM Sans', sans-serif" }}>
          {loading ? 'Saving…' : 'Next: Set My Calendar →'}
        </button>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: '#6B7066', letterSpacing: 1.5,
  textTransform: 'uppercase', display: 'block', marginBottom: 8
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '13px 16px', borderRadius: 10,
  border: '1.5px solid #DDE8E0', fontSize: 14, background: '#fff',
  outline: 'none', boxSizing: 'border-box', marginBottom: 20,
  fontFamily: "'DM Sans', sans-serif", color: '#1E2620'
}

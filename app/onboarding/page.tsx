'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Step = 'tiers' | 'profile' | 'address'

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()
  const [step, setStep] = useState<Step>('tiers')
  const [selectedTier, setSelectedTier] = useState('free')
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    household_size: '3-4',
    dietary_restrictions: [] as string[],
    street: '',
    apt: '',
    city: '',
    state: 'TX',
    zip: '',
  })

  const update = (field: string, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }))

  async function finish() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.from('profiles').insert({
      id: user.id,
      full_name: form.full_name,
      phone: form.phone,
      household_size: form.household_size,
      dietary_restrictions: form.dietary_restrictions,
      street: form.street,
      apt: form.apt,
      city: form.city,
      state: form.state,
      zip: form.zip,
      tier: selectedTier,
    })

    if (!error) {
      router.push('/dashboard')
    } else {
      console.error('Profile insert error:', error)
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '40px 24px', fontFamily: 'sans-serif' }}>

      {/* STEP 1: Tiers */}
      {step === 'tiers' && (
        <div>
          <h1 style={{ fontSize: 24, marginBottom: 8 }}>Choose your plan</h1>
          <p style={{ color: '#6B7066', marginBottom: 24 }}>
            Start free — every plan includes a 30-day full trial.
          </p>
          {[
            { key: 'free', name: 'Free', price: 'Always free', features: ['60-day calendar', '2 restaurants', 'Push notifications'] },
            { key: 'care', name: 'Care+', price: '$9.99/mo', features: ['12-month calendar', '5 restaurants', 'SMS + push notifications'] },
            { key: 'founding', name: 'Founding Member', price: '$149 one-time', features: ['Everything in Care+', 'Lifetime access', 'Priority support'] },
          ].map(tier => (
            <div
              key={tier.key}
              onClick={() => setSelectedTier(tier.key)}
              style={{
                border: `2px solid ${selectedTier === tier.key ? '#3D6B4F' : '#DDE8E0'}`,
                borderRadius: 12,
                padding: '16px',
                marginBottom: 12,
                cursor: 'pointer',
                background: selectedTier === tier.key ? '#EAF2ED' : '#fff',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <strong>{tier.name}</strong>
                <span style={{ color: '#3D6B4F', fontWeight: 600 }}>{tier.price}</span>
              </div>
              {tier.features.map(f => (
                <div key={f} style={{ fontSize: 13, color: '#6B7066' }}>✓ {f}</div>
              ))}
            </div>
          ))}
          <button
            onClick={() => setStep('profile')}
            style={{ width: '100%', padding: 14, background: '#3D6B4F', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 8 }}
          >
            Continue with {selectedTier === 'free' ? 'Free' : selectedTier === 'care' ? 'Care+' : 'Founding Member'} →
          </button>
        </div>
      )}

      {/* STEP 2: Profile */}
      {step === 'profile' && (
        <div>
          <h1 style={{ fontSize: 24, marginBottom: 8 }}>Your profile</h1>
          <p style={{ color: '#6B7066', marginBottom: 24 }}>Tell us about your household.</p>
          {[
            { label: 'Full name', field: 'full_name', placeholder: 'Danielle Moore' },
            { label: 'Phone number', field: 'phone', placeholder: '(936) 555-0142' },
          ].map(({ label, field, placeholder }) => (
            <div key={field} style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7066', letterSpacing: '0.07em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>{label}</label>
              <input
                value={form[field as keyof typeof form] as string}
                onChange={e => update(field, e.target.value)}
                placeholder={placeholder}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #DDE8E0', fontSize: 14, boxSizing: 'border-box' }}
              />
            </div>
          ))}
          <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7066', letterSpacing: '0.07em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Household size</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
            {['1-2', '3-4', '5-6', '7+'].map(s => (
              <button
                key={s}
                onClick={() => update('household_size', s)}
                style={{ flex: 1, padding: '10px 4px', background: form.household_size === s ? '#3D6B4F' : '#DDE8E0', color: form.household_size === s ? '#fff' : '#1E2620', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                {s}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={() => setStep('tiers')} style={{ flex: 1, padding: 14, background: 'transparent', color: '#6B7066', border: '1.5px solid #DDE8E0', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>← Back</button>
            <button onClick={() => setStep('address')} style={{ flex: 2, padding: 14, background: '#3D6B4F', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Next: Address →</button>
          </div>
        </div>
      )}

      {/* STEP 3: Address */}
      {step === 'address' && (
        <div>
          <h1 style={{ fontSize: 24, marginBottom: 8 }}>Delivery address</h1>
          <p style={{ color: '#6B7066', marginBottom: 24 }}>Where should meals be delivered?</p>
          {[
            { label: 'Street address', field: 'street', placeholder: '1422 Oak Creek Dr' },
            { label: 'Apt / Suite (optional)', field: 'apt', placeholder: 'Apt 2B' },
            { label: 'City', field: 'city', placeholder: 'Waller' },
          ].map(({ label, field, placeholder }) => (
            <div key={field} style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7066', letterSpacing: '0.07em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>{label}</label>
              <input
                value={form[field as keyof typeof form] as string}
                onChange={e => update(field, e.target.value)}
                placeholder={placeholder}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #DDE8E0', fontSize: 14, boxSizing: 'border-box' }}
              />
            </div>
          ))}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7066', letterSpacing: '0.07em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>State</label>
              <select
                value={form.state}
                onChange={e => update('state', e.target.value)}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #DDE8E0', fontSize: 14 }}
              >
                {['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'].map(s => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7066', letterSpacing: '0.07em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>ZIP code</label>
              <input
                value={form.zip}
                onChange={e => update('zip', e.target.value)}
                placeholder="77484"
                maxLength={5}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #DDE8E0', fontSize: 14, boxSizing: 'border-box' }}
              />
            </div>
          </div>
          <div style={{ background: '#FFF8E8', border: '1px solid #F5E6C0', borderRadius: 10, padding: '10px 14px', marginBottom: 20, fontSize: 12, color: '#8A6200' }}>
            📍 Currently serving Houston metro. We'll confirm delivery coverage at your ZIP.
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={() => setStep('profile')} style={{ flex: 1, padding: 14, background: 'transparent', color: '#6B7066', border: '1.5px solid #DDE8E0', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>← Back</button>
            <button
              onClick={finish}
              disabled={loading}
              style={{ flex: 2, padding: 14, background: loading ? '#DDE8E0' : '#3D6B4F', color: loading ? '#9AB8A5' : '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: loading ? 'default' : 'pointer' }}
            >
              {loading ? 'Setting up...' : 'Finish — Go to My Kitchen →'}
            </button>
          </div>
        </div>
      )}

    </div>
  )
}

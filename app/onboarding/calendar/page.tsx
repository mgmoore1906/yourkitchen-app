'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function OnboardingCalendar() {
  const router = useRouter()
  const [selected, setSelected] = useState<string[]>([])
  const [deliveryStart, setDeliveryStart] = useState('17:30')
 const [deliveryEnd, setDeliveryEnd] = useState('19:00')

// ← useEffect goes here
useEffect(() => {
  const saved = JSON.parse(localStorage.getItem('yk_onboarding') || '{}')
  if (saved.calendar_dates?.length) setSelected(saved.calendar_dates)
  if (saved.delivery_window_start) setDeliveryStart(saved.delivery_window_start)
  if (saved.delivery_window_end) setDeliveryEnd(saved.delivery_window_end)
}, [])

const generateDates = () => {
    const dates = []
    const today = new Date()
    for (let i = 1; i <= 30; i++) {
      const d = new Date(today)
      d.setDate(today.getDate() + i)
      const day = d.getDay()
      if (day !== 0 && day !== 6) {
        dates.push(d.toISOString().split('T')[0])
      }
      if (dates.length >= 14) break
    }
    return dates
  }

  const dates = generateDates()

  const toggle = (date: string) => {
    setSelected(s =>
      s.includes(date) ? s.filter(d => d !== date) : [...s, date]
    )
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00')
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  const handleNext = () => {
    const existing = JSON.parse(localStorage.getItem('yk_onboarding') || '{}')
    localStorage.setItem('yk_onboarding', JSON.stringify({
      ...existing,
      calendar_dates: selected,
      delivery_window_start: deliveryStart,
      delivery_window_end: deliveryEnd,
    }))
    router.push('/onboarding/restaurants')
  }

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF5',
                  fontFamily: "'DM Sans', sans-serif", padding: '0 0 40px' }}>
      <link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #DDE8E0',
                    padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => router.back()}
          style={{ background: '#EAF2ED', border: 'none', borderRadius: 10,
                   width: 36, height: 36, cursor: 'pointer', fontSize: 18,
                   display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3D6B4F' }}>
          ‹
        </button>
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
                                background: i <= 1 ? '#3D6B4F' : '#DDE8E0' }} />
        ))}
      </div>

      <div style={{ padding: '24px 24px 0', maxWidth: 500, margin: '0 auto' }}>
        <p style={{ fontSize: 10, fontWeight: 500, letterSpacing: 3,
                    color: '#3D6B4F', textTransform: 'uppercase', margin: '0 0 8px' }}>
          Step 2 of 4
        </p>
        <h1 style={{ fontFamily: "'Lora', serif", fontSize: 26, fontWeight: 500,
                     color: '#1E2620', margin: '0 0 6px', letterSpacing: -0.5 }}>
          Which days do you need meals?
        </h1>
        <p style={{ fontSize: 14, color: '#6B7066', margin: '0 0 24px', fontWeight: 300 }}>
          Select the dates your village can claim. You can add more any time.
        </p>

        {/* Date grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}>
          {dates.map(date => (
            <button key={date} onClick={() => toggle(date)}
              style={{ background: selected.includes(date) ? '#EAF2ED' : '#fff',
                       border: `2px solid ${selected.includes(date) ? '#3D6B4F' : '#DDE8E0'}`,
                       borderRadius: 12, padding: '12px 10px', cursor: 'pointer',
                       textAlign: 'left', transition: 'all 0.15s', fontFamily: "'DM Sans', sans-serif" }}>
              <div style={{ fontSize: 13, fontWeight: 600,
                            color: selected.includes(date) ? '#3D6B4F' : '#1E2620' }}>
                {formatDate(date)}
              </div>
              <div style={{ fontSize: 11, color: selected.includes(date) ? '#6B9E7E' : '#6B7066', marginTop: 3 }}>
                {selected.includes(date) ? '✓ Open for claims' : 'Tap to add'}
              </div>
            </button>
          ))}
        </div>

        {/* Delivery window */}
        <div style={{ background: '#fff', border: '1px solid #DDE8E0',
                      borderRadius: 14, padding: '18px 20px', marginBottom: 24 }}>
          <label style={labelStyle}>Preferred delivery window</label>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <input type="time" value={deliveryStart}
              onChange={e => setDeliveryStart(e.target.value)}
              style={timeInputStyle} />
            <span style={{ color: '#6B7066', fontSize: 14 }}>to</span>
            <input type="time" value={deliveryEnd}
              onChange={e => setDeliveryEnd(e.target.value)}
              style={timeInputStyle} />
          </div>
        </div>

        {/* Summary */}
        {selected.length > 0 && (
          <div style={{ background: '#EAF2ED', borderRadius: 12,
                        padding: '14px 16px', marginBottom: 24 }}>
            <p style={{ fontSize: 13, color: '#3D6B4F', margin: 0 }}>
              🗓 <strong>{selected.length} dates</strong> selected — your village
              will see these as open on your Kitchen.
            </p>
          </div>
        )}

        <button onClick={handleNext} disabled={selected.length === 0}
          style={{ width: '100%', padding: '14px', borderRadius: 10, border: 'none',
                   background: selected.length === 0 ? '#DDE8E0' : '#3D6B4F',
                   color: selected.length === 0 ? '#6B7066' : '#fff',
                   fontSize: 14, fontWeight: 500,
                   cursor: selected.length === 0 ? 'default' : 'pointer',
                   fontFamily: "'DM Sans', sans-serif" }}>
          Next: Choose Restaurants →
        </button>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: '#6B7066', letterSpacing: 1.5,
  textTransform: 'uppercase', display: 'block', marginBottom: 10
}

const timeInputStyle: React.CSSProperties = {
  flex: 1, padding: '10px 12px', borderRadius: 10,
  border: '1.5px solid #DDE8E0', fontSize: 14, background: '#FAFAF5',
  outline: 'none', fontFamily: "'DM Sans', sans-serif", color: '#1E2620'
}

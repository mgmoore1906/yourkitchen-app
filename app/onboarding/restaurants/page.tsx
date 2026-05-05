'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const RESTAURANTS = [
  { id: 'first-watch',    name: 'First Watch',              cuisine: 'American Breakfast & Brunch',    emoji: '🥞', rating: 4.7 },
  { id: 'toasted-yolk',   name: 'The Toasted Yolk Cafe',    cuisine: 'American Breakfast & Brunch',    emoji: '🍳', rating: 4.8 },
  { id: 'harvest',        name: 'Harvest Kitchen & Bakery', cuisine: 'Farm-to-Table Brunch',           emoji: '🌿', rating: 4.9 },
  { id: 'cava',           name: 'Cava',                     cuisine: 'Mediterranean',                  emoji: '🫙', rating: 4.7 },
  { id: 'kebab-shop',     name: 'The Kebab Shop',           cuisine: 'Mediterranean',                  emoji: '🥙', rating: 4.5 },
  { id: 'mod-fresh',      name: 'Mod Fresh',                cuisine: 'Healthy Fast-Casual',            emoji: '🥗', rating: 4.6 },
  { id: 'up-thai',        name: 'Up Thai Kitchen',          cuisine: 'Thai',                           emoji: '🍜', rating: 4.8 },
]

export default function OnboardingRestaurants() {
  const router = useRouter()
  const [picked, setPicked] = useState<string[]>([])

  const toggle = (id: string) => {
    setPicked(p =>
      p.includes(id)
        ? p.filter(x => x !== id)
        : p.length < 5
          ? [...p, id]
          : p
    )
  }

  const handleNext = () => {
    const existing = JSON.parse(localStorage.getItem('yk_onboarding') || '{}')
    localStorage.setItem('yk_onboarding', JSON.stringify({
      ...existing,
      restaurants: RESTAURANTS.filter(r => picked.includes(r.id))
    }))
    router.push('/onboarding/favorites')
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
                                background: i <= 2 ? '#3D6B4F' : '#DDE8E0' }} />
        ))}
      </div>

      <div style={{ padding: '24px 24px 0', maxWidth: 500, margin: '0 auto' }}>
        <p style={{ fontSize: 10, fontWeight: 500, letterSpacing: 3,
                    color: '#3D6B4F', textTransform: 'uppercase', margin: '0 0 8px' }}>
          Step 3 of 4
        </p>
        <h1 style={{ fontFamily: "'Lora', serif", fontSize: 26, fontWeight: 500,
                     color: '#1E2620', margin: '0 0 6px', letterSpacing: -0.5 }}>
          Which restaurants do you love?
        </h1>
        <p style={{ fontSize: 14, color: '#6B7066', margin: '0 0 8px', fontWeight: 300 }}>
          Your coordinators will order from these. All delivered via DoorDash.
        </p>
        <p style={{ fontSize: 12, color: '#6B9E7E', margin: '0 0 24px', fontWeight: 500 }}>
          {picked.length}/5 selected
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
          {RESTAURANTS.map(r => (
            <button key={r.id} onClick={() => toggle(r.id)}
              style={{ background: picked.includes(r.id) ? '#EAF2ED' : '#fff',
                       border: `2px solid ${picked.includes(r.id) ? '#3D6B4F' : '#DDE8E0'}`,
                       borderRadius: 16, padding: '14px 16px', cursor: 'pointer',
                       display: 'flex', alignItems: 'center', gap: 14,
                       transition: 'all 0.15s', fontFamily: "'DM Sans', sans-serif" }}>
              <div style={{ width: 44, height: 44, borderRadius: 12,
                            background: picked.includes(r.id) ? '#3D6B4F' : '#EAF2ED',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 22, flexShrink: 0 }}>
                {r.emoji}
              </div>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={{ fontFamily: "'Lora', serif", fontSize: 15,
                              fontWeight: 600, color: '#1E2620' }}>{r.name}</div>
                <div style={{ fontSize: 12, color: '#6B7066', fontWeight: 300, marginTop: 2 }}>
                  {r.cuisine} · ★ {r.rating} · DoorDash
                </div>
              </div>
              <div style={{ width: 22, height: 22, borderRadius: '50%',
                            border: `2px solid ${picked.includes(r.id) ? '#3D6B4F' : '#DDE8E0'}`,
                            background: picked.includes(r.id) ? '#3D6B4F' : 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#fff', fontSize: 13, flexShrink: 0 }}>
                {picked.includes(r.id) ? '✓' : ''}
              </div>
            </button>
          ))}
        </div>

        <button onClick={handleNext} disabled={picked.length === 0}
          style={{ width: '100%', padding: '14px', borderRadius: 10, border: 'none',
                   background: picked.length === 0 ? '#DDE8E0' : '#3D6B4F',
                   color: picked.length === 0 ? '#6B7066' : '#fff',
                   fontSize: 14, fontWeight: 500,
                   cursor: picked.length === 0 ? 'default' : 'pointer',
                   fontFamily: "'DM Sans', sans-serif" }}>
          Next: Pick My Favorites →
        </button>
      </div>
    </div>
  )
}

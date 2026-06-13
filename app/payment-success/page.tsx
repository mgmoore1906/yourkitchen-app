'use client'
import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense } from 'react'
import { PILOT_SURVEY_URL } from '@/lib/links'

const S = {
  sage: '#3D6B4F', sageMid: '#6B9E7E', sageLight: '#EAF2ED',
  cream: '#FAFAF5', forest: '#1E2620', stone: '#6B7066',
  border: '#DDE8E0', white: '#FFFFFF', amber: '#C17F47',
}

function PaymentSuccessContent() {
  const params = useSearchParams()
  const router = useRouter()
  const name = params.get('recipient') || 'your recipient'
  const slug = params.get('slug') || ''

  return (
    <div style={{ minHeight: '100vh', background: S.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans', sans-serif", padding: '32px 0' }}>
      <link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />
      <div style={{ textAlign: 'center', maxWidth: 440, padding: '0 32px' }}>

        {/* The emotional peak — lead with the heart and what they did */}
        <div style={{ position: 'relative', display: 'inline-block', marginBottom: 18 }}>
          <div style={{ fontSize: 64 }}>🧡</div>
        </div>

        <h1 style={{ fontFamily: "'Lora', serif", fontSize: 29, fontWeight: 500, color: S.forest, margin: '0 0 14px', letterSpacing: -0.5, lineHeight: 1.2 }}>
          You just showed up for {name}.
        </h1>

        <p style={{ fontSize: 15.5, color: S.stone, lineHeight: 1.75, fontWeight: 300, margin: '0 0 28px' }}>
          Your meal is on its way to becoming one less thing {name}{' '}has to worry about. They&rsquo;ll get a text to pick the moment that works, and the second they say yes, it&rsquo;s handled.
        </p>

        {/* Practical reassurance — kept, but secondary to the feeling */}
        <div style={{ background: S.white, border: `1px solid ${S.border}`, borderRadius: 16, padding: '18px 20px', textAlign: 'left', marginBottom: 14 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 17, flexShrink: 0 }}>💳</span>
            <div>
              <p style={{ fontSize: 13.5, color: S.forest, fontWeight: 500, margin: '0 0 3px' }}>Nothing&rsquo;s charged yet.</p>
              <p style={{ fontSize: 13, color: S.stone, fontWeight: 300, margin: 0, lineHeight: 1.6 }}>
                Your card is only charged once {name} confirms. If they decline or the timing doesn&rsquo;t work, the hold releases on its own — no charge, ever.
              </p>
            </div>
          </div>
        </div>

        <div style={{ background: S.sageLight, borderRadius: 16, padding: '18px 20px', textAlign: 'left', marginBottom: 28 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 17, flexShrink: 0 }}>📍</span>
            <div>
              <p style={{ fontSize: 13.5, color: S.sage, fontWeight: 500, margin: '0 0 3px' }}>You&rsquo;ll know when it arrives.</p>
              <p style={{ fontSize: 13, color: S.stone, fontWeight: 300, margin: 0, lineHeight: 1.6 }}>
                Once a courier is on the way, you&rsquo;ll get a tracking link so you can watch it land at their door.
              </p>
            </div>
          </div>
        </div>

        {/* Gentle invitation back into the village — keeps the warmth going */}
        {slug && (
          <button onClick={() => router.push(`/k/${slug}`)}
            style={{ width: '100%', padding: '14px', borderRadius: 12, border: 'none', background: S.sage, color: S.white, fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", marginBottom: 12 }}>
            Send another meal or leave a note 🧡
          </button>
        )}

        <p style={{ fontSize: 12.5, color: S.stone, fontWeight: 300, margin: 0, lineHeight: 1.6 }}>
          Thank you for being part of {name}&rsquo;s village.
        </p>
        <p style={{ fontSize: 12.5, marginTop: 14, marginBottom: 0 }}>
          <a href={PILOT_SURVEY_URL} target="_blank" rel="noopener" style={{ color: S.sage, fontWeight: 600, textDecoration: 'none' }}>Tell us how it went — 2-min pilot survey →</a>
        </p>
      </div>
    </div>
  )
}

export default function PaymentSuccess() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#FAFAF5' }} />}>
      <PaymentSuccessContent />
    </Suspense>
  )
}

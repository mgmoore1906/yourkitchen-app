'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const C = {
  sage: '#3D6B4F', sageMid: '#6B9E7E', sageLight: '#EAF2ED',
  cream: '#FAFAF5', forest: '#1E2620', stone: '#6B7066',
  border: '#DDE8E0', white: '#FFFFFF', gold: '#C17F47', heart: '#C0463B',
  serif: "'Lora', Georgia, serif", sans: "'DM Sans', system-ui, sans-serif",
}

type PlanKey = 'care_monthly' | 'care_annual' | 'careplus_monthly' | 'careplus_annual'

export default function PlansPage() {
  const supabase = createClient()
  const [userId, setUserId] = useState<string | null>(null)
  const [tier, setTier] = useState<string>('')
  const [annual, setAnnual] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser()
      if (!data?.user) { window.location.href = '/login'; return }
      setUserId(data.user.id)
      const { data: prof } = await supabase.from('profiles').select('tier').eq('id', data.user.id).single()
      setTier(prof?.tier || '')
    })()
  }, [supabase])

  async function subscribe(plan: PlanKey) {
    if (!userId) return
    setError(null); setBusy(plan)
    try {
      const res = await fetch('/api/subscribe-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, plan }),
      })
      const data = await res.json()
      if (data?.url) { window.location.href = data.url }
      else { setError(data?.error || 'Could not start checkout.'); setBusy(null) }
    } catch (e: any) {
      setError(e?.message || 'Network error.'); setBusy(null)
    }
  }

  const isCarePlus = tier === 'careplus' || tier === 'annual'
  const isCare = tier === 'care'
  const isFounding = tier === 'founding'

  const toggleBtn = (label: string, on: boolean, onClick: () => void): React.CSSProperties => ({
    flex: 1, padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
    fontFamily: C.sans, fontSize: 13, fontWeight: 600,
    background: on ? C.white : 'transparent', color: on ? C.forest : C.stone,
    boxShadow: on ? '0 1px 3px rgba(30,38,32,0.12)' : 'none',
  })

  function PlanCard({
    name, blurb, monthly, annualPrice, plan, accent, limits, featured,
  }: { name: string; blurb: string; monthly: string; annualPrice: string; plan: PlanKey; accent: string; limits: string[]; featured?: boolean }) {
    const current = (name === 'Care' && isCare) || (name === 'Care+' && isCarePlus)
    return (
      <div style={{ background: C.white, border: `1px solid ${featured ? C.sageMid : C.border}`, borderRadius: 16, padding: 24, position: 'relative', display: 'flex', flexDirection: 'column' }}>
        {featured && <span style={{ position: 'absolute', top: -10, right: 20, background: C.sage, color: C.white, fontSize: 10, fontWeight: 700, padding: '3px 11px', borderRadius: 10 }}>Most chosen</span>}
        <div style={{ fontFamily: C.serif, fontSize: 21, fontWeight: 600, color: C.forest }}>{name}</div>
        <div style={{ fontSize: 13, color: C.stone, marginTop: 4, lineHeight: 1.5 }}>{blurb}</div>
        <div style={{ marginTop: 16, marginBottom: 4 }}>
          <span style={{ fontFamily: C.serif, fontSize: 30, fontWeight: 600, color: C.forest }}>{annual ? annualPrice : monthly}</span>
          <span style={{ fontSize: 13, color: C.stone, marginLeft: 4 }}>/ {annual ? 'year' : 'month'}</span>
        </div>
        {annual && <div style={{ fontSize: 12, color: C.sage, fontWeight: 600, marginBottom: 4 }}>Two months free</div>}
        <ul style={{ listStyle: 'none', margin: '16px 0', padding: 0, flex: 1 }}>
          {limits.map((l, i) => (
            <li key={i} style={{ fontSize: 13, color: C.forest, padding: '5px 0 5px 20px', position: 'relative', lineHeight: 1.4 }}>
              <span style={{ position: 'absolute', left: 0, top: 5, color: accent }}>✓</span>{l}
            </li>
          ))}
        </ul>
        {current ? (
          <div style={{ textAlign: 'center', padding: '12px', borderRadius: 10, background: C.sageLight, color: C.sage, fontSize: 14, fontWeight: 600 }}>Your current plan</div>
        ) : isFounding ? (
          <div style={{ textAlign: 'center', padding: '12px', borderRadius: 10, background: '#FBF0E4', color: C.gold, fontSize: 13, fontWeight: 600 }}>Included with Founding</div>
        ) : (
          <button onClick={() => subscribe(plan)} disabled={!!busy} style={{
            padding: '13px 16px', borderRadius: 10, border: 'none', cursor: busy ? 'default' : 'pointer',
            fontFamily: C.sans, fontSize: 15, fontWeight: 600, color: C.white,
            background: busy === plan ? C.sageMid : (featured ? C.sage : C.forest),
          }}>
            {busy === plan ? 'Starting…' : `Choose ${name}`}
          </button>
        )}
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: C.cream, padding: '40px 18px', fontFamily: C.sans }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 26 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.sageMid, marginBottom: 8 }}>Care &amp; Care+</div>
          <h1 style={{ fontFamily: C.serif, fontWeight: 600, fontSize: 28, color: C.forest, margin: 0 }}>Choose your plan</h1>
          <p style={{ fontSize: 14, color: C.stone, lineHeight: 1.6, marginTop: 10, maxWidth: 460, marginLeft: 'auto', marginRight: 'auto' }}>
            {tier === 'trial'
              ? 'You’re on your trial right now. Pick a plan to keep your kitchen going when it ends.'
              : 'Keep your kitchen covered. Change or cancel anytime.'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 4, background: C.sageLight, borderRadius: 10, padding: 4, maxWidth: 260, margin: '0 auto 24px' }}>
          <button onClick={() => setAnnual(false)} style={toggleBtn('Monthly', !annual, () => setAnnual(false))}>Monthly</button>
          <button onClick={() => setAnnual(true)} style={toggleBtn('Annual', annual, () => setAnnual(true))}>Annual · save</button>
        </div>

        {error && <div style={{ maxWidth: 460, margin: '0 auto 16px', fontSize: 13, color: C.heart, textAlign: 'center' }}>{error}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <PlanCard
            name="Care" accent={C.sage}
            blurb="Your kitchen, covered."
            monthly="$10" annualPrice="$100"
            plan={annual ? 'care_annual' : 'care_monthly'}
            limits={['Up to 8 restaurants', '8 meals per restaurant', 'Automatic menu import', 'The full village']}
          />
          <PlanCard
            name="Care+" accent={C.sage} featured
            blurb="The full village and more."
            monthly="$20" annualPrice="$200"
            plan={annual ? 'careplus_annual' : 'careplus_monthly'}
            limits={['Unlimited restaurants & meals', 'Up to 3 kitchens', 'Custom kitchen link', 'Priority support']}
          />
        </div>

        <div style={{ textAlign: 'center', marginTop: 26 }}>
          <a href="/tiers" style={{ fontSize: 13, color: C.gold, fontWeight: 600, textDecoration: 'none' }}>
            Looking to become a Founding Member? →
          </a>
        </div>
      </div>
    </div>
  )
}

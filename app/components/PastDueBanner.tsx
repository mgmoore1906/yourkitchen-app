'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

// Shows only when the signed-in user's last Care+ charge failed (profiles.past_due).
// Self-contained: reads its own flag, so it can be dropped into any layout/page
// without threading state through. The button reuses /api/billing-portal, which
// opens the Stripe Customer Portal for the session user to update their card.
export default function PastDueBanner() {
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    const supabase = createClient()
    ;(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data } = await supabase
          .from('profiles')
          .select('past_due')
          .eq('id', user.id)
          .single()
        if (data?.past_due) setShow(true)
      } catch {
        // Never block the app on a banner check.
      }
    })()
  }, [])

  const openPortal = async () => {
    setLoading(true); setErr('')
    try {
      const res = await fetch('/api/billing-portal', { method: 'POST' })
      const data = await res.json()
      if (data?.url) { window.location.href = data.url; return }
      setErr(data?.error || 'Could not open billing right now. Please try again.')
    } catch {
      setErr('Could not open billing right now. Please try again.')
    }
    setLoading(false)
  }

  if (!show) return null

  return (
    <div style={{ background: '#FDE8E8', borderBottom: '1px solid #B94040', padding: '11px 18px', fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13.5, color: '#7A1F1F', fontWeight: 500, lineHeight: 1.4 }}>
          Your last Care+ payment didn&rsquo;t go through. Update your card to keep your subscription active.
        </span>
        <button onClick={openPortal} disabled={loading}
          style={{ background: '#B94040', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: loading ? 'default' : 'pointer', fontFamily: "'DM Sans', sans-serif", whiteSpace: 'nowrap' }}>
          {loading ? 'Opening…' : 'Update your card'}
        </button>
      </div>
      {err && <p style={{ textAlign: 'center', fontSize: 12, color: '#7A1F1F', margin: '6px 0 0' }}>{err}</p>}
    </div>
  )
}

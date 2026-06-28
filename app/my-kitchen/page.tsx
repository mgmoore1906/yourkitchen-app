'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

const C = {
  sage: '#3D6B4F', sageMid: '#6B9E7E', sageLight: '#EAF2ED',
  cream: '#FAFAF5', forest: '#1E2620', stone: '#6B7066',
  border: '#DDE8E0', white: '#FFFFFF', gold: '#C17F47', heart: '#C0463B',
  serif: "'Lora', Georgia, serif", sans: "'DM Sans', system-ui, sans-serif",
}

function e164(raw: string): string | null {
  const d = (raw || '').replace(/\D/g, '')
  if (d.length === 10) return '+1' + d
  if (d.length === 11 && d.startsWith('1')) return '+' + d
  return null
}

type Kitchen = { id: string; name: string; slug: string; address: string | null }

export default function MyKitchenPage() {
  const supabase = createClient()

  const [phase, setPhase] = useState<'loading' | 'phone' | 'code' | 'ready'>('loading')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [kitchen, setKitchen] = useState<Kitchen | null>(null)
  const [noKitchen, setNoKitchen] = useState(false)
  const [address, setAddress] = useState('')
  const [savedAddr, setSavedAddr] = useState(false)

  const loadKitchen = useCallback(async () => {
    try {
      const res = await fetch('/api/recipient/kitchen')
      const data = await res.json()
      if (res.ok && data.kitchens?.length) {
        const k: Kitchen = data.kitchens[0]
        setKitchen(k)
        setAddress(k.address || '')
        setNoKitchen(false)
      } else {
        setNoKitchen(true)
      }
    } catch {
      setNoKitchen(true)
    }
    setPhase('ready')
  }, [])

  // If they already have a session, skip the login and go straight to their kitchen.
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser()
      if (data?.user) await loadKitchen()
      else setPhase('phone')
    })()
  }, [supabase, loadKitchen])

  async function sendCode() {
    setError(null)
    const p = e164(phone)
    if (!p) { setError('Enter a valid US mobile number.'); return }
    setBusy(true)
    const { error: e } = await supabase.auth.signInWithOtp({ phone: p })
    setBusy(false)
    if (e) { setError(e.message || 'Could not send the code.'); return }
    setPhase('code')
  }

  async function verify() {
    setError(null)
    const p = e164(phone)
    if (!p || !code.trim()) { setError('Enter the code we texted you.'); return }
    setBusy(true)
    const { error: e } = await supabase.auth.verifyOtp({ phone: p, token: code.trim(), type: 'sms' })
    if (e) { setBusy(false); setError(e.message || 'That code didn’t match.'); return }
    await loadKitchen()
    setBusy(false)
  }

  async function saveAddress() {
    if (!kitchen) return
    setError(null); setSavedAddr(false); setBusy(true)
    try {
      const res = await fetch('/api/recipient/kitchen', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kitchen_id: kitchen.id, address: address.trim() }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) setError(data.error || 'Could not save the address.')
      else { setSavedAddr(true); setTimeout(() => setSavedAddr(false), 2200) }
    } catch (e: any) {
      setError(e?.message || 'Network error.')
    } finally {
      setBusy(false)
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setKitchen(null); setNoKitchen(false); setPhone(''); setCode(''); setPhase('phone')
  }

  const input: React.CSSProperties = {
    width: '100%', fontFamily: C.sans, fontSize: 15, color: C.forest,
    padding: '11px 13px', borderRadius: 10, border: `1px solid ${C.border}`,
    background: C.white, outline: 'none', boxSizing: 'border-box',
  }
  const primaryBtn: React.CSSProperties = {
    fontFamily: C.sans, fontSize: 15, fontWeight: 600, color: C.white,
    background: busy ? C.sageMid : C.sage, border: 'none', borderRadius: 10,
    padding: '13px 16px', cursor: busy ? 'default' : 'pointer', width: '100%',
  }
  const card: React.CSSProperties = {
    background: C.white, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24,
  }

  return (
    <div style={{ minHeight: '100vh', background: C.cream, padding: '40px 18px', fontFamily: C.sans }}>
      <div style={{ maxWidth: 440, margin: '0 auto' }}>

        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.sageMid, marginBottom: 8 }}>
            Your kitchen
          </div>
          <h1 style={{ fontFamily: C.serif, fontWeight: 600, fontSize: 26, color: C.forest, lineHeight: 1.2, margin: 0 }}>
            {phase === 'ready' && kitchen ? kitchen.name : 'Set up your kitchen'}
          </h1>
        </div>

        {phase === 'loading' && (
          <div style={{ ...card, color: C.stone, fontSize: 14 }}>One moment…</div>
        )}

        {phase === 'phone' && (
          <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ fontSize: 14, color: C.stone, lineHeight: 1.6, margin: 0 }}>
              Enter the mobile number your kitchen was set up with. We’ll text you a code — no password.
            </p>
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(555) 123-4567" inputMode="tel" style={input} />
            {error && <div style={{ fontSize: 13, color: C.heart }}>{error}</div>}
            <button onClick={sendCode} disabled={busy} style={primaryBtn}>{busy ? 'Sending…' : 'Text me a code'}</button>
          </div>
        )}

        {phase === 'code' && (
          <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ fontSize: 14, color: C.stone, lineHeight: 1.6, margin: 0 }}>
              We texted a code to {phone}. Enter it below.
            </p>
            <input value={code} onChange={e => setCode(e.target.value)} placeholder="6-digit code" inputMode="numeric" style={input} />
            {error && <div style={{ fontSize: 13, color: C.heart }}>{error}</div>}
            <button onClick={verify} disabled={busy} style={primaryBtn}>{busy ? 'Checking…' : 'Verify'}</button>
            <button onClick={() => { setPhase('phone'); setCode(''); setError(null) }} style={{ background: 'transparent', border: 'none', color: C.sage, fontFamily: C.sans, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Use a different number
            </button>
          </div>
        )}

        {phase === 'ready' && noKitchen && (
          <div style={{ ...card }}>
            <div style={{ fontFamily: C.serif, fontSize: 18, fontWeight: 600, color: C.forest, marginBottom: 6 }}>
              No kitchen yet for this number.
            </div>
            <p style={{ fontSize: 14, color: C.stone, lineHeight: 1.6 }}>
              Whoever is setting up meals for you will create your kitchen — then you can come back here to add your favorites. If you think this is a mistake, double-check the number.
            </p>
            <button onClick={signOut} style={{ marginTop: 16, background: 'transparent', border: `1px solid ${C.border}`, color: C.sage, fontFamily: C.sans, fontSize: 13, fontWeight: 600, borderRadius: 10, padding: '10px 16px', cursor: 'pointer' }}>
              Try another number
            </button>
          </div>
        )}

        {phase === 'ready' && kitchen && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={card}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: C.sage, marginBottom: 10 }}>
                Where should meals go?
              </div>
              <label style={{ display: 'block', fontFamily: C.sans, fontSize: 13, fontWeight: 600, color: C.forest, marginBottom: 6 }}>
                Delivery address
              </label>
              <input value={address} onChange={e => setAddress(e.target.value)} placeholder="123 Main St, City, ST 00000" style={input} />
              {error && <div style={{ fontSize: 13, color: C.heart, marginTop: 8 }}>{error}</div>}
              <button onClick={saveAddress} disabled={busy} style={{ ...primaryBtn, marginTop: 12 }}>
                {busy ? 'Saving…' : savedAddr ? 'Saved ✓' : 'Save address'}
              </button>
            </div>

            <div style={{ ...card, background: C.sageLight, border: `1px solid ${C.border}` }}>
              <div style={{ fontFamily: C.serif, fontSize: 16, fontWeight: 600, color: C.forest, marginBottom: 4 }}>
                Coming next
              </div>
              <p style={{ fontSize: 13, color: C.stone, lineHeight: 1.6, margin: 0 }}>
                Soon you’ll add your favorite restaurants and meals, and pick the days you’d like dinner — all from right here. We’ll have it ready shortly.
              </p>
            </div>

            <button onClick={signOut} style={{ background: 'transparent', border: 'none', color: C.stone, fontFamily: C.sans, fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 4 }}>
              Sign out
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

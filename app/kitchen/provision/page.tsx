'use client'

import { useState } from 'react'

const C = {
  sage: '#3D6B4F', sageMid: '#6B9E7E', sageLight: '#EAF2ED',
  cream: '#FAFAF5', forest: '#1E2620', stone: '#6B7066',
  border: '#DDE8E0', white: '#FFFFFF', gold: '#C17F47', heart: '#C0463B',
  serif: "'Lora', Georgia, serif", sans: "'DM Sans', system-ui, sans-serif",
}

export default function ProvisionKitchenPage() {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [kitchenName, setKitchenName] = useState('')
  const [address, setAddress] = useState('')
  const [notify, setNotify] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ slug: string; share_url: string } | null>(null)
  const [copied, setCopied] = useState(false)

  async function submit() {
    setError(null)
    if (!name.trim() || !phone.trim()) {
      setError('Add the recipient’s name and phone.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/provision-kitchen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient_name: name.trim(),
          recipient_phone: phone.trim(),
          kitchen_name: kitchenName.trim() || undefined,
          address: address.trim() || undefined,
          notify_recipient: notify,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(data.error || 'Something went wrong.')
      } else {
        setResult({ slug: data.slug, share_url: data.share_url })
      }
    } catch (e: any) {
      setError(e?.message || 'Network error.')
    } finally {
      setLoading(false)
    }
  }

  async function copy() {
    if (!result) return
    try {
      await navigator.clipboard.writeText(result.share_url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch { /* clipboard may be blocked; the link is visible to copy manually */ }
  }

  const labelStyle: React.CSSProperties = {
    display: 'block', fontFamily: C.sans, fontSize: 13, fontWeight: 600,
    color: C.forest, marginBottom: 6,
  }
  const inputStyle: React.CSSProperties = {
    width: '100%', fontFamily: C.sans, fontSize: 15, color: C.forest,
    padding: '11px 13px', borderRadius: 10, border: `1px solid ${C.border}`,
    background: C.white, outline: 'none', boxSizing: 'border-box',
  }

  return (
    <div style={{ minHeight: '100vh', background: C.cream, padding: '40px 18px', fontFamily: C.sans }}>
      <div style={{ maxWidth: 460, margin: '0 auto' }}>

        <div style={{ marginBottom: 22 }}>
          <div style={{ fontFamily: C.sans, fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.sageMid, marginBottom: 8 }}>
            Set up a kitchen
          </div>
          <h1 style={{ fontFamily: C.serif, fontWeight: 600, fontSize: 26, color: C.forest, lineHeight: 1.2, margin: 0 }}>
            For someone you’re caring for
          </h1>
          <p style={{ fontSize: 14, color: C.stone, lineHeight: 1.6, marginTop: 10 }}>
            Create a kitchen for a loved one in a hard season. You’ll get a link to share with their village right away — and they’ll be able to add their own favorite spots and pick the days they’d like dinner.
          </p>
        </div>

        {result ? (
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24 }}>
            <div style={{ fontFamily: C.serif, fontSize: 19, fontWeight: 600, color: C.sage, marginBottom: 6 }}>
              Kitchen created.
            </div>
            <p style={{ fontSize: 14, color: C.stone, lineHeight: 1.6, marginBottom: 16 }}>
              Share this link with {name.trim()}’s friends and family — anyone with it can claim a day and send a meal. No login needed for them.
            </p>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input readOnly value={result.share_url} style={{ ...inputStyle, fontSize: 13, color: C.sage }} />
              <button onClick={copy} style={{
                fontFamily: C.sans, fontSize: 13, fontWeight: 600, color: C.white,
                background: C.sage, border: 'none', borderRadius: 10, padding: '11px 16px',
                cursor: 'pointer', whiteSpace: 'nowrap',
              }}>
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <p style={{ fontSize: 12.5, color: C.stone, lineHeight: 1.55, marginTop: 16, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
              Next: {name.trim()} will be able to set up their own restaurants, meals, and calendar from a text link. Until then, you can curate it for them.
            </p>
            <button onClick={() => { setResult(null); setName(''); setPhone(''); setKitchenName(''); setAddress(''); setNotify(false) }} style={{
              marginTop: 18, fontFamily: C.sans, fontSize: 13, fontWeight: 600, color: C.sage,
              background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 10,
              padding: '10px 16px', cursor: 'pointer', width: '100%',
            }}>
              Set up another kitchen
            </button>
          </div>
        ) : (
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={labelStyle}>Their name</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Maria Alvarez" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Their mobile number</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(555) 123-4567" inputMode="tel" style={inputStyle} />
              <p style={{ fontSize: 12, color: C.stone, marginTop: 6, lineHeight: 1.5 }}>
                This is how they’ll confirm meals and, soon, set up their kitchen by text.
              </p>
            </div>
            <div>
              <label style={labelStyle}>Kitchen name <span style={{ color: C.stone, fontWeight: 400 }}>· optional</span></label>
              <input value={kitchenName} onChange={e => setKitchenName(e.target.value)} placeholder="Defaults to “Maria’s Kitchen”" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Delivery address <span style={{ color: C.stone, fontWeight: 400 }}>· optional</span></label>
              <input value={address} onChange={e => setAddress(e.target.value)} placeholder="They can add this themselves later" style={inputStyle} />
            </div>

            <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer', fontSize: 13, color: C.forest, lineHeight: 1.5 }}>
              <input type="checkbox" checked={notify} onChange={e => setNotify(e.target.checked)} style={{ marginTop: 2, accentColor: C.sage }} />
              <span>Text them a heads-up that a kitchen was created for them.</span>
            </label>

            {error && (
              <div style={{ fontSize: 13, color: C.heart, background: '#FBEEEC', border: '1px solid #F0D4CF', borderRadius: 10, padding: '10px 12px' }}>
                {error}
              </div>
            )}

            <button onClick={submit} disabled={loading} style={{
              fontFamily: C.sans, fontSize: 15, fontWeight: 600, color: C.white,
              background: loading ? C.sageMid : C.sage, border: 'none', borderRadius: 10,
              padding: '13px 16px', cursor: loading ? 'default' : 'pointer', marginTop: 4,
            }}>
              {loading ? 'Creating…' : 'Create their kitchen'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

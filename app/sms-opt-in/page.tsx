const S = {
  sage: '#3D6B4F', sageMid: '#6B9E7E', sageLight: '#EAF2ED',
  cream: '#FAFAF5', forest: '#1E2620', stone: '#6B7066', border: '#DDE8E0', white: '#FFFFFF',
}

export const metadata = {
  title: 'SMS Opt-In & Consent — YourKitchen',
  description: 'How users consent to receive text messages from YourKitchen.',
}

export default function SmsOptInPage() {
  const h2: React.CSSProperties = { fontFamily: "'Lora', serif", fontSize: 21, fontWeight: 500, color: S.forest, margin: '32px 0 12px' }
  const p:  React.CSSProperties = { fontSize: 15, color: S.forest, margin: '0 0 14px', lineHeight: 1.65 }
  const li: React.CSSProperties = { fontSize: 15, color: S.forest, marginBottom: 8, lineHeight: 1.6 }
  const msg: React.CSSProperties = { background: '#F0F4F1', borderRadius: 10, padding: '14px 16px', fontSize: 14, color: S.forest, marginBottom: 10, fontFamily: 'monospace', lineHeight: 1.6 }
  const stepNum: React.CSSProperties = { width: 28, height: 28, borderRadius: '50%', background: S.sageLight, color: S.sage, fontFamily: "'Lora', serif", fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }

  return (
    <div style={{ minHeight: '100vh', background: S.cream, fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />
      <div style={{ background: S.cream, borderBottom: `0.5px solid ${S.border}`, padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50 }}>
        <a href="/" style={{ display: 'flex', flexDirection: 'column', lineHeight: 1, textDecoration: 'none' }}>
          <span style={{ fontSize: 9, fontWeight: 500, letterSpacing: 5, color: S.sageMid, textTransform: 'uppercase' }}>Your</span>
          <span style={{ fontFamily: "'Lora', serif", fontSize: 20, fontWeight: 500, color: S.forest }}>Kitchen</span>
        </a>
        <a href="/dashboard" style={{ fontSize: 13, color: S.sage, textDecoration: 'none', fontWeight: 500 }}>← Back</a>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px 80px' }}>
        <h1 style={{ fontFamily: "'Lora', serif", fontSize: 32, fontWeight: 500, color: S.forest, letterSpacing: '-0.5px', marginBottom: 8 }}>SMS Opt-In &amp; Consent</h1>
        <p style={{ fontSize: 15, color: S.stone, marginBottom: 36 }}>How users consent to receive text messages from YourKitchen.</p>

        <p style={p}>YourKitchen LLC operates a meal coordination platform. This page documents our SMS program, how end users provide express written consent to receive messages, and the disclosures shown at the point of opt-in. It is provided for transparency and for messaging-compliance review.</p>

        <h2 style={h2}>How users opt in</h2>
        <p style={p}>Users provide consent during account creation at <strong>app.yourkitchen.app</strong>. As the first step of onboarding, the user is shown a consent checkbox that must be actively checked before they can continue — the "Next" button remains disabled until the box is checked. Consent is never pre-checked or assumed.</p>

        <div style={{ background: S.sageLight, border: `1.5px solid ${S.sage}`, borderRadius: 12, padding: 20, margin: '20px 0' }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: S.sage, marginBottom: 12 }}>Exact consent language shown at opt-in</p>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ width: 22, height: 22, borderRadius: 6, background: S.sage, display: 'flex', alignItems: 'center', justifyContent: 'center', color: S.white, fontSize: 14, flexShrink: 0, marginTop: 2 }}>✓</div>
            <div style={{ fontSize: 14, color: S.forest, lineHeight: 1.6 }}>
              I agree to receive recurring SMS text messages from YourKitchen, including meal proposals, confirmations, and delivery updates. Message frequency varies by activity. Message &amp; data rates may apply. Reply STOP to opt out or HELP for help. See our <a href="/terms" style={{ color: S.sage }}>Terms</a> and <a href="/privacy" style={{ color: S.sage }}>Privacy Policy</a>.
            </div>
          </div>
        </div>

        <h2 style={h2}>The opt-in steps</h2>
        {[
          'User visits app.yourkitchen.app and begins account creation.',
          'User enters their name and mobile phone number.',
          'User actively checks the consent box shown above. The box is unchecked by default.',
          'User taps "Next" (disabled until the box is checked) to complete opt-in.',
        ].map((step, i) => (
          <div key={i} style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
            <div style={stepNum}>{i + 1}</div>
            <div style={{ fontSize: 15, color: S.forest, lineHeight: 1.6, paddingTop: 2 }}>{step}</div>
          </div>
        ))}

        <h2 style={h2}>What messages we send</h2>
        <ul style={{ margin: '0 0 16px 22px' }}>
          <li style={li}><strong>Meal proposals</strong> — when someone wants to send the user a meal, requiring a Y/N reply to confirm.</li>
          <li style={li}><strong>Confirmations</strong> — when a meal is confirmed and dispatched.</li>
          <li style={li}><strong>Delivery updates</strong> — when a meal is on the way or delivered.</li>
        </ul>
        <p style={{ fontSize: 14, color: S.stone, lineHeight: 1.6 }}>Message frequency varies based on how often the user receives meal offers. These are transactional, conversational messages — not marketing.</p>

        <h2 style={h2}>Sample messages</h2>
        <div style={msg}>YourKitchen: Marques wants to send you dinner on Tue, Jun 10 — Pad Thai from Up Thai Kitchen. Reply Y to confirm or N to decline. Msg &amp; data rates may apply. Reply STOP to opt out.</div>
        <div style={msg}>YourKitchen: Your meal is confirmed! Peri-Peri Chicken from Peli Peli Kitchen is on its way. Track: app.yourkitchen.app/track/4821. Msg &amp; data rates may apply. Reply STOP to opt out.</div>
        <div style={msg}>YourKitchen: Your meal was delivered. Thank you for using YourKitchen. Msg &amp; data rates may apply. Reply STOP to opt out.</div>

        <h2 style={h2}>Opt-out &amp; help</h2>
        <p style={p}>Users can reply <strong>STOP</strong> at any time to immediately unsubscribe from all messages. Replying <strong>HELP</strong> returns support contact information. These keywords are honored automatically.</p>

        <h2 style={h2}>Consent is never shared</h2>
        <p style={p}>Mobile opt-in consent and phone numbers are never shared with third parties or affiliates for marketing purposes. Phone numbers are used solely to operate the YourKitchen meal coordination service.</p>

        <div style={{ marginTop: 48, paddingTop: 24, borderTop: `0.5px solid ${S.border}`, fontSize: 13, color: S.stone }}>
          YourKitchen LLC · Waller, TX · <a href="mailto:marques@yourkitchen.app" style={{ color: S.stone }}>marques@yourkitchen.app</a><br />
          <a href="/terms" style={{ color: S.stone }}>Terms</a> · <a href="/privacy" style={{ color: S.stone }}>Privacy Policy</a>
        </div>
      </div>
    </div>
  )
}

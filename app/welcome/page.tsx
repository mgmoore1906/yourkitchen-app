// app/welcome/page.tsx
// Where Stripe Payment Links land people after they pay WITHOUT an account yet.
// The plan is already saved against their email (pending_entitlements); creating
// an account with that same email claims it. No session lookup needed here.
import Link from 'next/link'

const C = {
  sage: '#3D6B4F', sageLight: '#EAF2ED', cream: '#FAFAF5',
  forest: '#1E2620', stone: '#6B7066', border: '#DDE8E0', white: '#FFFFFF',
  serif: "'Lora', Georgia, serif", sans: "'DM Sans', system-ui, sans-serif",
}

export default function WelcomePage() {
  return (
    <div style={{ minHeight: '100vh', background: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 18px', fontFamily: C.sans }}>
      <div style={{ maxWidth: 460, width: '100%', background: C.white, border: `1px solid ${C.border}`, borderRadius: 18, padding: 36, textAlign: 'center' }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: C.sageLight, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={C.sage} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#6B9E7E', marginBottom: 10 }}>
          Payment received
        </div>
        <h1 style={{ fontFamily: C.serif, fontWeight: 600, fontSize: 26, color: C.forest, lineHeight: 1.25, margin: '0 0 14px' }}>
          You’re in. Thank you.
        </h1>
        <p style={{ fontSize: 15, color: C.stone, lineHeight: 1.65, margin: '0 0 8px' }}>
          Your plan is reserved. The last step is to create your account — use the
          <b style={{ color: C.forest }}> same email you just paid with</b>, and your plan
          will be waiting on the other side.
        </p>
        <p style={{ fontSize: 13.5, color: C.stone, lineHeight: 1.6, margin: '0 0 26px' }}>
          You can do this now or whenever you’re ready — nothing expires.
        </p>

        <Link href="/signup" style={{ display: 'block', fontFamily: C.sans, fontSize: 15, fontWeight: 600, color: C.white, background: C.sage, borderRadius: 11, padding: '14px 18px', textDecoration: 'none' }}>
          Create my account
        </Link>
        <Link href="/login" style={{ display: 'inline-block', marginTop: 16, fontSize: 13.5, fontWeight: 600, color: C.sage, textDecoration: 'none' }}>
          Already have an account? Log in
        </Link>

        <p style={{ fontSize: 12, color: C.stone, lineHeight: 1.6, margin: '24px 0 0' }}>
          A receipt is on its way to your inbox. Questions? <a href="mailto:support@yourkitchen.app" style={{ color: C.sage }}>support@yourkitchen.app</a>
        </p>
      </div>
    </div>
  )
}

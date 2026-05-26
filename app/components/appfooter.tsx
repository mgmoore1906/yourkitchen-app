// FILE: components/AppFooter.tsx
// Commit this file FIRST before the dashboard page — dashboard imports it.

const S = {
  forest: '#1E2620',
  sageMid: '#6B9E7E',
  muted: 'rgba(255,255,255,0.3)',
  dimmer: 'rgba(255,255,255,0.18)',
}

export default function AppFooter() {
  return (
    <footer style={{ background: S.forest, padding: '52px 40px', textAlign: 'center', fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ fontSize: 9, fontWeight: 500, letterSpacing: 5, color: S.sageMid, textTransform: 'uppercase', marginBottom: 2 }}>Your</div>
      <div style={{ fontFamily: "'Lora', serif", fontSize: 28, fontWeight: 500, color: '#FFFFFF', letterSpacing: -0.5, marginBottom: 10 }}>Kitchen</div>
      <p style={{ fontFamily: "'Lora', serif", fontStyle: 'italic', fontSize: 14, color: S.sageMid, margin: '0 0 24px' }}>"Your kitchen, covered."</p>
      <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '6px 0', fontSize: 12, marginBottom: 20 }}>
        {[
          { label: 'yourkitchen.app', href: 'https://yourkitchen.app' },
          { label: 'marques@yourkitchen.app', href: 'mailto:marques@yourkitchen.app' },
          { label: 'FAQ', href: '/faq' },
          { label: 'Terms', href: '/terms' },
          { label: 'Privacy', href: '/privacy' },
          { label: 'Hockley, TX', href: null },
        ].map((link, i) => (
          <span key={link.label}>
            {i > 0 && <span style={{ color: S.muted, margin: '0 10px' }}>·</span>}
            {link.href
              ? <a href={link.href} style={{ color: S.muted, textDecoration: 'none' }}>{link.label}</a>
              : <span style={{ color: S.muted }}>{link.label}</span>
            }
          </span>
        ))}
      </div>
      <p style={{ fontSize: 11, color: S.dimmer, margin: 0 }}>© 2026 YourKitchen LLC · Built with love for Danielle · All rights reserved</p>
    </footer>
  )
}

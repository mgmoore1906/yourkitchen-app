// FILE: components/AppFooter.tsx
// New shared footer — matches yourkitchen.app website footer exactly.
// Import and drop at the bottom of any page that needs it.
// Usage: import AppFooter from '@/components/AppFooter'  then  <AppFooter />

const S = {
  forest: '#1E2620',
  sageMid: '#6B9E7E',
  border: 'rgba(255,255,255,0.1)',
  muted: 'rgba(255,255,255,0.3)',
  dimmer: 'rgba(255,255,255,0.18)',
}

export default function AppFooter() {
  return (
    <footer style={{
      background: S.forest,
      padding: '52px 40px',
      textAlign: 'center',
      fontFamily: "'DM Sans', sans-serif",
    }}>
      {/* Logo */}
      <div style={{
        fontSize: 9,
        fontWeight: 500,
        letterSpacing: 5,
        color: S.sageMid,
        textTransform: 'uppercase',
        marginBottom: 2,
      }}>
        Your
      </div>
      <div style={{
        fontFamily: "'Lora', serif",
        fontSize: 28,
        fontWeight: 500,
        color: '#FFFFFF',
        letterSpacing: -0.5,
        marginBottom: 10,
      }}>
        Kitchen
      </div>

      {/* Tagline */}
      <p style={{
        fontFamily: "'Lora', serif",
        fontStyle: 'italic',
        fontSize: 14,
        color: S.sageMid,
        margin: '0 0 24px',
      }}>
        "Your kitchen, covered."
      </p>

      {/* Links */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        flexWrap: 'wrap',
        gap: '6px 16px',
        fontSize: 12,
        marginBottom: 20,
      }}>
        {[
          { label: 'yourkitchen.app', href: 'https://yourkitchen.app' },
          { label: 'marques@yourkitchen.app', href: 'mailto:marques@yourkitchen.app' },
          { label: 'FAQ', href: '/faq' },
          { label: 'Terms', href: '/terms' },
          { label: 'Privacy', href: '/privacy' },
          { label: 'Hockley, TX', href: null },
        ].map((link, i) => (
          <span key={link.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 16 }}>
            {i > 0 && <span style={{ color: S.muted }}>·</span>}
            {link.href ? (
              <a
                href={link.href}
                style={{
                  color: S.muted,
                  textDecoration: 'none',
                  transition: 'color 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = S.sageMid)}
                onMouseLeave={e => (e.currentTarget.style.color = S.muted)}
              >
                {link.label}
              </a>
            ) : (
              <span style={{ color: S.muted }}>{link.label}</span>
            )}
          </span>
        ))}
      </div>

      {/* Copyright */}
      <p style={{ fontSize: 11, color: S.dimmer, margin: 0 }}>
        © 2026 YourKitchen LLC · Built with love for Danielle · All rights reserved
      </p>
    </footer>
  )
}

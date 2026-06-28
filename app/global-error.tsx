'use client'
import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { Sentry.captureException(error) }, [error])
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: '100vh', background: '#FAFAF5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans', sans-serif" }}>
        <link href="https://fonts.googleapis.com/css2?family=Lora:wght@500&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet" />
        <div style={{ textAlign: 'center', maxWidth: 420, padding: '0 24px' }}>
          <div style={{ fontFamily: "'Lora', serif", fontSize: 26, color: '#1E2620', marginBottom: 12 }}>Something went wrong</div>
          <p style={{ color: '#6B7066', fontSize: 15, lineHeight: 1.6, marginBottom: 28 }}>
            We hit an unexpected error and have been notified. Please try again.
          </p>
          <button onClick={() => reset()} style={{ background: '#3D6B4F', color: '#fff', border: 'none', borderRadius: 10, padding: '13px 28px', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}

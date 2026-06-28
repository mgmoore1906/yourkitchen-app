import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Performance tracing: sample 10% of transactions in production.
  tracesSampleRate: 0.1,
  // Session Replay is intentionally OFF. This app handles sensitive recipient
  // context (postpartum, illness, bereavement) that replay would record. Enable
  // later only with strict masking if you decide you want it.
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
})

// Required by the App Router so Sentry can tie client navigations to traces.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart

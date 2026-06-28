import { PostHog } from 'posthog-node'

/**
 * Server-side PostHog for funnel events that fire in webhooks / API routes
 * (meal confirmed via SMS, delivered, subscription started/canceled) — places
 * posthog-js can't reach.
 *
 * Serverless notes:
 *  - flushAt:1 / flushInterval:0 send each event immediately.
 *  - We use captureImmediate(), which AWAITS the HTTP send so the event isn't
 *    lost when the Lambda freezes right after the response.
 *  - distinctId MUST be the auth user_id, so these tie to the same person the
 *    browser identified with posthog.identify(user.id). For recipient-side
 *    events that's the kitchen's recipient_id.
 *  - Never throws: analytics must not break a webhook or a confirmation.
 */

// Project (ingestion) key — safe to ship; falls back to the known key so this
// works without a new env var, but reads NEXT_PUBLIC_POSTHOG_KEY/HOST if set.
const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY || 'phc_x5h2UKgCPgtVrfGY3tg3EtThN4MiUgCPwCXmyfWHNNgt'
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com'

// Lazy singleton — never constructed at module scope (Turbopack rule).
let _client: PostHog | null = null
function getClient(): PostHog | null {
  if (_client) return _client
  if (!KEY) return null
  _client = new PostHog(KEY, { host: HOST, flushAt: 1, flushInterval: 0 })
  return _client
}

/** Fire a funnel event from server code. Safe no-op on missing id / any error. */
export async function captureServer(
  distinctId: string | null | undefined,
  event: string,
  properties?: Record<string, unknown>,
): Promise<void> {
  try {
    const client = getClient()
    if (!client || !distinctId) return
    await client.captureImmediate({ distinctId, event, properties })
  } catch (e) {
    console.error('[posthog] captureServer failed:', e instanceof Error ? e.message : e)
  }
}

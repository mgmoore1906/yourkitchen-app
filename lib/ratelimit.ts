import { NextResponse } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

/**
 * Shared rate limiter for the credit-burning public endpoints.
 *
 * Backed by Upstash Redis so the counters are shared across every Vercel
 * serverless instance — an in-memory counter would leak under parallel
 * requests, since each Lambda has its own memory. Sliding-window algorithm.
 *
 * Per-endpoint limits live in LIMITS below — tune them there.
 *
 * Behavior on failure (both fail OPEN, i.e. allow the request):
 *   - No Upstash/KV env vars set      -> limiter is inert until you provision
 *     the store + set the vars. Logged once so it's visible.
 *   - Upstash unreachable mid-request -> a Redis blip never takes the app down;
 *     we'd rather eat a few credits than break menu-add for everyone.
 *   It still fails CLOSED on a genuine limit hit — that's the whole point.
 */

// ── Tunable limits: requests / window, per client IP. ──────────────────────
const LIMITS = {
  'menu-parse': { tokens: 10, window: '60 s' },         // expensive: ScrapingBee + Haiku
  'restaurants-search': { tokens: 20, window: '60 s' }, // Google Places Text Search
} as const

type LimitName = keyof typeof LIMITS

// Lazy singletons. Per the Turbopack rule, NOTHING is constructed at module
// scope — these start null/empty and the clients are built on first use.
let _redis: Redis | null = null
const _limiters: Partial<Record<LimitName, Ratelimit>> = {}
let _warned = false

function getRedis(): Redis | null {
  if (_redis) return _redis
  // Accept either the native Upstash vars or the KV_* vars that Vercel's
  // marketplace integration sets, so it works however you provision it.
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN
  if (!url || !token) {
    if (!_warned) {
      console.warn('[ratelimit] No Upstash/KV env vars set — rate limiting is OFF (fail-open).')
      _warned = true
    }
    return null
  }
  _redis = new Redis({ url, token })
  return _redis
}

function getLimiter(name: LimitName): Ratelimit | null {
  const cached = _limiters[name]
  if (cached) return cached
  const redis = getRedis()
  if (!redis) return null
  const cfg = LIMITS[name]
  const rl = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(cfg.tokens, cfg.window),
    analytics: true,
    prefix: `yk-rl:${name}`,
  })
  _limiters[name] = rl
  return rl
}

export type RateLimitOutcome = {
  limited: boolean
  remaining: number
  reset: number // unix ms when the window resets (0 when limiter is inert)
}

/** Check (and consume) one token for `identifier` under the named limit. */
export async function checkRateLimit(name: LimitName, identifier: string): Promise<RateLimitOutcome> {
  const limiter = getLimiter(name)
  if (!limiter) return { limited: false, remaining: -1, reset: 0 } // inert / fail-open
  try {
    const { success, remaining, reset } = await limiter.limit(identifier)
    return { limited: !success, remaining, reset }
  } catch (e) {
    console.error('[ratelimit] limiter error (failing open):', e instanceof Error ? e.message : e)
    return { limited: false, remaining: -1, reset: 0 }
  }
}

/** Best-effort client IP from the proxy headers Vercel sets. */
export function clientIp(request: Request): string {
  const xff = request.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return request.headers.get('x-real-ip') || 'anonymous'
}

/** Standard 429 with a Retry-After derived from the window reset. */
export function tooManyRequests(reset: number): NextResponse {
  const retryAfter = reset > Date.now() ? Math.ceil((reset - Date.now()) / 1000) : 30
  return NextResponse.json(
    { error: "You're going a little fast — please wait a moment and try again." },
    { status: 429, headers: { 'Retry-After': String(retryAfter) } },
  )
}

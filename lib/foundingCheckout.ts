// Shared founding-checkout helpers used by every "become a founder" surface.
// Primary path is bank (ACH — ~0.8% capped at $5); the card links are the quiet
// fallback AND the shareable links dropped into outreach DMs. ACH savings grow
// with the circle (~$24 on a $1,000 Partner), so bank-first matters most up top.

export type FoundingCircle = 'friend' | 'patron' | 'builder' | 'partner'

// One-time price per circle, in cents. Inlined here (no Stripe price-ID env var)
// so the ACH checkout never depends on a price-ID env var — same env-proof
// pattern the original $200 founding flow used.
export const FOUNDING_AMOUNTS: Record<FoundingCircle, number> = {
  friend:  20000,   // $200
  patron:  35000,   // $350
  builder: 50000,   // $500
  partner: 100000,  // $1,000
}

// Hosted card Payment Links — the "prefer to pay by card?" fallback and the
// shareable outreach links. Each link is a fixed amount in Stripe; the webhook
// provisions the matching circle by amount (metadata.tier is only a backup), so
// a missing/mis-set link tag can't misprovision.
export const FOUNDING_CARD_LINKS: Record<FoundingCircle, string> = {
  friend:  'https://buy.stripe.com/9B6fZ9cvi1r76pL5w5abK02',
  patron:  'https://buy.stripe.com/9B6fZ97aY5Hn7tPe2BabK03',
  builder: 'https://buy.stripe.com/14AcMXeDq1r7bK57EdabK04',
  partner: 'https://buy.stripe.com/28E00b52Q8TzcO9f6FabK06',
}

// Back-compat: existing callers import FOUNDING_CARD_LINK (the $200 Friend link).
export const FOUNDING_CARD_LINK = FOUNDING_CARD_LINKS.friend

// Starts the bank-only ACH founding checkout for a circle and redirects the
// browser. Defaults to 'friend' so existing one-arg callers keep working.
export async function startFoundingBankCheckout(
  userId: string,
  circle: FoundingCircle = 'friend',
): Promise<void> {
  try {
    const res = await fetch('/api/founding-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, circle }),
    })
    const data = await res.json()
    if (data?.url) { window.location.href = data.url; return }
    alert(data?.error || 'Could not start the bank checkout — please try the card option.')
  } catch {
    alert('Could not start the bank checkout — please try the card option.')
  }
}

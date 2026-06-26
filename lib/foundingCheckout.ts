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
// provisions the matching circle by AMOUNT (metadata.tier is only a backup), so
// the methods a link happens to show never affect which tier gets granted.
export const FOUNDING_CARD_LINKS: Record<FoundingCircle, string> = {
  friend:  'https://buy.stripe.com/4gMcMXeDq5Hn6pL6A9abK09',
  patron:  'https://buy.stripe.com/5kQ8wH8f27Pv8xT1fPabK08',
  builder: 'https://buy.stripe.com/eVq5kv52Q5Hn6pL5w5abK0a',
  partner: 'https://buy.stripe.com/bJe00bdzmd9P3dzaQpabK0b',
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

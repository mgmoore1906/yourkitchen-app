// Shared founding-checkout helpers used by every "become a founder" surface.
// Primary path is bank (ACH, ~$1.60 fee); the card link is the quiet fallback.
export const FOUNDING_CARD_LINK = 'https://buy.stripe.com/5kQ00beDq9XD9BX5w5abK01'

// Starts the bank-only ($200 ACH) founding checkout and redirects the browser.
export async function startFoundingBankCheckout(userId: string): Promise<void> {
  try {
    const res = await fetch('/api/founding-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId }),
    })
    const data = await res.json()
    if (data?.url) { window.location.href = data.url; return }
    alert(data?.error || 'Could not start the bank checkout — please try the card option.')
  } catch {
    alert('Could not start the bank checkout — please try the card option.')
  }
}

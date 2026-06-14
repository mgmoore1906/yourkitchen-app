// lib/distance.ts
// Haversine distance + DoorDash Drive accurate delivery fee + tip logic
//
// Delivery fee source: DoorDash Drive API official docs (Jan 2026)
//   Base: $9.75 for 0–5 miles
//   Beyond 5 miles: +$0.75/mile up to 15 miles max
//   Tip pass-through discount: -$2.75 when 100% of tip goes to Dasher
//   YourKitchen passes 100% of tips → discount always applies
//   Effective base: $7.00 for 0–5 miles
//
// Tip tiers: assumptions pending real dasher community data.
// Update the mile thresholds in getTipTier() when data arrives.

// ── Distance ─────────────────────────────────────────────────────────────────

export function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R    = 3958.8 // Earth radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a    =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function formatDistance(miles: number): string {
  return `${miles.toFixed(1)} mi`
}

// ── Delivery fee (DoorDash Drive, tip pass-through discount applied) ──────────

export function getDeliveryFee(miles: number | null): number {
  if (miles === null) return 7.00   // unknown distance → base rate

  // DoorDash Drive: $9.75 base − $2.75 tip discount = $7.00 effective base
  // for first 5 miles, then +$0.75/mile after that, max 15 miles
  const BASE      = 7.00
  const PER_MILE  = 0.75
  const FREE_MILES = 5

  if (miles <= FREE_MILES) return BASE

  const extra = Math.min(miles - FREE_MILES, 10) // cap at 15-mile total
  return Math.round((BASE + extra * PER_MILE) * 100) / 100
}

// Formatted for display in the price breakdown
export function formatDeliveryFee(miles: number | null): string {
  return `$${getDeliveryFee(miles).toFixed(2)}`
}

// ── Tip tiers ─────────────────────────────────────────────────────────────────
// NOTE: Mile thresholds are estimates. Update when dasher community data arrives.

export type TipTier = {
  default:  number   // recommended tip in cents
  options:  { label: string; value: number }[]
  warning?: string
  badge:    { text: string; color: string; bg: string }
  reason:   string   // human-readable reason shown to coordinator
}

export function getTipTier(miles: number): TipTier {
  const dist = formatDistance(miles)

  // Tip floors scale with distance. DoorDash Dashers filter on $/mile, so a long
  // haul needs a real tip or it sits unaccepted. "No tip" is intentionally not
  // offered — a $0 Drive order almost never gets picked up. (Pickup orders skip
  // this entirely; they have no Dasher.)

  if (miles < 4) return {
    default: 400,
    options: [
      { label: '$3', value: 300 },
      { label: '$4', value: 400 },
      { label: '$5', value: 500 },
      { label: '$7', value: 700 },
    ],
    badge:  { text: dist, color: '#276749', bg: '#E6F7EF' },
    reason: `Short haul (${dist}) — $4 is a solid tip`,
  }

  if (miles < 7) return {
    default: 600,
    options: [
      { label: '$4',  value: 400  },
      { label: '$6',  value: 600  },
      { label: '$8',  value: 800  },
      { label: '$10', value: 1000 },
    ],
    badge:  { text: dist, color: '#276749', bg: '#E6F7EF' },
    reason: `${dist} delivery — $6 attracts a Dasher quickly`,
  }

  if (miles < 10) return {
    default: 800,
    options: [
      { label: '$6',  value: 600  },
      { label: '$8',  value: 800  },
      { label: '$10', value: 1000 },
      { label: '$12', value: 1200 },
    ],
    warning: `\uD83D\uDFE1 ${dist} — under $8 may sit unaccepted; Dashers weigh the tip against the distance`,
    badge:   { text: dist, color: '#7A5800', bg: '#FFF8E8' },
    reason:  `${dist} delivery — $8+ keeps acceptance fast`,
  }

  // 10+ miles — scale the recommendation with distance (~$1/mile, min $10)
  const rec = Math.max(10, Math.round(miles))
  return {
    default: rec * 100,
    options: [
      { label: `$${rec - 2}`, value: (rec - 2) * 100 },
      { label: `$${rec}`,     value: rec * 100       },
      { label: `$${rec + 3}`, value: (rec + 3) * 100 },
      { label: `$${rec + 6}`, value: (rec + 6) * 100 },
    ],
    warning: `\uD83D\uDD34 ${dist} is a long haul — about $${rec} (~$1/mile) is needed for reliable pickup`,
    badge:   { text: dist, color: '#B94040', bg: '#FDE8E8' },
    reason:  `${dist} long haul — ~$1/mile keeps drivers willing`,
  }
}

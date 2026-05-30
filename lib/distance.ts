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

  if (miles < 4) return {
    default: 300,
    options: [
      { label: 'No tip', value: 0   },
      { label: '$2',     value: 200 },
      { label: '$3',     value: 300 },
      { label: '$5',     value: 500 },
    ],
    badge:  { text: dist, color: '#276749', bg: '#E6F7EF' },
    reason: `Short haul (${dist}) — $3 is a fair tip`,
  }

  if (miles < 7) return {
    default: 400,
    options: [
      { label: 'No tip', value: 0   },
      { label: '$3',     value: 300 },
      { label: '$4',     value: 400 },
      { label: '$5',     value: 500 },
      { label: '$6',     value: 600 },
    ],
    badge:  { text: dist, color: '#276749', bg: '#E6F7EF' },
    reason: `${dist} delivery — $4 helps attract a Dasher quickly`,
  }

  if (miles < 10) return {
    default: 600,
    options: [
      { label: 'No tip', value: 0    },
      { label: '$4',     value: 400  },
      { label: '$5',     value: 500  },
      { label: '$6',     value: 600  },
      { label: '$8',     value: 800  },
    ],
    warning: `🟡 ${dist} — a $6+ tip helps ensure a Dasher accepts quickly`,
    badge:   { text: dist, color: '#7A5800', bg: '#FFF8E8' },
    reason:  `${dist} delivery — tip below $6 may slow driver acceptance`,
  }

  return {
    default: 800,
    options: [
      { label: 'No tip', value: 0    },
      { label: '$5',     value: 500  },
      { label: '$6',     value: 600  },
      { label: '$8',     value: 800  },
      { label: '$10',    value: 1000 },
    ],
    warning: `🔴 ${dist} — a $8+ tip is strongly recommended for reliable delivery`,
    badge:   { text: dist, color: '#B94040', bg: '#FDE8E8' },
    reason:  `${dist} is a long haul — a generous tip ensures driver acceptance`,
  }
}

// lib/shipday.ts
// Real courier-fee quote from Shipday, with a safe fallback.
//
// WHY THIS EXISTS
// The checkout previously charged a courier fee from getDeliveryFee(miles) in
// lib/distance.ts — a haversine-distance estimate against DoorDash Drive's
// published rate card. That is a *guess*. Shipday routes to live Uber/DoorDash
// fleets whose actual fee can differ, and any gap comes out of YourKitchen's
// margin. This helper asks Shipday for the real on-demand delivery quote for a
// specific pickup → dropoff so the coordinator is charged what the delivery
// actually costs.
//
// SAFETY MODEL (important)
// Shipday's on-demand fee is only fully certain once an order is assigned to a
// fleet, and the estimate endpoint's coverage varies by market. So this function
// NEVER throws and NEVER returns 0 on failure. If Shipday returns a usable quote,
// we use it; otherwise the caller falls back to the mileage estimate. Checkout is
// never blocked by an estimate failure.
//
// Requires SHIPDAY_API_KEY (same key used for dispatch).

export type CourierQuote = {
  feeDollars: number          // the courier fee to charge, in dollars
  source: 'shipday' | 'estimate' // where the number came from (for logging/notes)
}

type EstimateInput = {
  pickupLat: number | null
  pickupLng: number | null
  pickupAddress: string
  dropoffLat: number | null
  dropoffLng: number | null
  dropoffAddress: string
  tipDollars: number
}

// Sanity bounds: a real on-demand courier fee outside this range almost
// certainly means a bad/garbage quote, so we reject it and fall back.
const MIN_REASONABLE_FEE = 3.0
const MAX_REASONABLE_FEE = 40.0

/**
 * Ask Shipday for a real delivery-fee quote. Returns null (NOT an error) when
 * no usable quote is available, so the caller falls back to the mileage estimate.
 */
export async function estimateShipdayFee(input: EstimateInput): Promise<number | null> {
  const key = process.env.SHIPDAY_API_KEY
  if (!key) return null

  // Need at least dropoff coordinates to get a meaningful quote.
  if (input.dropoffLat == null || input.dropoffLng == null) return null

  const payload: any = {
    pickupAddress:    input.pickupAddress || '',
    deliveryAddress:  input.dropoffAddress || '',
    tip:              input.tipDollars || 0,
  }
  if (input.pickupLat != null && input.pickupLng != null) {
    payload.pickupLatitude = Number(input.pickupLat)
    payload.pickupLongitude = Number(input.pickupLng)
  }
  payload.deliveryLatitude = Number(input.dropoffLat)
  payload.deliveryLongitude = Number(input.dropoffLng)

  try {
    // Shipday on-demand delivery fee estimate.
    const res = await fetch('https://api.shipday.com/on-demand/estimate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${key}`,
      },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      console.error('[shipday-estimate] non-OK status:', res.status)
      return null
    }

    const data = await res.json().catch(() => null)
    if (!data) return null

    // Shipday responses vary by integration; accept the common shapes and
    // pick the first numeric fee we recognize.
    const raw =
      data.fee ??
      data.deliveryFee ??
      data.estimatedFee ??
      data.cost ??
      data?.estimate?.fee ??
      null

    const fee = typeof raw === 'string' ? parseFloat(raw) : raw
    if (typeof fee !== 'number' || Number.isNaN(fee)) return null
    if (fee < MIN_REASONABLE_FEE || fee > MAX_REASONABLE_FEE) {
      console.error('[shipday-estimate] fee out of bounds, ignoring:', fee)
      return null
    }

    return Math.round(fee * 100) / 100
  } catch (err: any) {
    console.error('[shipday-estimate] error:', err.message)
    return null
  }
}

/**
 * Resolve the courier fee to charge: prefer the real Shipday quote, fall back to
 * the provided mileage estimate. Always returns a usable number + its source.
 */
export async function resolveCourierFee(
  input: EstimateInput,
  mileageEstimateDollars: number
): Promise<CourierQuote> {
  const quoted = await estimateShipdayFee(input)
  if (quoted != null) return { feeDollars: quoted, source: 'shipday' }
  return { feeDollars: mileageEstimateDollars, source: 'estimate' }
}

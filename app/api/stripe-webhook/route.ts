import { captureServer } from '@/lib/posthog-server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import twilio from 'twilio'
import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
function getStripe() { return new Stripe(process.env.STRIPE_SECRET_KEY!) }
function getTwilio() { return twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!) }
async function sendSMS(to: string, body: string) {
  try {
      const client = getTwilio()
    await client.messages.create({ body, from: process.env.TWILIO_PHONE_NUMBER!, to })
  } catch (err: any) {
    console.error('SMS error:', err.message)
  }
}

// Founder order alerts — a haptic wrist push (Pushover) plus an email backup (Resend).
// Both are best-effort and OPTIONAL: if a channel's env vars aren't set it's skipped
// silently, so the webhook never fails on a missing key. Tuned for a house with a
// newborn — HIGH priority (1) + SILENT sound = a wrist tap on the Apple Watch, no
// audible alarm. For wake-the-dead alerts later, set PUSHOVER_PRIORITY = 2, add
// retry/expire, and enable Critical Alerts in the Pushover app.
const PUSHOVER_PRIORITY = 1
const PUSHOVER_SOUND = 'none'
async function notifyFounder(title: string, body: string, url: string) {
  const pToken = process.env.PUSHOVER_TOKEN
  const pUser  = process.env.PUSHOVER_USER
  if (pToken && pUser) {
    try {
      await fetch('https://api.pushover.net/1/messages.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          token: pToken, user: pUser, title, message: body,
          priority: String(PUSHOVER_PRIORITY), sound: PUSHOVER_SOUND,
          url, url_title: 'Open admin',
        }),
      })
    } catch (err: any) { console.error('Pushover error:', err.message) }
  }

  const rKey = process.env.RESEND_API_KEY
  if (rKey) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${rKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'YourKitchen <marques@yourkitchen.app>',
          to: [process.env.ALERT_EMAIL || 'marques@yourkitchen.app'],
          subject: title,
          html: `<p style="font-family:sans-serif;font-size:15px;line-height:1.5">${body.replace(/\n/g, '<br>')}</p>` +
                `<p><a href="${url}" style="font-family:sans-serif">Open admin →</a></p>`,
        }),
      })
    } catch (err: any) { console.error('Resend email error:', err.message) }
  }
}

// Recipient meal-confirm email — the SMS hedge. Carries a link to the public
// /c/[id] confirm page (review + tap, never auto-acts on open). Fires even when
// Twilio is carrier-filtered, so a recipient can always say yes/no. Best-effort.
async function sendConfirmEmail(to: string, m: { coordinatorName: string; mealLabel: string; mealName: string; restName: string; whenStr: string; proposalId: string }) {
  const rKey = process.env.RESEND_API_KEY
  if (!rKey) return
  const link = `https://app.yourkitchen.app/c/${m.proposalId}`
  const html = `
  <div style="font-family:'DM Sans',Arial,sans-serif;background:#FAFAF5;padding:28px 16px">
    <div style="max-width:440px;margin:0 auto;background:#fff;border:1px solid #DDE8E0;border-radius:18px;padding:30px 26px">
      <p style="font-size:11px;font-weight:700;color:#6B9E7E;letter-spacing:2px;text-transform:uppercase;margin:0 0 12px">A meal for you</p>
      <h1 style="font-family:Georgia,serif;font-size:22px;color:#1E2620;font-weight:500;line-height:1.3;margin:0 0 16px">${m.coordinatorName} wants to send you ${m.mealLabel}.</h1>
      <div style="background:#EAF2ED;border-radius:12px;padding:16px 18px;margin:0 0 20px">
        <p style="font-size:16px;color:#1E2620;font-weight:600;margin:0 0 4px;font-family:Georgia,serif">${m.mealName}</p>
        <p style="font-size:13px;color:#6B7066;margin:0">from ${m.restName} \u00b7 arriving around ${m.whenStr}</p>
      </div>
      <p style="font-size:13px;color:#6B7066;line-height:1.6;margin:0 0 22px">Nothing is charged unless you say yes. Take your time \u2014 there&rsquo;s no pressure either way.</p>
      <a href="${link}" style="display:block;text-align:center;background:#3D6B4F;color:#fff;text-decoration:none;padding:15px;border-radius:12px;font-size:15px;font-weight:600">Review &amp; respond &rarr;</a>
      <p style="font-size:11.5px;color:#6B7066;text-align:center;margin:18px 0 0;line-height:1.5">Or reply <b>Y</b> or <b>N</b> to the text we sent.</p>
    </div>
  </div>`
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${rKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'YourKitchen <marques@yourkitchen.app>',
        to: [to],
        subject: `${m.coordinatorName} wants to send you ${m.mealLabel}`,
        html,
      }),
    })
  } catch (err: any) { console.error('Confirm email error:', err.message) }
}

const DEFAULT_TIME: Record<string, string> = { breakfast: '08:00', lunch: '12:00', dinner: '18:30' }
function prettyTime(t: string | null | undefined, mealType: string): string {
  const raw = (t && String(t).trim()) ? String(t).split('-')[0].trim() : DEFAULT_TIME[mealType] || '18:30'
  const [hStr, m] = raw.split(':')
  let h = parseInt(hStr, 10)
  if (isNaN(h)) return 'soon'
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12; if (h === 0) h = 12
  return `${h}:${m || '00'} ${ampm}`
}

// ── Founding circles ───────────────────────────────────────────────────────
// One-time founding comes in four circles. We resolve the circle from the PAID
// amount first (works identically for in-app ACH and the shared card links),
// then metadata.circle, then legacy single-tier founding -> friend. The Care+
// term is anchored to BETA LAUNCH, not purchase date -- "the pilot is on us":
// pre-launch founders' clocks start at launch. Partner = lifetime (null expiry).
type FoundingCircle = 'friend' | 'patron' | 'builder' | 'partner'
const BETA_LAUNCH = '2026-08-11'
const CARE_PLUS_YEARS: Record<FoundingCircle, number | null> = {
  friend: 3, patron: 4, builder: 5, partner: null, // null = lifetime
}
function circleFromAmount(cents: number | null | undefined): FoundingCircle | null {
  switch (cents) {
    case 20000:  return 'friend'
    case 35000:  return 'patron'
    case 50000:  return 'builder'
    case 100000: return 'partner'
    default:     return null
  }
}
function resolveCircle(session: Stripe.Checkout.Session): FoundingCircle {
  const byAmount = circleFromAmount(session.amount_total)
  if (byAmount) return byAmount
  const m = (session.metadata?.circle || '') as FoundingCircle
  if (m === 'friend' || m === 'patron' || m === 'builder' || m === 'partner') return m
  return 'friend' // legacy single-tier founding
}
function foundingExpiry(circle: FoundingCircle): string | null {
  const years = CARE_PLUS_YEARS[circle]
  if (years == null) return null // lifetime (Partner)
  const launch = new Date(BETA_LAUNCH + 'T00:00:00Z')
  const now = new Date()
  const start = now > launch ? now : launch // pre-launch terms start at launch
  const end = new Date(start)
  end.setUTCFullYear(end.getUTCFullYear() + years)
  return end.toISOString()
}
async function provisionFounding(supabase: any, session: Stripe.Checkout.Session): Promise<boolean> {
  // Paid-only: card is paid on 'completed'; ACH clears later via async success.
  // Never grant access before funds clear.
  if (session.payment_status !== 'paid') {
    console.log(`Founding: session ${session.id} not yet paid (${session.payment_status}) -- waiting for ACH to clear`)
    return false
  }
  const userId = session.metadata?.user_id || session.client_reference_id
  if (!userId) { console.log(`Founding: no user id on session ${session.id}`); return false }
  const circle = resolveCircle(session)
  const expires = foundingExpiry(circle)
  await supabase.from('profiles').update({
    tier: 'founding',
    founding_circle: circle,
    founding_expires_at: expires,
  }).eq('id', userId)
  console.log(`Founding provisioned: ${userId} -> ${circle} (Care+ ${expires ? `until ${expires}` : 'lifetime'})`)
  // TODO (gift-code slice): issue 1/2/2/3 codes by circle (90/90/180/180 days) here.
  return true
}

export async function POST(request: Request) {
  const stripe = getStripe()
  const supabase = getSupabase()
  const body      = await request.text()
  const signature = request.headers.get('stripe-signature') || ''

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err: any) {
    console.error('Webhook signature error:', err.message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // ── customer.subscription.deleted — a Care+/Annual cancellation ─────────────
  // When a subscriber cancels (via the billing portal), Stripe deletes the
  // subscription (immediately or at period end, per portal config). Map the
  // customer back to the profile and drop them to free. Guard on tier so a
  // one-time 'founding' member is never clobbered.
  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as Stripe.Subscription
    const customerId = sub.customer as string
    if (customerId) {
      const { data: prof } = await supabase
        .from('profiles')
        .select('id, tier')
        .eq('stripe_customer_id', customerId)
        .single()
      if (prof && (prof.tier === 'care' || prof.tier === 'annual')) {
        await supabase.from('profiles').update({ tier: 'free', past_due: false }).eq('id', prof.id)
        await captureServer(prof.id, 'subscription canceled', { from_tier: prof.tier })
      }
    }
    return NextResponse.json({ received: true })
  }

  // invoice.payment_failed ── a Care+ renewal charge bounced. Flag the profile
  // past_due so the in-app banner prompts a card update before the subscription
  // cancels. (Subscribe invoice.payment_failed + invoice.payment_succeeded in Stripe.)
  if (event.type === 'invoice.payment_failed') {
    const inv = event.data.object as Stripe.Invoice
    const customerId = inv.customer as string
    if (customerId) {
      await supabase.from('profiles').update({ past_due: true }).eq('stripe_customer_id', customerId)
    }
    return NextResponse.json({ received: true })
  }

  // invoice.payment_succeeded / invoice.paid ── payment recovered; clear the banner.
  if (event.type === 'invoice.payment_succeeded' || event.type === 'invoice.paid') {
    const inv = event.data.object as Stripe.Invoice
    const customerId = inv.customer as string
    if (customerId) {
      await supabase.from('profiles').update({ past_due: false }).eq('stripe_customer_id', customerId)
    }
    return NextResponse.json({ received: true })
  }

  // ── checkout.session.completed ─────────────────────────────────────────────
  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
    const session         = event.data.object as Stripe.Checkout.Session
    const paymentIntentId = session.payment_intent as string
    const type            = session.metadata?.type
    const proposalIds     = JSON.parse(session.metadata?.proposal_ids || '[]') as string[]
    const coordinatorName = session.metadata?.coordinator_name || ''

    // ── FOUNDING (one-time, any circle) ─────────────────────────────
    // Covers in-app ACH (metadata.tier='founding') AND the shared card Payment
    // Links (no metadata.type; client_reference_id holds the user id; the amount
    // identifies the circle). Card is paid on 'completed'; ACH completes as
    // 'unpaid' and clears later via async_payment_succeeded -- provisionFounding
    // is paid-only, so access never precedes cleared funds.
    const isFounding =
      type !== 'proposal' && type !== 'subscription' &&
      (session.metadata?.tier === 'founding' || circleFromAmount(session.amount_total) != null)
    if (isFounding) {
      await provisionFounding(supabase, session)
      return NextResponse.json({ received: true })
    }

    // ── SUBSCRIPTION upgrade (Care / Care+, monthly or annual) ───────────
    // Recurring Checkout sets metadata.type='subscription' (+ metadata.tier).
    // Card only, so it's always paid on 'completed'.
    const tierMeta = session.metadata?.tier
    if (type === 'subscription' || (tierMeta && tierMeta !== 'founding')) {
      const userId = session.metadata?.user_id
      const tier   = tierMeta
      if (userId && tier) {
        await supabase.from('profiles').update({ tier }).eq('id', userId)
        console.log(`Tier updated: ${userId} → ${tier}`)
        await captureServer(userId, 'subscription started', { tier })
      }
      return NextResponse.json({ received: true })
    }

    // Proposal payment — save payment_intent_id + notify recipient
    if (type === 'proposal' && proposalIds.length > 0) {
      const coordEmail = session.customer_details?.email || null
      const proposalUpdate: Record<string, any> = { payment_intent_id: paymentIntentId }
      if (coordEmail) proposalUpdate.coordinator_email = coordEmail
      await supabase.from('meal_proposals')
        .update(proposalUpdate)
        .in('id', proposalIds)

      const { data: proposals } = await supabase
        .from('meal_proposals')
        .select(`
          id, meal_type, delivery_date, delivery_time, meal_name, meal_items,
          claims(calendar_date_id, guest_coordinators(full_name)),
          kitchen_restaurants(name),
          menu_items(name),
          kitchens:kitchen_id(id, name, address, recipient_id)
        `)
        .in('id', proposalIds)

      for (const p of (proposals || []) as any[]) {
        if (p.claims?.calendar_date_id) {
          await supabase.from('calendar_dates')
            .update({ status: 'claimed' })
            .eq('id', p.claims.calendar_date_id)
        }

        const recipientId = p.kitchens?.recipient_id
        if (!recipientId) continue

        const { data: profile } = await supabase
          .from('profiles').select('phone').eq('id', recipientId).single()

        const mealLabel = p.meal_type === 'breakfast' ? 'breakfast'
          : p.meal_type === 'lunch' ? 'lunch' : 'dinner'
        const itemsArr = Array.isArray(p.meal_items) ? p.meal_items : []
        const mealName = p.meal_name
        || (itemsArr.length ? itemsArr.map((i: any) => i.qty > 1 ? `${i.name} ×${i.qty}` : i.name).join(', ') : null)
        || p.menu_items?.name
        || 'a meal'
        const restName = p.kitchen_restaurants?.name || 'a restaurant'
        const whenStr = prettyTime(p.delivery_time, p.meal_type)
        const dateLabel = p.delivery_date
          ? new Date(p.delivery_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
          : null
        const whenLine = dateLabel ? `${dateLabel} around ${whenStr}` : `around ${whenStr}`

        // SMS — frictionless reply path; fires when we have a number.
        if (profile?.phone) {
          await sendSMS(
            profile.phone,
            `${coordinatorName} wants to send you ${mealLabel} — ` +
            `${mealName} from ${restName}, arriving ${whenLine}.\n\n` +
            `Tap to confirm or pick another day:\n` +
            `https://app.yourkitchen.app/c/${p.id}\n\n` +
            `(Or reply Y to confirm, N to decline.)\n` +
            `Reply STOP to opt out.\n\n— YourKitchen`
          )
        }

        // Email hedge — link to the confirm page; works even if SMS is filtered.
        try {
          const { data: u } = await supabase.auth.admin.getUserById(recipientId)
          const email = u?.user?.email
          if (email) {
            await sendConfirmEmail(email, { coordinatorName, mealLabel, mealName, restName, whenStr, proposalId: p.id })
          }
        } catch (err: any) { console.error('Confirm email lookup failed:', err.message) }
      }
      console.log(`Payment authorized for ${proposalIds.length} proposal(s): ${paymentIntentId}`)
    }
  }

  // ── checkout.session.async_payment_failed ── an ACH founding payment bounced ─
  // We only ever provision on 'paid', so nothing was granted -- just log it.
  if (event.type === 'checkout.session.async_payment_failed') {
    const session = event.data.object as Stripe.Checkout.Session
    const who = session.metadata?.user_id || session.client_reference_id || 'unknown'
    console.log(`ACH payment failed for session ${session.id} (user ${who}) -- not provisioned`)
    return NextResponse.json({ received: true })
  }

  // ── checkout.session.expired ─────────────────────────────────
  // Coordinator started a proposal but never paid (the Checkout session lapses
  // ~30 min after creation). Release the slot(s) back to the village and mark the
  // proposal(s) expired so they don't linger as "pending" in Activity.
  if (event.type === 'checkout.session.expired') {
    const session = event.data.object as Stripe.Checkout.Session
    let expiredIds: string[] = []
    try { expiredIds = JSON.parse(session.metadata?.proposal_ids || '[]') } catch {}
    if (expiredIds.length > 0) {
      const { data: rows } = await supabase
        .from('meal_proposals')
        .select('id, status, claims(calendar_date_id)')
        .in('id', expiredIds)
      for (const r of (rows || []) as any[]) {
        if (r.status !== 'pending') continue
        if (r.claims?.calendar_date_id) {
          await supabase.from('calendar_dates')
            .update({ status: 'available' })
            .eq('id', r.claims.calendar_date_id)
            .eq('status', 'claimed')
        }
      }
      await supabase.from('meal_proposals')
        .update({ status: 'expired' })
        .in('id', expiredIds)
        .eq('status', 'pending')
      console.log(`Checkout expired — released ${expiredIds.length} unpaid proposal slot(s)`)
    }
  }

  // ── payment_intent.succeeded ───────────────────────────────────────────────
  // Stripe captured payment after recipient confirmed Y.
  // MANUAL DISPATCH GATE: do NOT auto-dispatch Shipday.
  // Mark proposal confirmed, alert Marques, wait for manual Dispatch tap.
  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object as Stripe.PaymentIntent

    const { data: proposal } = await supabase
      .from('meal_proposals')
      .select(`
        id, meal_type, status, tip_amount, delivery_date, is_pickup,
        claims(calendar_date_id, guest_coordinators(phone, full_name)),
        kitchen_restaurants(name, address, phone),
        menu_items(name, price),
        kitchens:kitchen_id(id, name, address, recipient_id)
      `)
      .eq('payment_intent_id', pi.id)
      .single()

    if (!proposal) {
      console.log('No proposal found for payment_intent:', pi.id)
      return NextResponse.json({ received: true })
    }

    const kitchen  = (proposal as any).kitchens
    const mealName = (proposal as any).menu_items?.name || 'the meal'
    const restName = (proposal as any).kitchen_restaurants?.name || 'the restaurant'
    const mealType = (proposal as any).meal_type || 'meal'
    const isPickup = !!(proposal as any).is_pickup

    // Update status → awaiting_dispatch (food order not yet placed).
    // Also store the captured total (cents) so analytics GMV has a source —
    // amount_received is what Stripe actually captured for this PaymentIntent.
    await supabase.from('meal_proposals')
      .update({
        status: 'confirmed',
        delivery_status: isPickup ? 'pickup_pending' : 'awaiting_dispatch',
        stripe_amount: pi.amount_received ?? pi.amount ?? null,
      })
      .eq('id', (proposal as any).id)

    // Receipt total actually captured (cents → dollars) for the payer's confirmation SMS
    const receiptTotal = ((pi.amount_received ?? pi.amount ?? 0) / 100).toFixed(2)

    // Alert Marques so he knows to place the food order — SMS + wrist push + email.
    const delivDate = (proposal as any).delivery_date
      ? new Date((proposal as any).delivery_date + 'T12:00:00')
          .toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      : 'today'
    const marquesPhone = process.env.MARQUES_PHONE
    if (marquesPhone) {
      const marquesBody = isPickup
        ? `🥡 YK PICKUP ORDER\n` +
          `${mealName} from ${restName}\n` +
          `${mealType.charAt(0).toUpperCase() + mealType.slice(1)} · ${delivDate}\n` +
          `Pickup at: ${restName}\n\n` +
          `1. Place a PICKUP order at the restaurant\n` +
          `2. No courier — recipient grabs it\n\n` +
          `app.yourkitchen.app/admin`
        : `🍽 YK ORDER READY\n` +
          `${mealName} from ${restName}\n` +
          `${mealType.charAt(0).toUpperCase() + mealType.slice(1)} · ${delivDate}\n` +
          `Delivery: ${kitchen?.address || 'address on file'}\n\n` +
          `1. Place order at restaurant\n` +
          `2. Tap Dispatch in admin panel\n\n` +
          `app.yourkitchen.app/admin`
      await sendSMS(marquesPhone, marquesBody)
    }

    // Wrist push (Pushover) + email backup (Resend) — fires on every confirmed order,
    // independent of SMS, so an order is never missed when away from the computer.
    const founderTitle = isPickup ? '🥡 New pickup order' : '🍽 New order to place'
    const founderBody =
      `${mealName} from ${restName}\n` +
      `${mealType.charAt(0).toUpperCase() + mealType.slice(1)} · ${delivDate}\n` +
      (isPickup ? 'Pickup — no courier, recipient grabs it' : `Deliver to: ${kitchen?.address || 'address on file'}`)
    await notifyFounder(founderTitle, founderBody, 'https://app.yourkitchen.app/admin')

    // Notify coordinator — payment captured, meal is being arranged
    const coordPhone = (proposal as any).claims?.guest_coordinators?.phone
    if (coordPhone) {
      const coordBody = isPickup
        ? `✅ Your meal gift was confirmed! ${mealName} from ${restName}.\n\n` +
          `Receipt: $${receiptTotal} charged.\n` +
          `This is a pickup order — we'll text when it's ready at the restaurant. Thank you for showing up. 🧡\n\n` +
          `Reply STOP to opt out.\n— YourKitchen`
        : `✅ Your meal gift was confirmed! ${mealName} from ${restName} is being arranged for delivery.\n\n` +
          `Receipt: $${receiptTotal} charged.\n` +
          `We'll text you when it's on the way. Thank you for showing up. 🧡\n\n` +
          `Reply STOP to opt out.\n— YourKitchen`
      await sendSMS(coordPhone, coordBody)
    }

    // Notify recipient — confirmed, delivery coming
    if (kitchen?.recipient_id) {
      const { data: recipientProfile } = await supabase
        .from('profiles').select('phone').eq('id', kitchen.recipient_id).single()
      if (recipientProfile?.phone) {
        const recipBody = isPickup
          ? `✅ Confirmed! ${mealName} from ${restName} is being arranged for pickup. ` +
            `We'll text you when it's ready to grab.\n\n` +
            `Reply STOP to opt out.\n— YourKitchen`
          : `✅ Confirmed! ${mealName} from ${restName} is being arranged. ` +
            `We'll send a tracking link once it's on the way.\n\n` +
            `Reply STOP to opt out.\n— YourKitchen`
        await sendSMS(recipientProfile.phone, recipBody)
      }
    }

    console.log(`[Gate] Payment captured for proposal ${(proposal as any).id} — awaiting manual dispatch`)
  }

  return NextResponse.json({ received: true })
}

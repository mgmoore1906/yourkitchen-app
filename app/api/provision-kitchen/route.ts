import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { geocodeAddress } from '@/lib/geocode'
import { getSessionUserId } from '@/lib/requireUser'
import twilio from 'twilio'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Service-role client — used for the privileged writes here (creating the
// recipient's auth user, upserting their profile, inserting the kitchen).
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
function getTwilio() { return twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!) }

function e164(raw: string): string | null {
  const d = (raw || '').replace(/\D/g, '')
  if (d.length === 10) return '+1' + d
  if (d.length === 11 && d.startsWith('1')) return '+' + d
  return null
}

async function sendSMS(to: string, body: string) {
  try {
    const client = getTwilio()
    await client.messages.create({ body, from: process.env.TWILIO_PHONE_NUMBER!, to })
  } catch (err: any) {
    console.error(`Twilio SMS failed to ${to}:`, err.message)
  }
}

// ── Provision a kitchen FOR SOMEONE ELSE ────────────────────────────────────
// The signed-in user is the SPONSOR (organizer_id). They name a recipient by
// phone; we find-or-create that recipient as a passwordless phone user
// (recipient_id) and create the kitchen with the two roles distinct. This is
// the foundation the org-pool and enterprise tiers stand on — the only thing
// that changes upstream is who the sponsor is.
//
// No recipient login happens here. Self-serve setup (phone-OTP) ships in Slice 2;
// until then the sponsor can curate the kitchen white-glove.
export async function POST(request: Request) {
  // Auth: a caller can only provision as themselves — never trust a sponsor id
  // from the body. (Same rule the rest of the app's sensitive routes follow.)
  const sponsorId = await getSessionUserId()
  if (!sponsorId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const supabase = getSupabase()
  try {
    const { recipient_name, recipient_phone, kitchen_name, address, use_case, notify_recipient } =
      await request.json()

    if (!recipient_name || !recipient_phone) {
      return NextResponse.json({ error: 'Recipient name and phone are required' }, { status: 400 })
    }
    const phone = e164(recipient_phone)
    if (!phone) return NextResponse.json({ error: 'Enter a valid US phone number' }, { status: 400 })

    // 1. Resolve the recipient's user id.
    //    Fast path: an existing profile already carries this phone → reuse it.
    //    Otherwise create a passwordless phone user (phone_confirm marks the
    //    number verified so they can OTP in later without a separate step),
    //    falling back to an auth lookup if the number already exists as a user
    //    without a profile row.
    let recipientId: string | null = null

    const { data: existingProfiles } = await supabase
      .from('profiles').select('id').eq('phone', phone).limit(1)

    if (existingProfiles && existingProfiles.length) {
      recipientId = existingProfiles[0].id
    } else {
      const { data: created, error: cErr } = await supabase.auth.admin.createUser({
        phone,
        phone_confirm: true,
      })
      if (created?.user) {
        recipientId = created.user.id
      } else {
        // Phone may already be an auth user with no profile — find them.
        const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
        const digits = phone.replace(/\D/g, '')
        const match = list?.users?.find(u => (u.phone || '').replace(/\D/g, '') === digits)
        if (match) {
          recipientId = match.id
        } else {
          return NextResponse.json(
            { error: cErr?.message || 'Could not create the recipient. If phone auth is not enabled in Supabase yet, enable it and retry.' },
            { status: 500 }
          )
        }
      }
      // Seed/refresh their profile (free tier — the SPONSOR pays, not them).
      await supabase.from('profiles').upsert({
        id: recipientId,
        full_name: recipient_name,
        phone,
        sms_consent: false,
        tier: 'free',
      }, { onConflict: 'id' })
    }

    // Keep the display name current even when reusing an existing profile.
    await supabase.from('profiles').update({ full_name: recipient_name }).eq('id', recipientId)

    // 2. Geocode the address if the sponsor pre-filled one (optional — the
    //    recipient can set/fix it during self-serve setup). Non-blocking.
    const coords = address ? await geocodeAddress(address) : null

    // 3. Unique slug from the recipient's name.
    const baseSlug = recipient_name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'kitchen'
    let slug = baseSlug
    let attempt = 0
    while (true) {
      const { data: existing } = await supabase.from('kitchens').select('id').eq('slug', slug).single()
      if (!existing) break
      slug = `${baseSlug}-${++attempt}`
    }

    // 4. Create the kitchen — organizer = sponsor, recipient = the new user.
    const { data: kitchen, error: kErr } = await supabase
      .from('kitchens')
      .insert({
        organizer_id: sponsorId,
        recipient_id: recipientId,
        name: (kitchen_name && kitchen_name.trim()) || `${recipient_name}'s Kitchen`,
        slug,
        address: address || null,
        latitude: coords?.lat ?? null,
        longitude: coords?.lng ?? null,
        household_size: 3,
        household_adults: 2,
        household_children: 0,
        dietary_restrictions: [],
        use_case: use_case || null,
        breakfast_windows: [],
        lunch_windows: [],
        dinner_windows: ['17:30-19:00'],
        status: 'active',
        tier: 'free',
        trial_started_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (kErr || !kitchen) {
      return NextResponse.json({ error: kErr?.message || 'Failed to create kitchen' }, { status: 500 })
    }

    // 5. Optional heads-up text. The self-serve setup link is built in Slice 2,
    //    so we never send a dead link here — only an opt-in courtesy notice.
    if (notify_recipient) {
      const { data: sp } = await supabase.from('profiles').select('full_name').eq('id', sponsorId).single()
      const sponsorName = sp?.full_name || 'A friend'
      await sendSMS(
        phone,
        `Hi ${recipient_name}, ${sponsorName} set up a YourKitchen for you so friends & family can send you meals. You'll get a link to add your favorite spots soon. Reply STOP to opt out.`
      )
    }

    return NextResponse.json({
      success: true,
      kitchen_id: kitchen.id,
      slug: kitchen.slug,
      recipient_id: recipientId,
      share_url: `https://app.yourkitchen.app/k/${kitchen.slug}`,
    })
  } catch (err: any) {
    console.error('Provision error:', err?.message)
    return NextResponse.json({ error: err?.message || 'Request failed' }, { status: 500 })
  }
}

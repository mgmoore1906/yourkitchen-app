import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import twilio from 'twilio'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
)

export async function POST(request: Request) {
  try {
    const { name, email, calendar_date_id, restaurant_id, menu_item_id, note } = await request.json()

    // Get kitchen details for SMS
   const { data: calendarDate } = await supabase
  .from('calendar_dates')
  .select('*, kitchens(*)')
  .eq('id', calendar_date_id)
  .single()

// Get recipient phone separately
const { data: recipientProfile } = await supabase
  .from('profiles')
  .select('phone')
  .eq('id', calendarDate?.kitchens?.recipient_id)
  .single()

    // Get restaurant and menu item details
    const { data: restaurant } = await supabase
      .from('kitchen_restaurants')
      .select('*')
      .eq('id', restaurant_id)
      .single()

    const { data: menuItem } = await supabase
      .from('menu_items')
      .select('*')
      .eq('id', menu_item_id)
      .single()

    // Save guest coordinator
    const { data: guest, error: guestError } = await supabase
      .from('guest_coordinators')
      .insert({ full_name: name, email })
      .select('id')
      .single()

    if (guestError) return NextResponse.json({ error: guestError.message }, { status: 400 })

    // Create claim
    const { data: claim, error: claimError } = await supabase
      .from('claims')
      .insert({
        calendar_date_id,
        guest_coordinator_id: guest.id,
        claim_type: 'one_time',
        status: 'active',
        expires_at: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
      })
      .select('id')
      .single()

    if (claimError) return NextResponse.json({ error: claimError.message }, { status: 400 })

    // Create meal proposal
    const { data: proposal, error: proposalError } = await supabase
      .from('meal_proposals')
      .insert({
        claim_id: claim.id,
        kitchen_restaurant_id: restaurant_id,
        menu_item_id: menu_item_id,
        coordinator_note: note,
        status: 'pending',
      })
      .select('id')
      .single()

    if (proposalError) return NextResponse.json({ error: proposalError.message }, { status: 400 })

    // Update date status to claimed
    await supabase
      .from('calendar_dates')
      .update({ status: 'claimed' })
      .eq('id', calendar_date_id)

    // Format date for SMS
    const dateFormatted = new Date(calendarDate?.date + 'T12:00:00').toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric'
    })

    // Send SMS to recipient
    const recipientPhone = recipientProfile?.phone
    if (recipientPhone) {
      const smsBody = `${name} wants to send you dinner on ${dateFormatted} — ${menuItem?.name} from ${restaurant?.name}.\n\nReply Y to confirm or N to decline.\n\n— YourKitchen`

      await twilioClient.messages.create({
        body: smsBody,
        from: process.env.TWILIO_PHONE_NUMBER!,
        to: recipientPhone,
      })

      // Log notification
      await supabase.from('notifications').insert({
        kitchen_id: calendarDate?.kitchens?.id,
        type: 'meal_proposed',
        channel: 'sms',
        content: smsBody,
      })
    }

    return NextResponse.json({ success: true, proposal_id: proposal.id })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
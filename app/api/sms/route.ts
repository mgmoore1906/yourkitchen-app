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
  const formData = await request.formData()
  const body = (formData.get('Body') as string)?.trim().toUpperCase()
  const from = formData.get('From') as string

  // Find the most recent pending proposal for this phone number
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('phone', from)
    .single()

  if (!profile) {
    return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response><Message>We couldn\'t find your Kitchen. Visit yourkitchen.app for help.</Message></Response>', {
      headers: { 'Content-Type': 'text/xml' }
    })
  }

  // Find most recent pending proposal for this recipient
  const { data: kitchen } = await supabase
    .from('kitchens')
    .select('id')
    .eq('recipient_id', profile.id)
    .eq('status', 'active')
    .single()

  if (!kitchen) {
    return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response><Message>No active Kitchen found.</Message></Response>', {
      headers: { 'Content-Type': 'text/xml' }
    })
  }

  const { data: proposal } = await supabase
    .from('meal_proposals')
    .select(`
      *,
      claims(*, calendar_dates(*, kitchens(*))),
      kitchen_restaurants(*),
      menu_items(*)
    `)
    .eq('status', 'pending')
    .order('proposed_at', { ascending: false })
    .limit(1)
    .single()

  if (!proposal) {
    return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response><Message>No pending meal proposals found.</Message></Response>', {
      headers: { 'Content-Type': 'text/xml' }
    })
  }

  let replyMessage = ''

  if (body === 'Y' || body === 'YES') {
    // Confirm the proposal
    await supabase
      .from('meal_proposals')
      .update({ status: 'confirmed', responded_at: new Date().toISOString() })
      .eq('id', proposal.id)

    await supabase
      .from('calendar_dates')
      .update({ status: 'confirmed' })
      .eq('id', proposal.claims?.calendar_date_id)

    replyMessage = `✅ Confirmed! ${proposal.menu_items?.name} from ${proposal.kitchen_restaurants?.name} is on its way. We'll send tracking once the order is placed. — YourKitchen`

  } else if (body === 'N' || body === 'NO') {
    // Decline the proposal
    await supabase
      .from('meal_proposals')
      .update({ status: 'declined', responded_at: new Date().toISOString() })
      .eq('id', proposal.id)

    await supabase
      .from('calendar_dates')
      .update({ status: 'available' })
      .eq('id', proposal.claims?.calendar_date_id)

    replyMessage = `Got it — we'll let them know. The date is back open for your village to claim. — YourKitchen`

  } else {
    replyMessage = `Reply Y to confirm your meal or N to decline. — YourKitchen`
  }

  return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>${replyMessage}</Message></Response>`, {
    headers: { 'Content-Type': 'text/xml' }
  })
}
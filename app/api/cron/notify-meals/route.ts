import { createClient } from '@supabase/supabase-js'
import twilio from 'twilio'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
)

// Confirm deadlines by meal type (shown in SMS to recipient)
const DEADLINES: Record<string, string> = {
  breakfast: '8:30 AM',
  lunch:     '11:00 AM',
  dinner:    '5:00 PM',
}

async function sendSMS(to: string, body: string) {
  try {
    await twilioClient.messages.create({
      body,
      from: process.env.TWILIO_PHONE_NUMBER!,
      to,
    })
  } catch (err: any) {
    console.error(`Twilio SMS failed to ${to}:`, err.message)
  }
}

export async function GET(request: Request) {
  // Verify this is called by Vercel cron (or manually with the secret)
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const mealType = searchParams.get('meal_type') || 'dinner'

  // Today's date in YYYY-MM-DD (UTC — adjust if your DB stores local dates)
  const today = new Date().toISOString().split('T')[0]

  // Find all pending proposals for today's meal type
  // Join chain: meal_proposals → claims → calendar_dates → kitchens → profiles
  const { data: proposals, error } = await supabase
    .from('meal_proposals')
    .select(`
      id,
      status,
      coordinator_note,
      claims (
        id,
        calendar_date_id,
        guest_coordinators ( full_name ),
        calendar_dates (
          date,
          meal_type,
          kitchens (
            id,
            name,
            recipient_id
          )
        )
      ),
      kitchen_restaurants ( name ),
      menu_items ( name )
    `)
    .eq('status', 'pending')

  if (error) {
    console.error('Cron query error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Filter to proposals where date = today AND meal_type matches
  const todayProposals = (proposals || []).filter((p: any) => {
    const calDate = p.claims?.calendar_dates
    return calDate?.date === today && calDate?.meal_type === mealType
  })

  if (todayProposals.length === 0) {
    return NextResponse.json({
      sent: 0,
      message: `No pending ${mealType} proposals for ${today}`,
    })
  }

  let sent = 0
  const deadline = DEADLINES[mealType] || '5:00 PM'

  for (const proposal of todayProposals) {
    const recipientId = proposal.claims?.calendar_dates?.kitchens?.recipient_id
    const coordinatorName = proposal.claims?.guest_coordinators?.full_name || 'Someone'
    const mealName = proposal.menu_items?.name || 'a meal'
    const restaurantName = proposal.kitchen_restaurants?.name || 'a restaurant'

    if (!recipientId) continue

    // Get recipient phone
    const { data: profile } = await supabase
      .from('profiles')
      .select('phone, full_name')
      .eq('id', recipientId)
      .single()

    if (!profile?.phone) continue

    const mealLabel = mealType === 'breakfast'
      ? 'breakfast'
      : mealType === 'lunch'
      ? 'lunch'
      : 'dinner'

    const smsBody =
      `${coordinatorName} wants to send you ${mealLabel} today — ` +
      `${mealName} from ${restaurantName}.\n\n` +
      `Reply Y to confirm or N to decline by ${deadline}.\n\n` +
      `— YourKitchen`

    await sendSMS(profile.phone, smsBody)

    // Log notification
    await supabase.from('notifications').insert({
      kitchen_id: proposal.claims?.calendar_dates?.kitchens?.id,
      type: 'morning_reminder',
      channel: 'sms',
      content: `Morning-of ${mealType} reminder sent for proposal ${proposal.id}`,
    })

    sent++
  }

  console.log(`[notify-meals] ${mealType} — ${sent} SMS sent for ${today}`)

  return NextResponse.json({
    sent,
    meal_type: mealType,
    date: today,
    message: `Sent ${sent} ${mealType} reminder${sent !== 1 ? 's' : ''}`,
  })
}

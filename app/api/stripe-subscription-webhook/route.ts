import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_SUBSCRIPTION_WEBHOOK_SECRET!
    )
  } catch (err: any) {
    return NextResponse.json({ error: `Webhook error: ${err.message}` }, { status: 400 })
  }

  const getMetadata = (obj: any) => obj?.metadata || {}

  switch (event.type) {

    // Subscription created or trial started
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription
      const { kitchen_id } = getMetadata(sub)
      if (!kitchen_id) break

      const status = sub.status // trialing, active, past_due, canceled
      const plan = sub.metadata?.plan || 'monthly'

      await supabase.from('kitchens').update({
        subscription_status: status,
        subscription_plan: plan,
        subscription_id: sub.id,
        subscription_ends_at: status === 'trialing'
          ? new Date(sub.trial_end! * 1000).toISOString()
          : null,
      }).eq('id', kitchen_id)
      break
    }

    // Subscription cancelled or expired
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      const { kitchen_id } = getMetadata(sub)
      if (!kitchen_id) break

      await supabase.from('kitchens').update({
        subscription_status: 'free',
        subscription_plan: null,
        subscription_id: null,
        subscription_ends_at: null,
      }).eq('id', kitchen_id)
      break
    }

    // One-time lifetime payment completed
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      if (session.mode !== 'payment') break

      const { kitchen_id, plan } = session.metadata || {}
      if (!kitchen_id || plan !== 'lifetime') break

      await supabase.from('kitchens').update({
        subscription_status: 'lifetime',
        subscription_plan: 'lifetime',
        subscription_id: session.id,
        subscription_ends_at: null,
      }).eq('id', kitchen_id)
      break
    }

    // Trial ending soon — send reminder SMS
    case 'customer.subscription.trial_will_end': {
      const sub = event.data.object as Stripe.Subscription
      const { kitchen_id } = getMetadata(sub)
      if (!kitchen_id) break

      const { data: kitchen } = await supabase
        .from('kitchens')
        .select('recipient_id')
        .eq('id', kitchen_id)
        .single()

      if (kitchen?.recipient_id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('phone')
          .eq('id', kitchen.recipient_id)
          .single()

        if (profile?.phone) {
          const twilio = require('twilio')(
            process.env.TWILIO_ACCOUNT_SID,
            process.env.TWILIO_AUTH_TOKEN
          )
          await twilio.messages.create({
            body: `Your YourKitchen Care+ trial ends in 3 days. Keep SMS notifications and unlimited scheduling by upgrading at yourkitchen.app — YourKitchen`,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: profile.phone,
          }).catch((e: any) => console.error('Trial SMS failed:', e.message))
        }
      }
      break
    }
  }

  return NextResponse.json({ received: true })
}

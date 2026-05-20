// ─── YourKitchen Email Templates ─────────────────────────────────────────────
// Used by /api/send-email/route.ts and Supabase pg_cron jobs

export type EmailType = 'welcome' | 'share_link' | 'first_meal_nudge' | 'trial_expiry'

export function getEmailTemplate(type: EmailType, data: {
  name: string
  slug: string
  kitchen_name: string
  trial_days_left?: number
}) {
  const appUrl = 'https://app.yourkitchen.app'
  const kitchenUrl = `${appUrl}/k/${data.slug}`
  const dashboardUrl = `${appUrl}/dashboard`
  const firstName = data.name?.split(' ')[0] || 'there'

  const base = `
    <div style="font-family: Georgia, serif; max-width: 520px; margin: 0 auto; padding: 40px 24px; background: #FAFAF5;">
      <div style="margin-bottom: 32px;">
        <div style="font-family: sans-serif; font-size: 10px; font-weight: 600; letter-spacing: 4px; color: #6B9E7E; text-transform: uppercase; margin-bottom: 4px;">YOUR</div>
        <div style="font-size: 28px; font-weight: 500; color: #1E2620; letter-spacing: -0.5px;">Kitchen</div>
      </div>
      BODY
      <div style="margin-top: 48px; padding-top: 24px; border-top: 1px solid #DDE8E0;">
        <p style="font-size: 12px; color: #6B7066; margin: 0; font-family: sans-serif;">
          YourKitchen · <a href="https://yourkitchen.app" style="color: #3D6B4F;">yourkitchen.app</a> · 
          <a href="${appUrl}/settings" style="color: #6B7066;">Unsubscribe</a>
        </p>
      </div>
    </div>
  `

  const templates = {
    welcome: {
      subject: `Your Kitchen is ready, ${firstName} 🧡`,
      html: base.replace('BODY', `
        <h1 style="font-size: 24px; font-weight: 500; color: #1E2620; margin: 0 0 16px; letter-spacing: -0.5px;">
          Welcome to YourKitchen, ${firstName}.
        </h1>
        <p style="font-size: 16px; color: #6B7066; line-height: 1.8; margin: 0 0 24px; font-family: sans-serif;">
          Your Kitchen is live. The people who love you can now claim dates and send you meals — from the restaurants you love, delivered to your door.
        </p>
        <p style="font-size: 15px; color: #1E2620; line-height: 1.8; margin: 0 0 8px;">
          Here's your Kitchen link:
        </p>
        <div style="background: #EAF2ED; border-radius: 10px; padding: 16px 20px; margin-bottom: 24px;">
          <a href="${kitchenUrl}" style="font-size: 15px; color: #3D6B4F; font-family: sans-serif; font-weight: 600; text-decoration: none;">${kitchenUrl}</a>
        </div>
        <p style="font-size: 15px; color: #6B7066; line-height: 1.8; margin: 0 0 28px; font-family: sans-serif;">
          Share it with family and friends. They'll pick a date, choose a meal, and you'll get a notification to confirm. Once you say yes, dinner is on its way.
        </p>
        <a href="${kitchenUrl}" style="display: inline-block; background: #3D6B4F; color: #fff; text-decoration: none; padding: 14px 28px; border-radius: 10px; font-size: 14px; font-weight: 600; font-family: sans-serif;">
          View Your Kitchen →
        </a>
        <p style="font-size: 13px; color: #6B7066; margin: 32px 0 0; line-height: 1.7; font-family: sans-serif;">
          — Marques, founder of YourKitchen<br>
          <span style="font-style: italic;">Built for Danielle. For every family that needs their village to show up.</span>
        </p>
      `)
    },

    share_link: {
      subject: `Your village is waiting — share your Kitchen link`,
      html: base.replace('BODY', `
        <h1 style="font-size: 24px; font-weight: 500; color: #1E2620; margin: 0 0 16px; letter-spacing: -0.5px;">
          ${firstName}, your village is ready to show up.
        </h1>
        <p style="font-size: 16px; color: '#6B7066'; line-height: 1.8; margin: 0 0 24px; font-family: sans-serif;">
          Your Kitchen is set up — but the people who love you don't know about it yet. Share your link and let them claim a date.
        </p>
        <div style="background: #EAF2ED; border-radius: 10px; padding: 16px 20px; margin-bottom: 24px;">
          <a href="${kitchenUrl}" style="font-size: 15px; color: #3D6B4F; font-family: sans-serif; font-weight: 600; text-decoration: none;">${kitchenUrl}</a>
        </div>
        <p style="font-size: 15px; color: #1E2620; line-height: 1.8; margin: 0 0 12px;">
          Here's a message you can copy and send:
        </p>
        <div style="background: #fff; border: 1px solid #DDE8E0; border-radius: 10px; padding: 20px; margin-bottom: 28px; font-family: sans-serif;">
          <p style="font-size: 14px; color: #1E2620; line-height: 1.8; margin: 0; font-style: italic;">
            "Hey! I set up a YourKitchen so you can send me a meal on a day that works for you. Just pick a date, choose something I love, and I'll confirm it. Here's the link: ${kitchenUrl}"
          </p>
        </div>
        <a href="${dashboardUrl}" style="display: inline-block; background: #3D6B4F; color: #fff; text-decoration: none; padding: 14px 28px; border-radius: 10px; font-size: 14px; font-weight: 600; font-family: sans-serif;">
          Go to My Dashboard →
        </a>
      `)
    },

    first_meal_nudge: {
      subject: `Has anyone claimed a date yet?`,
      html: base.replace('BODY', `
        <h1 style="font-size: 24px; font-weight: 500; color: #1E2620; margin: 0 0 16px; letter-spacing: -0.5px;">
          ${firstName}, make sure you have open dates.
        </h1>
        <p style="font-size: 16px; color: #6B7066; line-height: 1.8; margin: 0 0 24px; font-family: sans-serif;">
          For your village to send meals, they need open dates to claim on your calendar. Log in and make sure you've added the dates you need covered.
        </p>
        <p style="font-size: 15px; color: #6B7066; line-height: 1.8; margin: 0 0 28px; font-family: sans-serif;">
          It takes 30 seconds — just tap a date on your calendar to open it for claims.
        </p>
        <a href="${dashboardUrl}" style="display: inline-block; background: #3D6B4F; color: #fff; text-decoration: none; padding: 14px 28px; border-radius: 10px; font-size: 14px; font-weight: 600; font-family: sans-serif;">
          Open My Calendar →
        </a>
      `)
    },

    trial_expiry: {
      subject: `Your SMS notifications expire in ${data.trial_days_left || 5} days`,
      html: base.replace('BODY', `
        <h1 style="font-size: 24px; font-weight: 500; color: #1E2620; margin: 0 0 16px; letter-spacing: -0.5px;">
          Keep your SMS notifications, ${firstName}.
        </h1>
        <p style="font-size: 16px; color: #6B7066; line-height: 1.8; margin: 0 0 24px; font-family: sans-serif;">
          Your 30-day trial ends in <strong style="color: #1E2620;">${data.trial_days_left || 5} days</strong>. After that, SMS notifications will stop — meaning you'll only get meal proposals through the app, not by text.
        </p>
        <p style="font-size: 15px; color: #6B7066; line-height: 1.8; margin: 0 0 8px; font-family: sans-serif;">
          Upgrade to Care+ to keep:
        </p>
        <ul style="color: #6B7066; font-size: 14px; line-height: 2; font-family: sans-serif; margin: 0 0 28px; padding-left: 20px;">
          <li>SMS meal proposals — reply Y or N by text</li>
          <li>Delivery confirmations sent to your phone</li>
          <li>Coordinator thank-you notifications</li>
          <li>Unlimited calendar dates</li>
          <li>Up to 10 restaurants</li>
        </ul>
        <a href="${dashboardUrl}" style="display: inline-block; background: #3D6B4F; color: #fff; text-decoration: none; padding: 14px 28px; border-radius: 10px; font-size: 14px; font-weight: 600; font-family: sans-serif;">
          Upgrade to Care+ — $9.99/mo →
        </a>
        <p style="font-size: 13px; color: #6B7066; margin: 20px 0 0; font-family: sans-serif;">
          Cancel anytime. No long-term commitment.
        </p>
      `)
    }
  }

  return templates[type]
}

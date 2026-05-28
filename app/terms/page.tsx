const S = {
  sage: '#3D6B4F', sageMid: '#6B9E7E', sageLight: '#EAF2ED',
  cream: '#FAFAF5', forest: '#1E2620', stone: '#6B7066', border: '#DDE8E0',
}

export const metadata = {
  title: 'Terms of Service — YourKitchen',
  description: 'YourKitchen Terms of Service, including our SMS Messaging Program terms.',
}

export default function TermsPage() {
  const h2: React.CSSProperties = { fontFamily: "'Lora', serif", fontSize: 21, fontWeight: 500, color: S.forest, margin: '34px 0 10px', letterSpacing: '-0.3px' }
  const h3: React.CSSProperties = { fontSize: 15, fontWeight: 600, color: S.forest, margin: '20px 0 6px' }
  const p:  React.CSSProperties = { fontSize: 15, color: S.forest, margin: '0 0 14px', lineHeight: 1.7 }
  const li: React.CSSProperties = { fontSize: 15, color: S.forest, marginBottom: 8, lineHeight: 1.7 }

  return (
    <div style={{ minHeight: '100vh', background: S.cream, fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />
      <div style={{ background: S.cream, borderBottom: `0.5px solid ${S.border}`, padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50 }}>
        <a href="/" style={{ display: 'flex', flexDirection: 'column', lineHeight: 1, textDecoration: 'none' }}>
          <span style={{ fontSize: 9, fontWeight: 500, letterSpacing: 5, color: S.sageMid, textTransform: 'uppercase' }}>Your</span>
          <span style={{ fontFamily: "'Lora', serif", fontSize: 20, fontWeight: 500, color: S.forest }}>Kitchen</span>
        </a>
        <a href="/dashboard" style={{ fontSize: 13, color: S.sage, textDecoration: 'none', fontWeight: 500 }}>← Back</a>
      </div>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '48px 24px 80px' }}>
        <h1 style={{ fontFamily: "'Lora', serif", fontSize: 34, fontWeight: 500, color: S.forest, letterSpacing: '-0.5px', marginBottom: 6 }}>Terms of Service</h1>
        <p style={{ fontSize: 13, color: S.stone, marginBottom: 36 }}>Last updated: May 28, 2026</p>

        <p style={p}>These Terms of Service ("Terms") govern your access to and use of the services provided by YourKitchen LLC ("YourKitchen," "we," "us," or "our"), including our website, web application, and SMS messaging program (collectively, the "Service"). By creating an account or using the Service, you agree to these Terms.</p>

        <h2 style={h2}>1. The Service</h2>
        <p style={p}>YourKitchen is a meal coordination platform that enables a recipient's personal support network ("coordinators") to send home-delivered restaurant meals to a recipient. A recipient sets up a "Kitchen" with preferred restaurants, calendar dates, and dietary preferences, and shares a link with their network. Coordinators select a date, restaurant, and meal and submit a proposal; the recipient confirms each delivery. Fulfillment is handled by third-party delivery providers.</p>

        <h2 style={h2}>2. Accounts &amp; Eligibility</h2>
        <p style={p}>You must be at least 18 years old and capable of forming a binding contract to create an account. You are responsible for the accuracy of the information you provide and for maintaining the security of your account credentials.</p>

        <div style={{ background: S.sageLight, border: `1px solid ${S.sage}`, borderRadius: 14, padding: 24, margin: '24px 0' }}>
          <h2 style={{ ...h2, marginTop: 0 }}>3. SMS Messaging Program</h2>

          <h3 style={h3}>3.1 Program Description</h3>
          <p style={p}>YourKitchen operates an SMS messaging program to support core functions of the Service. By opting in, you agree to receive recurring SMS text messages from YourKitchen, including:</p>
          <ul style={{ margin: '0 0 16px 22px' }}>
            <li style={li}><strong>Meal proposals</strong> — notifications when a coordinator wishes to send you a meal, requiring a Y or N reply to confirm or decline.</li>
            <li style={li}><strong>Confirmations</strong> — notifications when a meal has been confirmed and dispatched.</li>
            <li style={li}><strong>Delivery updates</strong> — notifications when a meal is on its way or has been delivered.</li>
          </ul>

          <h3 style={h3}>3.2 How You Opt In</h3>
          <p style={p}>You provide express written consent during account creation at app.yourkitchen.app. As the first step of onboarding, you enter your mobile number and must actively check a consent box (unchecked by default) that reads: "I agree to receive recurring SMS text messages from YourKitchen, including meal proposals, confirmations, and delivery updates. Message frequency varies by activity. Message &amp; data rates may apply. Reply STOP to opt out or HELP for help." You cannot proceed until the box is checked. A public description is available at <a href="/sms-opt-in" style={{ color: S.sage }}>yourkitchen.app/sms-opt-in</a>.</p>

          <h3 style={h3}>3.3 Message Frequency</h3>
          <p style={p}>Message frequency varies based on your activity within the Service — for example, how often coordinators send you meals. We do not send a fixed number of messages.</p>

          <h3 style={h3}>3.4 Cost</h3>
          <p style={p}>Message and data rates may apply. YourKitchen does not charge for SMS messages, but your mobile carrier's standard message and data rates will apply based on your plan.</p>

          <h3 style={h3}>3.5 Opt-Out</h3>
          <p style={p}>You may opt out at any time by replying <strong>STOP</strong> to any message. After you reply STOP, we will send a single confirmation message and will not send further SMS messages unless you opt back in by replying <strong>START</strong>.</p>

          <h3 style={h3}>3.6 Help</h3>
          <p style={p}>For help, reply <strong>HELP</strong> to any message, or contact us at marques@yourkitchen.app.</p>

          <h3 style={h3}>3.7 Consent Not a Condition of Purchase</h3>
          <p style={p}>Your consent to receive SMS messages is not a condition of purchasing any goods or services. Mobile opt-in consent and your phone number are never shared with third parties or affiliates for their marketing purposes. Phone numbers are used solely to operate the YourKitchen Service.</p>

          <h3 style={h3}>3.8 Supported Carriers</h3>
          <p style={{ ...p, marginBottom: 0 }}>Carriers are not liable for delayed or undelivered messages. Message delivery is subject to effective transmission by your mobile carrier and is not guaranteed.</p>
        </div>

        <h2 style={h2}>4. Payments</h2>
        <p style={p}>Coordinators pay for each meal they send at the time the recipient confirms. Payment is processed by our third-party payment processor. YourKitchen retains a platform fee on each transaction, disclosed at checkout. No charge is finalized until the recipient confirms a meal. Subscription tiers, where offered, are billed on the schedule disclosed at purchase and may be cancelled in your account settings.</p>

        <h2 style={h2}>5. Delivery</h2>
        <p style={p}>Meal delivery is fulfilled by independent third-party delivery providers. YourKitchen coordinates and dispatches orders but does not itself prepare food or perform deliveries. Estimated delivery times are not guaranteed.</p>

        <h2 style={h2}>6. Acceptable Use</h2>
        <p style={p}>You agree not to misuse the Service, including by submitting false information, using the Service for unlawful purposes, attempting to disrupt the Service, or infringing the rights of others.</p>

        <h2 style={h2}>7. Disclaimers &amp; Limitation of Liability</h2>
        <p style={p}>The Service is provided "as is" without warranties of any kind. To the fullest extent permitted by law, YourKitchen is not liable for indirect, incidental, or consequential damages arising from your use of the Service, including issues arising from third-party restaurants or delivery providers.</p>

        <h2 style={h2}>8. Changes to These Terms</h2>
        <p style={p}>We may update these Terms from time to time. Material changes will be reflected by the "Last updated" date above. Continued use of the Service after changes constitutes acceptance of the revised Terms.</p>

        <h2 style={h2}>9. Contact</h2>
        <p style={p}>Questions about these Terms may be directed to YourKitchen LLC at marques@yourkitchen.app.</p>

        <div style={{ marginTop: 48, paddingTop: 24, borderTop: `0.5px solid ${S.border}`, fontSize: 13, color: S.stone }}>
          YourKitchen LLC · Waller, TX · <a href="mailto:marques@yourkitchen.app" style={{ color: S.stone }}>marques@yourkitchen.app</a><br />
          <a href="/" style={{ color: S.stone }}>Home</a> · <a href="/privacy" style={{ color: S.stone }}>Privacy Policy</a> · <a href="/sms-opt-in" style={{ color: S.stone }}>SMS Opt-In</a>
        </div>
      </div>
    </div>
  )
}

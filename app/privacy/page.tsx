const S = {
  sage: '#3D6B4F', sageMid: '#6B9E7E', sageLight: '#EAF2ED',
  cream: '#FAFAF5', forest: '#1E2620', stone: '#6B7066', border: '#DDE8E0',
}

export const metadata = {
  title: 'Privacy Policy — YourKitchen',
  description: 'YourKitchen Privacy Policy — how we collect, use, and protect your information.',
}

export default function PrivacyPage() {
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
        <h1 style={{ fontFamily: "'Lora', serif", fontSize: 34, fontWeight: 500, color: S.forest, letterSpacing: '-0.5px', marginBottom: 6 }}>Privacy Policy</h1>
        <p style={{ fontSize: 13, color: S.stone, marginBottom: 36 }}>Last updated: May 28, 2026</p>

        <p style={p}>This Privacy Policy explains how YourKitchen LLC ("YourKitchen," "we," "us," or "our") collects, uses, and protects your information when you use our website, web application, and SMS messaging program (collectively, the "Service").</p>

        <h2 style={h2}>1. Information We Collect</h2>
        <p style={p}>We collect the following information to operate the Service:</p>
        <ul style={{ margin: '0 0 16px 22px' }}>
          <li style={li}><strong>Account information</strong> — your name, email address, and mobile phone number.</li>
          <li style={li}><strong>Recipient details</strong> — delivery address, household size, and dietary preferences provided when a Kitchen is set up.</li>
          <li style={li}><strong>Coordinator details</strong> — name, contact information, and payment method when sending a meal.</li>
          <li style={li}><strong>Usage information</strong> — interactions with the Service, such as meal proposals, confirmations, and order history.</li>
        </ul>

        <h2 style={h2}>2. How We Use Your Information</h2>
        <p style={p}>We use your information to:</p>
        <ul style={{ margin: '0 0 16px 22px' }}>
          <li style={li}>Operate and provide the Service, including coordinating and dispatching meal deliveries.</li>
          <li style={li}>Send transactional SMS messages (meal proposals, confirmations, and delivery updates) to phone numbers that have opted in.</li>
          <li style={li}>Process payments through our third-party payment processor.</li>
          <li style={li}>Communicate with you about your account and the Service.</li>
          <li style={li}>Maintain the security and integrity of the Service.</li>
        </ul>

        <div style={{ background: S.sageLight, border: `1px solid ${S.sage}`, borderRadius: 14, padding: '20px 24px', margin: '24px 0' }}>
          <h3 style={{ ...h3, marginTop: 0 }}>SMS Consent &amp; Phone Numbers</h3>
          <p style={{ ...p, marginBottom: 0 }}>Mobile information and SMS opt-in consent are <strong>never shared with third parties or affiliates for their marketing purposes</strong>. Your phone number is used solely to operate the YourKitchen Service — to send meal proposals, confirmations, and delivery updates you have consented to receive. You may opt out at any time by replying STOP. See our <a href="/sms-opt-in" style={{ color: S.sage }}>SMS Opt-In page</a> and <a href="/terms" style={{ color: S.sage }}>Terms of Service, Section 3</a> for details.</p>
        </div>

        <h2 style={h2}>3. How We Share Information</h2>
        <p style={p}>We share information only as necessary to operate the Service:</p>
        <ul style={{ margin: '0 0 16px 22px' }}>
          <li style={li}><strong>Delivery providers</strong> — we share the recipient's name, delivery address, and order details with third-party delivery providers solely to fulfill a confirmed delivery.</li>
          <li style={li}><strong>Restaurants</strong> — order details are shared with the selected restaurant to prepare the meal.</li>
          <li style={li}><strong>Payment processor</strong> — payment information is handled by our third-party payment processor; we do not store full card numbers.</li>
          <li style={li}><strong>Service providers</strong> — we use trusted vendors for hosting, messaging, and analytics, bound by confidentiality obligations.</li>
          <li style={li}><strong>Legal requirements</strong> — we may disclose information where required by law.</li>
        </ul>
        <p style={p}>We do not sell your personal information.</p>

        <h2 style={h2}>4. Data Retention</h2>
        <p style={p}>We retain your information for as long as your account is active or as needed to provide the Service and comply with legal obligations. You may request deletion of your account and associated data at any time through your account settings or by contacting us.</p>

        <h2 style={h2}>5. Security</h2>
        <p style={p}>We use industry-standard measures to protect your information, including encryption in transit and access controls. No method of transmission or storage is completely secure, but we work to protect your data.</p>

        <h2 style={h2}>6. Your Choices</h2>
        <ul style={{ margin: '0 0 16px 22px' }}>
          <li style={li}><strong>SMS</strong> — reply STOP to any message to opt out of SMS at any time.</li>
          <li style={li}><strong>Account</strong> — update or delete your account information in settings.</li>
          <li style={li}><strong>Access</strong> — contact us to request a copy of the information we hold about you.</li>
        </ul>

        <h2 style={h2}>7. Children's Privacy</h2>
        <p style={p}>The Service is not directed to individuals under 18, and we do not knowingly collect personal information from children.</p>

        <h2 style={h2}>8. Changes to This Policy</h2>
        <p style={p}>We may update this Privacy Policy from time to time. Material changes will be reflected by the "Last updated" date above.</p>

        <h2 style={h2}>9. Contact</h2>
        <p style={p}>Questions about this Privacy Policy may be directed to YourKitchen LLC at marques@yourkitchen.app.</p>

        <div style={{ marginTop: 48, paddingTop: 24, borderTop: `0.5px solid ${S.border}`, fontSize: 13, color: S.stone }}>
          YourKitchen LLC · Hockley, TX · <a href="mailto:marques@yourkitchen.app" style={{ color: S.stone }}>marques@yourkitchen.app</a><br />
          <a href="/" style={{ color: S.stone }}>Home</a> · <a href="/terms" style={{ color: S.stone }}>Terms of Service</a> · <a href="/sms-opt-in" style={{ color: S.stone }}>SMS Opt-In</a>
        </div>
      </div>
    </div>
  )
}

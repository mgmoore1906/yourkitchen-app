export default function PaymentSuccess() {
  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />
      <div style={{ textAlign: 'center', maxWidth: 420, padding: '0 32px' }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>📨</div>
        <h1 style={{ fontFamily: "'Lora', serif", fontSize: 28, fontWeight: 500, color: '#1E2620', margin: '0 0 12px' }}>
          Proposal sent!
        </h1>
        <p style={{ fontSize: 15, color: '#6B7066', lineHeight: 1.7, fontWeight: 300, marginBottom: 24 }}>
          Your card has been authorized — but nothing is charged yet. Once Danielle confirms, your card is charged and the order goes straight to DoorDash. Thank you for showing up. 🧡
        </p>
        <div style={{ background: '#EAF2ED', borderRadius: 16, padding: '16px 20px' }}>
          <p style={{ fontSize: 13, color: '#3D6B4F', margin: 0, lineHeight: 1.6 }}>
            💳 The hold releases automatically if Danielle declines or the proposal expires.
          </p>
        </div>
      </div>
    </div>
  )
}

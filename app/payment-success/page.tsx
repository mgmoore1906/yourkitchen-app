export default function PaymentSuccess() {
  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />
      <div style={{ textAlign: 'center', maxWidth: 400, padding: '0 32px' }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>🧡</div>
        <h1 style={{ fontFamily: "'Lora', serif", fontSize: 28, fontWeight: 500, color: '#1E2620', margin: '0 0 12px' }}>
          The good deed is done.
        </h1>
        <p style={{ fontSize: 15, color: '#6B7066', lineHeight: 1.7, fontWeight: 300 }}>
          Your payment was received. Dinner is on its way. Thank you for showing up for someone you love.
        </p>
      </div>
    </div>
  )
}
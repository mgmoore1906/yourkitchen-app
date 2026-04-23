'use client'

import { useState } from 'react'

export default function CoordKitchenClient({ kitchen, availableDates, restaurants }: any) {
  const [step, setStep] = useState(1)
  const [selectedDate, setSelectedDate] = useState<any>(null)
  const [selectedRestaurant, setSelectedRestaurant] = useState<any>(null)
  const [selectedItem, setSelectedItem] = useState<any>(null)
  const [note, setNote] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00')
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  }

  const handleSubmit = async () => {
    setLoading(true)
    setErrorMsg('')

    const res = await fetch('/api/proposal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        email,
        calendar_date_id: selectedDate.id,
        restaurant_id: selectedRestaurant.id,
        menu_item_id: selectedItem.id,
        note,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      setErrorMsg('Error: ' + data.error)
      setLoading(false)
      return
    }

    setSubmitted(true)
    setLoading(false)
  }

  if (submitted) {
    return (
      <div style={{ minHeight: '100vh', background: '#FAFAF5', fontFamily: "'DM Sans', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />
        <div style={{ textAlign: 'center', padding: '0 32px', maxWidth: 400 }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>📨</div>
          <h1 style={{ fontFamily: "'Lora', serif", fontSize: 28, fontWeight: 500, color: '#1E2620', margin: '0 0 12px' }}>Proposal sent!</h1>
          <p style={{ fontSize: 15, color: '#6B7066', lineHeight: 1.7, margin: '0 0 24px', fontWeight: 300 }}>
            {kitchen.name.split("'")[0]} will get a notification to confirm. Once they say yes, dinner is on its way. Thank you. 🧡
          </p>
          <div style={{ background: '#fff', border: '1px solid #DDE8E0', borderRadius: 16, padding: '20px', textAlign: 'left', marginBottom: 16 }}>
            {[
              ['Meal', selectedItem?.name],
              ['From', selectedRestaurant?.name],
              ['Date', formatDate(selectedDate?.date)],
              ['Status', '⏳ Awaiting confirmation'],
            ].map(([l, v]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid #EAF2ED' }}>
                <span style={{ fontSize: 13, color: '#6B7066', fontWeight: 300 }}>{l}</span>
                <span style={{ fontSize: 13, color: '#1E2620', fontWeight: 500 }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF5', fontFamily: "'DM Sans', sans-serif", padding: '0 0 40px' }}>
      <link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />

      <div style={{ background: '#1E2620', padding: '20px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 9, fontWeight: 500, letterSpacing: 5, color: '#6B9E7E', textTransform: 'uppercase' }}>Your</div>
        <div style={{ fontFamily: "'Lora', serif", fontSize: 24, fontWeight: 500, color: '#fff' }}>Kitchen</div>
      </div>

      <div style={{ background: '#fff', borderBottom: '1px solid #DDE8E0', padding: '20px 24px', textAlign: 'center' }}>
        <h1 style={{ fontFamily: "'Lora', serif", fontSize: 22, fontWeight: 500, color: '#1E2620', margin: '0 0 4px' }}>{kitchen.name}</h1>
        <p style={{ fontSize: 13, color: '#6B7066', margin: 0, fontWeight: 300 }}>{kitchen.address}</p>
        {kitchen.dietary_restrictions?.length > 0 && (
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap', marginTop: 10 }}>
            {kitchen.dietary_restrictions.map((d: string) => (
              <span key={d} style={{ background: '#EAF2ED', color: '#3D6B4F', borderRadius: 20, fontSize: 11, fontWeight: 500, padding: '4px 12px' }}>⚠️ {d}</span>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6, padding: '20px 24px 0', maxWidth: 500, margin: '0 auto' }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{ flex: 1, height: 4, borderRadius: 4, background: i <= step ? '#3D6B4F' : '#DDE8E0' }} />
        ))}
      </div>

      <div style={{ padding: '24px', maxWidth: 500, margin: '0 auto' }}>

        {step === 1 && (
          <>
            <h2 style={h2Style}>Pick a date</h2>
            <p style={subStyle}>These are the dates open on {kitchen.name.split("'")[0]}&apos;s Kitchen.</p>
            {availableDates.length === 0 ? (
              <div style={{ background: '#EAF2ED', borderRadius: 14, padding: '20px', textAlign: 'center' }}>
                <p style={{ color: '#3D6B4F', margin: 0 }}>No open dates right now. Check back soon!</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
                {availableDates.map((d: any) => (
                  <button key={d.id} onClick={() => setSelectedDate(d)}
                    style={{ background: selectedDate?.id === d.id ? '#EAF2ED' : '#fff', border: `2px solid ${selectedDate?.id === d.id ? '#3D6B4F' : '#DDE8E0'}`, borderRadius: 14, padding: '16px 18px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: "'DM Sans', sans-serif" }}>
                    <div>
                      <div style={{ fontFamily: "'Lora', serif", fontSize: 15, fontWeight: 600, color: '#1E2620' }}>📅 {formatDate(d.date)}</div>
                      <div style={{ fontSize: 12, color: '#6B7066', fontWeight: 300, marginTop: 2 }}>Delivery {d.delivery_window_start?.slice(0, 5)} – {d.delivery_window_end?.slice(0, 5)}</div>
                    </div>
                    {selectedDate?.id === d.id && <span style={{ color: '#3D6B4F', fontSize: 20 }}>✓</span>}
                  </button>
                ))}
              </div>
            )}
            <button onClick={() => setStep(2)} disabled={!selectedDate} style={btnStyle(!selectedDate)}>
              Next: Choose Restaurant →
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <h2 style={h2Style}>Choose a restaurant</h2>
            <p style={subStyle}>{kitchen.name.split("'")[0]}&apos;s preferred restaurants — all delivered via DoorDash.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
              {restaurants.map((r: any) => (
                <button key={r.id} onClick={() => setSelectedRestaurant(r)}
                  style={{ background: selectedRestaurant?.id === r.id ? '#EAF2ED' : '#fff', border: `2px solid ${selectedRestaurant?.id === r.id ? '#3D6B4F' : '#DDE8E0'}`, borderRadius: 16, padding: '14px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, fontFamily: "'DM Sans', sans-serif" }}>
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div style={{ fontFamily: "'Lora', serif", fontSize: 15, fontWeight: 600, color: '#1E2620' }}>{r.name}</div>
                    <div style={{ fontSize: 12, color: '#6B7066', fontWeight: 300, marginTop: 2 }}>{r.cuisine} · DoorDash</div>
                  </div>
                  {selectedRestaurant?.id === r.id && <span style={{ color: '#3D6B4F', fontSize: 20 }}>✓</span>}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStep(1)} style={backStyle}>← Back</button>
              <button onClick={() => setStep(3)} disabled={!selectedRestaurant} style={{ ...btnStyle(!selectedRestaurant), flex: 1 }}>
                Next: Select a Meal →
              </button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h2 style={h2Style}>Select a meal</h2>
            <p style={subStyle}>⭐ starred items are {kitchen.name.split("'")[0]}&apos;s favorites.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
              {selectedRestaurant?.menu_items?.map((item: any) => (
                <button key={item.id} onClick={() => setSelectedItem(item)}
                  style={{ background: selectedItem?.id === item.id ? '#EAF2ED' : '#fff', border: `2px solid ${selectedItem?.id === item.id ? '#3D6B4F' : '#DDE8E0'}`, borderRadius: 14, padding: '14px 16px', cursor: 'pointer', textAlign: 'left', display: 'flex', gap: 12, alignItems: 'flex-start', fontFamily: "'DM Sans', sans-serif" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: "'Lora', serif", fontSize: 14, fontWeight: 600, color: '#1E2620' }}>{item.is_favorite ? '⭐ ' : ''}{item.name}</div>
                    <div style={{ fontSize: 12, color: '#6B7066', fontWeight: 300, marginTop: 2 }}>{item.description}</div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#3D6B4F', flexShrink: 0 }}>${item.price}</div>
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStep(2)} style={backStyle}>← Back</button>
              <button onClick={() => setStep(4)} disabled={!selectedItem} style={{ ...btnStyle(!selectedItem), flex: 1 }}>
                Next: Your Info →
              </button>
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <h2 style={h2Style}>Almost done!</h2>
            <p style={subStyle}>Let {kitchen.name.split("'")[0]} know who&apos;s sending dinner.</p>

            <div style={{ background: '#EAF2ED', borderRadius: 14, padding: '16px', marginBottom: 20 }}>
              {[
                ['Meal', selectedItem?.name],
                ['From', selectedRestaurant?.name],
                ['Date', formatDate(selectedDate?.date)],
              ].map(([l, v]) => (
                <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #C8DDD0' }}>
                  <span style={{ fontSize: 12, color: '#6B9E7E', fontWeight: 300 }}>{l}</span>
                  <span style={{ fontSize: 12, color: '#3D6B4F', fontWeight: 600 }}>{v}</span>
                </div>
              ))}
            </div>

            <label style={labelStyle}>Your name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Marcus" style={inputStyle} />

            <label style={labelStyle}>Your email</label>
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="marcus@example.com" type="email" style={inputStyle} />

            <label style={labelStyle}>Personal note (optional)</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Thinking of you! Hope you enjoy dinner tonight 🧡" style={{ ...inputStyle, minHeight: 90, resize: 'none' }} />

            <div style={{ background: '#fff', border: '1px solid #DDE8E0', borderRadius: 12, padding: '14px 16px', marginBottom: 20 }}>
              <p style={{ fontSize: 13, color: '#6B7066', margin: 0, lineHeight: 1.6 }}>
                💳 You won&apos;t be charged until {kitchen.name.split("'")[0]} confirms. No money moves until they say yes.
              </p>
            </div>

            {errorMsg && <p style={{ color: '#B94040', fontSize: 13, marginBottom: 16 }}>{errorMsg}</p>}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStep(3)} style={backStyle}>← Back</button>
              <button onClick={handleSubmit} disabled={!name || !email || loading} style={{ ...btnStyle(!name || !email || loading), flex: 1 }}>
                {loading ? 'Sending…' : 'Send Proposal 🧡'}
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  )
}

const h2Style: React.CSSProperties = {
  fontFamily: "'Lora', serif", fontSize: 22, fontWeight: 500, color: '#1E2620', margin: '0 0 6px'
}

const subStyle: React.CSSProperties = {
  fontSize: 14, color: '#6B7066', margin: '0 0 20px', fontWeight: 300
}

const btnStyle = (disabled: boolean): React.CSSProperties => ({
  width: '100%', padding: '14px', borderRadius: 10, border: 'none',
  background: disabled ? '#DDE8E0' : '#3D6B4F',
  color: disabled ? '#6B7066' : '#fff',
  fontSize: 14, fontWeight: 500,
  cursor: disabled ? 'default' : 'pointer',
  fontFamily: "'DM Sans', sans-serif"
})

const backStyle: React.CSSProperties = {
  padding: '14px 20px', borderRadius: 10, border: '1.5px solid #DDE8E0',
  background: 'transparent', fontSize: 14, color: '#6B7066', cursor: 'pointer',
  fontFamily: "'DM Sans', sans-serif"
}

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: '#6B7066', letterSpacing: 1.5,
  textTransform: 'uppercase', display: 'block', marginBottom: 8
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '13px 16px', borderRadius: 10,
  border: '1.5px solid #DDE8E0', fontSize: 14, background: '#fff',
  outline: 'none', boxSizing: 'border-box', marginBottom: 20,
  fontFamily: "'DM Sans', sans-serif", color: '#1E2620'
}
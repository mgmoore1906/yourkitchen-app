'use client'
import { useState } from 'react'

const MEAL_TYPE_RESTAURANTS: Record<string, string[]> = {
  breakfast: ['First Watch', 'The Toasted Yolk Cafe', 'Harvest Kitchen & Bakery'],
  lunch:     ['Cava', 'The Kebab Shop', 'Mod Fresh', 'Harvest Kitchen & Bakery'],
  dinner:    ['Cava', 'The Kebab Shop', 'Up Thai Kitchen'],
}

const MEAL_TYPE_LABELS: Record<string, string> = {
  breakfast: '🌅 Breakfast',
  lunch:     '☀️ Lunch',
  dinner:    '🌙 Dinner',
}

const MEAL_TYPE_COLORS: Record<string, { color: string, bg: string }> = {
  breakfast: { color: '#E8834A', bg: '#FFF0E8' },
  lunch:     { color: '#4A8FA8', bg: '#E8F4F8' },
  dinner:    { color: '#3D6B4F', bg: '#EAF2ED' },
}

// ─── Coordinator Calendar ─────────────────────────────────────────────────────

function CoordCalendar({
  availableDates,
  selectedIds,
  onToggle,
}: {
  availableDates: any[]
  selectedIds: Set<string>
  onToggle: (slot: any) => void
}) {
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())

  const todayStr = today.toISOString().split('T')[0]
  const monthName = new Date(viewYear, viewMonth, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const firstDay = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  const dateMap: Record<string, any[]> = {}
  availableDates.forEach(d => {
    if (!dateMap[d.date]) dateMap[d.date] = []
    dateMap[d.date].push(d)
  })

  const cells: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <div style={{ background: '#fff', border: '1px solid #DDE8E0', borderRadius: 16, padding: '16px', marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <button onClick={prevMonth} style={{ background: '#EAF2ED', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', fontSize: 16, color: '#3D6B4F', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
        <p style={{ fontFamily: "'Lora', serif", fontSize: 16, fontWeight: 500, color: '#1E2620', margin: 0 }}>{monthName}</p>
        <button onClick={nextMonth} style={{ background: '#EAF2ED', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', fontSize: 16, color: '#3D6B4F', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 3 }}>
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 600, color: '#6B7066', padding: '3px 0' }}>{d}</div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
        {cells.map((day, i) => {
          if (!day) return <div key={i} />
          const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const isPast = dateStr < todayStr
          const isToday = dateStr === todayStr
          const slots = dateMap[dateStr] || []
          const hasSlots = slots.length > 0
          const selectedSlots = slots.filter((s: any) => selectedIds.has(s.id))
          const isAnySelected = selectedSlots.length > 0

          return (
            <button
              key={i}
              onClick={() => {
                if (!hasSlots || isPast) return
                slots.forEach((s: any) => onToggle(s))
              }}
              disabled={isPast || !hasSlots}
              style={{
                background: isAnySelected ? '#EAF2ED' : hasSlots ? '#F8FAF8' : 'transparent',
                border: isToday
                  ? '2px solid #3D6B4F'
                  : isAnySelected
                  ? '2px solid #3D6B4F'
                  : hasSlots
                  ? '1.5px solid #DDE8E0'
                  : '1.5px solid transparent',
                borderRadius: 10, padding: '8px 2px', minHeight: 52,
                cursor: hasSlots && !isPast ? 'pointer' : 'default',
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', gap: 3, transition: 'all 0.1s',
                fontFamily: "'DM Sans', sans-serif",
                WebkitTapHighlightColor: 'transparent',
                opacity: isPast ? 0.35 : 1,
              }}
            >
              <span style={{ fontSize: 13, fontWeight: isToday ? 700 : 500, color: isPast ? '#C8D5CA' : isAnySelected ? '#3D6B4F' : '#1E2620', lineHeight: 1 }}>{day}</span>
              {hasSlots && (
                <div style={{ display: 'flex', gap: 2 }}>
                  {slots.map((slot: any, si: number) => {
                    const mc = MEAL_TYPE_COLORS[slot.meal_type] || MEAL_TYPE_COLORS.dinner
                    const isSlotSelected = selectedIds.has(slot.id)
                    return (
                      <div key={si} style={{ width: 6, height: 6, borderRadius: '50%', background: isSlotSelected ? mc.color : '#C8D5CA', flexShrink: 0 }} />
                    )
                  })}
                </div>
              )}
            </button>
          )
        })}
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 14, paddingTop: 12, borderTop: '1px solid #EAF2ED' }}>
        {[
          { dot: '#E8834A', label: 'Breakfast' },
          { dot: '#4A8FA8', label: 'Lunch' },
          { dot: '#3D6B4F', label: 'Dinner' },
          { dot: '#C8D5CA', label: 'Not selected' },
        ].map(({ dot, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: dot, flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: '#6B7066', fontWeight: 500 }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Selected Dates Summary ───────────────────────────────────────────────────

function SelectedDatesSummary({ selectedSlots, onRemove }: { selectedSlots: any[], onRemove: (id: string) => void }) {
  if (selectedSlots.length === 0) return null
  return (
    <div style={{ background: '#EAF2ED', borderRadius: 14, padding: '14px 16px', marginBottom: 16 }}>
      <p style={{ fontSize: 11, fontWeight: 600, color: '#3D6B4F', letterSpacing: 1.5, textTransform: 'uppercase', margin: '0 0 10px' }}>
        {selectedSlots.length} date{selectedSlots.length > 1 ? 's' : ''} selected
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {selectedSlots.map((slot: any) => {
          const d = new Date(slot.date + 'T12:00:00')
          const label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
          const mc = MEAL_TYPE_COLORS[slot.meal_type] || MEAL_TYPE_COLORS.dinner
          return (
            <div key={slot.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ background: mc.bg, color: mc.color, borderRadius: 20, fontSize: 10, fontWeight: 600, padding: '2px 8px', border: `1px solid ${mc.color}` }}>
                  {MEAL_TYPE_LABELS[slot.meal_type] || slot.meal_type}
                </span>
                <span style={{ fontSize: 13, color: '#1E2620', fontWeight: 500 }}>{label}</span>
              </div>
              <button onClick={() => onRemove(slot.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7066', fontSize: 16, padding: '0 4px' }}>✕</button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CoordKitchenClient({ kitchen, availableDates, restaurants }: any) {
  const [step, setStep] = useState(1)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [selectedRestaurant, setSelectedRestaurant] = useState<any>(null)
  const [selectedItem, setSelectedItem] = useState<any>(null)
  const [note, setNote] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const selectedSlots = availableDates.filter((d: any) => selectedIds.has(d.id))

  const toggleSlot = (slot: any) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(slot.id)) next.delete(slot.id)
      else next.add(slot.id)
      return next
    })
  }

  const removeSlot = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00')
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  }

  const selectedMealTypes = [...new Set(selectedSlots.map((s: any) => s.meal_type))]
  const filteredRestaurants = selectedMealTypes.length > 0
    ? restaurants.filter((r: any) =>
        selectedMealTypes.some((mt: any) =>
          (MEAL_TYPE_RESTAURANTS[mt] || []).includes(r.name)
        )
      )
    : restaurants

  const handleSubmit = async () => {
    setLoading(true)
    setErrorMsg('')

    const results = await Promise.all(
      selectedSlots.map((slot: any) =>
        fetch('/api/proposal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name, email, phone,
            calendar_date_id: slot.id,
            restaurant_id: selectedRestaurant.id,
            menu_item_id: selectedItem.id,
            note,
          }),
        })
      )
    )

    const failed = results.filter(r => !r.ok)
    if (failed.length > 0) {
      setErrorMsg(`${failed.length} proposal(s) failed to send. Please try again.`)
      setLoading(false)
      return
    }

    setSubmitted(true)
    setLoading(false)
  }

  // ── Submitted ──────────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div style={{ minHeight: '100vh', background: '#FAFAF5', fontFamily: "'DM Sans', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />
        <div style={{ textAlign: 'center', padding: '0 32px', maxWidth: 420 }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>📨</div>
          <h1 style={{ fontFamily: "'Lora', serif", fontSize: 28, fontWeight: 500, color: '#1E2620', margin: '0 0 12px' }}>
            {selectedSlots.length > 1 ? `${selectedSlots.length} proposals sent!` : 'Proposal sent!'}
          </h1>
          <p style={{ fontSize: 15, color: '#6B7066', lineHeight: 1.7, margin: '0 0 24px', fontWeight: 300 }}>
            {kitchen.name.split("'")[0]} will get a notification to confirm each one. Once they say yes, dinner is on its way. Thank you. 🧡
          </p>

          <div style={{ background: '#fff', border: '1px solid #DDE8E0', borderRadius: 16, padding: '20px', textAlign: 'left', marginBottom: 24 }}>
            {[
              ['Meal', selectedItem?.name],
              ['From', selectedRestaurant?.name],
              ['Dates', selectedSlots.length === 1
                ? formatDate(selectedSlots[0]?.date)
                : `${selectedSlots.length} dates`],
              ['Status', '⏳ Awaiting confirmation'],
            ].map(([l, v]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid #EAF2ED' }}>
                <span style={{ fontSize: 13, color: '#6B7066', fontWeight: 300 }}>{l}</span>
                <span style={{ fontSize: 13, color: '#1E2620', fontWeight: 500 }}>{v}</span>
              </div>
            ))}
          </div>

          {/* Referral card */}
          <div style={{ background: '#1E2620', borderRadius: 16, padding: '20px 24px', textAlign: 'left' }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: '#6B9E7E', letterSpacing: 1.5, textTransform: 'uppercase', margin: '0 0 8px' }}>Know someone who needs this?</p>
            <p style={{ fontFamily: "'Lora', serif", fontSize: 17, fontWeight: 500, color: '#fff', margin: '0 0 6px' }}>Set up a free Kitchen for them.</p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', margin: '0 0 16px', fontWeight: 300, lineHeight: 1.6 }}>
              New baby, illness, loss — if someone you love needs their village to show up, YourKitchen makes it easy.
            </p>
            <a href="/signup" style={{ display: 'block', background: '#3D6B4F', color: '#fff', borderRadius: 10, padding: '13px', textAlign: 'center', fontSize: 14, fontWeight: 500, textDecoration: 'none', fontFamily: "'DM Sans', sans-serif" }}>
              Start a free Kitchen →
            </a>
          </div>
        </div>
      </div>
    )
  }

  // ── Main flow ──────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF5', fontFamily: "'DM Sans', sans-serif", padding: '0 0 40px' }}>
      <link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ background: '#1E2620', padding: '20px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 9, fontWeight: 500, letterSpacing: 5, color: '#6B9E7E', textTransform: 'uppercase' }}>Your</div>
        <div style={{ fontFamily: "'Lora', serif", fontSize: 24, fontWeight: 500, color: '#fff' }}>Kitchen</div>
      </div>

      <div style={{ background: '#fff', borderBottom: '1px solid #DDE8E0', padding: '20px 24px', textAlign: 'center' }}>
        <h1 style={{ fontFamily: "'Lora', serif", fontSize: 22, fontWeight: 500, color: '#1E2620', margin: '0 0 4px' }}>{kitchen.name}</h1>
        {kitchen.dietary_restrictions?.length > 0 && (
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap', marginTop: 10 }}>
            {kitchen.dietary_restrictions.map((d: string) => (
              <span key={d} style={{ background: '#EAF2ED', color: '#3D6B4F', borderRadius: 20, fontSize: 11, fontWeight: 500, padding: '4px 12px' }}>⚠️ {d}</span>
            ))}
          </div>
        )}
      </div>

      {/* Progress */}
      <div style={{ display: 'flex', gap: 6, padding: '20px 24px 0', maxWidth: 500, margin: '0 auto' }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{ flex: 1, height: 4, borderRadius: 4, background: i <= step ? '#3D6B4F' : '#DDE8E0', transition: 'background 0.3s' }} />
        ))}
      </div>

      <div style={{ padding: '24px', maxWidth: 500, margin: '0 auto' }}>

        {/* Step 1 — Pick dates */}
        {step === 1 && (
          <>
            <h2 style={h2Style}>Pick your dates</h2>
            <p style={subStyle}>Tap any highlighted date to claim it. You can select multiple.</p>

            {availableDates.length === 0 ? (
              <div style={{ background: '#EAF2ED', borderRadius: 14, padding: '20px', textAlign: 'center', marginBottom: 20 }}>
                <p style={{ color: '#3D6B4F', margin: 0 }}>No open dates right now. Check back soon!</p>
              </div>
            ) : (
              <CoordCalendar
                availableDates={availableDates}
                selectedIds={selectedIds}
                onToggle={toggleSlot}
              />
            )}

            <SelectedDatesSummary selectedSlots={selectedSlots} onRemove={removeSlot} />

            <button
              onClick={() => setStep(2)}
              disabled={selectedSlots.length === 0}
              style={btnStyle(selectedSlots.length === 0)}
            >
              {selectedSlots.length === 0
                ? 'Select at least one date'
                : `Next: Choose Restaurant → (${selectedSlots.length} date${selectedSlots.length > 1 ? 's' : ''})`}
            </button>
          </>
        )}

        {/* Step 2 — Choose restaurant */}
        {step === 2 && (
          <>
            <h2 style={h2Style}>Choose a restaurant</h2>
            <p style={subStyle}>
              {selectedMealTypes.length > 0
                ? `Showing restaurants that match your selected meal type${selectedMealTypes.length > 1 ? 's' : ''}.`
                : `${kitchen.name.split("'")[0]}'s preferred restaurants — all delivered via DoorDash.`}
            </p>

            <SelectedDatesSummary selectedSlots={selectedSlots} onRemove={removeSlot} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
              {filteredRestaurants.map((r: any) => (
                <button key={r.id} onClick={() => setSelectedRestaurant(r)} style={{
                  background: selectedRestaurant?.id === r.id ? '#EAF2ED' : '#fff',
                  border: `2px solid ${selectedRestaurant?.id === r.id ? '#3D6B4F' : '#DDE8E0'}`,
                  borderRadius: 16, padding: '14px 16px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 14,
                  fontFamily: "'DM Sans', sans-serif",
                }}>
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div style={{ fontFamily: "'Lora', serif", fontSize: 15, fontWeight: 600, color: '#1E2620' }}>{r.name}</div>
                    <div style={{ fontSize: 12, color: '#6B7066', fontWeight: 300, marginTop: 2 }}>{r.cuisine} · DoorDash</div>
                  </div>
                  {selectedRestaurant?.id === r.id && <span style={{ color: '#3D6B4F', fontSize: 20 }}>✓</span>}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setStep(1); setSelectedRestaurant(null) }} style={backStyle}>← Back</button>
              <button onClick={() => setStep(3)} disabled={!selectedRestaurant} style={{ ...btnStyle(!selectedRestaurant), flex: 1 }}>
                Next: Select a Meal →
              </button>
            </div>
          </>
        )}

        {/* Step 3 — Select a meal */}
        {step === 3 && (
          <>
            <h2 style={h2Style}>Select a meal</h2>
            <p style={subStyle}>⭐ starred items are {kitchen.name.split("'")[0]}&apos;s favorites.</p>

            <SelectedDatesSummary selectedSlots={selectedSlots} onRemove={removeSlot} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
              {selectedRestaurant?.menu_items?.map((item: any) => (
                <button key={item.id} onClick={() => setSelectedItem(item)} style={{
                  background: selectedItem?.id === item.id ? '#EAF2ED' : '#fff',
                  border: `2px solid ${selectedItem?.id === item.id ? '#3D6B4F' : '#DDE8E0'}`,
                  borderRadius: 14, padding: '14px 16px', cursor: 'pointer',
                  textAlign: 'left', display: 'flex', gap: 12, alignItems: 'flex-start',
                  fontFamily: "'DM Sans', sans-serif",
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: "'Lora', serif", fontSize: 14, fontWeight: 600, color: '#1E2620' }}>
                      {item.is_favorite ? '⭐ ' : ''}{item.name}
                    </div>
                    <div style={{ fontSize: 12, color: '#6B7066', fontWeight: 300, marginTop: 2 }}>{item.description}</div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#3D6B4F', flexShrink: 0 }}>${item.price}</div>
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setStep(2); setSelectedItem(null) }} style={backStyle}>← Back</button>
              <button onClick={() => setStep(4)} disabled={!selectedItem} style={{ ...btnStyle(!selectedItem), flex: 1 }}>
                Next: Your Info →
              </button>
            </div>
          </>
        )}

        {/* Step 4 — Your info */}
        {step === 4 && (
          <>
            <h2 style={h2Style}>Almost done!</h2>
            <p style={subStyle}>Let {kitchen.name.split("'")[0]} know who&apos;s sending dinner.</p>

            <div style={{ background: '#EAF2ED', borderRadius: 14, padding: '16px', marginBottom: 20 }}>
              {[
                ['Meal', selectedItem?.name],
                ['From', selectedRestaurant?.name],
                ['Dates', selectedSlots.length === 1
                  ? new Date(selectedSlots[0].date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                  : `${selectedSlots.length} dates selected`],
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
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" style={inputStyle} />

            <label style={labelStyle}>Your phone</label>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(555) 123-4567" style={inputStyle} />
            <p style={{ fontSize: 12, color: '#6B7066', marginTop: -16, marginBottom: 20, fontWeight: 300 }}>
              We&apos;ll text you when your meal is delivered.
            </p>

            <label style={labelStyle}>Personal note (optional)</label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Thinking of you! Hope you enjoy dinner tonight 🧡"
              style={{ ...inputStyle, minHeight: 90, resize: 'none' }}
            />

            <div style={{ background: '#fff', border: '1px solid #DDE8E0', borderRadius: 12, padding: '14px 16px', marginBottom: 20 }}>
              <p style={{ fontSize: 13, color: '#6B7066', margin: 0, lineHeight: 1.6 }}>
                💳 You won&apos;t be charged until {kitchen.name.split("'")[0]} confirms each date. No money moves until they say yes.
              </p>
            </div>

            {errorMsg && <p style={{ color: '#B94040', fontSize: 13, marginBottom: 16 }}>{errorMsg}</p>}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStep(3)} style={backStyle}>← Back</button>
              <button
                onClick={handleSubmit}
                disabled={!name || !email || !phone || loading}
                style={{ ...btnStyle(!name || !email || !phone || loading), flex: 1 }}
              >
                {loading
                  ? 'Sending…'
                  : selectedSlots.length > 1
                  ? `Send ${selectedSlots.length} Proposals 🧡`
                  : 'Send Proposal 🧡'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

const h2Style: React.CSSProperties = {
  fontFamily: "'Lora', serif", fontSize: 22, fontWeight: 500, color: '#1E2620', margin: '0 0 6px',
}
const subStyle: React.CSSProperties = {
  fontSize: 14, color: '#6B7066', margin: '0 0 20px', fontWeight: 300,
}
const btnStyle = (disabled: boolean): React.CSSProperties => ({
  width: '100%', padding: '14px', borderRadius: 10, border: 'none',
  background: disabled ? '#DDE8E0' : '#3D6B4F',
  color: disabled ? '#6B7066' : '#fff',
  fontSize: 14, fontWeight: 500,
  cursor: disabled ? 'default' : 'pointer',
  fontFamily: "'DM Sans', sans-serif",
})
const backStyle: React.CSSProperties = {
  padding: '14px 20px', borderRadius: 10, border: '1.5px solid #DDE8E0',
  background: 'transparent', fontSize: 14, color: '#6B7066',
  cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
}
const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: '#6B7066', letterSpacing: 1.5,
  textTransform: 'uppercase', display: 'block', marginBottom: 8,
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '13px 16px', borderRadius: 10,
  border: '1.5px solid #DDE8E0', fontSize: 16,
  background: '#fff', outline: 'none', boxSizing: 'border-box',
  marginBottom: 20, fontFamily: "'DM Sans', sans-serif", color: '#1E2620',
}

'use client'
// FILE: app/onboarding/page.tsx
// Changes: sign out button added to nav (routes to /signup); SMS consent checkbox added to Step 1 for Twilio A2P compliance

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Step = 'profile' | 'address' | 'plan'

const TIERS = [
  {
    key: 'free', badge: 'Free', name: 'Kitchen', price: '$0', period: '/ always',
    cta: 'Start free', ctaStyle: 'outline',
    sections: [
      { label: 'Calendar', items: [{ text: 'Active window', tag: '60 days', check: true }, { text: 'Recurring or perpetual calendar', check: false }] },
      { label: 'Restaurants + Meals', items: [{ text: 'Restaurants', tag: '3 max', check: true }, { text: 'Menu items per restaurant', tag: '4 max', check: true }, { text: 'Personal drop-off / home cook option', check: false }] },
      { label: 'Delivery', items: [{ text: 'DoorDash delivery', check: true }, { text: 'SMS confirmation flow', check: true }, { text: 'Tracking link to recipient', check: true }] },
      { label: 'Sharing + Brand', items: [{ text: 'Shareable kitchen link', check: true }, { text: 'Social share buttons', check: true }, { text: 'Custom kitchen URL slug', check: false }, { text: 'Priority support', check: false }] },
    ],
  },
  {
    key: 'care', badge: 'Care+', name: 'Kitchen Care+', price: '$9.99', period: '/ month',
    highlight: 'Most popular', highlightColor: '#3D6B4F',
    cta: 'Start 14-day free trial', ctaStyle: 'primary',
    sections: [
      { label: 'Calendar', items: [{ text: 'Active window', tag: 'Unlimited', check: true }, { text: 'Recurring date slots', check: true }, { text: 'Perpetual calendar (long-term care)', check: true }] },
      { label: 'Restaurants + Meals', items: [{ text: 'Restaurants', tag: '10 max', check: true }, { text: 'Menu items per restaurant', tag: '12 max', check: true }, { text: 'Personal drop-off / home cook option', check: true }] },
      { label: 'Delivery', items: [{ text: 'DoorDash delivery', check: true }, { text: 'SMS confirmation flow', check: true }, { text: 'Tracking link to recipient + coordinator', check: true }, { text: 'Coordinator thank-you SMS on delivery', check: true }] },
      { label: 'Sharing + Brand', items: [{ text: 'Shareable kitchen link', check: true }, { text: 'Social share buttons', check: true }, { text: 'Custom kitchen URL slug', check: true }, { text: 'Priority support', check: true }, { text: 'Multiple active Kitchens', tag: '3 max', check: true }] },
    ],
  },
  {
    key: 'annual', badge: 'Early Adopter', name: 'Kitchen Care+ Annual', price: '$59', period: '/ year',
    highlight: 'Best value', highlightColor: '#6B9E7E',
    cta: 'Start 14-day free trial', ctaStyle: 'primary',
    sections: [
      { label: 'Everything in Care+, plus', items: [{ text: 'Save 50% vs monthly billing', check: true }, { text: 'Early Adopter badge on Kitchen page', check: true }, { text: 'Locked-in annual rate — never increases', check: true }, { text: 'Early access to new features (beta)', check: true }] },
    ],
  },
  {
    key: 'founding', badge: 'Founding Member', name: 'Kitchen Care+ Founding', price: '$149', period: 'lifetime',
    highlight: 'Limited — founding members', highlightColor: '#C17F47',
    cta: 'Claim founding membership', ctaStyle: 'gold',
    sections: [
      { label: 'Everything in Care+, plus', items: [
        { text: 'Locked-in price forever — never pay more even as pricing increases', check: true },
        { text: 'Founding Member badge on your Kitchen page', check: true },
        { text: 'Direct access to founder — real feedback loop, not a support ticket', check: true },
        { text: 'Vote on new features before they ship', check: true },
        { text: 'Early access to every new feature (beta)', check: true },
        { text: 'Unlimited active Kitchens (vs 3 on standard Care+)', check: true },
        { text: "Listed in YourKitchen's founding story — your name in the about page", check: true },
        { text: 'First to get Marketplace API integrations (Uber Eats, Grubhub) when available', check: true },
        { text: 'Access to private founding members community', check: true },
      ]},
    ],
  },
]

const US_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY']

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()
  const [step, setStep] = useState<Step>('profile')
  const [selectedTier, setSelectedTier] = useState('free')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    full_name: '', phone: '', household_size: '3-4',
    dietary_restrictions: [] as string[],
  sms_consent: false,
    street: '', apt: '', city: '', state: 'TX', zip: '',
  })

  const update = (field: string, value: string | boolean) => setForm(prev => ({ ...prev, [field]: value }))
  const toggleDiet = (d: string) => setForm(prev => ({
    ...prev,
    dietary_restrictions: prev.dietary_restrictions.includes(d)
      ? prev.dietary_restrictions.filter(x => x !== d)
      : [...prev.dietary_restrictions, d],
  }))

  async function finish() {
    setLoading(true); setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Session expired. Please sign in again.'); setLoading(false); return }
    const response = await fetch('/api/profile/create', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: user.id, full_name: form.full_name, phone: form.phone, household_size: form.household_size, dietary_restrictions: form.dietary_restrictions, street: form.street, apt: form.apt, city: form.city, state: form.state, zip: form.zip, tier: selectedTier }),
    })
    const result = await response.json()
    if (result.success) { router.push('/dashboard') }
    else { console.error('Profile create failed:', result.error); setError('Something went wrong. Please try again.'); setLoading(false) }
  }

  const steps: Step[] = ['profile', 'address', 'plan']
  const stepIndex = steps.indexOf(step)

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;1,400;1,500&family=DM+Sans:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        :root { --sage:#3D6B4F;--sage-mid:#6B9E7E;--sage-light:#EAF2ED;--cream:#FAFAF5;--forest:#1E2620;--stone:#6B7066;--border:#DDE8E0;--white:#FFFFFF;--amber:#C17F47;--amber-light:#FBF0E4; }
        body { font-family:'DM Sans',sans-serif;background:var(--cream);color:var(--forest);-webkit-font-smoothing:antialiased; }
        .onb-wrap { min-height:100vh;display:flex;flex-direction:column; }
        .onb-nav { padding:18px 40px;border-bottom:0.5px solid var(--border);display:flex;align-items:center;justify-content:space-between;background:var(--white);position:sticky;top:0;z-index:10; }
        .onb-logo { display:flex;flex-direction:column;line-height:1; }
        .onb-your { font-size:8px;font-weight:500;letter-spacing:5px;color:var(--sage-mid);text-transform:uppercase; }
        .onb-kitchen { font-family:'Lora',serif;font-size:20px;font-weight:500;color:var(--forest);letter-spacing:-0.5px; }
        .prog-wrap { display:flex;align-items:center;gap:8px; }
        .prog-step { display:flex;align-items:center;gap:6px;font-size:12px;font-weight:500; }
        .prog-dot { width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700; }
        .prog-dot-done { background:var(--sage);color:var(--white); }
        .prog-dot-active { background:var(--forest);color:var(--white); }
        .prog-dot-idle { background:var(--border);color:var(--stone); }
        .prog-label-active { color:var(--forest);font-weight:600; }
        .prog-label-idle { color:var(--stone); }
        .prog-line { width:32px;height:1px;background:var(--border); }
        .onb-body { flex:1;display:flex;align-items:flex-start;justify-content:center;padding:48px 24px 80px; }
        .onb-card { width:100%;max-width:520px; }
        .step-eyebrow { font-size:10px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:var(--sage);margin-bottom:8px; }
        .step-title { font-family:'Lora',serif;font-size:28px;font-weight:500;color:var(--forest);letter-spacing:-0.5px;margin-bottom:6px;line-height:1.2; }
        .step-sub { font-size:14px;color:var(--stone);font-weight:300;margin-bottom:32px;line-height:1.6; }
        .field-wrap { margin-bottom:20px; }
        .field-label { font-size:11px;font-weight:600;color:var(--stone);letter-spacing:0.08em;text-transform:uppercase;display:block;margin-bottom:8px; }
        .field-input { width:100%;border-radius:10px;border:1.5px solid var(--border);padding:12px 16px;font-size:14px;font-family:'DM Sans',sans-serif;color:var(--forest);background:var(--white);outline:none;transition:border-color 0.15s; }
        .field-input:focus { border-color:var(--sage); }
        .field-hint { font-size:11px;color:var(--stone);font-weight:300;margin-top:5px; }
        .grid-2 { display:grid;grid-template-columns:1fr 1fr;gap:14px; }
        .size-btns { display:flex;gap:8px; }
        .size-btn { flex:1;padding:11px 8px;border-radius:10px;border:1.5px solid var(--border);background:var(--white);color:var(--stone);font-size:13px;font-weight:600;font-family:'DM Sans',sans-serif;cursor:pointer;transition:all 0.15s; }
        .size-btn.active { border-color:var(--sage);background:var(--sage-light);color:var(--sage); }
        .diet-wrap { display:flex;flex-wrap:wrap;gap:8px; }
        .diet-pill { padding:7px 16px;border-radius:24px;border:1.5px solid var(--border);background:var(--white);color:var(--stone);font-size:12px;font-weight:500;font-family:'DM Sans',sans-serif;cursor:pointer;transition:all 0.15s; }
        .diet-pill.active { border-color:var(--sage);background:var(--sage-light);color:var(--sage); }
        .btn-row { display:flex;gap:12px;margin-top:32px; }
        .btn-primary { flex:2;padding:14px;background:var(--forest);color:var(--white);border:none;border-radius:10px;font-family:'DM Sans',sans-serif;font-size:14px;font-weight:600;cursor:pointer;transition:background 0.15s; }
        .btn-primary:hover { background:var(--sage); }
        .btn-primary:disabled { background:var(--border);color:var(--stone);cursor:default; }
        .btn-back { flex:1;padding:14px;background:transparent;color:var(--stone);border:1.5px solid var(--border);border-radius:10px;font-family:'DM Sans',sans-serif;font-size:14px;font-weight:600;cursor:pointer; }
        .geo-note { background:#FFF8E8;border:1px solid #F0E2B8;border-radius:10px;padding:12px 16px;font-size:12px;color:#7A5800;line-height:1.6;margin-bottom:20px; }
        .err-note { background:#FEE8E8;border:1px solid #F5C0C0;border-radius:10px;padding:12px 16px;font-size:12px;color:#8A1A1A;margin-top:12px; }
        .plan-intro { background:var(--sage-light);border-radius:14px;padding:20px 24px;margin-bottom:28px; }
        .plan-intro-title { font-family:'Lora',serif;font-size:16px;font-weight:500;color:var(--forest);margin-bottom:6px; }
        .plan-intro-sub { font-size:13px;color:var(--stone);font-weight:300;line-height:1.6; }
        .plan-grid { display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px; }
        .plan-grid-bottom { display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:28px; }
        .tier-card { border:1.5px solid var(--border);border-radius:14px;padding:20px;cursor:pointer;transition:all 0.15s;background:var(--white);position:relative;overflow:hidden; }
        .tier-card:hover { border-color:var(--sage-mid); }
        .tier-card.selected { border-color:var(--sage);background:var(--sage-light); }
        .tier-card.selected-gold { border-color:var(--amber);background:var(--amber-light); }
        .tier-highlight { position:absolute;top:0;left:0;right:0;text-align:center;padding:4px 0;font-size:10px;font-weight:700;letter-spacing:0.08em;color:var(--white); }
        .tier-badge { display:inline-block;font-size:10px;font-weight:600;letter-spacing:0.06em;color:var(--stone);background:var(--border);border-radius:20px;padding:3px 10px;margin-bottom:8px; }
        .tier-name { font-family:'Lora',serif;font-size:16px;font-weight:500;color:var(--forest);margin-bottom:2px; }
        .tier-price { font-size:22px;font-weight:600;color:var(--forest); }
        .tier-period { font-size:12px;color:var(--stone);font-weight:300; }
        .tier-divider { height:0.5px;background:var(--border);margin:12px 0; }
        .tier-section-label { font-size:9px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--stone);margin-bottom:8px;margin-top:10px; }
        .tier-item { display:flex;align-items:flex-start;gap:8px;margin-bottom:5px; }
        .tier-item-check { font-size:11px;color:var(--sage);flex-shrink:0;margin-top:1px;font-weight:700; }
        .tier-item-x { font-size:11px;color:var(--border);flex-shrink:0;margin-top:1px; }
        .tier-item-text { font-size:11px;color:var(--stone);line-height:1.45; }
        .tier-item-tag { display:inline-block;font-size:9px;font-weight:700;background:var(--sage-light);color:var(--sage);border-radius:10px;padding:1px 7px;margin-left:4px; }
        .plan-footer { font-size:11px;color:var(--stone);text-align:center;line-height:1.7;padding-top:16px;border-top:0.5px solid var(--border); }
        .skip-link { text-align:center;margin-top:16px;font-size:12px;color:var(--stone); }
        .skip-link button { background:none;border:none;color:var(--sage);font-size:12px;cursor:pointer;font-family:'DM Sans',sans-serif;text-decoration:underline; }

.consent-wrap { margin-top:16px;padding:16px;background:#EAF2ED;border:1.5px solid #DDE8E0;border-radius:10px; }
.consent-label { display:flex;align-items:flex-start;gap:12px;cursor:pointer; }
.consent-cb { width:18px;height:18px;accent-color:var(--sage);cursor:pointer;flex-shrink:0;margin-top:2px; }
.consent-text { font-size:12px;color:var(--stone);line-height:1.6;font-weight:300; }
.consent-text a { color:var(--sage);text-decoration:underline; }
        @media(max-width:600px) { .onb-nav{padding:14px 20px;} .prog-label{display:none;} .plan-grid,.plan-grid-bottom{grid-template-columns:1fr;} .onb-body{padding:32px 20px 60px;} }
      `}</style>

      <div className="onb-wrap">
        <nav className="onb-nav">
          <div className="onb-logo">
            <span className="onb-your">Your</span>
            <span className="onb-kitchen">Kitchen</span>
          </div>
          <div className="prog-wrap">
            {(['profile', 'address', 'plan'] as Step[]).map((s, i) => {
              const labels = ['Profile', 'Address', 'Plan']
              const isDone = stepIndex > i
              const isActive = stepIndex === i
              return (
                <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {i > 0 && <div className="prog-line" />}
                  <div className="prog-step">
                    <div className={`prog-dot ${isDone ? 'prog-dot-done' : isActive ? 'prog-dot-active' : 'prog-dot-idle'}`}>
                      {isDone ? '✓' : i + 1}
                    </div>
                    <span className={`prog-label ${isActive ? 'prog-label-active' : 'prog-label-idle'}`}>{labels[i]}</span>
                  </div>
                </div>
              )
            })}
          </div>
          {/* Sign out — routes to /signup, fixes 405 error */}
          <button
            onClick={async () => { await supabase.auth.signOut(); router.push('/signup') }}
            style={{ background: 'none', border: 'none', fontSize: 12, fontWeight: 500, color: '#6B7066', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}
          >
            Sign out
          </button>
        </nav>

        <div className="onb-body">
          <div className="onb-card">

            {step === 'profile' && (
              <div>
                <p className="step-eyebrow">Step 1 of 3</p>
                <h1 className="step-title">Tell us about<br />your household</h1>
                <p className="step-sub">Your village will see your name — not your phone or address.</p>
                <div className="field-wrap">
                  <label className="field-label">Your name</label>
                  <input className="field-input" value={form.full_name} onChange={e => update('full_name', e.target.value)} placeholder="" />
                </div>
                <div className="field-wrap">
                  <label className="field-label">Phone number</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <select className="field-input" style={{ width: 80, flexShrink: 0 }}><option>🇺🇸 +1</option></select>
                    <input className="field-input" value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="" />
                  </div>
                  <p className="field-hint">Used only for Y/N meal confirmations via SMS.</p>
                </div>
                <div className="consent-wrap">
                  <label className="consent-label">
                    <input
                      type="checkbox"
                      className="consent-cb"
                      checked={form.sms_consent}
                      onChange={e => update('sms_consent', e.target.checked as unknown as string)}
                    />
                    <span className="consent-text">
                      I agree to receive recurring SMS text messages from YourKitchen, including
                      meal proposals, confirmations, and delivery updates. Message frequency varies
                      by activity. Message &amp; data rates may apply. Reply STOP to opt out or
                      HELP for help.{' '}
                      <a href="/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a>
                    </span>
                  </label>
                </div>
                <div className="field-wrap">
                  <label className="field-label">Household size</label>
                  <div className="size-btns">
                    {['1–2', '3–4', '5–6', '7+'].map(s => (
                      <button key={s} className={`size-btn ${form.household_size === s ? 'active' : ''}`} onClick={() => update('household_size', s)}>{s}</button>
                    ))}
                  </div>
                </div>
                <div className="field-wrap">
                  <label className="field-label">Dietary restrictions</label>
                  <div className="diet-wrap">
                    {['No shellfish', 'No nuts', 'Gluten-free', 'Vegetarian', 'Vegan', 'Halal', 'Kosher'].map(d => (
                      <button key={d} className={`diet-pill ${form.dietary_restrictions.includes(d) ? 'active' : ''}`} onClick={() => toggleDiet(d)}>{d}</button>
                    ))}
                  </div>
                </div>
                <div className="btn-row" style={{ marginTop: 32 }}>
                  <button className="btn-primary" onClick={() => setStep('address')} disabled={!form.sms_consent || !form.full_name.trim() || !form.phone.trim()}>Next: Delivery Address →</button>
                </div>
              </div>
            )}

            {step === 'address' && (
              <div>
                <p className="step-eyebrow">Step 2 of 3</p>
                <h1 className="step-title">Where should meals<br />be delivered?</h1>
                <p className="step-sub">We use this to confirm restaurant availability in your area.</p>
                <div className="field-wrap">
                  <label className="field-label">Street address</label>
                  <input className="field-input" value={form.street} onChange={e => update('street', e.target.value)} placeholder="" />
                </div>
                <div className="field-wrap">
                  <label className="field-label">Apt / Suite <span style={{ fontWeight: 300, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
                  <input className="field-input" value={form.apt} onChange={e => update('apt', e.target.value)} placeholder="" />
                </div>
                <div className="field-wrap">
                  <label className="field-label">City</label>
                  <input className="field-input" value={form.city} onChange={e => update('city', e.target.value)} placeholder="" />
                </div>
                <div className="grid-2" style={{ marginBottom: 20 }}>
                  <div>
                    <label className="field-label">State</label>
                    <select className="field-input" value={form.state} onChange={e => update('state', e.target.value)}>
                      {US_STATES.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="field-label">ZIP code</label>
                    <input className="field-input" value={form.zip} onChange={e => update('zip', e.target.value)} placeholder="" maxLength={5} />
                  </div>
                </div>
                <div className="geo-note">📍 <strong>Launching in major US cities.</strong> We'll confirm restaurant availability at your ZIP — if we're not there yet, we'll notify you the moment we are.</div>
                <div className="btn-row">
                  <button className="btn-back" onClick={() => setStep('profile')}>← Back</button>
                  <button className="btn-primary" onClick={() => setStep('plan')}>Next: Choose a Plan →</button>
                </div>
              </div>
            )}

            {step === 'plan' && (
              <div>
                <p className="step-eyebrow">Step 3 of 3</p>
                <h1 className="step-title">One last thing —<br />choose your plan</h1>
                <p className="step-sub">Most people start free and upgrade when they see how much their village shows up.</p>
                <div className="plan-intro">
                  <p className="plan-intro-title">✦ Every plan starts with a 14-day free trial</p>
                  <p className="plan-intro-sub">All Care+ features unlocked. No card required. You'll never be charged without choosing to upgrade.</p>
                </div>
                <div className="plan-grid">
                  {TIERS.slice(0, 2).map(tier => (
                    <div key={tier.key} className={`tier-card ${selectedTier === tier.key ? 'selected' : ''}`} onClick={() => setSelectedTier(tier.key)} style={{ paddingTop: tier.highlight ? 28 : 20 }}>
                      {tier.highlight && <div className="tier-highlight" style={{ background: tier.highlightColor }}>{tier.highlight}</div>}
                      <div className="tier-badge">{tier.badge}</div>
                      <div className="tier-name">{tier.name}</div>
                      <div style={{ marginBottom: 12 }}><span className="tier-price">{tier.price}</span><span className="tier-period"> {tier.period}</span></div>
                      <div className="tier-divider" />
                      {tier.sections.map(sec => (
                        <div key={sec.label}>
                          <div className="tier-section-label">{sec.label}</div>
                          {sec.items.map(item => (
                            <div key={item.text} className="tier-item">
                              <span className={item.check ? 'tier-item-check' : 'tier-item-x'}>{item.check ? '✓' : '–'}</span>
                              <span className="tier-item-text" style={{ color: item.check ? 'var(--stone)' : 'var(--border)' }}>
                                {item.text}{'tag' in item && item.tag && <span className="tier-item-tag">{item.tag}</span>}
                              </span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
                <div className="plan-grid-bottom">
                  {TIERS.slice(2).map(tier => (
                    <div key={tier.key} className={`tier-card ${selectedTier === tier.key ? (tier.key === 'founding' ? 'selected-gold' : 'selected') : ''}`} onClick={() => setSelectedTier(tier.key)} style={{ paddingTop: tier.highlight ? 28 : 20 }}>
                      {tier.highlight && <div className="tier-highlight" style={{ background: tier.highlightColor }}>{tier.highlight}</div>}
                      <div className="tier-badge" style={{ background: tier.key === 'founding' ? '#F5E6D0' : undefined, color: tier.key === 'founding' ? 'var(--amber)' : undefined }}>{tier.badge}</div>
                      <div className="tier-name">{tier.name}</div>
                      <div style={{ marginBottom: 12 }}><span className="tier-price" style={{ color: tier.key === 'founding' ? 'var(--amber)' : 'var(--forest)' }}>{tier.price}</span><span className="tier-period"> {tier.period}</span></div>
                      <div className="tier-divider" />
                      {tier.sections.map(sec => (
                        <div key={sec.label}>
                          <div className="tier-section-label">{sec.label}</div>
                          {sec.items.map(item => (
                            <div key={item.text} className="tier-item">
                              <span className="tier-item-check" style={{ color: tier.key === 'founding' ? 'var(--amber)' : 'var(--sage)' }}>✓</span>
                              <span className="tier-item-text">{item.text}</span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
                {error && <div className="err-note">{error}</div>}
                <div className="btn-row">
                  <button className="btn-back" onClick={() => setStep('address')}>← Back</button>
                  <button className="btn-primary" onClick={finish} disabled={loading}>
                    {loading ? 'Setting up your Kitchen...' : `Continue with ${TIERS.find(t => t.key === selectedTier)?.badge} →`}
                  </button>
                </div>
                <div className="skip-link">
                  Not sure yet? <button onClick={() => { setSelectedTier('free'); finish() }}>Start free — choose later</button>
                </div>
                <div className="plan-footer" style={{ marginTop: 24 }}>
                  Free tier includes a 14-day Care+ trial — no card required. &nbsp;|&nbsp; Founding Member offer limited to first 100 members. &nbsp;|&nbsp; All tiers include YourKitchen's standard platform fee (3%) on DoorDash orders.
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </>
  )
}

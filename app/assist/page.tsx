// app/assist/page.tsx
// Branded support-offer form. Reads ?offer=intro|expertise and ?areas=a,b,c from the URL,
// pre-checks the matching boxes, captures contact details, posts to /api/support-offer.
// Self-contained styling (scoped under .yk) so it doesn't depend on the app's global CSS.

'use client';

import { useEffect, useState } from 'react';

type OfferType = 'intro' | 'expertise';

const OFFER_META: Record<OfferType, { title: string; blurb: string }> = {
  intro: {
    title: 'Open a door',
    blurb: 'Tell me who to reach and a little about them — I’ll take it from there.',
  },
  expertise: {
    title: 'Lend your time',
    blurb: 'Tell me how you’d like to help, and the best way to reach you.',
  },
};

const AREAS: Record<OfferType, { value: string; label: string }[]> = {
  intro: [
    { value: 'hr', label: 'HR / Total Reward leadership' },
    { value: 'care_org', label: 'Care-organization leadership' },
    { value: 'in_need', label: 'Someone in a current hard season' },
  ],
  expertise: [
    { value: 'test_recipient', label: 'Be a test recipient' },
    { value: 'accounting_law', label: 'Accounting | Business Law' },
    { value: 'marketing', label: 'Marketing' },
    { value: 'social', label: 'Social Media' },
    { value: 'b2b_sales', label: 'B2B & Sales' },
    { value: 'entrepreneurship', label: 'Entrepreneurship | Business Management' },
  ],
};

export default function AssistPage() {
  const [offer, setOffer] = useState<OfferType>('intro');
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [organization, setOrganization] = useState('');
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState(''); // honeypot
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  // Read query params on mount (avoids the useSearchParams/Suspense requirement).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const off: OfferType = params.get('offer') === 'expertise' ? 'expertise' : 'intro';
    setOffer(off);
    const incoming = (params.get('areas') || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const valid = new Set(AREAS[off].map((a) => a.value));
    const next: Record<string, boolean> = {};
    incoming.forEach((a) => {
      if (valid.has(a)) next[a] = true;
    });
    setSelected(next);
  }, []);

  const meta = OFFER_META[offer];
  const areaList = AREAS[offer];

  function toggle(v: string) {
    setSelected((prev) => ({ ...prev, [v]: !prev[v] }));
  }

  async function submit() {
    setErrorMsg('');
    if (!name.trim() || !email.trim()) {
      setErrorMsg('Please add your name and email.');
      return;
    }
    setStatus('sending');
    const areas = Object.keys(selected).filter((k) => selected[k]);
    try {
      const res = await fetch('/api/support-offer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offer_type: offer,
          areas,
          name,
          email,
          organization,
          message,
          website,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setStatus('error');
        setErrorMsg(data.error || 'Something went wrong. Please try again.');
        return;
      }
      setStatus('done');
    } catch {
      setStatus('error');
      setErrorMsg('Network error. Please try again.');
    }
  }

  return (
    <div className="yk">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;1,400;1,500&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
        .yk{
          --sage:#3D6B4F; --sage-mid:#6B9E7E; --sage-light:#EAF2ED;
          --cream:#FAFAF5; --forest:#1E2620; --stone:#6B7066;
          --border:#DDE8E0; --white:#FFFFFF; --gold:#B88B4A; --gold-deep:#C17F47; --heart:#C0463B;
          --serif:'Lora',Georgia,serif; --sans:'DM Sans',system-ui,sans-serif;
          font-family:var(--sans); color:var(--forest); background:#EDEDE6;
          min-height:100vh; -webkit-font-smoothing:antialiased; line-height:1.5;
          padding:32px 16px; box-sizing:border-box;
        }
        .yk *{ box-sizing:border-box; }
        .yk .sheet{
          max-width:560px; margin:0 auto; background:var(--cream);
          border-radius:20px; overflow:hidden; box-shadow:0 24px 60px rgba(30,38,32,0.16);
        }
        .yk .head{ background:var(--forest); color:var(--cream); padding:32px 36px 28px; position:relative; overflow:hidden; }
        .yk .head::after{ content:''; position:absolute; right:-70px; top:-70px; width:260px; height:260px; border-radius:50%; background:radial-gradient(circle, rgba(107,158,126,0.22), transparent 70%); }
        .yk .eyebrow{ font-size:11px; font-weight:500; letter-spacing:0.42em; text-transform:uppercase; color:var(--sage-mid); }
        .yk .word{ font-family:var(--serif); font-size:30px; font-weight:500; }
        .yk .head h1{ font-family:var(--serif); font-weight:500; font-size:24px; margin-top:18px; position:relative; z-index:1; }
        .yk .head p{ font-style:italic; font-family:var(--serif); font-size:14.5px; color:rgba(250,250,245,0.72); margin-top:6px; position:relative; z-index:1; }
        .yk .body{ padding:28px 36px 34px; }
        .yk .label{ font-size:11px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:var(--sage); margin:0 0 10px; }
        .yk .opts{ list-style:none; margin:0 0 22px; padding:0; }
        .yk .opts li{
          font-size:14px; line-height:1.45; color:var(--forest); padding:10px 8px 10px 32px;
          position:relative; cursor:pointer; border-radius:8px; transition:background .15s, color .15s; user-select:none;
        }
        .yk .opts li::before{
          content:''; position:absolute; left:6px; top:11px; width:16px; height:16px; border-radius:4px;
          border:1.75px solid var(--sage-mid); background:var(--white); transition:background .15s, border-color .15s;
        }
        .yk .opts li:hover{ background:var(--sage-light); color:var(--sage); }
        .yk .opts li.on{ color:var(--sage); font-weight:500; }
        .yk .opts li.on::before{
          background:var(--sage); border-color:var(--sage);
          background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23fff' stroke-width='3.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='20 6 9 17 4 12'/%3E%3C/svg%3E");
          background-size:11px; background-repeat:no-repeat; background-position:center;
        }
        .yk .field{ margin-bottom:16px; }
        .yk .field label{ display:block; font-size:12.5px; font-weight:600; color:var(--forest); margin-bottom:6px; }
        .yk .field .opt-note{ color:var(--stone); font-weight:400; }
        .yk input, .yk textarea{
          width:100%; font-family:var(--sans); font-size:14px; color:var(--forest);
          background:var(--white); border:1px solid var(--border); border-radius:10px; padding:11px 13px;
        }
        .yk input:focus, .yk textarea:focus{ outline:none; border-color:var(--sage-mid); box-shadow:0 0 0 3px rgba(107,158,126,0.18); }
        .yk textarea{ min-height:96px; resize:vertical; }
        .yk .hp{ position:absolute; left:-9999px; width:1px; height:1px; overflow:hidden; }
        .yk .err{ color:var(--heart); font-size:12.5px; margin:4px 0 12px; }
        .yk .btn{
          display:inline-flex; align-items:center; justify-content:center; gap:7px; width:100%;
          font-family:var(--sans); font-size:14.5px; font-weight:600; border:none; cursor:pointer;
          padding:13px 18px; border-radius:30px; color:#fff; background:var(--sage);
          box-shadow:0 4px 12px rgba(61,107,79,0.28); transition:background .15s;
        }
        .yk .btn:hover{ background:#345D44; }
        .yk .btn:disabled{ opacity:0.6; cursor:default; }
        .yk .foot{ text-align:center; font-size:11.5px; color:var(--stone); margin-top:18px; }
        .yk .foot a{ color:var(--sage); text-decoration:none; }
        .yk .done{ text-align:center; padding:14px 0 6px; }
        .yk .done .check{ width:56px; height:56px; border-radius:50%; background:var(--sage-light); display:flex; align-items:center; justify-content:center; margin:0 auto 16px; }
        .yk .done h2{ font-family:var(--serif); font-size:23px; font-weight:600; color:var(--sage); }
        .yk .done p{ font-size:14px; color:var(--forest); margin-top:8px; line-height:1.6; }
        .yk .done a.link{ display:inline-block; margin-top:18px; color:var(--sage); font-weight:600; text-decoration:none; font-size:14px; }
        @media (max-width:560px){ .yk .head{ padding:28px 24px 24px; } .yk .body{ padding:24px 24px 30px; } }
      `}</style>

      <div className="sheet">
        <div className="head">
          <div className="eyebrow">Your</div>
          <div className="word">Kitchen</div>
          {status !== 'done' && (
            <>
              <h1>{meta.title}</h1>
              <p>{meta.blurb}</p>
            </>
          )}
        </div>

        <div className="body">
          {status === 'done' ? (
            <div className="done">
              <div className="check">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#3D6B4F" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h2>Thank you, {name.split(' ')[0] || 'truly'}.</h2>
              <p>
                Got it — this came straight to me. I’ll be in touch personally, and I
                won’t let it sit. It means a lot that you’d help.
              </p>
              <a className="link" href="https://yourkitchen.app">← Back to YourKitchen</a>
            </div>
          ) : (
            <>
              <p className="label">{offer === 'intro' ? 'What can you help with?' : 'How would you like to help?'}</p>
              <ul className="opts">
                {areaList.map((a) => (
                  <li
                    key={a.value}
                    className={selected[a.value] ? 'on' : ''}
                    onClick={() => toggle(a.value)}
                    role="checkbox"
                    aria-checked={!!selected[a.value]}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === ' ' || e.key === 'Enter') {
                        e.preventDefault();
                        toggle(a.value);
                      }
                    }}
                  >
                    {a.label}
                  </li>
                ))}
              </ul>

              <div className="field">
                <label>Your name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jordan Rivera" />
              </div>
              <div className="field">
                <label>Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" />
              </div>
              <div className="field">
                <label>Organization <span className="opt-note">(optional)</span></label>
                <input value={organization} onChange={(e) => setOrganization(e.target.value)} placeholder="Where you work, if relevant" />
              </div>
              <div className="field">
                <label>
                  {offer === 'intro' ? 'Who should I reach, and why?' : 'Anything you’d like me to know?'}{' '}
                  <span className="opt-note">(optional)</span>
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={offer === 'intro' ? 'A name, their role, and the best way in.' : 'A sentence or two is plenty.'}
                />
              </div>

              {/* honeypot */}
              <input className="hp" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} aria-hidden="true" />

              {errorMsg && <div className="err">{errorMsg}</div>}

              <button className="btn" onClick={submit} disabled={status === 'sending'}>
                {status === 'sending' ? 'Sending…' : 'Send it over'}
              </button>

              <div className="foot">
                No spam, ever — this goes straight to Marques. <br />
                <a href="https://yourkitchen.app">yourkitchen.app</a>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

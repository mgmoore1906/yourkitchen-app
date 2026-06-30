// app/api/support-offer/route.ts
// Receives submissions from the /assist form: stores them in Supabase and emails Marques.
// Same-origin to /assist, so no CORS needed. Lazy factory (Next 16 + Turbopack safe).
// Email goes through Resend's HTTP API via fetch — no 'resend' package required.

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

const VALID_OFFERS = ['intro', 'expertise'] as const;

const AREA_LABELS: Record<string, string> = {
  hr: 'HR / Total Reward leadership',
  care_org: 'Care-organization leadership',
  in_need: 'Someone in a current hard season',
  test_recipient: 'Be a test recipient',
  accounting_law: 'Accounting | Business Law',
  marketing: 'Marketing',
  social: 'Social Media',
  b2b_sales: 'B2B & Sales',
  entrepreneurship: 'Entrepreneurship | Business Management',
};

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>));

    // Honeypot — real users never fill this hidden field.
    if (body.website) return NextResponse.json({ ok: true });

    const offer_type = String(body.offer_type || '');
    if (!VALID_OFFERS.includes(offer_type as (typeof VALID_OFFERS)[number])) {
      return NextResponse.json({ ok: false, error: 'Invalid offer type.' }, { status: 400 });
    }

    const name = String(body.name || '').trim().slice(0, 200);
    const email = String(body.email || '').trim().slice(0, 200);
    if (!name || !email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json(
        { ok: false, error: 'Please add your name and a valid email.' },
        { status: 400 }
      );
    }

    const areas: string[] = Array.isArray(body.areas)
      ? (body.areas as unknown[]).map((a) => String(a)).filter(Boolean).slice(0, 20)
      : [];
    const organization = body.organization
      ? String(body.organization).trim().slice(0, 200)
      : null;
    const message = body.message ? String(body.message).trim().slice(0, 4000) : null;

    const supabase = getSupabase();
    const { error } = await supabase
      .from('support_offers')
      .insert({ offer_type, areas, name, email, organization, message });

    if (error) {
      console.error('support_offers insert failed', error);
      return NextResponse.json(
        { ok: false, error: 'Could not save right now. Please try again.' },
        { status: 500 }
      );
    }

    // Notify Marques via Resend HTTP API. Don't fail the submission if email hiccups.
    try {
      const areaList = areas.map((a) => AREA_LABELS[a] || a).join(', ') || '—';
      const kind =
        offer_type === 'intro' ? 'Open a door (intro)' : 'Lend your time (expertise)';
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'YourKitchen <marques@yourkitchen.app>',
          to: 'marques@yourkitchen.app',
          reply_to: email,
          subject: `New support offer — ${kind} — ${name}`,
          text: `New support offer via /assist

Type:   ${kind}
Areas:  ${areaList}
Name:   ${name}
Email:  ${email}
Org:    ${organization || '—'}

Message:
${message || '—'}
`,
        }),
      });
    } catch (mailErr) {
      console.error('support offer email failed', mailErr);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('support-offer route error', err);
    return NextResponse.json({ ok: false, error: 'Something went wrong.' }, { status: 500 });
  }
}

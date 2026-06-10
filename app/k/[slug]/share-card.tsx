// app/k/[slug]/share-card.tsx
// Shared renderer for a kitchen's link-preview / share card.
// Used by:
//   - app/k/[slug]/opengraph-image.tsx   (the unfurl image, og:image)
//   - app/api/card/[slug]/route.tsx       (downloadable PNG for social posts)
// Rendered by Satori (via next/og ImageResponse): flexbox + a CSS subset only.
// Every multi-child element sets display:flex; spacing uses margins (not gap).

export const OG_SIZE = { width: 1200, height: 630 } as const

/* ─── Brand palette (mirrors colors_and_type.css) ─── */
const YK = {
  sage: '#3D6B4F',
  sageDeep: '#2D5240',
  sageMid: '#6B9E7E',
  sageLight: '#EAF2ED',
  sageLighter: '#F2F7F4',
  cream: '#FAFAF5',
  white: '#FFFFFF',
  forest: '#1E2620',
  stone: '#6B7066',
  border: '#DDE8E0',
}

type ThemeName = 'cream' | 'sageLight' | 'forest' | 'grief' | 'sage'

type Theme = {
  bg: string; ink: string; sub: string; accent: string
  chipBg: string; chipRing: string
  ctaBg: string; ctaInk: string; light: boolean; hairline: string
}

const THEMES: Record<ThemeName, Theme> = {
  cream: {
    bg: YK.cream, ink: YK.forest, sub: YK.stone, accent: YK.sage,
    chipBg: YK.sageLight, chipRing: 'transparent',
    ctaBg: YK.sage, ctaInk: YK.cream, light: false, hairline: YK.border,
  },
  sageLight: {
    bg: YK.sageLight, ink: YK.forest, sub: '#586B5C', accent: YK.sage,
    chipBg: YK.white, chipRing: 'transparent',
    ctaBg: YK.sage, ctaInk: YK.cream, light: false, hairline: '#CFE0D5',
  },
  forest: {
    bg: YK.forest, ink: YK.cream, sub: '#A9B7AD', accent: YK.sageMid,
    chipBg: 'rgba(255,255,255,0.07)', chipRing: 'rgba(255,255,255,0.12)',
    ctaBg: YK.sageMid, ctaInk: YK.forest, light: true, hairline: 'rgba(255,255,255,0.10)',
  },
  grief: {
    bg: YK.cream, ink: '#3B4640', sub: YK.stone, accent: YK.sage,
    chipBg: YK.sageLighter, chipRing: 'transparent',
    ctaBg: YK.sage, ctaInk: YK.cream, light: false, hairline: YK.border,
  },
  sage: {
    bg: YK.sage, ink: YK.cream, sub: '#D3E4D8', accent: '#EAF2ED',
    chipBg: 'rgba(255,255,255,0.12)', chipRing: 'rgba(255,255,255,0.16)',
    ctaBg: YK.cream, ctaInk: YK.sage, light: true, hairline: 'rgba(255,255,255,0.16)',
  },
}

/* ─── Copy, keyed to the kitchens.use_case enum ───
   Values: new_baby | illness | bereavement | deployment | caregiving |
           celebration | other.  Null / unknown falls back to OTHER. */
type CardSpec = {
  theme: ThemeName
  glyph: string
  eyebrow: string
  line1: string
  line2: string
  cta: string
  sub: (first: string) => string
}

const CARDS: Record<string, CardSpec> = {
  new_baby: {
    theme: 'cream', glyph: '🤱', eyebrow: 'A new baby',
    line1: 'The baby’s here.', line2: 'Let’s cover dinner.', cta: 'Send dinner',
    sub: (f) => `Claim a night — dinner shows up at the door.`,
  },
  illness: {
    theme: 'sageLight', glyph: '🎗️', eyebrow: 'During treatment',
    line1: 'Hard weeks ahead.', line2: 'Let dinner be easy.', cta: 'Send dinner',
    sub: (f) => `Pick a night — one less thing to carry.`,
  },
  bereavement: {
    theme: 'grief', glyph: '🕊️', eyebrow: 'With love',
    line1: 'When words run short,', line2: 'a meal still shows up.', cta: 'Bring a meal',
    sub: (f) => `No words needed — just dinner, with care.`,
  },
  deployment: {
    theme: 'forest', glyph: '✈️', eyebrow: 'While they’re away',
    line1: 'Miles between you.', line2: 'Still at the table.', cta: 'Send dinner',
    sub: (f) => `Send a meal, lighten a night at home.`,
  },
  caregiving: {
    theme: 'sageLight', glyph: '🤍', eyebrow: 'Caring for family',
    line1: 'The days are full.', line2: 'Let dinner be handled.', cta: 'Send dinner',
    sub: (f) => `Claim a night — let the evening be lighter.`,
  },
  celebration: {
    theme: 'sage', glyph: '🎉', eyebrow: 'A milestone',
    line1: 'Something to celebrate.', line2: 'Dinner’s on the village.', cta: 'Send dinner',
    sub: (f) => `Send a meal and mark the moment.`,
  },
  other: {
    theme: 'sage', glyph: '🧡', eyebrow: 'Your village',
    line1: 'Life got heavy.', line2: 'Your kitchen’s covered.', cta: 'Send dinner',
    sub: (f) => `Claim a night — dinner, handled.`,
  },
}

export function getCard(useCase: string | null | undefined): CardSpec {
  return (useCase && CARDS[useCase]) || CARDS.other
}

/* ─── The 1200×630 card element (Satori-safe) ─── */
export function CardElement({
  firstName, slug, useCase,
}: { firstName: string; slug: string; useCase: string | null }) {
  const c = getCard(useCase)
  const T = THEMES[c.theme]
  const name = `${firstName}’s Kitchen`

  return (
    <div
      style={{
        width: '100%', height: '100%', background: T.bg,
        fontFamily: 'DM Sans', display: 'flex', flexDirection: 'column',
        padding: '52px 64px 48px',
      }}
    >
      {/* TOP — glyph chip + eyebrow + recipient name */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div
          style={{
            width: 60, height: 60, borderRadius: 15, flexShrink: 0, marginRight: 18,
            background: T.chipBg,
            ...(T.chipRing !== 'transparent'
              ? { boxShadow: `inset 0 0 0 1px ${T.chipRing}` }
              : {}),
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32,
          }}
        >
          {c.glyph}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              fontSize: 16, fontWeight: 600, letterSpacing: 3,
              textTransform: 'uppercase', color: T.accent, marginBottom: 6,
            }}
          >
            {c.eyebrow}
          </div>
          <div style={{ display: 'flex', fontFamily: 'Lora', fontSize: 27, fontWeight: 500, color: T.ink }}>
            {name}
          </div>
        </div>
      </div>

      {/* MIDDLE — the message */}
      <div
        style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            display: 'flex', flexDirection: 'column', fontFamily: 'Lora',
            fontWeight: 500, fontSize: 82, lineHeight: 1.0, letterSpacing: -2, color: T.ink,
          }}
        >
          <div style={{ display: 'flex' }}>{c.line1}</div>
          <div style={{ display: 'flex', fontStyle: 'italic', fontWeight: 400, color: T.accent }}>
            {c.line2}
          </div>
        </div>
        <div
          style={{
            display: 'flex', marginTop: 24, fontSize: 28, lineHeight: 1.4,
            color: T.sub,
          }}
        >
          {c.sub(firstName)}
        </div>
      </div>

      {/* BOTTOM — CTA + link + wordmark */}
      <div
        style={{
          display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
          borderTop: `1px solid ${T.hairline}`, paddingTop: 28,
        }}
      >
        <div
          style={{
            display: 'flex', alignItems: 'center', background: T.ctaBg, color: T.ctaInk,
            borderRadius: 999, padding: '17px 36px', fontSize: 23, fontWeight: 600,
          }}
        >
          <div style={{ display: 'flex' }}>{c.cta}</div>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ marginLeft: 13 }}>
            <path
              d="M5 12h14M13 6l6 6-6 6"
              stroke={T.ctaInk} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
            />
          </svg>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <div
              style={{
                fontFamily: 'DM Sans', fontWeight: 600, fontSize: 12, letterSpacing: 4,
                textTransform: 'uppercase', color: YK.sageMid, marginBottom: 3,
              }}
            >
              Your
            </div>
            <div
              style={{
                display: 'flex', fontFamily: 'Lora', fontWeight: 500, fontSize: 30,
                lineHeight: 0.9, color: T.light ? YK.cream : YK.forest,
              }}
            >
              Kitchen
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Fonts ───
   Satori needs real font files (ttf/otf/woff — NOT woff2). We pull the static
   .woff faces from @fontsource via jsDelivr at request time and cache the
   buffers in module scope so each cold start fetches them once. */
type LoadedFont = { name: string; data: ArrayBuffer; weight: 400 | 500 | 600; style: 'normal' | 'italic' }

const FB = 'https://cdn.jsdelivr.net/npm/@fontsource'
const FONT_SPECS: { name: string; weight: 400 | 500 | 600; style: 'normal' | 'italic'; url: string }[] = [
  { name: 'Lora', weight: 500, style: 'normal', url: `${FB}/lora@5.2.8/files/lora-latin-500-normal.woff` },
  { name: 'Lora', weight: 400, style: 'italic', url: `${FB}/lora@5.2.8/files/lora-latin-400-italic.woff` },
  { name: 'DM Sans', weight: 400, style: 'normal', url: `${FB}/dm-sans@5.2.8/files/dm-sans-latin-400-normal.woff` },
  { name: 'DM Sans', weight: 600, style: 'normal', url: `${FB}/dm-sans@5.2.8/files/dm-sans-latin-600-normal.woff` },
]

let _fonts: Promise<LoadedFont[]> | null = null

export function loadCardFonts(): Promise<LoadedFont[]> {
  if (!_fonts) {
    _fonts = Promise.all(
      FONT_SPECS.map(async (f) => {
        const res = await fetch(f.url)
        if (!res.ok) throw new Error(`font ${f.name} ${f.weight} → ${res.status}`)
        return { name: f.name, weight: f.weight, style: f.style, data: await res.arrayBuffer() }
      }),
    )
  }
  return _fonts
}

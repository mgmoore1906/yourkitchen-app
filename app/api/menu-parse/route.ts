import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 60

// Output shape maps 1:1 onto kitchen_restaurants' parallel meal arrays.
type ParsedItem = { name: string; price: number; category: 'adult' | 'kids'; note: string }

const SYSTEM = `You extract orderable food items from a restaurant menu (given as text, raw JSON from an ordering system, or an image).

Return ONLY valid JSON, no prose and no markdown fences:
{"items":[{"name": string, "price": number, "category": "adult"|"kids", "note": string}]}

Rules:
- price: dollars as a number (e.g. 12.99). If no price is shown, use 0.
- If the source is JSON from an ordering platform, prices may be in CENTS (e.g. 1299). Convert those to dollars (12.99).
- category: "kids" only for kids'/children's-menu items; otherwise "adult".
- FLATTEN configurable items into finished, single-price items. If "Fried Rice" is 9 and a "+$1 chicken" option exists, output {"name":"Chicken Fried Rice","price":10}. Put any key choice in "note".
- note: a short clarifier, or "" (empty string). Never null.
- Skip section headers, pure drink lists, and anything not orderable as a meal. Cap at 40 items.
- If the source contains no actual menu with dishes, return {"items":[]}.`

// Online-ordering platforms whose pages usually expose the full priced menu in source/JSON.
// NOTE: order.online is deliberately excluded — it's DoorDash's Storefront product, i.e. the
// platform we're courting for partnership. Don't scrape it; steer users to a screenshot instead.
const ORDER_HOSTS = [
  'toasttab.com', 'chownow.com', 'square.site', 'squareup.com',
  'popmenu.com', 'menufy.com', 'slicelife.com', 'clover.com', 'spoton.com', 'bentobox',
]

// ── The LLM call. Swap this one function for OpenAI/Gemini if that's your key. ──
async function extractMenu(args: {
  text: string
  imageBase64?: string
  imageMediaType?: string
  restaurantName?: string
}): Promise<ParsedItem[]> {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('Missing ANTHROPIC_API_KEY')

  const content: Array<Record<string, unknown>> = []
  if (args.imageBase64) {
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: args.imageMediaType || 'image/jpeg', data: args.imageBase64 },
    })
  }
  content.push({
    type: 'text',
    text: `Restaurant: ${args.restaurantName || 'Unknown'}\n\nMenu source:\n${args.text || '(see attached image)'}`,
  })

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5', // ~1/3 the cost of Sonnet, strong at extraction; if accuracy dips, swap back to claude-sonnet-4-6
      max_tokens: 8000,
      system: SYSTEM,
      messages: [{ role: 'user', content }],
    }),
  })
  if (!res.ok) throw new Error(`LLM error ${res.status}`)

  const data = await res.json()
  const raw: string = (data.content || [])
    .map((b: { type: string; text?: string }) => (b.type === 'text' ? b.text || '' : ''))
    .join('')
    .trim()

  // Pull the JSON object out of the response, tolerating stray prose or code fences around it.
  let clean = raw.replace(/```json/gi, '').replace(/```/g, '').trim()
  const start = clean.indexOf('{')
  const end = clean.lastIndexOf('}')
  if (start >= 0 && end > start) clean = clean.slice(start, end + 1)
  let parsed: { items?: unknown }
  try {
    parsed = JSON.parse(clean)
  } catch {
    return [] // unparseable -> caller falls through to the screenshot / manual path
  }

  const items = Array.isArray(parsed.items) ? (parsed.items as ParsedItem[]) : []
  return items
    .map((i) => ({
      name: String(i?.name || '').slice(0, 80),
      price: Math.max(0, Number(i?.price) || 0),
      category: i?.category === 'kids' ? ('kids' as const) : ('adult' as const),
      note: String(i?.note || '').slice(0, 140),
    }))
    .filter((i) => i.name.length > 0)
    .slice(0, 40)
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#?\w+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Detect bot-protection interstitials (Cloudflare etc.) so we can steer the user to a screenshot.
function looksBotBlocked(html: string): boolean {
  return /Checking if the site connection is secured|Just a moment|cf-browser-verification|Attention Required|_cf_chl|Enable JavaScript and cookies to continue/i.test(html)
}

// Pull embedded JSON that ordering platforms (Toast/ChowNow) and Next.js apps use to render the menu.
function extractMenuJson(html: string): string {
  const blocks: string[] = []
  let m: RegExpExecArray | null

  const typed = /<script\b[^>]*type\s*=\s*["']application\/(?:ld\+)?json["'][^>]*>([\s\S]*?)<\/script>/gi
  while ((m = typed.exec(html)) !== null) {
    const b = m[1] || ''
    if (/price|menu|item|name/i.test(b)) blocks.push(b)
  }
  const next = /<script\b[^>]*id\s*=\s*["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i.exec(html)
  if (next && next[1]) blocks.push(next[1])

  if (blocks.join('').length < 500) {
    const any = /<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi
    while ((m = any.exec(html)) !== null) {
      const b = m[1] || ''
      if (/"price"/i.test(b) && /[:=]\s*[\[{]/.test(b) && !/webpackJsonp|function\s*\(/.test(b)) blocks.push(b)
      if (blocks.join('').length > 40000) break
    }
  }
  return blocks.join('\n').slice(0, 40000)
}

function isOrderHost(host: string): boolean {
  return ORDER_HOSTS.some((h) => host === h || host.endsWith('.' + h) || host.includes(h))
}

// Find menu/order links: same-site menu pages, plus off-site links to known ordering platforms.
function findMenuLinks(html: string, baseUrl: string): string[] {
  let base: URL
  try {
    base = new URL(baseUrl)
  } catch {
    return []
  }
  const re = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  const seen = new Set<string>()
  const scored: Array<{ url: string; score: number }> = []
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    const href = m[1]
    const label = m[2].replace(/<[^>]+>/g, ' ')
    const hay = `${href} ${label}`.toLowerCase()
    let score = 0
    if (/\bmenu\b/.test(hay)) score += 2
    if (/order/.test(hay)) score += 3
    if (/food|dishes/.test(hay)) score += 1
    let abs: URL
    try {
      abs = new URL(href, base)
    } catch {
      continue
    }
    const sameHost = abs.host === base.host
    const orderHost = isOrderHost(abs.host)
    if (orderHost) score += 6 // off-site Toast/ChowNow/Square = the priced source
    else if (!sameHost) continue // ignore other off-site links
    if (score === 0) continue
    const key = abs.href.split('#')[0]
    if (key === base.href.split('#')[0]) continue
    if (seen.has(key)) continue
    seen.add(key)
    scored.push({ url: key, score })
  }
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, 3).map((s) => s.url)
}

// Rank text sources by how "menu-like" they are (visible $ prices + JSON price keys).
function menuScore(text: string): number {
  const dollars = (text.match(/\$\s?\d/g) || []).length
  const jsonPrices = (text.match(/"price"/gi) || []).length
  return dollars * 2 + jsonPrices
}

// Extract text from a PDF menu (text-based PDFs only; scanned/image PDFs yield nothing).
async function extractPdfText(bytes: Uint8Array): Promise<string> {
  try {
    const { extractText, getDocumentProxy } = await import('unpdf')
    const pdf = await getDocumentProxy(bytes)
    const result = await extractText(pdf, { mergePages: true })
    const raw: unknown = result.text
    const joined = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw.join('\n') : ''
    return joined.trim()
  } catch {
    return ''
  }
}

// Render fallback: when a plain fetch can't read a JS-built site (Popmenu/Wix/Squarespace),
// run it through ScrapingBee (executes JS, waits for lazy-loaded menus) and return rendered HTML.
async function renderWithScrapingBee(url: string): Promise<string> {
  const key = process.env.SCRAPINGBEE_API_KEY
  if (!key) return ''
  try {
    const api = new URL('https://app.scrapingbee.com/api/v1/')
    api.searchParams.set('api_key', key)
    api.searchParams.set('url', url)
    api.searchParams.set('render_js', 'true')
    api.searchParams.set('wait', '4000') // let lazy-loaded menus populate before capture
    const r = await fetch(api.toString())
    if (!r.ok) return ''
    return await r.text()
  } catch {
    return ''
  }
}

async function fetchRich(url: string): Promise<string> {
  try {
    const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (YourKitchen menu importer)' } })
    const ct = r.headers.get('content-type') || ''
    if (ct.includes('application/pdf') || /\.pdf(\?|$)/i.test(url)) {
      return await extractPdfText(new Uint8Array(await r.arrayBuffer()))
    }
    const html = await r.text()
    const json = extractMenuJson(html)
    const visible = stripHtml(html)
    return `${json ? json + '\n\n' : ''}${visible}`.slice(0, 30000)
  } catch {
    return ''
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const url: string | undefined = body?.url
    const imageBase64: string | undefined = body?.imageBase64
    const imageMediaType: string | undefined = body?.imageMediaType
    const restaurantName: string | undefined = body?.restaurantName

    // ── Photo path: the universal fallback (works for any menu, even paper). ──
    if (imageBase64) {
      // An uploaded PDF arrives here too; the vision API rejects application/pdf, so extract its text.
      if (imageMediaType === 'application/pdf') {
        const pdfText = await extractPdfText(new Uint8Array(Buffer.from(imageBase64, 'base64')))
        if (pdfText.replace(/\s/g, '').length < 40) {
          return NextResponse.json(
            { error: 'That PDF looks like scanned images with no readable text \u2014 upload a clear photo of the menu instead.' },
            { status: 422 },
          )
        }
        const pdfItems = await extractMenu({ text: pdfText.slice(0, 30000), restaurantName })
        if (pdfItems.length === 0) {
          return NextResponse.json(
            { error: 'Couldn\u2019t find menu items in that PDF \u2014 try a photo instead.' },
            { status: 422 },
          )
        }
        return NextResponse.json({ success: true, items: pdfItems })
      }
      const items = await extractMenu({ text: '', imageBase64, imageMediaType, restaurantName })
      return NextResponse.json({ success: true, items })
    }

    // ── Link path: read the page, follow menu/order links (incl. Toast/ChowNow), parse the best source. ──
    if (url) {
      let mainResp: Response
      try {
        mainResp = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (YourKitchen menu importer)' } })
      } catch {
        return NextResponse.json({ error: "Couldn't reach that link." }, { status: 422 })
      }
      const ct = mainResp.headers.get('content-type') || ''
      // A PDF menu pasted (or linked) directly: extract its text and parse it.
      if (ct.includes('application/pdf') || /\.pdf(\?|$)/i.test(url)) {
        const pdfText = await extractPdfText(new Uint8Array(await mainResp.arrayBuffer()))
        if (pdfText.replace(/\s/g, '').length < 40) {
          return NextResponse.json(
            { error: 'That PDF looks like scanned images with no readable text \u2014 upload a photo of the menu instead.' },
            { status: 422 },
          )
        }
        const items = await extractMenu({ text: pdfText.slice(0, 30000), restaurantName })
        if (items.length === 0) {
          return NextResponse.json(
            { error: 'Couldn\u2019t find menu items in that PDF \u2014 try a photo of the menu instead.' },
            { status: 422 },
          )
        }
        return NextResponse.json({ success: true, items })
      }

      const mainHtml = await mainResp.text()
      const blocked = looksBotBlocked(mainHtml)
      const mainJson = extractMenuJson(mainHtml)
      const mainText = `${mainJson ? mainJson + '\n\n' : ''}${stripHtml(mainHtml)}`.slice(0, 30000)

      const sources: string[] = [mainText]
      for (const link of findMenuLinks(mainHtml, url)) {
        const t = await fetchRich(link)
        if (t) sources.push(t)
      }

      // Try the most menu-like source first; cap LLM calls at 2 for cost.
      sources.sort((a, b) => menuScore(b) - menuScore(a) || b.length - a.length)

      let items: ParsedItem[] = []
      let llmCalls = 0
      for (const text of sources) {
        if (text.replace(/\s/g, '').length < 40) continue
        items = await extractMenu({ text, restaurantName })
        llmCalls++
        if (items.length > 0) break
        if (llmCalls >= 2) break
      }

      // Render fallback for JS-built sites: the cheap path found nothing, so render once via ScrapingBee.
      if (items.length === 0) {
        const rendered = await renderWithScrapingBee(url)
        if (rendered) {
          const rjson = extractMenuJson(rendered)
          const rtext = `${rjson ? rjson + '\n\n' : ''}${stripHtml(rendered)}`.slice(0, 30000)
          if (rtext.replace(/\s/g, '').length >= 40) {
            items = await extractMenu({ text: rtext, restaurantName })
          }
        }
      }

      if (items.length === 0) {
        if (blocked) {
          return NextResponse.json(
            {
              error:
                'That page blocks automated access (it\u2019s bot-protected). Open it in your browser and upload a screenshot of the menu instead \u2014 we\u2019ll read the prices from the image.',
            },
            { status: 422 },
          )
        }
        return NextResponse.json(
          {
            error:
              'Couldn\u2019t find a priced menu on that site (chains often hide prices behind a location picker). Try the order page directly, or upload a photo / screenshot of the order screen.',
          },
          { status: 422 },
        )
      }
      return NextResponse.json({ success: true, items })
    }

    return NextResponse.json({ error: 'Provide a menu link or a photo.' }, { status: 400 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Menu parse failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 30

// Output shape maps 1:1 onto kitchen_restaurants' parallel meal arrays:
//   favorite_meals[]  favorite_meal_prices[]  favorite_meal_categories[]  favorite_meal_notes[]
type ParsedItem = { name: string; price: number; category: 'adult' | 'kids'; note: string }

const SYSTEM = `You extract orderable food items from a restaurant menu (given as text or an image).

Return ONLY valid JSON, no prose and no markdown fences:
{"items":[{"name": string, "price": number, "category": "adult"|"kids", "note": string}]}

Rules:
- price: dollars as a number (e.g. 12.99). If no price is shown, use 0.
- category: "kids" only for kids'/children's-menu items; otherwise "adult".
- FLATTEN configurable items into finished, single-price items. If "Fried Rice" is 9 and a "+$1 chicken" option exists, output {"name":"Chicken Fried Rice","price":10}. Put any key choice in "note".
- note: a short clarifier, or "" (empty string). Never null.
- Skip section headers, drink-only lists, and anything not orderable as a meal. Cap at 40 items.`

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
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6', // swap to claude-haiku-4-5 to cut cost
      max_tokens: 3000,
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

  const clean = raw.replace(/```json/g, '').replace(/```/g, '').trim()
  let parsed: { items?: unknown }
  try {
    parsed = JSON.parse(clean)
  } catch {
    throw new Error('Could not parse the menu — try a clearer photo or a different link.')
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

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const url: string | undefined = body?.url
    const imageBase64: string | undefined = body?.imageBase64
    const imageMediaType: string | undefined = body?.imageMediaType
    const restaurantName: string | undefined = body?.restaurantName

    let text = ''

    if (imageBase64) {
      // Photo path — the universal fallback (works for any menu, even a paper one).
      const items = await extractMenu({ text: '', imageBase64, imageMediaType, restaurantName })
      return NextResponse.json({ success: true, items })
    }

    if (url) {
      let resp: Response
      try {
        resp = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (YourKitchen menu importer)' } })
      } catch {
        return NextResponse.json({ error: "Couldn't reach that link." }, { status: 422 })
      }
      const ct = resp.headers.get('content-type') || ''
      if (ct.includes('application/pdf')) {
        // v1.1: real PDF extraction. For now, steer to the photo path.
        return NextResponse.json(
          { error: 'PDF menus aren\u2019t supported yet — upload a photo of the menu instead.' },
          { status: 422 },
        )
      }
      const html = await resp.text()
      text = stripHtml(html).slice(0, 20000)
      if (text.replace(/\s/g, '').length < 40) {
        // JS-rendered page returned an empty shell — push to the photo fallback.
        return NextResponse.json(
          { error: 'That page loads its menu dynamically and couldn\u2019t be read. Try a photo of the menu.' },
          { status: 422 },
        )
      }
      const items = await extractMenu({ text, restaurantName })
      return NextResponse.json({ success: true, items })
    }

    return NextResponse.json({ error: 'Provide a menu link or a photo.' }, { status: 400 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Menu parse failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

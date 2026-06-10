// app/api/card/[slug]/route.tsx
// Same card as the unfurl, but as a downloadable PNG — for surfaces where you
// UPLOAD an image instead of pasting a link (Instagram, Facebook feed, etc.).
// GET /api/card/danielle-moore  →  danielle-moore-yourkitchen.png
import { ImageResponse } from 'next/og'
import { createClient } from '@/lib/supabase/server'
import { CardElement, loadCardFonts, OG_SIZE } from '@/app/k/[slug]/share-card'

export const runtime = 'nodejs'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params

  let firstName = 'a friend'
  let useCase: string | null = null
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('kitchens')
      .select('name, use_case')
      .eq('slug', slug)
      .single()
    if (data?.name) firstName = String(data.name).split(/[\s']/)[0] || firstName
    useCase = (data?.use_case as string | null) ?? null
  } catch {
    // generic card fallback
  }

  const fonts = await loadCardFonts()

  const img = new ImageResponse(
    <CardElement firstName={firstName} slug={slug} useCase={useCase} />,
    { ...OG_SIZE, fonts, emoji: 'twemoji' },
  )

  img.headers.set('Content-Disposition', `attachment; filename="${slug}-yourkitchen.png"`)
  img.headers.set('Cache-Control', 'public, max-age=3600, s-maxage=86400')
  return img
}

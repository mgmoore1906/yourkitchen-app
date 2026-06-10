// app/k/[slug]/opengraph-image.tsx
// Generates the link-preview card that unfurls wherever a kitchen link is
// pasted (iMessage, WhatsApp, Slack, Facebook, Discord). Next wires this file
// to og:image automatically via the metadata file convention.
import { ImageResponse } from 'next/og'
import { createClient } from '@/lib/supabase/server'
import { CardElement, loadCardFonts, OG_SIZE } from './share-card'

export const alt = 'YourKitchen — send a meal'
export const size = OG_SIZE
export const contentType = 'image/png'
export const runtime = 'nodejs'

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
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
    // fall through to the generic "your village" card
  }

  const fonts = await loadCardFonts()

  return new ImageResponse(
    <CardElement firstName={firstName} slug={slug} useCase={useCase} />,
    { ...size, fonts, emoji: 'twemoji' },
  )
}

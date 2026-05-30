import { NextResponse } from 'next/server'
import { getChainMenu, GENERIC_MENU_ITEMS } from '@/lib/chain-menus'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const name = searchParams.get('name') || ''

  const items = getChainMenu(name)

  if (items) {
    return NextResponse.json({ items, source: 'library', matched: true })
  }

  // Return generic fallback so the UI always has something to show
  return NextResponse.json({ items: GENERIC_MENU_ITEMS, source: 'generic', matched: false })
}

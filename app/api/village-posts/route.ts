import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/village-posts?slug=danielle-moore  — public, no auth required
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const slug = searchParams.get('slug')
    const kitchen_id = searchParams.get('kitchen_id')

    if (!slug && !kitchen_id) {
      return NextResponse.json({ error: 'slug or kitchen_id required' }, { status: 400 })
    }

    let kId = kitchen_id
    if (!kId && slug) {
      const { data: kitchen } = await supabase
        .from('kitchens').select('id').eq('slug', slug).single()
      if (!kitchen) return NextResponse.json({ posts: [] })
      kId = kitchen.id
    }

    const { data } = await supabase
      .from('village_posts')
      .select('id, content, author_name, author_type, posted_at')
      .eq('kitchen_id', kId)
      .order('posted_at', { ascending: false })
      .limit(20)

    return NextResponse.json({ posts: data || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST /api/village-posts  — authenticated recipient OR unauthenticated coordinator reply
export async function POST(request: Request) {
  try {
    const { kitchen_id, content, author_name, author_type } = await request.json()

    if (!kitchen_id || !content?.trim()) {
      return NextResponse.json({ error: 'kitchen_id and content required' }, { status: 400 })
    }

    // author_type: 'recipient' (default) or 'supporter'
    const type = author_type || 'recipient'
    const name = author_name?.trim() || (type === 'recipient' ? 'Kitchen' : 'A supporter')

    const { data, error } = await supabase
      .from('village_posts')
      .insert({
        kitchen_id,
        content: content.trim(),
        author_name: name,
        author_type: type,
        posted_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, post: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

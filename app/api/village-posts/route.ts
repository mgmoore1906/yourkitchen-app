import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/village-posts?slug=megan-pete  — public, no auth required
// Returns top-level posts (parent_id = null) newest-first, each with its replies
// nested oldest-first, plus image_url / reactions / post_type.
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
      .select('id, content, author_name, author_type, posted_at, image_url, parent_id, reactions, post_type')
      .eq('kitchen_id', kId)
      .order('posted_at', { ascending: false })
      .limit(100)

    const all = data || []
    // Split into top-level posts and replies, then nest.
    const parents = all.filter((p: any) => !p.parent_id)
    const repliesByParent: Record<string, any[]> = {}
    all.filter((p: any) => p.parent_id).forEach((r: any) => {
      if (!repliesByParent[r.parent_id]) repliesByParent[r.parent_id] = []
      repliesByParent[r.parent_id].push(r)
    })
    // Replies oldest-first under each parent (natural reading order)
    const posts = parents.map((p: any) => ({
      ...p,
      replies: (repliesByParent[p.id] || []).sort(
        (a: any, b: any) => new Date(a.posted_at).getTime() - new Date(b.posted_at).getTime()
      ),
    }))

    return NextResponse.json({ posts })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST /api/village-posts  — create a post or reply.
// Body: { kitchen_id, content, author_name, author_type, image_url?, parent_id?, post_type? }
//   author_type: 'recipient' | 'coordinator'
//   image_url:   recipient photos only (route does not enforce; UI gates it)
//   parent_id:   set for a reply; replies can only point at top-level posts
//   post_type:   'note' (default) | 'system'
export async function POST(request: Request) {
  try {
    const { kitchen_id, content, author_name, author_type, image_url, parent_id, post_type } = await request.json()

    // A post needs either text or an image (photo-only posts are allowed)
    if (!kitchen_id || (!content?.trim() && !image_url)) {
      return NextResponse.json({ error: 'kitchen_id and content or image required' }, { status: 400 })
    }

    const type = author_type || 'recipient'
    const name = author_name?.trim() || (type === 'recipient' ? 'Kitchen' : 'A supporter')

    // Enforce one-level threading: if parent_id is given, it must be a top-level post.
    let safeParentId: string | null = null
    if (parent_id) {
      const { data: parent } = await supabase
        .from('village_posts')
        .select('id, parent_id')
        .eq('id', parent_id)
        .single()
      if (parent && !parent.parent_id) {
        safeParentId = parent.id
      } else if (parent && parent.parent_id) {
        // Replying to a reply → reattach to the original top-level post
        safeParentId = parent.parent_id
      }
    }

    const { data, error } = await supabase
      .from('village_posts')
      .insert({
        kitchen_id,
        content: content?.trim() || '',
        author_name: name,
        author_type: type,
        image_url: image_url || null,
        parent_id: safeParentId,
        post_type: post_type === 'system' ? 'system' : 'note',
        reactions: {},
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

// PATCH /api/village-posts  — toggle/increment an emoji reaction.
// Body: { post_id, emoji, direction? }  direction: 'add' (default) | 'remove'
export async function PATCH(request: Request) {
  try {
    const { post_id, emoji, direction } = await request.json()
    if (!post_id || !emoji) {
      return NextResponse.json({ error: 'post_id and emoji required' }, { status: 400 })
    }

    const { data: post } = await supabase
      .from('village_posts')
      .select('reactions')
      .eq('id', post_id)
      .single()

    if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })

    const reactions: Record<string, number> = { ...(post.reactions || {}) }
    const current = reactions[emoji] || 0
    if (direction === 'remove') {
      reactions[emoji] = Math.max(0, current - 1)
      if (reactions[emoji] === 0) delete reactions[emoji]
    } else {
      reactions[emoji] = current + 1
    }

    const { data, error } = await supabase
      .from('village_posts')
      .update({ reactions })
      .eq('id', post_id)
      .select('id, reactions')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, post: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE /api/village-posts  — recipient removes a post from their own board.
// Body: { post_id, kitchen_id }  (kitchen_id guards against cross-kitchen deletes)
export async function DELETE(request: Request) {
  try {
    const { post_id, kitchen_id } = await request.json()
    if (!post_id || !kitchen_id) {
      return NextResponse.json({ error: 'post_id and kitchen_id required' }, { status: 400 })
    }
    // Deletes the post and (via ON DELETE CASCADE) any replies to it
    const { error } = await supabase
      .from('village_posts')
      .delete()
      .eq('id', post_id)
      .eq('kitchen_id', kitchen_id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

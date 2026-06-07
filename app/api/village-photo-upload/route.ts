import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const BUCKET = 'village-photos'
const MAX_BYTES = 5 * 1024 * 1024 // 5 MB — matches bucket limit
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp']

// POST /api/village-photo-upload
// Multipart form with field "file" (the image) and "kitchen_id".
// Uploads via the service-role key (bypasses RLS), returns the public URL.
// The browser never touches the bucket directly.
export async function POST(request: Request) {
  const supabase = getSupabase()
  try {
    const form = await request.formData()
    const file = form.get('file') as File | null
    const kitchen_id = form.get('kitchen_id') as string | null

    if (!file || !kitchen_id) {
      return NextResponse.json({ error: 'file and kitchen_id required' }, { status: 400 })
    }
    if (!ALLOWED.includes(file.type)) {
      return NextResponse.json({ error: 'Only JPEG, PNG, or WebP images are allowed' }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Image must be under 5 MB' }, { status: 400 })
    }

    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
    // Path: {kitchen_id}/{timestamp}-{rand}.{ext} — groups photos per kitchen
    const path = `${kitchen_id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

    const arrayBuffer = await file.arrayBuffer()
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, arrayBuffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false,
      })

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path)
    return NextResponse.json({ success: true, url: pub.publicUrl })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

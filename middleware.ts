import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // ── Private study area: HTTP Basic auth, separate from the app login ──
  if (request.nextUrl.pathname.startsWith('/study')) {
    const user = process.env.STUDY_USER || ''
    const pass = process.env.STUDY_PASS || ''
    const auth = request.headers.get('authorization')
    if (user && pass && auth?.startsWith('Basic ')) {
      const decoded = atob(auth.slice(6))
      const sep = decoded.indexOf(':')
      if (decoded.slice(0, sep) === user && decoded.slice(sep + 1) === pass) {
        return NextResponse.next()
      }
    }
    return new NextResponse('Authentication required.', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="YourKitchen Study", charset="UTF-8"' },
    })
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user && !request.nextUrl.pathname.startsWith('/login') && 
      !request.nextUrl.pathname.startsWith('/auth')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/dashboard/:path*', '/kitchen/:path*', '/study', '/study/:path*'],
}

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { /* your cookie handlers */ } }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname

  // Login page pe already logged in hai toh redirect
  if (user && path === '/auth/login') {
    return NextResponse.redirect(new URL('/employee/dashboard', request.url))
  }

  // Protected routes
  if (!user && (path.startsWith('/admin') || path.startsWith('/employee'))) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  // Admin route pe employee aaya toh block
  if (path.startsWith('/admin')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user?.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.redirect(new URL('/employee/dashboard', request.url))
    }
  }

  return response
}

export const config = {
  matcher: ['/admin/:path*', '/employee/:path*', '/auth/login'],
}
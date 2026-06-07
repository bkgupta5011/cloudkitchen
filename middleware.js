import { NextResponse } from 'next/server'

export function middleware(request) {
  const host = request.headers.get('host') || ''
  const url = request.nextUrl.clone()

  // order.foodfi.in → always serve /order page (public menu)
  if (host === 'order.foodfi.in' || host.startsWith('order.foodfi.in:')) {
    // Allow public menu API to pass through
    if (url.pathname.startsWith('/api/public/')) {
      return NextResponse.next()
    }
    // Allow Next.js internals and static files
    if (
      url.pathname.startsWith('/_next/') ||
      url.pathname.startsWith('/icons/') ||
      url.pathname === '/sw.js' ||
      url.pathname === '/manifest.json' ||
      url.pathname === '/favicon.ico'
    ) {
      return NextResponse.next()
    }
    // Rewrite EVERYTHING else (including /login, /, /menu etc.) → /order
    url.pathname = '/order'
    return NextResponse.rewrite(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image).*)',
  ],
}

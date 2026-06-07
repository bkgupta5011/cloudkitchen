import { NextResponse } from 'next/server'

export function middleware(request) {
  const host = request.headers.get('host') || ''
  const url = request.nextUrl.clone()

  // order.foodfi.in → serve /order page
  if (host.startsWith('order.')) {
    // Allow API calls to pass through
    if (url.pathname.startsWith('/api/')) {
      return NextResponse.next()
    }
    // Rewrite root and any path to /order
    if (url.pathname === '/' || url.pathname === '') {
      url.pathname = '/order'
      return NextResponse.rewrite(url)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons|images|sw.js|manifest.json).*)',
  ],
}

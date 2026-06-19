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
    // Allow the Blog Corner + Fitness Corner + premium landing (+ their APIs)
    if (
      url.pathname === '/blog' ||
      url.pathname.startsWith('/blog/') ||
      url.pathname === '/blog-write' ||
      url.pathname.startsWith('/api/blog') ||
      url.pathname === '/fitness' ||
      url.pathname.startsWith('/api/fitness') ||
      url.pathname === '/order-preview'
    ) {
      return NextResponse.next()
    }
    // order.foodfi.in is NOT separately installable — block its manifest so the
    // browser never offers to install the order.foodfi.in app (users install
    // the real app from foodfi.in). 404 = no valid manifest = no install prompt.
    if (url.pathname === '/manifest.json') {
      return new NextResponse(null, { status: 404 })
    }
    // Allow Next.js internals, static files and SEO files
    if (
      url.pathname.startsWith('/_next/') ||
      url.pathname.startsWith('/icons/') ||
      url.pathname === '/sw.js' ||
      url.pathname === '/favicon.ico' ||
      url.pathname === '/sitemap.xml' ||
      url.pathname === '/robots.txt' ||
      url.pathname.startsWith('/google')
    ) {
      return NextResponse.next()
    }
    // Root → premium landing (rotating food hero + menu/fitness entries)
    if (url.pathname === '/') {
      url.pathname = '/order-preview'
      return NextResponse.rewrite(url)
    }
    // Rewrite EVERYTHING else (including /login, /menu etc.) → /order
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

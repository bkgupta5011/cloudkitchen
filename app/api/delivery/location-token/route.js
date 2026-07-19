export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { verifyToken } from '@/lib/auth'

// Issues a long-lived, narrowly-scoped token the Flutter app can hold onto and
// use for background location PATCHes (see app/api/delivery/location/route.js),
// since a native background service has no access to the ck_token httpOnly
// cookie living in the WebView's own cookie jar. role:'delivery-location' can
// only ever authorize the location PATCH — nothing else checks for it.
export async function POST(request) {
  const token = request.cookies.get('ck_token')?.value
  const user = verifyToken(token)
  if (!user || user.role !== 'delivery') {
    return NextResponse.json({ error: 'Delivery login required' }, { status: 401 })
  }

  const locationToken = jwt.sign(
    { id: user.id, role: 'delivery-location' },
    process.env.JWT_SECRET,
    { expiresIn: '180d' }
  )

  return NextResponse.json({ token: locationToken })
}

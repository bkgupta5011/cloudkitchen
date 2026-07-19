export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { verifyToken } from '@/lib/auth'

// Ensure location columns exist (run once, then cached by Postgres)
async function ensureColumns(sql) {
  try {
    await sql`ALTER TABLE delivery_boys ADD COLUMN IF NOT EXISTS current_lat  DECIMAL(10,8) DEFAULT NULL`
    await sql`ALTER TABLE delivery_boys ADD COLUMN IF NOT EXISTS current_lng  DECIMAL(11,8) DEFAULT NULL`
    await sql`ALTER TABLE delivery_boys ADD COLUMN IF NOT EXISTS location_updated_at TIMESTAMP DEFAULT NULL`
  } catch {}
}

// Accepts either the normal ck_token session cookie (foreground web/WebView
// JS, unchanged) OR an Authorization: Bearer <token> issued by
// /api/delivery/location-token (the Flutter background service — it has no
// access to the httpOnly cookie sitting in the WebView's cookie jar).
function authenticate(request) {
  const cookieToken = request.cookies.get('ck_token')?.value
  const cookieUser = verifyToken(cookieToken)
  if (cookieUser?.role === 'delivery') return cookieUser

  const authHeader = request.headers.get('authorization') || ''
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  const bearerUser = bearerToken ? verifyToken(bearerToken) : null
  if (bearerUser?.role === 'delivery-location') return bearerUser

  return null
}

// PATCH — delivery boy sends live GPS coordinates (foreground JS or background service)
export async function PATCH(request) {
  const sql = getDb()
  const user = authenticate(request)
  if (!user) {
    return NextResponse.json({ error: 'Delivery login required' }, { status: 401 })
  }

  const body = await request.json()
  const lat = parseFloat(body.lat)
  const lng = parseFloat(body.lng)
  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({ error: 'Valid lat/lng required' }, { status: 400 })
  }

  await ensureColumns(sql)

  await sql`
    UPDATE delivery_boys
    SET current_lat = ${lat},
        current_lng = ${lng},
        location_updated_at = NOW()
    WHERE id = ${user.id}
  `
  return NextResponse.json({ ok: true })
}

export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { getDeliveryCharge } from '@/lib/utils'
import { roadDistanceKm, haversineKm } from '@/lib/distance'

// Customer cart preview: given a delivery lat/lng, return the real road
// distance to the nearest serving branch + whether it's in range + charge.
// ORS key stays server-side; falls back to haversine if ORS is unavailable.
export async function GET(request) {
  const token = request.cookies.get('ck_token')?.value
  const user = verifyToken(token)
  if (!user) return NextResponse.json({ error: 'Login required' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const lat = parseFloat(searchParams.get('lat'))
  const lng = parseFloat(searchParams.get('lng'))
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: 'lat/lng required' }, { status: 400 })
  }

  const sql = getDb()
  const branches = await sql`SELECT id, name, lat, lng, max_delivery_km FROM branches WHERE is_active = true`
  const [settings] = await sql`SELECT max_delivery_km FROM kitchen_settings WHERE id = 1`
  const globalKm = parseFloat(settings?.max_delivery_km) || 0

  // Nearest branch by straight-line (cheap) → compute ONE road-distance call to it.
  let nearest = null, min = Infinity
  for (const b of branches) {
    if (!b.lat || !b.lng) continue
    const d = haversineKm(lat, lng, parseFloat(b.lat), parseFloat(b.lng))
    if (d < min) { min = d; nearest = b }
  }
  if (!nearest) {
    return NextResponse.json({ distanceKm: null, outOfRange: false, deliveryCharge: null, branchId: null })
  }

  const branchKm = parseFloat(nearest.max_delivery_km) || 0
  const radius = branchKm > 0 ? branchKm : globalKm

  const { km, source } = await roadDistanceKm(parseFloat(nearest.lat), parseFloat(nearest.lng), lat, lng)
  const outOfRange = radius > 0 ? km > radius : false
  const deliveryCharge = outOfRange ? null : await getDeliveryCharge(km)

  return NextResponse.json({
    distanceKm: km,
    source,
    outOfRange,
    deliveryCharge,
    branchId: nearest.id,
    branchName: nearest.name,
    radius,
  })
}

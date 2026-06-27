export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { verifyToken } from '@/lib/auth'

// The mobile app posts the delivery boy's FCM device token here (linked to
// his account) so the server can push order alerts that reach him even when
// the app is minimised or closed.
export async function POST(request) {
  const sql = getDb()
  const token = request.cookies.get('ck_token')?.value
  const user = verifyToken(token)
  if (!user || user.role !== 'delivery') {
    return NextResponse.json({ error: 'Delivery login required' }, { status: 401 })
  }

  const { token: fcmToken } = await request.json()
  if (!fcmToken) return NextResponse.json({ error: 'token required' }, { status: 400 })

  try { await sql`ALTER TABLE delivery_boys ADD COLUMN IF NOT EXISTS fcm_token TEXT` } catch {}
  await sql`UPDATE delivery_boys SET fcm_token = ${fcmToken} WHERE id = ${user.id}`

  return NextResponse.json({ success: true })
}

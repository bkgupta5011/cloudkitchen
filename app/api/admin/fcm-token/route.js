export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { verifyToken } from '@/lib/auth'

// The mobile app posts the logged-in admin/kitchen FCM device token here so
// new-order alerts reach the kitchen phone even when the app is closed —
// the same reliable native path the delivery boys already use.
export async function POST(request) {
  const sql = getDb()
  const token = request.cookies.get('ck_token')?.value
  const user = verifyToken(token)
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Admin login required' }, { status: 401 })
  }

  const { token: fcmToken } = await request.json()
  if (!fcmToken) return NextResponse.json({ error: 'token required' }, { status: 400 })

  try { await sql`ALTER TABLE admins ADD COLUMN IF NOT EXISTS fcm_token TEXT` } catch {}
  await sql`UPDATE admins SET fcm_token = ${fcmToken} WHERE id = ${user.id}`

  return NextResponse.json({ success: true })
}

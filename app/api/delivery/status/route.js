export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { verifyToken } from '@/lib/auth'

// Ensure is_online column exists (in case table was created before this feature)
async function ensureIsOnlineColumn(sql) {
  try {
    await sql`ALTER TABLE delivery_boys ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT FALSE`
  } catch {}
}

export async function GET(request) {
  const sql = getDb()
  const token = request.cookies.get('ck_token')?.value
  const user = verifyToken(token)
  if (!user || user.role !== 'delivery') {
    return NextResponse.json({ error: 'Delivery boy login required' }, { status: 401 })
  }
  await ensureIsOnlineColumn(sql)
  const [boy] = await sql`SELECT is_online FROM delivery_boys WHERE id = ${user.id}`
  return NextResponse.json({ isOnline: boy?.is_online ?? false })
}

export async function PATCH(request) {
  const sql = getDb()
  const token = request.cookies.get('ck_token')?.value
  const user = verifyToken(token)
  if (!user || user.role !== 'delivery') {
    return NextResponse.json({ error: 'Delivery boy login required' }, { status: 401 })
  }
  await ensureIsOnlineColumn(sql)
  const { isOnline } = await request.json()
  await sql`UPDATE delivery_boys SET is_online = ${isOnline} WHERE id = ${user.id}`
  return NextResponse.json({ success: true, isOnline })
}

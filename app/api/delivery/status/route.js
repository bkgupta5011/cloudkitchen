import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { verifyToken } from '@/lib/auth'

export async function PATCH(request) {
  const sql = getDb()
  const token = request.cookies.get('ck_token')?.value
  const user = verifyToken(token)
  if (!user || user.role !== 'delivery') {
    return NextResponse.json({ error: 'Delivery boy login required' }, { status: 401 })
  }
  const { isOnline } = await request.json()
  await sql`UPDATE delivery_boys SET is_online = ${isOnline} WHERE id = ${user.id}`
  return NextResponse.json({ success: true, isOnline })
}

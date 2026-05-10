export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { verifyToken } from '@/lib/auth'

async function ensureTable(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS admin_notices (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      message TEXT NOT NULL,
      emoji VARCHAR(10) DEFAULT '📢',
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `
}

export async function GET(request) {
  const sql = getDb()
  await ensureTable(sql)
  const token = request.cookies.get('ck_token')?.value
  const user = verifyToken(token)
  let notices
  if (user?.role === 'admin') {
    notices = await sql`SELECT * FROM admin_notices ORDER BY created_at DESC LIMIT 20`
  } else {
    notices = await sql`SELECT * FROM admin_notices WHERE is_active = true ORDER BY created_at DESC LIMIT 5`
  }
  return NextResponse.json({ notices })
}

export async function POST(request) {
  const sql = getDb()
  const token = request.cookies.get('ck_token')?.value
  const user = verifyToken(token)
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  await ensureTable(sql)
  const { message, emoji } = await request.json()
  if (!message?.trim()) return NextResponse.json({ error: 'Message required' }, { status: 400 })
  const [notice] = await sql`INSERT INTO admin_notices (message, emoji) VALUES (${message.trim()}, ${emoji || '📢'}) RETURNING *`
  return NextResponse.json({ notice })
}

export async function DELETE(request) {
  const sql = getDb()
  const token = request.cookies.get('ck_token')?.value
  const user = verifyToken(token)
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  await sql`DELETE FROM admin_notices WHERE id = ${id}`
  return NextResponse.json({ success: true })
}

export async function PATCH(request) {
  const sql = getDb()
  const token = request.cookies.get('ck_token')?.value
  const user = verifyToken(token)
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  await ensureTable(sql)
  const { id, is_active } = await request.json()
  await sql`UPDATE admin_notices SET is_active = ${is_active} WHERE id = ${id}`
  return NextResponse.json({ success: true })
}

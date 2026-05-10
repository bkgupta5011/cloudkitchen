export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { verifyToken } from '@/lib/auth'

async function ensureTable(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS support_messages (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id UUID NOT NULL,
      user_name VARCHAR(100),
      user_phone VARCHAR(20),
      message TEXT NOT NULL,
      is_from_admin BOOLEAN DEFAULT false,
      is_read BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `
}

// GET — customer: own messages; admin: all unread threads
export async function GET(request) {
  const sql = getDb()
  const token = request.cookies.get('ck_token')?.value
  const user = verifyToken(token)
  if (!user) return NextResponse.json({ error: 'Login required' }, { status: 401 })
  await ensureTable(sql)

  if (user.role === 'admin') {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (userId) {
      // Load a specific user's thread
      const msgs = await sql`
        SELECT * FROM support_messages WHERE user_id = ${userId} ORDER BY created_at ASC
      `
      // Mark admin-unread as read
      await sql`
        UPDATE support_messages SET is_read = true
        WHERE user_id = ${userId} AND is_from_admin = false
      `
      return NextResponse.json({ messages: msgs })
    }

    // List all threads — real customer name from users table, sorted: unread first then latest
    const threads = await sql`
      SELECT
        latest.user_id,
        u.name     AS user_name,
        u.phone    AS user_phone,
        latest.message,
        latest.is_from_admin,
        latest.is_read,
        latest.created_at,
        COALESCE(unread.cnt, 0) AS unread_count
      FROM (
        SELECT DISTINCT ON (user_id) *
        FROM support_messages
        ORDER BY user_id, created_at DESC
      ) latest
      JOIN users u ON latest.user_id = u.id
      LEFT JOIN (
        SELECT user_id, COUNT(*) AS cnt
        FROM support_messages
        WHERE is_read = false AND is_from_admin = false
        GROUP BY user_id
      ) unread ON unread.user_id = latest.user_id
      ORDER BY
        CASE WHEN COALESCE(unread.cnt, 0) > 0 THEN 0 ELSE 1 END,
        latest.created_at DESC
    `
    return NextResponse.json({ threads })
  }

  if (user.role === 'customer') {
    const msgs = await sql`
      SELECT * FROM support_messages WHERE user_id = ${user.id} ORDER BY created_at ASC
    `
    // Mark admin replies as read
    await sql`
      UPDATE support_messages SET is_read = true
      WHERE user_id = ${user.id} AND is_from_admin = true
    `
    return NextResponse.json({ messages: msgs })
  }

  return NextResponse.json({ messages: [] })
}

// POST — send a message
export async function POST(request) {
  const sql = getDb()
  const token = request.cookies.get('ck_token')?.value
  const user = verifyToken(token)
  if (!user) return NextResponse.json({ error: 'Login required' }, { status: 401 })
  await ensureTable(sql)

  const { message, targetUserId } = await request.json()
  if (!message?.trim()) return NextResponse.json({ error: 'Message required' }, { status: 400 })

  let msg
  if (user.role === 'admin' && targetUserId) {
    // Admin replying to a customer
    const [m] = await sql`
      INSERT INTO support_messages (user_id, user_name, user_phone, message, is_from_admin)
      VALUES (${targetUserId}, 'Admin', 'Kitchen', ${message.trim()}, true)
      RETURNING *
    `
    msg = m
  } else if (user.role === 'customer') {
    // Customer sending message
    const [custInfo] = await sql`SELECT name, phone FROM users WHERE id = ${user.id}`
    const [m] = await sql`
      INSERT INTO support_messages (user_id, user_name, user_phone, message, is_from_admin)
      VALUES (${user.id}, ${custInfo?.name || 'Customer'}, ${custInfo?.phone || ''}, ${message.trim()}, false)
      RETURNING *
    `
    msg = m
  } else {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  }

  return NextResponse.json({ message: msg })
}

export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { verifyToken } from '@/lib/auth'

async function ensureTable(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS notifications (
      id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id     TEXT NOT NULL,
      role        TEXT NOT NULL,
      title       TEXT NOT NULL,
      body        TEXT,
      url         TEXT DEFAULT '/',
      tag         TEXT,
      is_read     BOOLEAN DEFAULT FALSE,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `.catch(() => {})
  // Index for fast user lookups
  await sql`
    CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications(user_id, created_at DESC)
  `.catch(() => {})
}

// GET — fetch user's notifications (latest 50)
export async function GET(request) {
  const sql = getDb()
  const token = request.cookies.get('ck_token')?.value
  const user = verifyToken(token)
  if (!user) return NextResponse.json({ error: 'Login required' }, { status: 401 })

  await ensureTable(sql)

  const notifications = await sql`
    SELECT * FROM notifications
    WHERE user_id = ${String(user.id)}
    ORDER BY created_at DESC
    LIMIT 50
  `
  const unreadCount = notifications.filter(n => !n.is_read).length
  return NextResponse.json({ notifications, unreadCount })
}

// POST — create notification (internal use from push.js)
export async function POST(request) {
  const sql = getDb()
  const secret = request.headers.get('x-internal-secret')
  if (secret !== process.env.JWT_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await ensureTable(sql)
  const { userId, role, title, body, url, tag } = await request.json()

  if (!userId || !title) return NextResponse.json({ error: 'userId and title required' }, { status: 400 })

  const [notif] = await sql`
    INSERT INTO notifications (user_id, role, title, body, url, tag)
    VALUES (${String(userId)}, ${role || 'customer'}, ${title}, ${body || null}, ${url || '/'}, ${tag || null})
    RETURNING *
  `
  return NextResponse.json({ notification: notif }, { status: 201 })
}

// PATCH — mark notifications as read
export async function PATCH(request) {
  const sql = getDb()
  const token = request.cookies.get('ck_token')?.value
  const user = verifyToken(token)
  if (!user) return NextResponse.json({ error: 'Login required' }, { status: 401 })

  const { notifId } = await request.json()

  if (notifId) {
    // Mark specific notification as read
    await sql`UPDATE notifications SET is_read = TRUE WHERE id = ${notifId} AND user_id = ${String(user.id)}`
  } else {
    // Mark ALL as read
    await sql`UPDATE notifications SET is_read = TRUE WHERE user_id = ${String(user.id)}`
  }

  return NextResponse.json({ ok: true })
}

// DELETE — clear all read notifications
export async function DELETE(request) {
  const sql = getDb()
  const token = request.cookies.get('ck_token')?.value
  const user = verifyToken(token)
  if (!user) return NextResponse.json({ error: 'Login required' }, { status: 401 })

  await sql`DELETE FROM notifications WHERE user_id = ${String(user.id)} AND is_read = TRUE`
  return NextResponse.json({ ok: true })
}

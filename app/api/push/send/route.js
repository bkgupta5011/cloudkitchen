// Internal route — send push notification to user(s)
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import webpush from 'web-push'
import { getDb } from '@/lib/db'
import { verifyToken } from '@/lib/auth'

webpush.setVapidDetails(
  process.env.VAPID_EMAIL || 'mailto:admin@foodfi.in',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
)

// POST — send to specific user or role
// Body: { userId?, role?, title, body, url, tag, requireInteraction }
export async function POST(request) {
  try {
    const sql = getDb()

    // Allow only from internal (admin panel or order flow) — check secret header or admin role
    const token = request.cookies.get('ck_token')?.value
    const user = verifyToken(token)
    const internalSecret = request.headers.get('x-internal-secret')
    const isInternal = internalSecret === process.env.JWT_SECRET
    if (!isInternal && (!user || user.role !== 'admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { userId, role, title, body: msgBody, url, tag, requireInteraction, actions } = body

    // Find target subscriptions
    let subs = []
    if (userId) {
      subs = await sql`SELECT * FROM push_subscriptions WHERE user_id = ${String(userId)}`
    } else if (role) {
      subs = await sql`SELECT * FROM push_subscriptions WHERE role = ${role}`
    }

    if (!subs.length) return NextResponse.json({ ok: true, sent: 0 })

    const payload = JSON.stringify({ title, body: msgBody, url: url || '/', tag, requireInteraction, actions })
    let sent = 0, failed = 0

    await Promise.all(subs.map(async (s) => {
      try {
        await webpush.sendNotification(s.subscription, payload)
        sent++
      } catch (err) {
        failed++
        // Remove stale subscriptions (410 Gone = browser revoked permission)
        if (err.statusCode === 410 || err.statusCode === 404) {
          await sql`DELETE FROM push_subscriptions WHERE id = ${s.id}`.catch(() => {})
        }
      }
    }))

    return NextResponse.json({ ok: true, sent, failed })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

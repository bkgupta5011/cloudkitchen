export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { sendPushToUser } from '@/lib/push'

export async function GET(request) {
  const sql = getDb()
  const token = request.cookies.get('ck_token')?.value
  const user  = verifyToken(token)

  if (!user || user.role !== 'delivery') {
    return NextResponse.json({ error: 'Delivery boy login required' }, { status: 401 })
  }

  // Ensure tables exist
  await sql`
    CREATE TABLE IF NOT EXISTS order_rejections (
      id               SERIAL PRIMARY KEY,
      order_id         UUID NOT NULL,
      delivery_boy_id  UUID NOT NULL,
      created_at       TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(order_id, delivery_boy_id)
    )
  `.catch(() => {})

  // Ensure last_broadcast_at column exists on orders
  await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS last_broadcast_at TIMESTAMPTZ`.catch(() => {})

  // ── Fetch pending unassigned orders (max 45 min old) ───────────────
  // Age limit stops OLD stuck orders (like #317) from ringing forever
  const orders = await sql`
    SELECT
      o.id, o.order_number, o.delivery_address, o.delivery_lat, o.delivery_lng,
      o.total, o.delivery_charge, o.distance_km, o.notes, o.created_at,
      o.last_broadcast_at,
      u.name  AS customer_name,
      u.phone AS customer_phone,
      (
        SELECT COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT('name', oi.name, 'quantity', oi.quantity, 'price', oi.price)
            ORDER BY oi.id
          ),
          '[]'::json
        )
        FROM order_items oi WHERE oi.order_id = o.id
      ) AS items
    FROM orders o
    LEFT JOIN users u ON o.user_id = u.id
    WHERE o.status = 'pending'
      AND o.delivery_boy_id IS NULL
      AND o.created_at > NOW() - INTERVAL '45 minutes'
      AND NOT EXISTS (
        SELECT 1 FROM order_rejections r
        WHERE r.order_id = o.id AND r.delivery_boy_id = ${user.id}
      )
    ORDER BY o.created_at ASC
    LIMIT 5
  `

  // ── Repeat push every 60s for each unaccepted order ───────────────
  // Triggers from delivery boy's poll — no cron job needed
  // Atomic update prevents multiple boys from all sending simultaneously
  for (const order of orders) {
    const needsRepeat = !order.last_broadcast_at ||
      (Date.now() - new Date(order.last_broadcast_at).getTime()) > 58000 // 58s

    if (!needsRepeat) continue

    // Atomic claim: only the first poller per 60s window does the re-push
    const claimed = await sql`
      UPDATE orders
      SET last_broadcast_at = NOW()
      WHERE id = ${order.id}
        AND (last_broadcast_at IS NULL OR last_broadcast_at < NOW() - INTERVAL '58 seconds')
      RETURNING id
    `.catch(() => [])

    if (!claimed.length) continue // another boy's poll already sent it

    // Get all online boys who haven't rejected this order
    const eligibleBoys = await sql`
      SELECT db.id FROM delivery_boys db
      WHERE db.is_online = true AND db.status = 'approved'
        AND NOT EXISTS (
          SELECT 1 FROM order_rejections r
          WHERE r.order_id = ${order.id} AND r.delivery_boy_id = db.id
        )
    `.catch(() => [])

    for (const boy of eligibleBoys) {
      sendPushToUser(String(boy.id), {
        title:   '🔔 Order Ka Wait Hai! Accept Karo',
        body:    `#${order.order_number} — ₹${Math.round(order.total)} · ${(order.delivery_address || '').slice(0, 42)}`,
        url:     '/delivery',
        tag:     `new-order-${order.id}`,
        orderId: order.id,
        requireInteraction: true,
      }, 'delivery').catch(() => {})
    }
  }

  const response = NextResponse.json({ orders })
  response.headers.set('Cache-Control', 'no-store')
  return response
}

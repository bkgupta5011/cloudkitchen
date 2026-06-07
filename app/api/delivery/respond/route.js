export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { sendPushToRole } from '@/lib/push'

export async function POST(request) {
  const sql  = getDb()
  const token = request.cookies.get('ck_token')?.value
  const user  = verifyToken(token)

  if (!user || user.role !== 'delivery') {
    return NextResponse.json({ error: 'Delivery boy login required' }, { status: 401 })
  }

  const { orderId, action } = await request.json()
  if (!orderId || !['accept', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'orderId and action (accept|reject) required' }, { status: 400 })
  }

  // Ensure rejections table exists
  await sql`
    CREATE TABLE IF NOT EXISTS order_rejections (
      id               SERIAL PRIMARY KEY,
      order_id         UUID NOT NULL,
      delivery_boy_id  UUID NOT NULL,
      created_at       TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(order_id, delivery_boy_id)
    )
  `.catch(() => {})

  // ── REJECT ─────────────────────────────────────────────────────
  if (action === 'reject') {
    await sql`
      INSERT INTO order_rejections (order_id, delivery_boy_id)
      VALUES (${orderId}, ${user.id})
      ON CONFLICT DO NOTHING
    `
    return NextResponse.json({ success: true, action: 'rejected' })
  }

  // ── ACCEPT (race-safe) ─────────────────────────────────────────
  // Get payout info
  const [boyRate]   = await sql`SELECT per_km_earning, name FROM delivery_boys WHERE id = ${user.id}`
  const [orderInfo] = await sql`SELECT distance_km, delivery_charge, order_number FROM orders WHERE id = ${orderId}`

  if (!orderInfo) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  const perKm    = parseFloat(boyRate?.per_km_earning || 0)
  const distKm   = orderInfo.distance_km ? parseFloat(orderInfo.distance_km) : null
  const boyPayout = perKm > 0 ? perKm * (distKm ?? 3) : null

  // Atomic claim: only succeeds if nobody else has taken it yet
  // Status stays 'pending' — admin will manually confirm the order
  const updated = await sql`
    UPDATE orders
    SET delivery_boy_id = ${user.id},
        boy_payout      = COALESCE(boy_payout, ${boyPayout})
    WHERE id                = ${orderId}
      AND delivery_boy_id IS NULL
      AND status            = 'pending'
    RETURNING id, order_number
  `

  if (!updated.length) {
    // Another boy beat us to it — tell client to drop this order
    return NextResponse.json({ success: false, reason: 'already_taken' })
  }

  const order = updated[0]

  // Notify admins — boy has accepted, waiting for kitchen to confirm
  sendPushToRole('admin', {
    title: `🛵 Order #${order.order_number} — Delivery Boy Ready!`,
    body:  `${boyRate?.name || 'Delivery boy'} ne accept kar liya — ab aap order confirm karo`,
    url:   '/admin',
    tag:   `order-accepted-${orderId}`,
    requireInteraction: true,
  }).catch(() => {})

  return NextResponse.json({
    success:     true,
    action:      'accepted',
    orderId,
    orderNumber: order.order_number,
  })
}

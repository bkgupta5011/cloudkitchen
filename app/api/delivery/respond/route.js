export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { sendPushToUser } from '@/lib/push'

// Helper: find next eligible boy and assign
async function reassignOrder(sql, orderId, orderInfo) {
  const eligibleBoys = await sql`
    SELECT db.id, db.name, db.per_km_earning,
      COUNT(o2.id) FILTER (WHERE o2.status IN ('confirmed','preparing')) AS active_orders
    FROM delivery_boys db
    LEFT JOIN orders o2 ON o2.delivery_boy_id = db.id
      AND o2.status IN ('confirmed', 'preparing', 'out_for_delivery')
    WHERE db.is_online = true
      AND db.status = 'approved'
      AND NOT EXISTS (
        SELECT 1 FROM orders
        WHERE delivery_boy_id = db.id AND status = 'out_for_delivery'
      )
      AND NOT EXISTS (
        SELECT 1 FROM order_rejections r
        WHERE r.order_id = ${orderId} AND r.delivery_boy_id = db.id
      )
    GROUP BY db.id, db.name, db.per_km_earning
    ORDER BY active_orders ASC, RANDOM()
    LIMIT 1
  `.catch(() => [])

  if (!eligibleBoys.length) return null

  const nextBoy = eligibleBoys[0]
  const perKm    = parseFloat(nextBoy.per_km_earning || 0)
  const distKm   = orderInfo.distance_km ? parseFloat(orderInfo.distance_km) : null
  const boyPayout = perKm > 0 ? perKm * (distKm ?? 3) : null

  const assigned = await sql`
    UPDATE orders
    SET delivery_boy_id = ${nextBoy.id}, boy_payout = ${boyPayout},
        boy_accepted_at = NULL, boy_assigned_at = NOW()
    WHERE id = ${orderId} AND delivery_boy_id IS NULL
    RETURNING id
  `.catch(() => [])

  if (!assigned.length) return null  // race: another poller already assigned

  sendPushToUser(String(nextBoy.id), {
    title: '📦 Naya Order Assign Hua!',
    body:  `#${orderInfo.order_number} — ₹${Math.round(orderInfo.total)} · Jaldi accept ya reject karo`,
    url:   '/delivery',
    tag:   `delivery-${orderId}`,
    requireInteraction: true,
  }, 'delivery').catch(() => {})

  return nextBoy
}

export async function POST(request) {
  const sql   = getDb()
  const token = request.cookies.get('ck_token')?.value
  const user  = verifyToken(token)

  if (!user || user.role !== 'delivery') {
    return NextResponse.json({ error: 'Delivery boy login required' }, { status: 401 })
  }

  const { orderId, action } = await request.json()
  if (!orderId || !['accept', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'orderId and action (accept|reject) required' }, { status: 400 })
  }

  // Ensure schema
  await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS boy_accepted_at TIMESTAMPTZ`.catch(() => {})
  await sql`
    CREATE TABLE IF NOT EXISTS order_rejections (
      id               SERIAL PRIMARY KEY,
      order_id         UUID NOT NULL,
      delivery_boy_id  UUID NOT NULL,
      created_at       TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(order_id, delivery_boy_id)
    )
  `.catch(() => {})

  // ── ACCEPT ──────────────────────────────────────────────────────────
  if (action === 'accept') {
    const updated = await sql`
      UPDATE orders
      SET boy_accepted_at = NOW()
      WHERE id              = ${orderId}
        AND delivery_boy_id = ${user.id}
        AND boy_accepted_at IS NULL
        AND status          = 'pending'
      RETURNING id, order_number
    `
    if (!updated.length) {
      return NextResponse.json({ success: false, reason: 'already_accepted_or_not_yours' })
    }
    return NextResponse.json({
      success: true,
      action: 'accepted',
      orderNumber: updated[0].order_number,
    })
  }

  // ── REJECT ──────────────────────────────────────────────────────────
  // Fetch current order — must be assigned to this boy, not yet accepted
  const [current] = await sql`
    SELECT id, order_number, boy_accepted_at, status,
           distance_km, total, delivery_address
    FROM orders
    WHERE id = ${orderId} AND delivery_boy_id = ${user.id}
  `
  if (!current)               return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (current.boy_accepted_at) return NextResponse.json({ success: false, reason: 'already_accepted' })

  // Record rejection so this boy won't get it again
  await sql`
    INSERT INTO order_rejections (order_id, delivery_boy_id)
    VALUES (${orderId}, ${user.id})
    ON CONFLICT DO NOTHING
  `

  // Atomically clear assignment (only if still ours & not accepted)
  const cleared = await sql`
    UPDATE orders
    SET delivery_boy_id = NULL, boy_payout = NULL
    WHERE id              = ${orderId}
      AND delivery_boy_id = ${user.id}
      AND boy_accepted_at IS NULL
    RETURNING id
  `
  if (!cleared.length) {
    return NextResponse.json({ success: true, action: 'rejected' }) // already gone
  }

  // Find & assign next eligible boy
  const nextBoy = await reassignOrder(sql, orderId, current)

  return NextResponse.json({
    success:    true,
    action:     'rejected',
    reassigned: !!nextBoy,
    nextBoy:    nextBoy?.name || null,
  })
}

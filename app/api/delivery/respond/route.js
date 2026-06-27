export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { sendPushToUser } from '@/lib/push'
import { getBoyPayout } from '@/lib/utils'
import { sendFcmToTokens } from '@/lib/fcm'

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
  // Centralized payout (Kitchen Settings: min + per-km from kitchen) — same for all boys.
  const boyPayout = await getBoyPayout(orderInfo.distance_km)

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

  // ── ACCEPT (claim an OPEN order — first boy to accept wins) ──────────
  if (action === 'accept') {
    const [ord] = await sql`SELECT distance_km, delivery_boy_id, status FROM orders WHERE id = ${orderId}`.catch(() => [])
    if (!ord) return NextResponse.json({ success: false, reason: 'order_not_found' })
    if (['delivered', 'cancelled'].includes(ord.status)) return NextResponse.json({ success: false, reason: 'order_closed' })
    if (ord.delivery_boy_id && String(ord.delivery_boy_id) === String(user.id)) {
      return NextResponse.json({ success: true, action: 'accepted' }) // already mine
    }
    const boyPayout = await getBoyPayout(ord.distance_km)
    const claimed = await sql`
      UPDATE orders
      SET delivery_boy_id = ${user.id}, boy_accepted_at = NOW(), boy_assigned_at = NOW(), boy_payout = ${boyPayout}
      WHERE id              = ${orderId}
        AND delivery_boy_id IS NULL
        AND status NOT IN ('delivered', 'cancelled')
      RETURNING id, order_number
    `
    if (!claimed.length) {
      return NextResponse.json({ success: false, reason: 'already_taken' }) // someone else got it first
    }
    return NextResponse.json({ success: true, action: 'accepted', orderNumber: claimed[0].order_number })
  }

  // ── REJECT (broadcast model) ────────────────────────────────────────
  // Hide this order from MY feed. If I had already claimed it (and not yet
  // out for delivery), release it back to OPEN and re-ring all other online boys.
  await sql`
    INSERT INTO order_rejections (order_id, delivery_boy_id)
    VALUES (${orderId}, ${user.id})
    ON CONFLICT DO NOTHING
  `.catch(() => {})

  const [cur] = await sql`
    SELECT order_number, total, distance_km, delivery_boy_id, status
    FROM orders WHERE id = ${orderId}
  `.catch(() => [])

  if (cur && String(cur.delivery_boy_id) === String(user.id)
      && !['out_for_delivery', 'delivered', 'cancelled'].includes(cur.status)) {
    const released = await sql`
      UPDATE orders SET delivery_boy_id = NULL, boy_accepted_at = NULL, boy_payout = NULL
      WHERE id = ${orderId} AND delivery_boy_id = ${user.id}
      RETURNING id
    `.catch(() => [])
    if (released.length) {
      try {
        const others = await sql`
          SELECT id, fcm_token FROM delivery_boys
          WHERE is_online = true AND status = 'approved' AND id != ${user.id}
            AND NOT EXISTS (SELECT 1 FROM order_rejections r WHERE r.order_id = ${orderId} AND r.delivery_boy_id = delivery_boys.id)
        `
        const distTxt = cur.distance_km ? `${Math.round(parseFloat(cur.distance_km) * 10) / 10} km` : ''
        const title = '🔔 Order phir se available! Accept karo'
        const body  = `#${cur.order_number} — ₹${Math.round(cur.total)}${distTxt ? ' · ' + distTxt : ''} · App kholo`
        for (const b of others) {
          sendPushToUser(String(b.id), { title, body, url: '/delivery', tag: `new-order-${orderId}`, requireInteraction: true }, 'delivery').catch(() => {})
        }
        sendFcmToTokens(others.map(b => b.fcm_token), { title, body, orderId, tag: `new-order-${orderId}` }).catch(() => {})
      } catch {}
    }
  }

  return NextResponse.json({ success: true, action: 'rejected' })
}

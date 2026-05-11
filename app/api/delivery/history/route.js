export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { verifyToken } from '@/lib/auth'

export async function GET(request) {
  const sql = getDb()
  const token = request.cookies.get('ck_token')?.value
  const user = verifyToken(token)

  if (!user || user.role !== 'delivery') {
    return NextResponse.json({ error: 'Delivery boy login required' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const period = searchParams.get('period') || 'today' // today | week | month | all

  let orders, stats

  if (period === 'today') {
    orders = await sql`
      SELECT o.id, o.order_number, o.delivery_address, o.total,
        o.delivery_charge, o.distance_km, o.status, o.created_at, o.delivered_at,
        u.name as customer_name, u.phone as customer_phone,
        COALESCE(o.boy_payout, ROUND(db.per_km_earning * COALESCE(o.distance_km, 3), 2)) as earned
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      JOIN delivery_boys db ON db.id = o.delivery_boy_id
      WHERE o.delivery_boy_id = ${user.id} AND o.status = 'delivered'
        AND o.created_at::date = CURRENT_DATE
      ORDER BY o.delivered_at DESC
    `
    ;[stats] = await sql`
      SELECT COUNT(*) as total_deliveries,
        COALESCE(SUM(COALESCE(o.boy_payout, ROUND(db.per_km_earning * COALESCE(o.distance_km, 3), 2))), 0) as total_earned,
        COALESCE(AVG(o.delivery_charge), 0) as avg_delivery_charge
      FROM orders o
      JOIN delivery_boys db ON db.id = o.delivery_boy_id
      WHERE o.delivery_boy_id = ${user.id} AND o.status = 'delivered'
        AND o.created_at::date = CURRENT_DATE
    `
  } else if (period === 'week') {
    orders = await sql`
      SELECT o.id, o.order_number, o.delivery_address, o.total,
        o.delivery_charge, o.distance_km, o.status, o.created_at, o.delivered_at,
        u.name as customer_name, u.phone as customer_phone,
        COALESCE(o.boy_payout, ROUND(db.per_km_earning * COALESCE(o.distance_km, 3), 2)) as earned
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      JOIN delivery_boys db ON db.id = o.delivery_boy_id
      WHERE o.delivery_boy_id = ${user.id} AND o.status = 'delivered'
        AND o.created_at >= NOW() - INTERVAL '7 days'
      ORDER BY o.delivered_at DESC
    `
    ;[stats] = await sql`
      SELECT COUNT(*) as total_deliveries,
        COALESCE(SUM(COALESCE(o.boy_payout, ROUND(db.per_km_earning * COALESCE(o.distance_km, 3), 2))), 0) as total_earned,
        COALESCE(AVG(o.delivery_charge), 0) as avg_delivery_charge
      FROM orders o
      JOIN delivery_boys db ON db.id = o.delivery_boy_id
      WHERE o.delivery_boy_id = ${user.id} AND o.status = 'delivered'
        AND o.created_at >= NOW() - INTERVAL '7 days'
    `
  } else if (period === 'month') {
    orders = await sql`
      SELECT o.id, o.order_number, o.delivery_address, o.total,
        o.delivery_charge, o.distance_km, o.status, o.created_at, o.delivered_at,
        u.name as customer_name, u.phone as customer_phone,
        COALESCE(o.boy_payout, ROUND(db.per_km_earning * COALESCE(o.distance_km, 3), 2)) as earned
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      JOIN delivery_boys db ON db.id = o.delivery_boy_id
      WHERE o.delivery_boy_id = ${user.id} AND o.status = 'delivered'
        AND o.created_at >= NOW() - INTERVAL '30 days'
      ORDER BY o.delivered_at DESC
    `
    ;[stats] = await sql`
      SELECT COUNT(*) as total_deliveries,
        COALESCE(SUM(COALESCE(o.boy_payout, ROUND(db.per_km_earning * COALESCE(o.distance_km, 3), 2))), 0) as total_earned,
        COALESCE(AVG(o.delivery_charge), 0) as avg_delivery_charge
      FROM orders o
      JOIN delivery_boys db ON db.id = o.delivery_boy_id
      WHERE o.delivery_boy_id = ${user.id} AND o.status = 'delivered'
        AND o.created_at >= NOW() - INTERVAL '30 days'
    `
  } else {
    orders = await sql`
      SELECT o.id, o.order_number, o.delivery_address, o.total,
        o.delivery_charge, o.distance_km, o.status, o.created_at, o.delivered_at,
        u.name as customer_name, u.phone as customer_phone,
        COALESCE(o.boy_payout, ROUND(db.per_km_earning * COALESCE(o.distance_km, 3), 2)) as earned
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      JOIN delivery_boys db ON db.id = o.delivery_boy_id
      WHERE o.delivery_boy_id = ${user.id} AND o.status = 'delivered'
      ORDER BY o.delivered_at DESC
    `
    ;[stats] = await sql`
      SELECT COUNT(*) as total_deliveries,
        COALESCE(SUM(COALESCE(o.boy_payout, ROUND(db.per_km_earning * COALESCE(o.distance_km, 3), 2))), 0) as total_earned,
        COALESCE(AVG(o.delivery_charge), 0) as avg_delivery_charge
      FROM orders o
      JOIN delivery_boys db ON db.id = o.delivery_boy_id
      WHERE o.delivery_boy_id = ${user.id} AND o.status = 'delivered'
    `
  }

  const [boyInfo] = await sql`
    SELECT name, phone, vehicle_number, rating, total_earnings, is_online, per_km_earning,
           COALESCE(payment_due, 0) as payment_due,
           COALESCE(total_paid, 0)  as total_paid
    FROM delivery_boys WHERE id = ${user.id}
  `

  // Live recalculate total earnings from orders using per_km_earning * distance_km (source of truth)
  const [liveCalc] = await sql`
    SELECT
      COALESCE(SUM(COALESCE(o.boy_payout, ROUND(db.per_km_earning * COALESCE(o.distance_km, 3), 2))), 0) as live_total_earned,
      COUNT(*) as live_total_deliveries
    FROM orders o
    JOIN delivery_boys db ON db.id = o.delivery_boy_id
    WHERE o.delivery_boy_id = ${user.id} AND o.status = 'delivered'
  `

  // If stored total_earnings drifted from live calc — auto-correct it
  const liveEarned = parseFloat(liveCalc?.live_total_earned || 0)
  const storedEarned = parseFloat(boyInfo?.total_earnings || 0)
  if (Math.abs(liveEarned - storedEarned) > 0.5) {
    // Recalculate payment_due = live_earned - total_paid
    const totalPaid = parseFloat(boyInfo?.total_paid || 0)
    const correctedDue = Math.max(0, liveEarned - totalPaid)
    await sql`
      UPDATE delivery_boys
      SET total_earnings = ${liveEarned},
          payment_due    = ${correctedDue}
      WHERE id = ${user.id}
    `.catch(() => {})
    if (boyInfo) {
      boyInfo.total_earnings = liveEarned
      boyInfo.payment_due = correctedDue
    }
  }

  // Payment history (last 10)
  let paymentHistory = []
  try {
    paymentHistory = await sql`
      SELECT amount, notes, created_at FROM payment_records
      WHERE delivery_boy_id = ${user.id}
      ORDER BY created_at DESC LIMIT 10
    `
  } catch (e) {}

  return NextResponse.json({
    orders, stats, boyInfo, paymentHistory,
    allTime: {
      total_earned: parseFloat(liveCalc?.live_total_earned || 0),
      total_deliveries: parseInt(liveCalc?.live_total_deliveries || 0),
    }
  })
}

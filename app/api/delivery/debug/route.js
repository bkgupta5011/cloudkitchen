export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { verifyToken } from '@/lib/auth'

export async function GET(request) {
  const sql = getDb()
  const token = request.cookies.get('ck_token')?.value
  const user = verifyToken(token)

  if (!user || user.role !== 'delivery') {
    return NextResponse.json({ error: 'Delivery login required' }, { status: 401 })
  }

  try {
    // Show user id from JWT
    const jwtInfo = { userId: user.id, role: user.role, name: user.name }

    // Check DB timezone
    const [tz] = await sql`SELECT current_setting('TIMEZONE') as db_tz, CURRENT_DATE as cur_date, NOW() as now_ts`

    // Check delivery_boys row
    const [boy] = await sql`SELECT id, name, total_earnings, payment_due, total_paid, per_km_earning FROM delivery_boys WHERE id = ${user.id}`

    // Check orders for this boy
    const orders = await sql`SELECT id, order_number, status, boy_payout, distance_km, delivery_boy_id, created_at, delivered_at FROM orders WHERE delivery_boy_id = ${user.id}`

    // Run liveCalc
    const [liveCalc] = await sql`
      SELECT COALESCE(SUM(COALESCE(o.boy_payout, ROUND(db.per_km_earning * COALESCE(o.distance_km, 3), 2))), 0) as live_earned,
             COUNT(*) as total_count
      FROM orders o
      JOIN delivery_boys db ON db.id = o.delivery_boy_id
      WHERE o.delivery_boy_id = ${user.id} AND o.status = 'delivered'
    `

    // Run today's stats
    const [todayStats] = await sql`
      SELECT COUNT(*) as total_deliveries,
        COALESCE(SUM(COALESCE(o.boy_payout, ROUND(db.per_km_earning * COALESCE(o.distance_km, 3), 2))), 0) as total_earned
      FROM orders o
      JOIN delivery_boys db ON db.id = o.delivery_boy_id
      WHERE o.delivery_boy_id = ${user.id} AND o.status = 'delivered'
        AND o.created_at::date = CURRENT_DATE
    `

    // Today using IST explicit
    const [todayIST] = await sql`
      SELECT COUNT(*) as total_deliveries,
        COALESCE(SUM(COALESCE(o.boy_payout, ROUND(db.per_km_earning * COALESCE(o.distance_km, 3), 2))), 0) as total_earned
      FROM orders o
      JOIN delivery_boys db ON db.id = o.delivery_boy_id
      WHERE o.delivery_boy_id = ${user.id} AND o.status = 'delivered'
        AND (o.created_at AT TIME ZONE 'Asia/Kolkata')::date = (NOW() AT TIME ZONE 'Asia/Kolkata')::date
    `

    return NextResponse.json({
      jwtInfo,
      dbTimezone: tz,
      deliveryBoy: boy,
      orders,
      liveCalc,
      todayStats,
      todayISTStats: todayIST,
    })
  } catch (e) {
    return NextResponse.json({ error: e.message, stack: e.stack }, { status: 500 })
  }
}

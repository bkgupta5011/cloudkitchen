export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { verifyToken } from '@/lib/auth'

// Fallback earnings: boy_payout stored at delivery time → else 70% of delivery_charge
const EARNED_EXPR = `COALESCE(o.boy_payout, GREATEST(0, o.delivery_charge * 0.7))`
const EARNED_EXPR_NO_ALIAS = `COALESCE(boy_payout, GREATEST(0, delivery_charge * 0.7))`

// IST "today" filter (India is UTC+5:30)
const IST_TODAY = `(o.created_at AT TIME ZONE 'Asia/Kolkata')::date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date`

export async function GET(request) {
  const sql = getDb()
  const token = request.cookies.get('ck_token')?.value
  const user = verifyToken(token)

  if (!user || user.role !== 'delivery') {
    return NextResponse.json({ error: 'Delivery boy login required' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const period = searchParams.get('period') || 'today'

  let orders, stats

  if (period === 'today') {
    orders = await sql`
      SELECT o.id, o.order_number, o.delivery_address, o.total,
        o.delivery_charge, o.distance_km, o.status, o.created_at, o.delivered_at,
        u.name as customer_name, u.phone as customer_phone,
        COALESCE(o.boy_payout, GREATEST(0, o.delivery_charge * 0.7)) as earned
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.delivery_boy_id = ${user.id} AND o.status = 'delivered'
        AND (o.created_at AT TIME ZONE 'Asia/Kolkata')::date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date
      ORDER BY o.delivered_at DESC
    `
    ;[stats] = await sql`
      SELECT COUNT(*) as total_deliveries,
        COALESCE(SUM(COALESCE(boy_payout, GREATEST(0, delivery_charge * 0.7))), 0) as total_earned,
        COALESCE(AVG(delivery_charge), 0) as avg_delivery_charge
      FROM orders
      WHERE delivery_boy_id = ${user.id} AND status = 'delivered'
        AND (created_at AT TIME ZONE 'Asia/Kolkata')::date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date
    `
  } else if (period === 'week') {
    orders = await sql`
      SELECT o.id, o.order_number, o.delivery_address, o.total,
        o.delivery_charge, o.distance_km, o.status, o.created_at, o.delivered_at,
        u.name as customer_name, u.phone as customer_phone,
        COALESCE(o.boy_payout, GREATEST(0, o.delivery_charge * 0.7)) as earned
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.delivery_boy_id = ${user.id} AND o.status = 'delivered'
        AND o.created_at >= NOW() - INTERVAL '7 days'
      ORDER BY o.delivered_at DESC
    `
    ;[stats] = await sql`
      SELECT COUNT(*) as total_deliveries,
        COALESCE(SUM(COALESCE(boy_payout, GREATEST(0, delivery_charge * 0.7))), 0) as total_earned,
        COALESCE(AVG(delivery_charge), 0) as avg_delivery_charge
      FROM orders
      WHERE delivery_boy_id = ${user.id} AND status = 'delivered'
        AND created_at >= NOW() - INTERVAL '7 days'
    `
  } else if (period === 'month') {
    orders = await sql`
      SELECT o.id, o.order_number, o.delivery_address, o.total,
        o.delivery_charge, o.distance_km, o.status, o.created_at, o.delivered_at,
        u.name as customer_name, u.phone as customer_phone,
        COALESCE(o.boy_payout, GREATEST(0, o.delivery_charge * 0.7)) as earned
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.delivery_boy_id = ${user.id} AND o.status = 'delivered'
        AND o.created_at >= NOW() - INTERVAL '30 days'
      ORDER BY o.delivered_at DESC
    `
    ;[stats] = await sql`
      SELECT COUNT(*) as total_deliveries,
        COALESCE(SUM(COALESCE(boy_payout, GREATEST(0, delivery_charge * 0.7))), 0) as total_earned,
        COALESCE(AVG(delivery_charge), 0) as avg_delivery_charge
      FROM orders
      WHERE delivery_boy_id = ${user.id} AND status = 'delivered'
        AND created_at >= NOW() - INTERVAL '30 days'
    `
  } else {
    orders = await sql`
      SELECT o.id, o.order_number, o.delivery_address, o.total,
        o.delivery_charge, o.distance_km, o.status, o.created_at, o.delivered_at,
        u.name as customer_name, u.phone as customer_phone,
        COALESCE(o.boy_payout, GREATEST(0, o.delivery_charge * 0.7)) as earned
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.delivery_boy_id = ${user.id} AND o.status = 'delivered'
      ORDER BY o.delivered_at DESC
    `
    ;[stats] = await sql`
      SELECT COUNT(*) as total_deliveries,
        COALESCE(SUM(COALESCE(boy_payout, GREATEST(0, delivery_charge * 0.7))), 0) as total_earned,
        COALESCE(AVG(delivery_charge), 0) as avg_delivery_charge
      FROM orders
      WHERE delivery_boy_id = ${user.id} AND status = 'delivered'
    `
  }

  const [boyInfo] = await sql`
    SELECT name, phone, vehicle_number, rating, total_earnings, is_online, per_km_earning,
           COALESCE(payment_due, 0) as payment_due,
           COALESCE(total_paid, 0)  as total_paid
    FROM delivery_boys WHERE id = ${user.id}
  `

  // Live recalculate total earnings from all delivered orders — using fallback for NULL boy_payout
  const [liveCalc] = await sql`
    SELECT
      COALESCE(SUM(COALESCE(boy_payout, GREATEST(0, delivery_charge * 0.7))), 0) as live_total_earned,
      COUNT(*) as live_total_deliveries
    FROM orders
    WHERE delivery_boy_id = ${user.id} AND status = 'delivered'
  `

  // Auto-correct delivery_boys.total_earnings if it drifted from live orders sum
  const liveEarned  = parseFloat(liveCalc?.live_total_earned || 0)
  const storedEarned = parseFloat(boyInfo?.total_earnings || 0)
  if (liveEarned > 0 && Math.abs(liveEarned - storedEarned) > 0.5) {
    const totalPaid    = parseFloat(boyInfo?.total_paid || 0)
    const correctedDue = Math.max(0, liveEarned - totalPaid)
    await sql`
      UPDATE delivery_boys
      SET total_earnings = ${liveEarned},
          payment_due    = ${correctedDue}
      WHERE id = ${user.id}
    `.catch(() => {})
    if (boyInfo) {
      boyInfo.total_earnings = liveEarned
      boyInfo.payment_due    = correctedDue
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
  } catch {}

  const response = NextResponse.json({
    orders, stats, boyInfo, paymentHistory,
    allTime: {
      total_earned:      parseFloat(liveCalc?.live_total_earned || 0),
      total_deliveries:  parseInt(liveCalc?.live_total_deliveries || 0),
    }
  })
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
  response.headers.set('Pragma', 'no-cache')
  return response
}

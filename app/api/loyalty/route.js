export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { verifyToken } from '@/lib/auth'

// Customer loyalty progress: how many delivered orders, how many more until the
// next ₹X reward, and whether a reward is already available to use.
export async function GET(request) {
  const token = request.cookies.get('ck_token')?.value
  const user = token ? verifyToken(token) : null
  if (!user || user.role !== 'customer') {
    return NextResponse.json({ enabled: false })
  }
  const sql = getDb()
  try {
    const [s] = await sql`SELECT loyalty_enabled, loyalty_threshold, loyalty_reward FROM kitchen_settings WHERE id = 1`
    if (!s?.loyalty_enabled) return NextResponse.json({ enabled: false })
    const threshold = parseInt(s.loyalty_threshold) || 5
    const reward    = parseInt(s.loyalty_reward) || 50

    const [c] = await sql`SELECT COUNT(*)::int AS count FROM orders WHERE user_id = ${user.id} AND status = 'delivered'`
    const delivered = c?.count || 0

    let available = 0
    try {
      const [a] = await sql`SELECT COALESCE(SUM(amount),0)::int AS amt FROM review_rewards WHERE customer_id = ${user.id} AND status = 'available'`
      available = a?.amt || 0
    } catch {}

    const inCycle   = threshold > 0 ? (delivered % threshold) : 0
    const ordersToGo = threshold > 0 ? (threshold - inCycle) : 0

    return NextResponse.json({
      enabled: true,
      threshold, reward,
      delivered,
      progress: inCycle,        // orders done in the current cycle (0..threshold-1)
      ordersToGo,               // orders left until the next reward
      availableReward: available, // ₹ already unlocked & waiting to auto-apply
    })
  } catch {
    return NextResponse.json({ enabled: false })
  }
}

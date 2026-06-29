export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { reconcileLoyalty, getLoyaltyStatus } from '@/lib/loyalty'

// Customer loyalty progress: stamps collected (= delivered orders in the current
// cycle), how many more until the next ₹X reward, and whether a reward is ready.
export async function GET(request) {
  const token = request.cookies.get('ck_token')?.value
  const user = token ? verifyToken(token) : null
  if (!user || user.role !== 'customer') {
    return NextResponse.json({ enabled: false })
  }
  const sql = getDb()
  try {
    // Self-healing: grant any reward already earned, then report the real status.
    await reconcileLoyalty(sql, user.id)
    const status = await getLoyaltyStatus(sql, user.id)
    if (!status.enabled) return NextResponse.json({ enabled: false })
    return NextResponse.json({
      enabled: true,
      threshold: status.threshold,
      reward: status.reward,
      minOrder: status.minOrder,
      delivered: status.delivered,
      progress: status.stamps,            // stamps in the current cycle (real deliveries)
      ordersToGo: status.ordersToGo,
      availableReward: status.availableReward,
    })
  } catch {
    return NextResponse.json({ enabled: false })
  }
}

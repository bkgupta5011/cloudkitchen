import { getDb } from './db'

// review_rewards is created lazily by the ratings route; ensure it exists here
// too so the loyalty grant never fails just because no one has rated yet.
async function ensureRewardsTable(sql) {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS review_rewards (
        id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        customer_id     UUID NOT NULL,
        source_order_id UUID NOT NULL UNIQUE,
        amount          INT  NOT NULL,
        status          VARCHAR(12) NOT NULL DEFAULT 'available',
        used_order_id   UUID,
        created_at      TIMESTAMP DEFAULT NOW(),
        used_at         TIMESTAMP
      )
    `
    await sql`ALTER TABLE review_rewards ADD COLUMN IF NOT EXISTS source VARCHAR(12) DEFAULT 'review'`
  } catch {}
}

async function loyaltyConfig(sql) {
  try {
    const [s] = await sql`SELECT loyalty_enabled, loyalty_threshold, loyalty_reward FROM kitchen_settings WHERE id = 1`
    if (!s?.loyalty_enabled) return null
    const threshold = parseInt(s.loyalty_threshold) || 5
    const reward    = parseInt(s.loyalty_reward) || 50
    if (threshold <= 0 || reward <= 0) return null
    return { threshold, reward }
  } catch { return null }
}

// Self-healing loyalty grant. A customer earns one ₹reward for every `threshold`
// DELIVERED orders. Idempotent + retroactive. Keeps at most ONE reward pending
// (redeem before earning the next). Returns { granted, reward } — granted=true
// when this call actually created a new reward (used to fire the notification).
export async function reconcileLoyalty(sql, userId) {
  if (!userId) return { granted: false }
  try {
    const cfg = await loyaltyConfig(sql)
    if (!cfg) return { granted: false }
    const { threshold, reward } = cfg
    await ensureRewardsTable(sql)

    const [d] = await sql`SELECT COUNT(*)::int AS c FROM orders WHERE user_id = ${userId} AND status = 'delivered'`
    const delivered = d?.c || 0
    const expected = Math.floor(delivered / threshold)   // total rewards earned so far
    if (expected <= 0) return { granted: false }

    const [e] = await sql`SELECT COUNT(*)::int AS c FROM review_rewards WHERE customer_id = ${userId} AND source = 'loyalty'`
    const given = e?.c || 0
    if (expected <= given) return { granted: false }     // nothing newly earned

    // At most ONE reward pending at a time (no ₹2×reward stacking).
    const [av] = await sql`SELECT COUNT(*)::int AS c FROM review_rewards WHERE customer_id = ${userId} AND source = 'loyalty' AND status = 'available'`
    if ((av?.c || 0) > 0) return { granted: false }

    // Attach the reward to a delivered order not already used as a reward source.
    const [o] = await sql`
      SELECT id FROM orders
      WHERE user_id = ${userId} AND status = 'delivered'
        AND id NOT IN (SELECT source_order_id FROM review_rewards WHERE customer_id = ${userId})
      ORDER BY delivered_at DESC NULLS LAST
      LIMIT 1
    `
    if (!o) return { granted: false }
    const [ins] = await sql`
      INSERT INTO review_rewards (customer_id, source_order_id, amount, source)
      VALUES (${userId}, ${o.id}, ${reward}, 'loyalty')
      ON CONFLICT (source_order_id) DO NOTHING
      RETURNING id
    `
    return { granted: !!ins, reward }
  } catch { return { granted: false } }
}

// Current loyalty status for a customer. `stamps` is tied to ACTUAL delivered
// orders in the in-progress cycle (delivered − redeemed cycles), never inflated
// just because a reward is sitting available.
export async function getLoyaltyStatus(sql, userId) {
  const cfg = await loyaltyConfig(sql)
  if (!cfg || !userId) return { enabled: false }
  const { threshold, reward } = cfg
  try {
    await ensureRewardsTable(sql)
    const [d] = await sql`SELECT COUNT(*)::int AS c FROM orders WHERE user_id = ${userId} AND status = 'delivered'`
    const delivered = d?.c || 0
    const [u] = await sql`SELECT COUNT(*)::int AS c FROM review_rewards WHERE customer_id = ${userId} AND source = 'loyalty' AND status = 'used'`
    const usedCycles = u?.c || 0
    const [a] = await sql`SELECT amount FROM review_rewards WHERE customer_id = ${userId} AND status = 'available' ORDER BY created_at ASC LIMIT 1`
    const availableReward = a?.amount || 0

    // Stamps earned in the current cycle, clamped to [0, threshold].
    let stamps = delivered - usedCycles * threshold
    if (stamps < 0) stamps = 0
    if (stamps > threshold) stamps = threshold
    const ready = availableReward > 0
    const ordersToGo = ready ? 0 : Math.max(0, threshold - stamps)

    return { enabled: true, threshold, reward, delivered, stamps, ready, ordersToGo, availableReward }
  } catch {
    return { enabled: true, threshold, reward, delivered: 0, stamps: 0, ready: false, ordersToGo: threshold, availableReward: 0 }
  }
}

// Build the friendly English notification shown to the customer after a delivery.
export function loyaltyNotification(status) {
  if (!status?.enabled) return null
  const { threshold, reward, stamps, ready, ordersToGo } = status
  if (ready) {
    return {
      title: '🎉 Loyalty reward unlocked!',
      body: `You collected all ${threshold} stamps — ₹${reward} off will apply automatically on your next order. Enjoy!`,
    }
  }
  return {
    title: `🎟️ Loyalty point earned — ${stamps}/${threshold}`,
    body: `Nice! You've collected ${stamps} of ${threshold} stamps. ${ordersToGo} more ${ordersToGo === 1 ? 'order' : 'orders'} to unlock ₹${reward} off your next order.`,
  }
}

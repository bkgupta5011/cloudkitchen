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

// Returns { threshold, reward, startedAt } when loyalty is ON, else null.
// startedAt = when the offer was switched on; only orders AFTER it count. If it's
// somehow missing while enabled, we set it to NOW() so counting starts fresh
// (never retroactively credits old orders).
async function loyaltyConfig(sql) {
  try {
    await sql`ALTER TABLE kitchen_settings ADD COLUMN IF NOT EXISTS loyalty_started_at TIMESTAMPTZ`.catch(() => {})
    const [s] = await sql`SELECT loyalty_enabled, loyalty_threshold, loyalty_reward, loyalty_min_order, loyalty_started_at FROM kitchen_settings WHERE id = 1`
    if (!s?.loyalty_enabled) return null
    const threshold = parseInt(s.loyalty_threshold) || 5
    const reward    = parseInt(s.loyalty_reward) || 50
    const minOrder  = parseInt(s.loyalty_min_order) || 0
    if (threshold <= 0 || reward <= 0) return null
    let startedAt = s.loyalty_started_at
    if (!startedAt) {
      const [u] = await sql`UPDATE kitchen_settings SET loyalty_started_at = NOW() WHERE id = 1 AND loyalty_started_at IS NULL RETURNING loyalty_started_at`
      startedAt = u?.loyalty_started_at || new Date()
    }
    return { threshold, reward, minOrder, startedAt }
  } catch { return null }
}

// Delivered orders the customer has placed SINCE the offer started.
async function deliveredSinceStart(sql, userId, startedAt) {
  const [d] = await sql`
    SELECT COUNT(*)::int AS c FROM orders
    WHERE user_id = ${userId} AND status = 'delivered' AND created_at >= ${startedAt}
  `
  return d?.c || 0
}

// Self-healing loyalty grant. One ₹reward per `threshold` delivered orders placed
// AFTER the offer started. Idempotent, one reward pending at a time. Returns
// { granted, reward } — granted=true when a new reward was created this call.
export async function reconcileLoyalty(sql, userId) {
  if (!userId) return { granted: false }
  try {
    const cfg = await loyaltyConfig(sql)
    if (!cfg) return { granted: false }
    const { threshold, reward, startedAt } = cfg
    await ensureRewardsTable(sql)

    const delivered = await deliveredSinceStart(sql, userId, startedAt)
    const expected = Math.floor(delivered / threshold)   // rewards earned this period
    if (expected <= 0) return { granted: false }

    // Rewards already granted in THIS loyalty period.
    const [e] = await sql`SELECT COUNT(*)::int AS c FROM review_rewards WHERE customer_id = ${userId} AND source = 'loyalty' AND created_at >= ${startedAt}`
    const given = e?.c || 0
    if (expected <= given) return { granted: false }

    // At most ONE reward pending at a time within this period (no stacking).
    const [av] = await sql`SELECT COUNT(*)::int AS c FROM review_rewards WHERE customer_id = ${userId} AND source = 'loyalty' AND status = 'available' AND created_at >= ${startedAt}`
    if ((av?.c || 0) > 0) return { granted: false }

    // Attach to a delivered order (after start) not already used as a reward source.
    const [o] = await sql`
      SELECT id FROM orders
      WHERE user_id = ${userId} AND status = 'delivered' AND created_at >= ${startedAt}
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

// Current loyalty status. `stamps` = delivered orders (since the offer started)
// in the in-progress cycle — one ✓ per delivery, resets after each reward.
export async function getLoyaltyStatus(sql, userId) {
  const cfg = await loyaltyConfig(sql)
  if (!cfg || !userId) return { enabled: false }
  const { threshold, reward, minOrder, startedAt } = cfg
  try {
    await ensureRewardsTable(sql)
    const delivered = await deliveredSinceStart(sql, userId, startedAt)
    const [u] = await sql`SELECT COUNT(*)::int AS c FROM review_rewards WHERE customer_id = ${userId} AND source = 'loyalty' AND status = 'used' AND created_at >= ${startedAt}`
    const usedCycles = u?.c || 0
    const [a] = await sql`SELECT amount FROM review_rewards WHERE customer_id = ${userId} AND source = 'loyalty' AND status = 'available' AND created_at >= ${startedAt} ORDER BY created_at ASC LIMIT 1`
    const availableReward = a?.amount || 0

    let stamps = delivered - usedCycles * threshold
    if (stamps < 0) stamps = 0
    if (stamps > threshold) stamps = threshold
    const ready = availableReward > 0
    const ordersToGo = ready ? 0 : Math.max(0, threshold - stamps)

    return { enabled: true, threshold, reward, minOrder, delivered, stamps, ready, ordersToGo, availableReward }
  } catch {
    return { enabled: true, threshold, reward, minOrder, delivered: 0, stamps: 0, ready: false, ordersToGo: threshold, availableReward: 0 }
  }
}

// Friendly English notification shown to the customer after a delivery.
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

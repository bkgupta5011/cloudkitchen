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

// Self-healing loyalty: grant any rewards the customer has earned but not yet
// received. Idempotent — safe to call on every delivery AND on every read, and
// it retroactively fixes orders delivered before the feature existed.
// A customer earns one ₹reward for every `threshold` DELIVERED orders.
export async function reconcileLoyalty(sql, userId) {
  if (!userId) return
  try {
    const [s] = await sql`SELECT loyalty_enabled, loyalty_threshold, loyalty_reward FROM kitchen_settings WHERE id = 1`
    if (!s?.loyalty_enabled) return
    const threshold = parseInt(s.loyalty_threshold) || 5
    const reward    = parseInt(s.loyalty_reward) || 50
    if (threshold <= 0 || reward <= 0) return

    await ensureRewardsTable(sql)

    const [d] = await sql`SELECT COUNT(*)::int AS c FROM orders WHERE user_id = ${userId} AND status = 'delivered'`
    const delivered = d?.c || 0
    const expected = Math.floor(delivered / threshold)   // total rewards earned so far
    if (expected <= 0) return

    const [e] = await sql`SELECT COUNT(*)::int AS c FROM review_rewards WHERE customer_id = ${userId} AND source = 'loyalty'`
    const existing = e?.c || 0
    const need = expected - existing
    if (need <= 0) return

    // Attach each new reward to a delivered order not already used as a reward
    // source (source_order_id is UNIQUE), so we never collide.
    const orders = await sql`
      SELECT id FROM orders
      WHERE user_id = ${userId} AND status = 'delivered'
        AND id NOT IN (SELECT source_order_id FROM review_rewards WHERE customer_id = ${userId})
      ORDER BY delivered_at DESC NULLS LAST
      LIMIT ${need}
    `
    for (const o of orders) {
      await sql`
        INSERT INTO review_rewards (customer_id, source_order_id, amount, source)
        VALUES (${userId}, ${o.id}, ${reward}, 'loyalty')
        ON CONFLICT (source_order_id) DO NOTHING
      `
    }
  } catch {}
}

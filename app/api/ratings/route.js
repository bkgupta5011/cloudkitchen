export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { reconcileLoyalty } from '@/lib/loyalty'

async function ensureRatingsTable(sql) {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS order_ratings (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        order_id UUID NOT NULL UNIQUE,
        customer_id UUID NOT NULL,
        rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
        comment TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `
  } catch (e) {}
}

// Review rewards: a one-time discount a customer earns by reviewing a delivered
// order, auto-applied to a later order. UNIQUE(source_order_id) => one reward
// per reviewed order (re-editing a review never mints a second reward).
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
  } catch (e) {}
}

// GET — check if order already rated | per-item averages (public) | admin stats
export async function GET(request) {
  const sql = getDb()
  await ensureRatingsTable(sql)
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')

  // PUBLIC: per menu-item average ratings (used on menu page for all visitors)
  if (type === 'menu') {
    const rows = await sql`
      SELECT
        oi.menu_item_id,
        ROUND(AVG(r.rating)::numeric, 1) as avg_rating,
        COUNT(r.id) as count
      FROM order_ratings r
      JOIN order_items oi ON oi.order_id = r.order_id
      WHERE oi.menu_item_id IS NOT NULL
      GROUP BY oi.menu_item_id
      HAVING COUNT(r.id) >= 1
    `
    const itemRatings = {}
    rows.forEach(row => {
      itemRatings[row.menu_item_id] = {
        avg: parseFloat(row.avg_rating),
        count: parseInt(row.count)
      }
    })
    return NextResponse.json({ itemRatings })
  }

  const token = request.cookies.get('ck_token')?.value
  const user = verifyToken(token)
  if (!user) return NextResponse.json({ error: 'Login required' }, { status: 401 })

  // Customer's available review reward + the reward config (used by cart to
  // show the auto-discount AND the "review to earn" popup after ordering)
  if (type === 'reward') {
    try {
      const [cfg] = await sql`SELECT review_reward_enabled, review_reward_amount, review_reward_min_order, loyalty_enabled, loyalty_min_order FROM kitchen_settings WHERE id = 1`
      const config = {
        enabled: !!cfg?.review_reward_enabled,
        amount: parseInt(cfg?.review_reward_amount) || 0,
        minOrder: parseInt(cfg?.review_reward_min_order) || 0,
      }
      // Show the auto-discount preview when EITHER review reward OR loyalty is on.
      const anyEnabled = cfg?.review_reward_enabled || cfg?.loyalty_enabled
      if (!anyEnabled) return NextResponse.json({ reward: null, config })
      await ensureRewardsTable(sql)
      // Grant any loyalty reward already earned, so the cart can preview it.
      await reconcileLoyalty(sql, user.id)
      const [r] = await sql`
        SELECT amount, source FROM review_rewards
        WHERE customer_id = ${user.id} AND status = 'available'
        ORDER BY created_at ASC LIMIT 1
      `
      // Loyalty rewards need their own min order to redeem; review rewards keep theirs.
      const loyaltyMin = parseInt(cfg?.loyalty_min_order) || 0
      const reward = r
        ? { amount: parseInt(r.amount), minOrder: r.source === 'loyalty' ? loyaltyMin : config.minOrder, source: r.source || 'review' }
        : null
      return NextResponse.json({ reward, config })
    } catch (e) {
      return NextResponse.json({ reward: null, config: { enabled: false, amount: 0, minOrder: 0 } })
    }
  }

  const orderId = searchParams.get('orderId')

  if (orderId) {
    const [rating] = await sql`SELECT * FROM order_ratings WHERE order_id = ${orderId}`
    return NextResponse.json({ rating: rating || null })
  }

  if (user.role === 'admin') {
    const [stats] = await sql`
      SELECT
        ROUND(AVG(rating)::numeric, 1) as avg_rating,
        COUNT(*) as total_ratings,
        COUNT(CASE WHEN rating = 5 THEN 1 END) as five_star,
        COUNT(CASE WHEN rating = 4 THEN 1 END) as four_star,
        COUNT(CASE WHEN rating = 3 THEN 1 END) as three_star,
        COUNT(CASE WHEN rating <= 2 THEN 1 END) as low_star
      FROM order_ratings
    `
    const recent = await sql`
      SELECT r.*, o.order_number, u.name as customer_name
      FROM order_ratings r
      JOIN orders o ON r.order_id = o.id
      JOIN users u ON r.customer_id = u.id
      ORDER BY r.created_at DESC
      LIMIT 20
    `
    return NextResponse.json({ stats, recent })
  }

  return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
}

// POST — customer submits rating for a delivered order
export async function POST(request) {
  const sql = getDb()
  const token = request.cookies.get('ck_token')?.value
  const user = verifyToken(token)
  if (!user || user.role !== 'customer') {
    return NextResponse.json({ error: 'Customer login required' }, { status: 401 })
  }

  await ensureRatingsTable(sql)
  const { orderId, rating, comment } = await request.json()

  if (!orderId || !rating || rating < 1 || rating > 5) {
    return NextResponse.json({ error: 'Valid order aur rating (1-5) chahiye' }, { status: 400 })
  }

  // Customer ka delivered order verify karo
  const [order] = await sql`
    SELECT * FROM orders WHERE id = ${orderId} AND user_id = ${user.id} AND status = 'delivered'
  `
  if (!order) return NextResponse.json({ error: 'Order nahi mila ya deliver nahi hua' }, { status: 404 })

  const [saved] = await sql`
    INSERT INTO order_ratings (order_id, customer_id, rating, comment)
    VALUES (${orderId}, ${user.id}, ${rating}, ${comment || null})
    ON CONFLICT (order_id) DO UPDATE SET rating = ${rating}, comment = ${comment || null}
    RETURNING *
  `

  // Mint a review reward (only if enabled in settings; one per reviewed order)
  let rewardEarned = null
  try {
    const [cfg] = await sql`SELECT review_reward_enabled, review_reward_amount FROM kitchen_settings WHERE id = 1`
    if (cfg?.review_reward_enabled && cfg?.review_reward_amount > 0) {
      await ensureRewardsTable(sql)
      const [r] = await sql`
        INSERT INTO review_rewards (customer_id, source_order_id, amount)
        VALUES (${user.id}, ${orderId}, ${cfg.review_reward_amount})
        ON CONFLICT (source_order_id) DO NOTHING
        RETURNING amount
      `
      if (r) rewardEarned = { amount: r.amount }   // null if this order already earned one
    }
  } catch (e) {}

  return NextResponse.json({ rating: saved, rewardEarned })
}

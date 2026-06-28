export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { checkAndUpdateKitchenSchedule } from '@/lib/schedule'
import { sendPushToUser } from '@/lib/push'

function adminOnly(request) {
  const token = request.cookies.get('ck_token')?.value
  const user = verifyToken(token)
  if (!user || user.role !== 'admin') return null
  return user
}

// Super admins have no branch_id. Branch admins are scoped to their own branch
// and must NOT be able to touch global settings or other branches.
function isSuperAdmin(user) {
  return !!user && user.role === 'admin' && !user.branch_id
}

// ── Ensure branches table + admin branch columns ────────────────
async function ensureBranchesTable(sql) {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS branches (
        id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        name             VARCHAR(255) NOT NULL,
        address          TEXT NOT NULL DEFAULT '',
        city             VARCHAR(100) DEFAULT '',
        phone            VARCHAR(20)  DEFAULT '',
        lat              DECIMAL(10,8),
        lng              DECIMAL(11,8),
        is_active        BOOLEAN DEFAULT true,
        opening_time     VARCHAR(5)   DEFAULT '09:00',
        closing_time     VARCHAR(5)   DEFAULT '22:00',
        max_delivery_km  DECIMAL(5,2) DEFAULT NULL,
        created_at       TIMESTAMP DEFAULT NOW()
      )
    `
    // Safe column additions
    await sql`ALTER TABLE branches ADD COLUMN IF NOT EXISTS max_delivery_km DECIMAL(5,2) DEFAULT NULL`
    // Vendor/marketplace fields — FoodFi's own outlets are vendors too (type 'own'),
    // external restaurants/dhabas added later with a commission.
    await sql`ALTER TABLE branches ADD COLUMN IF NOT EXISTS type VARCHAR(20) DEFAULT 'own'`
    await sql`ALTER TABLE branches ADD COLUMN IF NOT EXISTS commission_percent NUMERIC DEFAULT 0`
    await sql`UPDATE branches SET type = 'own' WHERE type IS NULL`
    await sql`ALTER TABLE admins ADD COLUMN IF NOT EXISTS branch_id UUID`
    await sql`ALTER TABLE admins ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT true`
  } catch(e) {}
}

// ── Ensure branch_inventory table ───────────────────────────────
async function ensureBranchInventoryTable(sql) {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS branch_inventory (
        id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        branch_id    UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
        menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
        is_available BOOLEAN DEFAULT true,
        UNIQUE(branch_id, menu_item_id)
      )
    `
    // Per-branch price + stock (null price = use the master item's price).
    // This makes the menu branch-wise: each branch its own price/stock/availability.
    await sql`ALTER TABLE branch_inventory ADD COLUMN IF NOT EXISTS price NUMERIC`
    await sql`ALTER TABLE branch_inventory ADD COLUMN IF NOT EXISTS stock_count INT`
    // Per-branch discount % + photo override (null = use the master item's value).
    await sql`ALTER TABLE branch_inventory ADD COLUMN IF NOT EXISTS discount_percent NUMERIC`
    await sql`ALTER TABLE branch_inventory ADD COLUMN IF NOT EXISTS image_url TEXT`
    // Phase 4: a branch can own its OWN unique items. owner_branch_id NULL =
    // shared master item (all branches); set = belongs only to that branch.
    await sql`ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS owner_branch_id UUID`
  } catch(e) {}
}

// ── Auto-populate branch inventory with all existing menu items ─
async function populateBranchInventory(sql, branchId) {
  try {
    // Add a row for every master item this branch is missing, seeding the
    // branch's own price + stock from the master item (so existing centralized
    // items land in every branch with their own independent price/stock).
    await sql`
      INSERT INTO branch_inventory (branch_id, menu_item_id, is_available, price, stock_count)
      SELECT ${branchId}::uuid, id, true, price, stock_count FROM menu_items
      WHERE owner_branch_id IS NULL
      ON CONFLICT (branch_id, menu_item_id) DO NOTHING
    `
    // First-time backfill for rows created before per-branch price/stock existed.
    await sql`
      UPDATE branch_inventory bi SET price = m.price
      FROM menu_items m
      WHERE bi.menu_item_id = m.id AND bi.branch_id = ${branchId}::uuid AND bi.price IS NULL
    `
    await sql`
      UPDATE branch_inventory bi SET stock_count = m.stock_count
      FROM menu_items m
      WHERE bi.menu_item_id = m.id AND bi.branch_id = ${branchId}::uuid AND bi.stock_count IS NULL AND m.stock_count IS NOT NULL
    `
  } catch(e) {}
}

// Ensure kitchen_settings has all needed columns
async function ensureKitchenColumns(sql) {
  try {
    await sql`ALTER TABLE kitchen_settings ADD COLUMN IF NOT EXISTS max_delivery_km NUMERIC DEFAULT 5`
    await sql`ALTER TABLE kitchen_settings ADD COLUMN IF NOT EXISTS open_time VARCHAR DEFAULT '09:00'`
    await sql`ALTER TABLE kitchen_settings ADD COLUMN IF NOT EXISTS close_time VARCHAR DEFAULT '22:00'`
    await sql`ALTER TABLE kitchen_settings ADD COLUMN IF NOT EXISTS estimated_time INT DEFAULT 45`
    await sql`ALTER TABLE kitchen_settings ADD COLUMN IF NOT EXISTS auto_schedule BOOLEAN DEFAULT false`
    await sql`ALTER TABLE kitchen_settings ADD COLUMN IF NOT EXISTS force_closed BOOLEAN DEFAULT false`
    await sql`ALTER TABLE kitchen_settings ADD COLUMN IF NOT EXISTS order_timeout_minutes INT DEFAULT 2`
    await sql`ALTER TABLE kitchen_settings ADD COLUMN IF NOT EXISTS escalation_interval_sec INT DEFAULT 30`
    // Review reward: give a discount on next order when customer reviews a delivered order
    await sql`ALTER TABLE kitchen_settings ADD COLUMN IF NOT EXISTS review_reward_enabled BOOLEAN DEFAULT false`
    await sql`ALTER TABLE kitchen_settings ADD COLUMN IF NOT EXISTS review_reward_amount INT DEFAULT 20`
    await sql`ALTER TABLE kitchen_settings ADD COLUMN IF NOT EXISTS review_reward_min_order INT DEFAULT 99`
    // Fitness Freak Corner: when false, customers see items as "Coming Soon" (no ordering)
    await sql`ALTER TABLE kitchen_settings ADD COLUMN IF NOT EXISTS fitness_corner_enabled BOOLEAN DEFAULT false`
    await sql`ALTER TABLE kitchen_settings ADD COLUMN IF NOT EXISTS boy_min_payout NUMERIC DEFAULT 25`
    await sql`ALTER TABLE kitchen_settings ADD COLUMN IF NOT EXISTS boy_base_km NUMERIC DEFAULT 2`
    await sql`ALTER TABLE kitchen_settings ADD COLUMN IF NOT EXISTS boy_per_km NUMERIC DEFAULT 7`
    // Delivery-as-offer: minimum order value + small-order fee below it.
    await sql`ALTER TABLE kitchen_settings ADD COLUMN IF NOT EXISTS min_order_value NUMERIC DEFAULT 99`
    await sql`ALTER TABLE kitchen_settings ADD COLUMN IF NOT EXISTS small_order_fee NUMERIC DEFAULT 20`
    // Free Delivery Festival — one-click promo: delivery free for everyone.
    await sql`ALTER TABLE kitchen_settings ADD COLUMN IF NOT EXISTS free_delivery_all BOOLEAN DEFAULT false`
  } catch (e) {}
}

// km_pricing: add free-delivery threshold per tier + seed recommended values once.
async function ensureKmPricingDelivery(sql) {
  try {
    await sql`ALTER TABLE km_pricing ADD COLUMN IF NOT EXISTS free_delivery_min NUMERIC`
    // One-time seed (only rows not yet configured) — fee + free-delivery threshold
    // by distance tier: 0-2km ₹25/free@149, 2-5 ₹35/249, 5-10 ₹45/349, 10+ ₹55/349.
    await sql`UPDATE km_pricing SET base_charge = 25, free_delivery_min = 149 WHERE free_delivery_min IS NULL AND min_km < 2`
    await sql`UPDATE km_pricing SET base_charge = 35, free_delivery_min = 249 WHERE free_delivery_min IS NULL AND min_km >= 2 AND min_km < 5`
    await sql`UPDATE km_pricing SET base_charge = 45, free_delivery_min = 349 WHERE free_delivery_min IS NULL AND min_km >= 5 AND min_km < 10`
    await sql`UPDATE km_pricing SET base_charge = 55, per_km_charge = 6, free_delivery_min = 349 WHERE free_delivery_min IS NULL AND min_km >= 10`
  } catch (e) {}
}

// Ensure delivery_boys has all needed columns
async function ensureDeliveryColumns(sql) {
  try {
    await sql`ALTER TABLE delivery_boys ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'approved'`
    await sql`ALTER TABLE delivery_boys ADD COLUMN IF NOT EXISTS vehicle_type VARCHAR(50)`
    await sql`ALTER TABLE delivery_boys ADD COLUMN IF NOT EXISTS license_number VARCHAR(100)`
    await sql`ALTER TABLE delivery_boys ADD COLUMN IF NOT EXISTS aadhar_number VARCHAR(20)`
    await sql`ALTER TABLE delivery_boys ADD COLUMN IF NOT EXISTS date_of_birth DATE`
    await sql`ALTER TABLE delivery_boys ADD COLUMN IF NOT EXISTS emergency_contact VARCHAR(20)`
    await sql`ALTER TABLE delivery_boys ADD COLUMN IF NOT EXISTS home_address TEXT`
    await sql`ALTER TABLE delivery_boys ADD COLUMN IF NOT EXISTS payment_due NUMERIC DEFAULT 0`
    await sql`ALTER TABLE delivery_boys ADD COLUMN IF NOT EXISTS total_paid NUMERIC DEFAULT 0`
  } catch (e) {}
}

// Ensure payment_records table exists
async function ensurePaymentTable(sql) {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS payment_records (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        delivery_boy_id UUID NOT NULL,
        amount NUMERIC NOT NULL,
        notes TEXT,
        paid_by VARCHAR(100) DEFAULT 'Admin',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `
  } catch (e) {}
}

export async function GET(request) {
  const sql = getDb()
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')

  if (type === 'branches') {
    const user = adminOnly(request)
    if (!user) return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    await ensureBranchesTable(sql)
    await ensureBranchInventoryTable(sql)
    const branches = await sql`SELECT * FROM branches ORDER BY created_at ASC`
    // Phase 1 migration: every branch gets all master items (own price/stock).
    for (const b of branches) { await populateBranchInventory(sql, b.id) }
    return NextResponse.json({ branches })
  }

  if (type === 'branch_inventory') {
    const user = adminOnly(request)
    if (!user) return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    const branchId = searchParams.get('branch_id')
    if (!branchId) return NextResponse.json({ error: 'branch_id required' }, { status: 400 })
    // Branch admins may only view their OWN branch's inventory
    if (!isSuperAdmin(user) && branchId !== user.branch_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    await ensureBranchInventoryTable(sql)
    // Auto-populate if empty (first time for this branch)
    await populateBranchInventory(sql, branchId)
    // Return shared (master) items + THIS branch's own items — never another
    // branch's owned items. owner_branch_id marks branch-owned items.
    const items = await sql`
      SELECT
        m.id, m.name, m.category, m.price AS master_price, m.is_veg,
        m.is_available AS global_available, m.owner_branch_id,
        COALESCE(bi.is_available, true)              AS branch_available,
        COALESCE(bi.price, m.price)                  AS branch_price,
        bi.stock_count                               AS branch_stock,
        COALESCE(bi.discount_percent, m.discount_percent, 0) AS branch_discount,
        COALESCE(bi.image_url, m.image_url)          AS image_url
      FROM menu_items m
      LEFT JOIN branch_inventory bi
        ON bi.menu_item_id = m.id AND bi.branch_id = ${branchId}::uuid
      WHERE m.owner_branch_id IS NULL OR m.owner_branch_id = ${branchId}::uuid
      ORDER BY m.category, m.name
    `
    return NextResponse.json({ items })
  }

  if (type === 'branch_analytics') {
    const user = adminOnly(request)
    if (!isSuperAdmin(user)) return NextResponse.json({ error: 'Super admin only' }, { status: 403 })
    const { searchParams } = new URL(request.url)
    const dateFrom = searchParams.get('date_from')
    const dateTo   = searchParams.get('date_to')

    // Ensure branch_id on orders
    try { await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS branch_id UUID` } catch {}

    const stats = dateFrom && dateTo
      ? await sql`
          SELECT
            b.id, b.name, b.city, b.is_active,
            COUNT(o.id)::int                                                          AS total_orders,
            COUNT(o.id) FILTER (WHERE o.status = 'delivered')::int                   AS delivered,
            COUNT(o.id) FILTER (WHERE o.status = 'cancelled')::int                   AS cancelled,
            COUNT(o.id) FILTER (WHERE o.status NOT IN ('delivered','cancelled'))::int AS active,
            COALESCE(SUM(o.total) FILTER (WHERE o.status = 'delivered'), 0)::numeric  AS revenue,
            COALESCE(AVG(o.total) FILTER (WHERE o.status = 'delivered'), 0)::numeric  AS avg_order,
            COALESCE(SUM(o.delivery_charge) FILTER (WHERE o.status = 'delivered'), 0)::numeric AS delivery_income
          FROM branches b
          LEFT JOIN orders o ON o.branch_id = b.id
            AND (o.created_at AT TIME ZONE 'Asia/Kolkata')::date
                BETWEEN ${dateFrom}::date AND ${dateTo}::date
          GROUP BY b.id, b.name, b.city, b.is_active
          ORDER BY revenue DESC
        `
      : await sql`
          SELECT
            b.id, b.name, b.city, b.is_active,
            COUNT(o.id)::int                                                          AS total_orders,
            COUNT(o.id) FILTER (WHERE o.status = 'delivered')::int                   AS delivered,
            COUNT(o.id) FILTER (WHERE o.status = 'cancelled')::int                   AS cancelled,
            COUNT(o.id) FILTER (WHERE o.status NOT IN ('delivered','cancelled'))::int AS active,
            COALESCE(SUM(o.total) FILTER (WHERE o.status = 'delivered'), 0)::numeric  AS revenue,
            COALESCE(AVG(o.total) FILTER (WHERE o.status = 'delivered'), 0)::numeric  AS avg_order,
            COALESCE(SUM(o.delivery_charge) FILTER (WHERE o.status = 'delivered'), 0)::numeric AS delivery_income
          FROM branches b
          LEFT JOIN orders o ON o.branch_id = b.id
            AND o.created_at >= NOW() - INTERVAL '30 days'
          GROUP BY b.id, b.name, b.city, b.is_active
          ORDER BY revenue DESC
        `

    // Top items per branch (last 30 days or date range)
    const topItems = dateFrom && dateTo
      ? await sql`
          SELECT o.branch_id, oi.name, SUM(oi.quantity)::int AS qty
          FROM order_items oi
          JOIN orders o ON oi.order_id = o.id
          WHERE o.status = 'delivered'
            AND (o.created_at AT TIME ZONE 'Asia/Kolkata')::date
                BETWEEN ${dateFrom}::date AND ${dateTo}::date
            AND o.branch_id IS NOT NULL
          GROUP BY o.branch_id, oi.name
          ORDER BY qty DESC
        `
      : await sql`
          SELECT o.branch_id, oi.name, SUM(oi.quantity)::int AS qty
          FROM order_items oi
          JOIN orders o ON oi.order_id = o.id
          WHERE o.status = 'delivered'
            AND o.created_at >= NOW() - INTERVAL '30 days'
            AND o.branch_id IS NOT NULL
          GROUP BY o.branch_id, oi.name
          ORDER BY qty DESC
        `

    // Daily revenue per branch (last 7 days)
    const dailyTrend = await sql`
      SELECT
        o.branch_id,
        (o.created_at AT TIME ZONE 'Asia/Kolkata')::date AS day,
        TO_CHAR((o.created_at AT TIME ZONE 'Asia/Kolkata')::date, 'DD Mon') AS label,
        COUNT(*)::int AS orders,
        COALESCE(SUM(o.total), 0)::numeric AS revenue
      FROM orders o
      WHERE o.status = 'delivered'
        AND o.created_at >= NOW() - INTERVAL '7 days'
        AND o.branch_id IS NOT NULL
      GROUP BY o.branch_id, (o.created_at AT TIME ZONE 'Asia/Kolkata')::date
      ORDER BY day ASC
    `

    return NextResponse.json({ stats, topItems, dailyTrend })
  }

  if (type === 'offers') {
    const user = adminOnly(request)
    let offers
    if (user) {
      offers = await sql`SELECT * FROM offers ORDER BY created_at DESC`
    } else {
      offers = await sql`SELECT * FROM offers WHERE is_active = true AND (valid_till IS NULL OR valid_till >= CURRENT_DATE) ORDER BY created_at DESC`
    }
    return NextResponse.json({ offers })
  }

  if (type === 'stock') {
    const user = adminOnly(request)
    if (!isSuperAdmin(user)) return NextResponse.json({ error: 'Super admin only' }, { status: 403 })
    try { await sql`ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS stock_default INT DEFAULT NULL` } catch {}
    const items = await sql`
      SELECT id, name, category, stock_count, stock_default, is_available
      FROM menu_items ORDER BY category, name
    `
    return NextResponse.json({ items })
  }

  if (type === 'pricing') {
    await ensureKmPricingDelivery(sql)
    const rows = await sql`SELECT * FROM km_pricing ORDER BY min_km`
    return NextResponse.json({ pricing: rows })
  }

  if (type === 'delivery_boys') {
    const user = adminOnly(request)
    if (!user) return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    await ensureDeliveryColumns(sql)
    await ensurePaymentTable(sql)
    // live_earnings: calculated fresh from orders using consistent formula
    const boys = await sql`
      SELECT db.id, db.name, db.email, db.phone, db.vehicle_number, db.vehicle_type, db.is_online,
             db.per_km_earning, db.total_earnings, db.rating, db.status, db.created_at,
             db.license_number, db.aadhar_number, db.date_of_birth, db.emergency_contact, db.home_address,
             COALESCE(db.payment_due, 0) as payment_due,
             COALESCE(db.total_paid, 0) as total_paid,
             COALESCE((
               SELECT SUM(COALESCE(o.boy_payout, GREATEST(0, o.delivery_charge * 0.7)))
               FROM orders o
               WHERE o.delivery_boy_id = db.id AND o.status = 'delivered'
             ), 0) as live_earnings
      FROM delivery_boys db
      WHERE db.status = 'approved' OR db.status IS NULL
      ORDER BY db.name
    `
    return NextResponse.json({ boys })
  }

  if (type === 'payment_history') {
    const user = adminOnly(request)
    if (!isSuperAdmin(user)) return NextResponse.json({ error: 'Super admin only' }, { status: 403 })
    const boyId = searchParams.get('boyId')
    await ensurePaymentTable(sql)
    const records = await sql`
      SELECT * FROM payment_records
      WHERE delivery_boy_id = ${boyId}
      ORDER BY created_at DESC LIMIT 50
    `
    return NextResponse.json({ records })
  }

  if (type === 'payout') {
    const user = adminOnly(request)
    if (!isSuperAdmin(user)) return NextResponse.json({ error: 'Super admin only' }, { status: 403 })
    const boyId = searchParams.get('boyId')
    if (!boyId) return NextResponse.json({ error: 'boyId required' }, { status: 400 })
    await ensurePaymentTable(sql)
    try { await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS boy_payout DECIMAL(10,2)` } catch {}

    // Consistent formula: COALESCE(boy_payout, delivery_charge * 0.7)
    // Same formula used in delivery/history API — so admin and delivery boy see same numbers
    const orders = await sql`
      SELECT o.id, o.order_number, o.created_at, o.delivered_at,
        o.delivery_charge, o.distance_km, o.status,
        o.boy_payout,
        COALESCE(o.boy_payout, GREATEST(0, o.delivery_charge * 0.7)) as boy_payout_calc
      FROM orders o
      WHERE o.delivery_boy_id = ${boyId}::uuid AND o.status = 'delivered'
      ORDER BY o.delivered_at DESC NULLS LAST
    `

    // Calculate total_to_pay from orders (source of truth)
    const [earningRow] = await sql`
      SELECT COALESCE(SUM(COALESCE(boy_payout, GREATEST(0, delivery_charge * 0.7))), 0) as total_to_pay,
             COALESCE(SUM(delivery_charge), 0) as total_collected
      FROM orders
      WHERE delivery_boy_id = ${boyId}::uuid AND status = 'delivered'
    `
    const [boyRow] = await sql`
      SELECT COALESCE(total_paid, 0) as total_paid FROM delivery_boys WHERE id = ${boyId}::uuid
    `

    const totalToPay = parseFloat(earningRow?.total_to_pay || 0)
    const totalPaid  = parseFloat(boyRow?.total_paid || 0)
    const balanceDue = Math.max(0, totalToPay - totalPaid)
    const overPaid   = Math.max(0, totalPaid - totalToPay)

    // Keep delivery_boys.total_earnings and payment_due in sync
    await sql`
      UPDATE delivery_boys
      SET total_earnings = ${totalToPay},
          payment_due    = ${balanceDue}
      WHERE id = ${boyId}::uuid
    `.catch(() => {})

    const summary = {
      total_collected: parseFloat(earningRow?.total_collected || 0),
      total_to_pay:    totalToPay,
      total_paid:      totalPaid,
      balance_due:     balanceDue,
      over_paid:       overPaid,
    }

    const paymentHistory = await sql`
      SELECT amount, notes, created_at FROM payment_records
      WHERE delivery_boy_id = ${boyId}::uuid
      ORDER BY created_at DESC LIMIT 50
    `

    return NextResponse.json({ orders, summary, paymentHistory })
  }

  if (type === 'pending_boys') {
    const user = adminOnly(request)
    if (!isSuperAdmin(user)) return NextResponse.json({ error: 'Super admin only' }, { status: 403 })
    await ensureDeliveryColumns(sql)
    const boys = await sql`
      SELECT id, name, email, phone, vehicle_number, vehicle_type,
             license_number, aadhar_number, date_of_birth, emergency_contact,
             home_address, status, created_at
      FROM delivery_boys
      WHERE status = 'pending'
      ORDER BY created_at DESC
    `
    return NextResponse.json({ boys })
  }

  if (type === 'customers') {
    const user = adminOnly(request)
    if (!isSuperAdmin(user)) return NextResponse.json({ error: 'Super admin only' }, { status: 403 })
    const customers = await sql`
      SELECT u.id, u.name, u.email, u.phone, u.address, u.created_at,
        COUNT(o.id) as total_orders,
        COALESCE(SUM(o.total), 0) as total_spent,
        MAX(o.created_at) as last_order_at
      FROM users u
      LEFT JOIN orders o ON o.user_id = u.id AND o.status != 'cancelled'
      GROUP BY u.id ORDER BY total_spent DESC
    `
    return NextResponse.json({ customers })
  }

  if (type === 'analytics') {
    const user = adminOnly(request)
    if (!isSuperAdmin(user)) return NextResponse.json({ error: 'Super admin only' }, { status: 403 })
    const [todayStats] = await sql`
      SELECT COUNT(*) as today_orders, COALESCE(SUM(total), 0) as today_revenue,
        COUNT(CASE WHEN status NOT IN ('delivered', 'cancelled') THEN 1 END) as pending_orders
      FROM orders WHERE created_at::date = CURRENT_DATE
    `
    const [weekStats] = await sql`
      SELECT COUNT(*) as week_orders, COALESCE(SUM(total), 0) as week_revenue
      FROM orders WHERE created_at >= NOW() - INTERVAL '7 days' AND status = 'delivered'
    `
    const topItems = await sql`
      SELECT oi.name, SUM(oi.quantity) as total_qty, SUM(oi.subtotal) as total_revenue
      FROM order_items oi JOIN orders o ON oi.order_id = o.id
      WHERE o.created_at >= NOW() - INTERVAL '30 days' AND o.status != 'cancelled'
      GROUP BY oi.name ORDER BY total_qty DESC LIMIT 10
    `
    // Last 7 days revenue chart data (day by day)
    const revenueChart = await sql`
      SELECT
        TO_CHAR(created_at::date, 'DD Mon') as day,
        created_at::date as date,
        COUNT(*) as orders,
        COALESCE(SUM(total), 0) as revenue
      FROM orders
      WHERE created_at >= NOW() - INTERVAL '7 days'
        AND status != 'cancelled'
      GROUP BY created_at::date
      ORDER BY date
    `
    const customerCount = await sql`SELECT COUNT(*) as count FROM users`
    return NextResponse.json({ todayStats, weekStats, topItems, revenueChart, customerCount: customerCount[0].count })
  }

  // Default: kitchen settings (public) — also check auto open/close schedule
  await ensureKitchenColumns(sql)
  await checkAndUpdateKitchenSchedule()
  const [settings] = await sql`
    SELECT is_open, kitchen_name, address, phone, lat, lng,
           max_delivery_km, open_time, close_time, estimated_time, auto_schedule,
           order_timeout_minutes, escalation_interval_sec,
           review_reward_enabled, review_reward_amount, review_reward_min_order,
           fitness_corner_enabled, boy_min_payout, boy_base_km, boy_per_km,
           min_order_value, small_order_fee, free_delivery_all
    FROM kitchen_settings WHERE id = 1
  `
  return NextResponse.json({ settings })
}

export async function PATCH(request) {
  const user = adminOnly(request)
  if (!user) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const sql = getDb()
  const body = await request.json()
  const { type, ...data } = body

  if (type === 'kitchen') {
    if (!isSuperAdmin(user)) return NextResponse.json({ error: 'Super admin only' }, { status: 403 })
    await ensureKitchenColumns(sql)

    // Ensure row exists (upsert)
    await sql`INSERT INTO kitchen_settings (id, is_open) VALUES (1, true) ON CONFLICT (id) DO NOTHING`

    // Explicit numeric parsing to avoid Neon HTTP string-vs-number type issues
    const kmVal      = data.max_delivery_km       != null ? parseFloat(data.max_delivery_km)      : null
    const etVal      = data.estimated_time        != null ? parseInt(data.estimated_time)         : null
    const latVal     = data.lat                   != null ? parseFloat(data.lat)                  : null
    const lngVal     = data.lng                   != null ? parseFloat(data.lng)                  : null
    const toVal      = data.order_timeout_minutes != null ? parseInt(data.order_timeout_minutes)  : null
    const escVal     = data.escalation_interval_sec != null ? parseInt(data.escalation_interval_sec) : null
    const rrEnabled  = data.review_reward_enabled   != null ? !!data.review_reward_enabled         : null
    const rrAmount   = data.review_reward_amount     != null ? parseInt(data.review_reward_amount)   : null
    const rrMin      = data.review_reward_min_order  != null ? parseInt(data.review_reward_min_order): null
    const ffEnabled  = data.fitness_corner_enabled   != null ? !!data.fitness_corner_enabled         : null
    const bMin       = data.boy_min_payout != null ? parseFloat(data.boy_min_payout) : null
    const bBaseKm    = data.boy_base_km    != null ? parseFloat(data.boy_base_km)    : null
    const bPerKm     = data.boy_per_km     != null ? parseFloat(data.boy_per_km)     : null
    const movVal     = data.min_order_value != null ? parseFloat(data.min_order_value) : null
    const sofVal     = data.small_order_fee != null ? parseFloat(data.small_order_fee) : null
    const fdaVal     = data.free_delivery_all != null ? !!data.free_delivery_all : null

    // When admin manually toggles is_open:
    // CLOSE (false) → force_closed = true  (schedule cannot re-open)
    // OPEN  (true)  → force_closed = false (schedule handles timing)
    const forceClosedVal = data.is_open === false ? true
                         : data.is_open === true  ? false
                         : null  // not changed — keep existing

    const [settings] = await sql`
      UPDATE kitchen_settings SET
        is_open                 = COALESCE(${data.is_open        ?? null}, is_open),
        force_closed            = COALESCE(${forceClosedVal},    force_closed),
        kitchen_name            = COALESCE(${data.kitchen_name   ?? null}, kitchen_name),
        address                 = COALESCE(${data.address        ?? null}, address),
        phone                   = COALESCE(${data.phone          ?? null}, phone),
        lat                     = COALESCE(${latVal},  lat),
        lng                     = COALESCE(${lngVal},  lng),
        max_delivery_km         = COALESCE(${kmVal},   max_delivery_km),
        open_time               = COALESCE(${data.open_time      ?? null}, open_time),
        close_time              = COALESCE(${data.close_time     ?? null}, close_time),
        estimated_time          = COALESCE(${etVal},   estimated_time),
        auto_schedule           = COALESCE(${data.auto_schedule  ?? null}, auto_schedule),
        order_timeout_minutes   = COALESCE(${toVal},   order_timeout_minutes),
        escalation_interval_sec = COALESCE(${escVal},  escalation_interval_sec),
        review_reward_enabled   = COALESCE(${rrEnabled}, review_reward_enabled),
        review_reward_amount    = COALESCE(${rrAmount},  review_reward_amount),
        review_reward_min_order = COALESCE(${rrMin},     review_reward_min_order),
        fitness_corner_enabled  = COALESCE(${ffEnabled}, fitness_corner_enabled),
        boy_min_payout          = COALESCE(${bMin},    boy_min_payout),
        boy_base_km             = COALESCE(${bBaseKm}, boy_base_km),
        boy_per_km              = COALESCE(${bPerKm},  boy_per_km),
        min_order_value         = COALESCE(${movVal},  min_order_value),
        small_order_fee         = COALESCE(${sofVal},  small_order_fee),
        free_delivery_all       = COALESCE(${fdaVal},  free_delivery_all),
        updated_at              = NOW()
      WHERE id = 1 RETURNING *
    `
    return NextResponse.json({ settings })
  }

  if (type === 'stock') {
    if (!isSuperAdmin(user)) return NextResponse.json({ error: 'Super admin only' }, { status: 403 })
    try { await sql`ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS stock_default INT DEFAULT NULL` } catch {}

    // Reset all to defaults
    if (data.reset_all) {
      const { getDefaultStock } = await import('@/lib/stock')
      const items = await sql`SELECT id, category, stock_default FROM menu_items`
      for (const item of items) {
        const qty = item.stock_default ?? getDefaultStock(item.category)
        await sql`UPDATE menu_items SET stock_count = ${qty}, stock_default = COALESCE(stock_default, ${qty}) WHERE id = ${item.id}`
      }
      return NextResponse.json({ ok: true, message: 'All stock reset to defaults' })
    }

    // Update single item stock
    if (data.id) {
      const updateFields = []
      if (data.stock_count !== undefined) {
        const val = data.stock_count === null ? null : Math.max(0, parseInt(data.stock_count) || 0)
        await sql`UPDATE menu_items SET stock_count = ${val} WHERE id = ${data.id}`
      }
      if (data.stock_default !== undefined) {
        const val = data.stock_default === null ? null : Math.max(0, parseInt(data.stock_default) || 0)
        await sql`UPDATE menu_items SET stock_default = ${val} WHERE id = ${data.id}`
      }
      const [item] = await sql`SELECT id, name, category, stock_count, stock_default FROM menu_items WHERE id = ${data.id}`
      return NextResponse.json({ item })
    }

    return NextResponse.json({ error: 'id required' }, { status: 400 })
  }

  if (type === 'offer') {
    if (!isSuperAdmin(user)) return NextResponse.json({ error: 'Super admin only' }, { status: 403 })
    if (data.id) {
      const [offer] = await sql`
        UPDATE offers SET
          is_active  = COALESCE(${data.is_active ?? null}, is_active),
          value      = COALESCE(${data.value ?? null}, value),
          min_order  = COALESCE(${data.min_order ?? null}, min_order),
          valid_till = COALESCE(${data.valid_till ?? null}, valid_till)
        WHERE id = ${data.id} RETURNING *
      `
      return NextResponse.json({ offer })
    } else {
      const [offer] = await sql`
        INSERT INTO offers (code, type, value, min_order, max_uses, valid_till)
        VALUES (${data.code.toUpperCase()}, ${data.type}, ${data.value}, ${data.min_order || 0}, ${data.max_uses || 1000}, ${data.valid_till || null})
        RETURNING *
      `
      return NextResponse.json({ offer })
    }
  }

  if (type === 'pricing') {
    if (!isSuperAdmin(user)) return NextResponse.json({ error: 'Super admin only' }, { status: 403 })
    await ensureKmPricingDelivery(sql)
    for (const row of data.rows) {
      const freeMin = (row.free_delivery_min === '' || row.free_delivery_min == null) ? null : parseFloat(row.free_delivery_min)
      await sql`UPDATE km_pricing SET base_charge = ${row.base_charge}, per_km_charge = ${row.per_km_charge}, free_delivery_min = ${freeMin} WHERE id = ${row.id}`
    }
    return NextResponse.json({ success: true })
  }

  // Update delivery boy details
  if (type === 'update_boy') {
    if (!isSuperAdmin(user)) return NextResponse.json({ error: 'Super admin only' }, { status: 403 })
    await sql`
      UPDATE delivery_boys SET
        name           = COALESCE(${data.name ?? null}, name),
        phone          = COALESCE(${data.phone ?? null}, phone),
        per_km_earning = COALESCE(${data.per_km_earning ? parseFloat(data.per_km_earning) : null}, per_km_earning)
      WHERE id = ${data.id}::uuid
    `
    return NextResponse.json({ success: true })
  }

  // Approve delivery boy application
  if (type === 'approve_boy') {
    if (!isSuperAdmin(user)) return NextResponse.json({ error: 'Super admin only' }, { status: 403 })
    await ensureDeliveryColumns(sql)
    await sql`UPDATE delivery_boys SET status = 'approved' WHERE id = ${data.id}::uuid`
    return NextResponse.json({ success: true })
  }

  // Reject delivery boy application
  if (type === 'reject_boy') {
    if (!isSuperAdmin(user)) return NextResponse.json({ error: 'Super admin only' }, { status: 403 })
    await sql`UPDATE delivery_boys SET status = 'rejected' WHERE id = ${data.id}::uuid`
    return NextResponse.json({ success: true })
  }

  // Suspend delivery boy
  if (type === 'suspend_boy') {
    if (!isSuperAdmin(user)) return NextResponse.json({ error: 'Super admin only' }, { status: 403 })
    await sql`UPDATE delivery_boys SET status = 'suspended', is_online = false WHERE id = ${data.id}::uuid`
    return NextResponse.json({ success: true })
  }

  // Reactivate delivery boy
  if (type === 'reactivate_boy') {
    if (!isSuperAdmin(user)) return NextResponse.json({ error: 'Super admin only' }, { status: 403 })
    await sql`UPDATE delivery_boys SET status = 'approved' WHERE id = ${data.id}::uuid`
    return NextResponse.json({ success: true })
  }

  // Record payment to delivery boy
  if (type === 'pay_boy') {
    if (!isSuperAdmin(user)) return NextResponse.json({ error: 'Super admin only' }, { status: 403 })
    await ensureDeliveryColumns(sql)
    await ensurePaymentTable(sql)
    const amount = parseFloat(data.amount)
    if (!amount || amount <= 0) return NextResponse.json({ error: 'Valid amount required' }, { status: 400 })

    // Record the payment
    await sql`
      INSERT INTO payment_records (delivery_boy_id, amount, notes)
      VALUES (${data.id}::uuid, ${amount}, ${data.notes || null})
    `
    await sql`
      UPDATE delivery_boys
      SET total_paid = COALESCE(total_paid, 0) + ${amount}
      WHERE id = ${data.id}::uuid
    `

    // Recalculate total_earnings and payment_due from source of truth (orders)
    const [earningRow] = await sql`
      SELECT COALESCE(SUM(COALESCE(boy_payout, GREATEST(0, delivery_charge * 0.7))), 0) as live_earned
      FROM orders WHERE delivery_boy_id = ${data.id}::uuid AND status = 'delivered'
    `
    const liveEarned = parseFloat(earningRow?.live_earned || 0)
    const [paidRow] = await sql`SELECT COALESCE(total_paid, 0) as total_paid FROM delivery_boys WHERE id = ${data.id}::uuid`
    const totalPaidNow = parseFloat(paidRow?.total_paid || 0)
    const newDue = Math.max(0, liveEarned - totalPaidNow)
    const overPaid = Math.max(0, totalPaidNow - liveEarned)

    await sql`
      UPDATE delivery_boys
      SET total_earnings = ${liveEarned},
          payment_due    = ${newDue}
      WHERE id = ${data.id}::uuid
    `

    const [boy] = await sql`
      SELECT id, name,
        ${liveEarned}::numeric as total_earnings,
        ${newDue}::numeric as payment_due,
        ${totalPaidNow}::numeric as total_paid,
        ${overPaid}::numeric as over_paid
      FROM delivery_boys WHERE id = ${data.id}::uuid
    `

    // Notify delivery boy about payment
    sendPushToUser(String(data.id), {
      title: `💰 Payment Mila! ₹${Math.round(amount)}`,
      body: data.notes
        ? data.notes
        : newDue > 0
          ? `Admin ne ₹${Math.round(amount)} payment kar di. Baaki: ₹${Math.round(newDue)}`
          : `Admin ne ₹${Math.round(amount)} payment kar di. Sab barabar! ✅`,
      url: '/delivery',
      tag: `payment-${Date.now()}`,
    }, 'delivery').catch(() => {})
    return NextResponse.json({ success: true, boy })
  }

  // ── Branch Inventory ──────────────────────────────────────────────
  if (type === 'branch_inventory') {
    const user = adminOnly(request)
    if (!user) return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    // Branch admins may only modify their OWN branch's inventory
    if (!isSuperAdmin(user) && data.branch_id !== user.branch_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    await ensureBranchInventoryTable(sql)

    // Toggle single item availability for a branch
    if (data.action === 'toggle') {
      const { branch_id, item_id, is_available } = data
      if (!branch_id || !item_id) return NextResponse.json({ error: 'branch_id and item_id required' }, { status: 400 })
      await sql`
        INSERT INTO branch_inventory (branch_id, menu_item_id, is_available)
        VALUES (${branch_id}::uuid, ${item_id}::uuid, ${is_available})
        ON CONFLICT (branch_id, menu_item_id)
        DO UPDATE SET is_available = ${is_available}
      `
      return NextResponse.json({ success: true })
    }

    // Bulk enable/disable all items for a branch
    if (data.action === 'bulk') {
      const { branch_id, is_available } = data
      if (!branch_id) return NextResponse.json({ error: 'branch_id required' }, { status: 400 })
      await populateBranchInventory(sql, branch_id) // ensure all items exist
      await sql`
        UPDATE branch_inventory SET is_available = ${is_available}
        WHERE branch_id = ${branch_id}::uuid
      `
      return NextResponse.json({ success: true })
    }

    // Set this branch's own price for one item (null/empty = fall back to master)
    if (data.action === 'set_price') {
      const { branch_id, item_id } = data
      if (!branch_id || !item_id) return NextResponse.json({ error: 'branch_id and item_id required' }, { status: 400 })
      const raw = data.price
      const price = (raw === null || raw === undefined || raw === '') ? null : Number(raw)
      if (price !== null && (!Number.isFinite(price) || price < 0)) {
        return NextResponse.json({ error: 'Invalid price' }, { status: 400 })
      }
      await sql`
        INSERT INTO branch_inventory (branch_id, menu_item_id, is_available, price)
        VALUES (${branch_id}::uuid, ${item_id}::uuid, true, ${price})
        ON CONFLICT (branch_id, menu_item_id)
        DO UPDATE SET price = ${price}
      `
      return NextResponse.json({ success: true })
    }

    // Set this branch's stock count for one item (null/empty = untracked stock)
    if (data.action === 'set_stock') {
      const { branch_id, item_id } = data
      if (!branch_id || !item_id) return NextResponse.json({ error: 'branch_id and item_id required' }, { status: 400 })
      const raw = data.stock_count
      const stock = (raw === null || raw === undefined || raw === '') ? null : Math.trunc(Number(raw))
      if (stock !== null && (!Number.isFinite(stock) || stock < 0)) {
        return NextResponse.json({ error: 'Invalid stock' }, { status: 400 })
      }
      await sql`
        INSERT INTO branch_inventory (branch_id, menu_item_id, is_available, stock_count)
        VALUES (${branch_id}::uuid, ${item_id}::uuid, true, ${stock})
        ON CONFLICT (branch_id, menu_item_id)
        DO UPDATE SET stock_count = ${stock}
      `
      return NextResponse.json({ success: true })
    }

    // Phase 4 — add a NEW item owned by this branch (shows only in this branch).
    if (data.action === 'add_item') {
      const { branch_id } = data
      const name = (data.name || '').trim()
      const category = (data.category || '').trim()
      const price = Number(data.price)
      if (!branch_id || !name || !category) {
        return NextResponse.json({ error: 'Name, category, price zaroori hai' }, { status: 400 })
      }
      if (!Number.isFinite(price) || price < 0) {
        return NextResponse.json({ error: 'Invalid price' }, { status: 400 })
      }
      const is_veg = data.is_veg !== false
      const stock = (data.stock_count === '' || data.stock_count == null) ? null : Math.trunc(Number(data.stock_count))
      const discount = Math.min(100, Math.max(0, parseInt(data.discount_percent) || 0))
      const [item] = await sql`
        INSERT INTO menu_items (name, description, price, discount_percent, category, is_veg, image_url, owner_branch_id)
        VALUES (${name}, ${data.description || ''}, ${price}, ${discount}, ${category}, ${is_veg}, ${data.image_url || null}, ${branch_id}::uuid)
        RETURNING id
      `
      // This branch's inventory row: ON by default + its own price/stock.
      await sql`
        INSERT INTO branch_inventory (branch_id, menu_item_id, is_available, price, stock_count)
        VALUES (${branch_id}::uuid, ${item.id}::uuid, true, ${price}, ${stock})
        ON CONFLICT (branch_id, menu_item_id) DO NOTHING
      `
      return NextResponse.json({ success: true, id: item.id })
    }

    // Set this branch's discount % for one item (null/empty = use master)
    if (data.action === 'set_discount') {
      const { branch_id, item_id } = data
      if (!branch_id || !item_id) return NextResponse.json({ error: 'branch_id and item_id required' }, { status: 400 })
      const raw = data.discount_percent
      const disc = (raw === null || raw === undefined || raw === '') ? null : Math.min(100, Math.max(0, Number(raw)))
      if (disc !== null && !Number.isFinite(disc)) return NextResponse.json({ error: 'Invalid discount' }, { status: 400 })
      await sql`
        INSERT INTO branch_inventory (branch_id, menu_item_id, is_available, discount_percent)
        VALUES (${branch_id}::uuid, ${item_id}::uuid, true, ${disc})
        ON CONFLICT (branch_id, menu_item_id)
        DO UPDATE SET discount_percent = ${disc}
      `
      return NextResponse.json({ success: true })
    }

    // Set this branch's own photo for one item (null/empty = use master photo)
    if (data.action === 'set_image') {
      const { branch_id, item_id } = data
      if (!branch_id || !item_id) return NextResponse.json({ error: 'branch_id and item_id required' }, { status: 400 })
      const url = data.image_url || null
      await sql`
        INSERT INTO branch_inventory (branch_id, menu_item_id, is_available, image_url)
        VALUES (${branch_id}::uuid, ${item_id}::uuid, true, ${url})
        ON CONFLICT (branch_id, menu_item_id)
        DO UPDATE SET image_url = ${url}
      `
      return NextResponse.json({ success: true })
    }

    // Phase 4 — delete a branch-owned item (only the owning branch may delete).
    if (data.action === 'delete_item') {
      const { branch_id, item_id } = data
      if (!branch_id || !item_id) return NextResponse.json({ error: 'branch_id and item_id required' }, { status: 400 })
      const [owned] = await sql`
        SELECT id FROM menu_items WHERE id = ${item_id}::uuid AND owner_branch_id = ${branch_id}::uuid
      `
      if (!owned) {
        return NextResponse.json({ error: 'Sirf is branch ke apne item delete ho sakte hain (master item nahi)' }, { status: 400 })
      }
      await sql`DELETE FROM menu_items WHERE id = ${item_id}::uuid` // cascades branch_inventory
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }

  // ── Branch CRUD ───────────────────────────────────────────────────
  if (type === 'branch') {
    // Branch admins may ONLY toggle their own branch open/closed.
    // create / update / delete are super-admin only.
    if (!isSuperAdmin(user)) {
      if (data.action !== 'toggle' || data.id !== user.branch_id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }
    await ensureBranchesTable(sql)

    if (data.action === 'create') {
      if (!data.name?.trim()) return NextResponse.json({ error: 'Branch name required' }, { status: 400 })
      // Partner = externally onboarded vendor (admin-verified); own = FoodFi's
      // own outlet. commission_percent only meaningful for partners.
      const branchType = data.branch_type === 'partner' ? 'partner' : 'own'
      const commission = branchType === 'partner' ? (parseFloat(data.commission_percent) || 0) : 0
      const [branch] = await sql`
        INSERT INTO branches (name, address, city, phone, lat, lng, opening_time, closing_time, max_delivery_km, type, commission_percent)
        VALUES (
          ${data.name.trim()},
          ${data.address?.trim() || ''},
          ${data.city?.trim() || ''},
          ${data.phone?.trim() || ''},
          ${data.lat ? parseFloat(data.lat) : null},
          ${data.lng ? parseFloat(data.lng) : null},
          ${data.opening_time || '09:00'},
          ${data.closing_time || '22:00'},
          ${parseFloat(data.max_delivery_km) > 0 ? parseFloat(data.max_delivery_km) : null},
          ${branchType},
          ${commission}
        )
        RETURNING *
      `
      // Auto-populate inventory with all existing menu items
      await ensureBranchInventoryTable(sql)
      await populateBranchInventory(sql, branch.id)
      return NextResponse.json({ success: true, branch })
    }

    if (data.action === 'update') {
      if (!data.id) return NextResponse.json({ error: 'Branch ID required' }, { status: 400 })
      const branchType = data.branch_type === 'partner' ? 'partner' : 'own'
      const commission = branchType === 'partner' ? (parseFloat(data.commission_percent) || 0) : 0
      const [branch] = await sql`
        UPDATE branches SET
          name            = ${data.name?.trim() || ''},
          address         = ${data.address?.trim() || ''},
          city            = ${data.city?.trim() || ''},
          phone           = ${data.phone?.trim() || ''},
          lat             = ${data.lat ? parseFloat(data.lat) : null},
          lng             = ${data.lng ? parseFloat(data.lng) : null},
          opening_time    = ${data.opening_time || '09:00'},
          closing_time    = ${data.closing_time || '22:00'},
          max_delivery_km = ${parseFloat(data.max_delivery_km) > 0 ? parseFloat(data.max_delivery_km) : null},
          type            = ${branchType},
          commission_percent = ${commission}
        WHERE id = ${data.id}::uuid
        RETURNING *
      `
      return NextResponse.json({ success: true, branch })
    }

    if (data.action === 'toggle') {
      if (!data.id) return NextResponse.json({ error: 'Branch ID required' }, { status: 400 })
      const [branch] = await sql`
        UPDATE branches SET is_active = NOT is_active
        WHERE id = ${data.id}::uuid RETURNING *
      `
      return NextResponse.json({ success: true, branch })
    }

    if (data.action === 'delete') {
      if (!data.id) return NextResponse.json({ error: 'Branch ID required' }, { status: 400 })
      await sql`DELETE FROM branches WHERE id = ${data.id}::uuid`
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Unknown branch action' }, { status: 400 })
  }

  return NextResponse.json({ error: 'Unknown type' }, { status: 400 })
}

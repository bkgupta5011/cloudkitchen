export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { checkAndUpdateKitchenSchedule } from '@/lib/schedule'

function adminOnly(request) {
  const token = request.cookies.get('ck_token')?.value
  const user = verifyToken(token)
  if (!user || user.role !== 'admin') return null
  return user
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

  if (type === 'pricing') {
    const rows = await sql`SELECT * FROM km_pricing ORDER BY min_km`
    return NextResponse.json({ pricing: rows })
  }

  if (type === 'delivery_boys') {
    const user = adminOnly(request)
    if (!user) return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    await ensureDeliveryColumns(sql)
    await ensurePaymentTable(sql)
    const boys = await sql`
      SELECT id, name, email, phone, vehicle_number, vehicle_type, is_online,
             per_km_earning, total_earnings, rating, status, created_at,
             license_number, aadhar_number, date_of_birth, emergency_contact, home_address,
             COALESCE(payment_due, 0) as payment_due,
             COALESCE(total_paid, 0) as total_paid
      FROM delivery_boys
      WHERE status = 'approved' OR status IS NULL
      ORDER BY name
    `
    return NextResponse.json({ boys })
  }

  if (type === 'payment_history') {
    const user = adminOnly(request)
    if (!user) return NextResponse.json({ error: 'Admin only' }, { status: 403 })
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
    if (!user) return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    const boyId = searchParams.get('boyId')
    if (!boyId) return NextResponse.json({ error: 'boyId required' }, { status: 400 })
    await ensurePaymentTable(sql)
    // Ensure boy_payout column exists
    try { await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS boy_payout DECIMAL(10,2)` } catch {}

    const orders = await sql`
      SELECT o.id, o.order_number, o.created_at, o.delivered_at,
        o.delivery_charge, o.distance_km, o.status,
        COALESCE(o.boy_payout, ROUND(db.per_km_earning * COALESCE(o.distance_km, 3), 2)) as boy_payout_calc
      FROM orders o
      JOIN delivery_boys db ON db.id = o.delivery_boy_id
      WHERE o.delivery_boy_id = ${boyId}::uuid AND o.status = 'delivered'
      ORDER BY o.delivered_at DESC NULLS LAST
    `

    const [summary] = await sql`
      SELECT
        COALESCE(SUM(o.delivery_charge), 0) as total_collected,
        COALESCE(SUM(COALESCE(o.boy_payout, ROUND(db.per_km_earning * COALESCE(o.distance_km, 3), 2))), 0) as total_to_pay,
        COALESCE(db.total_paid, 0) as total_paid,
        GREATEST(0, COALESCE(SUM(COALESCE(o.boy_payout, ROUND(db.per_km_earning * COALESCE(o.distance_km, 3), 2))), 0) - COALESCE(db.total_paid, 0)) as balance_due
      FROM orders o
      JOIN delivery_boys db ON db.id = o.delivery_boy_id
      WHERE o.delivery_boy_id = ${boyId}::uuid AND o.status = 'delivered'
      GROUP BY db.total_paid
    `

    const paymentHistory = await sql`
      SELECT amount, notes, created_at FROM payment_records
      WHERE delivery_boy_id = ${boyId}::uuid
      ORDER BY created_at DESC LIMIT 50
    `

    return NextResponse.json({ orders, summary: summary || { total_collected: 0, total_to_pay: 0, total_paid: 0, balance_due: 0 }, paymentHistory })
  }

  if (type === 'pending_boys') {
    const user = adminOnly(request)
    if (!user) return NextResponse.json({ error: 'Admin only' }, { status: 403 })
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
    if (!user) return NextResponse.json({ error: 'Admin only' }, { status: 403 })
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
    if (!user) return NextResponse.json({ error: 'Admin only' }, { status: 403 })
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
           order_timeout_minutes, escalation_interval_sec
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
        updated_at              = NOW()
      WHERE id = 1 RETURNING *
    `
    return NextResponse.json({ settings })
  }

  if (type === 'offer') {
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
    for (const row of data.rows) {
      await sql`UPDATE km_pricing SET base_charge = ${row.base_charge}, per_km_charge = ${row.per_km_charge} WHERE id = ${row.id}`
    }
    return NextResponse.json({ success: true })
  }

  // Update delivery boy details
  if (type === 'update_boy') {
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
    await ensureDeliveryColumns(sql)
    await sql`UPDATE delivery_boys SET status = 'approved' WHERE id = ${data.id}::uuid`
    return NextResponse.json({ success: true })
  }

  // Reject delivery boy application
  if (type === 'reject_boy') {
    await sql`UPDATE delivery_boys SET status = 'rejected' WHERE id = ${data.id}::uuid`
    return NextResponse.json({ success: true })
  }

  // Suspend delivery boy
  if (type === 'suspend_boy') {
    await sql`UPDATE delivery_boys SET status = 'suspended', is_online = false WHERE id = ${data.id}::uuid`
    return NextResponse.json({ success: true })
  }

  // Reactivate delivery boy
  if (type === 'reactivate_boy') {
    await sql`UPDATE delivery_boys SET status = 'approved' WHERE id = ${data.id}::uuid`
    return NextResponse.json({ success: true })
  }

  // Record payment to delivery boy
  if (type === 'pay_boy') {
    await ensureDeliveryColumns(sql)
    await ensurePaymentTable(sql)
    const amount = parseFloat(data.amount)
    if (!amount || amount <= 0) return NextResponse.json({ error: 'Valid amount required' }, { status: 400 })

    await sql`
      INSERT INTO payment_records (delivery_boy_id, amount, notes)
      VALUES (${data.id}::uuid, ${amount}, ${data.notes || null})
    `
    await sql`
      UPDATE delivery_boys
      SET payment_due = GREATEST(0, COALESCE(payment_due, 0) - ${amount}),
          total_paid  = COALESCE(total_paid, 0) + ${amount}
      WHERE id = ${data.id}::uuid
    `
    const [boy] = await sql`
      SELECT id, name, COALESCE(payment_due, 0) as payment_due, COALESCE(total_paid, 0) as total_paid, total_earnings
      FROM delivery_boys WHERE id = ${data.id}::uuid
    `
    return NextResponse.json({ success: true, boy })
  }

  return NextResponse.json({ error: 'Unknown type' }, { status: 400 })
}

import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { verifyToken } from '@/lib/auth'

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
  } catch (e) {}
}

// Ensure delivery_boys has status column
async function ensureDeliveryColumns(sql) {
  try {
    await sql`ALTER TABLE delivery_boys ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'approved'`
    await sql`ALTER TABLE delivery_boys ADD COLUMN IF NOT EXISTS vehicle_type VARCHAR(50)`
    await sql`ALTER TABLE delivery_boys ADD COLUMN IF NOT EXISTS license_number VARCHAR(100)`
    await sql`ALTER TABLE delivery_boys ADD COLUMN IF NOT EXISTS aadhar_number VARCHAR(20)`
    await sql`ALTER TABLE delivery_boys ADD COLUMN IF NOT EXISTS date_of_birth DATE`
    await sql`ALTER TABLE delivery_boys ADD COLUMN IF NOT EXISTS emergency_contact VARCHAR(20)`
    await sql`ALTER TABLE delivery_boys ADD COLUMN IF NOT EXISTS home_address TEXT`
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
    const boys = await sql`
      SELECT id, name, email, phone, vehicle_number, vehicle_type, is_online,
             per_km_earning, total_earnings, rating, status, created_at,
             license_number, aadhar_number, date_of_birth, emergency_contact, home_address
      FROM delivery_boys
      WHERE status = 'approved' OR status IS NULL
      ORDER BY name
    `
    return NextResponse.json({ boys })
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
      SELECT oi.name, SUM(oi.quantity) as total_qty
      FROM order_items oi JOIN orders o ON oi.order_id = o.id
      WHERE o.created_at >= NOW() - INTERVAL '7 days'
      GROUP BY oi.name ORDER BY total_qty DESC LIMIT 5
    `
    const customerCount = await sql`SELECT COUNT(*) as count FROM users`
    return NextResponse.json({ todayStats, weekStats, topItems, customerCount: customerCount[0].count })
  }

  // Default: kitchen settings (public)
  await ensureKitchenColumns(sql)
  const [settings] = await sql`
    SELECT is_open, kitchen_name, address, phone, lat, lng,
           max_delivery_km, open_time, close_time, estimated_time, auto_schedule
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
    const [settings] = await sql`
      UPDATE kitchen_settings SET
        is_open          = COALESCE(${data.is_open ?? null}, is_open),
        kitchen_name     = COALESCE(${data.kitchen_name ?? null}, kitchen_name),
        address          = COALESCE(${data.address ?? null}, address),
        phone            = COALESCE(${data.phone ?? null}, phone),
        lat              = COALESCE(${data.lat ?? null}, lat),
        lng              = COALESCE(${data.lng ?? null}, lng),
        max_delivery_km  = COALESCE(${data.max_delivery_km ?? null}, max_delivery_km),
        open_time        = COALESCE(${data.open_time ?? null}, open_time),
        close_time       = COALESCE(${data.close_time ?? null}, close_time),
        estimated_time   = COALESCE(${data.estimated_time ?? null}, estimated_time),
        auto_schedule    = COALESCE(${data.auto_schedule ?? null}, auto_schedule),
        updated_at       = NOW()
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

  return NextResponse.json({ error: 'Unknown type' }, { status: 400 })
}

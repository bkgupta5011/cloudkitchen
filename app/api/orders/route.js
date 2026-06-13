export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { getDeliveryCharge, getMinDeliveryCharge, applyOffer } from '@/lib/utils'
import { sendPushToRole, sendPushToUser } from '@/lib/push'
import { sendOrderConfirmationEmail, sendOrderCancelEmail } from '@/lib/email'
import { sendOrderConfirmedSms, sendOrderDeliveredSms } from '@/lib/sms'
import { checkAndUpdateKitchenSchedule } from '@/lib/schedule'
import { checkAndResetDailyStock, notifyLowStock } from '@/lib/stock'

// ── Haversine distance (km) between two lat/lng points ───────────
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 +
    Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLng/2)**2
  return R * 2 * Math.asin(Math.sqrt(a))
}

// ── Find nearest active branch; fallback to first active branch ──
async function findNearestBranch(sql, lat, lng) {
  try {
    const branches = await sql`SELECT id, lat, lng FROM branches WHERE is_active = true ORDER BY created_at ASC`
    if (!branches.length) return null
    if (lat && lng) {
      let nearest = null, minDist = Infinity
      for (const b of branches) {
        if (!b.lat || !b.lng) continue
        const d = haversineKm(parseFloat(lat), parseFloat(lng), parseFloat(b.lat), parseFloat(b.lng))
        if (d < minDist) { minDist = d; nearest = b }
      }
      if (nearest) return nearest.id
    }
    // No GPS or no branch with coords → first active branch
    return branches[0].id
  } catch { return null }
}

// ── Ensure branch_id column on orders ───────────────────────────
async function ensureOrderBranchColumn(sql) {
  try { await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS branch_id UUID` } catch {}
}

// GET - orders (customer: own orders, admin: all, delivery: assigned)
export async function GET(request) {
  const sql = getDb()
  const token = request.cookies.get('ck_token')?.value
  const user = verifyToken(token)
  if (!user) return NextResponse.json({ error: 'Login required' }, { status: 401 })

  // Auto open/close kitchen by schedule on every customer order page load
  if (user.role === 'customer') await checkAndUpdateKitchenSchedule()

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const orderId = searchParams.get('id')

  // Single order detail
  if (orderId) {
    const [order] = await sql`
      SELECT o.*,
        u.name as customer_name, u.phone as customer_phone,
        d.name as delivery_boy_name, d.phone as delivery_boy_phone,
        b.name as branch_name
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN delivery_boys d ON o.delivery_boy_id = d.id
      LEFT JOIN branches b ON o.branch_id = b.id
      WHERE o.id = ${orderId}
    `
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

    const items = await sql`SELECT * FROM order_items WHERE order_id = ${orderId}`
    return NextResponse.json({ order: { ...order, items } })
  }

  // CSV Export (admin only)
  const format = searchParams.get('format')
  if (format === 'csv' && user.role === 'admin') {
    const csvDateFrom = searchParams.get('date_from')
    const csvDateTo   = searchParams.get('date_to')
    const allOrders = csvDateFrom && csvDateTo
      ? await sql`
          SELECT o.order_number, o.status, o.total, o.subtotal, o.discount_amount,
            o.delivery_charge, o.delivery_address, o.distance_km, o.notes,
            o.created_at, o.delivered_at,
            u.name as customer_name, u.phone as customer_phone,
            d.name as delivery_boy_name
          FROM orders o
          LEFT JOIN users u ON o.user_id = u.id
          LEFT JOIN delivery_boys d ON o.delivery_boy_id = d.id
          WHERE (o.created_at AT TIME ZONE 'Asia/Kolkata')::date
                BETWEEN ${csvDateFrom}::date AND ${csvDateTo}::date
          ORDER BY o.created_at DESC
        `
      : await sql`
          SELECT o.order_number, o.status, o.total, o.subtotal, o.discount_amount,
            o.delivery_charge, o.delivery_address, o.distance_km, o.notes,
            o.created_at, o.delivered_at,
            u.name as customer_name, u.phone as customer_phone,
            d.name as delivery_boy_name
          FROM orders o
          LEFT JOIN users u ON o.user_id = u.id
          LEFT JOIN delivery_boys d ON o.delivery_boy_id = d.id
          ORDER BY o.created_at DESC LIMIT 1000
        `
    const header = ['Order#','Status','Customer','Phone','Delivery Boy','Subtotal','Discount','Delivery','Total','Address','Distance(km)','Notes','Placed At','Delivered At']
    const rows = allOrders.map(o => [
      o.order_number, o.status,
      `"${(o.customer_name||'').replace(/"/g,'')}"`,
      o.customer_phone||'',
      o.delivery_boy_name||'',
      Math.round(o.subtotal), Math.round(o.discount_amount||0),
      Math.round(o.delivery_charge), Math.round(o.total),
      `"${(o.delivery_address||'').replace(/"/g,'')}"`,
      o.distance_km||'',
      `"${(o.notes||'').replace(/"/g,'')}"`,
      o.created_at ? new Date(o.created_at).toLocaleString('en-IN') : '',
      o.delivered_at ? new Date(o.delivered_at).toLocaleString('en-IN') : ''
    ])
    const csv = [header, ...rows].map(r => r.join(',')).join('\n')
    return new Response('﻿' + csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="foodfi-orders-${new Date().toISOString().slice(0,10)}.csv"`
      }
    })
  }

  let orders = []

  // IST date range (admin history filter)
  const dateFrom = searchParams.get('date_from') // YYYY-MM-DD
  const dateTo   = searchParams.get('date_to')   // YYYY-MM-DD

  if (user.role === 'customer') {
    orders = await sql`
      SELECT o.*,
        d.name as delivery_boy_name, d.phone as delivery_boy_phone,
        d.current_lat as boy_lat, d.current_lng as boy_lng,
        d.location_updated_at as boy_location_at
      FROM orders o
      LEFT JOIN delivery_boys d ON o.delivery_boy_id = d.id
      WHERE o.user_id = ${user.id}
      ORDER BY o.created_at DESC
      LIMIT 20
    `
  } else if (user.role === 'admin') {
    // Branch admin: filter by their branch only; super admin: see all
    const branchId = user.branch_id || null
    if (dateFrom && dateTo) {
      orders = branchId
        ? await sql`
            SELECT o.*, u.name as customer_name, u.phone as customer_phone,
              d.name as delivery_boy_name, b.name as branch_name
            FROM orders o
            LEFT JOIN users u ON o.user_id = u.id
            LEFT JOIN delivery_boys d ON o.delivery_boy_id = d.id
            LEFT JOIN branches b ON o.branch_id = b.id
            WHERE (o.created_at AT TIME ZONE 'Asia/Kolkata')::date BETWEEN ${dateFrom}::date AND ${dateTo}::date
              AND o.branch_id = ${branchId}::uuid
            ORDER BY o.created_at DESC LIMIT 500`
        : await sql`
            SELECT o.*, u.name as customer_name, u.phone as customer_phone,
              d.name as delivery_boy_name, b.name as branch_name
            FROM orders o
            LEFT JOIN users u ON o.user_id = u.id
            LEFT JOIN delivery_boys d ON o.delivery_boy_id = d.id
            LEFT JOIN branches b ON o.branch_id = b.id
            WHERE (o.created_at AT TIME ZONE 'Asia/Kolkata')::date BETWEEN ${dateFrom}::date AND ${dateTo}::date
            ORDER BY o.created_at DESC LIMIT 500`
    } else if (status && status !== 'all') {
      orders = branchId
        ? await sql`
            SELECT o.*, u.name as customer_name, u.phone as customer_phone,
              d.name as delivery_boy_name, b.name as branch_name
            FROM orders o
            LEFT JOIN users u ON o.user_id = u.id
            LEFT JOIN delivery_boys d ON o.delivery_boy_id = d.id
            LEFT JOIN branches b ON o.branch_id = b.id
            WHERE o.status = ${status} AND o.branch_id = ${branchId}::uuid
            ORDER BY o.created_at DESC LIMIT 100`
        : await sql`
            SELECT o.*, u.name as customer_name, u.phone as customer_phone,
              d.name as delivery_boy_name, b.name as branch_name
            FROM orders o
            LEFT JOIN users u ON o.user_id = u.id
            LEFT JOIN delivery_boys d ON o.delivery_boy_id = d.id
            LEFT JOIN branches b ON o.branch_id = b.id
            WHERE o.status = ${status}
            ORDER BY o.created_at DESC LIMIT 100`
    } else {
      orders = branchId
        ? await sql`
            SELECT o.*, u.name as customer_name, u.phone as customer_phone,
              d.name as delivery_boy_name, b.name as branch_name
            FROM orders o
            LEFT JOIN users u ON o.user_id = u.id
            LEFT JOIN delivery_boys d ON o.delivery_boy_id = d.id
            LEFT JOIN branches b ON o.branch_id = b.id
            WHERE o.branch_id = ${branchId}::uuid
            ORDER BY o.created_at DESC LIMIT 100`
        : await sql`
            SELECT o.*, u.name as customer_name, u.phone as customer_phone,
              d.name as delivery_boy_name, b.name as branch_name
            FROM orders o
            LEFT JOIN users u ON o.user_id = u.id
            LEFT JOIN delivery_boys d ON o.delivery_boy_id = d.id
            LEFT JOIN branches b ON o.branch_id = b.id
            ORDER BY o.created_at DESC LIMIT 100`
    }
  } else if (user.role === 'delivery') {
    // Ensure schema
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS boy_accepted_at TIMESTAMPTZ`.catch(() => {})
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS boy_assigned_at  TIMESTAMPTZ`.catch(() => {})
    await sql`
      CREATE TABLE IF NOT EXISTS order_rejections (
        id SERIAL PRIMARY KEY,
        order_id UUID NOT NULL,
        delivery_boy_id UUID NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(order_id, delivery_boy_id)
      )
    `.catch(() => {})

    // ── Global 5-min timeout ─────────────────────────────────────────
    // SELECT first (captures old delivery_boy_id = prev_boy_id correctly).
    // PostgreSQL RETURNING after SET col=NULL gives NULL, not the old value —
    // that was the root bug. SELECT-then-atomic-UPDATE fixes it.
    // Any delivery boy's poll triggers this (not filtered by user.id),
    // so it works even if the assigned boy's page is closed.
    const timedOut = await sql`
      SELECT id, delivery_boy_id AS prev_boy_id,
             order_number, total, distance_km, delivery_address
      FROM orders
      WHERE boy_accepted_at IS NULL
        AND delivery_boy_id IS NOT NULL
        AND status = 'pending'
        AND COALESCE(boy_assigned_at, created_at) < NOW() - INTERVAL '5 minutes'
    `.catch(() => [])

    for (const order of timedOut) {
      // Find next eligible boy BEFORE clearing (so if none → keep current boy assigned)
      // Record prev_boy as rejected so he's excluded from eligible list
      await sql`
        INSERT INTO order_rejections (order_id, delivery_boy_id)
        VALUES (${order.id}, ${order.prev_boy_id})
        ON CONFLICT DO NOTHING
      `.catch(() => {})

      const eligible = await sql`
        SELECT db.id, db.name, db.per_km_earning,
          COUNT(o2.id) FILTER (WHERE o2.status IN ('confirmed','preparing')) AS active_orders
        FROM delivery_boys db
        LEFT JOIN orders o2 ON o2.delivery_boy_id = db.id
          AND o2.status IN ('confirmed', 'preparing', 'out_for_delivery')
        WHERE db.is_online = true
          AND db.status = 'approved'
          AND NOT EXISTS (SELECT 1 FROM orders WHERE delivery_boy_id = db.id AND status = 'out_for_delivery')
          AND NOT EXISTS (SELECT 1 FROM order_rejections r WHERE r.order_id = ${order.id} AND r.delivery_boy_id = db.id)
        GROUP BY db.id, db.name, db.per_km_earning
        ORDER BY active_orders ASC, RANDOM()
        LIMIT 1
      `.catch(() => [])

      if (!eligible.length) {
        // No other boy available — undo rejection + reset 5-min window so prev boy
        // stays assigned and can still accept (order never goes into limbo)
        await sql`
          DELETE FROM order_rejections
          WHERE order_id = ${order.id} AND delivery_boy_id = ${order.prev_boy_id}
        `.catch(() => {})
        await sql`
          UPDATE orders SET boy_assigned_at = NOW()
          WHERE id = ${order.id}
            AND delivery_boy_id = ${order.prev_boy_id}
            AND boy_accepted_at IS NULL
        `.catch(() => {})
        continue
      }

      const nextBoy   = eligible[0]
      const perKm     = parseFloat(nextBoy.per_km_earning || 0)
      const distKm    = order.distance_km ? parseFloat(order.distance_km) : null
      const boyPayout = perKm > 0 ? perKm * (distKm ?? 3) : null

      // Atomic reassign — WHERE delivery_boy_id = prev_boy_id ensures only one
      // concurrent poller succeeds (race-safe). If already reassigned → skip.
      const reassigned = await sql`
        UPDATE orders
        SET delivery_boy_id = ${nextBoy.id}, boy_payout = ${boyPayout},
            boy_accepted_at = NULL, boy_assigned_at = NOW()
        WHERE id              = ${order.id}
          AND delivery_boy_id = ${order.prev_boy_id}
          AND boy_accepted_at IS NULL
        RETURNING id
      `.catch(() => [])

      if (!reassigned.length) continue   // another poller already handled it

      sendPushToUser(String(nextBoy.id), {
        title: '📦 Naya Order Assign Hua!',
        body:  `#${order.order_number} — ₹${Math.round(order.total)} · 5 min mein accept karo`,
        url:   '/delivery',
        tag:   `delivery-${order.id}`,
        requireInteraction: true,
      }, 'delivery').catch(() => {})
    }

    orders = await sql`
      SELECT o.*,
        u.name as customer_name, u.phone as customer_phone, u.address as customer_address,
        (
          SELECT COALESCE(
            JSON_AGG(
              JSON_BUILD_OBJECT('name', oi.name, 'quantity', oi.quantity, 'price', oi.price)
              ORDER BY oi.id
            ),
            '[]'::json
          )
          FROM order_items oi
          WHERE oi.order_id = o.id
        ) as items
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.delivery_boy_id = ${user.id}
        AND o.status IN ('pending', 'confirmed', 'preparing', 'out_for_delivery')
      ORDER BY o.created_at DESC
    `
  }

  return NextResponse.json({ orders })
}

// POST - place new order (customer)
export async function POST(request) {
  const sql = getDb()
  const token = request.cookies.get('ck_token')?.value
  const user = verifyToken(token)
  if (!user || user.role !== 'customer') {
    return NextResponse.json({ error: 'Customer login required' }, { status: 401 })
  }

  // Check kitchen is open
  const [settings] = await sql`SELECT is_open FROM kitchen_settings WHERE id = 1`
  if (!settings?.is_open) {
    return NextResponse.json({ error: 'Kitchen is currently closed' }, { status: 400 })
  }

  // Daily stock reset check
  await checkAndResetDailyStock()

  const body = await request.json()
  const { items, deliveryAddress, deliveryLat, deliveryLng, distanceKm, offerCode, notes } = body

  if (!items?.length || !deliveryAddress) {
    return NextResponse.json({ error: 'Items and delivery address required' }, { status: 400 })
  }

  // Calculate subtotal from DB prices (don't trust client)
  const itemIds = items.map(i => i.id)
  const menuItems = await sql`SELECT * FROM menu_items WHERE id = ANY(${itemIds}) AND is_available = true`

  let subtotal = 0
  const orderItems = []

  for (const cartItem of items) {
    const menuItem = menuItems.find(m => m.id === cartItem.id)
    if (!menuItem) return NextResponse.json({ error: `Item not available: ${cartItem.name}` }, { status: 400 })

    // ── Stock check ──────────────────────────────────────────────────
    if (menuItem.stock_count !== null && menuItem.stock_count !== undefined) {
      if (menuItem.stock_count <= 0) {
        return NextResponse.json({ error: `❌ ${menuItem.name} abhi available nahi hai (stock khatam)` }, { status: 400 })
      }
      if (menuItem.stock_count < cartItem.qty) {
        return NextResponse.json({ error: `⚠️ ${menuItem.name} ka sirf ${menuItem.stock_count} available hai` }, { status: 400 })
      }
    }

    const discountedPrice = menuItem.discount_percent > 0
      ? menuItem.price * (1 - menuItem.discount_percent / 100)
      : parseFloat(menuItem.price)

    const lineTotal = discountedPrice * cartItem.qty
    subtotal += lineTotal
    orderItems.push({
      menu_item_id: menuItem.id,
      name: menuItem.name,
      price: discountedPrice,
      quantity: cartItem.qty,
      subtotal: lineTotal,
      has_stock: menuItem.stock_count !== null && menuItem.stock_count !== undefined,
    })
  }

  // Delivery charge — pricing table se calculate karo (no hardcoded fallback)
  const deliveryCharge = (distanceKm != null && distanceKm >= 0)
    ? await getDeliveryCharge(parseFloat(distanceKm))
    : await getMinDeliveryCharge()

  // Offer
  let discountAmount = 0
  let offerId = null
  let freeDelivery = false

  if (offerCode) {
    const offerResult = await applyOffer(offerCode, subtotal)
    if (!offerResult.valid) return NextResponse.json({ error: offerResult.error }, { status: 400 })
    discountAmount = offerResult.discount
    offerId = offerResult.offer.id
    freeDelivery = offerResult.offer.type === 'free_delivery'
    // Increment used count
    await sql`UPDATE offers SET used_count = used_count + 1 WHERE id = ${offerId}`
  }

  const finalDelivery = freeDelivery ? 0 : deliveryCharge
  const total = Math.max(0, subtotal - discountAmount) + finalDelivery

  // Ensure columns exist
  try { await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS boy_payout DECIMAL(10,2)` } catch {}
  await ensureOrderBranchColumn(sql)

  // Auto-detect nearest branch
  const branchId = await findNearestBranch(sql, deliveryLat, deliveryLng)

  // Create order
  const [order] = await sql`
    INSERT INTO orders (
      user_id, offer_id, status, subtotal, discount_amount,
      delivery_charge, total, delivery_address, delivery_lat,
      delivery_lng, distance_km, notes, branch_id
    )
    VALUES (
      ${user.id}, ${offerId}, 'pending', ${subtotal}, ${discountAmount},
      ${finalDelivery}, ${total}, ${deliveryAddress},
      ${deliveryLat || null}, ${deliveryLng || null},
      ${distanceKm || null}, ${notes || null}, ${branchId || null}
    )
    RETURNING *
  `

  // Insert order items + deduct stock atomically
  for (const oi of orderItems) {
    await sql`
      INSERT INTO order_items (order_id, menu_item_id, name, price, quantity, subtotal)
      VALUES (${order.id}, ${oi.menu_item_id}, ${oi.name}, ${oi.price}, ${oi.quantity}, ${oi.subtotal})
    `
    // Deduct stock if item has stock tracking
    if (oi.has_stock) {
      const [updated] = await sql`
        UPDATE menu_items
        SET stock_count = GREATEST(0, stock_count - ${oi.quantity})
        WHERE id = ${oi.menu_item_id} AND stock_count IS NOT NULL
        RETURNING stock_count
      `
      if (updated) {
        // Fire-and-forget low stock notification
        notifyLowStock(oi.name, updated.stock_count).catch(() => {})
      }
    }
  }

  // ── SEND CONFIRMATION EMAIL (fire-and-forget) ─────────────────────
  try {
    const [customerRow] = await sql`SELECT email FROM users WHERE id = ${user.id}`
    if (customerRow?.email) {
      sendOrderConfirmationEmail({
        toEmail: customerRow.email,
        customerName: user.name,
        orderNumber: order.order_number,
        items: orderItems,
        subtotal,
        discountAmount,
        deliveryCharge: finalDelivery,
        total,
        deliveryAddress,
      }).catch(() => {})
    }
  } catch {}

  // ── AUTO-ASSIGN TO NEAREST AVAILABLE ONLINE DELIVERY BOY ────────
  let assignedBoy = null
  try {
    const availableBoys = await sql`
      SELECT db.id, db.name, db.phone,
        COUNT(o.id) FILTER (WHERE o.status IN ('confirmed','preparing')) AS active_orders
      FROM delivery_boys db
      LEFT JOIN orders o ON o.delivery_boy_id = db.id
        AND o.status IN ('confirmed', 'preparing', 'out_for_delivery')
      WHERE db.is_online = true
        AND db.status = 'approved'
        AND NOT EXISTS (
          SELECT 1 FROM orders
          WHERE delivery_boy_id = db.id AND status = 'out_for_delivery'
        )
      GROUP BY db.id, db.name, db.phone
      ORDER BY active_orders ASC, RANDOM()
      LIMIT 1
    `
    if (availableBoys.length > 0) {
      assignedBoy = availableBoys[0]
      const [boyRate] = await sql`SELECT per_km_earning FROM delivery_boys WHERE id = ${assignedBoy.id}`
      const perKm  = parseFloat(boyRate?.per_km_earning || 0)
      const distKm = distanceKm ? parseFloat(distanceKm) : null
      const boyPayout = perKm > 0 ? perKm * (distKm ?? 3) : null
      await sql`UPDATE orders SET delivery_boy_id = ${assignedBoy.id}, boy_payout = ${boyPayout}, boy_assigned_at = NOW() WHERE id = ${order.id}`
      // Notify assigned boy — order waiting for kitchen confirmation
      sendPushToUser(String(assignedBoy.id), {
        title: '📦 Naya Order Assign Hua!',
        body:  `#${order.order_number} — ₹${Math.round(order.total)} · Kitchen confirm karega tab pickup karna`,
        url:   '/delivery',
        tag:   `delivery-${order.id}`,
        requireInteraction: true,
      }, 'delivery').catch(() => {})
    }
  } catch (e) {
    console.error('Auto-assign error:', e)
  }

  // Notify all admins — new order arrived
  sendPushToRole('admin', {
    title: `🔔 Naya Order #${order.order_number}!`,
    body: assignedBoy
      ? `🛵 ${assignedBoy.name} ko assign kiya — ₹${Math.round(order.total)}`
      : `⚠️ Koi delivery boy available nahi — manually assign karo · ₹${Math.round(order.total)}`,
    url: '/admin',
    tag: 'new-order',
    requireInteraction: true,
  }).catch(() => {})

  return NextResponse.json({
    order: { ...order, delivery_boy_id: assignedBoy?.id || null },
    orderNumber: order.order_number,
    autoAssigned: !!assignedBoy,
    deliveryBoyName: assignedBoy?.name || null,
  }, { status: 201 })
}

// PATCH - update order status (admin) or mark delivered (delivery boy)
export async function PATCH(request) {
  const sql = getDb()
  const token = request.cookies.get('ck_token')?.value
  const user = verifyToken(token)
  if (!user) return NextResponse.json({ error: 'Login required' }, { status: 401 })

  const body = await request.json()
  const { orderId, status, deliveryBoyId } = body

  if (!orderId) return NextResponse.json({ error: 'Order ID required' }, { status: 400 })

  if (user.role === 'admin') {
    // Fetch current status BEFORE update — to prevent double earnings
    const [before] = await sql`SELECT status, delivery_boy_id FROM orders WHERE id = ${orderId}`
    const wasAlreadyDelivered = before?.status === 'delivered'
    const wasAlreadyCancelled = before?.status === 'cancelled'

    const [order] = await sql`
      UPDATE orders
      SET
        status = COALESCE(${status ?? null}, status),
        delivery_boy_id = COALESCE(${deliveryBoyId ?? null}, delivery_boy_id),
        delivered_at = CASE WHEN ${status} = 'delivered' THEN NOW() ELSE delivered_at END
      WHERE id = ${orderId}
      RETURNING *
    `

    // ── Stock Restore on Cancel ───────────────────────────────────────
    // If status just became 'cancelled' (and wasn't already), restore stock
    if (status === 'cancelled' && !wasAlreadyCancelled) {
      try {
        const cancelItems = await sql`SELECT menu_item_id, quantity FROM order_items WHERE order_id = ${orderId}`
        for (const ci of cancelItems) {
          await sql`
            UPDATE menu_items
            SET stock_count = stock_count + ${ci.quantity}
            WHERE id = ${ci.menu_item_id} AND stock_count IS NOT NULL
          `
        }
        console.log(`✅ Stock restored for cancelled order ${orderId}`)
      } catch (e) {
        console.error('Stock restore error on admin cancel:', e.message)
      }
    }

    // Notify delivery boy when assigned manually
    if (deliveryBoyId && order.id) {
      sendPushToUser(String(deliveryBoyId), {
        title: '📦 Naya Delivery Assignment!',
        body: `Order #${order.order_number} — ₹${Math.round(order.total)} · Address: ${(order.delivery_address||'').slice(0,50)}`,
        url: '/delivery',
        tag: `delivery-${order.id}`,
        requireInteraction: true,
      }, 'delivery').catch(() => {})
    }

    // Notify delivery boy when admin confirms their accepted order
    if (status === 'confirmed' && order.delivery_boy_id && before?.status === 'pending') {
      sendPushToUser(String(order.delivery_boy_id), {
        title: '✅ Kitchen ne Order Confirm Kar Diya!',
        body: `Order #${order.order_number} — Kitchen ja ke pickup karo 🛵`,
        url: '/delivery',
        tag: `order-confirmed-${order.id}`,
        requireInteraction: true,
      }, 'delivery').catch(() => {})
    }

    // Notify customer of status change (push + SMS)
    if (status && order.user_id) {
      const statusMessages = {
        confirmed:        { title: '✅ Order Confirm Ho Gaya!', body: `Order #${order.order_number} kitchen ne accept kar liya — prepare ho raha hai` },
        preparing:        { title: '👨‍🍳 Khana Ban Raha Hai!', body: `Order #${order.order_number} kitchen me prepare ho raha hai` },
        out_for_delivery: { title: '🛵 Order Raste Me Hai!', body: `Order #${order.order_number} delivery boy le ja raha hai — thodi der me pahuch jayega` },
        delivered:        { title: '🎉 Order Deliver Ho Gaya!', body: `Order #${order.order_number} deliver ho gaya. Khana enjoy karo! 😋` },
        cancelled:        { title: '❌ Order Cancel Ho Gaya', body: `Order #${order.order_number} cancel ho gaya. Koi problem hai toh support se contact karo` },
      }
      const msg = statusMessages[status]
      if (msg) {
        // Push notification
        sendPushToUser(String(order.user_id), { ...msg, url: '/orders', tag: `order-${order.id}` }, 'customer').catch(() => {})
        // SMS for confirmed and delivered — fetch customer phone
        if (status === 'confirmed' || status === 'delivered') {
          const [cust] = await sql`SELECT phone FROM users WHERE id = ${order.user_id}`
          if (cust?.phone) {
            if (status === 'confirmed') {
              sendOrderConfirmedSms(cust.phone, order.order_number, order.total).catch(() => {})
            } else {
              sendOrderDeliveredSms(cust.phone, order.order_number).catch(() => {})
            }
          }
        }
      }
    }

    // Update earnings ONLY if it wasn't already delivered (prevent double counting)
    if (status === 'delivered' && !wasAlreadyDelivered && order.delivery_boy_id) {
      // Use boy_payout if set, else fallback to per_km_earning * distance_km (or 3km default)
      const [boyRate] = await sql`SELECT per_km_earning FROM delivery_boys WHERE id = ${order.delivery_boy_id}`
      const perKm = parseFloat(boyRate?.per_km_earning || 0)
      const distKm = order.distance_km ? parseFloat(order.distance_km) : null
      const earned = order.boy_payout
        ? parseFloat(order.boy_payout)
        : perKm > 0 ? perKm * (distKm ?? 3) : parseFloat(order.delivery_charge || 0) * 0.7
      // Always store boy_payout so history queries show correct earnings (fixes NULL boy_payout bug)
      if (!order.boy_payout) {
        await sql`UPDATE orders SET boy_payout = ${earned} WHERE id = ${orderId}`
      }
      await sql`
        UPDATE delivery_boys
        SET total_earnings = total_earnings + ${earned},
            payment_due   = payment_due + ${earned}
        WHERE id = ${order.delivery_boy_id}
      `
    }

    return NextResponse.json({ order })
  }

  if (user.role === 'delivery') {
    // Delivery boy can mark: out_for_delivery (picked up) or delivered
    const allowedStatuses = ['out_for_delivery', 'delivered']
    if (!allowedStatuses.includes(status)) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
    }

    // Fetch current status BEFORE update — prevent double earnings
    const [before] = await sql`SELECT status FROM orders WHERE id = ${orderId} AND delivery_boy_id = ${user.id}`
    if (!before) return NextResponse.json({ error: 'Order not found or not assigned to you' }, { status: 404 })
    const wasAlreadyDelivered = before.status === 'delivered'

    const [order] = await sql`
      UPDATE orders
      SET status = ${status},
          delivered_at = CASE WHEN ${status} = 'delivered' THEN NOW() ELSE delivered_at END
      WHERE id = ${orderId} AND delivery_boy_id = ${user.id}
      RETURNING *
    `
    if (!order) return NextResponse.json({ error: 'Order not found or not assigned to you' }, { status: 404 })

    if (status === 'delivered' && !wasAlreadyDelivered) {
      // Update earnings — use boy_payout if set, else per_km_earning * distance_km (or 3km fallback)
      const [boyRate] = await sql`SELECT per_km_earning FROM delivery_boys WHERE id = ${user.id}`
      const perKm = parseFloat(boyRate?.per_km_earning || 0)
      const distKm = order.distance_km ? parseFloat(order.distance_km) : null
      const earned = order.boy_payout
        ? parseFloat(order.boy_payout)
        : perKm > 0 ? perKm * (distKm ?? 3) : parseFloat(order.delivery_charge || 0) * 0.7
      // Always store boy_payout so history queries show correct earnings (fixes NULL boy_payout bug)
      if (!order.boy_payout) {
        await sql`UPDATE orders SET boy_payout = ${earned} WHERE id = ${orderId}`
      }
      await sql`
        UPDATE delivery_boys
        SET total_earnings = total_earnings + ${earned},
            payment_due    = payment_due + ${earned}
        WHERE id = ${user.id}
      `
      // Notify customer — push + SMS
      if (order.user_id) {
        sendPushToUser(String(order.user_id), {
          title: '🎉 Order Deliver Ho Gaya!',
          body: `Order #${order.order_number} deliver ho gaya. Khana enjoy karo! 😋`,
          url: '/orders', tag: `order-${order.id}`
        }, 'customer').catch(() => {})

        // Post-delivery care message — 3 min baad
        setTimeout(async () => {
          try {
            const msgs = await sql`SELECT message FROM engagement_messages WHERE category = 'post_delivery' AND is_active = true`
            const defaultMsg = "Khana pasand aaya? 😊 Ek review doge toh hamare chef ka dil khush ho jaayega! ⭐"
            const body = msgs.length
              ? msgs[Math.floor(Math.random() * msgs.length)].message
              : defaultMsg
            sendPushToUser(String(order.user_id), {
              title: '😊 Kaisa Laga Khana? — FoodFi',
              body,
              url: '/orders',
              tag: `care-${order.id}`,
            }, 'customer').catch(() => {})
          } catch {}
        }, 3 * 60 * 1000) // 3 minutes

        // SMS notification
        const [cust] = await sql`SELECT phone FROM users WHERE id = ${order.user_id}`
        if (cust?.phone) {
          sendOrderDeliveredSms(cust.phone, order.order_number).catch(() => {})
        }
      }
    }

    if (status === 'out_for_delivery' && order.user_id) {
      sendPushToUser(String(order.user_id), {
        title: '🛵 Order Raste Me Hai!',
        body: `Order #${order.order_number} delivery boy le ja raha hai — thodi der me pahuch jayega`,
        url: '/orders', tag: `order-${order.id}`
      }, 'customer').catch(() => {})
    }

    return NextResponse.json({ order })
  }

  // ── CUSTOMER: CANCEL ORDER ───────────────────────────────────────
  if (user.role === 'customer') {
    const { orderId, action } = body
    if (action !== 'cancel') return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

    const [order] = await sql`
      SELECT o.*, u.email as customer_email
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.id = ${orderId} AND o.user_id = ${user.id}
    `
    if (!order) return NextResponse.json({ error: 'Order nahi mila' }, { status: 404 })

    if (!['pending', 'confirmed'].includes(order.status)) {
      return NextResponse.json({
        error: 'Order ab cancel nahi ho sakta — kitchen mein ban raha hai ya raste mein hai'
      }, { status: 400 })
    }

    await sql`UPDATE orders SET status = 'cancelled' WHERE id = ${orderId} AND user_id = ${user.id}`

    // ── Stock Restore on Customer Cancel ─────────────────────────────
    try {
      const cancelItems = await sql`SELECT menu_item_id, quantity FROM order_items WHERE order_id = ${orderId}`
      for (const ci of cancelItems) {
        await sql`
          UPDATE menu_items
          SET stock_count = stock_count + ${ci.quantity}
          WHERE id = ${ci.menu_item_id} AND stock_count IS NOT NULL
        `
      }
    } catch (e) {
      console.error('Stock restore error on customer cancel:', e.message)
    }

    // Notify admin
    sendPushToRole('admin', {
      title: `❌ Order #${order.order_number} Cancel Ho Gaya`,
      body: `Customer ne order cancel kar diya — ₹${Math.round(order.total)}`,
      url: '/admin', tag: `cancel-${order.id}`, requireInteraction: true,
    }).catch(() => {})

    // Notify assigned delivery boy (if any)
    if (order.delivery_boy_id) {
      sendPushToUser(String(order.delivery_boy_id), {
        title: `❌ Order #${order.order_number} Cancel Ho Gaya`,
        body: 'Customer ne order cancel kar diya. Yeh order ab aapka nahi hai.',
        url: '/delivery', tag: `cancel-${order.id}`,
      }, 'delivery').catch(() => {})
    }

    // Send cancellation email (fire-and-forget)
    if (order.customer_email) {
      sendOrderCancelEmail({
        toEmail: order.customer_email,
        customerName: user.name,
        orderNumber: order.order_number,
        total: order.total,
      }).catch(() => {})
    }

    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
}

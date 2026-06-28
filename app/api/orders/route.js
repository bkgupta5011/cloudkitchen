export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { getDeliveryCharge, getMinDeliveryCharge, getDeliveryQuote, getOrderFees, applyOffer, getBoyPayout } from '@/lib/utils'
import { reconcileLoyalty } from '@/lib/loyalty'
import { roadDistanceKm } from '@/lib/distance'
import { sendFcmToTokens } from '@/lib/fcm'
import { sendPushToRole, sendPushToUser } from '@/lib/push'
import { sendOrderConfirmationEmail, sendOrderCancelEmail, sendNewOrderAdminEmail } from '@/lib/email'
import { sendOrderConfirmedSms, sendOrderDeliveredSms, sendNewOrderSignal } from '@/lib/sms'
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

// ── Find nearest active branch that covers the customer's location ──
// 1. Prefers branch whose zone (max_delivery_km) covers the customer
// 2. Among qualifying branches → picks nearest
// 3. Fallback: nearest active branch (if no zone data set)
async function findNearestBranch(sql, lat, lng) {
  try {
    const branches = await sql`
      SELECT id, lat, lng, max_delivery_km
      FROM branches WHERE is_active = true ORDER BY created_at ASC
    `
    if (!branches.length) return null

    // Get global max_delivery_km as fallback
    const [settings] = await sql`SELECT max_delivery_km FROM kitchen_settings WHERE id = 1`
    const globalKm = parseFloat(settings?.max_delivery_km) || 0

    if (lat && lng) {
      const la = parseFloat(lat), ln = parseFloat(lng)

      // Step 1: Find all branches that cover this location (within their zone)
      const covering = []
      for (const b of branches) {
        if (!b.lat || !b.lng) continue
        const d = haversineKm(la, ln, parseFloat(b.lat), parseFloat(b.lng))
        const bKm = parseFloat(b.max_delivery_km) || 0
        const radius = bKm > 0 ? bKm : globalKm
        if (radius > 0 && d <= radius) covering.push({ ...b, dist: d })
      }

      // Step 2: Among covering branches → pick nearest
      if (covering.length > 0) {
        covering.sort((a, b) => a.dist - b.dist)
        return covering[0].id
      }

      // Step 3: No branch covers → pick nearest active branch as fallback
      let nearest = null, minDist = Infinity
      for (const b of branches) {
        if (!b.lat || !b.lng) continue
        const d = haversineKm(la, ln, parseFloat(b.lat), parseFloat(b.lng))
        if (d < minDist) { minDist = d; nearest = b }
      }
      if (nearest) return nearest.id
    }

    // No GPS → first active branch
    return branches[0].id
  } catch { return null }
}

// True if `branchId` is an active branch whose delivery zone covers (lat,lng).
// Used to honour the customer's chosen outlet only when it really serves them.
async function branchCovers(sql, branchId, lat, lng) {
  if (!branchId || lat == null || lng == null) return false
  try {
    const [b] = await sql`SELECT lat, lng, max_delivery_km FROM branches WHERE id = ${branchId}::uuid AND is_active = true`
    if (!b?.lat || !b?.lng) return false
    const [s] = await sql`SELECT max_delivery_km FROM kitchen_settings WHERE id = 1`
    const globalKm = parseFloat(s?.max_delivery_km) || 0
    const bKm = parseFloat(b.max_delivery_km) || 0
    const radius = bKm > 0 ? bKm : globalKm
    const d = haversineKm(parseFloat(lat), parseFloat(lng), parseFloat(b.lat), parseFloat(b.lng))
    return radius > 0 && d <= radius
  } catch { return false }
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

  // Ensure branch_id column exists on orders (safe, idempotent)
  await ensureOrderBranchColumn(sql)

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
      SELECT o.id, o.delivery_boy_id AS prev_boy_id,
             o.order_number, o.total, o.distance_km, o.delivery_address,
             o.branch_id,
             b.lat AS branch_lat, b.lng AS branch_lng
      FROM orders o
      LEFT JOIN branches b ON o.branch_id = b.id
      WHERE o.boy_accepted_at IS NULL
        AND o.delivery_boy_id IS NOT NULL
        AND o.status = 'pending'
        AND COALESCE(o.boy_assigned_at, o.created_at) < NOW() - INTERVAL '5 minutes'
    `.catch(() => [])

    for (const order of timedOut) {
      // Find next eligible boy BEFORE clearing (so if none → keep current boy assigned)
      // Record prev_boy as rejected so he's excluded from eligible list
      await sql`
        INSERT INTO order_rejections (order_id, delivery_boy_id)
        VALUES (${order.id}, ${order.prev_boy_id})
        ON CONFLICT DO NOTHING
      `.catch(() => {})

      const eligibleRaw = await sql`
        SELECT db.id, db.name, db.per_km_earning, db.current_lat, db.current_lng,
          COUNT(o2.id) FILTER (WHERE o2.status IN ('confirmed','preparing')) AS active_orders
        FROM delivery_boys db
        LEFT JOIN orders o2 ON o2.delivery_boy_id = db.id
          AND o2.status IN ('confirmed', 'preparing', 'out_for_delivery')
        WHERE db.is_online = true
          AND db.status = 'approved'
          AND NOT EXISTS (SELECT 1 FROM orders WHERE delivery_boy_id = db.id AND status = 'out_for_delivery')
          AND NOT EXISTS (SELECT 1 FROM order_rejections r WHERE r.order_id = ${order.id} AND r.delivery_boy_id = db.id)
        GROUP BY db.id, db.name, db.per_km_earning, db.current_lat, db.current_lng
      `.catch(() => [])

      // Proximity sort: nearest to branch first, then least busy
      let eligible = eligibleRaw
      const bLat = order.branch_lat ? parseFloat(order.branch_lat) : null
      const bLng = order.branch_lng ? parseFloat(order.branch_lng) : null
      if (bLat && bLng && eligibleRaw.length > 0) {
        const withDist = eligibleRaw.map(b => ({
          ...b,
          dist: (b.current_lat && b.current_lng)
            ? haversineKm(bLat, bLng, parseFloat(b.current_lat), parseFloat(b.current_lng))
            : Infinity
        }))
        withDist.sort((a, b) =>
          a.dist !== b.dist
            ? a.dist - b.dist
            : parseInt(a.active_orders) - parseInt(b.active_orders)
        )
        eligible = withDist
      } else {
        eligible = eligibleRaw.sort((a, b) => parseInt(a.active_orders) - parseInt(b.active_orders))
      }

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
      // Centralized payout (Kitchen Settings) — same for all boys, not per-boy rate
      const boyPayout = await getBoyPayout(order.distance_km)

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
        title: '📦 New Order Assigned!',
        body:  `#${order.order_number} — ₹${Math.round(order.total)} · accept within 5 min`,
        url:   '/delivery',
        tag:   `delivery-${order.id}`,
        requireInteraction: true,
      }, 'delivery').catch(() => {})
    }

    // Broadcast feed: OPEN orders (unclaimed, not rejected by me) + my own active orders.
    orders = await sql`
      SELECT o.*,
        u.name as customer_name, u.phone as customer_phone, u.address as customer_address,
        bb.lat as branch_lat, bb.lng as branch_lng,
        (o.delivery_boy_id IS NULL) as is_open,
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
      LEFT JOIN branches bb ON o.branch_id = bb.id
      WHERE o.status IN ('pending', 'confirmed', 'preparing', 'out_for_delivery')
        AND (
          o.delivery_boy_id = ${user.id}
          OR (
            o.delivery_boy_id IS NULL
            AND NOT EXISTS (SELECT 1 FROM order_rejections r WHERE r.order_id = o.id AND r.delivery_boy_id = ${user.id})
          )
        )
      ORDER BY o.created_at DESC
    `
    // boy→kitchen distance (from this boy's current GPS) for the accept decision.
    try {
      const [me] = await sql`SELECT current_lat, current_lng FROM delivery_boys WHERE id = ${user.id}`
      const myLat = me?.current_lat ? parseFloat(me.current_lat) : null
      const myLng = me?.current_lng ? parseFloat(me.current_lng) : null
      orders = orders.map(o => ({
        ...o,
        boy_to_kitchen_km: (myLat != null && myLng != null && o.branch_lat && o.branch_lng)
          ? Math.round(haversineKm(myLat, myLng, parseFloat(o.branch_lat), parseFloat(o.branch_lng)) * 10) / 10
          : null
      }))
    } catch {}
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
  const { items, deliveryAddress, deliveryLat, deliveryLng, distanceKm, offerCode, notes, branchId: claimedBranchId } = body

  if (!items?.length || !deliveryAddress) {
    return NextResponse.json({ error: 'Items and delivery address required' }, { status: 400 })
  }

  // Calculate subtotal from DB prices (don't trust client)
  const itemIds = items.map(i => i.id)
  const menuItems = await sql`SELECT * FROM menu_items WHERE id = ANY(${itemIds}) AND is_available = true`

  // Phase 3 — resolve the customer's branch up-front so price + stock come from
  // THAT branch (branch_inventory). When a branch has no override for an item we
  // fall back to the master menu_items value, so behaviour is unchanged unless a
  // branch-specific price/stock is actually set.
  // Honour the customer's chosen outlet only if it actually serves this address
  // (server-authoritative); otherwise fall back to the nearest serving branch.
  let branchId = await findNearestBranch(sql, deliveryLat, deliveryLng)
  if (claimedBranchId && await branchCovers(sql, claimedBranchId, deliveryLat, deliveryLng)) {
    branchId = claimedBranchId
  }
  const branchInv = {}
  if (branchId) {
    try {
      const invRows = await sql`
        SELECT menu_item_id, price, stock_count, is_available, discount_percent
        FROM branch_inventory
        WHERE branch_id = ${branchId}::uuid AND menu_item_id = ANY(${itemIds})
      `
      for (const r of invRows) branchInv[r.menu_item_id] = r
    } catch (e) {}
  }

  // Fitness Corner items — orderable ONLY when the corner is enabled + item available
  let fitRows = []
  try {
    const [fcfg] = await sql`SELECT fitness_corner_enabled FROM kitchen_settings WHERE id = 1`
    if (fcfg?.fitness_corner_enabled) {
      fitRows = await sql`SELECT * FROM fitness_items WHERE id = ANY(${itemIds}) AND is_available = true`
    }
  } catch (e) {}

  let subtotal = 0
  const orderItems = []

  for (const cartItem of items) {
    const menuItem = menuItems.find(m => m.id === cartItem.id)
    const fitItem  = !menuItem ? fitRows.find(f => f.id === cartItem.id) : null
    const src = menuItem || fitItem
    if (!src) return NextResponse.json({ error: `Item not available: ${cartItem.name}` }, { status: 400 })

    // Branch-aware effective price + stock for menu items (master fallback).
    const binv = menuItem ? branchInv[menuItem.id] : null
    const effPrice = menuItem
      ? (binv && binv.price != null ? parseFloat(binv.price) : parseFloat(menuItem.price))
      : parseFloat(src.price)
    // stock: prefer this branch's stock; if branch row has none, fall back to
    // the master stock (null on either = untracked / unlimited).
    const effStock = menuItem
      ? (binv && binv.stock_count != null ? binv.stock_count : menuItem.stock_count)
      : null
    const stockScope = (binv && binv.stock_count != null) ? 'branch'
      : (menuItem && menuItem.stock_count != null ? 'master' : null)

    // Branch explicitly turned this item OFF → not orderable from this branch.
    if (menuItem && binv && binv.is_available === false) {
      return NextResponse.json({ error: `❌ ${menuItem.name} is currently unavailable` }, { status: 400 })
    }

    // ── Stock check (uses branch stock; null/undefined = unlimited) ────
    if (menuItem && effStock !== null && effStock !== undefined) {
      if (effStock <= 0) {
        return NextResponse.json({ error: `❌ ${menuItem.name} is out of stock` }, { status: 400 })
      }
      if (effStock < cartItem.qty) {
        return NextResponse.json({ error: `⚠️ Only ${effStock} of ${menuItem.name} available` }, { status: 400 })
      }
    }

    // Branch discount overrides master discount when set.
    const effDiscount = menuItem
      ? (binv && binv.discount_percent != null ? Number(binv.discount_percent) : Number(src.discount_percent || 0))
      : Number(src.discount_percent || 0)
    const discountedPrice = effDiscount > 0
      ? effPrice * (1 - effDiscount / 100)
      : effPrice

    const lineTotal = discountedPrice * cartItem.qty
    subtotal += lineTotal
    orderItems.push({
      menu_item_id: menuItem ? menuItem.id : null,
      fitness_item_id: fitItem ? fitItem.id : null,
      name: src.name,
      price: discountedPrice,
      quantity: cartItem.qty,
      subtotal: lineTotal,
      has_stock: !!(menuItem && effStock !== null && effStock !== undefined),
      stock_scope: stockScope,
    })
  }

  // ── Server-authoritative branch + ROAD distance + radius enforcement ──
  // Never trust the client's distanceKm. Recompute road distance to the
  // assigned branch (resolved above) and reject orders outside the radius.
  let serverDistanceKm = (distanceKm != null && distanceKm >= 0) ? parseFloat(distanceKm) : null
  const dLatNum = parseFloat(deliveryLat), dLngNum = parseFloat(deliveryLng)
  if (Number.isFinite(dLatNum) && Number.isFinite(dLngNum) && branchId) {
    const [br] = await sql`SELECT lat, lng, max_delivery_km FROM branches WHERE id = ${branchId}::uuid`
    if (br?.lat && br?.lng) {
      const rd = await roadDistanceKm(parseFloat(br.lat), parseFloat(br.lng), dLatNum, dLngNum)
      serverDistanceKm = rd.km
      const [s] = await sql`SELECT max_delivery_km FROM kitchen_settings WHERE id = 1`
      const globalKm = parseFloat(s?.max_delivery_km) || 0
      const branchKm = parseFloat(br.max_delivery_km) || 0
      const radius = branchKm > 0 ? branchKm : globalKm
      // Hard-reject only on a confident (ORS) road distance, so an ORS outage
      // never falsely blocks a genuine in-range customer.
      if (rd.source === 'ors' && radius > 0 && rd.km > radius) {
        return NextResponse.json({
          error: `Sorry, ye location humari delivery range (${radius} km) se bahar hai. Aapki doori: ${rd.km} km.`,
        }, { status: 400 })
      }
    }
  }

  // Delivery charge — server road distance + free-delivery-above-threshold.
  // Free delivery kicks in when the food subtotal crosses this tier's threshold.
  let deliveryCharge, valueFreeDelivery = false
  if (serverDistanceKm != null && serverDistanceKm >= 0) {
    const q = await getDeliveryQuote(serverDistanceKm, subtotal)
    deliveryCharge = q.deliveryCharge
    valueFreeDelivery = q.freeDelivery
  } else {
    deliveryCharge = await getMinDeliveryCharge()
  }
  // Small-order fee when the subtotal is below the minimum order value.
  const { smallOrderFee } = await getOrderFees(subtotal)

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

  // Grant any loyalty reward earned so far BEFORE applying, so it can be used on
  // this very order even if the customer never opened the loyalty card.
  await reconcileLoyalty(sql, user.id)

  // ── Reward auto-apply (review reward + loyalty reward share one pipeline) ──
  // One available reward per order; amount/eligibility from DB only.
  let rewardDiscount = 0
  let rewardToUse = null
  try {
    const [rcfg] = await sql`SELECT review_reward_enabled, review_reward_min_order, loyalty_enabled FROM kitchen_settings WHERE id = 1`
    const rewardsActive = rcfg?.review_reward_enabled || rcfg?.loyalty_enabled
    if (rewardsActive) {
      let rows = []
      try {
        rows = await sql`
          SELECT id, amount, source FROM review_rewards
          WHERE customer_id = ${user.id} AND status = 'available'
          ORDER BY created_at ASC
        `
      } catch {
        // `source` column may not exist yet on older DBs — fall back without it.
        rows = await sql`
          SELECT id, amount FROM review_rewards
          WHERE customer_id = ${user.id} AND status = 'available'
          ORDER BY created_at ASC
        `
      }
      // Pick the first reward usable on this order. Loyalty rewards apply on ANY
      // order (earned over N orders); review rewards keep the min-order rule.
      for (const r of rows) {
        const isLoyalty = r.source === 'loyalty'
        const minNeeded = isLoyalty ? 0 : (parseInt(rcfg.review_reward_min_order) || 0)
        if (subtotal >= minNeeded) {
          rewardToUse = r.id
          rewardDiscount = Math.min(parseInt(r.amount) || 0, subtotal)
          break
        }
      }
    }
  } catch (e) {}

  // Coupon free-delivery OR value-based free delivery both make it free.
  const finalDelivery = (freeDelivery || valueFreeDelivery) ? 0 : deliveryCharge
  const total = Math.max(0, subtotal - discountAmount - rewardDiscount) + finalDelivery + smallOrderFee

  // Ensure columns exist
  try { await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS boy_payout DECIMAL(10,2)` } catch {}
  try { await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS review_reward_discount DECIMAL(10,2) DEFAULT 0` } catch {}
  try { await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS small_order_fee DECIMAL(10,2) DEFAULT 0` } catch {}
  await ensureOrderBranchColumn(sql)

  // Delivery boy payout — from kitchen distance, independent of what the
  // customer paid for delivery (so free/short deliveries still pay the boy fairly).
  try { await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS boy_payout DECIMAL(10,2)` } catch {}
  const boyPayout = await getBoyPayout(serverDistanceKm)

  // Create order
  const [order] = await sql`
    INSERT INTO orders (
      user_id, offer_id, status, subtotal, discount_amount, review_reward_discount,
      delivery_charge, small_order_fee, total, delivery_address, delivery_lat,
      delivery_lng, distance_km, boy_payout, notes, branch_id
    )
    VALUES (
      ${user.id}, ${offerId}, 'pending', ${subtotal}, ${discountAmount}, ${rewardDiscount},
      ${finalDelivery}, ${smallOrderFee}, ${total}, ${deliveryAddress},
      ${deliveryLat || null}, ${deliveryLng || null},
      ${serverDistanceKm || null}, ${boyPayout}, ${notes || null}, ${branchId || null}
    )
    RETURNING *
  `

  // Consume the review reward atomically (guard prevents double-spend)
  if (rewardToUse && rewardDiscount > 0) {
    await sql`
      UPDATE review_rewards
      SET status = 'used', used_order_id = ${order.id}, used_at = NOW()
      WHERE id = ${rewardToUse} AND status = 'available'
    `.catch(() => {})
  }

  // Insert order items + deduct stock atomically
  try { await sql`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS fitness_item_id UUID` } catch {}
  for (const oi of orderItems) {
    await sql`
      INSERT INTO order_items (order_id, menu_item_id, fitness_item_id, name, price, quantity, subtotal)
      VALUES (${order.id}, ${oi.menu_item_id}, ${oi.fitness_item_id || null}, ${oi.name}, ${oi.price}, ${oi.quantity}, ${oi.subtotal})
    `
    // Deduct stock if item has stock tracking — from the branch's stock when
    // the branch tracks it, otherwise from the master menu_items stock.
    if (oi.has_stock) {
      let updated
      if (oi.stock_scope === 'branch' && branchId) {
        ;[updated] = await sql`
          UPDATE branch_inventory
          SET stock_count = GREATEST(0, stock_count - ${oi.quantity})
          WHERE branch_id = ${branchId}::uuid AND menu_item_id = ${oi.menu_item_id} AND stock_count IS NOT NULL
          RETURNING stock_count
        `
      } else {
        ;[updated] = await sql`
          UPDATE menu_items
          SET stock_count = GREATEST(0, stock_count - ${oi.quantity})
          WHERE id = ${oi.menu_item_id} AND stock_count IS NOT NULL
          RETURNING stock_count
        `
      }
      if (updated) {
        // Fire-and-forget low stock notification
        notifyLowStock(oi.name, updated.stock_count).catch(() => {})
      }
    }
  }

  // ── SEND EMAILS (fire-and-forget) ─────────────────────────────────
  try {
    const [customerRow] = await sql`SELECT email, phone FROM users WHERE id = ${user.id}`
    // Customer confirmation
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
    // Admin alert — full order details to foodfi925@gmail.com
    sendNewOrderAdminEmail({
      orderNumber: order.order_number,
      customerName: user.name,
      customerPhone: customerRow?.phone,
      items: orderItems,
      subtotal,
      discountAmount,
      deliveryCharge: finalDelivery,
      total,
      deliveryAddress,
    }).catch(() => {})
  } catch {}

  // ── BROADCAST TO ALL ONLINE DELIVERY BOYS (first to accept wins) ──
  // No pre-assignment: the order stays OPEN and every online boy gets a ring.
  // The first boy to tap Accept claims it (race-safe in /api/delivery/respond).
  const assignedBoy = null
  try {
    try { await sql`ALTER TABLE delivery_boys ADD COLUMN IF NOT EXISTS fcm_token TEXT` } catch {}
    const onlineBoys = await sql`SELECT id, fcm_token FROM delivery_boys WHERE is_online = true AND status = 'approved'`
    const distTxt = serverDistanceKm ? `${Math.round(serverDistanceKm * 10) / 10} km` : ''
    const title = '🔔 New Order! Accept it first'
    const body  = `#${order.order_number} — ₹${Math.round(order.total)}${distTxt ? ' · ' + distTxt : ''} · Open the app and accept`
    // Web push (works when the page is open in a browser)
    for (const b of onlineBoys) {
      sendPushToUser(String(b.id), { title, body, url: '/delivery', tag: `new-order-${order.id}`, requireInteraction: true }, 'delivery').catch(() => {})
    }
    // FCM to the mobile app — reaches boys even when the app is closed/minimised
    sendFcmToTokens(onlineBoys.map(b => b.fcm_token), { title, body, orderId: order.id, tag: `new-order-${order.id}` }).catch(() => {})
  } catch (e) {
    console.error('Broadcast error:', e)
  }

  // Notify all admins — new order arrived
  sendPushToRole('admin', {
    title: `🔔 Naya Order #${order.order_number}!`,
    body: `₹${Math.round(order.total)} · Sab online delivery boys ko bhej diya (jo pehle accept karega usko milega)`,
    url: '/admin',
    tag: `new-order-${order.id}`,
    requireInteraction: true,
  }).catch(() => {})

  // Reliable SMS signal to kitchen/owner numbers (works even if dashboard is closed)
  sendNewOrderSignal().catch(() => {})

  // Notify branch admin specifically (if order assigned to a branch)
  if (branchId) {
    try {
      const [branchAdmin] = await sql`SELECT id, name FROM admins WHERE branch_id = ${branchId}::uuid AND is_super_admin = false LIMIT 1`
      if (branchAdmin) {
        sendPushToUser(String(branchAdmin.id), {
          title: `🏪 Naya Order #${order.order_number}!`,
          body: `₹${Math.round(order.total)} · ${deliveryAddress?.slice(0, 50) || ''}`,
          url: '/admin',
          tag: `branch-order-${order.id}`,
          requireInteraction: true,
        }, 'admin').catch(() => {})
      }
    } catch {}
  }

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
        title: '✅ Kitchen Confirmed the Order!',
        body: `Order #${order.order_number} — head to the kitchen for pickup 🛵`,
        url: '/delivery',
        tag: `order-confirmed-${order.id}`,
        requireInteraction: true,
      }, 'delivery').catch(() => {})
    }

    // Notify customer of status change (push + SMS)
    if (status && order.user_id) {
      const statusMessages = {
        confirmed:        { title: '✅ Order Confirmed!', body: `The kitchen accepted order #${order.order_number} — it's being prepared` },
        preparing:        { title: '👨‍🍳 Your Food Is Cooking!', body: `Order #${order.order_number} is being prepared in the kitchen` },
        out_for_delivery: { title: '🛵 Order On the Way!', body: `Order #${order.order_number} is out for delivery — it'll reach you shortly` },
        delivered:        { title: '🎉 Order Delivered!', body: `Order #${order.order_number} has been delivered. Enjoy your meal! 😋` },
        cancelled:        { title: '❌ Order Cancelled', body: `Order #${order.order_number} was cancelled. If there's any issue, contact support` },
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

    // Loyalty: grant any earned reward (self-healing).
    if (status === 'delivered' && !wasAlreadyDelivered) {
      await reconcileLoyalty(sql, order.user_id)
    }

    // Update earnings ONLY if it wasn't already delivered (prevent double counting)
    if (status === 'delivered' && !wasAlreadyDelivered && order.delivery_boy_id) {
      // Use stored boy_payout (centralized), else compute from Kitchen Settings
      const earned = order.boy_payout
        ? parseFloat(order.boy_payout)
        : await getBoyPayout(order.distance_km)
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
      // Loyalty: grant any earned reward (self-healing).
      await reconcileLoyalty(sql, order.user_id)
      // Use stored boy_payout (centralized), else compute from Kitchen Settings
      const earned = order.boy_payout
        ? parseFloat(order.boy_payout)
        : await getBoyPayout(order.distance_km)
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
          title: '🎉 Order Delivered!',
          body: `Order #${order.order_number} has been delivered. Enjoy your meal! 😋`,
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

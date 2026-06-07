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
        d.name as delivery_boy_name, d.phone as delivery_boy_phone
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN delivery_boys d ON o.delivery_boy_id = d.id
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
    // Date range filter — convert IST date to UTC range
    if (dateFrom && dateTo) {
      orders = await sql`
        SELECT o.*,
          u.name as customer_name, u.phone as customer_phone,
          d.name as delivery_boy_name
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.id
        LEFT JOIN delivery_boys d ON o.delivery_boy_id = d.id
        WHERE (o.created_at AT TIME ZONE 'Asia/Kolkata')::date
              BETWEEN ${dateFrom}::date AND ${dateTo}::date
        ORDER BY o.created_at DESC
        LIMIT 500
      `
    } else if (status && status !== 'all') {
      orders = await sql`
        SELECT o.*,
          u.name as customer_name, u.phone as customer_phone,
          d.name as delivery_boy_name
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.id
        LEFT JOIN delivery_boys d ON o.delivery_boy_id = d.id
        WHERE o.status = ${status}
        ORDER BY o.created_at DESC
        LIMIT 100
      `
    } else {
      orders = await sql`
        SELECT o.*,
          u.name as customer_name, u.phone as customer_phone,
          d.name as delivery_boy_name
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.id
        LEFT JOIN delivery_boys d ON o.delivery_boy_id = d.id
        ORDER BY o.created_at DESC
        LIMIT 100
      `
    }
  } else if (user.role === 'delivery') {
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
        AND o.status IN ('out_for_delivery', 'confirmed', 'preparing')
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

  // Ensure boy_payout column exists
  try { await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS boy_payout DECIMAL(10,2)` } catch {}

  // Create order
  const [order] = await sql`
    INSERT INTO orders (
      user_id, offer_id, status, subtotal, discount_amount,
      delivery_charge, total, delivery_address, delivery_lat,
      delivery_lng, distance_km, notes
    )
    VALUES (
      ${user.id}, ${offerId}, 'pending', ${subtotal}, ${discountAmount},
      ${finalDelivery}, ${total}, ${deliveryAddress},
      ${deliveryLat || null}, ${deliveryLng || null},
      ${distanceKm || null}, ${notes || null}
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

  // ── BROADCAST TO ALL ONLINE DELIVERY BOYS ────────────────────────
  // No auto-assign — all online boys get notified; first to accept gets the order
  let onlineBoyCount = 0
  try {
    const onlineBoys = await sql`
      SELECT id, name FROM delivery_boys
      WHERE is_online = true AND status = 'approved'
    `
    onlineBoyCount = onlineBoys.length
    for (const boy of onlineBoys) {
      sendPushToUser(String(boy.id), {
        title: '🔔 Naya Order! Jaldi Accept Karo',
        body:  `#${order.order_number} — ₹${Math.round(order.total)} · ${(deliveryAddress || '').slice(0, 45)}`,
        url:   '/delivery',
        tag:   `new-order-${order.id}`,
        requireInteraction: true,
      }, 'delivery').catch(() => {})
    }
  } catch (e) {
    console.error('Broadcast error:', e)
  }

  // Notify all admins — new order arrived
  sendPushToRole('admin', {
    title: `🔔 Naya Order #${order.order_number}!`,
    body: onlineBoyCount > 0
      ? `${onlineBoyCount} delivery boy${onlineBoyCount > 1 ? 's' : ''} ko notify kiya — ₹${Math.round(order.total)}`
      : `⚠️ Koi delivery boy online nahi — manually assign karo · ₹${Math.round(order.total)}`,
    url: '/admin',
    tag: 'new-order',
    requireInteraction: true,
  }).catch(() => {})

  return NextResponse.json({
    order: { ...order, delivery_boy_id: null },
    orderNumber: order.order_number,
    autoAssigned: false,
    deliveryBoyName: null,
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

    // Notify delivery boy when assigned
    if (deliveryBoyId && order.id) {
      sendPushToUser(String(deliveryBoyId), {
        title: '📦 Naya Delivery Assignment!',
        body: `Order #${order.order_number} — ₹${Math.round(order.total)} · Address: ${(order.delivery_address||'').slice(0,50)}`,
        url: '/delivery',
        tag: `delivery-${order.id}`,
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

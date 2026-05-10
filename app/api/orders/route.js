export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { getDeliveryCharge, getMinDeliveryCharge, applyOffer } from '@/lib/utils'
import { sendPushToRole, sendPushToUser } from '@/lib/push'

// GET - orders (customer: own orders, admin: all, delivery: assigned)
export async function GET(request) {
  const sql = getDb()
  const token = request.cookies.get('ck_token')?.value
  const user = verifyToken(token)
  if (!user) return NextResponse.json({ error: 'Login required' }, { status: 401 })

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
    const allOrders = await sql`
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

  if (user.role === 'customer') {
    orders = await sql`
      SELECT o.*, d.name as delivery_boy_name, d.phone as delivery_boy_phone
      FROM orders o
      LEFT JOIN delivery_boys d ON o.delivery_boy_id = d.id
      WHERE o.user_id = ${user.id}
      ORDER BY o.created_at DESC
      LIMIT 20
    `
  } else if (user.role === 'admin') {
    if (status && status !== 'all') {
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
        u.name as customer_name, u.phone as customer_phone, u.address as customer_address
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
      subtotal: lineTotal
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

  // Insert order items
  for (const oi of orderItems) {
    await sql`
      INSERT INTO order_items (order_id, menu_item_id, name, price, quantity, subtotal)
      VALUES (${order.id}, ${oi.menu_item_id}, ${oi.name}, ${oi.price}, ${oi.quantity}, ${oi.subtotal})
    `
  }

  // Notify all admins — new order arrived
  sendPushToRole('admin', {
    title: `🔔 Naya Order #${order.order_number}!`,
    body: `₹${Math.round(order.total)} · ${items.map(i => i.name).join(', ').slice(0, 60)}`,
    url: '/admin',
    tag: 'new-order',
    requireInteraction: true,
  }).catch(() => {})

  return NextResponse.json({ order, orderNumber: order.order_number }, { status: 201 })
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
    const updates = {}
    if (status) updates.status = status
    if (deliveryBoyId) updates.delivery_boy_id = deliveryBoyId

    const [order] = await sql`
      UPDATE orders
      SET
        status = COALESCE(${status ?? null}, status),
        delivery_boy_id = COALESCE(${deliveryBoyId ?? null}, delivery_boy_id),
        delivered_at = CASE WHEN ${status} = 'delivered' THEN NOW() ELSE delivered_at END
      WHERE id = ${orderId}
      RETURNING *
    `

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

    // Notify customer of status change
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
        sendPushToUser(String(order.user_id), { ...msg, url: '/orders', tag: `order-${order.id}` }, 'customer').catch(() => {})
      }
    }

    // Update delivery boy earnings if delivered
    if (status === 'delivered' && order.delivery_boy_id) {
      const earned = parseFloat(order.delivery_charge || 0) * 0.7
      await sql`
        UPDATE delivery_boys
        SET total_earnings  = total_earnings + ${earned},
            payment_due     = payment_due + ${earned}
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

    const [order] = await sql`
      UPDATE orders
      SET status = ${status},
          delivered_at = CASE WHEN ${status} = 'delivered' THEN NOW() ELSE delivered_at END
      WHERE id = ${orderId} AND delivery_boy_id = ${user.id}
      RETURNING *
    `
    if (!order) return NextResponse.json({ error: 'Order not found or not assigned to you' }, { status: 404 })

    if (status === 'delivered') {
      // Update earnings — parseFloat to handle Neon returning NUMERIC as string
      const earned = parseFloat(order.delivery_charge || 0) * 0.7
      await sql`
        UPDATE delivery_boys
        SET total_earnings = total_earnings + ${earned},
            payment_due    = payment_due + ${earned}
        WHERE id = ${user.id}
      `
      // Notify customer
      if (order.user_id) {
        sendPushToUser(String(order.user_id), {
          title: '🎉 Order Deliver Ho Gaya!',
          body: `Order #${order.order_number} deliver ho gaya. Khana enjoy karo! 😋`,
          url: '/orders', tag: `order-${order.id}`
        }, 'customer').catch(() => {})
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

  return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
}

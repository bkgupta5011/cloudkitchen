export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { getDeliveryCharge, applyOffer } from '@/lib/utils'

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

  // Delivery charge
  const deliveryCharge = distanceKm ? await getDeliveryCharge(distanceKm) : 30

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
    // Delivery boy can only mark their assigned orders as delivered
    const [order] = await sql`
      UPDATE orders
      SET status = 'delivered', delivered_at = NOW()
      WHERE id = ${orderId} AND delivery_boy_id = ${user.id}
      RETURNING *
    `
    if (!order) return NextResponse.json({ error: 'Order not found or not assigned to you' }, { status: 404 })

    // Update earnings — parseFloat to handle Neon returning NUMERIC as string
    const earned = parseFloat(order.delivery_charge || 0) * 0.7
    await sql`
      UPDATE delivery_boys
      SET total_earnings = total_earnings + ${earned},
          payment_due    = payment_due + ${earned}
      WHERE id = ${user.id}
    `
    return NextResponse.json({ order })
  }

  return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
}

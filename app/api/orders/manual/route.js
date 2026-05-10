export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { verifyToken } from '@/lib/auth'

export async function POST(request) {
  const sql = getDb()
  const token = request.cookies.get('ck_token')?.value
  const user = verifyToken(token)
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Admin login required' }, { status: 401 })
  }

  const body = await request.json()
  const { customerName, customerPhone, address, notes, deliveryCharge, items } = body

  if (!customerName || !address) {
    return NextResponse.json({ error: 'Customer name and address required' }, { status: 400 })
  }

  const itemEntries = Object.entries(items || {}).filter(([_, qty]) => qty > 0)
  if (!itemEntries.length) {
    return NextResponse.json({ error: 'Kam se kam ek item select karo' }, { status: 400 })
  }

  const itemIds = itemEntries.map(([id]) => id)
  const menuItems = await sql`SELECT * FROM menu_items WHERE id = ANY(${itemIds})`

  let subtotal = 0
  const orderItems = []

  for (const [itemId, qty] of itemEntries) {
    const menuItem = menuItems.find(m => m.id === itemId)
    if (!menuItem) continue
    const price = menuItem.discount_percent > 0
      ? parseFloat(menuItem.price) * (1 - menuItem.discount_percent / 100)
      : parseFloat(menuItem.price)
    const lineTotal = price * qty
    subtotal += lineTotal
    orderItems.push({ menu_item_id: menuItem.id, name: menuItem.name, price, quantity: qty, subtotal: lineTotal })
  }

  const charge = parseFloat(deliveryCharge) || 30
  const total = subtotal + charge
  const orderNotes = `[📞 Phone Order] Customer: ${customerName}, Phone: ${customerPhone || 'N/A'}${notes ? '. ' + notes : ''}`

  const [order] = await sql`
    INSERT INTO orders (status, subtotal, discount_amount, delivery_charge, total, delivery_address, notes)
    VALUES ('confirmed', ${subtotal}, 0, ${charge}, ${total}, ${address}, ${orderNotes})
    RETURNING *
  `

  for (const oi of orderItems) {
    await sql`
      INSERT INTO order_items (order_id, menu_item_id, name, price, quantity, subtotal)
      VALUES (${order.id}, ${oi.menu_item_id}, ${oi.name}, ${oi.price}, ${oi.quantity}, ${oi.subtotal})
    `
  }

  return NextResponse.json({ order, orderNumber: order.order_number }, { status: 201 })
}

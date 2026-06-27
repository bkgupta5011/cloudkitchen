export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { verifyToken, hashPassword } from '@/lib/auth'
import { getBoyPayout } from '@/lib/utils'
import { roadDistanceKm } from '@/lib/distance'
import crypto from 'crypto'

async function getDefaultBranch(sql) {
  try {
    const [b] = await sql`SELECT id FROM branches WHERE is_active = true ORDER BY created_at ASC LIMIT 1`
    return b?.id || null
  } catch { return null }
}

function normalizePhone(phone) {
  if (!phone) return ''
  const digits = String(phone).replace(/[^0-9]/g, '').replace(/^91/, '').slice(-10)
  return digits.length === 10 ? '+91' + digits : ''
}

// Find an existing customer by phone, else create one. Returns the user id.
// This links the phone order to a real customer account so it shows the name,
// appears in the Customers list, and — when that person later logs in with the
// same number — appears in their order history. No duplicate if already exists.
async function findOrCreateCustomer(sql, name, phone) {
  const normalized = normalizePhone(phone)
  if (!normalized) return null
  const digits = normalized.replace('+91', '')
  const variants = [normalized, '91' + digits, digits]

  for (const p of variants) {
    const [u] = await sql`SELECT id, name FROM users WHERE phone = ${p} LIMIT 1`.catch(() => [])
    if (u) {
      // Fill the name if the existing account doesn't have one yet.
      if ((!u.name || !u.name.trim()) && name && name.trim()) {
        await sql`UPDATE users SET name = ${name.trim()} WHERE id = ${u.id}`.catch(() => {})
      }
      return u.id
    }
  }

  // Not found → create a new customer (OTP-style account, no password login).
  try {
    try { await sql`ALTER TABLE users ALTER COLUMN email DROP NOT NULL` } catch {}
    const dummyHash = await hashPassword(crypto.randomUUID())
    const [newU] = await sql`
      INSERT INTO users (name, email, phone, address, password_hash)
      VALUES (${(name || '').trim()}, NULL, ${normalized}, '', ${dummyHash})
      RETURNING id
    `
    return newU.id
  } catch (e) {
    const [retry] = await sql`SELECT id FROM users WHERE phone = ${normalized} LIMIT 1`.catch(() => [])
    return retry?.id || null
  }
}

export async function POST(request) {
  const sql = getDb()
  const token = request.cookies.get('ck_token')?.value
  const user = verifyToken(token)
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Admin login required' }, { status: 401 })
  }

  const body = await request.json()
  const { customerName, customerPhone, address, notes, deliveryCharge, items, deliveryLat, deliveryLng } = body

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

  // Respect a manually-entered delivery charge — including 0 (the old `|| 30`
  // turned 0 into 30 because 0 is falsy).
  const parsedCharge = parseFloat(deliveryCharge)
  const charge = Number.isFinite(parsedCharge) ? parsedCharge : 30
  const total = subtotal + charge
  const orderNotes = `[📞 Phone Order] Customer: ${customerName}, Phone: ${customerPhone || 'N/A'}${notes ? '. ' + notes : ''}`

  try { await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS branch_id UUID` } catch {}
  const branchId = await getDefaultBranch(sql)

  // Link (or create) the customer so the order has a name + shows in history.
  const userId = await findOrCreateCustomer(sql, customerName, customerPhone)

  const lat = (deliveryLat != null && deliveryLat !== '' && Number.isFinite(parseFloat(deliveryLat))) ? parseFloat(deliveryLat) : null
  const lng = (deliveryLng != null && deliveryLng !== '' && Number.isFinite(parseFloat(deliveryLng))) ? parseFloat(deliveryLng) : null

  // Road distance (kitchen→customer) for navigation + boy payout, if location set.
  let distanceKm = null
  if (lat != null && lng != null && branchId) {
    const [br] = await sql`SELECT lat, lng FROM branches WHERE id = ${branchId}::uuid`.catch(() => [])
    if (br?.lat && br?.lng) {
      const rd = await roadDistanceKm(parseFloat(br.lat), parseFloat(br.lng), lat, lng)
      distanceKm = rd.km
    }
  }
  try { await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS boy_payout DECIMAL(10,2)` } catch {}
  const boyPayout = await getBoyPayout(distanceKm)

  const [order] = await sql`
    INSERT INTO orders (user_id, status, subtotal, discount_amount, delivery_charge, total, delivery_address, delivery_lat, delivery_lng, distance_km, boy_payout, notes, branch_id)
    VALUES (${userId || null}, 'confirmed', ${subtotal}, 0, ${charge}, ${total}, ${address}, ${lat}, ${lng}, ${distanceKm}, ${boyPayout}, ${orderNotes}, ${branchId || null})
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

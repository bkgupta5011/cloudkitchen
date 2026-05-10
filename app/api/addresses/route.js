export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { verifyToken } from '@/lib/auth'

async function ensureTable(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS customer_addresses (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id UUID NOT NULL,
      label VARCHAR(50) DEFAULT 'Home',
      address_text TEXT NOT NULL,
      lat NUMERIC,
      lng NUMERIC,
      is_default BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `
}

// GET — list user's saved addresses
export async function GET(request) {
  const sql = getDb()
  const token = request.cookies.get('ck_token')?.value
  const user = verifyToken(token)
  if (!user || user.role !== 'customer') {
    return NextResponse.json({ error: 'Customer login required' }, { status: 401 })
  }
  await ensureTable(sql)
  const addresses = await sql`
    SELECT * FROM customer_addresses WHERE user_id = ${user.id} ORDER BY is_default DESC, created_at ASC
  `
  return NextResponse.json({ addresses })
}

// POST — add new address
export async function POST(request) {
  const sql = getDb()
  const token = request.cookies.get('ck_token')?.value
  const user = verifyToken(token)
  if (!user || user.role !== 'customer') {
    return NextResponse.json({ error: 'Customer login required' }, { status: 401 })
  }
  await ensureTable(sql)

  const { label, address_text, lat, lng, is_default } = await request.json()
  if (!address_text) return NextResponse.json({ error: 'Address required' }, { status: 400 })

  // If setting as default, unset others
  if (is_default) {
    await sql`UPDATE customer_addresses SET is_default = false WHERE user_id = ${user.id}`
  }

  const [address] = await sql`
    INSERT INTO customer_addresses (user_id, label, address_text, lat, lng, is_default)
    VALUES (${user.id}, ${label || 'Home'}, ${address_text}, ${lat || null}, ${lng || null}, ${is_default || false})
    RETURNING *
  `
  return NextResponse.json({ address })
}

// PATCH — update or set default
export async function PATCH(request) {
  const sql = getDb()
  const token = request.cookies.get('ck_token')?.value
  const user = verifyToken(token)
  if (!user || user.role !== 'customer') {
    return NextResponse.json({ error: 'Customer login required' }, { status: 401 })
  }
  await ensureTable(sql)

  const { id, label, address_text, is_default } = await request.json()
  if (!id) return NextResponse.json({ error: 'Address ID required' }, { status: 400 })

  if (is_default) {
    await sql`UPDATE customer_addresses SET is_default = false WHERE user_id = ${user.id}`
  }

  const [address] = await sql`
    UPDATE customer_addresses SET
      label        = COALESCE(${label        ?? null}, label),
      address_text = COALESCE(${address_text ?? null}, address_text),
      is_default   = COALESCE(${is_default   ?? null}, is_default)
    WHERE id = ${id} AND user_id = ${user.id}
    RETURNING *
  `
  return NextResponse.json({ address })
}

// DELETE — remove an address
export async function DELETE(request) {
  const sql = getDb()
  const token = request.cookies.get('ck_token')?.value
  const user = verifyToken(token)
  if (!user || user.role !== 'customer') {
    return NextResponse.json({ error: 'Customer login required' }, { status: 401 })
  }
  await ensureTable(sql)

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  await sql`DELETE FROM customer_addresses WHERE id = ${id} AND user_id = ${user.id}`
  return NextResponse.json({ success: true })
}

export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { verifyToken } from '@/lib/auth'

// Ensure user_carts table exists (runs once, idempotent)
async function ensureTable(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS user_carts (
      user_id    UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      cart_data  JSONB NOT NULL DEFAULT '{}',
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `.catch(() => {})
}

// GET — return current user's cart from DB
export async function GET(request) {
  const sql   = getDb()
  const token = request.cookies.get('ck_token')?.value
  const user  = verifyToken(token)
  if (!user || user.role !== 'customer') {
    return NextResponse.json({ cart: {} })
  }

  await ensureTable(sql)

  const [row] = await sql`
    SELECT cart_data FROM user_carts WHERE user_id = ${user.id}
  `.catch(() => [])

  return NextResponse.json({ cart: row?.cart_data || {} })
}

// PUT — save full cart to DB (replaces existing)
export async function PUT(request) {
  const sql   = getDb()
  const token = request.cookies.get('ck_token')?.value
  const user  = verifyToken(token)
  if (!user || user.role !== 'customer') {
    return NextResponse.json({ success: false }, { status: 401 })
  }

  const { cart } = await request.json()
  if (typeof cart !== 'object' || cart === null) {
    return NextResponse.json({ success: false }, { status: 400 })
  }

  await ensureTable(sql)

  await sql`
    INSERT INTO user_carts (user_id, cart_data, updated_at)
    VALUES (${user.id}, ${JSON.stringify(cart)}::jsonb, NOW())
    ON CONFLICT (user_id) DO UPDATE
      SET cart_data  = ${JSON.stringify(cart)}::jsonb,
          updated_at = NOW()
  `

  return NextResponse.json({ success: true })
}

// DELETE — clear cart (called after order placed)
export async function DELETE(request) {
  const sql   = getDb()
  const token = request.cookies.get('ck_token')?.value
  const user  = verifyToken(token)
  if (!user || user.role !== 'customer') {
    return NextResponse.json({ success: false }, { status: 401 })
  }

  await ensureTable(sql)

  await sql`
    DELETE FROM user_carts WHERE user_id = ${user.id}
  `.catch(() => {})

  return NextResponse.json({ success: true })
}

export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { verifyToken } from '@/lib/auth'

export async function GET(request) {
  const sql = getDb()
  const token = request.cookies.get('ck_token')?.value
  const user  = verifyToken(token)

  if (!user || user.role !== 'delivery') {
    return NextResponse.json({ error: 'Delivery boy login required' }, { status: 401 })
  }

  // Ensure rejections table exists
  await sql`
    CREATE TABLE IF NOT EXISTS order_rejections (
      id               SERIAL PRIMARY KEY,
      order_id         UUID NOT NULL,
      delivery_boy_id  UUID NOT NULL,
      created_at       TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(order_id, delivery_boy_id)
    )
  `.catch(() => {})

  // Unassigned pending orders — not already rejected by this boy
  const orders = await sql`
    SELECT
      o.id, o.order_number, o.delivery_address, o.delivery_lat, o.delivery_lng,
      o.total, o.delivery_charge, o.distance_km, o.notes, o.created_at,
      u.name  AS customer_name,
      u.phone AS customer_phone,
      (
        SELECT COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT('name', oi.name, 'quantity', oi.quantity, 'price', oi.price)
            ORDER BY oi.id
          ),
          '[]'::json
        )
        FROM order_items oi WHERE oi.order_id = o.id
      ) AS items
    FROM orders o
    LEFT JOIN users u ON o.user_id = u.id
    WHERE o.status = 'pending'
      AND o.delivery_boy_id IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM order_rejections r
        WHERE r.order_id = o.id AND r.delivery_boy_id = ${user.id}
      )
    ORDER BY o.created_at ASC
    LIMIT 5
  `

  const response = NextResponse.json({ orders })
  response.headers.set('Cache-Control', 'no-store')
  return response
}

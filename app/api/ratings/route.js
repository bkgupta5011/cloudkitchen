export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { verifyToken } from '@/lib/auth'

async function ensureRatingsTable(sql) {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS order_ratings (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        order_id UUID NOT NULL UNIQUE,
        customer_id UUID NOT NULL,
        rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
        comment TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `
  } catch (e) {}
}

// GET — check if order already rated (customer), or get all ratings (admin)
export async function GET(request) {
  const sql = getDb()
  await ensureRatingsTable(sql)
  const token = request.cookies.get('ck_token')?.value
  const user = verifyToken(token)
  if (!user) return NextResponse.json({ error: 'Login required' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const orderId = searchParams.get('orderId')

  if (orderId) {
    const [rating] = await sql`SELECT * FROM order_ratings WHERE order_id = ${orderId}`
    return NextResponse.json({ rating: rating || null })
  }

  if (user.role === 'admin') {
    const [stats] = await sql`
      SELECT
        ROUND(AVG(rating)::numeric, 1) as avg_rating,
        COUNT(*) as total_ratings,
        COUNT(CASE WHEN rating = 5 THEN 1 END) as five_star,
        COUNT(CASE WHEN rating = 4 THEN 1 END) as four_star,
        COUNT(CASE WHEN rating = 3 THEN 1 END) as three_star,
        COUNT(CASE WHEN rating <= 2 THEN 1 END) as low_star
      FROM order_ratings
    `
    const recent = await sql`
      SELECT r.*, o.order_number, u.name as customer_name
      FROM order_ratings r
      JOIN orders o ON r.order_id = o.id
      JOIN users u ON r.customer_id = u.id
      ORDER BY r.created_at DESC
      LIMIT 20
    `
    return NextResponse.json({ stats, recent })
  }

  return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
}

// POST — customer submits rating for a delivered order
export async function POST(request) {
  const sql = getDb()
  const token = request.cookies.get('ck_token')?.value
  const user = verifyToken(token)
  if (!user || user.role !== 'customer') {
    return NextResponse.json({ error: 'Customer login required' }, { status: 401 })
  }

  await ensureRatingsTable(sql)
  const { orderId, rating, comment } = await request.json()

  if (!orderId || !rating || rating < 1 || rating > 5) {
    return NextResponse.json({ error: 'Valid order aur rating (1-5) chahiye' }, { status: 400 })
  }

  // Customer ka delivered order verify karo
  const [order] = await sql`
    SELECT * FROM orders WHERE id = ${orderId} AND user_id = ${user.id} AND status = 'delivered'
  `
  if (!order) return NextResponse.json({ error: 'Order nahi mila ya deliver nahi hua' }, { status: 404 })

  const [saved] = await sql`
    INSERT INTO order_ratings (order_id, customer_id, rating, comment)
    VALUES (${orderId}, ${user.id}, ${rating}, ${comment || null})
    ON CONFLICT (order_id) DO UPDATE SET rating = ${rating}, comment = ${comment || null}
    RETURNING *
  `
  return NextResponse.json({ rating: saved })
}

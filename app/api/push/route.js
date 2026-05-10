// Subscribe / Unsubscribe push endpoints
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { verifyToken } from '@/lib/auth'

async function ensureTable(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR(100) NOT NULL,
      role VARCHAR(20) DEFAULT 'customer',
      subscription JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, subscription)
    )
  `
}

// POST — save subscription
export async function POST(request) {
  try {
    const sql = getDb()
    const token = request.cookies.get('ck_token')?.value
    const user = verifyToken(token)
    if (!user) return NextResponse.json({ error: 'Login required' }, { status: 401 })

    await ensureTable(sql)
    const { subscription } = await request.json()
    if (!subscription?.endpoint) return NextResponse.json({ error: 'Bad subscription' }, { status: 400 })

    // Upsert — avoid duplicates
    await sql`
      INSERT INTO push_subscriptions (user_id, role, subscription)
      VALUES (${String(user.id)}, ${user.role}, ${JSON.stringify(subscription)})
      ON CONFLICT (user_id, subscription) DO NOTHING
    `
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// DELETE — remove subscription (when user logs out or denies)
export async function DELETE(request) {
  try {
    const sql = getDb()
    const token = request.cookies.get('ck_token')?.value
    const user = verifyToken(token)
    if (!user) return NextResponse.json({ ok: true })

    await ensureTable(sql)
    const { subscription } = await request.json()
    if (subscription?.endpoint) {
      await sql`
        DELETE FROM push_subscriptions
        WHERE user_id = ${String(user.id)}
          AND subscription->>'endpoint' = ${subscription.endpoint}
      `
    }
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: true })
  }
}

export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { verifyToken } from '@/lib/auth'

async function ensureTable(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS google_api_usage (
      id SERIAL PRIMARY KEY,
      call_type VARCHAR(20) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
}

// Lightweight in-memory rate limit: max 30 POSTs per IP per minute.
// Real customers make only a handful of calls per session; this only
// stops someone hammering the endpoint to bloat the table (DoS).
const rlHits = new Map() // ip -> { count, resetAt }
const RL_MAX = 30
const RL_WINDOW_MS = 60 * 1000

function rateLimited(ip) {
  const now = Date.now()
  const rec = rlHits.get(ip)
  if (!rec || now > rec.resetAt) {
    rlHits.set(ip, { count: 1, resetAt: now + RL_WINDOW_MS })
    return false
  }
  rec.count++
  if (rec.count > RL_MAX) return true
  return false
}

// POST — record a usage event (called from client, no auth needed)
export async function POST(request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'
    if (rateLimited(ip)) return NextResponse.json({ ok: false }, { status: 429 })

    const sql = getDb()
    await ensureTable(sql)
    const { type } = await request.json()
    const allowed = ['geocoding', 'maps', 'places']
    if (!allowed.includes(type)) return NextResponse.json({ ok: false })
    await sql`INSERT INTO google_api_usage (call_type) VALUES (${type})`
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false })
  }
}

// GET — stats for admin
export async function GET(request) {
  try {
    const sql = getDb()
    const token = request.cookies.get('ck_token')?.value
    const user = verifyToken(token)
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await ensureTable(sql)

    // Today stats
    const today = await sql`
      SELECT call_type, COUNT(*) as count
      FROM google_api_usage
      WHERE created_at >= CURRENT_DATE
      GROUP BY call_type
    `

    // This month stats
    const month = await sql`
      SELECT call_type, COUNT(*) as count
      FROM google_api_usage
      WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)
      GROUP BY call_type
    `

    // Last 7 days daily breakdown
    const daily = await sql`
      SELECT DATE(created_at) as day, call_type, COUNT(*) as count
      FROM google_api_usage
      WHERE created_at >= CURRENT_DATE - INTERVAL '6 days'
      GROUP BY day, call_type
      ORDER BY day DESC
    `

    const toMap = (rows) => {
      const m = { geocoding: 0, maps: 0, places: 0 }
      for (const r of rows) m[r.call_type] = (m[r.call_type] || 0) + parseInt(r.count)
      return m
    }

    const todayMap  = toMap(today)
    const monthMap  = toMap(month)

    // Cost estimates (USD per call) — Google Maps Platform pricing
    const COST = { geocoding: 0.005, maps: 0.007, places: 0.00283 }
    const calcCost = (m) => Object.entries(m).reduce((s, [k, v]) => s + v * (COST[k] || 0), 0)

    return NextResponse.json({
      today: todayMap,
      month: monthMap,
      todayCost: calcCost(todayMap),
      monthCost: calcCost(monthMap),
      freeCredit: 200, // $200/month free credit
      daily,
    })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

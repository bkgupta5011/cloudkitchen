export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

// Public endpoint — returns active branches with lat/lng for customer map
export async function GET() {
  const sql = getDb()
  try {
    const branches = await sql`
      SELECT id, name, lat, lng, address, max_delivery_km
      FROM branches
      WHERE is_active = true
      ORDER BY created_at ASC
    `
    const [dbInfo] = await sql`SELECT current_database() AS db, inet_server_addr()::text AS server`
    const dbTag = { db: dbInfo?.db, server: dbInfo?.server, url_tail: (process.env.DATABASE_URL || '').slice(-30) }
    return NextResponse.json({ branches, _dbTag: dbTag })
  } catch {
    return NextResponse.json({ branches: [] })
  }
}

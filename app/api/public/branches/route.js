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
    const [dbInfo] = await sql`SELECT current_database() AS db, current_schema() AS schema, inet_server_addr()::text AS server`
    const [sp] = await sql`SHOW search_path`
    // Parse hostname from DATABASE_URL to detect which Neon endpoint/branch we're on
    let neonHost = 'unknown'
    try { neonHost = new URL(process.env.DATABASE_URL || '').hostname } catch {}
    const publicRows = await sql`SELECT id, name, max_delivery_km, is_active FROM public.branches ORDER BY created_at ASC`
    // Also check tableoid to confirm which physical table FROM branches reads from
    const tableoidRows = await sql`SELECT id, name, max_delivery_km, tableoid::regclass::text AS actual_table FROM branches WHERE is_active = true`
    const dbTag = { db: dbInfo?.db, schema: dbInfo?.schema, search_path: sp?.search_path, neonHost, public_direct: publicRows, tableoid_check: tableoidRows }
    return NextResponse.json({ branches, _dbTag: dbTag })
  } catch {
    return NextResponse.json({ branches: [] })
  }
}

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
    const allBranchesTables = await sql`SELECT table_schema, table_type FROM information_schema.tables WHERE table_name = 'branches' ORDER BY table_schema`
    const pgTables = await sql`SELECT schemaname, tablename FROM pg_tables WHERE tablename = 'branches'`
    const publicRows = await sql`SELECT id, name, max_delivery_km, is_active FROM public.branches ORDER BY created_at ASC`
    const dbTag = { db: dbInfo?.db, schema: dbInfo?.schema, search_path: sp?.search_path, server: dbInfo?.server, branches_tables: allBranchesTables, pg_tables: pgTables, public_direct: publicRows }
    return NextResponse.json({ branches, _dbTag: dbTag })
  } catch {
    return NextResponse.json({ branches: [] })
  }
}

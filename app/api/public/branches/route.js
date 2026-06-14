export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

// Public endpoint — returns active branches with lat/lng for customer map
export async function GET() {
  const sql = getDb()
  try {
    const branches = await sql`
      SELECT id, name, lat, lng, address, max_delivery_km
      FROM public.branches
      WHERE is_active = true
      ORDER BY created_at ASC
    `
    return NextResponse.json({ branches })
  } catch {
    return NextResponse.json({ branches: [] })
  }
}

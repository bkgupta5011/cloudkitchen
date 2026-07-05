export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

// Public endpoint — returns ALL branches with lat/lng for the customer map.
// IMPORTANT: we no longer hide closed branches. `is_active` = "open right now"
// (the founder's daily open/close toggle). We still return closed branches so a
// customer in their range sees "you're covered, we're closed right now" instead
// of the false "we don't deliver here yet". The client uses is_active to decide
// whether ordering is allowed. Permanent removal = DELETE the branch.
export async function GET() {
  const sql = getDb()
  try {
    const branches = await sql`
      SELECT id, name, lat, lng, address, max_delivery_km,
             is_active AS open_now, opening_time, closing_time
      FROM public.branches
      ORDER BY created_at ASC
    `
    return NextResponse.json({ branches })
  } catch {
    return NextResponse.json({ branches: [] })
  }
}

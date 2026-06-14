import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

// ONE-TIME fix endpoint — remove after use
export const dynamic = 'force-dynamic'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const key = searchParams.get('key')
  if (key !== 'FoodFi2026Fix') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const sql = getDb()
  const kankarbaghId = '4db1a4a4-0b48-47c2-92ff-e1af590ea2c7'
  const jaganpuraId  = 'e71b4895-f0a5-4bd1-bfd4-24ce719694e7'

  const maxKm = parseFloat(searchParams.get('km') || '1')
  const kankarbaghActive = searchParams.get('kankarbagh') !== 'inactive'

  // ?check=1 → read-only, just SELECT current state
  const checkOnly = searchParams.get('check') === '1'

  try {
    if (checkOnly) {
      const rows = await sql`SELECT id, name, is_active, max_delivery_km FROM branches ORDER BY created_at ASC`
      return NextResponse.json({ mode: 'check', branches: rows })
    }

    const [k] = await sql`
      UPDATE branches SET is_active = ${kankarbaghActive}, max_delivery_km = ${maxKm}
      WHERE id = ${kankarbaghId}::uuid RETURNING name, is_active, max_delivery_km
    `
    const [j] = await sql`
      UPDATE branches SET is_active = true, max_delivery_km = ${maxKm}
      WHERE id = ${jaganpuraId}::uuid RETURNING name, is_active, max_delivery_km
    `
    // Verify immediately after update
    const verify = await sql`SELECT id, name, is_active, max_delivery_km FROM branches ORDER BY created_at ASC`
    return NextResponse.json({ success: true, kankarbagh: k, jaganpura: j, verify })
  } catch(e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

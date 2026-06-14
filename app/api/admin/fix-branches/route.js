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

  // ?check=1 → read-only
  const checkOnly = searchParams.get('check') === '1'

  try {
    // Raw catalog checks — pg_trigger and pg_rules are more complete than information_schema
    const pgTriggers = await sql`SELECT tgname, tgtype, tgenabled, tgisinternal FROM pg_trigger WHERE tgrelid = 'public.branches'::regclass`
    const pgRules    = await sql`SELECT rulename, definition FROM pg_rules WHERE tablename = 'branches'`
    const colPerms   = await sql`SELECT column_name, is_updatable FROM information_schema.columns WHERE table_name = 'branches' AND table_schema = 'public' ORDER BY ordinal_position`

    if (checkOnly) {
      const rows = await sql`SELECT id, name, is_active, max_delivery_km FROM branches ORDER BY created_at ASC`
      return NextResponse.json({ mode: 'check', pgTriggers, pgRules, colPerms, branches: rows })
    }

    // Try three approaches for setting is_active=false and see which one shows true/false in RETURNING
    // Approach A: SQL literal false
    const [rA] = await sql`UPDATE branches SET is_active = false WHERE id = ${kankarbaghId}::uuid RETURNING is_active AS approach_a`
    // Approach B: cast via expression
    const [rB] = await sql`UPDATE branches SET is_active = (1=2) WHERE id = ${kankarbaghId}::uuid RETURNING is_active AS approach_b`
    // Approach C: NOT true
    const [rC] = await sql`UPDATE branches SET is_active = NOT true WHERE id = ${kankarbaghId}::uuid RETURNING is_active AS approach_c`
    // Approach D: NULL first, then false
    await sql`UPDATE branches SET is_active = NULL WHERE id = ${kankarbaghId}::uuid`
    const [rD] = await sql`UPDATE branches SET is_active = false WHERE id = ${kankarbaghId}::uuid RETURNING is_active AS approach_d`

    const verify = await sql`SELECT id, name, is_active, max_delivery_km FROM branches ORDER BY created_at ASC`

    // Also update km for both
    await sql`UPDATE branches SET max_delivery_km = ${maxKm} WHERE id = ${jaganpuraId}::uuid`

    return NextResponse.json({
      pgTriggers, pgRules, colPerms,
      approaches: { a: rA, b: rB, c: rC, d: rD },
      verify
    })
  } catch(e) {
    return NextResponse.json({ error: e.message, stack: e.stack?.slice(0,500) }, { status: 500 })
  }
}

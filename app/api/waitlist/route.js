export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { verifyToken } from '@/lib/auth'

// Captures a lead when a customer is either (a) in our area but everything is
// closed right now ("notify me when open"), or (b) genuinely outside every
// branch's range ("notify me when we launch here"). Turns a dead-end into a
// retention lead + a demand map the founder can act on.
async function ensureTable(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS area_waitlist (
      id          SERIAL PRIMARY KEY,
      user_id     UUID,
      phone       VARCHAR,
      kind        VARCHAR NOT NULL DEFAULT 'out_of_area', -- 'closed' | 'out_of_area'
      lat         NUMERIC,
      lng         NUMERIC,
      address     TEXT,
      branch_id   UUID,
      notified    BOOLEAN DEFAULT false,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )`
}

export async function POST(request) {
  const sql = getDb()
  try {
    await ensureTable(sql)
    const token = request.cookies.get('ck_token')?.value
    const user = token ? verifyToken(token) : null
    const body = await request.json()
    const kind = body.kind === 'closed' ? 'closed' : 'out_of_area'
    const phone = (body.phone || '').toString().trim() || null
    const lat = body.lat != null ? parseFloat(body.lat) : null
    const lng = body.lng != null ? parseFloat(body.lng) : null
    const address = body.address ? String(body.address).slice(0, 300) : null
    const branchId = body.branch_id || null

    if (!phone && !user?.id) {
      return NextResponse.json({ error: 'Phone number required' }, { status: 400 })
    }

    // De-dupe: same phone/user + same kind + not-yet-notified → update location
    // instead of piling duplicate rows.
    const [existing] = await sql`
      SELECT id FROM area_waitlist
      WHERE kind = ${kind} AND notified = false
        AND ( (${user?.id ?? null}::uuid IS NOT NULL AND user_id = ${user?.id ?? null}::uuid)
              OR (${phone} IS NOT NULL AND phone = ${phone}) )
      LIMIT 1
    `
    if (existing) {
      await sql`
        UPDATE area_waitlist
        SET lat = COALESCE(${lat}, lat), lng = COALESCE(${lng}, lng),
            address = COALESCE(${address}, address), branch_id = COALESCE(${branchId}::uuid, branch_id),
            phone = COALESCE(${phone}, phone), created_at = NOW()
        WHERE id = ${existing.id}
      `
      return NextResponse.json({ ok: true, updated: true })
    }

    await sql`
      INSERT INTO area_waitlist (user_id, phone, kind, lat, lng, address, branch_id)
      VALUES (${user?.id ?? null}::uuid, ${phone}, ${kind}, ${lat}, ${lng}, ${address}, ${branchId}::uuid)
    `
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('waitlist error:', e.message)
    return NextResponse.json({ error: 'Could not save' }, { status: 500 })
  }
}

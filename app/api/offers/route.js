import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

// GET /api/offers?code=XXX&subtotal=NNN  — real offer validation
export async function GET(request) {
  const sql = getDb()
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const subtotal = parseFloat(searchParams.get('subtotal') || '0')

  // No code — return public active offers list
  if (!code) {
    const offers = await sql`
      SELECT code, type, value, min_order
      FROM offers
      WHERE is_active = true AND (valid_till IS NULL OR valid_till >= CURRENT_DATE)
      ORDER BY created_at DESC
    `
    return NextResponse.json({ offers })
  }

  // Validate specific code
  const rows = await sql`
    SELECT * FROM offers
    WHERE code = ${code.toUpperCase()}
      AND is_active = true
      AND (valid_till IS NULL OR valid_till >= CURRENT_DATE)
      AND used_count < max_uses
    LIMIT 1
  `
  if (!rows.length) {
    return NextResponse.json({ valid: false, error: 'Invalid or expired offer code' })
  }

  const offer = rows[0]
  if (subtotal > 0 && subtotal < parseFloat(offer.min_order)) {
    return NextResponse.json({
      valid: false,
      error: `Minimum order ₹${offer.min_order} required for this offer`
    })
  }

  let discount = 0
  let freeDelivery = false
  if (offer.type === 'flat') discount = parseFloat(offer.value)
  else if (offer.type === 'percent') discount = Math.round((subtotal * parseFloat(offer.value)) / 100)
  else if (offer.type === 'free_delivery') { discount = 0; freeDelivery = true }

  discount = Math.min(discount, subtotal)

  return NextResponse.json({
    valid: true,
    discount,
    freeDelivery,
    code: offer.code,
    type: offer.type,
    value: offer.value
  })
}

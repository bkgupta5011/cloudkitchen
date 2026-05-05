import { getDb } from './db'

// Calculate distance between two lat/lng points (Haversine formula)
export function calcDistance(lat1, lng1, lat2, lng2) {
  const R = 6371 // Earth radius km
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Get delivery charge from DB based on distance
export async function getDeliveryCharge(distanceKm) {
  const sql = getDb()
  const rows = await sql`
    SELECT * FROM km_pricing
    WHERE min_km <= ${distanceKm}
      AND (max_km IS NULL OR max_km > ${distanceKm})
    LIMIT 1
  `
  if (!rows.length) return 50 // fallback

  const row = rows[0]
  const extraKm = Math.max(0, distanceKm - row.min_km)
  return parseFloat(row.base_charge) + extraKm * parseFloat(row.per_km_charge)
}

// Apply offer code to order
export async function applyOffer(code, subtotal) {
  const sql = getDb()
  const rows = await sql`
    SELECT * FROM offers
    WHERE code = ${code.toUpperCase()}
      AND is_active = true
      AND (valid_till IS NULL OR valid_till >= CURRENT_DATE)
      AND used_count < max_uses
    LIMIT 1
  `
  if (!rows.length) return { valid: false, error: 'Invalid or expired offer code' }

  const offer = rows[0]
  if (subtotal < parseFloat(offer.min_order)) {
    return { valid: false, error: `Minimum order ₹${offer.min_order} required` }
  }

  let discount = 0
  if (offer.type === 'flat') discount = parseFloat(offer.value)
  else if (offer.type === 'percent') discount = (subtotal * parseFloat(offer.value)) / 100
  else if (offer.type === 'free_delivery') discount = 0 // handled separately

  return { valid: true, offer, discount: Math.min(discount, subtotal) }
}

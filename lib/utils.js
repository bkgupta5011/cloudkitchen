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
  // ORDER BY min_km DESC ensures most specific (highest matching) range is picked
  const rows = await sql`
    SELECT * FROM km_pricing
    WHERE min_km <= ${distanceKm}
      AND (max_km IS NULL OR max_km > ${distanceKm})
    ORDER BY min_km DESC
    LIMIT 1
  `
  if (!rows.length) {
    // distanceKm doesn't match any range — pick the last (highest) range as fallback
    const [last] = await sql`SELECT * FROM km_pricing ORDER BY min_km DESC LIMIT 1`
    if (!last) return 50
    const extraKm = Math.max(0, distanceKm - parseFloat(last.min_km))
    return parseFloat(last.base_charge) + extraKm * parseFloat(last.per_km_charge)
  }
  const row = rows[0]
  const extraKm = Math.max(0, distanceKm - parseFloat(row.min_km))
  return parseFloat(row.base_charge) + extraKm * parseFloat(row.per_km_charge)
}

// Delivery quote = base fee for the distance + free-delivery-above-threshold.
// freeDeliveryMin comes from the matching km_pricing tier (null = never free).
// If subtotal >= that threshold, delivery is FREE (the "order a bit more" offer).
export async function getDeliveryQuote(distanceKm, subtotal = 0) {
  const sql = getDb()
  // "Free Delivery Festival": admin one-click flag → delivery free for everyone.
  let festival = false
  try {
    const [s] = await sql`SELECT free_delivery_all FROM kitchen_settings WHERE id = 1`
    festival = !!s?.free_delivery_all
  } catch {}
  let row = null
  const rows = await sql`
    SELECT * FROM km_pricing
    WHERE min_km <= ${distanceKm} AND (max_km IS NULL OR max_km > ${distanceKm})
    ORDER BY min_km DESC LIMIT 1
  `
  if (rows.length) row = rows[0]
  else { const [last] = await sql`SELECT * FROM km_pricing ORDER BY min_km DESC LIMIT 1`; row = last }
  if (!row) return { baseCharge: 50, freeDeliveryMin: null, freeDelivery: festival, deliveryCharge: festival ? 0 : 50, festival }
  const extraKm = Math.max(0, distanceKm - parseFloat(row.min_km))
  const baseCharge = Math.round(parseFloat(row.base_charge) + extraKm * parseFloat(row.per_km_charge))
  const freeDeliveryMin = (row.free_delivery_min != null && row.free_delivery_min !== '') ? parseFloat(row.free_delivery_min) : null
  const freeDelivery = festival || (freeDeliveryMin != null && freeDeliveryMin > 0 && subtotal >= freeDeliveryMin)
  return { baseCharge, freeDeliveryMin, freeDelivery, deliveryCharge: freeDelivery ? 0 : baseCharge, festival }
}

// Small-order fee: charged when the food subtotal is below the minimum order
// value (so tiny orders don't run at a loss). Returns the rate + applied fee.
export async function getOrderFees(subtotal = 0) {
  const sql = getDb()
  let mov = 99, fee = 20
  try {
    const [s] = await sql`SELECT min_order_value, small_order_fee FROM kitchen_settings WHERE id = 1`
    if (s) {
      if (s.min_order_value != null && Number.isFinite(parseFloat(s.min_order_value))) mov = parseFloat(s.min_order_value)
      if (s.small_order_fee != null && Number.isFinite(parseFloat(s.small_order_fee))) fee = parseFloat(s.small_order_fee)
    }
  } catch {}
  const smallOrderFee = (subtotal > 0 && subtotal < mov) ? Math.round(fee) : 0
  return { minOrderValue: Math.round(mov), smallOrderFeeRate: Math.round(fee), smallOrderFee }
}

// Delivery boy payout — independent of the customer's delivery charge.
// payout = minimum + max(0, distanceKm - baseKm) * perKm  (distance from kitchen/branch)
// This guarantees a fair minimum even on free/short deliveries.
export async function getBoyPayout(distanceKm) {
  const sql = getDb()
  let min = 25, baseKm = 2, perKm = 7
  try {
    const [s] = await sql`SELECT boy_min_payout, boy_base_km, boy_per_km FROM kitchen_settings WHERE id = 1`
    if (s) {
      if (s.boy_min_payout != null && Number.isFinite(parseFloat(s.boy_min_payout))) min = parseFloat(s.boy_min_payout)
      if (s.boy_base_km    != null && Number.isFinite(parseFloat(s.boy_base_km)))    baseKm = parseFloat(s.boy_base_km)
      if (s.boy_per_km     != null && Number.isFinite(parseFloat(s.boy_per_km)))     perKm = parseFloat(s.boy_per_km)
    }
  } catch {}
  const d = (distanceKm != null && Number.isFinite(parseFloat(distanceKm)) && parseFloat(distanceKm) >= 0) ? parseFloat(distanceKm) : 0
  const extra = Math.max(0, d - baseKm)
  return Math.round(min + extra * perKm)
}

// Get minimum delivery charge (for orders where distance is unknown)
export async function getMinDeliveryCharge() {
  const sql = getDb()
  const [row] = await sql`SELECT * FROM km_pricing ORDER BY min_km ASC LIMIT 1`
  if (!row) return 0
  return parseFloat(row.base_charge)
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

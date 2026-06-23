// ── Road distance via OpenRouteService (free) with haversine fallback ──
// Keeps Google Maps untouched (address capture stays as-is). This is ONLY
// for computing the driving distance branch <-> customer for delivery
// charge + radius checks. If ORS is missing/down, we fall back to a
// haversine estimate so ordering never breaks.

const ROAD_FACTOR = 1.3 // straight-line → approx road distance, used only on fallback

export function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Returns { km, source: 'ors' | 'haversine' }.
// source==='ors' means a confident road distance (safe to enforce radius on).
export async function roadDistanceKm(fromLat, fromLng, toLat, toLng) {
  const straight = haversineKm(fromLat, fromLng, toLat, toLng)
  const fallback = { km: Math.round(straight * ROAD_FACTOR * 100) / 100, source: 'haversine' }

  const key = process.env.OPENROUTESERVICE_API_KEY
  if (!key) return fallback

  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 4000) // never hang the order
    const res = await fetch('https://api.openrouteservice.org/v2/matrix/driving-car', {
      method: 'POST',
      headers: { 'Authorization': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        locations: [[fromLng, fromLat], [toLng, toLat]],
        metrics: ['distance'],
        units: 'km',
      }),
      signal: ctrl.signal,
    })
    clearTimeout(t)
    if (!res.ok) return fallback
    const data = await res.json()
    const d = data?.distances?.[0]?.[1]
    if (typeof d === 'number' && d >= 0) return { km: Math.round(d * 100) / 100, source: 'ors' }
    return fallback
  } catch {
    return fallback
  }
}

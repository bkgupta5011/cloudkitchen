// Shared client-side branch selection helpers.
// Used by the customer menu page (Phase 3 branch-aware menu) and the cart map.
// Each branch has its OWN delivery zone (max_delivery_km); the global setting is
// only a fallback when a branch has no radius of its own.

export function calcDist(lat1, lng1, lat2, lng2) {
  if ([lat1, lng1, lat2, lng2].some(v => !Number.isFinite(v))) return null
  const R = 6371
  const dL = ((lat2 - lat1) * Math.PI) / 180
  const dG = ((lng2 - lng1) * Math.PI) / 180
  const a = Math.sin(dL / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dG / 2) ** 2
  const d = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Number.isFinite(d) ? d : null
}

// Nearest branch that can actually deliver to (lat,lng). null = out of range.
export function findNearestServingBranch(branches, lat, lng, globalMaxKm = 0) {
  if (!branches?.length || !Number.isFinite(lat) || !Number.isFinite(lng)) return null
  const gKm = parseFloat(globalMaxKm) || 0
  const candidates = []
  for (const b of branches) {
    if (!b.lat || !b.lng) continue
    const d = calcDist(parseFloat(b.lat), parseFloat(b.lng), lat, lng)
    if (d === null) continue
    const bKm = parseFloat(b.max_delivery_km) || 0
    const radius = bKm > 0 ? bKm : gKm   // branch zone first, global only as fallback
    if (radius <= 0) continue             // no radius configured anywhere → skip
    candidates.push({ ...b, dist: d, radius })
  }
  candidates.sort((a, b) => a.dist - b.dist)
  return candidates.find(b => b.dist <= b.radius) || null
}

// ALL branches that can deliver to (lat,lng), nearest first. [] = out of range.
// Used when a location is covered by more than one outlet — the customer then
// sees a merged menu from every serving outlet.
export function findServingBranches(branches, lat, lng, globalMaxKm = 0) {
  if (!branches?.length || !Number.isFinite(lat) || !Number.isFinite(lng)) return []
  const gKm = parseFloat(globalMaxKm) || 0
  const serving = []
  for (const b of branches) {
    if (!b.lat || !b.lng) continue
    const d = calcDist(parseFloat(b.lat), parseFloat(b.lng), lat, lng)
    if (d === null) continue
    const bKm = parseFloat(b.max_delivery_km) || 0
    const radius = bKm > 0 ? bKm : gKm
    if (radius <= 0) continue
    if (d <= radius) serving.push({ ...b, dist: d, radius })
  }
  serving.sort((a, b) => a.dist - b.dist)
  return serving
}

// Nearest branch regardless of range (for name/distance display on the gate).
export function findNearestBranchClient(branches, lat, lng, globalMaxKm = 0) {
  if (!branches?.length || !Number.isFinite(lat) || !Number.isFinite(lng)) return null
  const gKm = parseFloat(globalMaxKm) || 0
  let nearest = null, minDist = Infinity
  for (const b of branches) {
    if (!b.lat || !b.lng) continue
    const d = calcDist(parseFloat(b.lat), parseFloat(b.lng), lat, lng)
    if (d !== null && d < minDist) {
      minDist = d
      const bKm = parseFloat(b.max_delivery_km) || 0
      const radius = (bKm > 0 ? bKm : gKm) || null
      nearest = { ...b, dist: d, radius }
    }
  }
  return nearest
}

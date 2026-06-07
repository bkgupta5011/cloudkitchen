export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const revalidate = 0

import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

// Category display order — Add-Ons always last
const CATEGORY_ORDER = [
  'Rice Combos', 'Roti Combos', 'Puri Combos', 'Tadka Specials',
  'Thali', 'Biryani', 'Curry', 'Dal', 'Paneer', 'Chicken',
  'Starter', 'Snacks', 'Dessert', 'Drinks', 'Add-Ons'
]

function sortCategories(cats) {
  return cats.sort((a, b) => {
    const ai = CATEGORY_ORDER.findIndex(c => a.toLowerCase().includes(c.toLowerCase()))
    const bi = CATEGORY_ORDER.findIndex(c => b.toLowerCase().includes(c.toLowerCase()))
    if (ai === -1 && bi === -1) return a.localeCompare(b)
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })
}

function noCacheHeaders(res) {
  res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0')
  res.headers.set('Pragma', 'no-cache')
  res.headers.set('Expires', '0')
  res.headers.set('CDN-Cache-Control', 'no-store')
  res.headers.set('Vercel-CDN-Cache-Control', 'no-store')
  return res
}

// Public menu API — no auth required, never cached
export async function GET(request) {
  try {
    const sql = getDb()

    // Menu items
    const items = await sql`
      SELECT id, name, category, price, discount_percent, description, image_url, is_available
      FROM menu_items
      WHERE is_available = true
      ORDER BY name
    `

    // Sorted categories (Add-Ons last)
    const rawCats = [...new Set(items.map(i => i.category))]
    const categories = sortCategories(rawCats)

    // Kitchen info
    const [kitchen] = await sql`
      SELECT kitchen_name, address, phone, open_time, close_time,
             estimated_time, max_delivery_km, is_open
      FROM kitchen_settings WHERE id = 1
    `

    // Free delivery threshold
    const [freeDelivery] = await sql`
      SELECT max_km FROM km_pricing
      WHERE base_charge = 0 AND per_km_charge = 0
      ORDER BY max_km DESC LIMIT 1
    `

    // Active offers
    const offers = await sql`
      SELECT code, type, value, min_order
      FROM offers
      WHERE is_active = true
        AND (valid_till IS NULL OR valid_till > NOW())
      ORDER BY created_at DESC
      LIMIT 5
    `

    // Top customer reviews (rating 4+)
    const reviews = await sql`
      SELECT r.rating, r.comment, u.name as customer_name, r.created_at
      FROM order_ratings r
      JOIN users u ON r.customer_id = u.id
      WHERE r.rating >= 4 AND r.comment IS NOT NULL AND r.comment != ''
      ORDER BY r.rating DESC, r.created_at DESC
      LIMIT 6
    `

    return noCacheHeaders(NextResponse.json({
      items,
      categories,
      kitchen: kitchen || null,
      freeDeliveryKm: freeDelivery?.max_km || null,
      offers,
      reviews,
      _ts: Date.now(), // debug: confirm fresh response
    }))
  } catch (e) {
    console.error('Public menu API error:', e)
    return noCacheHeaders(NextResponse.json({ items: [], categories: [], kitchen: null, offers: [], reviews: [] }))
  }
}

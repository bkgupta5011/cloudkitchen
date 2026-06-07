export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

// Public menu API — no auth required
export async function GET() {
  try {
    const sql = getDb()
    const items = await sql`
      SELECT id, name, category, price, discount_percent, description, image_url, is_available
      FROM menu_items
      WHERE is_available = true
      ORDER BY category, name
    `
    const categories = [...new Set(items.map(i => i.category))].sort()
    return NextResponse.json({ items, categories })
  } catch (e) {
    console.error('Public menu API error:', e)
    return NextResponse.json({ items: [], categories: [] })
  }
}

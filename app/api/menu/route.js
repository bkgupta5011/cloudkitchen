export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { verifyToken } from '@/lib/auth'

async function ensureStockColumn(sql) {
  try { await sql`ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS stock_count INT DEFAULT NULL` } catch {}
  // Phase 4: branch-owned items (NULL = shared master item). Needed so the
  // owner_branch_id filters below never hit a missing column.
  try { await sql`ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS owner_branch_id UUID` } catch {}
}

// GET - public, all available menu items
export async function GET(request) {
  const sql = getDb()
  await ensureStockColumn(sql)
  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category')
  const adminAll = searchParams.get('admin') === 'true'
  const branchId = searchParams.get('branch_id') // Phase 2: branch-specific menu

  // Check if admin request
  const token = request.cookies.get('ck_token')?.value
  const user = token ? verifyToken(token) : null
  const isAdmin = user?.role === 'admin'

  let items
  if (adminAll && isAdmin) {
    // Admin main menu = shared master catalog only (branch-owned items live in
    // their branch's inventory modal, not the global menu).
    items = await sql`SELECT * FROM menu_items WHERE owner_branch_id IS NULL ORDER BY sort_order, created_at`
  } else if (branchId) {
    // Phase 3 — branch-specific menu (customer sees ONLY this branch's offering):
    //  • item must be globally available AND not disabled for this branch
    //    (NULL in branch_inventory = available by default, not yet configured)
    //  • price  → this branch's own price, falling back to the master price
    //  • stock_count → this branch's own stock (NULL = unlimited)
    // We return these as `price`/`stock_count` so the customer UI is unchanged.
    // eff_price / eff_stock are aliased (not duplicate "price") to avoid any
    // driver ambiguity, then mapped onto price/stock_count below.
    if (category && category !== 'All') {
      items = await sql`
        SELECT m.*,
          COALESCE(bi.price, m.price)                  AS eff_price,
          bi.stock_count                               AS eff_stock,
          COALESCE(bi.discount_percent, m.discount_percent) AS eff_disc,
          COALESCE(bi.image_url, m.image_url)          AS eff_image
        FROM menu_items m
        LEFT JOIN branch_inventory bi
          ON bi.menu_item_id = m.id AND bi.branch_id = ${branchId}::uuid
        WHERE m.is_available = true
          AND m.category = ${category}
          AND COALESCE(bi.is_available, true) = true
          AND (m.owner_branch_id IS NULL OR m.owner_branch_id = ${branchId}::uuid)
        ORDER BY m.sort_order, m.name
      `
    } else {
      items = await sql`
        SELECT m.*,
          COALESCE(bi.price, m.price)                  AS eff_price,
          bi.stock_count                               AS eff_stock,
          COALESCE(bi.discount_percent, m.discount_percent) AS eff_disc,
          COALESCE(bi.image_url, m.image_url)          AS eff_image
        FROM menu_items m
        LEFT JOIN branch_inventory bi
          ON bi.menu_item_id = m.id AND bi.branch_id = ${branchId}::uuid
        WHERE m.is_available = true
          AND COALESCE(bi.is_available, true) = true
          AND (m.owner_branch_id IS NULL OR m.owner_branch_id = ${branchId}::uuid)
        ORDER BY m.sort_order, m.name
      `
    }
    items = items.map(({ eff_price, eff_stock, eff_disc, eff_image, ...it }) => ({
      ...it,
      price: eff_price != null ? Number(eff_price) : it.price,
      stock_count: eff_stock,   // null = unlimited (UI already treats null as no limit)
      discount_percent: eff_disc != null ? Number(eff_disc) : it.discount_percent,
      image_url: eff_image ?? it.image_url,
    }))
  } else if (category && category !== 'All') {
    items = await sql`
      SELECT * FROM menu_items
      WHERE is_available = true AND category = ${category}
        AND owner_branch_id IS NULL
      ORDER BY sort_order, name
    `
  } else {
    items = await sql`
      SELECT * FROM menu_items
      WHERE is_available = true
        AND owner_branch_id IS NULL
      ORDER BY sort_order, name
    `
  }

  return NextResponse.json({ items })
}

// POST - admin: add new item
export async function POST(request) {
  const token = request.cookies.get('ck_token')?.value
  const user = verifyToken(token)
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  const sql = getDb()
  const body = await request.json()
  const { name, description, price, discount_percent, category, is_veg, image_url, sort_order } = body

  if (!name || !price || !category) {
    return NextResponse.json({ error: 'Name, price, category required' }, { status: 400 })
  }

  const [item] = await sql`
    INSERT INTO menu_items (name, description, price, discount_percent, category, is_veg, image_url, sort_order)
    VALUES (${name}, ${description || ''}, ${price}, ${discount_percent || 0}, ${category}, ${is_veg ?? true}, ${image_url || null}, ${sort_order || 0})
    RETURNING *
  `

  // Add the new item to every branch as OFF (unselected) by default. Each
  // branch's admin must toggle it ON for it to appear in that branch's menu —
  // i.e. an item shows in a branch only where the admin says "yes".
  try {
    await sql`
      INSERT INTO branch_inventory (branch_id, menu_item_id, is_available)
      SELECT id, ${item.id}::uuid, false FROM branches
      ON CONFLICT (branch_id, menu_item_id) DO NOTHING
    `
  } catch(e) {} // Safe: branch_inventory table might not exist yet

  return NextResponse.json({ item })
}

// PATCH - admin: update item
export async function PATCH(request) {
  const token = request.cookies.get('ck_token')?.value
  const user = verifyToken(token)
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  const sql = getDb()
  const body = await request.json()
  const { id, ...fields } = body

  if (!id) return NextResponse.json({ error: 'Item ID required' }, { status: 400 })

  const [item] = await sql`
    UPDATE menu_items
    SET
      name = COALESCE(${fields.name ?? null}, name),
      description = COALESCE(${fields.description ?? null}, description),
      price = COALESCE(${fields.price ?? null}, price),
      discount_percent = COALESCE(${fields.discount_percent ?? null}, discount_percent),
      category = COALESCE(${fields.category ?? null}, category),
      is_veg = COALESCE(${fields.is_veg ?? null}, is_veg),
      image_url = COALESCE(${fields.image_url ?? null}, image_url),
      is_available = COALESCE(${fields.is_available ?? null}, is_available),
      sort_order = COALESCE(${fields.sort_order ?? null}, sort_order),
      stock_count = CASE WHEN ${Object.prototype.hasOwnProperty.call(fields,'stock_count')} THEN ${fields.stock_count ?? null} ELSE stock_count END
    WHERE id = ${id}
    RETURNING *
  `
  return NextResponse.json({ item })
}

// DELETE - admin: remove item
export async function DELETE(request) {
  const token = request.cookies.get('ck_token')?.value
  const user = verifyToken(token)
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  const sql = getDb()
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  await sql`DELETE FROM menu_items WHERE id = ${id}`
  return NextResponse.json({ success: true })
}

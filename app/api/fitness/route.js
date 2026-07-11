export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { verifyToken } from '@/lib/auth'

// ── Fitness Freak Corner — STRICT, branch-aware ──────────────────────
// Rules (locked, enforced server-side — not just hidden in the UI):
//   • Only the SUPER ADMIN can add/edit/delete fitness items and their
//     NUTRITION. Nutrition lives on the master (fitness_items) and NEVER
//     changes per branch — same recipe = same macros everywhere.
//   • Only the SUPER ADMIN can ENABLE/DISABLE the corner for an outlet
//     (branches.fitness_enabled). A branch cannot switch itself on.
//   • A branch admin may ONLY toggle availability / price / stock of the
//     master items for its OWN outlet (fitness_branch_inventory). It can
//     NEVER add an item, edit nutrition, or touch another branch.
//   • Customers see the corner LIVE only in an outlet the admin enabled
//     AND where that outlet made items available; elsewhere → "Coming Soon".

async function ensureTables(sql) {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS fitness_items (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        name VARCHAR(255) NOT NULL, about TEXT, price NUMERIC NOT NULL,
        discount_percent INT DEFAULT 0, calories INT NOT NULL,
        protein_g NUMERIC NOT NULL, carbs_g NUMERIC NOT NULL, fat_g NUMERIC NOT NULL,
        fiber_g NUMERIC NOT NULL, other_nutrients TEXT, diet_tag VARCHAR(120),
        is_veg BOOLEAN DEFAULT true, image_url TEXT, is_available BOOLEAN DEFAULT false,
        sort_order INT DEFAULT 0, created_at TIMESTAMP DEFAULT NOW()
      )`
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS fitness_items_name_uniq ON fitness_items (name)`
  } catch {}
  // Per-outlet inventory override (availability/price/stock) — the ONLY thing a branch controls.
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS fitness_branch_inventory (
        branch_id UUID NOT NULL,
        fitness_item_id UUID NOT NULL,
        is_available BOOLEAN DEFAULT false,
        price NUMERIC,
        stock_count INT,
        discount_percent INT,
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (branch_id, fitness_item_id)
      )`
  } catch {}
  // Per-outlet corner switch — admin-only.
  try { await sql`ALTER TABLE branches ADD COLUMN IF NOT EXISTS fitness_enabled BOOLEAN DEFAULT false` } catch {}
}

const getUser = (request) => { const t = request.cookies.get('ck_token')?.value; return t ? verifyToken(t) : null }
const isSuperAdmin = (u) => !!(u && u.role === 'admin' && !u.branch_id)
const isBranchAdmin = (u) => !!(u && u.role === 'admin' && u.branch_id)

function validateFitness(d) {
  if (!d.name?.trim()) return 'Name required'
  const numReq = ['price', 'calories', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g']
  for (const f of numReq) {
    const v = d[f]
    if (v === undefined || v === null || v === '' || isNaN(parseFloat(v))) return `Fitness item ke liye "${f}" zaroori hai (nutrition compulsory hai)`
    if (parseFloat(v) < 0) return `"${f}" galat hai`
  }
  return null
}

// GET — modes:
//   ?branch_id=X            → CUSTOMER: items this outlet made available + cornerEnabled
//   ?mode=catalog           → SUPER ADMIN: master catalog (nutrition)
//   ?mode=inventory&branch_id=X → manage grid (super admin any branch / branch admin own only)
//   (no params)             → public browse-only: master items, cornerEnabled=false
export async function GET(request) {
  const sql = getDb()
  await ensureTables(sql)
  const { searchParams } = new URL(request.url)
  const branchId = searchParams.get('branch_id')
  const mode = searchParams.get('mode')
  const user = getUser(request)

  try {
    if (mode === 'catalog') {
      if (!isSuperAdmin(user)) return NextResponse.json({ error: 'Super admin only' }, { status: 403 })
      const items = await sql`SELECT * FROM fitness_items ORDER BY sort_order ASC, name ASC`
      return NextResponse.json({ items })
    }

    if (mode === 'inventory') {
      if (!branchId) return NextResponse.json({ error: 'branch_id required' }, { status: 400 })
      if (isBranchAdmin(user) && user.branch_id !== branchId) return NextResponse.json({ error: 'Apne outlet ka hi manage kar sakte ho' }, { status: 403 })
      if (!isSuperAdmin(user) && !isBranchAdmin(user)) return NextResponse.json({ error: 'Admin only' }, { status: 403 })
      const items = await sql`
        SELECT f.id, f.name, f.about, f.price AS master_price, f.discount_percent AS master_discount,
               f.calories, f.protein_g, f.carbs_g, f.fat_g, f.fiber_g, f.diet_tag, f.is_veg, f.image_url,
               fbi.is_available AS branch_available, fbi.price AS branch_price,
               fbi.stock_count AS branch_stock, fbi.discount_percent AS branch_discount
        FROM fitness_items f
        LEFT JOIN fitness_branch_inventory fbi ON fbi.fitness_item_id = f.id AND fbi.branch_id = ${branchId}::uuid
        ORDER BY f.sort_order ASC, f.name ASC`
      const [br] = await sql`SELECT fitness_enabled FROM branches WHERE id = ${branchId}::uuid`
      return NextResponse.json({ items, fitnessEnabled: !!br?.fitness_enabled })
    }

    if (branchId) {
      // Customer view — only items this outlet made available; nutrition from master.
      const items = await sql`
        SELECT f.*,
               COALESCE(fbi.price, f.price)                     AS eff_price,
               fbi.stock_count                                  AS eff_stock,
               COALESCE(fbi.discount_percent, f.discount_percent) AS eff_disc
        FROM fitness_items f
        JOIN fitness_branch_inventory fbi
          ON fbi.fitness_item_id = f.id AND fbi.branch_id = ${branchId}::uuid
        WHERE fbi.is_available = true
        ORDER BY f.sort_order ASC, f.name ASC`
      const mapped = items.map(({ eff_price, eff_stock, eff_disc, ...it }) => ({
        ...it,
        price: eff_price != null ? Number(eff_price) : it.price,
        stock_count: eff_stock,
        discount_percent: eff_disc != null ? Number(eff_disc) : it.discount_percent,
      }))
      const [br] = await sql`SELECT fitness_enabled FROM branches WHERE id = ${branchId}::uuid`
      return NextResponse.json({ items: mapped, cornerEnabled: !!br?.fitness_enabled })
    }

    // No branch → browse-only (nutrition marketing), not orderable.
    const items = await sql`SELECT * FROM fitness_items WHERE is_available = true ORDER BY sort_order ASC, name ASC`
    return NextResponse.json({ items, cornerEnabled: false })
  } catch {
    return NextResponse.json({ items: [], cornerEnabled: false })
  }
}

// POST — SUPER ADMIN only: create a master fitness item (nutrition mandatory)
export async function POST(request) {
  const user = getUser(request)
  if (!isSuperAdmin(user)) return NextResponse.json({ error: 'Super admin only' }, { status: 403 })
  const sql = getDb()
  await ensureTables(sql)
  const d = await request.json()
  const err = validateFitness(d)
  if (err) return NextResponse.json({ error: err }, { status: 400 })
  try {
    const [item] = await sql`
      INSERT INTO fitness_items (name, about, price, discount_percent, calories, protein_g, carbs_g, fat_g, fiber_g, other_nutrients, diet_tag, is_veg, image_url, is_available, sort_order)
      VALUES (${d.name.trim()}, ${d.about?.trim() || ''}, ${parseFloat(d.price)}, ${parseInt(d.discount_percent) || 0},
        ${parseInt(d.calories)}, ${parseFloat(d.protein_g)}, ${parseFloat(d.carbs_g)}, ${parseFloat(d.fat_g)},
        ${parseFloat(d.fiber_g)}, ${d.other_nutrients?.trim() || null}, ${d.diet_tag?.trim() || null},
        ${d.is_veg ?? true}, ${d.image_url || null}, ${d.is_available ?? false}, ${parseInt(d.sort_order) || 0})
      ON CONFLICT (name) DO NOTHING RETURNING *`
    if (!item) return NextResponse.json({ error: 'Is naam ka item pehle se hai' }, { status: 409 })
    return NextResponse.json({ item })
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}

// PATCH — master edit (super admin) OR branch actions (enable / inventory)
export async function PATCH(request) {
  const sql = getDb()
  await ensureTables(sql)
  const user = getUser(request)
  const d = await request.json()

  // ── Admin: enable/disable the corner for an OUTLET (super admin only) ──
  if (d.action === 'set_branch_enabled') {
    if (!isSuperAdmin(user)) return NextResponse.json({ error: 'Super admin only' }, { status: 403 })
    if (!d.branch_id) return NextResponse.json({ error: 'branch_id required' }, { status: 400 })
    await sql`UPDATE branches SET fitness_enabled = ${!!d.enabled} WHERE id = ${d.branch_id}::uuid`
    return NextResponse.json({ ok: true, branch_id: d.branch_id, enabled: !!d.enabled })
  }

  // ── Branch inventory: availability / price / stock for ONE outlet ──
  // Super admin → any branch; branch admin → its OWN branch only. No add, no nutrition.
  if (d.action === 'set_branch_item') {
    const canSuper = isSuperAdmin(user)
    const canBranch = isBranchAdmin(user) && user.branch_id === d.branch_id
    if (!canSuper && !canBranch) return NextResponse.json({ error: 'Not allowed for this outlet' }, { status: 403 })
    if (!d.branch_id || !d.fitness_item_id) return NextResponse.json({ error: 'branch_id and fitness_item_id required' }, { status: 400 })
    const avail = d.is_available === undefined ? null : !!d.is_available
    const price = (d.price === '' || d.price == null) ? null : parseFloat(d.price)
    const stock = (d.stock_count === '' || d.stock_count == null) ? null : Math.max(0, parseInt(d.stock_count))
    const disc = (d.discount_percent === '' || d.discount_percent == null) ? null : Math.min(100, Math.max(0, parseInt(d.discount_percent)))
    await sql`
      INSERT INTO fitness_branch_inventory (branch_id, fitness_item_id, is_available, price, stock_count, discount_percent, updated_at)
      VALUES (${d.branch_id}::uuid, ${d.fitness_item_id}::uuid, ${avail ?? false}, ${price}, ${stock}, ${disc}, NOW())
      ON CONFLICT (branch_id, fitness_item_id) DO UPDATE SET
        is_available = CASE WHEN ${avail !== null} THEN ${avail} ELSE fitness_branch_inventory.is_available END,
        price = ${price}, stock_count = ${stock}, discount_percent = ${disc}, updated_at = NOW()`
    return NextResponse.json({ ok: true })
  }

  // ── Master item edit / availability (SUPER ADMIN only) ──
  if (!isSuperAdmin(user)) return NextResponse.json({ error: 'Super admin only' }, { status: 403 })
  if (!d.id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  if (d.action === 'toggle_available') {
    const [item] = await sql`UPDATE fitness_items SET is_available = ${!!d.is_available} WHERE id = ${d.id}::uuid RETURNING *`
    return NextResponse.json({ item })
  }

  const err = validateFitness(d)
  if (err) return NextResponse.json({ error: err }, { status: 400 })
  try {
    const [item] = await sql`
      UPDATE fitness_items SET
        name = ${d.name.trim()}, about = ${d.about?.trim() || ''}, price = ${parseFloat(d.price)},
        discount_percent = ${parseInt(d.discount_percent) || 0}, calories = ${parseInt(d.calories)},
        protein_g = ${parseFloat(d.protein_g)}, carbs_g = ${parseFloat(d.carbs_g)}, fat_g = ${parseFloat(d.fat_g)},
        fiber_g = ${parseFloat(d.fiber_g)}, other_nutrients = ${d.other_nutrients?.trim() || null},
        diet_tag = ${d.diet_tag?.trim() || null}, is_veg = ${d.is_veg ?? true},
        image_url = COALESCE(${d.image_url ?? null}, image_url), is_available = ${d.is_available ?? false},
        sort_order = ${parseInt(d.sort_order) || 0}
      WHERE id = ${d.id}::uuid RETURNING *`
    return NextResponse.json({ item })
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}

// DELETE — SUPER ADMIN only: remove a master item (+ its branch rows)
export async function DELETE(request) {
  const user = getUser(request)
  if (!isSuperAdmin(user)) return NextResponse.json({ error: 'Super admin only' }, { status: 403 })
  const sql = getDb()
  await ensureTables(sql)
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  try {
    await sql`DELETE FROM fitness_branch_inventory WHERE fitness_item_id = ${id}::uuid`
    await sql`DELETE FROM fitness_items WHERE id = ${id}::uuid`
    return NextResponse.json({ success: true })
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}

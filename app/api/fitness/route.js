export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { verifyToken } from '@/lib/auth'

// Separate table for the "Fitness Freak Corner" — kept apart from menu_items
// so healthy items carry mandatory nutrition data of their own.
async function ensureFitnessTable(sql) {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS fitness_items (
        id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        name             VARCHAR(255) NOT NULL,
        about            TEXT,
        price            NUMERIC NOT NULL,
        discount_percent INT DEFAULT 0,
        calories         INT     NOT NULL,
        protein_g        NUMERIC NOT NULL,
        carbs_g          NUMERIC NOT NULL,
        fat_g            NUMERIC NOT NULL,
        fiber_g          NUMERIC NOT NULL,
        other_nutrients  TEXT,
        diet_tag         VARCHAR(120),
        is_veg           BOOLEAN DEFAULT true,
        image_url        TEXT,
        is_available     BOOLEAN DEFAULT false,
        sort_order       INT DEFAULT 0,
        created_at       TIMESTAMP DEFAULT NOW()
      )
    `
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS fitness_items_name_uniq ON fitness_items (name)`
  } catch (e) {}
}

function superAdmin(request) {
  const token = request.cookies.get('ck_token')?.value
  const user = verifyToken(token)
  if (!user || user.role !== 'admin' || user.branch_id) return null   // super admin only
  return user
}

// Nutrition is COMPULSORY for every fitness item (this is the whole point of
// the corner). Returns an error string if anything required is missing.
function validateFitness(d) {
  if (!d.name?.trim()) return 'Name required'
  const numReq = ['price', 'calories', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g']
  for (const f of numReq) {
    const v = d[f]
    if (v === undefined || v === null || v === '' || isNaN(parseFloat(v))) {
      return `Fitness item ke liye "${f}" zaroori hai (nutrition compulsory hai)`
    }
    if (parseFloat(v) < 0) return `"${f}" galat hai`
  }
  return null
}

// GET — public: corner items + whether the corner is live (orderable)
export async function GET() {
  const sql = getDb()
  try {
    await ensureFitnessTable(sql)
    const items = await sql`SELECT * FROM fitness_items ORDER BY sort_order ASC, name ASC`
    let cornerEnabled = false
    try {
      const [cfg] = await sql`SELECT fitness_corner_enabled FROM kitchen_settings WHERE id = 1`
      cornerEnabled = !!cfg?.fitness_corner_enabled
    } catch {}
    return NextResponse.json({ items, cornerEnabled })
  } catch {
    return NextResponse.json({ items: [], cornerEnabled: false })
  }
}

// POST — super admin: create a fitness item (nutrition mandatory)
export async function POST(request) {
  const user = superAdmin(request)
  if (!user) return NextResponse.json({ error: 'Super admin only' }, { status: 403 })
  const sql = getDb()
  await ensureFitnessTable(sql)
  const d = await request.json()

  const err = validateFitness(d)
  if (err) return NextResponse.json({ error: err }, { status: 400 })

  try {
    const [item] = await sql`
      INSERT INTO fitness_items (
        name, about, price, discount_percent, calories, protein_g, carbs_g, fat_g,
        fiber_g, other_nutrients, diet_tag, is_veg, image_url, is_available, sort_order
      ) VALUES (
        ${d.name.trim()}, ${d.about?.trim() || ''}, ${parseFloat(d.price)}, ${parseInt(d.discount_percent) || 0},
        ${parseInt(d.calories)}, ${parseFloat(d.protein_g)}, ${parseFloat(d.carbs_g)}, ${parseFloat(d.fat_g)},
        ${parseFloat(d.fiber_g)}, ${d.other_nutrients?.trim() || null}, ${d.diet_tag?.trim() || null},
        ${d.is_veg ?? true}, ${d.image_url || null}, ${d.is_available ?? false}, ${parseInt(d.sort_order) || 0}
      )
      ON CONFLICT (name) DO NOTHING
      RETURNING *
    `
    if (!item) return NextResponse.json({ error: 'Is naam ka item pehle se hai' }, { status: 409 })
    return NextResponse.json({ item })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// PATCH — super admin: edit item, OR toggle availability
export async function PATCH(request) {
  const user = superAdmin(request)
  if (!user) return NextResponse.json({ error: 'Super admin only' }, { status: 403 })
  const sql = getDb()
  await ensureFitnessTable(sql)
  const d = await request.json()
  if (!d.id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  // Quick availability toggle (no full validation needed)
  if (d.action === 'toggle_available') {
    const [item] = await sql`
      UPDATE fitness_items SET is_available = ${!!d.is_available} WHERE id = ${d.id}::uuid RETURNING *
    `
    return NextResponse.json({ item })
  }

  // Full edit — nutrition stays compulsory
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
      WHERE id = ${d.id}::uuid
      RETURNING *
    `
    return NextResponse.json({ item })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// DELETE — super admin: remove an item
export async function DELETE(request) {
  const user = superAdmin(request)
  if (!user) return NextResponse.json({ error: 'Super admin only' }, { status: 403 })
  const sql = getDb()
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  try {
    await sql`DELETE FROM fitness_items WHERE id = ${id}::uuid`
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

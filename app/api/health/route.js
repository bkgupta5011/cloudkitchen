export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { verifyToken } from '@/lib/auth'

// ── My Health (BMI) — per-customer health profile ────────────────────
// Stores the raw inputs (gender/age/height/weight/waist/activity/goal).
// All targets (BMI, calories, protein/macros) are computed on the client from
// standard, credible formulas (ICMR Indian BMI cut-offs, Mifflin-St Jeor BMR,
// activity TDEE multipliers, goal-based protein). Progress history (weight log)
// comes in a later phase.
async function ensureTable(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS health_profile (
      user_id     UUID PRIMARY KEY,
      gender      VARCHAR(10),
      age         INT,
      height_cm   NUMERIC,
      weight_kg   NUMERIC,
      waist_cm    NUMERIC,
      activity    VARCHAR(20),
      goal        VARCHAR(20),
      updated_at  TIMESTAMPTZ DEFAULT NOW()
    )`
  // Phase 3 fields — added non-destructively on existing tables.
  try { await sql`ALTER TABLE health_profile ADD COLUMN IF NOT EXISTS diet_pref VARCHAR(10)` } catch {}
  try { await sql`ALTER TABLE health_profile ADD COLUMN IF NOT EXISTS gym_goer BOOLEAN DEFAULT FALSE` } catch {}
  // Phase 5 — body-fat (Navy) inputs.
  try { await sql`ALTER TABLE health_profile ADD COLUMN IF NOT EXISTS neck_cm NUMERIC` } catch {}
  try { await sql`ALTER TABLE health_profile ADD COLUMN IF NOT EXISTS hip_cm NUMERIC` } catch {}
  // Weight history — used from Phase 3 (progress tracking). Seed on each save.
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS health_weight_log (
        id SERIAL PRIMARY KEY,
        user_id UUID NOT NULL,
        weight_kg NUMERIC NOT NULL,
        logged_at TIMESTAMPTZ DEFAULT NOW()
      )`
  } catch {}
}

const customer = (request) => {
  const t = request.cookies.get('ck_token')?.value
  const u = t ? verifyToken(t) : null
  return u && u.role === 'customer' ? u : null
}

export async function GET(request) {
  const user = customer(request)
  if (!user) return NextResponse.json({ error: 'Login required' }, { status: 401 })
  const sql = getDb()
  await ensureTable(sql)
  const [profile] = await sql`SELECT * FROM health_profile WHERE user_id = ${user.id}`
  // Weight history (oldest→newest) for the progress chart — last ~90 points.
  let log = []
  try {
    log = await sql`
      SELECT weight_kg, logged_at FROM health_weight_log
      WHERE user_id = ${user.id} ORDER BY logged_at ASC LIMIT 90`
  } catch {}
  return NextResponse.json({ profile: profile || null, log })
}

export async function POST(request) {
  const user = customer(request)
  if (!user) return NextResponse.json({ error: 'Login required' }, { status: 401 })
  const sql = getDb()
  await ensureTable(sql)
  const d = await request.json()

  // ── Quick "log today's weight" — updates current weight + logs a point,
  // without re-entering the whole profile. Requires an existing profile.
  if (d.logWeight) {
    const wt = Number(d.weight_kg)
    if (!wt || wt < 25 || wt > 300) return NextResponse.json({ error: 'Please enter a valid weight' }, { status: 400 })
    const [existing] = await sql`SELECT user_id FROM health_profile WHERE user_id = ${user.id}`
    if (!existing) return NextResponse.json({ error: 'Set up your profile first' }, { status: 400 })
    await sql`UPDATE health_profile SET weight_kg = ${wt}, updated_at = NOW() WHERE user_id = ${user.id}`
    try {
      const [last] = await sql`SELECT weight_kg, logged_at FROM health_weight_log WHERE user_id = ${user.id} ORDER BY logged_at DESC LIMIT 1`
      const sameDay = last && new Date(last.logged_at).toDateString() === new Date().toDateString()
      if (sameDay) await sql`UPDATE health_weight_log SET weight_kg = ${wt}, logged_at = NOW() WHERE user_id = ${user.id} AND logged_at = ${last.logged_at}`
      else await sql`INSERT INTO health_weight_log (user_id, weight_kg) VALUES (${user.id}, ${wt})`
    } catch {}
    const [profile] = await sql`SELECT * FROM health_profile WHERE user_id = ${user.id}`
    const log = await sql`SELECT weight_kg, logged_at FROM health_weight_log WHERE user_id = ${user.id} ORDER BY logged_at ASC LIMIT 90`
    return NextResponse.json({ profile, log })
  }

  const gender = d.gender === 'male' ? 'male' : d.gender === 'female' ? 'female' : null
  const age = d.age != null ? Math.round(Number(d.age)) : null
  const height = d.height_cm != null ? Number(d.height_cm) : null
  const weight = d.weight_kg != null ? Number(d.weight_kg) : null
  const waist = (d.waist_cm === '' || d.waist_cm == null) ? null : Number(d.waist_cm)
  const neck = (d.neck_cm === '' || d.neck_cm == null) ? null : Number(d.neck_cm)
  const hip = (d.hip_cm === '' || d.hip_cm == null) ? null : Number(d.hip_cm)
  const activity = d.activity || null
  const goal = d.goal || null
  const dietPref = d.diet_pref === 'nonveg' ? 'nonveg' : 'veg'
  const gymGoer = !!d.gym_goer

  if (!gender || !age || !height || !weight) {
    return NextResponse.json({ error: 'Gender, age, height and weight are required' }, { status: 400 })
  }
  if (age < 12 || age > 100 || height < 100 || height > 250 || weight < 25 || weight > 300) {
    return NextResponse.json({ error: 'Please check your age / height / weight values' }, { status: 400 })
  }

  const [profile] = await sql`
    INSERT INTO health_profile (user_id, gender, age, height_cm, weight_kg, waist_cm, neck_cm, hip_cm, activity, goal, diet_pref, gym_goer, updated_at)
    VALUES (${user.id}, ${gender}, ${age}, ${height}, ${weight}, ${waist}, ${neck}, ${hip}, ${activity}, ${goal}, ${dietPref}, ${gymGoer}, NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      gender = ${gender}, age = ${age}, height_cm = ${height}, weight_kg = ${weight},
      waist_cm = ${waist}, neck_cm = ${neck}, hip_cm = ${hip}, activity = ${activity}, goal = ${goal}, diet_pref = ${dietPref}, gym_goer = ${gymGoer}, updated_at = NOW()
    RETURNING *`

  // Log this weight point (once per day) for future progress tracking.
  try {
    const [last] = await sql`SELECT weight_kg, logged_at FROM health_weight_log WHERE user_id = ${user.id} ORDER BY logged_at DESC LIMIT 1`
    const sameDay = last && new Date(last.logged_at).toDateString() === new Date().toDateString()
    if (sameDay) {
      await sql`UPDATE health_weight_log SET weight_kg = ${weight}, logged_at = NOW() WHERE user_id = ${user.id} AND logged_at = ${last.logged_at}`
    } else {
      await sql`INSERT INTO health_weight_log (user_id, weight_kg) VALUES (${user.id}, ${weight})`
    }
  } catch {}

  let log = []
  try { log = await sql`SELECT weight_kg, logged_at FROM health_weight_log WHERE user_id = ${user.id} ORDER BY logged_at ASC LIMIT 90` } catch {}
  return NextResponse.json({ profile, log })
}

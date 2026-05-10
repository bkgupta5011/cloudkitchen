import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { verifyToken, hashPassword, verifyPassword } from '@/lib/auth'

// GET — return own profile
export async function GET(request) {
  const sql = getDb()
  const token = request.cookies.get('ck_token')?.value
  const user = verifyToken(token)
  if (!user) return NextResponse.json({ error: 'Login required' }, { status: 401 })

  if (user.role === 'customer' || user.role === 'admin') {
    const [profile] = await sql`
      SELECT id, name, email, phone, address, created_at FROM users WHERE id = ${user.id}
    `
    return NextResponse.json({ profile, role: user.role })
  }

  if (user.role === 'delivery') {
    const [profile] = await sql`
      SELECT id, name, email, phone, vehicle_number, vehicle_type,
             license_number, aadhar_number, date_of_birth,
             emergency_contact, home_address,
             is_online, per_km_earning, total_earnings, rating, created_at
      FROM delivery_boys WHERE id = ${user.id}
    `
    return NextResponse.json({ profile, role: 'delivery' })
  }

  return NextResponse.json({ error: 'Unknown role' }, { status: 400 })
}

// PATCH — update profile or change password
export async function PATCH(request) {
  const sql = getDb()
  const token = request.cookies.get('ck_token')?.value
  const user = verifyToken(token)
  if (!user) return NextResponse.json({ error: 'Login required' }, { status: 401 })

  const body = await request.json()
  const { currentPassword, newPassword, ...fields } = body

  // Password change
  if (newPassword) {
    if (!currentPassword) return NextResponse.json({ error: 'Current password required' }, { status: 400 })
    if (newPassword.length < 6) return NextResponse.json({ error: 'Password kam se kam 6 characters ka hona chahiye' }, { status: 400 })

    let row
    if (user.role === 'delivery') {
      ;[row] = await sql`SELECT password_hash FROM delivery_boys WHERE id = ${user.id}`
    } else {
      ;[row] = await sql`SELECT password_hash FROM users WHERE id = ${user.id}`
    }

    const valid = await verifyPassword(currentPassword, row.password_hash)
    if (!valid) return NextResponse.json({ error: 'Current password galat hai' }, { status: 400 })

    const newHash = await hashPassword(newPassword)
    if (user.role === 'delivery') {
      await sql`UPDATE delivery_boys SET password_hash = ${newHash} WHERE id = ${user.id}`
    } else {
      await sql`UPDATE users SET password_hash = ${newHash} WHERE id = ${user.id}`
    }
    return NextResponse.json({ success: true, message: 'Password update ho gaya!' })
  }

  // Profile field update
  if (user.role === 'customer') {
    const [profile] = await sql`
      UPDATE users SET
        name    = COALESCE(${fields.name    ?? null}, name),
        phone   = COALESCE(${fields.phone   ?? null}, phone),
        address = COALESCE(${fields.address ?? null}, address)
      WHERE id = ${user.id}
      RETURNING id, name, email, phone, address
    `
    return NextResponse.json({ profile })
  }

  if (user.role === 'delivery') {
    const [profile] = await sql`
      UPDATE delivery_boys SET
        name              = COALESCE(${fields.name              ?? null}, name),
        phone             = COALESCE(${fields.phone             ?? null}, phone),
        home_address      = COALESCE(${fields.home_address      ?? null}, home_address),
        emergency_contact = COALESCE(${fields.emergency_contact ?? null}, emergency_contact)
      WHERE id = ${user.id}
      RETURNING id, name, email, phone, home_address, emergency_contact, vehicle_number, vehicle_type, license_number, aadhar_number
    `
    return NextResponse.json({ profile })
  }

  if (user.role === 'admin') {
    const [profile] = await sql`
      UPDATE users SET name = COALESCE(${fields.name ?? null}, name) WHERE id = ${user.id}
      RETURNING id, name, email, phone
    `
    return NextResponse.json({ profile })
  }

  return NextResponse.json({ error: 'Update failed' }, { status: 400 })
}

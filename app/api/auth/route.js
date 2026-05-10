export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { hashPassword, verifyPassword, signToken } from '@/lib/auth'
import crypto from 'crypto'

async function ensureResetTable(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      email VARCHAR(255) NOT NULL,
      token UUID NOT NULL UNIQUE,
      expires_at TIMESTAMP NOT NULL,
      used BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `
  // If table exists with wrong token column type, fix it
  try {
    await sql`ALTER TABLE password_reset_tokens ALTER COLUMN token TYPE UUID USING token::UUID`
  } catch(e) {}
}

async function sendResetEmail(toEmail, resetLink) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'FoodFi Kitchen <noreply@foodfi.in>',
      to: toEmail,
      subject: '🔐 Password Reset - FoodFi',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 20px;">
          <div style="text-align:center; margin-bottom:24px;">
            <h2 style="color:#e85d04;">🍽️ FoodFi Kitchen</h2>
          </div>
          <p style="font-size:16px; color:#1f2937;">Namaste! 🙏</p>
          <p style="color:#374151;">Aapne password reset request ki hai. Neeche button pe click karke naya password set karein:</p>
          <div style="text-align:center; margin:28px 0;">
            <a href="${resetLink}" style="background:#e85d04; color:#fff; padding:14px 32px; border-radius:10px; text-decoration:none; font-weight:700; font-size:15px;">
              🔑 Reset Password
            </a>
          </div>
          <p style="color:#6b7280; font-size:13px;">Yeh link <strong>1 ghante</strong> mein expire ho jayega.</p>
          <p style="color:#6b7280; font-size:13px;">Agar aapne yeh request nahi ki, toh is email ko ignore karein.</p>
          <hr style="border:none;border-top:1px solid #e5e7eb; margin:20px 0;" />
          <p style="color:#9ca3af; font-size:12px; text-align:center;">FoodFi &bull; foodfi.in</p>
        </div>
      `,
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message || data.name || 'Email send failed')
}

// Rate limiting: identifier -> { count, lockedUntil }
const loginAttempts = new Map()
function checkRate(id) {
  const e = loginAttempts.get(id) || { count: 0, lockedUntil: 0 }
  if (e.lockedUntil > Date.now()) return { locked: true, mins: Math.ceil((e.lockedUntil - Date.now()) / 60000) }
  return { locked: false, entry: e }
}
function recordFail(id) {
  const e = loginAttempts.get(id) || { count: 0, lockedUntil: 0 }
  e.count++
  if (e.count >= 5) { e.lockedUntil = Date.now() + 15 * 60 * 1000; e.count = 0 }
  loginAttempts.set(id, e)
}
function clearRate(id) { loginAttempts.delete(id) }

// Ensure delivery_boys has status + extra columns
async function ensureDeliveryBoyColumns(sql) {
  try {
    await sql`ALTER TABLE delivery_boys ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'approved'`
    await sql`ALTER TABLE delivery_boys ADD COLUMN IF NOT EXISTS vehicle_type VARCHAR(50)`
    await sql`ALTER TABLE delivery_boys ADD COLUMN IF NOT EXISTS license_number VARCHAR(100)`
    await sql`ALTER TABLE delivery_boys ADD COLUMN IF NOT EXISTS aadhar_number VARCHAR(20)`
    await sql`ALTER TABLE delivery_boys ADD COLUMN IF NOT EXISTS date_of_birth DATE`
    await sql`ALTER TABLE delivery_boys ADD COLUMN IF NOT EXISTS emergency_contact VARCHAR(20)`
    await sql`ALTER TABLE delivery_boys ADD COLUMN IF NOT EXISTS home_address TEXT`
  } catch (e) {}
}

export async function POST(request) {
  const sql = getDb()
  const body = await request.json()
  const { action, role, email, phone, identifier, password, name, address, adminKey,
          vehicleNumber, vehicleType, licenseNumber, aadharNumber, dateOfBirth,
          emergencyContact, homeAddress } = body

  // ── SIGNUP ──────────────────────────────────────────────────────
  if (action === 'signup') {

    if (role === 'customer') {
      if (!email || !password || !name) return NextResponse.json({ error: 'Name, email, password required' }, { status: 400 })
      const existing = await sql`SELECT id FROM users WHERE email = ${email} OR (phone != '' AND phone = ${phone || ''})`
      if (existing.length) return NextResponse.json({ error: 'Email ya phone already registered hai' }, { status: 400 })
      const passwordHash = await hashPassword(password)
      const [user] = await sql`
        INSERT INTO users (name, email, phone, address, password_hash)
        VALUES (${name}, ${email}, ${phone || ''}, ${address || ''}, ${passwordHash})
        RETURNING id, name, email, phone
      `
      const token = signToken({ id: user.id, role: 'customer', name: user.name, email: user.email })
      const res = NextResponse.json({ success: true, user: { ...user, role: 'customer' } })
      res.cookies.set('ck_token', token, { httpOnly: true, maxAge: 60 * 60 * 24 * 7, path: '/', sameSite: 'lax' })
      return res
    }

    if (role === 'admin') {
      if (adminKey !== process.env.ADMIN_SECRET_KEY) return NextResponse.json({ error: 'Invalid admin secret key' }, { status: 403 })
      if (!email || !password || !name) return NextResponse.json({ error: 'Name, email, password required' }, { status: 400 })
      const existing = await sql`SELECT id FROM admins WHERE email = ${email}`
      if (existing.length) return NextResponse.json({ error: 'Email already registered' }, { status: 400 })
      const passwordHash = await hashPassword(password)
      const [admin] = await sql`
        INSERT INTO admins (name, email, password_hash)
        VALUES (${name}, ${email}, ${passwordHash})
        RETURNING id, name, email
      `
      const token = signToken({ id: admin.id, role: 'admin', name: admin.name, email: admin.email })
      const res = NextResponse.json({ success: true, user: { ...admin, role: 'admin' } })
      res.cookies.set('ck_token', token, { httpOnly: true, maxAge: 60 * 60 * 24 * 7, path: '/', sameSite: 'lax' })
      return res
    }

    if (role === 'delivery') {
      // Full application form — status = 'pending' (requires admin approval)
      if (!email || !password || !name || !phone) {
        return NextResponse.json({ error: 'Name, email, phone, password required' }, { status: 400 })
      }
      await ensureDeliveryBoyColumns(sql)
      const existing = await sql`SELECT id FROM delivery_boys WHERE email = ${email} OR phone = ${phone}`
      if (existing.length) return NextResponse.json({ error: 'Email ya phone already registered hai' }, { status: 400 })
      const passwordHash = await hashPassword(password)
      const [boy] = await sql`
        INSERT INTO delivery_boys (
          name, email, phone, vehicle_number, vehicle_type, license_number,
          aadhar_number, date_of_birth, emergency_contact, home_address,
          per_km_earning, password_hash, status
        )
        VALUES (
          ${name}, ${email}, ${phone}, ${vehicleNumber || ''},
          ${vehicleType || ''}, ${licenseNumber || ''}, ${aadharNumber || ''},
          ${dateOfBirth || null}, ${emergencyContact || ''}, ${homeAddress || ''},
          12, ${passwordHash}, 'pending'
        )
        RETURNING id, name, email, phone, status
      `
      // Don't set cookie — they need approval first
      return NextResponse.json({
        success: true,
        pending: true,
        message: 'Application submit ho gayi! Admin approval ke baad aap login kar payenge.'
      })
    }
  }

  // ── LOGIN ──────────────────────────────────────────────────────
  if (action === 'login') {
    // identifier can be email or phone
    const loginId = identifier || email || phone || ''
    if (!loginId || !password) {
      return NextResponse.json({ error: 'Email/Phone aur password required hai' }, { status: 400 })
    }

    const rateCheck = checkRate(loginId)
    if (rateCheck.locked) {
      return NextResponse.json({ error: `Bahut zyada galat attempts. ${rateCheck.mins} minute baad try karein.` }, { status: 429 })
    }

    const isEmail = loginId.includes('@')
    let user = null
    let detectedRole = null

    // Check admins (email only)
    if (isEmail) {
      const admins = await sql`SELECT * FROM admins WHERE email = ${loginId} LIMIT 1`
      if (admins[0]) { user = admins[0]; detectedRole = 'admin' }
    }

    // Check delivery boys (email OR phone)
    if (!user) {
      await ensureDeliveryBoyColumns(sql)
      const boys = isEmail
        ? await sql`SELECT * FROM delivery_boys WHERE email = ${loginId} LIMIT 1`
        : await sql`SELECT * FROM delivery_boys WHERE phone = ${loginId} OR phone = ${'91' + loginId} OR phone = ${'+91' + loginId} LIMIT 1`
      if (boys[0]) { user = boys[0]; detectedRole = 'delivery' }
    }

    // Check customers (email OR phone)
    if (!user) {
      const customers = isEmail
        ? await sql`SELECT * FROM users WHERE email = ${loginId} LIMIT 1`
        : await sql`SELECT * FROM users WHERE phone = ${loginId} OR phone = ${'91' + loginId} OR phone = ${'+91' + loginId} LIMIT 1`
      if (customers[0]) { user = customers[0]; detectedRole = 'customer' }
    }

    if (!user) { recordFail(loginId); return NextResponse.json({ error: 'Email/Phone ya password galat hai' }, { status: 401 }) }

    const valid = await verifyPassword(password, user.password_hash)
    if (!valid) { recordFail(loginId); return NextResponse.json({ error: 'Email/Phone ya password galat hai' }, { status: 401 }) }

    // Check delivery boy status
    if (detectedRole === 'delivery') {
      if (user.status === 'pending') {
        return NextResponse.json({ error: '⏳ Aapki application admin ke paas pending hai. Approve hone ka wait karein.' }, { status: 403 })
      }
      if (user.status === 'suspended') {
        return NextResponse.json({ error: '🚫 Aapka account suspend kar diya gaya hai. Admin se contact karein: +91 75469 83536' }, { status: 403 })
      }
    }

    clearRate(loginId)
    const token = signToken({ id: user.id, role: detectedRole, name: user.name, email: user.email })
    const res = NextResponse.json({ success: true, user: { id: user.id, name: user.name, email: user.email, role: detectedRole } })
    res.cookies.set('ck_token', token, { httpOnly: true, maxAge: 60 * 60 * 24 * 7, path: '/', sameSite: 'lax' })
    return res
  }

  // ── LOGOUT ──────────────────────────────────────────────────────
  if (action === 'logout') {
    const res = NextResponse.json({ success: true })
    res.cookies.delete('ck_token')
    return res
  }

  // ── ME ──────────────────────────────────────────────────────────
  if (action === 'me') {
    const token = request.cookies.get('ck_token')?.value
    if (!token) return NextResponse.json({ user: null })
    const { verifyToken } = await import('@/lib/auth')
    const decoded = verifyToken(token)
    return NextResponse.json({ user: decoded })
  }

  // ── FORGOT PASSWORD ─────────────────────────────────────────────
  if (action === 'forgot-password') {
    try {
      const { email } = body
      if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

      await ensureResetTable(sql)

      // Check if email exists in any table
      const [cu] = await sql`SELECT email FROM users WHERE email = ${email} LIMIT 1`
      const [ad] = await sql`SELECT email FROM admins WHERE email = ${email} LIMIT 1`
      const [db] = await sql`SELECT email FROM delivery_boys WHERE email = ${email} LIMIT 1`

      // Always return success (don't reveal if email exists)
      if (!cu && !ad && !db) {
        return NextResponse.json({ success: true })
      }

      // Generate token as UUID (compatible with all DB column types)
      const resetToken = crypto.randomUUID()
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()

      // Delete old tokens, save new one
      await sql`DELETE FROM password_reset_tokens WHERE email = ${email}`
      await sql`
        INSERT INTO password_reset_tokens (email, token, expires_at)
        VALUES (${email}, ${resetToken}, ${expiresAt})
      `

      const baseUrl = 'https://foodfi.in'
      const resetLink = `${baseUrl}/reset-password?token=${resetToken}`

      await sendResetEmail(email, resetLink)

      return NextResponse.json({ success: true })
    } catch (e) {
      console.error('Forgot password error:', e)
      return NextResponse.json({ error: `Error: ${e.message}` }, { status: 500 })
    }
  }

  // ── RESET PASSWORD ──────────────────────────────────────────────
  if (action === 'reset-password') {
    const { token: resetToken, newPassword } = body
    if (!resetToken || !newPassword) {
      return NextResponse.json({ error: 'Token aur naya password required hai' }, { status: 400 })
    }
    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'Password kam se kam 6 characters ka hona chahiye' }, { status: 400 })
    }

    await ensureResetTable(sql)

    const [tokenRow] = await sql`
      SELECT * FROM password_reset_tokens
      WHERE token = ${resetToken} AND used = false AND expires_at > NOW()
      LIMIT 1
    `
    if (!tokenRow) {
      return NextResponse.json({ error: 'Link invalid ya expire ho gaya hai. Dobara forgot password try karo.' }, { status: 400 })
    }

    const { email } = tokenRow
    const newHash = await hashPassword(newPassword)

    // Update password in correct table
    await sql`UPDATE users SET password_hash = ${newHash} WHERE email = ${email}`
    await sql`UPDATE admins SET password_hash = ${newHash} WHERE email = ${email}`
    await sql`UPDATE delivery_boys SET password_hash = ${newHash} WHERE email = ${email}`

    // Mark token as used
    await sql`UPDATE password_reset_tokens SET used = true WHERE token = ${resetToken}`

    return NextResponse.json({ success: true, message: 'Password badal gaya! Ab login karein.' })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}

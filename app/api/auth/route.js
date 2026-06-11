export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { hashPassword, verifyPassword, signToken } from '@/lib/auth'
import crypto from 'crypto'
import { sendPasswordResetOtp, sendPasswordResetLink, sendNewCustomerAlert } from '@/lib/email'

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


async function ensureResetOtpsTable(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS reset_otps (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      identifier VARCHAR(255) NOT NULL,
      otp VARCHAR(6) NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      used BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `
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
          emergencyContact, homeAddress, firebaseToken } = body

  // ── SIGNUP ──────────────────────────────────────────────────────
  if (action === 'signup') {

    if (role === 'customer') {
      if (!email && !phone) return NextResponse.json({ error: 'Email ya phone required hai' }, { status: 400 })
      if (!password || !name) return NextResponse.json({ error: 'Name aur password required hai' }, { status: 400 })

      // Firebase Phone Auth token verification (optional — if OTP was verified via Firebase)
      if (firebaseToken && phone) {
        try {
          const apiKey = process.env.FIREBASE_API_KEY
          const fbRes = await fetch(
            `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
            { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: firebaseToken }) }
          )
          const fbData = await fbRes.json()
          const fbUser = fbData.users?.[0]
          if (!fbUser?.phoneNumber) {
            return NextResponse.json({ error: 'Phone verification failed. Dobara try karo.' }, { status: 400 })
          }
          // Verify the token's phone matches what was submitted
          const digits = phone.replace(/[^0-9]/g, '').replace(/^91/, '')
          const normalizedPhone = '+91' + digits
          if (fbUser.phoneNumber !== normalizedPhone) {
            return NextResponse.json({ error: 'Phone number mismatch. Dobara verify karo.' }, { status: 400 })
          }
        } catch(e) {
          console.error('Firebase token verify error in signup:', e)
          // Non-fatal: allow signup to proceed
        }
      }

      // Check duplicate email or phone
      let existing = []
      if (email && phone) {
        existing = await sql`SELECT id FROM users WHERE email = ${email} OR (phone != '' AND phone = ${phone})`
      } else if (email) {
        existing = await sql`SELECT id FROM users WHERE email = ${email}`
      } else if (phone) {
        existing = await sql`SELECT id FROM users WHERE phone != '' AND phone = ${phone}`
      }
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

      // Alert admin — non-blocking (signup succeeds even if email fails)
      sendNewCustomerAlert({
        customerName: user.name,
        email: user.email,
        phone: user.phone,
        address: address || '',
      }).catch(() => {})

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

  // ── LOGIN WITH OTP (phone + Firebase token) ─────────────────────
  if (action === 'login-otp') {
    const { phone, firebaseToken } = body
    if (!phone || !firebaseToken) {
      return NextResponse.json({ error: 'Phone aur OTP verification required hai' }, { status: 400 })
    }

    // Verify Firebase ID token via Google Identity Toolkit
    try {
      const apiKey = process.env.FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY
      const verifyRes = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: firebaseToken }) }
      )
      const verifyData = await verifyRes.json()
      if (!verifyData.users?.[0]) {
        return NextResponse.json({ error: 'OTP verification fail ho gayi. Dobara try karein.' }, { status: 401 })
      }
      const firebasePhone = verifyData.users[0].phoneNumber // e.g. "+919876543210"
      const normalizedPhone = phone.startsWith('+') ? phone : '+91' + phone.replace(/[^0-9]/g, '')
      if (firebasePhone !== normalizedPhone) {
        return NextResponse.json({ error: 'Phone number mismatch. Dobara try karein.' }, { status: 401 })
      }
    } catch (e) {
      return NextResponse.json({ error: 'OTP verify nahi ho saka. Dobara try karein.' }, { status: 401 })
    }

    // Find user by phone in all tables
    const phoneVariants = [phone, phone.replace(/^\+91/, ''), '+91' + phone.replace(/[^0-9]/g, '')]
    let user = null; let detectedRole = null

    // Check delivery boys
    await ensureDeliveryBoyColumns(sql)
    for (const p of phoneVariants) {
      const boys = await sql`SELECT * FROM delivery_boys WHERE phone = ${p} LIMIT 1`
      if (boys[0]) { user = boys[0]; detectedRole = 'delivery'; break }
    }

    // Check customers
    if (!user) {
      for (const p of phoneVariants) {
        const custs = await sql`SELECT * FROM users WHERE phone = ${p} LIMIT 1`
        if (custs[0]) { user = custs[0]; detectedRole = 'customer'; break }
      }
    }

    if (!user) {
      return NextResponse.json({ error: 'Is phone se koi account nahi mila. Pehle Sign Up karein.' }, { status: 404 })
    }

    // Check delivery boy status
    if (detectedRole === 'delivery') {
      if (user.status === 'pending') return NextResponse.json({ error: '⏳ Aapki application pending hai. Approve hone ka wait karein.' }, { status: 403 })
      if (user.status === 'suspended') return NextResponse.json({ error: '🚫 Account suspend hai. Admin se contact karein.' }, { status: 403 })
    }

    const token = signToken({ id: user.id, role: detectedRole, name: user.name, email: user.email })
    const loginRes = NextResponse.json({ success: true, user: { id: user.id, name: user.name, email: user.email, role: detectedRole } })
    loginRes.cookies.set('ck_token', token, { httpOnly: true, maxAge: 60 * 60 * 24 * 7, path: '/', sameSite: 'lax' })
    return loginRes
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

      await sendPasswordResetLink(email, resetLink)

      return NextResponse.json({ success: true })
    } catch (e) {
      console.error('Forgot password error:', e)
      return NextResponse.json({ error: `Error: ${e.message}` }, { status: 500 })
    }
  }

  // ── FORGOT PASSWORD (PHONE / OTP) ──────────────────────────────
  if (action === 'forgot-password-phone') {
    try {
      const { phone, firebaseToken } = body
      if (!phone || !firebaseToken) {
        return NextResponse.json({ error: 'Phone aur Firebase token required hai' }, { status: 400 })
      }

      // Verify Firebase token
      const apiKey = process.env.FIREBASE_API_KEY
      const fbRes = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: firebaseToken }) }
      )
      const fbData = await fbRes.json()
      const fbUser = fbData.users?.[0]
      if (!fbUser?.phoneNumber) {
        return NextResponse.json({ error: 'Phone verification failed. Dobara try karo.' }, { status: 400 })
      }

      // Normalize phone
      const digits = phone.replace(/[^0-9]/g, '').replace(/^91/, '')
      const normalizedPhone = '+91' + digits

      // Verify Firebase phone matches submitted phone
      if (fbUser.phoneNumber !== normalizedPhone) {
        return NextResponse.json({ error: 'Phone number mismatch.' }, { status: 400 })
      }

      // Find user by phone in any table
      await ensureResetTable(sql)
      const [cu] = await sql`SELECT id, email FROM users WHERE phone = ${normalizedPhone} OR phone = ${'91' + digits} OR phone = ${digits} LIMIT 1`
      const [db] = await sql`SELECT id, email FROM delivery_boys WHERE phone = ${normalizedPhone} OR phone = ${'91' + digits} OR phone = ${digits} LIMIT 1`

      const foundUser = cu || db
      if (!foundUser || !foundUser.email) {
        return NextResponse.json({ error: 'Is phone number se koi account nahi mila.' }, { status: 404 })
      }

      const email = foundUser.email
      const resetToken = crypto.randomUUID()
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()

      await sql`DELETE FROM password_reset_tokens WHERE email = ${email}`
      await sql`INSERT INTO password_reset_tokens (email, token, expires_at) VALUES (${email}, ${resetToken}, ${expiresAt})`

      return NextResponse.json({ success: true, token: resetToken })
    } catch (e) {
      console.error('Forgot password phone error:', e)
      return NextResponse.json({ error: `Error: ${e.message}` }, { status: 500 })
    }
  }

  // ── SEND EMAIL OTP FOR PASSWORD RESET ───────────────────────────
  if (action === 'send-reset-otp') {
    try {
      const { email } = body
      if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

      // Check user exists (check users + delivery_boys)
      const [userRow] = await sql`SELECT id FROM users WHERE LOWER(email) = LOWER(${email}) LIMIT 1`
      const [dbRow]   = await sql`SELECT id FROM delivery_boys WHERE LOWER(email) = LOWER(${email}) LIMIT 1`
      if (!userRow && !dbRow) {
        return NextResponse.json({ error: 'Is email se koi account nahi mila' }, { status: 404 })
      }

      // Generate 6-digit OTP
      const otp = String(Math.floor(100000 + Math.random() * 900000))
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 min

      await ensureResetOtpsTable(sql)
      await sql`DELETE FROM reset_otps WHERE identifier = LOWER(${email})`
      await sql`INSERT INTO reset_otps (identifier, otp, expires_at) VALUES (LOWER(${email}), ${otp}, ${expiresAt})`

      await sendPasswordResetOtp(email, otp)

      return NextResponse.json({ success: true })
    } catch (e) {
      console.error('Send reset OTP error:', e)
      return NextResponse.json({ error: 'OTP nahi bheja ja saka: ' + e.message }, { status: 500 })
    }
  }

  // ── VERIFY EMAIL OTP → RETURN RESET TOKEN ───────────────────────
  if (action === 'verify-reset-otp') {
    try {
      const { email, otp } = body
      if (!email || !otp) return NextResponse.json({ error: 'Email aur OTP required' }, { status: 400 })

      await ensureResetOtpsTable(sql)
      const [otpRow] = await sql`
        SELECT * FROM reset_otps
        WHERE identifier = LOWER(${email}) AND otp = ${otp} AND used = false AND expires_at > NOW()
        LIMIT 1
      `
      if (!otpRow) return NextResponse.json({ error: 'Galat ya expired OTP. Dobara try karo.' }, { status: 400 })

      // Mark OTP as used
      await sql`UPDATE reset_otps SET used = true WHERE id = ${otpRow.id}`

      // Issue reset token
      await ensureResetTable(sql)
      const resetToken = crypto.randomUUID()
      const tokenExpiry = new Date(Date.now() + 60 * 60 * 1000).toISOString()
      await sql`DELETE FROM password_reset_tokens WHERE email = LOWER(${email})`
      await sql`INSERT INTO password_reset_tokens (email, token, expires_at) VALUES (LOWER(${email}), ${resetToken}, ${tokenExpiry})`

      return NextResponse.json({ success: true, token: resetToken })
    } catch (e) {
      console.error('Verify reset OTP error:', e)
      return NextResponse.json({ error: 'OTP verify nahi hua: ' + e.message }, { status: 500 })
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

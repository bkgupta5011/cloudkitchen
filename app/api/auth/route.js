import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { hashPassword, verifyPassword, signToken } from '@/lib/auth'

export async function POST(request) {
  const sql = getDb()
  const body = await request.json()
  const { action, role, email, password, name, phone, address, adminKey, vehicleNumber, perKmEarning } = body

  // ── SIGNUP ──────────────────────────────────────────────────────
  if (action === 'signup') {
    if (!email || !password || !name) {
      return NextResponse.json({ error: 'Name, email, password required' }, { status: 400 })
    }

    const passwordHash = await hashPassword(password)

    if (role === 'customer') {
      const existing = await sql`SELECT id FROM users WHERE email = ${email}`
      if (existing.length) return NextResponse.json({ error: 'Email already registered' }, { status: 400 })

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
      if (adminKey !== process.env.ADMIN_SECRET_KEY) {
        return NextResponse.json({ error: 'Invalid admin secret key' }, { status: 403 })
      }
      const existing = await sql`SELECT id FROM admins WHERE email = ${email}`
      if (existing.length) return NextResponse.json({ error: 'Email already registered' }, { status: 400 })

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
      const existing = await sql`SELECT id FROM delivery_boys WHERE email = ${email}`
      if (existing.length) return NextResponse.json({ error: 'Email already registered' }, { status: 400 })

      const [boy] = await sql`
        INSERT INTO delivery_boys (name, email, phone, vehicle_number, per_km_earning, password_hash)
        VALUES (${name}, ${email}, ${phone || ''}, ${vehicleNumber || ''}, ${perKmEarning || 12}, ${passwordHash})
        RETURNING id, name, email, phone, vehicle_number
      `
      const token = signToken({ id: boy.id, role: 'delivery', name: boy.name, email: boy.email })
      const res = NextResponse.json({ success: true, user: { ...boy, role: 'delivery' } })
      res.cookies.set('ck_token', token, { httpOnly: true, maxAge: 60 * 60 * 24 * 7, path: '/', sameSite: 'lax' })
      return res
    }
  }

  // ── LOGIN ──────────────────────────────────────────────────────
  if (action === 'login') {
    if (!email || !password) {
      return NextResponse.json({ error: 'Email aur password required hai' }, { status: 400 })
    }

    // Check all 3 tables automatically
    let user = null
    let detectedRole = null

    const admins = await sql`SELECT * FROM admins WHERE email = ${email} LIMIT 1`
    if (admins[0]) { user = admins[0]; detectedRole = 'admin' }

    if (!user) {
      const boys = await sql`SELECT * FROM delivery_boys WHERE email = ${email} LIMIT 1`
      if (boys[0]) { user = boys[0]; detectedRole = 'delivery' }
    }

    if (!user) {
      const customers = await sql`SELECT * FROM users WHERE email = ${email} LIMIT 1`
      if (customers[0]) { user = customers[0]; detectedRole = 'customer' }
    }

    if (!user) return NextResponse.json({ error: 'Email ya password galat hai' }, { status: 401 })

    const valid = await verifyPassword(password, user.password_hash)
    if (!valid) return NextResponse.json({ error: 'Email ya password galat hai' }, { status: 401 })

    const token = signToken({ id: user.id, role: detectedRole, name: user.name, email: user.email })
    const res = NextResponse.json({
      success: true,
      user: { id: user.id, name: user.name, email: user.email, role: detectedRole }
    })
    res.cookies.set('ck_token', token, { httpOnly: true, maxAge: 60 * 60 * 24 * 7, path: '/', sameSite: 'lax' })
    return res
  }

  // ── LOGOUT ──────────────────────────────────────────────────────
  if (action === 'logout') {
    const res = NextResponse.json({ success: true })
    res.cookies.delete('ck_token')
    return res
  }

  // ── ME (get current user) ──────────────────────────────────────
  if (action === 'me') {
    const token = request.cookies.get('ck_token')?.value
    if (!token) return NextResponse.json({ user: null })
    const { verifyToken } = await import('@/lib/auth')
    const decoded = verifyToken(token)
    return NextResponse.json({ user: decoded })
  }

  // ── FORGOT PASSWORD ─────────────────────────────────────────────
  if (action === 'forgot-password') {
    if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

    // Find user in any table
    let found = false
    const admins = await sql`SELECT email FROM admins WHERE email = ${email} LIMIT 1`
    if (admins[0]) found = true
    if (!found) {
      const boys = await sql`SELECT email FROM delivery_boys WHERE email = ${email} LIMIT 1`
      if (boys[0]) found = true
    }
    if (!found) {
      const customers = await sql`SELECT email FROM users WHERE email = ${email} LIMIT 1`
      if (customers[0]) found = true
    }

    if (!found) {
      // Don't reveal if email exists or not
      return NextResponse.json({ success: true })
    }

    // Delete old tokens for this email
    await sql`DELETE FROM password_reset_tokens WHERE email = ${email}`

    // Create new token (expires in 1 hour)
    const [tokenRow] = await sql`
      INSERT INTO password_reset_tokens (email, expires_at)
      VALUES (${email}, NOW() + INTERVAL '1 hour')
      RETURNING token
    `

    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${tokenRow.token}`

    const nodemailer = await import('nodemailer')
    const transporter = nodemailer.default.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      }
    })

    try {
      await transporter.sendMail({
        from: `"CloudKitchen" <${process.env.GMAIL_USER}>`,
        to: email,
        subject: 'CloudKitchen - Password Reset',
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
            <h2 style="color: #e85d04;">🍽️ CloudKitchen</h2>
            <p>Aapne password reset request ki hai.</p>
            <p>Neeche diye link pe click karke naya password set karein:</p>
            <a href="${resetUrl}" style="display:inline-block; background:#e85d04; color:#fff; padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:600; margin:16px 0;">
              Reset Password
            </a>
            <p style="color:#999; font-size:13px;">Ye link 1 ghante mein expire ho jaayega.</p>
            <p style="color:#999; font-size:13px;">Agar aapne request nahi ki toh is email ko ignore karein.</p>
          </div>
        `
      })
      console.log('✅ Email sent to:', email)
    } catch (emailErr) {
      console.error('Email error:', emailErr.message)
      console.log('🔗 Reset link (manual):', resetUrl)
      return NextResponse.json({ error: 'Email bhejne mein problem hui. Terminal mein link dekho.' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
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

    const [tokenRow] = await sql`
      SELECT * FROM password_reset_tokens
      WHERE token = ${resetToken}
        AND used = false
        AND expires_at > NOW()
    `

    if (!tokenRow) {
      return NextResponse.json({ error: 'Link expired ya invalid hai. Dobara request karein.' }, { status: 400 })
    }

    const newHash = await hashPassword(newPassword)
    const { email: resetEmail } = tokenRow

    // Update password in whichever table the email belongs to
    await sql`UPDATE admins SET password_hash = ${newHash} WHERE email = ${resetEmail}`
    await sql`UPDATE delivery_boys SET password_hash = ${newHash} WHERE email = ${resetEmail}`
    await sql`UPDATE users SET password_hash = ${newHash} WHERE email = ${resetEmail}`

    // Mark token as used
    await sql`UPDATE password_reset_tokens SET used = true WHERE token = ${resetToken}`

    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}

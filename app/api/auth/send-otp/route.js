export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

// Ensure OTP table exists
async function ensureOtpTable(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS phone_otps (
      id          SERIAL PRIMARY KEY,
      phone       VARCHAR(20) NOT NULL,
      otp         VARCHAR(6)  NOT NULL,
      expires_at  TIMESTAMP   NOT NULL,
      verified    BOOLEAN     DEFAULT false,
      created_at  TIMESTAMP   DEFAULT NOW()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_phone_otps_phone ON phone_otps(phone)`.catch(() => {})
}

// Send OTP via MSG91
async function sendOtpMsg91(mobile91, otp) {
  const authkey = process.env.MSG91_AUTH_KEY
  if (!authkey) throw new Error('MSG91 auth key not configured')

  // MSG91 OTP API v5
  const templateId = process.env.MSG91_TEMPLATE_ID // optional

  const body = {
    mobile: mobile91,          // format: 919876543210
    otp_length: 6,
    otp_expiry: 5,             // 5 minutes
    otp: otp,                  // we generate OTP, MSG91 sends it
  }

  if (templateId) {
    body.template_id = templateId
  } else {
    body.message = `${otp} is your FoodFi OTP. Valid for 5 minutes. Do not share with anyone. - FoodFi Cloud Kitchen`
  }

  const res = await fetch('https://api.msg91.com/api/v5/otp', {
    method: 'POST',
    headers: {
      'authkey': authkey,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(body)
  })

  const data = await res.json()

  // MSG91 returns { type: "success", message: "3903579" } on success
  if (data?.type !== 'success') {
    const errMsg = data?.message || data?.error || JSON.stringify(data)
    throw new Error(errMsg)
  }
  return data
}

// Rate limit: max 3 OTPs per phone per 10 minutes
const otpRateMap = new Map()
function checkOtpRate(phone) {
  const now = Date.now()
  const entry = otpRateMap.get(phone) || { count: 0, resetAt: now + 10 * 60 * 1000 }
  if (now > entry.resetAt) { entry.count = 0; entry.resetAt = now + 10 * 60 * 1000 }
  if (entry.count >= 3) {
    const mins = Math.ceil((entry.resetAt - now) / 60000)
    return { blocked: true, mins }
  }
  entry.count++
  otpRateMap.set(phone, entry)
  return { blocked: false }
}

export async function POST(request) {
  try {
    const sql = getDb()
    const { phone } = await request.json()

    if (!phone) return NextResponse.json({ error: 'Phone number required' }, { status: 400 })

    // Validate Indian phone — exactly 10 digits
    const digits = phone.replace(/[^0-9]/g, '').replace(/^91/, '')
    if (digits.length !== 10) {
      return NextResponse.json({ error: 'Valid 10-digit phone number do' }, { status: 400 })
    }

    const normalizedPhone = '+91' + digits   // for our DB
    const mobile91 = '91' + digits           // for MSG91 API (no +)

    // Rate limit
    const rate = checkOtpRate(normalizedPhone)
    if (rate.blocked) {
      return NextResponse.json({ error: `Bahut zyada OTP requests. ${rate.mins} minute baad try karo.` }, { status: 429 })
    }

    await ensureOtpTable(sql)

    // Delete old unverified OTPs for this phone
    await sql`DELETE FROM phone_otps WHERE phone = ${normalizedPhone} AND verified = false`

    // Generate 6-digit OTP
    const otp = String(Math.floor(100000 + Math.random() * 900000))
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()

    // Save OTP to DB first
    await sql`
      INSERT INTO phone_otps (phone, otp, expires_at)
      VALUES (${normalizedPhone}, ${otp}, ${expiresAt})
    `

    // Send via MSG91
    await sendOtpMsg91(mobile91, otp)

    return NextResponse.json({ success: true, message: `OTP +91${digits} pe bhej diya gaya` })

  } catch (e) {
    console.error('Send OTP error:', e)
    return NextResponse.json({ error: e.message || 'OTP send nahi hua. Dobara try karo.' }, { status: 500 })
  }
}

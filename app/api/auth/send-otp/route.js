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

// Send OTP via Fast2SMS Quick SMS (no DLT needed!)
async function sendOtpFast2SMS(mobileDigits, otp) {
  const apiKey = process.env.FAST2SMS_API_KEY
  if (!apiKey) throw new Error('Fast2SMS API key not configured')

  const message = `FoodFi OTP: ${otp}. Valid 5 minutes. Do not share with anyone. - FoodFi Cloud Kitchen`

  const res = await fetch('https://www.fast2sms.com/dev/bulkV2', {
    method: 'POST',
    headers: {
      'authorization': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      route: 'q',               // Quick SMS — no DLT required
      message: message,
      numbers: mobileDigits,    // 10-digit number only
    })
  })

  const data = await res.json()

  if (!data?.return) {
    const errMsg = Array.isArray(data?.message)
      ? data.message.join(', ')
      : (data?.message || JSON.stringify(data))
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

    const digits = phone.replace(/[^0-9]/g, '').replace(/^91/, '')
    if (digits.length !== 10) {
      return NextResponse.json({ error: 'Valid 10-digit phone number do' }, { status: 400 })
    }

    const normalizedPhone = '+91' + digits

    const rate = checkOtpRate(normalizedPhone)
    if (rate.blocked) {
      return NextResponse.json({ error: `Bahut zyada OTP requests. ${rate.mins} minute baad try karo.` }, { status: 429 })
    }

    await ensureOtpTable(sql)

    // Delete old unverified OTPs
    await sql`DELETE FROM phone_otps WHERE phone = ${normalizedPhone} AND verified = false`

    // Generate 6-digit OTP
    const otp = String(Math.floor(100000 + Math.random() * 900000))
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()

    // Save to DB
    await sql`
      INSERT INTO phone_otps (phone, otp, expires_at)
      VALUES (${normalizedPhone}, ${otp}, ${expiresAt})
    `

    // Send via Fast2SMS Quick SMS
    await sendOtpFast2SMS(digits, otp)

    return NextResponse.json({ success: true, message: `OTP +91${digits} pe bhej diya gaya` })

  } catch (e) {
    console.error('Send OTP error:', e)
    return NextResponse.json({ error: e.message || 'OTP send nahi hua. Dobara try karo.' }, { status: 500 })
  }
}

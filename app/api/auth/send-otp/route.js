export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

// Ensure OTP table exists
async function ensureOtpTable(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS phone_otps (
      id          SERIAL PRIMARY KEY,
      phone       VARCHAR(20) NOT NULL,
      otp         VARCHAR(6),
      expires_at  TIMESTAMP   NOT NULL,
      verified    BOOLEAN     DEFAULT false,
      created_at  TIMESTAMP   DEFAULT NOW()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_phone_otps_phone ON phone_otps(phone)`.catch(() => {})
}

// Send OTP via Twilio Verify — most reliable, no DLT needed
async function sendOtpTwilio(phone_e164) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken  = process.env.TWILIO_AUTH_TOKEN
  const serviceSid = process.env.TWILIO_VERIFY_SID

  if (!accountSid || !authToken || !serviceSid) {
    throw new Error('Twilio credentials not configured')
  }

  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64')

  const res = await fetch(
    `https://verify.twilio.com/v2/Services/${serviceSid}/Verifications`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: phone_e164, Channel: 'sms' }).toString()
    }
  )

  const data = await res.json()

  if (data?.status !== 'pending') {
    throw new Error(data?.message || 'OTP send failed')
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

    // Save placeholder (Twilio generates OTP internally)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 min
    await sql`
      INSERT INTO phone_otps (phone, otp, expires_at)
      VALUES (${normalizedPhone}, 'twilio', ${expiresAt})
    `

    // Send via Twilio Verify
    await sendOtpTwilio(normalizedPhone)

    return NextResponse.json({ success: true, message: `OTP +91${digits} pe bhej diya gaya` })

  } catch (e) {
    console.error('Send OTP error:', e)
    return NextResponse.json({ error: e.message || 'OTP send nahi hua. Dobara try karo.' }, { status: 500 })
  }
}

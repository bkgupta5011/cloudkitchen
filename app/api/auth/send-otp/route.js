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
  // Index for fast lookups
  await sql`CREATE INDEX IF NOT EXISTS idx_phone_otps_phone ON phone_otps(phone)`.catch(() => {})
}

// Send SMS via BulkSMS
async function sendSMS(phone, otp) {
  const auth = process.env.BULKSMS_AUTH
  if (!auth) throw new Error('BulkSMS auth not configured')

  // Normalize phone to E.164 (+91XXXXXXXXXX)
  let normalized = phone.replace(/\s/g, '')
  if (!normalized.startsWith('+')) {
    if (normalized.startsWith('91') && normalized.length === 12) normalized = '+' + normalized
    else if (normalized.length === 10) normalized = '+91' + normalized
    else normalized = '+91' + normalized
  }

  const message = `FoodFi OTP: ${otp}\n\nYeh code 5 minute mein expire hoga. Kisi ke saath share mat karo.\n\n- FoodFi Cloud Kitchen`

  const res = await fetch('https://api.bulksms.com/v1/messages', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([{ to: normalized, body: message }])
  })

  const data = await res.json()
  if (!res.ok) {
    const errMsg = Array.isArray(data) ? data[0]?.status?.description : (data.message || JSON.stringify(data))
    throw new Error(errMsg || 'SMS send failed')
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

    // Validate Indian phone number (10 digits)
    const digits = phone.replace(/[^0-9]/g, '').replace(/^91/, '')
    if (digits.length !== 10) {
      return NextResponse.json({ error: 'Valid 10-digit phone number do' }, { status: 400 })
    }

    const normalizedPhone = '+91' + digits

    // Rate limit check
    const rate = checkOtpRate(normalizedPhone)
    if (rate.blocked) {
      return NextResponse.json({ error: `Bahut zyada OTP requests. ${rate.mins} minute baad try karo.` }, { status: 429 })
    }

    await ensureOtpTable(sql)

    // Delete old OTPs for this phone
    await sql`DELETE FROM phone_otps WHERE phone = ${normalizedPhone} AND verified = false`

    // Generate 6-digit OTP
    const otp = String(Math.floor(100000 + Math.random() * 900000))
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5 min

    // Save to DB
    await sql`
      INSERT INTO phone_otps (phone, otp, expires_at)
      VALUES (${normalizedPhone}, ${otp}, ${expiresAt})
    `

    // Send SMS
    await sendSMS(normalizedPhone, otp)

    return NextResponse.json({ success: true, message: `OTP +91${digits} pe bhej diya gaya` })
  } catch (e) {
    console.error('Send OTP error:', e)
    return NextResponse.json({ error: e.message || 'OTP send nahi hua. Dobara try karo.' }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

// Verify OTP via Twilio Verify
async function verifyOtpTwilio(phone_e164, otp) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken  = process.env.TWILIO_AUTH_TOKEN
  const serviceSid = process.env.TWILIO_VERIFY_SID

  if (!accountSid || !authToken || !serviceSid) {
    throw new Error('Twilio credentials not configured')
  }

  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64')

  const res = await fetch(
    `https://verify.twilio.com/v2/Services/${serviceSid}/VerificationCheck`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: phone_e164, Code: otp }).toString()
    }
  )

  const data = await res.json()

  // approved = correct OTP
  if (data?.status !== 'approved') {
    throw new Error('Galat OTP. Dobara check karo.')
  }

  return data
}

export async function POST(request) {
  try {
    const sql = getDb()
    const { phone, otp } = await request.json()

    if (!phone || !otp) {
      return NextResponse.json({ error: 'Phone aur OTP dono required hain' }, { status: 400 })
    }

    const digits = phone.replace(/[^0-9]/g, '').replace(/^91/, '')
    if (digits.length !== 10) {
      return NextResponse.json({ error: 'Valid phone number do' }, { status: 400 })
    }

    const normalizedPhone = '+91' + digits

    // Verify with Twilio
    await verifyOtpTwilio(normalizedPhone, String(otp).trim())

    // Mark as verified in our DB
    await sql`
      UPDATE phone_otps SET verified = true
      WHERE phone = ${normalizedPhone} AND verified = false
    `.catch(() => {})

    return NextResponse.json({ success: true, verified: true, phone: normalizedPhone })

  } catch (e) {
    console.error('Verify OTP error:', e)
    return NextResponse.json({ error: e.message || 'OTP verify nahi hua. Dobara try karo.' }, { status: 500 })
  }
}

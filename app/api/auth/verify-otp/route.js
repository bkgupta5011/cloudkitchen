export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function POST(request) {
  try {
    const sql = getDb()
    const { phone, otp } = await request.json()

    if (!phone || !otp) {
      return NextResponse.json({ error: 'Phone aur OTP dono required hain' }, { status: 400 })
    }

    // Normalize phone
    const digits = phone.replace(/[^0-9]/g, '').replace(/^91/, '')
    if (digits.length !== 10) {
      return NextResponse.json({ error: 'Valid phone number do' }, { status: 400 })
    }
    const normalizedPhone = '+91' + digits

    // Find latest valid OTP
    const [row] = await sql`
      SELECT * FROM phone_otps
      WHERE phone = ${normalizedPhone}
        AND verified = false
        AND expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT 1
    `

    if (!row) {
      return NextResponse.json({ error: 'OTP expire ho gaya ya invalid hai. Dobara bhejo.' }, { status: 400 })
    }

    if (row.otp !== String(otp).trim()) {
      return NextResponse.json({ error: 'Galat OTP. Dobara check karo.' }, { status: 400 })
    }

    // Mark as verified
    await sql`UPDATE phone_otps SET verified = true WHERE id = ${row.id}`

    return NextResponse.json({ success: true, verified: true, phone: normalizedPhone })
  } catch (e) {
    console.error('Verify OTP error:', e)
    return NextResponse.json({ error: 'OTP verify nahi hua. Dobara try karo.' }, { status: 500 })
  }
}

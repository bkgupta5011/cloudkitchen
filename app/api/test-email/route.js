export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'

export async function GET() {
  const key = process.env.RESEND_API_KEY
  const adminEmail = process.env.ADMIN_ALERT_EMAIL

  if (!key) return NextResponse.json({ error: 'RESEND_API_KEY missing' }, { status: 500 })
  if (!adminEmail) return NextResponse.json({ error: 'ADMIN_ALERT_EMAIL missing' }, { status: 500 })

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'FoodFi Cloud Kitchen <noreply@foodfi.in>',
        to: adminEmail,
        subject: '✅ FoodFi Email Test',
        html: '<p>Yeh ek test email hai. Agar yeh aa gaya toh sab theek hai! 🎉</p>',
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      return NextResponse.json({ error: data.message || 'Resend error', detail: data, status: res.status }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: `Email sent to ${adminEmail}`, resend_id: data.id })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

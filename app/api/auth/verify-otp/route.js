export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'

// Verify Firebase Phone Auth idToken via REST API (no Admin SDK needed)
async function verifyFirebaseToken(idToken) {
  const apiKey = process.env.FIREBASE_API_KEY
  if (!apiKey) throw new Error('Firebase API key not configured')

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    }
  )

  const data = await res.json()

  if (!res.ok || !data.users?.[0]) {
    throw new Error('Invalid Firebase token')
  }

  const user = data.users[0]
  if (!user.phoneNumber) {
    throw new Error('Phone number not found in Firebase token')
  }

  return { phoneNumber: user.phoneNumber, uid: user.localId }
}

export async function POST(request) {
  try {
    const { firebaseToken } = await request.json()

    if (!firebaseToken) {
      return NextResponse.json({ error: 'Firebase token required' }, { status: 400 })
    }

    const { phoneNumber, uid } = await verifyFirebaseToken(firebaseToken)

    return NextResponse.json({ success: true, verified: true, phone: phoneNumber, uid })

  } catch (e) {
    console.error('Verify Firebase token error:', e)
    return NextResponse.json({ error: e.message || 'Token verify nahi hua. Dobara try karo.' }, { status: 500 })
  }
}

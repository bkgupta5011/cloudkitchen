export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'

// OTP is now sent client-side via Firebase Phone Auth SDK.
// This endpoint is kept for backward compatibility but is no longer used.
export async function POST(request) {
  return NextResponse.json({ success: true, message: 'Use Firebase client SDK for OTP' })
}

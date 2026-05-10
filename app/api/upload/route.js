export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'

// POST — accept base64 image, return data URL
// Client compresses with Canvas before sending
export async function POST(request) {
  const token = request.cookies.get('ck_token')?.value
  const user = verifyToken(token)
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  const { base64, mimeType } = await request.json()
  if (!base64) return NextResponse.json({ error: 'No image data' }, { status: 400 })

  // Validate it's an image
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
  const mime = mimeType || 'image/jpeg'
  if (!allowedTypes.includes(mime)) {
    return NextResponse.json({ error: 'Only JPEG/PNG/WebP allowed' }, { status: 400 })
  }

  // Construct data URL
  const dataUrl = `data:${mime};base64,${base64}`

  // Basic size check (base64 string ~1.33x actual size)
  const approxBytes = base64.length * 0.75
  if (approxBytes > 2 * 1024 * 1024) {
    return NextResponse.json({ error: 'Image too large (max 2MB)' }, { status: 400 })
  }

  return NextResponse.json({ url: dataUrl })
}

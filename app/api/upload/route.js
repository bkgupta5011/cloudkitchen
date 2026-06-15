export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import crypto from 'crypto'

// POST — accept base64 image (client compresses with Canvas first).
// If Cloudinary is configured, upload there and return the hosted URL.
// Otherwise fall back to an inline data URL (original behavior — nothing breaks).
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

  // Basic size check (base64 string ~1.33x actual size)
  const approxBytes = base64.length * 0.75
  if (approxBytes > 2 * 1024 * 1024) {
    return NextResponse.json({ error: 'Image too large (max 2MB)' }, { status: 400 })
  }

  const dataUrl = `data:${mime};base64,${base64}`

  // ── Cloudinary signed upload (if configured) ──────────────────────
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME
  const apiKey    = process.env.CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET

  if (cloudName && apiKey && apiSecret) {
    try {
      const timestamp = Math.round(Date.now() / 1000)
      const folder = 'foodfi_menu'

      // Signature = sha1 of signed params (alphabetical, excluding file/api_key) + api_secret
      const toSign = `folder=${folder}&timestamp=${timestamp}`
      const signature = crypto.createHash('sha1').update(toSign + apiSecret).digest('hex')

      const form = new FormData()
      form.append('file', dataUrl)            // Cloudinary accepts a base64 data URI
      form.append('api_key', apiKey)
      form.append('timestamp', String(timestamp))
      form.append('folder', folder)
      form.append('signature', signature)

      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: 'POST',
        body: form,
      })
      const out = await res.json()

      if (res.ok && out.secure_url) {
        // Add automatic format + quality optimization (WebP/AVIF, smaller size)
        const optimized = out.secure_url.replace('/image/upload/', '/image/upload/f_auto,q_auto/')
        return NextResponse.json({ url: optimized })
      }
      // Cloudinary rejected — log and fall back to data URL so uploads still work
      console.error('Cloudinary upload failed:', out?.error?.message || out)
    } catch (e) {
      console.error('Cloudinary error:', e?.message)
    }
  }

  // ── Fallback: inline data URL (original behavior) ─────────────────
  return NextResponse.json({ url: dataUrl })
}

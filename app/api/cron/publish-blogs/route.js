export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

// Daily cron (runs ~6 PM IST): publish any scheduled blog posts whose time
// has arrived. Drafts have published=false + scheduled_for set; this flips
// them live and stamps created_at = publish time (so the date is correct).
export async function GET(request) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const sql = getDb()
  try {
    const rows = await sql`
      UPDATE blog_posts
      SET published = true, created_at = NOW()
      WHERE published = false
        AND scheduled_for IS NOT NULL
        AND scheduled_for <= NOW()
      RETURNING slug`
    return NextResponse.json({ published: rows.length, slugs: rows.map(r => r.slug) })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

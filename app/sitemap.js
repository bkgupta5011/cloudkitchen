import { getDb } from '@/lib/db'

export const dynamic = 'force-dynamic'

export default async function sitemap() {
  const base = [
    { url: 'https://order.foodfi.in', lastModified: new Date(), changeFrequency: 'daily', priority: 1.0 },
    { url: 'https://foodfi.in', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: 'https://order.foodfi.in/blog', lastModified: new Date(), changeFrequency: 'daily', priority: 0.7 },
  ]
  let blogs = []
  try {
    const sql = getDb()
    const rows = await sql`SELECT slug, created_at FROM blog_posts WHERE published = true ORDER BY created_at DESC`
    blogs = rows.map(r => ({
      url: `https://order.foodfi.in/blog/${r.slug}`,
      lastModified: new Date(r.created_at),
      changeFrequency: 'monthly',
      priority: 0.6,
    }))
  } catch {}
  return [...base, ...blogs]
}

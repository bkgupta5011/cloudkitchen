export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import crypto from 'crypto'

// Cloudinary signed upload (same as /api/upload) — used for blog images
async function uploadToCloudinary(base64, mimeType) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME
  const apiKey    = process.env.CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET
  const dataUrl = `data:${mimeType || 'image/jpeg'};base64,${base64}`
  if (!cloudName || !apiKey || !apiSecret) return dataUrl // fallback: inline
  try {
    const timestamp = Math.round(Date.now() / 1000)
    const folder = 'foodfi_blog'
    const signature = crypto.createHash('sha1').update(`folder=${folder}&timestamp=${timestamp}` + apiSecret).digest('hex')
    const form = new FormData()
    form.append('file', dataUrl)
    form.append('api_key', apiKey)
    form.append('timestamp', String(timestamp))
    form.append('folder', folder)
    form.append('signature', signature)
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body: form })
    const out = await res.json()
    if (res.ok && out.secure_url) return out.secure_url.replace('/image/upload/', '/image/upload/f_auto,q_auto/')
  } catch (e) {}
  return dataUrl
}

// Blog tables — health/food blog for order.foodfi.in
async function ensureBlogTables(sql) {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS blog_posts (
        id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        title           TEXT NOT NULL,
        slug            TEXT UNIQUE NOT NULL,
        excerpt         TEXT,
        content         TEXT NOT NULL,
        cover_image_url TEXT,
        author          TEXT DEFAULT 'FoodFi',
        food_name       TEXT,
        calories        INT,
        protein_g       NUMERIC,
        carbs_g         NUMERIC,
        fat_g           NUMERIC,
        fiber_g         NUMERIC,
        views           INT DEFAULT 0,
        likes           INT DEFAULT 0,
        shares          INT DEFAULT 0,
        published       BOOLEAN DEFAULT true,
        created_at      TIMESTAMP DEFAULT NOW()
      )
    `
    // Bilingual support (Hindi versions) — added later, safe to re-run
    await sql`ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS title_hi TEXT`
    await sql`ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS excerpt_hi TEXT`
    await sql`ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS content_hi TEXT`
    // SEO keywords, scheduling, and live item-image linking
    await sql`ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS keywords TEXT`
    await sql`ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ`
    await sql`ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS fitness_item_id UUID`
    await sql`ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS menu_item_id UUID`
    await sql`
      CREATE TABLE IF NOT EXISTS blog_comments (
        id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        post_id    UUID NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
        name       TEXT NOT NULL,
        comment    TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `
    await sql`
      CREATE TABLE IF NOT EXISTS blog_likes (
        post_id    UUID NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
        visitor_id TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(post_id, visitor_id)
      )
    `
  } catch (e) {}
}

function checkPassword(pw) {
  const real = process.env.BLOG_PASSWORD
  return !!real && pw === real
}

function slugify(title) {
  const base = (title || 'post').toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 60)
  return `${base || 'post'}-${Math.random().toString(36).slice(2, 7)}`
}

// GET — list all published posts, OR one post by ?slug= (increments views)
export async function GET(request) {
  const sql = getDb()
  await ensureBlogTables(sql)
  const { searchParams } = new URL(request.url)
  const slug = searchParams.get('slug')

  try {
    if (slug) {
      const [post] = await sql`SELECT * FROM blog_posts WHERE slug = ${slug} AND published = true`
      if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      // Live cover from the linked item — uploading the item photo later auto-shows here
      if (post.fitness_item_id || post.menu_item_id) {
        const [img] = post.fitness_item_id
          ? await sql`SELECT image_url FROM fitness_items WHERE id = ${post.fitness_item_id}`.catch(() => [])
          : await sql`SELECT image_url FROM menu_items WHERE id = ${post.menu_item_id}`.catch(() => [])
        if (img?.image_url) post.cover_image_url = img.image_url
      }
      await sql`UPDATE blog_posts SET views = views + 1 WHERE id = ${post.id}`.catch(() => {})
      const comments = await sql`SELECT id, name, comment, created_at FROM blog_comments WHERE post_id = ${post.id} ORDER BY created_at DESC`
      return NextResponse.json({ post: { ...post, views: post.views + 1 }, comments })
    }

    const posts = await sql`
      SELECT p.id, p.title, p.slug, p.excerpt, p.author, p.created_at,
             p.views, p.likes, p.shares, p.food_name,
             p.calories, p.protein_g, p.carbs_g, p.fat_g, p.fiber_g,
             COALESCE(fi.image_url, mi.image_url, p.cover_image_url) AS cover_image_url,
             (SELECT COUNT(*)::int FROM blog_comments c WHERE c.post_id = p.id) AS comment_count
      FROM blog_posts p
      LEFT JOIN fitness_items fi ON fi.id = p.fitness_item_id
      LEFT JOIN menu_items mi ON mi.id = p.menu_item_id
      WHERE p.published = true
      ORDER BY p.created_at DESC
    `
    return NextResponse.json({ posts })
  } catch (e) {
    return NextResponse.json({ posts: [] })
  }
}

// POST — create a post (password required)
export async function POST(request) {
  const sql = getDb()
  await ensureBlogTables(sql)
  const d = await request.json()

  if (!checkPassword(d.password)) {
    return NextResponse.json({ error: 'Galat password' }, { status: 401 })
  }

  // Image upload (password-gated) — returns Cloudinary URL
  if (d.action === 'upload') {
    if (!d.base64) return NextResponse.json({ error: 'No image' }, { status: 400 })
    const url = await uploadToCloudinary(d.base64, d.mimeType)
    return NextResponse.json({ url })
  }

  if (!d.title?.trim() || !d.content?.trim()) {
    return NextResponse.json({ error: 'Title aur content zaroori hai' }, { status: 400 })
  }

  try {
    const slug = slugify(d.title)
    const excerpt = d.excerpt?.trim() || d.content.replace(/<[^>]*>/g, '').slice(0, 160)
    const [post] = await sql`
      INSERT INTO blog_posts (
        title, slug, excerpt, content, cover_image_url, author,
        title_hi, excerpt_hi, content_hi,
        food_name, calories, protein_g, carbs_g, fat_g, fiber_g
      ) VALUES (
        ${d.title.trim()}, ${slug}, ${excerpt}, ${d.content}, ${d.cover_image_url || null}, ${d.author?.trim() || 'FoodFi'},
        ${d.title_hi?.trim() || null}, ${d.excerpt_hi?.trim() || null}, ${d.content_hi?.trim() || null},
        ${d.food_name?.trim() || null},
        ${d.calories != null && d.calories !== '' ? parseInt(d.calories) : null},
        ${d.protein_g != null && d.protein_g !== '' ? parseFloat(d.protein_g) : null},
        ${d.carbs_g != null && d.carbs_g !== '' ? parseFloat(d.carbs_g) : null},
        ${d.fat_g != null && d.fat_g !== '' ? parseFloat(d.fat_g) : null},
        ${d.fiber_g != null && d.fiber_g !== '' ? parseFloat(d.fiber_g) : null}
      ) RETURNING *
    `
    return NextResponse.json({ post })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// PATCH — like / comment / share (public, no password)
export async function PATCH(request) {
  const sql = getDb()
  await ensureBlogTables(sql)
  const d = await request.json()
  if (!d.id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  try {
    if (d.action === 'like') {
      // One like per visitor (tracked by client-generated visitor_id)
      if (!d.visitor_id) return NextResponse.json({ error: 'visitor_id required' }, { status: 400 })
      const [row] = await sql`
        INSERT INTO blog_likes (post_id, visitor_id) VALUES (${d.id}::uuid, ${d.visitor_id})
        ON CONFLICT (post_id, visitor_id) DO NOTHING RETURNING post_id
      `
      if (row) await sql`UPDATE blog_posts SET likes = likes + 1 WHERE id = ${d.id}::uuid`
      const [p] = await sql`SELECT likes FROM blog_posts WHERE id = ${d.id}::uuid`
      return NextResponse.json({ likes: p?.likes || 0, liked: true })
    }

    if (d.action === 'comment') {
      if (!d.name?.trim() || !d.comment?.trim()) return NextResponse.json({ error: 'Naam aur comment zaroori hai' }, { status: 400 })
      const [c] = await sql`
        INSERT INTO blog_comments (post_id, name, comment)
        VALUES (${d.id}::uuid, ${d.name.trim().slice(0, 60)}, ${d.comment.trim().slice(0, 600)})
        RETURNING id, name, comment, created_at
      `
      return NextResponse.json({ comment: c })
    }

    if (d.action === 'share') {
      await sql`UPDATE blog_posts SET shares = shares + 1 WHERE id = ${d.id}::uuid`
      const [p] = await sql`SELECT shares FROM blog_posts WHERE id = ${d.id}::uuid`
      return NextResponse.json({ shares: p?.shares || 0 })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// DELETE — remove a post (password required, via ?id=&password=)
export async function DELETE(request) {
  const sql = getDb()
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  const pw = searchParams.get('password')
  if (!checkPassword(pw)) return NextResponse.json({ error: 'Galat password' }, { status: 401 })
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  try {
    await sql`DELETE FROM blog_posts WHERE id = ${id}::uuid`
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

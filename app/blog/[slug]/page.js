export const dynamic = 'force-dynamic'
import { getDb } from '@/lib/db'
import BlogPostClient from './BlogPostClient'

async function getPost(slug) {
  try {
    const sql = getDb()
    const [post] = await sql`
      SELECT p.title, p.excerpt, p.keywords, p.author, p.created_at, p.food_name,
             COALESCE(fi.image_url, mi.image_url, p.cover_image_url) AS cover_image_url
      FROM blog_posts p
      LEFT JOIN fitness_items fi ON fi.id = p.fitness_item_id
      LEFT JOIN menu_items mi ON mi.id = p.menu_item_id
      WHERE p.slug = ${slug} AND p.published = true`
    return post || null
  } catch { return null }
}

export async function generateMetadata({ params }) {
  const post = await getPost(params.slug)
  if (!post) return { title: 'FoodFi Blog — Health, Nutrition & Food' }
  const desc = (post.excerpt || post.title).slice(0, 160)
  const url = `https://order.foodfi.in/blog/${params.slug}`
  return {
    title: `${post.title} | FoodFi Blog`,
    description: desc,
    keywords: post.keywords || undefined,
    alternates: { canonical: url },
    openGraph: {
      type: 'article', title: post.title, description: desc, url, siteName: 'FoodFi',
      images: post.cover_image_url ? [{ url: post.cover_image_url }] : undefined,
      locale: 'en_IN',
    },
    twitter: {
      card: 'summary_large_image', title: post.title, description: desc,
      images: post.cover_image_url ? [post.cover_image_url] : undefined,
    },
  }
}

export default async function BlogPostPage({ params }) {
  const post = await getPost(params.slug)
  const jsonLd = post ? {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt || post.title,
    image: post.cover_image_url || 'https://order.foodfi.in/icons/icon-512.png',
    datePublished: post.created_at,
    dateModified: post.created_at,
    author: { '@type': 'Organization', name: post.author || 'FoodFi' },
    publisher: {
      '@type': 'Organization', name: 'FoodFi',
      logo: { '@type': 'ImageObject', url: 'https://order.foodfi.in/icons/icon-512.png' },
    },
    keywords: post.keywords || undefined,
    mainEntityOfPage: { '@type': 'WebPage', '@id': `https://order.foodfi.in/blog/${params.slug}` },
  } : null

  return (
    <>
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />}
      <BlogPostClient slug={params.slug} />
    </>
  )
}

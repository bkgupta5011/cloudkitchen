'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function BlogList() {
  const router = useRouter()
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/blog').then(r => r.json()).then(d => { setPosts(d.posts || []); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div style={{ minHeight: '100vh', background: '#faf9f7' }}>
      <div style={{ background: 'linear-gradient(135deg,#7c2d12,#ea580c)', color: '#fff', padding: '30px 20px 26px', textAlign: 'center' }}>
        <div style={{ fontSize: 27, fontWeight: 800 }}>📝 FoodFi Blog</div>
        <div style={{ fontSize: 13, opacity: 0.92, marginTop: 5 }}>Health · Nutrition · Food — sehat ki baatein 🧡</div>
      </div>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '22px 16px 60px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 50 }}><div className="spinner" /></div>
        ) : posts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '50px 20px', color: '#78716c' }}>
            <div style={{ fontSize: 42 }}>📭</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginTop: 10 }}>Abhi koi blog post nahi hai</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>Pehla blog jald aa raha hai — judе rahiye!</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 18 }}>
            {posts.map(p => (
              <article key={p.id} onClick={() => router.push('/blog/' + p.slug)}
                style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 14px #0000000d', cursor: 'pointer', border: '1px solid #f0eee9', transition: 'transform 0.15s, box-shadow 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 24px #0000001a' }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 2px 14px #0000000d' }}>
                {p.cover_image_url && <img src={p.cover_image_url} alt={p.title} loading="lazy" style={{ width: '100%', height: 200, objectFit: 'cover' }} />}
                <div style={{ padding: '16px 18px' }}>
                  <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 21, fontWeight: 800, color: '#1c1917', margin: 0, lineHeight: 1.3 }}>{p.title}</h2>
                  <div style={{ fontSize: 12, color: '#a8a29e', margin: '6px 0 10px' }}>✍️ {p.author} · {fmtDate(p.created_at)}{p.food_name ? ' · 🍽️ ' + p.food_name : ''}</div>
                  {p.excerpt && <p style={{ fontSize: 14.5, color: '#57534e', lineHeight: 1.6, margin: 0 }}>{p.excerpt}{p.excerpt.length >= 160 ? '…' : ''}</p>}
                  <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 12.5, color: '#78716c' }}>
                    <span>👁️ {p.views}</span><span>❤️ {p.likes}</span><span>💬 {p.comment_count}</span><span>🔗 {p.shares}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

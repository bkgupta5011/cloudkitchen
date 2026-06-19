'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

const SOCIAL = {
  instagram: 'https://www.instagram.com/foodfi.in',
  whatsapp: 'https://wa.me/917546983536',
  site1: 'https://foodfi.in',
  site2: 'https://order.foodfi.in',
}

function visitorId() {
  try {
    let v = localStorage.getItem('ck_visitor')
    if (!v) { v = 'v_' + Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('ck_visitor', v) }
    return v
  } catch { return 'anon' }
}

function NutBox({ label, val, unit, c }) {
  return (
    <div style={{ background: '#fff', borderRadius: 10, padding: '8px 12px', textAlign: 'center', minWidth: 64, border: '1px solid #fed7aa' }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: c }}>{val}{unit}</div>
      <div style={{ fontSize: 10, color: '#78716c', fontWeight: 600 }}>{label}</div>
    </div>
  )
}
const linkStyle = (c) => ({ display: 'inline-block', background: '#fff', border: '1.5px solid ' + c, color: c, borderRadius: 20, padding: '7px 14px', fontSize: 13, fontWeight: 700, textDecoration: 'none' })
const inp = (w) => ({ flex: w ? 'none' : 1, width: w || 'auto', padding: '9px 11px', border: '1px solid #e7e5e4', borderRadius: 9, fontSize: 14, outline: 'none', fontFamily: 'inherit', background: '#fff' })

export default function BlogPost() {
  const { slug } = useParams()
  const router = useRouter()
  const [post, setPost] = useState(null)
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(true)
  const [liked, setLiked] = useState(false)
  const [cName, setCName] = useState('')
  const [cText, setCText] = useState('')
  const [posting, setPosting] = useState(false)

  useEffect(() => {
    if (!slug) return
    fetch('/api/blog?slug=' + slug).then(r => r.json()).then(d => {
      if (d.post) {
        setPost(d.post); setComments(d.comments || [])
        try { setLiked(!!localStorage.getItem('liked_' + d.post.id)) } catch {}
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [slug])

  const like = async () => {
    if (!post || liked) return
    setLiked(true); setPost(p => ({ ...p, likes: p.likes + 1 }))
    try { localStorage.setItem('liked_' + post.id, '1') } catch {}
    try {
      const r = await fetch('/api/blog', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'like', id: post.id, visitor_id: visitorId() }) })
      const d = await r.json(); if (d.likes != null) setPost(p => ({ ...p, likes: d.likes }))
    } catch {}
  }

  const share = async (where) => {
    const url = SOCIAL.site2 + '/blog/' + post.slug
    const text = post.title + ' — FoodFi Blog'
    fetch('/api/blog', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'share', id: post.id }) })
      .then(r => r.json()).then(d => { if (d.shares != null) setPost(p => ({ ...p, shares: d.shares })) }).catch(() => {})
    if (where === 'whatsapp') window.open('https://wa.me/?text=' + encodeURIComponent(text + ' ' + url), '_blank')
    else { try { await navigator.clipboard.writeText(url); alert('🔗 Link copy ho gaya!') } catch {} }
  }

  const submitComment = async () => {
    if (!cName.trim() || !cText.trim()) return
    setPosting(true)
    try {
      const r = await fetch('/api/blog', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'comment', id: post.id, name: cName, comment: cText }) })
      const d = await r.json()
      if (d.comment) { setComments(c => [d.comment, ...c]); setCText('') }
    } catch {}
    setPosting(false)
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 60 }}><div className="spinner" /></div>
  if (!post) return <div style={{ textAlign: 'center', padding: 60, color: '#78716c' }}>Blog nahi mila. <span onClick={() => router.push('/blog')} style={{ color: '#ea580c', cursor: 'pointer', fontWeight: 700 }}>← Blog Corner</span></div>

  const hasNutrition = post.calories != null || post.protein_g != null || post.carbs_g != null || post.fat_g != null
  const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div style={{ minHeight: '100vh', background: '#faf9f7' }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: '#fff', borderBottom: '1px solid #eee', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={() => router.push('/blog')} style={{ background: '#f5f5f4', border: 'none', width: 34, height: 34, borderRadius: 10, fontSize: 16, cursor: 'pointer' }}>←</button>
        <span style={{ fontWeight: 700, color: '#1c1917' }}>FoodFi Blog</span>
      </div>

      <article style={{ maxWidth: 720, margin: '0 auto', background: '#fff', minHeight: '90vh' }}>
        {post.cover_image_url && <img src={post.cover_image_url} alt={post.title} style={{ width: '100%', height: 300, objectFit: 'cover' }} />}
        <div style={{ padding: '24px 22px 40px' }}>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 31, fontWeight: 800, color: '#1c1917', lineHeight: 1.25, margin: 0 }}>{post.title}</h1>
          <div style={{ fontSize: 13, color: '#a8a29e', margin: '12px 0 0', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <span>✍️ {post.author}</span><span>{fmtDate(post.created_at)}</span><span>👁️ {post.views} views</span>
          </div>

          {hasNutrition && (
            <div style={{ background: 'linear-gradient(135deg,#fff7ed,#ffedd5)', border: '1px solid #fed7aa', borderRadius: 14, padding: '14px 16px', margin: '20px 0' }}>
              {post.food_name && <div style={{ fontSize: 14, fontWeight: 800, color: '#9a3412', marginBottom: 10 }}>🍽️ {post.food_name} — Nutrition</div>}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {post.calories != null && <NutBox label="Calories" val={post.calories} unit=" kcal" c="#ea580c" />}
                {post.protein_g != null && <NutBox label="Protein" val={post.protein_g} unit="g" c="#059669" />}
                {post.carbs_g != null && <NutBox label="Carbs" val={post.carbs_g} unit="g" c="#2563eb" />}
                {post.fat_g != null && <NutBox label="Fat" val={post.fat_g} unit="g" c="#d97706" />}
                {post.fiber_g != null && <NutBox label="Fiber" val={post.fiber_g} unit="g" c="#7c3aed" />}
              </div>
            </div>
          )}

          <div style={{ fontFamily: 'Georgia, serif', fontSize: 17.5, lineHeight: 1.85, color: '#292524', marginTop: 18, whiteSpace: 'pre-wrap' }}>{post.content}</div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '28px 0 18px', flexWrap: 'wrap' }}>
            <button onClick={like} disabled={liked} style={{ display: 'flex', alignItems: 'center', gap: 7, background: liked ? '#fee2e2' : '#fff', border: '1.5px solid ' + (liked ? '#fca5a5' : '#e7e5e4'), color: liked ? '#dc2626' : '#57534e', borderRadius: 24, padding: '9px 18px', fontSize: 14, fontWeight: 700, cursor: liked ? 'default' : 'pointer' }}>
              {liked ? '❤️' : '🤍'} {post.likes} Like{post.likes !== 1 ? 's' : ''}
            </button>
            <button onClick={() => share('whatsapp')} style={{ background: '#25d366', color: '#fff', border: 'none', borderRadius: 24, padding: '9px 16px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>💬 Share</button>
            <button onClick={() => share('copy')} style={{ background: '#fff', border: '1.5px solid #e7e5e4', color: '#57534e', borderRadius: 24, padding: '9px 16px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>🔗 Copy link</button>
            <span style={{ fontSize: 13, color: '#a8a29e' }}>{post.shares} shares</span>
          </div>

          <div style={{ borderTop: '1px solid #eee', borderBottom: '1px solid #eee', padding: '18px 0', margin: '10px 0 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 12.5, color: '#78716c', marginBottom: 12 }}>FoodFi se judе raho 🧡</div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <a href={SOCIAL.instagram} target="_blank" rel="noreferrer" style={linkStyle('#e1306c')}>📷 Instagram</a>
              <a href={SOCIAL.whatsapp} target="_blank" rel="noreferrer" style={linkStyle('#25d366')}>💬 WhatsApp</a>
              <a href={SOCIAL.site1} target="_blank" rel="noreferrer" style={linkStyle('#ea580c')}>🌐 foodfi.in</a>
              <a href={SOCIAL.site2} target="_blank" rel="noreferrer" style={linkStyle('#0891b2')}>🍴 Order Now</a>
            </div>
          </div>

          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#1c1917', marginBottom: 12 }}>💬 Comments ({comments.length})</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input value={cName} onChange={e => setCName(e.target.value)} placeholder="Aapka naam" style={inp(120)} />
              <input value={cText} onChange={e => setCText(e.target.value)} placeholder="Comment likho..." onKeyDown={e => e.key === 'Enter' && submitComment()} style={inp(null)} />
            </div>
            <button onClick={submitComment} disabled={posting || !cName.trim() || !cText.trim()} style={{ background: '#ea580c', color: '#fff', border: 'none', borderRadius: 10, padding: '9px 20px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', marginBottom: 18, opacity: (posting || !cName.trim() || !cText.trim()) ? 0.5 : 1 }}>{posting ? '...' : 'Post Comment'}</button>
            <div style={{ display: 'grid', gap: 12 }}>
              {comments.map(c => (
                <div key={c.id} style={{ background: '#faf9f7', borderRadius: 12, padding: '12px 14px', border: '1px solid #f0eee9' }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: '#1c1917' }}>{c.name}</div>
                  <div style={{ fontSize: 14, color: '#44403c', marginTop: 3, lineHeight: 1.5 }}>{c.comment}</div>
                </div>
              ))}
              {comments.length === 0 && <div style={{ fontSize: 13, color: '#a8a29e', textAlign: 'center', padding: 14 }}>Pehla comment aap karo! 😊</div>}
            </div>
          </div>
        </div>
      </article>
    </div>
  )
}

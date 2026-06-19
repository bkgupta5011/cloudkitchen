'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function OrderPreview() {
  const router = useRouter()
  const [bg, setBg] = useState([])
  const [idx, setIdx] = useState(0)
  const [featured, setFeatured] = useState([])

  useEffect(() => {
    Promise.all([
      fetch('/api/public/menu').then(r => r.json()).catch(() => ({ items: [] })),
      fetch('/api/fitness').then(r => r.json()).catch(() => ({ items: [] })),
    ]).then(([menu, fit]) => {
      const m = (menu.items || []).filter(i => i.image_url)
      const f = (fit.items || []).filter(i => i.image_url)
      const imgs = [...m, ...f].map(i => i.image_url)
      // shuffle + cap to 14 for the rotating background
      for (let i = imgs.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[imgs[i], imgs[j]] = [imgs[j], imgs[i]] }
      setBg(imgs.slice(0, 14))
      // featured: ₹99 combos + a few fitness items
      const deals = m.filter(i => Math.round(i.price * (1 - (i.discount_percent || 0) / 100)) === 99).slice(0, 6)
      setFeatured([...deals, ...f.slice(0, 4)])
    })
  }, [])

  useEffect(() => {
    if (bg.length < 2) return
    const t = setInterval(() => setIdx(i => (i + 1) % bg.length), 3200)
    return () => clearInterval(t)
  }, [bg])

  const cta = { flex: '1 1 200px', maxWidth: 260, background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 18, padding: '20px 18px', color: '#fff', textDecoration: 'none', cursor: 'pointer', transition: 'transform 0.18s, background 0.18s', textAlign: 'left' }

  return (
    <div style={{ background: '#0c0a09', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ position: 'relative', minHeight: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {bg.map((src, i) => (
          <div key={i} style={{ position: 'absolute', inset: 0, backgroundImage: `url(${src})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: i === idx ? 1 : 0, transition: 'opacity 1.3s ease', transform: i === idx ? 'scale(1.08)' : 'scale(1)', transitionProperty: 'opacity, transform', transitionDuration: '1.3s, 6s' }} />
        ))}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(12,10,9,0.45) 0%, rgba(12,10,9,0.72) 55%, rgba(12,10,9,0.95) 100%)' }} />

        <div style={{ position: 'relative', zIndex: 2, flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '40px 22px' }}>
          <div style={{ fontSize: 12.5, letterSpacing: 4, opacity: 0.85, textTransform: 'uppercase', marginBottom: 6 }}>Patna&apos;s Cloud Kitchen 🛵</div>
          <h1 style={{ fontSize: 'clamp(46px,11vw,92px)', fontWeight: 900, margin: 0, letterSpacing: -2, lineHeight: 0.95, background: 'linear-gradient(135deg,#fb923c,#ef4444)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>FoodFi</h1>
          <div style={{ fontSize: 'clamp(15px,3.6vw,21px)', opacity: 0.94, maxWidth: 540, marginTop: 14, lineHeight: 1.5 }}>Ghar jaisа khana · har niwale mein dil 🧡<br />Fresh, fast aur ekdum tasty.</div>

          <div style={{ display: 'flex', gap: 16, marginTop: 38, flexWrap: 'wrap', justifyContent: 'center', width: '100%', maxWidth: 560 }}>
            <a onClick={() => router.push('/menu')} style={cta}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.background = 'rgba(255,255,255,0.2)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.background = 'rgba(255,255,255,0.12)' }}>
              <div style={{ fontSize: 30 }}>🍛</div>
              <div style={{ fontSize: 18, fontWeight: 800, marginTop: 6 }}>Regular Menu</div>
              <div style={{ fontSize: 12.5, opacity: 0.8, marginTop: 2 }}>Rajma · Chole · Roti combos — ₹99 se</div>
            </a>
            <a onClick={() => router.push('/fitness')} style={cta}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.background = 'rgba(255,255,255,0.2)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.background = 'rgba(255,255,255,0.12)' }}>
              <div style={{ fontSize: 30 }}>🥗</div>
              <div style={{ fontSize: 18, fontWeight: 800, marginTop: 6 }}>Fitness Corner</div>
              <div style={{ fontSize: 12.5, opacity: 0.8, marginTop: 2 }}>High-protein · calorie-counted meals</div>
            </a>
          </div>

          <div style={{ marginTop: 34, fontSize: 12.5, opacity: 0.7, animation: 'bobPv 1.6s ease-in-out infinite' }}>↓ Aaj ke specials</div>
        </div>
      </div>

      <div style={{ position: 'relative', zIndex: 2, background: '#0c0a09', padding: '10px 0 46px' }}>
        <div style={{ maxWidth: 980, margin: '0 auto', padding: '0 18px' }}>
          <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>🔥 Aaj ke Specials</div>
          <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 16 }}>Tap karke order karo</div>
          <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 8 }}>
            {featured.map((it, i) => {
              const dp = Math.round(it.price * (1 - (it.discount_percent || 0) / 100))
              return (
                <div key={i} onClick={() => router.push(it.calories ? '/fitness' : '/menu')} style={{ flex: '0 0 auto', width: 168, background: '#1c1917', borderRadius: 16, overflow: 'hidden', cursor: 'pointer', border: '1px solid #292524' }}>
                  <div style={{ height: 120, background: '#292524' }}>
                    {it.image_url ? <img src={it.image_url} alt={it.name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 38 }}>{it.calories ? '🥗' : '🍛'}</div>}
                  </div>
                  <div style={{ padding: '10px 12px' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.3, height: 34, overflow: 'hidden' }}>{it.name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                      <span style={{ fontSize: 15, fontWeight: 800, color: '#fb923c' }}>₹{dp}</span>
                      {it.calories && <span style={{ fontSize: 10.5, color: '#a8a29e' }}>· {it.calories} kcal</span>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div style={{ marginTop: 34, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, textAlign: 'center' }}>
            <div style={{ background: '#1c1917', borderRadius: 14, padding: '16px' }}><div style={{ fontSize: 24 }}>🛵</div><div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>Fast Delivery</div></div>
            <div style={{ background: '#1c1917', borderRadius: 14, padding: '16px' }}><div style={{ fontSize: 24 }}>🍳</div><div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>Freshly Cooked</div></div>
            <div style={{ background: '#1c1917', borderRadius: 14, padding: '16px' }}><div style={{ fontSize: 24 }}>💪</div><div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>Healthy Options</div></div>
            <div style={{ background: '#1c1917', borderRadius: 14, padding: '16px' }}><div style={{ fontSize: 24 }}>💚</div><div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>₹99 se Shuru</div></div>
          </div>

          <div style={{ textAlign: 'center', marginTop: 34 }}>
            <button onClick={() => router.push('/menu')} style={{ background: 'linear-gradient(135deg,#fb923c,#ef4444)', color: '#fff', border: 'none', borderRadius: 30, padding: '14px 40px', fontSize: 16, fontWeight: 800, cursor: 'pointer', boxShadow: '0 6px 22px rgba(239,68,68,0.4)' }}>Order Now →</button>
          </div>
          <div style={{ textAlign: 'center', marginTop: 14, fontSize: 11, color: '#57534e' }}>SAMPLE PREVIEW — live site abhi change nahi hui</div>
        </div>
      </div>

      <style>{`@keyframes bobPv{0%,100%{transform:translateY(0)}50%{transform:translateY(6px)}}`}</style>
    </div>
  )
}

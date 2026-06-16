'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Macro chip
function Macro({ label, value, unit, color }) {
  return (
    <div style={{ flex: 1, textAlign: 'center', background: '#fff', borderRadius: 10, padding: '6px 4px', border: '1px solid #e5e7eb' }}>
      <div style={{ fontSize: 14, fontWeight: 800, color }}>{value}{unit}</div>
      <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 }}>{label}</div>
    </div>
  )
}

export default function FitnessCorner() {
  const router = useRouter()
  const [items, setItems] = useState([])
  const [cornerEnabled, setCornerEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [vegOnly, setVegOnly] = useState(false)

  const [cart, setCart] = useState({})

  useEffect(() => {
    fetch('/api/fitness')
      .then(r => r.json())
      .then(d => { setItems(d.items || []); setCornerEnabled(!!d.cornerEnabled); setLoading(false) })
      .catch(() => setLoading(false))
    try { setCart(JSON.parse(localStorage.getItem('ck_cart') || '{}')) } catch {}
  }, [])

  // Same cart as the rest of the app (ck_cart) — keep local + server in sync
  const syncCart = (next) => {
    setCart(next)
    try { localStorage.setItem('ck_cart', JSON.stringify(next)) } catch {}
    fetch('/api/cart', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cart: next }) }).catch(() => {})
  }
  const addItem = (id) => syncCart({ ...cart, [id]: (cart[id] || 0) + 1 })
  const removeItem = (id) => { const n = (cart[id] || 0) - 1; const next = { ...cart }; if (n <= 0) delete next[id]; else next[id] = n; syncCart(next) }

  const dp = (it) => it.discount_percent > 0 ? Math.round(it.price * (1 - it.discount_percent / 100)) : Math.round(it.price)
  const shown = vegOnly ? items.filter(i => i.is_veg) : items
  const cartCount = Object.values(cart).reduce((a, b) => a + b, 0)

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg,#f0fdf4,#ffffff 240px)', paddingBottom: 40 }}>
     <div style={{ maxWidth: 1160, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'linear-gradient(135deg,#065f46,#059669)', color: '#fff', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 2px 12px #0002' }}>
        <button onClick={() => router.push('/menu')} style={{ background: 'rgba(255,255,255,0.18)', border: 'none', color: '#fff', width: 34, height: 34, borderRadius: 10, fontSize: 18, cursor: 'pointer', flexShrink: 0 }}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.1 }}>🥗 Fitness Freak Corner</div>
          <div style={{ fontSize: 11.5, opacity: 0.9 }}>High-protein, calorie-counted healthy meals</div>
        </div>
      </div>

      {/* Coming soon banner */}
      {!cornerEnabled && (
        <div style={{ margin: '14px 16px 6px', background: 'linear-gradient(135deg,#fffbeb,#fef3c7)', border: '1.5px solid #fbbf24', borderRadius: 14, padding: '14px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: 24, marginBottom: 2 }}>🔜</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#92400e' }}>Coming Soon!</div>
          <div style={{ fontSize: 12.5, color: '#b45309', marginTop: 3 }}>
            Ye healthy corner abhi launch nahi hua — jald aa raha hai. Tab tak menu dekho 👇 aur nutrition explore karo!
          </div>
        </div>
      )}

      {/* Veg filter */}
      {!loading && items.length > 0 && (
        <div style={{ display: 'flex', gap: 8, padding: '10px 16px 4px' }}>
          <button onClick={() => setVegOnly(false)} style={{ flex: 1, padding: '8px', borderRadius: 10, border: '1.5px solid ' + (!vegOnly ? '#059669' : '#e5e7eb'), background: !vegOnly ? '#059669' : '#fff', color: !vegOnly ? '#fff' : '#374151', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>All ({items.length})</button>
          <button onClick={() => setVegOnly(true)} style={{ flex: 1, padding: '8px', borderRadius: 10, border: '1.5px solid ' + (vegOnly ? '#059669' : '#e5e7eb'), background: vegOnly ? '#059669' : '#fff', color: vegOnly ? '#fff' : '#374151', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>🟢 Veg ({items.filter(i => i.is_veg).length})</button>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#6b7280' }}><div className="spinner" /></div>
      ) : (
        <div style={{ padding: '8px 16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 14 }}>
          {shown.map(it => (
            <div key={it.id} style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 12px #0000000d', border: '1px solid #ecfdf5' }}>
              {/* Photo (Cloudinary) — green placeholder until a photo is added */}
              <div style={{ position: 'relative', width: '100%', height: 156, background: 'linear-gradient(135deg,#d1fae5,#a7f3d0)' }}>
                {it.image_url ? (
                  <img src={it.image_url} alt={it.name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }} />
                ) : null}
                <div style={{ display: it.image_url ? 'none' : 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', fontSize: 56 }}>🥗</div>
                <span style={{ position: 'absolute', top: 8, left: 8, width: 18, height: 18, background: '#fff', border: '1.5px solid ' + (it.is_veg ? '#16a34a' : '#dc2626'), borderRadius: 4, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: it.is_veg ? '#16a34a' : '#dc2626' }} />
                </span>
                {it.diet_tag && (
                  <span style={{ position: 'absolute', top: 8, right: 8, background: '#065f46', color: '#fff', fontSize: 10.5, fontWeight: 800, padding: '4px 9px', borderRadius: 20 }}>{it.diet_tag}</span>
                )}
              </div>

              {/* Content */}
              <div style={{ padding: 14 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#111827', lineHeight: 1.2 }}>{it.name}</div>
                {it.about && <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.35, marginTop: 3 }}>{it.about}</div>}

                {/* Calories highlight */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '12px 0 8px' }}>
                  <div style={{ background: 'linear-gradient(135deg,#f97316,#ef4444)', color: '#fff', borderRadius: 10, padding: '8px 12px', textAlign: 'center', minWidth: 78 }}>
                    <div style={{ fontSize: 17, fontWeight: 800, lineHeight: 1 }}>{it.calories}</div>
                    <div style={{ fontSize: 9.5, fontWeight: 700, opacity: 0.95 }}>KCAL</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flex: 1 }}>
                    <Macro label="Protein" value={it.protein_g} unit="g" color="#059669" />
                    <Macro label="Carbs" value={it.carbs_g} unit="g" color="#2563eb" />
                    <Macro label="Fat" value={it.fat_g} unit="g" color="#d97706" />
                    <Macro label="Fiber" value={it.fiber_g} unit="g" color="#7c3aed" />
                  </div>
                </div>

                {it.other_nutrients && (
                  <div style={{ fontSize: 11.5, color: '#6b7280', marginBottom: 10 }}>💊 {it.other_nutrients}</div>
                )}

                {/* Price + action */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px dashed #e5e7eb', paddingTop: 10 }}>
                  <div style={{ fontSize: 17, fontWeight: 800, color: '#065f46' }}>₹{dp(it)}</div>
                  {cornerEnabled && it.is_available ? (
                    (cart[it.id] || 0) === 0 ? (
                      <button onClick={() => addItem(it.id)} style={{ background: '#059669', color: '#fff', border: 'none', fontSize: 13, fontWeight: 700, padding: '8px 20px', borderRadius: 10, cursor: 'pointer' }}>+ Add</button>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: '#ecfdf5', borderRadius: 10, padding: '5px 12px', border: '1px solid #a7f3d0' }}>
                        <button onClick={() => removeItem(it.id)} style={{ background: 'none', border: 'none', fontSize: 20, fontWeight: 800, color: '#059669', cursor: 'pointer', lineHeight: 1 }}>−</button>
                        <span style={{ fontWeight: 800, color: '#065f46', minWidth: 14, textAlign: 'center' }}>{cart[it.id]}</span>
                        <button onClick={() => addItem(it.id)} style={{ background: 'none', border: 'none', fontSize: 20, fontWeight: 800, color: '#059669', cursor: 'pointer', lineHeight: 1 }}>+</button>
                      </div>
                    )
                  ) : (
                    <span style={{ background: '#fef3c7', color: '#92400e', fontSize: 12, fontWeight: 700, padding: '7px 14px', borderRadius: 10 }}>🔜 Coming Soon</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && items.length === 0 && (
        <div style={{ textAlign: 'center', padding: 50, color: '#6b7280' }}>Abhi koi item nahi hai.</div>
      )}
     </div>

      {/* Floating cart bar */}
      {cartCount > 0 && (
        <div onClick={() => router.push('/cart')} style={{ position: 'fixed', bottom: 16, left: 16, right: 16, maxWidth: 560, margin: '0 auto', background: 'linear-gradient(135deg,#065f46,#059669)', color: '#fff', borderRadius: 14, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', boxShadow: '0 6px 22px #05966677', zIndex: 30 }}>
          <span style={{ fontWeight: 700 }}>🛒 {cartCount} item{cartCount > 1 ? 's' : ''} in cart</span>
          <span style={{ fontWeight: 800 }}>View Cart ›</span>
        </div>
      )}
    </div>
  )
}

'use client'
import { useState, useEffect } from 'react'

const FOODFI_URL = 'https://foodfi.in'

function getCategoryEmoji(cat) {
  const map = {
    'Biryani': '🍛', 'Rice': '🍚', 'Curry': '🥘', 'Dal': '🫕',
    'Roti': '🫓', 'Bread': '🫓', 'Snacks': '🍟', 'Starter': '🍗',
    'Dessert': '🍮', 'Drinks': '🥤', 'Thali': '🍽️', 'Combo': '🎁',
    'Chicken': '🍗', 'Paneer': '🧀', 'Veg': '🥗', 'Non-Veg': '🍖',
  }
  for (const k of Object.keys(map)) {
    if (cat?.toLowerCase().includes(k.toLowerCase())) return map[k]
  }
  return '🍴'
}

function getDiscountedPrice(price, discount) {
  if (!discount || discount <= 0) return parseFloat(price)
  return parseFloat(price) * (1 - discount / 100)
}

export default function OrderPage() {
  const [items, setItems] = useState([])
  const [categories, setCategories] = useState([])
  const [activeCategory, setActiveCategory] = useState('All')
  const [search, setSearch] = useState('')
  const [selectedItem, setSelectedItem] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/public/menu')
      .then(r => r.json())
      .then(({ items = [], categories = [] }) => {
        setItems(items)
        setCategories(['All', ...categories])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const filtered = items.filter(item => {
    const matchCat = activeCategory === 'All' || item.category === activeCategory
    const matchSearch = !search || item.name.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  const handleOrder = () => {
    window.open(FOODFI_URL, '_blank')
  }

  return (
    <div style={{ fontFamily: "'Segoe UI', sans-serif", background: '#fafafa', minHeight: '100vh' }}>

      {/* ── Hero ───────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, #e85d04 0%, #f97316 50%, #fb923c 100%)',
        padding: '32px 20px 48px', textAlign: 'center', position: 'relative', overflow: 'hidden'
      }}>
        {/* Background pattern */}
        <div style={{ position:'absolute', inset:0, opacity:0.08, backgroundImage:'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize:'24px 24px' }} />

        <div style={{ position:'relative', zIndex:1 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:12, marginBottom:8 }}>
            <img src="/icons/icon-192.png" alt="FoodFi" style={{ width:52, height:52, borderRadius:14, boxShadow:'0 4px 16px rgba(0,0,0,0.2)' }} />
            <div style={{ textAlign:'left' }}>
              <h1 style={{ margin:0, fontSize:28, fontWeight:900, color:'#fff', letterSpacing:'-0.5px', lineHeight:1 }}>
                Food<span style={{ color:'#fff3' }}>Fi</span>
              </h1>
              <p style={{ margin:0, fontSize:12, color:'rgba(255,255,255,0.85)', fontWeight:500 }}>Cloud Kitchen · Patna</p>
            </div>
          </div>

          <h2 style={{ margin:'16px 0 8px', fontSize:22, fontWeight:800, color:'#fff', lineHeight:1.3 }}>
            Fresh Homemade Food<br />Delivered to Your Door 🚀
          </h2>
          <p style={{ margin:'0 0 20px', color:'rgba(255,255,255,0.9)', fontSize:14 }}>
            Order online · Cash on delivery · 30-45 min
          </p>

          <button onClick={handleOrder} style={{
            background:'#fff', color:'#e85d04', border:'none', borderRadius:50,
            padding:'14px 32px', fontSize:16, fontWeight:800, cursor:'pointer',
            boxShadow:'0 8px 24px rgba(0,0,0,0.15)',
            display:'inline-flex', alignItems:'center', gap:8,
          }}>
            🛒 Order Now
          </button>
        </div>
      </div>

      {/* ── Search ─────────────────────────────────── */}
      <div style={{ padding:'0 16px', marginTop:-20, position:'relative', zIndex:2, maxWidth:600, margin:'-20px auto 0' }}>
        <div style={{
          background:'#fff', borderRadius:14, boxShadow:'0 4px 20px rgba(0,0,0,0.1)',
          display:'flex', alignItems:'center', padding:'12px 16px', gap:10
        }}>
          <span style={{ fontSize:18 }}>🔍</span>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search menu items..."
            style={{ border:'none', outline:'none', flex:1, fontSize:15, background:'transparent', color:'#1f2937' }}
          />
          {search && <button onClick={() => setSearch('')} style={{ border:'none', background:'none', cursor:'pointer', color:'#9ca3af', fontSize:18 }}>✕</button>}
        </div>
      </div>

      <div style={{ maxWidth:900, margin:'0 auto', padding:'20px 16px 100px' }}>

        {/* ── Category Tabs ───────────────────────── */}
        <div style={{ display:'flex', gap:8, overflowX:'auto', paddingBottom:8, marginBottom:20, scrollbarWidth:'none' }}>
          {categories.map(cat => (
            <button key={cat} onClick={() => setActiveCategory(cat)}
              style={{
                padding:'8px 18px', borderRadius:50, border:'none', cursor:'pointer', whiteSpace:'nowrap',
                fontSize:13, fontWeight:700, transition:'all 0.15s',
                background: activeCategory === cat ? '#e85d04' : '#fff',
                color: activeCategory === cat ? '#fff' : '#374151',
                boxShadow: activeCategory === cat ? '0 4px 12px rgba(232,93,4,0.35)' : '0 2px 8px rgba(0,0,0,0.08)',
              }}>
              {cat === 'All' ? '🍽️ All Items' : `${getCategoryEmoji(cat)} ${cat}`}
            </button>
          ))}
        </div>

        {/* ── Items count ─────────────────────────── */}
        {!loading && (
          <p style={{ color:'#9ca3af', fontSize:13, marginBottom:16 }}>
            {filtered.length} item{filtered.length !== 1 ? 's' : ''}{activeCategory !== 'All' ? ` in ${activeCategory}` : ''}
          </p>
        )}

        {/* ── Loading ─────────────────────────────── */}
        {loading && (
          <div style={{ textAlign:'center', padding:'60px 0' }}>
            <div style={{
              width:48, height:48, border:'4px solid #f3f4f6', borderTop:'4px solid #e85d04',
              borderRadius:'50%', animation:'spin 0.8s linear infinite', margin:'0 auto 16px'
            }} />
            <p style={{ color:'#9ca3af', fontSize:14 }}>Loading menu...</p>
          </div>
        )}

        {/* ── Item Grid ───────────────────────────── */}
        {!loading && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(160px, 1fr))', gap:16 }}>
            {filtered.map(item => {
              const finalPrice = getDiscountedPrice(item.price, item.discount_percent)
              const hasDiscount = item.discount_percent > 0
              return (
                <div key={item.id} onClick={() => setSelectedItem(item)}
                  style={{
                    background:'#fff', borderRadius:16, overflow:'hidden', cursor:'pointer',
                    boxShadow:'0 2px 12px rgba(0,0,0,0.08)', transition:'all 0.2s',
                    border:'1px solid #f3f4f6',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform='translateY(-4px)'; e.currentTarget.style.boxShadow='0 8px 24px rgba(0,0,0,0.14)' }}
                  onMouseLeave={e => { e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow='0 2px 12px rgba(0,0,0,0.08)' }}
                >
                  {/* Image */}
                  <div style={{ position:'relative', aspectRatio:'1', background:'#fff7ed', overflow:'hidden' }}>
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.name}
                        style={{ width:'100%', height:'100%', objectFit:'cover' }}
                        onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='flex' }}
                      />
                    ) : null}
                    <div style={{
                      display: item.image_url ? 'none' : 'flex',
                      alignItems:'center', justifyContent:'center',
                      width:'100%', height:'100%', fontSize:48,
                    }}>
                      {getCategoryEmoji(item.category)}
                    </div>
                    {hasDiscount && (
                      <div style={{
                        position:'absolute', top:8, right:8,
                        background:'#ef4444', color:'#fff', borderRadius:50,
                        padding:'3px 8px', fontSize:11, fontWeight:800,
                      }}>
                        -{item.discount_percent}%
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div style={{ padding:'10px 12px 12px' }}>
                    <p style={{ margin:'0 0 4px', fontSize:13, fontWeight:700, color:'#1f2937', lineHeight:1.3,
                      overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>
                      {item.name}
                    </p>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <span style={{ fontSize:15, fontWeight:800, color:'#e85d04' }}>₹{Math.round(finalPrice)}</span>
                      {hasDiscount && (
                        <span style={{ fontSize:11, color:'#9ca3af', textDecoration:'line-through' }}>₹{Math.round(item.price)}</span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Empty state ─────────────────────────── */}
        {!loading && filtered.length === 0 && (
          <div style={{ textAlign:'center', padding:'60px 0' }}>
            <p style={{ fontSize:48, marginBottom:12 }}>🍽️</p>
            <p style={{ color:'#6b7280', fontSize:16, fontWeight:600 }}>No items found</p>
            <p style={{ color:'#9ca3af', fontSize:14 }}>Try a different category or search</p>
          </div>
        )}
      </div>

      {/* ── Floating Order Button ────────────────── */}
      <div style={{
        position:'fixed', bottom:0, left:0, right:0, zIndex:50,
        background:'linear-gradient(transparent, rgba(250,250,250,0.95))',
        padding:'16px 20px 24px',
      }}>
        <button onClick={handleOrder} style={{
          width:'100%', maxWidth:500, margin:'0 auto', display:'block',
          background:'linear-gradient(135deg, #e85d04, #f97316)',
          color:'#fff', border:'none', borderRadius:16,
          padding:'16px', fontSize:17, fontWeight:800, cursor:'pointer',
          boxShadow:'0 8px 24px rgba(232,93,4,0.4)',
          display:'flex', alignItems:'center', justifyContent:'center', gap:10,
        }}>
          🛒 Order Now on FoodFi
          <span style={{ fontSize:20 }}>→</span>
        </button>
      </div>

      {/* ── Item Modal ──────────────────────────── */}
      {selectedItem && (
        <div onClick={() => setSelectedItem(null)} style={{
          position:'fixed', inset:0, zIndex:100,
          background:'rgba(0,0,0,0.6)', backdropFilter:'blur(4px)',
          display:'flex', alignItems:'flex-end', justifyContent:'center',
          padding:'0',
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background:'#fff', borderRadius:'24px 24px 0 0',
            width:'100%', maxWidth:560, maxHeight:'90vh',
            overflowY:'auto',
            animation:'slideUp 0.3s ease',
          }}>
            {/* Handle */}
            <div style={{ width:40, height:4, background:'#e5e7eb', borderRadius:4, margin:'12px auto 0' }} />

            {/* Item Image */}
            <div style={{ position:'relative', aspectRatio:'16/9', background:'#fff7ed', overflow:'hidden' }}>
              {selectedItem.image_url ? (
                <img src={selectedItem.image_url} alt={selectedItem.name}
                  style={{ width:'100%', height:'100%', objectFit:'cover' }}
                  onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='flex' }}
                />
              ) : null}
              <div style={{
                display: selectedItem.image_url ? 'none' : 'flex',
                alignItems:'center', justifyContent:'center',
                width:'100%', height:'100%', fontSize:80, background:'#fff7ed',
              }}>
                {getCategoryEmoji(selectedItem.category)}
              </div>
              {selectedItem.discount_percent > 0 && (
                <div style={{
                  position:'absolute', top:16, right:16,
                  background:'#ef4444', color:'#fff', borderRadius:50,
                  padding:'6px 14px', fontSize:14, fontWeight:800,
                }}>
                  {selectedItem.discount_percent}% OFF
                </div>
              )}
              <button onClick={() => setSelectedItem(null)} style={{
                position:'absolute', top:16, left:16,
                background:'rgba(0,0,0,0.5)', border:'none', borderRadius:'50%',
                width:36, height:36, display:'flex', alignItems:'center', justifyContent:'center',
                color:'#fff', cursor:'pointer', fontSize:18,
              }}>✕</button>
            </div>

            {/* Details */}
            <div style={{ padding:'20px 20px 32px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                <h2 style={{ margin:0, fontSize:20, fontWeight:800, color:'#1f2937', flex:1, lineHeight:1.3 }}>
                  {selectedItem.name}
                </h2>
              </div>

              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                <span style={{ fontSize:24, fontWeight:900, color:'#e85d04' }}>
                  ₹{Math.round(getDiscountedPrice(selectedItem.price, selectedItem.discount_percent))}
                </span>
                {selectedItem.discount_percent > 0 && (
                  <>
                    <span style={{ fontSize:16, color:'#9ca3af', textDecoration:'line-through' }}>
                      ₹{Math.round(selectedItem.price)}
                    </span>
                    <span style={{ background:'#fef2f2', color:'#ef4444', borderRadius:6, padding:'2px 8px', fontSize:12, fontWeight:700 }}>
                      Save ₹{Math.round(selectedItem.price - getDiscountedPrice(selectedItem.price, selectedItem.discount_percent))}
                    </span>
                  </>
                )}
              </div>

              <div style={{ display:'inline-flex', alignItems:'center', gap:4, background:'#fff7ed', borderRadius:8, padding:'4px 10px', marginBottom:14 }}>
                <span style={{ fontSize:14 }}>{getCategoryEmoji(selectedItem.category)}</span>
                <span style={{ fontSize:12, color:'#e85d04', fontWeight:600 }}>{selectedItem.category}</span>
              </div>

              {selectedItem.description && (
                <p style={{ margin:'0 0 20px', fontSize:14, color:'#4b5563', lineHeight:1.6 }}>
                  {selectedItem.description}
                </p>
              )}

              <button onClick={handleOrder} style={{
                width:'100%', padding:'16px', background:'linear-gradient(135deg, #e85d04, #f97316)',
                color:'#fff', border:'none', borderRadius:14,
                fontSize:16, fontWeight:800, cursor:'pointer',
                boxShadow:'0 6px 20px rgba(232,93,4,0.4)',
                display:'flex', alignItems:'center', justifyContent:'center', gap:10,
              }}>
                🛒 Order Now → foodfi.in
              </button>

              <p style={{ margin:'10px 0 0', textAlign:'center', fontSize:12, color:'#9ca3af' }}>
                🚀 30-45 min delivery · Cash on delivery available
              </p>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        ::-webkit-scrollbar { display: none; }
        * { box-sizing: border-box; }
      `}</style>
    </div>
  )
}

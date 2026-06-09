'use client'
import { useState, useEffect } from 'react'

const FOODFI_URL = 'https://foodfi.in'
const WHATSAPP_NUMBER = '917546983536'

const CATEGORY_ORDER_LIST = [
  'Rice Combos','Roti Combos','Puri Combos','Tadka Specials',
  'Thali','Biryani','Curry','Dal','Paneer','Chicken',
  'Starter','Snacks','Dessert','Drinks','Add-Ons',
]

function getCatIndex(cat) {
  if (!cat) return 999
  const idx = CATEGORY_ORDER_LIST.findIndex(c => cat.toLowerCase().includes(c.toLowerCase()))
  return idx === -1 ? 998 : idx
}

const FAQ = [
  { q: 'Which areas do you deliver to in Patna?', a: 'FoodFi delivers across Patna within 4 km of our kitchen in East Laxmi Nagar. We serve Kankarbagh, Jaganpura, New Jaganpura, Ramkrishna Nagar, Rajendra Nagar, Lohia Nagar, Hanuman Nagar, Mithapur, Doctor Colony, Postal Park, Patrakar Nagar, Ashok Nagar, Bhupatipur, Chitragupta Nagar, Vijay Nagar, RMS Colony, Sipara, Bhootnath Road, Jai Prakash Nagar, Bankman Colony, Zero Mile, Bypass Road and all nearby areas.' },
  { q: 'What are your delivery timings?', a: 'We are open daily from 9:00 AM to 11:50 PM — 7 days a week. Order anytime and get fresh food delivered in 30–45 minutes.' },
  { q: 'What is the best dish at FoodFi?', a: 'Our most loved dishes are Rajma Rice Bowl (best rajma chawal in Patna), Classic Chole Rice, Matar Chole Rice, Paneer Chole Rice, Mix Protein Rice Bowl, Dal Tadka Rice, Jeera Rice, Roti Combos and Puri Combos. All cooked fresh, ghar jaisa swad — no preservatives.' },
  { q: 'Do you deliver Protein / Gym meals in Patna?', a: 'Yes! Our Mix Protein Rice Bowl and White Chana Rice Bowl are perfect high-protein meals for fitness and gym enthusiasts in Patna. Healthy, filling and delivered fresh to Kankarbagh, Jaganpura and all areas.' },
  { q: 'Is Cash on Delivery available?', a: 'Yes! We accept Cash on Delivery (COD) on all orders in Patna — Kankarbagh, Jaganpura, Ramkrishna Nagar, East Laxmi Nagar and all delivery areas. No online payment required.' },
  { q: 'What Roti and Puri Combos do you offer?', a: 'We offer 2 Roti Combo and 5 Roti Combo with Rajma, Chole, Dal Tadka, Mix Chole or Paneer Chole. Also 6 Puri with Rajma and 6 Puri with Chole. Best roti combo home delivery in Patna.' },
  { q: 'What are Tadka Specials?', a: 'FoodFi Tadka Specials include Chana Tadka, Rajma Tadka, Dal Tadka, Paneer Tadka and Mix Chole Tadka — freshly prepared and delivered hot in Patna.' },
  { q: 'How do I track my order?', a: 'After placing your order on foodfi.in, you will receive real-time status updates — Confirmed → Preparing → Out for Delivery → Delivered. Push notifications are also sent.' },
  { q: 'Do you offer any discounts?', a: 'Yes! Use code WELCOME50 for ₹50 off on your first order (minimum order ₹200). Check foodfi.in for latest offers.' },
  { q: 'How fresh is the food?', a: 'Everything is cooked fresh to order in our cloud kitchen in East Laxmi Nagar, Patna. We use no preservatives and cook in small batches — ghar jaisa khana, restaurant quality taste, delivered in 30–45 minutes.' },
]

function getCategoryEmoji(cat) {
  if (!cat) return '🍴'
  const c = cat.toLowerCase()
  if (c.includes('biryani')) return '🍛'
  if (c.includes('rice')) return '🍚'
  if (c.includes('roti')) return '🫓'
  if (c.includes('puri')) return '🫓'
  if (c.includes('curry')) return '🥘'
  if (c.includes('dal')) return '🫕'
  if (c.includes('paneer')) return '🧀'
  if (c.includes('chicken')) return '🍗'
  if (c.includes('snack') || c.includes('starter')) return '🍟'
  if (c.includes('dessert') || c.includes('sweet')) return '🍮'
  if (c.includes('drink')) return '🥤'
  if (c.includes('thali')) return '🍽️'
  if (c.includes('tadka')) return '🥣'
  if (c.includes('combo')) return '🎁'
  if (c.includes('add')) return '➕'
  return '🍴'
}

function formatTime(t) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hr = h % 12 || 12
  return `${hr}:${m.toString().padStart(2, '0')} ${ampm}`
}

function getDiscountedPrice(price, discount) {
  if (!discount || discount <= 0) return parseFloat(price)
  return parseFloat(price) * (1 - discount / 100)
}

function StarRating({ rating }) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {[1,2,3,4,5].map(s => (
        <span key={s} style={{ fontSize: 14, color: s <= rating ? '#f59e0b' : '#d1d5db' }}>★</span>
      ))}
    </div>
  )
}

/* ── Styled FoodFi logo mark (since icon is plain orange square) ── */
function LogoMark({ size = 56 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.25,
      background: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
      flexShrink: 0,
    }}>
      <span style={{ fontSize: size * 0.52, lineHeight: 1 }}>🍽️</span>
    </div>
  )
}

export default function OrderPage() {
  const [items, setItems] = useState([])
  const [categories, setCategories] = useState([])
  const [kitchen, setKitchen] = useState(null)
  const [offers, setOffers] = useState([])
  const [reviews, setReviews] = useState([])
  const [freeDeliveryKm, setFreeDeliveryKm] = useState(null)
  const [activeCategory, setActiveCategory] = useState('All')
  const [search, setSearch] = useState('')
  const [selectedItem, setSelectedItem] = useState(null)
  const [openFaq, setOpenFaq] = useState(null)
  const [loading, setLoading] = useState(true)
  const [hoveredId, setHoveredId] = useState(null)

  // Disable inspect / right-click / F12
  useEffect(() => {
    const blockContext = e => e.preventDefault()
    const blockKeys = e => {
      if (e.key === 'F12') e.preventDefault()
      if (e.ctrlKey && e.shiftKey && ['I','J','C'].includes(e.key)) e.preventDefault()
      if (e.ctrlKey && e.key === 'u') e.preventDefault()
      if (e.ctrlKey && e.key === 'U') e.preventDefault()
    }
    document.addEventListener('contextmenu', blockContext)
    document.addEventListener('keydown', blockKeys)
    return () => {
      document.removeEventListener('contextmenu', blockContext)
      document.removeEventListener('keydown', blockKeys)
    }
  }, [])

  // Dynamic page title based on active category
  useEffect(() => {
    const titles = {
      'All':          'FoodFi | Best Food Delivery in Patna – Rajma Chawal, Chole Chawal & More',
      'Rice Combos':  'Best Rice Combos Delivery in Patna | FoodFi Cloud Kitchen',
      'Roti Combos':  'Best Roti Combo Home Delivery Patna | FoodFi',
      'Puri Combos':  'Best Puri Combo Delivery Patna | FoodFi',
      'Tadka Specials':'Chana Tadka, Dal Tadka Delivery Patna | FoodFi',
      'Thali':        'Thali Delivery in Patna | FoodFi Cloud Kitchen',
      'Biryani':      'Best Biryani Delivery in Patna | FoodFi',
      'Paneer':       'Paneer Dishes Delivery Patna | FoodFi Cloud Kitchen',
      'Chicken':      'Chicken Delivery in Patna | FoodFi Cloud Kitchen',
      'Snacks':       'Snacks & Starters Delivery Patna | FoodFi',
      'Drinks':       'Cold Drinks Delivery Patna | FoodFi Cloud Kitchen',
    }
    document.title = titles[activeCategory] || `${activeCategory} – FoodFi | Best Food Delivery in Patna`
  }, [activeCategory])

  const loadMenu = () => {
    // Timestamp in URL bypasses ALL caching layers (CDN, browser, proxy)
    fetch(`/api/public/menu?_=${Date.now()}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(data => {
        setItems(data.items || [])
        setCategories(['All', ...(data.categories || [])])
        setKitchen(data.kitchen || null)
        setOffers(data.offers || [])
        setReviews(data.reviews || [])
        setFreeDeliveryKm(data.freeDeliveryKm || null)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    loadMenu()
    // Refetch when user switches back to this tab (e.g. after changing settings)
    const onFocus = () => loadMenu()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  /* Sort: Rice Combos first, Add-Ons last when "All" is selected */
  const filtered = items
    .filter(item => {
      const matchCat = activeCategory === 'All' || item.category === activeCategory
      const matchSearch = !search || item.name.toLowerCase().includes(search.toLowerCase())
      return matchCat && matchSearch
    })
    .sort((a, b) => {
      if (activeCategory === 'All') {
        const ci = getCatIndex(a.category) - getCatIndex(b.category)
        if (ci !== 0) return ci
      }
      return a.name.localeCompare(b.name)
    })

  const handleOrder = () => window.open(FOODFI_URL, '_blank')
  const handleWhatsApp = () => window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=Hi! I want to order from FoodFi Cloud Kitchen`, '_blank')
  const handleCall = () => window.open(`tel:${kitchen?.phone || '+91' + WHATSAPP_NUMBER}`, '_self')
  const handleShare = async () => {
    const shareText = 'FoodFi ka menu dekho! 😋 Best ghar jaisa khana Patna mein 🍛 – Rajma Chawal, Chole Chawal, Protein Bowl aur bahut kuch!'
    const shareUrl = 'https://order.foodfi.in'
    if (navigator.share) {
      try { await navigator.share({ title: 'FoodFi Cloud Kitchen', text: shareText, url: shareUrl }) } catch (_) {}
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(shareText + '\n' + shareUrl)}`, '_blank')
    }
  }

  const formatOffer = (offer) => {
    if (offer.type === 'percent') return `${offer.value}% off`
    if (offer.type === 'flat') return `₹${Math.round(offer.value)} off`
    if (offer.type === 'free_delivery') return 'Free Delivery'
    return `${offer.value} off`
  }

  return (
    <div style={{ fontFamily: "'Segoe UI', sans-serif", background: '#f5f5f5', minHeight: '100vh' }}>

      {/* ── Hero ───────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, #d4520a 0%, #e85d04 45%, #f97316 100%)',
        padding: '28px 20px 72px',
        textAlign: 'center', position: 'relative', overflow: 'hidden',
      }}>
        {/* dot pattern */}
        <div style={{ position: 'absolute', inset: 0, opacity: 0.07, backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '22px 22px' }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* Logo + name */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 12 }}>
            <LogoMark size={54} />
            <div style={{ textAlign: 'left' }}>
              {/* H1 for SEO — primary keyword */}
              <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, color: '#fff', letterSpacing: -0.5 }}>
                Food<span style={{ opacity: 0.75 }}>Fi</span>
              </h1>
              <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>
                Best Food Delivery in Patna · {kitchen?.kitchen_name || 'Cloud Kitchen'}
              </p>
            </div>
          </div>

          <h2 style={{ margin: '10px 0 6px', fontSize: 20, fontWeight: 800, color: '#fff', lineHeight: 1.35 }}>
            Fresh Homemade Food<br />Delivered to Your Door 🚀
          </h2>
          <p style={{ margin: '0 0 6px', color: 'rgba(255,255,255,0.9)', fontSize: 13 }}>
            Order online · Cash on delivery · {kitchen?.estimated_time || 45} min delivery
          </p>
          {kitchen && (
            <p style={{ margin: '0 0 18px', color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>
              ⏰ {formatTime(kitchen.open_time)} – {formatTime(kitchen.close_time)}
              &nbsp;·&nbsp;
              <span style={{
                background: kitchen.is_open ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.35)',
                padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700,
              }}>
                {kitchen.is_open ? '🟢 Open Now' : '🔴 Closed'}
              </span>
            </p>
          )}

          <button onClick={handleOrder} style={{
            background: '#fff', color: '#e85d04', border: 'none', borderRadius: 50,
            padding: '12px 32px', fontSize: 15, fontWeight: 800, cursor: 'pointer',
            boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
            display: 'inline-flex', alignItems: 'center', gap: 8,
          }}>
            🛒 Order Now
          </button>

          {/* Search — sits inside hero, sticks out below */}
          <div style={{ maxWidth: 560, margin: '20px auto -28px', padding: '0 4px', position: 'relative', zIndex: 5 }}>
            <div style={{
              background: '#fff', borderRadius: 14,
              boxShadow: '0 6px 24px rgba(0,0,0,0.18)',
              display: 'flex', alignItems: 'center', padding: '11px 16px', gap: 10,
            }}>
              <span style={{ fontSize: 17, flexShrink: 0 }}>🔍</span>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search menu items..."
                style={{ border: 'none', outline: 'none', flex: 1, fontSize: 15, background: 'transparent', color: '#1f2937' }}
              />
              {search && (
                <button onClick={() => setSearch('')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 17, flexShrink: 0, padding: 0 }}>✕</button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Offers Banner ──────────────────────────────── */}
      {(offers.length > 0 || freeDeliveryKm) && (
        <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', overflowX: 'auto', scrollbarWidth: 'none', paddingTop: 36 }}>
          <div style={{ display: 'flex', gap: 0, minWidth: 'max-content' }}>
            {freeDeliveryKm && (
              <div style={{ padding: '10px 20px', borderRight: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 18 }}>🚀</span>
                <div>
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: '#16a34a' }}>FREE DELIVERY</p>
                  <p style={{ margin: 0, fontSize: 11, color: '#6b7280' }}>Within {freeDeliveryKm} km</p>
                </div>
              </div>
            )}
            {offers.map(offer => (
              <div key={offer.code} style={{ padding: '10px 20px', borderRight: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 18 }}>🎁</span>
                <div>
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: '#e85d04' }}>
                    {formatOffer(offer)} · Use <strong>{offer.code}</strong>
                  </p>
                  <p style={{ margin: 0, fontSize: 11, color: '#6b7280' }}>Min order ₹{Math.round(offer.min_order)}</p>
                </div>
              </div>
            ))}
            <div style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>💵</span>
              <div>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: '#374151' }}>CASH ON DELIVERY</p>
                <p style={{ margin: 0, fontSize: 11, color: '#6b7280' }}>No online payment needed</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ maxWidth: 980, margin: '0 auto', padding: '20px 14px 110px' }}>

        {/* ── Category Tabs ─────────────────────────────── */}
        <div style={{ display: 'flex', gap: 7, overflowX: 'auto', paddingBottom: 6, marginBottom: 16, scrollbarWidth: 'none' }}>
          {categories.map(cat => (
            <button key={cat} onClick={() => setActiveCategory(cat)} style={{
              padding: '7px 16px', borderRadius: 50, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
              fontSize: 12, fontWeight: 700, transition: 'all 0.15s',
              background: activeCategory === cat ? '#e85d04' : '#fff',
              color: activeCategory === cat ? '#fff' : '#374151',
              boxShadow: activeCategory === cat ? '0 4px 12px rgba(232,93,4,0.35)' : '0 1px 6px rgba(0,0,0,0.09)',
            }}>
              {cat === 'All' ? '🍽️ All' : `${getCategoryEmoji(cat)} ${cat}`}
            </button>
          ))}
        </div>

        {/* ── Item count ─────────────────────────────────── */}
        {!loading && (
          <p style={{ color: '#9ca3af', fontSize: 12, marginBottom: 14 }}>
            {filtered.length} item{filtered.length !== 1 ? 's' : ''}{activeCategory !== 'All' ? ` in ${activeCategory}` : ''}
          </p>
        )}

        {/* ── Loading Skeleton ──────────────────────────── */}
        {loading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))', gap: 14 }}>
            {[...Array(8)].map((_, i) => (
              <div key={i} style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', border: '1.5px solid #f3f4f6', boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
                <div style={{ aspectRatio: '1', background: 'linear-gradient(90deg,#f3f4f6 25%,#e9eaec 50%,#f3f4f6 75%)', backgroundSize: '200% 100%', animation: `shimmer 1.4s ease-in-out ${i * 0.1}s infinite` }} />
                <div style={{ padding: '10px 10px 13px' }}>
                  <div style={{ height: 11, background: 'linear-gradient(90deg,#f3f4f6 25%,#e9eaec 50%,#f3f4f6 75%)', backgroundSize: '200% 100%', borderRadius: 6, marginBottom: 6, animation: `shimmer 1.4s ease-in-out ${i * 0.1}s infinite` }} />
                  <div style={{ height: 11, width: '65%', background: 'linear-gradient(90deg,#f3f4f6 25%,#e9eaec 50%,#f3f4f6 75%)', backgroundSize: '200% 100%', borderRadius: 6, marginBottom: 9, animation: `shimmer 1.4s ease-in-out ${i * 0.1 + 0.15}s infinite` }} />
                  <div style={{ height: 15, width: '40%', background: 'linear-gradient(90deg,#f3f4f6 25%,#e9eaec 50%,#f3f4f6 75%)', backgroundSize: '200% 100%', borderRadius: 6, animation: `shimmer 1.4s ease-in-out ${i * 0.1 + 0.05}s infinite` }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Item Grid ─────────────────────────────────── */}
        {!loading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))', gap: 14 }}>
            {filtered.map(item => {
              const finalPrice = getDiscountedPrice(item.price, item.discount_percent)
              const hasDiscount = item.discount_percent > 0
              const isHovered = hoveredId === item.id
              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedItem(item)}
                  onMouseEnter={() => setHoveredId(item.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onTouchStart={() => setHoveredId(item.id)}
                  onTouchEnd={() => setTimeout(() => setHoveredId(null), 600)}
                  style={{
                    background: '#fff', borderRadius: 16, overflow: 'hidden', cursor: 'pointer',
                    border: isHovered ? '1.5px solid #fed7aa' : '1.5px solid #f3f4f6',
                    position: 'relative', zIndex: isHovered ? 10 : 1,
                    transform: isHovered ? 'translateY(-10px) scale(1.04)' : 'translateY(0) scale(1)',
                    boxShadow: isHovered
                      ? '0 24px 48px rgba(232,93,4,0.22), 0 8px 20px rgba(0,0,0,0.12)'
                      : '0 2px 10px rgba(0,0,0,0.07)',
                    transition: 'transform 0.28s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.28s ease, border-color 0.15s',
                  }}
                >
                  {/* Image area */}
                  <div style={{ position: 'relative', aspectRatio: '1', background: '#fff7ed', overflow: 'hidden' }}>
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={`${item.name} – FoodFi Cloud Kitchen Patna | Best ${item.category || 'Food'} Delivery in Patna`}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s ease', transform: isHovered ? 'scale(1.07)' : 'scale(1)' }}
                        onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }}
                      />
                    ) : null}
                    <div style={{ display: item.image_url ? 'none' : 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', fontSize: 46 }}>
                      {getCategoryEmoji(item.category)}
                    </div>
                    {hasDiscount && (
                      <div style={{ position: 'absolute', top: 7, right: 7, background: '#ef4444', color: '#fff', borderRadius: 50, padding: '3px 7px', fontSize: 10, fontWeight: 800 }}>
                        -{item.discount_percent}%
                      </div>
                    )}
                    {/* "Tap to view" hint on hover */}
                    {isHovered && (
                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, rgba(232,93,4,0.85))', padding: '16px 8px 6px', textAlign: 'center' }}>
                        <span style={{ color: '#fff', fontSize: 10, fontWeight: 700 }}>Tap for details</span>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div style={{ padding: '9px 10px 11px' }}>
                    <p style={{
                      margin: '0 0 5px', fontSize: 12, fontWeight: 700, color: '#1f2937',
                      lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box',
                      WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                    }}>
                      {item.name}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: '#e85d04' }}>₹{Math.round(finalPrice)}</span>
                      {hasDiscount && <span style={{ fontSize: 10, color: '#9ca3af', textDecoration: 'line-through' }}>₹{Math.round(item.price)}</span>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '50px 0' }}>
            <p style={{ fontSize: 44, marginBottom: 10 }}>🍽️</p>
            <p style={{ color: '#6b7280', fontSize: 15, fontWeight: 600 }}>No items found</p>
            <p style={{ color: '#9ca3af', fontSize: 13 }}>Try a different category or search</p>
          </div>
        )}

        {/* ── Customer Reviews ──────────────────────────── */}
        {!loading && (
          <div style={{ marginTop: 36 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1f2937', marginBottom: 4 }}>⭐ Customer Reviews</h2>
            <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 16 }}>What our customers say about us</p>
            {reviews.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 14 }}>
                {reviews.map((r, i) => (
                  <div key={i} style={{ background: '#fff', borderRadius: 14, padding: '14px 16px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', border: '1px solid #f3f4f6' }}>
                    <StarRating rating={r.rating} />
                    <p style={{ margin: '8px 0 10px', fontSize: 13, color: '#374151', lineHeight: 1.6, fontStyle: 'italic' }}>"{r.comment}"</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#fff7ed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#e85d04', fontSize: 13 }}>
                        {r.customer_name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#1f2937' }}>{r.customer_name}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ background: '#fff7ed', border: '1.5px dashed #fed7aa', borderRadius: 14, padding: '28px', textAlign: 'center' }}>
                <p style={{ fontSize: 30, marginBottom: 6 }}>🍽️</p>
                <p style={{ fontWeight: 700, color: '#92400e', marginBottom: 4 }}>Be the first to review!</p>
                <p style={{ fontSize: 12, color: '#b45309' }}>Order from FoodFi and share your experience</p>
              </div>
            )}
          </div>
        )}

        {/* ── Info Cards ────────────────────────────────── */}
        {!loading && kitchen && (
          <div style={{ marginTop: 36 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1f2937', marginBottom: 16 }}>📍 Find Us</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>

              <div style={{ background: '#fff', borderRadius: 14, padding: '18px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', border: '1px solid #f3f4f6' }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: '#fff7ed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, marginBottom: 10 }}>📍</div>
                <h3 style={{ margin: '0 0 5px', fontSize: 14, fontWeight: 800, color: '#1f2937' }}>Address</h3>
                <p style={{ margin: '0 0 10px', fontSize: 12, color: '#6b7280', lineHeight: 1.6 }}>{kitchen.address}</p>
                <a href={`https://maps.google.com/?q=${encodeURIComponent(kitchen.address)}`} target="_blank" rel="noreferrer"
                  style={{ fontSize: 12, color: '#e85d04', fontWeight: 700, textDecoration: 'none' }}>
                  Open in Maps →
                </a>
              </div>

              <div style={{ background: '#fff', borderRadius: 14, padding: '18px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', border: '1px solid #f3f4f6' }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, marginBottom: 10 }}>⏰</div>
                <h3 style={{ margin: '0 0 5px', fontSize: 14, fontWeight: 800, color: '#1f2937' }}>Delivery Timings</h3>
                <p style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 900, color: '#16a34a' }}>
                  {formatTime(kitchen.open_time)} – {formatTime(kitchen.close_time)}
                </p>
                <p style={{ margin: '0 0 6px', fontSize: 12, color: '#6b7280' }}>Open 7 days a week</p>
                <p style={{ margin: 0, fontSize: 11, color: '#9ca3af' }}>
                  🚀 ~{kitchen.estimated_time} min delivery · Within {kitchen.max_delivery_km} km
                </p>
              </div>

              <div style={{ background: '#fff', borderRadius: 14, padding: '18px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', border: '1px solid #f3f4f6' }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, marginBottom: 10 }}>📞</div>
                <h3 style={{ margin: '0 0 5px', fontSize: 14, fontWeight: 800, color: '#1f2937' }}>Contact Us</h3>
                <a href={`tel:${kitchen.phone}`} style={{ display: 'block', fontSize: 15, fontWeight: 800, color: '#1f2937', textDecoration: 'none', marginBottom: 10 }}>
                  {kitchen.phone}
                </a>
                <button onClick={handleWhatsApp} style={{
                  display: 'flex', alignItems: 'center', gap: 6, background: '#22c55e', color: '#fff',
                  border: 'none', borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                }}>
                  <span style={{ fontSize: 14 }}>💬</span> Chat on WhatsApp
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── FAQ ───────────────────────────────────────── */}
        <div style={{ marginTop: 36 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1f2937', marginBottom: 4 }}>❓ Frequently Asked Questions</h2>
          <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 16 }}>Everything you need to know about FoodFi</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {FAQ.map((faq, i) => (
              <div key={i} style={{ background: '#fff', borderRadius: 12, border: '1px solid #f3f4f6', overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  style={{ width: '100%', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#1f2937', flex: 1, paddingRight: 14 }}>{faq.q}</span>
                  <span style={{ fontSize: 18, color: '#e85d04', flexShrink: 0, transition: 'transform 0.2s', transform: openFaq === i ? 'rotate(45deg)' : 'none' }}>+</span>
                </button>
                {openFaq === i && (
                  <div style={{ padding: '0 18px 14px', fontSize: 13, color: '#6b7280', lineHeight: 1.7 }}>{faq.a}</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Download App ──────────────────────────────── */}
        <div style={{ marginTop: 36, background: 'linear-gradient(135deg, #1f2937, #374151)', borderRadius: 18, padding: '28px 22px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, opacity: 0.05, backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <p style={{ fontSize: 36, marginBottom: 6 }}>📱</p>
            <h2 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 900, color: '#fff' }}>Get the FoodFi App</h2>
            <p style={{ margin: '0 0 18px', fontSize: 13, color: '#9ca3af', lineHeight: 1.6 }}>
              Order faster · Track in real-time · Get exclusive offers<br />
              Works on Android & iPhone — no download needed!
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={handleOrder} style={{
                background: '#e85d04', color: '#fff', border: 'none', borderRadius: 12,
                padding: '11px 24px', fontSize: 14, fontWeight: 800, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 7,
              }}>
                🌐 Open foodfi.in
              </button>
              <button onClick={() => {
                if (window.matchMedia('(display-mode: standalone)').matches) {
                  alert('App is already installed! ✅')
                } else { handleOrder() }
              }} style={{
                background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1.5px solid rgba(255,255,255,0.2)',
                borderRadius: 12, padding: '11px 24px', fontSize: 14, fontWeight: 800, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 7,
              }}>
                📲 Install as App
              </button>
            </div>
            <p style={{ margin: '14px 0 0', fontSize: 11, color: '#6b7280' }}>
              Open foodfi.in in Chrome → Menu → "Add to Home Screen"
            </p>
          </div>
        </div>

        {/* ── Our Specialties (SEO keyword section) ──────── */}
        <div style={{ marginTop: 36, background: 'linear-gradient(135deg, #fff7ed, #fff)', borderRadius: 14, padding: '20px 22px', border: '1px solid #fed7aa' }}>
          <h2 style={{ fontSize: 15, fontWeight: 800, color: '#92400e', marginBottom: 12 }}>
            🍽️ Our Specialties – Best Food in Patna
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
            {[
              { emoji: '🫘', title: 'Rajma Chawal', desc: 'Best Rajma Chawal in Kankarbagh, Jaganpura & East Laxmi Nagar' },
              { emoji: '🌰', title: 'Chole Chawal', desc: 'Classic Chole Rice, Matar Chole Rice & Paneer Chole Rice' },
              { emoji: '💪', title: 'Protein Rice Bowl', desc: 'Mix Protein Rice Bowl & White Chana Rice – Gym & Fitness Meals' },
              { emoji: '🫓', title: 'Roti Combos', desc: '2 Roti & 5 Roti Combos with Rajma, Chole, Dal Tadka & more' },
              { emoji: '🥣', title: 'Tadka Specials', desc: 'Chana Tadka, Rajma Tadka, Dal Tadka & Paneer Tadka' },
              { emoji: '🫓', title: 'Puri Combos', desc: '6 Puri with Rajma or Chole – Best Puri Combo Patna' },
            ].map(s => (
              <div key={s.title} style={{ background: '#fff', borderRadius: 10, padding: '12px 14px', border: '1px solid #fed7aa' }}>
                <p style={{ margin: '0 0 4px', fontSize: 20 }}>{s.emoji}</p>
                <p style={{ margin: '0 0 3px', fontSize: 12, fontWeight: 800, color: '#c2410c' }}>{s.title}</p>
                <p style={{ margin: 0, fontSize: 11, color: '#78350f', lineHeight: 1.5 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Delivery Areas (SEO section) ──────────────── */}
        <div style={{ marginTop: 20, background: '#fff', borderRadius: 14, padding: '20px 22px', border: '1px solid #f3f4f6' }}>
          <h2 style={{ fontSize: 15, fontWeight: 800, color: '#1f2937', marginBottom: 8 }}>
            🚀 Food Delivery Areas in Patna
          </h2>
          <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 12, lineHeight: 1.6 }}>
            FoodFi delivers Rajma Chawal, Chole Chawal, Roti Combos, Protein Rice Bowls &amp; Tadka Specials across Patna within 4 km of East Laxmi Nagar:
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {[
              'Kankarbagh','Jaganpura','New Jaganpura','East Laxmi Nagar','Ramkrishna Nagar',
              'Rajendra Nagar','Lohia Nagar','Hanuman Nagar','Mithapur','Postal Park',
              'Patrakar Nagar','Ashok Nagar','Bhupatipur','Chitragupta Nagar','Vijay Nagar',
              'RMS Colony','Sipara','Bhootnath Road','Doctor Colony','Jai Prakash Nagar',
              'Bankman Colony','Tempo Stand','Zero Mile','Transport Nagar','Chiraiyatand',
              'Bypass Road','Mahatma Gandhi Nagar','Khemnichak','Agamkuan','Kumhrar',
              'Bailey Road','Boring Road','Rukunpura','Sheikhpura',
            ].map(area => (
              <span key={area} style={{
                background: '#fff7ed', color: '#c2410c', fontSize: 11, fontWeight: 600,
                padding: '4px 10px', borderRadius: 20, border: '1px solid #fed7aa',
              }}>
                📍 {area}
              </span>
            ))}
          </div>
          <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {[
              'Best Rajma Chawal in Kankarbagh',
              'Best Chole Chawal in Jaganpura',
              'Best Rajma Chawal in East Laxmi Nagar',
              'Best Chole Chawal in Ramkrishna Nagar',
              'Food Delivery Rajendra Nagar',
              'Ghar Jaisa Khana Patna',
              'Cloud Kitchen Patna',
              'Budget Meals Patna',
              'Protein Meal Kankarbagh',
            ].map(tag => (
              <span key={tag} style={{ fontSize: 10, color: '#6b7280', background: '#f9fafb', padding: '3px 8px', borderRadius: 20, border: '1px solid #e5e7eb' }}>
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* ── Footer ────────────────────────────────────── */}
        <div style={{ marginTop: 32, paddingTop: 20, borderTop: '1px solid #e5e7eb', textAlign: 'center' }}>
          <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 4 }}>© 2025 FoodFi Cloud Kitchen · Road No 8, East Laxmi Nagar, Patna, Bihar</p>
          <p style={{ fontSize: 11, color: '#d1d5db', lineHeight: 1.8 }}>
            Best Food Delivery in Patna · Rajma Chawal · Chole Chawal · Matar Chole Rice · Paneer Chole Rice<br />
            Mix Protein Rice Bowl · Dal Tadka Rice · Jeera Rice · Roti Combos · Puri Combos · Tadka Specials<br />
            Food Delivery Kankarbagh · Food Delivery Jaganpura · Food Delivery East Laxmi Nagar · Cloud Kitchen Patna
          </p>
        </div>
      </div>

      {/* ── Sticky Bottom Bar ─────────────────────────── */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
        background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(12px)',
        borderTop: '1px solid #f3f4f6',
        boxShadow: '0 -4px 20px rgba(0,0,0,0.09)',
        padding: '10px 14px 14px',
      }}>
        <div style={{ maxWidth: 500, margin: '0 auto', display: 'flex', gap: 8, alignItems: 'center' }}>

          {/* Share */}
          <button onClick={handleShare} title="Share Menu" style={{
            width: 48, height: 48, borderRadius: 13, border: '1.5px solid #e5e7eb',
            background: '#fff', cursor: 'pointer', flexShrink: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1,
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          }}>
            <span style={{ fontSize: 18, lineHeight: 1 }}>📤</span>
            <span style={{ fontSize: 9, color: '#6b7280', fontWeight: 600 }}>Share</span>
          </button>

          {/* Order Now — main CTA */}
          <button onClick={handleOrder} style={{
            flex: 1, background: 'linear-gradient(135deg, #e85d04, #f97316)',
            color: '#fff', border: 'none', borderRadius: 13,
            padding: '13px 10px', fontSize: 15, fontWeight: 800, cursor: 'pointer',
            boxShadow: '0 6px 18px rgba(232,93,4,0.38)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          }}>
            🛒 Order Now
            <span style={{ fontSize: 16 }}>→</span>
          </button>

          {/* Call */}
          <button onClick={handleCall} title="Call Us" style={{
            width: 48, height: 48, borderRadius: 13, border: '1.5px solid #e5e7eb',
            background: '#fff', cursor: 'pointer', flexShrink: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1,
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          }}>
            <span style={{ fontSize: 18, lineHeight: 1 }}>📞</span>
            <span style={{ fontSize: 9, color: '#6b7280', fontWeight: 600 }}>Call</span>
          </button>

        </div>
      </div>

      {/* ── Item Modal ────────────────────────────────── */}
      {selectedItem && (
        <div onClick={() => setSelectedItem(null)} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '22px 22px 0 0', width: '100%', maxWidth: 560, maxHeight: '92vh', overflowY: 'auto', animation: 'slideUp 0.28s ease' }}>
            <div style={{ width: 38, height: 4, background: '#e5e7eb', borderRadius: 4, margin: '10px auto 0' }} />
            <div style={{ position: 'relative', aspectRatio: '16/9', background: '#fff7ed', overflow: 'hidden' }}>
              {selectedItem.image_url ? (
                <img src={selectedItem.image_url} alt={selectedItem.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }} />
              ) : null}
              <div style={{ display: selectedItem.image_url ? 'none' : 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', fontSize: 80 }}>
                {getCategoryEmoji(selectedItem.category)}
              </div>
              {selectedItem.discount_percent > 0 && (
                <div style={{ position: 'absolute', top: 14, right: 14, background: '#ef4444', color: '#fff', borderRadius: 50, padding: '5px 12px', fontSize: 13, fontWeight: 800 }}>
                  {selectedItem.discount_percent}% OFF
                </div>
              )}
              <button onClick={() => setSelectedItem(null)} style={{ position: 'absolute', top: 14, left: 14, background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', cursor: 'pointer', fontSize: 16 }}>✕</button>
            </div>
            <div style={{ padding: '18px 18px 30px' }}>
              <h2 style={{ margin: '0 0 7px', fontSize: 19, fontWeight: 800, color: '#1f2937' }}>{selectedItem.name}</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 22, fontWeight: 900, color: '#e85d04' }}>₹{Math.round(getDiscountedPrice(selectedItem.price, selectedItem.discount_percent))}</span>
                {selectedItem.discount_percent > 0 && (
                  <>
                    <span style={{ fontSize: 14, color: '#9ca3af', textDecoration: 'line-through' }}>₹{Math.round(selectedItem.price)}</span>
                    <span style={{ background: '#fef2f2', color: '#ef4444', borderRadius: 6, padding: '2px 7px', fontSize: 11, fontWeight: 700 }}>
                      Save ₹{Math.round(selectedItem.price - getDiscountedPrice(selectedItem.price, selectedItem.discount_percent))}
                    </span>
                  </>
                )}
              </div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#fff7ed', borderRadius: 8, padding: '3px 9px', marginBottom: 12 }}>
                <span style={{ fontSize: 13 }}>{getCategoryEmoji(selectedItem.category)}</span>
                <span style={{ fontSize: 11, color: '#e85d04', fontWeight: 600 }}>{selectedItem.category}</span>
              </div>
              {selectedItem.description && (
                <p style={{ margin: '0 0 18px', fontSize: 13, color: '#4b5563', lineHeight: 1.6 }}>{selectedItem.description}</p>
              )}
              <button onClick={handleOrder} style={{ width: '100%', padding: '15px', background: 'linear-gradient(135deg, #e85d04, #f97316)', color: '#fff', border: 'none', borderRadius: 14, fontSize: 15, fontWeight: 800, cursor: 'pointer', boxShadow: '0 6px 20px rgba(232,93,4,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                🛒 Order Now → foodfi.in
              </button>
              <p style={{ margin: '8px 0 0', textAlign: 'center', fontSize: 11, color: '#9ca3af' }}>
                🚀 ~{kitchen?.estimated_time || 45} min delivery · Cash on delivery available
              </p>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        ::-webkit-scrollbar { display: none; }
        * { box-sizing: border-box; }
        body { margin: 0; }
      `}</style>
    </div>
  )
}

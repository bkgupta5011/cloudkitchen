'use client'
import { useState, useEffect } from 'react'

const FOODFI_URL = 'https://foodfi.in'
const WHATSAPP_NUMBER = '917546983536' // without +

const FAQ = [
  {
    q: 'Which areas do you deliver to?',
    a: 'We currently deliver within 4 km of our kitchen in East Laxmi Nagar, Patna. This covers most of Patna city including Boring Road, Kankarbagh, Rajendra Nagar, Bailey Road, and nearby areas.',
  },
  {
    q: 'What are your delivery timings?',
    a: 'We are open daily from 9:00 AM to 11:50 PM. You can place orders anytime within these hours and your food will be delivered fresh.',
  },
  {
    q: 'How long does delivery take?',
    a: 'Typical delivery time is 30–45 minutes from order placement. During peak hours it may take slightly longer. You will receive live updates on your order status.',
  },
  {
    q: 'Is Cash on Delivery available?',
    a: 'Yes! We accept Cash on Delivery (COD) on all orders. No online payment required.',
  },
  {
    q: 'How do I track my order?',
    a: 'After placing your order on foodfi.in, you will receive real-time status updates — Confirmed → Preparing → Out for Delivery → Delivered. Push notifications are also sent.',
  },
  {
    q: 'Can I cancel my order?',
    a: 'Orders can be cancelled within a few minutes of placement, before the kitchen starts preparing. Once preparation begins, cancellation is not possible.',
  },
  {
    q: 'Do you offer any discounts?',
    a: 'Yes! We regularly run offers for new and returning customers. Use code WELCOME50 for ₹50 off on your first order (minimum order ₹200). Check foodfi.in for latest offers.',
  },
  {
    q: 'How fresh is the food?',
    a: 'Everything is cooked fresh to order in our cloud kitchen. We use no preservatives and cook in small batches to ensure quality and taste every time.',
  },
  {
    q: 'Do you have a minimum order amount?',
    a: 'There is no minimum order amount. However, orders above ₹200 are eligible for special discount offers.',
  },
  {
    q: 'How do I contact you for support?',
    a: 'You can reach us on WhatsApp or call us directly. Our support team is available during kitchen hours (9 AM – 11:50 PM).',
  },
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
      {[1, 2, 3, 4, 5].map(s => (
        <span key={s} style={{ fontSize: 14, color: s <= rating ? '#f59e0b' : '#d1d5db' }}>★</span>
      ))}
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

  useEffect(() => {
    fetch('/api/public/menu')
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
  }, [])

  const filtered = items.filter(item => {
    const matchCat = activeCategory === 'All' || item.category === activeCategory
    const matchSearch = !search || item.name.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  const handleOrder = () => window.open(FOODFI_URL, '_blank')
  const handleWhatsApp = () => window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=Hi! I want to order from FoodFi Cloud Kitchen`, '_blank')

  const formatOffer = (offer) => {
    if (offer.type === 'percent') return `${offer.value}% off`
    if (offer.type === 'flat') return `₹${Math.round(offer.value)} off`
    if (offer.type === 'free_delivery') return 'Free Delivery'
    return `${offer.value} off`
  }

  return (
    <div style={{ fontFamily: "'Segoe UI', sans-serif", background: '#fafafa', minHeight: '100vh' }}>

      {/* ── Hero ───────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, #e85d04 0%, #f97316 50%, #fb923c 100%)',
        padding: '32px 20px 52px', textAlign: 'center', position: 'relative', overflow: 'hidden'
      }}>
        <div style={{ position: 'absolute', inset: 0, opacity: 0.08, backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 10 }}>
            <img src="/icons/icon-192.png" alt="FoodFi" style={{ width: 56, height: 56, borderRadius: 14, boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }} />
            <div style={{ textAlign: 'left' }}>
              <h1 style={{ margin: 0, fontSize: 30, fontWeight: 900, color: '#fff', lineHeight: 1 }}>
                Food<span style={{ opacity: 0.7 }}>Fi</span>
              </h1>
              <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>
                {kitchen?.kitchen_name || 'Cloud Kitchen'} · Patna
              </p>
            </div>
          </div>
          <h2 style={{ margin: '14px 0 8px', fontSize: 22, fontWeight: 800, color: '#fff', lineHeight: 1.3 }}>
            Fresh Homemade Food<br />Delivered to Your Door 🚀
          </h2>
          <p style={{ margin: '0 0 8px', color: 'rgba(255,255,255,0.9)', fontSize: 14 }}>
            Order online · Cash on delivery · {kitchen?.estimated_time || 45} min delivery
          </p>
          {kitchen && (
            <p style={{ margin: '0 0 20px', color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>
              ⏰ {formatTime(kitchen.open_time)} – {formatTime(kitchen.close_time)}
              &nbsp;·&nbsp;
              <span style={{ background: kitchen.is_open ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)', padding: '2px 8px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
                {kitchen.is_open ? '🟢 Open Now' : '🔴 Closed'}
              </span>
            </p>
          )}
          <button onClick={handleOrder} style={{
            background: '#fff', color: '#e85d04', border: 'none', borderRadius: 50,
            padding: '14px 36px', fontSize: 16, fontWeight: 800, cursor: 'pointer',
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            display: 'inline-flex', alignItems: 'center', gap: 8,
          }}>
            🛒 Order Now
          </button>
        </div>
      </div>

      {/* ── Offers Banner ──────────────────────────────── */}
      {(offers.length > 0 || freeDeliveryKm) && (
        <div style={{ background: '#fff', borderBottom: '1px solid #f3f4f6', overflowX: 'auto', scrollbarWidth: 'none' }}>
          <div style={{ display: 'flex', gap: 0, minWidth: 'max-content' }}>
            {freeDeliveryKm && (
              <div style={{ padding: '12px 20px', borderRight: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 20 }}>🚀</span>
                <div>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: '#16a34a' }}>FREE DELIVERY</p>
                  <p style={{ margin: 0, fontSize: 11, color: '#6b7280' }}>Within {freeDeliveryKm} km</p>
                </div>
              </div>
            )}
            {offers.map(offer => (
              <div key={offer.code} style={{ padding: '12px 20px', borderRight: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 20 }}>🎁</span>
                <div>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: '#e85d04' }}>
                    {formatOffer(offer)} · Use <strong>{offer.code}</strong>
                  </p>
                  <p style={{ margin: 0, fontSize: 11, color: '#6b7280' }}>
                    Min order ₹{Math.round(offer.min_order)}
                  </p>
                </div>
              </div>
            ))}
            <div style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 20 }}>💵</span>
              <div>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: '#374151' }}>CASH ON DELIVERY</p>
                <p style={{ margin: 0, fontSize: 11, color: '#6b7280' }}>No online payment needed</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Search ────────────────────────────────────── */}
      <div style={{ padding: '0 16px', maxWidth: 640, margin: '-20px auto 0', position: 'relative', zIndex: 2 }}>
        <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 4px 20px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', padding: '12px 16px', gap: 10 }}>
          <span style={{ fontSize: 18 }}>🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search menu items..."
            style={{ border: 'none', outline: 'none', flex: 1, fontSize: 15, background: 'transparent', color: '#1f2937' }} />
          {search && <button onClick={() => setSearch('')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 18 }}>✕</button>}
        </div>
      </div>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '20px 16px 100px' }}>

        {/* ── Category Tabs ─────────────────────────────── */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8, marginBottom: 20, scrollbarWidth: 'none' }}>
          {categories.map(cat => (
            <button key={cat} onClick={() => setActiveCategory(cat)} style={{
              padding: '8px 18px', borderRadius: 50, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
              fontSize: 13, fontWeight: 700, transition: 'all 0.15s',
              background: activeCategory === cat ? '#e85d04' : '#fff',
              color: activeCategory === cat ? '#fff' : '#374151',
              boxShadow: activeCategory === cat ? '0 4px 12px rgba(232,93,4,0.35)' : '0 2px 8px rgba(0,0,0,0.08)',
            }}>
              {cat === 'All' ? '🍽️ All Items' : `${getCategoryEmoji(cat)} ${cat}`}
            </button>
          ))}
        </div>

        {/* ── Item Count ────────────────────────────────── */}
        {!loading && (
          <p style={{ color: '#9ca3af', fontSize: 13, marginBottom: 16 }}>
            {filtered.length} item{filtered.length !== 1 ? 's' : ''}{activeCategory !== 'All' ? ` in ${activeCategory}` : ''}
          </p>
        )}

        {/* ── Loading ───────────────────────────────────── */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ width: 48, height: 48, border: '4px solid #f3f4f6', borderTop: '4px solid #e85d04', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
            <p style={{ color: '#9ca3af', fontSize: 14 }}>Loading menu...</p>
          </div>
        )}

        {/* ── Item Grid ─────────────────────────────────── */}
        {!loading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16 }}>
            {filtered.map(item => {
              const finalPrice = getDiscountedPrice(item.price, item.discount_percent)
              const hasDiscount = item.discount_percent > 0
              return (
                <div key={item.id} onClick={() => setSelectedItem(item)} style={{
                  background: '#fff', borderRadius: 16, overflow: 'hidden', cursor: 'pointer',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.08)', transition: 'all 0.2s',
                  border: '1px solid #f3f4f6',
                }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.14)' }}
                  onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.08)' }}
                >
                  <div style={{ position: 'relative', aspectRatio: '1', background: '#fff7ed', overflow: 'hidden' }}>
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }} />
                    ) : null}
                    <div style={{ display: item.image_url ? 'none' : 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', fontSize: 48 }}>
                      {getCategoryEmoji(item.category)}
                    </div>
                    {hasDiscount && (
                      <div style={{ position: 'absolute', top: 8, right: 8, background: '#ef4444', color: '#fff', borderRadius: 50, padding: '3px 8px', fontSize: 11, fontWeight: 800 }}>
                        -{item.discount_percent}%
                      </div>
                    )}
                  </div>
                  <div style={{ padding: '10px 12px 12px' }}>
                    <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 700, color: '#1f2937', lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {item.name}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 15, fontWeight: 800, color: '#e85d04' }}>₹{Math.round(finalPrice)}</span>
                      {hasDiscount && <span style={{ fontSize: 11, color: '#9ca3af', textDecoration: 'line-through' }}>₹{Math.round(item.price)}</span>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <p style={{ fontSize: 48, marginBottom: 12 }}>🍽️</p>
            <p style={{ color: '#6b7280', fontSize: 16, fontWeight: 600 }}>No items found</p>
            <p style={{ color: '#9ca3af', fontSize: 14 }}>Try a different category or search</p>
          </div>
        )}

        {/* ── Customer Reviews ──────────────────────────── */}
        {!loading && (
          <div style={{ marginTop: 48 }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1f2937', marginBottom: 4 }}>⭐ Customer Reviews</h2>
            <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 20 }}>What our customers say about us</p>
            {reviews.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
                {reviews.map((r, i) => (
                  <div key={i} style={{ background: '#fff', borderRadius: 14, padding: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.07)', border: '1px solid #f3f4f6' }}>
                    <StarRating rating={r.rating} />
                    <p style={{ margin: '10px 0 12px', fontSize: 14, color: '#374151', lineHeight: 1.6, fontStyle: 'italic' }}>"{r.comment}"</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#fff7ed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#e85d04', fontSize: 14 }}>
                        {r.customer_name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#1f2937' }}>{r.customer_name}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ background: '#fff7ed', border: '1.5px dashed #fed7aa', borderRadius: 14, padding: '32px', textAlign: 'center' }}>
                <p style={{ fontSize: 32, marginBottom: 8 }}>🍽️</p>
                <p style={{ fontWeight: 700, color: '#92400e', marginBottom: 4 }}>Be the first to review!</p>
                <p style={{ fontSize: 13, color: '#b45309' }}>Order from FoodFi and share your experience</p>
              </div>
            )}
          </div>
        )}

        {/* ── Info Cards ────────────────────────────────── */}
        {!loading && kitchen && (
          <div style={{ marginTop: 48 }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1f2937', marginBottom: 20 }}>📍 Find Us</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>

              {/* Address */}
              <div style={{ background: '#fff', borderRadius: 14, padding: '20px', boxShadow: '0 2px 12px rgba(0,0,0,0.07)', border: '1px solid #f3f4f6' }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: '#fff7ed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, marginBottom: 12 }}>📍</div>
                <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 800, color: '#1f2937' }}>Address</h3>
                <p style={{ margin: '0 0 12px', fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>{kitchen.address}</p>
                <a href={`https://maps.google.com/?q=${kitchen.address}`} target="_blank" rel="noreferrer"
                  style={{ fontSize: 12, color: '#e85d04', fontWeight: 700, textDecoration: 'none' }}>
                  Open in Maps →
                </a>
              </div>

              {/* Timings */}
              <div style={{ background: '#fff', borderRadius: 14, padding: '20px', boxShadow: '0 2px 12px rgba(0,0,0,0.07)', border: '1px solid #f3f4f6' }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, marginBottom: 12 }}>⏰</div>
                <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 800, color: '#1f2937' }}>Delivery Timings</h3>
                <p style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 900, color: '#16a34a' }}>
                  {formatTime(kitchen.open_time)} – {formatTime(kitchen.close_time)}
                </p>
                <p style={{ margin: '0 0 8px', fontSize: 12, color: '#6b7280' }}>Open 7 days a week</p>
                <p style={{ margin: 0, fontSize: 12, color: '#9ca3af' }}>
                  🚀 Delivery in ~{kitchen.estimated_time} min · Within {kitchen.max_delivery_km} km
                </p>
              </div>

              {/* Contact */}
              <div style={{ background: '#fff', borderRadius: 14, padding: '20px', boxShadow: '0 2px 12px rgba(0,0,0,0.07)', border: '1px solid #f3f4f6' }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, marginBottom: 12 }}>📞</div>
                <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 800, color: '#1f2937' }}>Contact Us</h3>
                <a href={`tel:${kitchen.phone}`} style={{ display: 'block', fontSize: 16, fontWeight: 800, color: '#1f2937', textDecoration: 'none', marginBottom: 12 }}>
                  {kitchen.phone}
                </a>
                <button onClick={handleWhatsApp} style={{
                  display: 'flex', alignItems: 'center', gap: 6, background: '#22c55e', color: '#fff',
                  border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}>
                  <span style={{ fontSize: 16 }}>💬</span> Chat on WhatsApp
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── FAQ ───────────────────────────────────────── */}
        <div style={{ marginTop: 48 }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1f2937', marginBottom: 4 }}>❓ Frequently Asked Questions</h2>
          <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 20 }}>Everything you need to know about FoodFi</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {FAQ.map((faq, i) => (
              <div key={i} style={{ background: '#fff', borderRadius: 12, border: '1px solid #f3f4f6', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  style={{ width: '100%', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#1f2937', flex: 1, paddingRight: 16 }}>{faq.q}</span>
                  <span style={{ fontSize: 18, color: '#e85d04', flexShrink: 0, transition: 'transform 0.2s', transform: openFaq === i ? 'rotate(45deg)' : 'none' }}>+</span>
                </button>
                {openFaq === i && (
                  <div style={{ padding: '0 20px 16px', fontSize: 14, color: '#6b7280', lineHeight: 1.7 }}>
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Download App ──────────────────────────────── */}
        <div style={{ marginTop: 48, background: 'linear-gradient(135deg, #1f2937, #374151)', borderRadius: 20, padding: '32px 24px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, opacity: 0.05, backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <p style={{ fontSize: 40, marginBottom: 8 }}>📱</p>
            <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 900, color: '#fff' }}>Get the FoodFi App</h2>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: '#9ca3af', lineHeight: 1.6 }}>
              Order faster · Track in real-time · Get exclusive offers<br />
              Works on Android & iPhone — no download needed!
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={handleOrder} style={{
                background: '#e85d04', color: '#fff', border: 'none', borderRadius: 12,
                padding: '12px 28px', fontSize: 15, fontWeight: 800, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                🌐 Open foodfi.in
              </button>
              <button onClick={() => {
                if (window.matchMedia('(display-mode: standalone)').matches) {
                  alert('App is already installed! ✅')
                } else {
                  handleOrder()
                }
              }} style={{
                background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1.5px solid rgba(255,255,255,0.2)',
                borderRadius: 12, padding: '12px 28px', fontSize: 15, fontWeight: 800, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                📲 Install as App
              </button>
            </div>
            <p style={{ margin: '16px 0 0', fontSize: 12, color: '#6b7280' }}>
              Open foodfi.in in Chrome → Menu → "Add to Home Screen"
            </p>
          </div>
        </div>

        {/* ── Footer ────────────────────────────────────── */}
        <div style={{ marginTop: 40, paddingTop: 24, borderTop: '1px solid #e5e7eb', textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 6 }}>
            © 2025 FoodFi Cloud Kitchen · Patna, Bihar
          </p>
          <p style={{ fontSize: 12, color: '#d1d5db' }}>
            Made with ❤️ for Patna · Fresh food every day
          </p>
        </div>
      </div>

      {/* ── Floating Order Button ─────────────────────── */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50, background: 'linear-gradient(transparent, rgba(250,250,250,0.97))', padding: '16px 20px 24px' }}>
        <button onClick={handleOrder} style={{
          width: '100%', maxWidth: 500, margin: '0 auto', display: 'flex',
          background: 'linear-gradient(135deg, #e85d04, #f97316)',
          color: '#fff', border: 'none', borderRadius: 16,
          padding: '16px', fontSize: 17, fontWeight: 800, cursor: 'pointer',
          boxShadow: '0 8px 24px rgba(232,93,4,0.4)',
          alignItems: 'center', justifyContent: 'center', gap: 10,
        }}>
          🛒 Order Now on FoodFi <span style={{ fontSize: 20 }}>→</span>
        </button>
      </div>

      {/* ── Item Modal ────────────────────────────────── */}
      {selectedItem && (
        <div onClick={() => setSelectedItem(null)} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '24px 24px 0 0', width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', animation: 'slideUp 0.3s ease' }}>
            <div style={{ width: 40, height: 4, background: '#e5e7eb', borderRadius: 4, margin: '12px auto 0' }} />
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
                <div style={{ position: 'absolute', top: 16, right: 16, background: '#ef4444', color: '#fff', borderRadius: 50, padding: '6px 14px', fontSize: 14, fontWeight: 800 }}>
                  {selectedItem.discount_percent}% OFF
                </div>
              )}
              <button onClick={() => setSelectedItem(null)} style={{ position: 'absolute', top: 16, left: 16, background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', cursor: 'pointer', fontSize: 18 }}>✕</button>
            </div>
            <div style={{ padding: '20px 20px 32px' }}>
              <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800, color: '#1f2937' }}>{selectedItem.name}</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 24, fontWeight: 900, color: '#e85d04' }}>₹{Math.round(getDiscountedPrice(selectedItem.price, selectedItem.discount_percent))}</span>
                {selectedItem.discount_percent > 0 && (
                  <>
                    <span style={{ fontSize: 16, color: '#9ca3af', textDecoration: 'line-through' }}>₹{Math.round(selectedItem.price)}</span>
                    <span style={{ background: '#fef2f2', color: '#ef4444', borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 700 }}>
                      Save ₹{Math.round(selectedItem.price - getDiscountedPrice(selectedItem.price, selectedItem.discount_percent))}
                    </span>
                  </>
                )}
              </div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#fff7ed', borderRadius: 8, padding: '4px 10px', marginBottom: 14 }}>
                <span style={{ fontSize: 14 }}>{getCategoryEmoji(selectedItem.category)}</span>
                <span style={{ fontSize: 12, color: '#e85d04', fontWeight: 600 }}>{selectedItem.category}</span>
              </div>
              {selectedItem.description && (
                <p style={{ margin: '0 0 20px', fontSize: 14, color: '#4b5563', lineHeight: 1.6 }}>{selectedItem.description}</p>
              )}
              <button onClick={handleOrder} style={{ width: '100%', padding: '16px', background: 'linear-gradient(135deg, #e85d04, #f97316)', color: '#fff', border: 'none', borderRadius: 14, fontSize: 16, fontWeight: 800, cursor: 'pointer', boxShadow: '0 6px 20px rgba(232,93,4,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                🛒 Order Now → foodfi.in
              </button>
              <p style={{ margin: '10px 0 0', textAlign: 'center', fontSize: 12, color: '#9ca3af' }}>
                🚀 ~{kitchen?.estimated_time || 45} min delivery · Cash on delivery available
              </p>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        ::-webkit-scrollbar { display: none; }
        * { box-sizing: border-box; }
      `}</style>
    </div>
  )
}

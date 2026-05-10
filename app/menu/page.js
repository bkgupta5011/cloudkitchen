'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import styles from './menu.module.css'
import SupportChat from '../components/SupportChat'
import { usePWAInstall } from '@/lib/usePWAInstall'

// Pleasant notification sound
function playNotifSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const notes = [880, 1108, 1318]
    notes.forEach((freq, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain()
      o.connect(g); g.connect(ctx.destination)
      o.type = 'sine'; o.frequency.value = freq
      const s = ctx.currentTime + i * 0.13
      g.gain.setValueAtTime(0, s)
      g.gain.linearRampToValueAtTime(0.25, s + 0.04)
      g.gain.exponentialRampToValueAtTime(0.001, s + 0.45)
      o.start(s); o.stop(s + 0.46)
    })
  } catch {}
}

// ── Star display helper ───────────────────────────────────────────────
function StarDisplay({ avg, count }) {
  if (!avg || count < 1) return null
  const full = Math.floor(avg)
  const half = avg - full >= 0.4
  return (
    <div style={{ display:'flex', alignItems:'center', gap:3, marginTop:4 }}>
      {[1,2,3,4,5].map(i => (
        <span key={i} style={{ fontSize:12, lineHeight:1 }}>
          {i <= full ? '⭐' : (i === full+1 && half) ? '✨' : '☆'}
        </span>
      ))}
      <span style={{ fontSize:11, color:'#92400e', fontWeight:600 }}>{avg.toFixed(1)}</span>
      <span style={{ fontSize:10, color:'#9ca3af' }}>({count})</span>
    </div>
  )
}

export default function MenuPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [menuItems, setMenuItems] = useState([])
  const [offers, setOffers] = useState([])
  const [kitchenOpen, setKitchenOpen] = useState(true)
  const [cart, setCart] = useState({})
  const [activeCategory, setActiveCategory] = useState('All')
  const [loading, setLoading] = useState(true)
  const [showInstallBanner, setShowInstallBanner] = useState(false)
  const [showIOSModal, setShowIOSModal] = useState(false)
  const [itemRatings, setItemRatings] = useState({})

  const { installPrompt, isInstalled, install, isIOS } = usePWAInstall()

  // Show install banner after 4s if not already installed
  useEffect(() => {
    if (isInstalled) return
    const t = setTimeout(() => {
      if (installPrompt || isIOS) setShowInstallBanner(true)
    }, 4000)
    return () => clearTimeout(t)
  }, [installPrompt, isInstalled, isIOS])

  const handleInstall = async () => {
    if (isIOS) { setShowIOSModal(true); return }
    const ok = await install()
    if (ok) setShowInstallBanner(false)
  }

  useEffect(() => {
    // Restore cart from localStorage (persists across logout/login)
    const saved = localStorage.getItem('ck_cart')
    if (saved) { try { setCart(JSON.parse(saved)) } catch {} }

    Promise.all([
      fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'me' }) }).then(r => r.json()),
      fetch('/api/menu').then(r => r.json()),
      fetch('/api/admin').then(r => r.json()),
      fetch('/api/admin?type=offers').then(r => r.json()),
      fetch('/api/ratings?type=menu').then(r => r.json()).catch(() => ({ itemRatings: {} })),
    ]).then(([authData, menuData, settingsData, offersData, ratingsData]) => {
      if (!authData.user || authData.user.role !== 'customer') { router.push('/login'); return }
      setUser(authData.user)
      setMenuItems(menuData.items || [])
      setKitchenOpen(settingsData.settings?.is_open ?? true)
      setOffers(offersData.offers || [])
      setItemRatings(ratingsData.itemRatings || {})
      setLoading(false)
    })
  }, [])

  const saveCart = (newCart) => {
    setCart(newCart)
    localStorage.setItem('ck_cart', JSON.stringify(newCart))
  }

  const addItem = (id) => {
    if (!kitchenOpen) return
    const nc = { ...cart, [id]: (cart[id] || 0) + 1 }
    saveCart(nc)
  }

  const removeItem = (id) => {
    const nc = { ...cart }
    if (nc[id] > 1) nc[id]--
    else delete nc[id]
    saveCart(nc)
  }

  const cartCount = Object.values(cart).reduce((a, b) => a + b, 0)
  const categories = ['All', ...new Set(menuItems.map(m => m.category))]
  const filtered = activeCategory === 'All' ? menuItems : menuItems.filter(m => m.category === activeCategory)

  const discPrice = (item) => item.discount_percent > 0
    ? Math.round(item.price * (1 - item.discount_percent / 100))
    : item.price

  const logout = async () => {
    await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'logout' }) })
    router.push('/login')
  }

  const toggleDark = () => {
    const current = document.documentElement.getAttribute('data-theme')
    const nd = current === 'dark' ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', nd)
    localStorage.setItem('ck_theme', nd)
  }

  // Restore dark mode on load
  useEffect(() => {
    const saved = localStorage.getItem('ck_theme')
    if (saved) document.documentElement.setAttribute('data-theme', saved)
  }, [])

  // Listen for SW push messages → play sound
  useEffect(() => {
    if (!navigator.serviceWorker) return
    const handler = (e) => {
      if (e.data?.type === 'PLAY_NOTIFICATION_SOUND') playNotifSound()
    }
    navigator.serviceWorker.addEventListener('message', handler)
    return () => navigator.serviceWorker.removeEventListener('message', handler)
  }, [])

  if (loading) return <div className={styles.loading}><div className="spinner" /></div>

  return (
    <div className={styles.page}>
      {/* Navbar */}
      <nav className={styles.nav}>
        <span className={styles.logo}>🍽️ <span style={{color:'#e85d04'}}>Food</span>Fi</span>
        <div className={styles.navRight}>
          <span className={`${styles.kitchenBadge} ${kitchenOpen ? styles.open : styles.closed}`}>
            <span className={styles.dot} /> {kitchenOpen ? 'Open' : 'Closed'}
          </span>
          <span className={styles.greeting}>Hi, {user?.name?.split(' ')[0]}</span>
          <button className={styles.cartBtn} onClick={() => router.push('/cart')}>
            🛒 Cart
            {cartCount > 0 && <span className={styles.cartBadge}>{cartCount}</span>}
          </button>
          <button className="btn btn-secondary" onClick={() => router.push('/orders')} style={{ fontSize: 12, padding: '6px 10px' }}>My Orders</button>
          <button className="btn btn-secondary" onClick={() => router.push('/profile')} style={{ fontSize: 12, padding: '6px 10px' }}>👤 Profile</button>
          {/* Install button — Android: native prompt, iOS: step-by-step modal */}
          {!isInstalled && (installPrompt || isIOS) && (
            <button
              onClick={handleInstall}
              style={{ background:'#e85d04', color:'#fff', border:'none', borderRadius:8, padding:'5px 10px', fontSize:11, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}
              title="Install FoodFi App">
              ⬇️ Install
            </button>
          )}
          <button onClick={toggleDark} style={{ background:'none', border:'1px solid #e5e7eb', borderRadius:8, padding:'5px 8px', cursor:'pointer', fontSize:15 }} title="Dark/Light mode">
            {typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme')==='dark' ? '☀️' : '🌙'}
          </button>
          <button className="btn btn-secondary" onClick={logout} style={{ fontSize: 12, padding: '6px 10px' }}>Logout</button>
        </div>
      </nav>

      {/* PWA Install Banner — Android only (iOS uses modal) */}
      {showInstallBanner && !isInstalled && !isIOS && (
        <div style={{ background:'#431407', color:'#fff', padding:'10px 16px', display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
          <div>
            <div style={{ fontSize:13, fontWeight:700 }}>📱 FoodFi App Install Karo</div>
            <div style={{ fontSize:11, color:'#fed7aa' }}>Home screen pe add karo — faster ordering!</div>
          </div>
          <div style={{ display:'flex', gap:8, flexShrink:0 }}>
            <button onClick={handleInstall}
              style={{ background:'#e85d04', color:'#fff', border:'none', borderRadius:8, padding:'6px 14px', fontSize:12, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>
              Install ⬇️
            </button>
            <button onClick={() => setShowInstallBanner(false)}
              style={{ background:'none', border:'none', color:'#fed7aa', fontSize:18, cursor:'pointer' }}>✕</button>
          </div>
        </div>
      )}

      {/* iOS auto-show banner — taps to open modal */}
      {showInstallBanner && !isInstalled && isIOS && (
        <div onClick={() => setShowIOSModal(true)}
          style={{ background:'#431407', color:'#fff', padding:'10px 16px', display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, cursor:'pointer' }}>
          <div>
            <div style={{ fontSize:13, fontWeight:700 }}>📱 FoodFi App Install Karo</div>
            <div style={{ fontSize:11, color:'#fed7aa' }}>Yahan tap karo — step by step guide dekhein</div>
          </div>
          <div style={{ display:'flex', gap:8, flexShrink:0 }}>
            <button onClick={(e) => { e.stopPropagation(); setShowIOSModal(true) }}
              style={{ background:'#e85d04', color:'#fff', border:'none', borderRadius:8, padding:'6px 14px', fontSize:12, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>
              Kaise? 👆
            </button>
            <button onClick={(e) => { e.stopPropagation(); setShowInstallBanner(false) }}
              style={{ background:'none', border:'none', color:'#fed7aa', fontSize:18, cursor:'pointer' }}>✕</button>
          </div>
        </div>
      )}

      {/* iOS Install Guide Modal */}
      {showIOSModal && (
        <div style={{ position:'fixed', inset:0, background:'#00000088', zIndex:9999, display:'flex', alignItems:'flex-end', justifyContent:'center' }}
          onClick={() => setShowIOSModal(false)}>
          <div onClick={e => e.stopPropagation()}
            style={{ background:'#fff', borderRadius:'20px 20px 0 0', width:'100%', maxWidth:480, padding:'24px 20px 40px', boxShadow:'0 -4px 32px #0003' }}>
            {/* Handle bar */}
            <div style={{ width:40, height:4, background:'#e5e7eb', borderRadius:4, margin:'0 auto 20px' }} />
            <div style={{ textAlign:'center', marginBottom:20 }}>
              <div style={{ fontSize:36 }}>📱</div>
              <h3 style={{ fontSize:18, fontWeight:800, color:'#1a1a1a', margin:'8px 0 4px' }}>FoodFi Install Karo</h3>
              <p style={{ fontSize:13, color:'#6b7280', margin:0 }}>iPhone / iPad pe App jaisi feel ke liye</p>
            </div>

            {/* Steps */}
            {[
              { num:'1', icon:'⬆️', title:'Share Button Dabaao', desc:'Safari browser mein — address bar ke bilkul right side mein ek box + arrow (↑) icon hai, woh dabaao' },
              { num:'2', icon:'📋', title:'"Add to Home Screen" Select Karo', desc:'Neeche scroll karo aur "Add to Home Screen" option pe tap karo' },
              { num:'3', icon:'✅', title:'"Add" Pe Tap Karo', desc:'Name confirm karke upar right side mein "Add" button dabaao — bas!' },
            ].map(s => (
              <div key={s.num} style={{ display:'flex', gap:14, marginBottom:16, alignItems:'flex-start' }}>
                <div style={{ width:36, height:36, borderRadius:'50%', background:'#e85d04', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:14, flexShrink:0 }}>{s.num}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14, fontWeight:700, color:'#1a1a1a' }}>{s.icon} {s.title}</div>
                  <div style={{ fontSize:12, color:'#6b7280', marginTop:3, lineHeight:1.5 }}>{s.desc}</div>
                </div>
              </div>
            ))}

            {/* Visual hint for Share button location */}
            <div style={{ background:'#fff7ed', border:'1px solid #fed7aa', borderRadius:12, padding:'10px 14px', marginBottom:16, display:'flex', gap:10, alignItems:'center' }}>
              <span style={{ fontSize:22 }}>💡</span>
              <span style={{ fontSize:12, color:'#92400e' }}>Share button (↑) address bar ke right side mein hota hai — <strong>page ko thoda scroll karo</strong>, address bar visible ho jayega</span>
            </div>

            <button onClick={() => setShowIOSModal(false)}
              style={{ width:'100%', background:'#e85d04', color:'#fff', border:'none', borderRadius:12, padding:'14px', fontSize:15, fontWeight:700, cursor:'pointer' }}>
              Samajh Gaya — Close ✓
            </button>
          </div>
        </div>
      )}

      {/* Hero */}
      <div className={styles.hero}>
        <h2>What are you craving today?</h2>
        <p>Fresh homemade food · 30–45 mins · Cash on Delivery</p>
      </div>

      {/* Offers strip */}
      {offers.length > 0 && (
        <div className={styles.offerStrip}>
          {offers.map(o => (
            <div key={o.id} className={styles.offerPill}>
              🏷️ <strong>{o.code}</strong> — {o.type === 'flat' ? `₹${o.value} off` : o.type === 'percent' ? `${o.value}% off` : 'Free delivery'}
            </div>
          ))}
        </div>
      )}

      {/* Category tabs */}
      <div className={styles.catBar}>
        {categories.map(cat => (
          <button
            key={cat}
            className={`${styles.catChip} ${cat === activeCategory ? styles.active : ''}`}
            onClick={() => setActiveCategory(cat)}
          >{cat}</button>
        ))}
      </div>

      {/* Menu grid */}
      <div className={styles.menuGrid}>
        {filtered.map(item => {
          const qty = cart[item.id] || 0
          const dp = discPrice(item)
          return (
            <div key={item.id} className={styles.menuCard}>
              <div className={styles.cardLeft}>
                <div className={styles.cardTitle}>
                  <span className={`veg-dot ${item.is_veg ? 'veg' : 'nonveg'}`} />
                  <h4>{item.name}</h4>
                  {itemRatings[item.id]?.avg >= 4.5 && itemRatings[item.id]?.count >= 3 && (
                    <span style={{ fontSize:10, background:'#fef3c7', color:'#92400e', borderRadius:6, padding:'1px 6px', fontWeight:700, whiteSpace:'nowrap' }}>🏆 Most Loved</span>
                  )}
                </div>
                <p>{item.description}</p>
                <div className={styles.priceRow}>
                  <span className={styles.priceNew}>₹{dp}</span>
                  {item.discount_percent > 0 && (
                    <>
                      <span className={styles.priceOld}>₹{item.price}</span>
                      <span className={styles.discBadge}>{item.discount_percent}% OFF</span>
                    </>
                  )}
                </div>
                {itemRatings[item.id] && (
                  <StarDisplay avg={itemRatings[item.id].avg} count={itemRatings[item.id].count} />
                )}
              </div>
              <div className={styles.cardRight}>
                {item.image_url
                  ? <img src={item.image_url} alt={item.name} className={styles.foodImg} />
                  : <div className={styles.foodEmoji}>🍛</div>
                }
                {qty === 0 ? (
                  <button
                    className={styles.addBtn}
                    onClick={() => addItem(item.id)}
                    disabled={!kitchenOpen}
                  >+ Add</button>
                ) : (
                  <div className={styles.qtyCtl}>
                    <button onClick={() => removeItem(item.id)}>−</button>
                    <span>{qty}</span>
                    <button onClick={() => addItem(item.id)}>+</button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Cart sticky bar */}
      {cartCount > 0 && (
        <div className={styles.cartBar}>
          <span>{cartCount} item{cartCount > 1 ? 's' : ''} in cart</span>
          <button className="btn btn-primary" onClick={() => router.push('/cart')}>
            View Cart →
          </button>
        </div>
      )}

      {/* Floating Support Chat */}
      <SupportChat />
    </div>
  )
}

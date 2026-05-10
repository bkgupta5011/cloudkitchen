'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import styles from './menu.module.css'
import SupportChat from '../components/SupportChat'

export default function MenuPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [menuItems, setMenuItems] = useState([])
  const [offers, setOffers] = useState([])
  const [kitchenOpen, setKitchenOpen] = useState(true)
  const [cart, setCart] = useState({})
  const [activeCategory, setActiveCategory] = useState('All')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Restore cart from localStorage (persists across logout/login)
    const saved = localStorage.getItem('ck_cart')
    if (saved) { try { setCart(JSON.parse(saved)) } catch {} }

    Promise.all([
      fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'me' }) }).then(r => r.json()),
      fetch('/api/menu').then(r => r.json()),
      fetch('/api/admin').then(r => r.json()),
      fetch('/api/admin?type=offers').then(r => r.json()),
    ]).then(([authData, menuData, settingsData, offersData]) => {
      if (!authData.user || authData.user.role !== 'customer') { router.push('/login'); return }
      setUser(authData.user)
      setMenuItems(menuData.items || [])
      setKitchenOpen(settingsData.settings?.is_open ?? true)
      setOffers(offersData.offers || [])
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
          <button onClick={toggleDark} style={{ background:'none', border:'1px solid #e5e7eb', borderRadius:8, padding:'5px 8px', cursor:'pointer', fontSize:15 }} title="Dark/Light mode">
            {typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme')==='dark' ? '☀️' : '🌙'}
          </button>
          <button className="btn btn-secondary" onClick={logout} style={{ fontSize: 12, padding: '6px 10px' }}>Logout</button>
        </div>
      </nav>

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

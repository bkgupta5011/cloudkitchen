'use client'
import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import styles from './menu.module.css'
import SupportChat from '../components/SupportChat'
import { usePWAInstall } from '@/lib/usePWAInstall'

// ── Notification Drawer (shared) ─────────────────────────────────────
function NotificationDrawer({ onClose }) {
  const [notifs, setNotifs] = useState([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    const d = await fetch('/api/notifications').then(r => r.json())
    setNotifs(d.notifications || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const markAllRead = async () => {
    await fetch('/api/notifications', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({}) })
    setNotifs(prev => prev.map(n => ({ ...n, is_read:true })))
  }
  const clearRead = async () => {
    await fetch('/api/notifications', { method:'DELETE' })
    setNotifs(prev => prev.filter(n => !n.is_read))
  }
  const timeAgo = (d) => {
    const s = Math.floor((Date.now()-new Date(d))/1000)
    if(s<60) return 'abhi abhi'
    if(s<3600) return `${Math.floor(s/60)} min pehle`
    if(s<86400) return `${Math.floor(s/3600)} ghante pehle`
    return new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short'})
  }
  const unread = notifs.filter(n => !n.is_read).length

  return (
    <div style={{position:'fixed',inset:0,zIndex:9999,display:'flex',alignItems:'flex-end',justifyContent:'center',background:'#00000055'}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:'#fff',borderRadius:'20px 20px 0 0',width:'100%',maxWidth:520,maxHeight:'80vh',display:'flex',flexDirection:'column',boxShadow:'0 -4px 32px #0003'}}>
        <div style={{padding:'16px 20px 12px',borderBottom:'1px solid #f3f4f6',display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0}}>
          <div>
            <h3 style={{margin:0,fontSize:16,fontWeight:800}}>🔔 Notifications</h3>
            {unread>0&&<span style={{fontSize:11,color:'#e85d04',fontWeight:600}}>{unread} naye hain</span>}
          </div>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            {unread>0&&<button onClick={markAllRead} style={{fontSize:11,color:'#6b7280',background:'none',border:'none',cursor:'pointer',fontWeight:600}}>Sab read karo</button>}
            {notifs.some(n=>n.is_read)&&<button onClick={clearRead} style={{fontSize:11,color:'#ef4444',background:'none',border:'none',cursor:'pointer',fontWeight:600}}>Clear</button>}
            <button onClick={onClose} style={{background:'none',border:'none',fontSize:20,cursor:'pointer',color:'#6b7280'}}>✕</button>
          </div>
        </div>
        <div style={{overflowY:'auto',flex:1,padding:'8px 0'}}>
          {loading&&<div style={{textAlign:'center',padding:32,color:'#9ca3af',fontSize:14}}>⏳ Load ho raha hai...</div>}
          {!loading&&notifs.length===0&&(
            <div style={{textAlign:'center',padding:48}}>
              <div style={{fontSize:40,marginBottom:8}}>🔕</div>
              <div style={{fontSize:14,color:'#9ca3af'}}>Koi notification nahi hai abhi</div>
            </div>
          )}
          {notifs.map(n=>(
            <div key={n.id}
              onClick={async()=>{ if(!n.is_read){await fetch('/api/notifications',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({notifId:n.id})}); setNotifs(prev=>prev.map(x=>x.id===n.id?{...x,is_read:true}:x))} }}
              style={{padding:'14px 20px',display:'flex',gap:14,alignItems:'flex-start',cursor:'pointer',background:n.is_read?'#fff':'#fff7ed',borderBottom:'1px solid #f9fafb',borderLeft:n.is_read?'3px solid transparent':'3px solid #e85d04',transition:'background 0.2s'}}>
              <div style={{width:40,height:40,borderRadius:'50%',background:n.is_read?'#f3f4f6':'#fee2e2',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>
                {n.title?.startsWith('✅')?'✅':n.title?.startsWith('👨')?'👨‍🍳':n.title?.startsWith('🛵')?'🛵':n.title?.startsWith('🎉')?'🎉':n.title?.startsWith('❌')?'❌':'🔔'}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:n.is_read?500:700,color:'#1a1a1a',marginBottom:3}}>{n.title}</div>
                {n.body&&<div style={{fontSize:12,color:'#6b7280',lineHeight:1.4,marginBottom:4}}>{n.body}</div>}
                <div style={{fontSize:11,color:'#9ca3af'}}>{timeAgo(n.created_at)}</div>
              </div>
              {!n.is_read&&<div style={{width:8,height:8,borderRadius:'50%',background:'#e85d04',flexShrink:0,marginTop:6}}/>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

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

// ── Item Detail Modal (bottom-sheet, premium) ─────────────────────────
function ItemDetailModal({ item, qty, onAdd, onRemove, onClose, kitchenOpen, dp, rating }) {
  const isSoldOut = item.stock_count !== null && item.stock_count !== undefined && item.stock_count === 0

  // Close on backdrop click
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9998,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        animation: 'itemBgIn 0.22s ease',
      }}
    >
      <style>{`
        @keyframes itemBgIn   { from{opacity:0} to{opacity:1} }
        @keyframes itemSlideUp{ from{transform:translateY(100%)} to{transform:translateY(0)} }
        @keyframes itemImgIn  { from{transform:scale(1.06)} to{transform:scale(1)} }
      `}</style>

      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: '24px 24px 0 0',
          width: '100%', maxWidth: 520,
          maxHeight: '92vh',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 -8px 48px rgba(0,0,0,0.22)',
          animation: 'itemSlideUp 0.32s cubic-bezier(0.32,0.72,0,1)',
        }}
      >
        {/* ── Image section ── */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          {/* Image */}
          <div style={{
            width: '100%', height: 260, overflow: 'hidden',
            background: '#f1f5f9',
          }}>
            {item.image_url
              ? <img
                  src={item.image_url}
                  alt={item.name}
                  style={{
                    width: '100%', height: '100%', objectFit: 'cover',
                    animation: 'itemImgIn 0.4s ease',
                    filter: isSoldOut ? 'grayscale(60%) brightness(0.75)' : 'none',
                  }}
                />
              : <div style={{
                  width: '100%', height: '100%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 80,
                  background: 'linear-gradient(135deg,#fff7ed,#fef3c7)',
                }}>🍛</div>
            }
          </div>

          {/* Gradient overlay at bottom of image */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: 90,
            background: 'linear-gradient(to top, rgba(0,0,0,0.72) 0%, transparent 100%)',
          }} />

          {/* Close button */}
          <button
            onClick={onClose}
            style={{
              position: 'absolute', top: 14, right: 14,
              width: 36, height: 36, borderRadius: '50%',
              background: 'rgba(0,0,0,0.45)', border: 'none',
              color: '#fff', fontSize: 18, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backdropFilter: 'blur(4px)',
            }}>✕</button>

          {/* Veg/non-veg badge top-left */}
          <div style={{
            position: 'absolute', top: 14, left: 14,
            background: item.is_veg ? '#16a34a' : '#dc2626',
            borderRadius: 8, padding: '3px 10px',
            fontSize: 11, fontWeight: 800, color: '#fff', letterSpacing: 0.5,
          }}>
            {item.is_veg ? '🟢 VEG' : '🔴 NON-VEG'}
          </div>

          {/* Item name over gradient */}
          <div style={{
            position: 'absolute', bottom: 12, left: 18, right: 18,
            color: '#fff', fontSize: 22, fontWeight: 900,
            textShadow: '0 2px 8px rgba(0,0,0,0.6)',
            letterSpacing: 0.3, lineHeight: 1.25,
          }}>{item.name}</div>

          {/* Sold Out overlay */}
          {isSoldOut && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{
                background: 'rgba(220,38,38,0.88)', color: '#fff',
                padding: '8px 22px', borderRadius: 12,
                fontSize: 15, fontWeight: 900, letterSpacing: 1,
              }}>SOLD OUT</div>
            </div>
          )}
        </div>

        {/* ── Scrollable details ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px 0' }}>

          {/* Price row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: 26, fontWeight: 900, color: '#e85d04' }}>₹{dp}</span>
            {item.discount_percent > 0 && <>
              <span style={{ fontSize: 14, color: '#9ca3af', textDecoration: 'line-through' }}>₹{item.price}</span>
              <span style={{
                background: '#dcfce7', color: '#16a34a',
                borderRadius: 8, padding: '2px 10px',
                fontSize: 12, fontWeight: 800,
              }}>{item.discount_percent}% OFF</span>
            </>}
          </div>

          {/* Rating */}
          {rating?.avg >= 1 && rating?.count >= 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <span style={{ fontSize: 14, color: '#f59e0b', letterSpacing: -1 }}>
                {'★'.repeat(Math.round(rating.avg))}{'☆'.repeat(5 - Math.round(rating.avg))}
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#92400e' }}>{rating.avg.toFixed(1)}</span>
              <span style={{ fontSize: 12, color: '#9ca3af' }}>({rating.count} reviews)</span>
              {rating.avg >= 4.5 && rating.count >= 3 && (
                <span style={{ background: '#fef3c7', color: '#92400e', borderRadius: 8, padding: '1px 8px', fontSize: 11, fontWeight: 800 }}>🏆 Most Loved</span>
              )}
            </div>
          )}

          {/* Description */}
          {item.description && (
            <p style={{
              fontSize: 14, color: '#4b5563', lineHeight: 1.65,
              margin: '0 0 16px',
            }}>{item.description}</p>
          )}

          {/* Stock info */}
          {!isSoldOut && item.stock_count !== null && item.stock_count !== undefined && item.stock_count <= 5 && (
            <div style={{
              background: '#fff7ed', border: '1px solid #fed7aa',
              borderRadius: 10, padding: '8px 14px',
              fontSize: 12, color: '#92400e', fontWeight: 600, marginBottom: 14,
            }}>
              ⚡ Sirf {item.stock_count} bacha hai — jaldi order karo!
            </div>
          )}

          {/* Spacer so content clears sticky button */}
          <div style={{ height: 16 }} />
        </div>

        {/* ── Sticky Add to Cart ── */}
        <div style={{
          padding: '14px 20px 28px',
          borderTop: '1px solid #f3f4f6',
          background: '#fff',
          flexShrink: 0,
        }}>
          {isSoldOut ? (
            <button disabled style={{
              width: '100%', padding: 16,
              background: '#f3f4f6', color: '#9ca3af',
              border: 'none', borderRadius: 14,
              fontSize: 15, fontWeight: 800, cursor: 'not-allowed',
            }}>❌ Sold Out</button>

          ) : !kitchenOpen ? (
            <button disabled style={{
              width: '100%', padding: 16,
              background: '#fef3c7', color: '#92400e',
              border: 'none', borderRadius: 14,
              fontSize: 15, fontWeight: 800, cursor: 'not-allowed',
            }}>🔒 Kitchen Abhi Band Hai</button>

          ) : qty === 0 ? (
            <button
              onClick={onAdd}
              style={{
                width: '100%', padding: 16,
                background: 'linear-gradient(135deg,#e85d04,#f97316)',
                color: '#fff', border: 'none', borderRadius: 14,
                fontSize: 16, fontWeight: 900, cursor: 'pointer',
                boxShadow: '0 6px 20px rgba(232,93,4,0.4)',
                letterSpacing: 0.5,
              }}>
              🛒 Add to Cart — ₹{dp}
            </button>

          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 0,
                background: '#fff7ed', border: '2px solid #e85d04',
                borderRadius: 14, overflow: 'hidden', flexShrink: 0,
              }}>
                <button onClick={onRemove} style={{
                  width: 52, height: 52, background: 'none', border: 'none',
                  fontSize: 22, fontWeight: 900, color: '#e85d04', cursor: 'pointer',
                }}>−</button>
                <span style={{ width: 40, textAlign: 'center', fontSize: 18, fontWeight: 800, color: '#1a1a1a' }}>{qty}</span>
                <button onClick={onAdd} style={{
                  width: 52, height: 52, background: '#e85d04', border: 'none',
                  fontSize: 22, fontWeight: 900, color: '#fff', cursor: 'pointer',
                }}>+</button>
              </div>
              <div style={{ flex: 1, fontSize: 14, color: '#6b7280', fontWeight: 600 }}>
                Cart mein hai · ₹{dp * qty} total
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
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

function MenuPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isGuest = searchParams.get('guest') === 'true'
  const isNew   = searchParams.get('new')   === '1'
  const [user, setUser] = useState(null)
  const [showWelcomeModal, setShowWelcomeModal] = useState(false)
  const [welcomeName, setWelcomeName]           = useState('')
  const [welcomeAddress, setWelcomeAddress]     = useState('')
  const [welcomeSaving, setWelcomeSaving]       = useState(false)
  const welcomeNameRef = useRef(null)
  const [menuItems, setMenuItems] = useState([])
  const [offers, setOffers] = useState([])
  const [kitchenOpen, setKitchenOpen] = useState(true)
  const [cart, setCart] = useState({})
  const [activeCategory, setActiveCategory] = useState('All')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showInstallBanner, setShowInstallBanner] = useState(false)
  const [showIOSModal, setShowIOSModal] = useState(false)
  const [itemRatings, setItemRatings] = useState({})
  const [showNotifDrawer, setShowNotifDrawer] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [kitchenPhone, setKitchenPhone] = useState(null)
  const [stockPopup, setStockPopup] = useState(null)   // { itemName, available }
  const [selectedItem, setSelectedItem] = useState(null) // item detail modal
  const [greetingBanner, setGreetingBanner] = useState(null) // time-based banner
  const notifPollRef  = useRef(null)
  const lastUnreadRef = useRef(-1)
  const syncTimerRef  = useRef(null) // debounce DB sync

  const { installPrompt, isInstalled, install, isIOS } = usePWAInstall()

  // Show install banner after 4s — only for guests (not logged-in customers)
  useEffect(() => {
    if (isInstalled || user) return   // hide for logged-in users
    const t = setTimeout(() => {
      if (installPrompt || isIOS) setShowInstallBanner(true)
    }, 4000)
    return () => clearTimeout(t)
  }, [installPrompt, isInstalled, isIOS, user])

  const handleInstall = async () => {
    if (isIOS) { setShowIOSModal(true); return }
    const ok = await install()
    if (ok) setShowInstallBanner(false)
  }

  useEffect(() => {
    // Restore cart from localStorage first (instant, no flash)
    const saved = localStorage.getItem('ck_cart')
    if (saved) { try { setCart(JSON.parse(saved)) } catch {} }

    Promise.all([
      fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'me' }) }).then(r => r.json()),
      fetch('/api/menu').then(r => r.json()),
      fetch('/api/admin').then(r => r.json()),
      fetch('/api/admin?type=offers').then(r => r.json()),
      fetch('/api/ratings?type=menu').then(r => r.json()).catch(() => ({ itemRatings: {} })),
      fetch('/api/cart').then(r => r.json()).catch(() => ({ cart: {} })),
    ]).then(([authData, menuData, settingsData, offersData, ratingsData, cartData]) => {
      // Guest mode: skip auth redirect — guests can browse menu freely
      if (!isGuest) {
        if (!authData.user || authData.user.role !== 'customer') { router.push('/login'); return }
      }
      if (authData.user?.role === 'customer') {
        setUser(authData.user)
        // New customer redirect from login — show welcome modal if no name set
        if (isNew && !authData.user.name?.trim()) {
          setShowWelcomeModal(true)
          setTimeout(() => welcomeNameRef.current?.focus(), 300)
        }
      }
      // DB cart wins over localStorage (cross-device sync) — only for logged-in users
      if (!isGuest && cartData.cart && Object.keys(cartData.cart).length > 0) {
        setCart(cartData.cart)
        localStorage.setItem('ck_cart', JSON.stringify(cartData.cart))
      }
      setMenuItems(menuData.items || [])
      setKitchenOpen(settingsData.settings?.is_open ?? true)
      setKitchenPhone(settingsData.settings?.phone || null)
      setOffers(offersData.offers || [])
      setItemRatings(ratingsData.itemRatings || {})
      setLoading(false)
    })
  }, [])

  // Time-based greeting banner
  useEffect(() => {
    const hour = new Date().getHours()
    let category = ''
    let title = ''
    if (hour >= 6  && hour < 11) { category = 'morning_banner';    title = 'Subah' }
    else if (hour >= 11 && hour < 16) { category = 'afternoon_banner'; title = 'Dopahar' }
    else if (hour >= 16 && hour < 20) { category = 'evening_banner';   title = 'Shaam' }
    else if (hour >= 20 && hour < 23) { category = 'night_banner';     title = 'Raat' }
    else                              { category = 'late_night_banner'; title = 'Late Night' }

    fetch(`/api/engagement?category=${category}`)
      .then(r => r.json())
      .then(d => { if (d.message) setGreetingBanner(d.message) })
      .catch(() => {})
  }, [])

  // Debounced DB sync — fires 800ms after last change
  const syncCartToDB = (cartData) => {
    clearTimeout(syncTimerRef.current)
    syncTimerRef.current = setTimeout(() => {
      fetch('/api/cart', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cart: cartData })
      }).catch(() => {})
    }, 800)
  }

  const saveCart = (newCart) => {
    setCart(newCart)
    localStorage.setItem('ck_cart', JSON.stringify(newCart))
    syncCartToDB(newCart)
  }

  const addItem = (id) => {
    if (!kitchenOpen) return
    const item = menuItems.find(m => m.id === id)
    const currentQty = cart[id] || 0
    // Stock limit check — only if stock_count is set (not null)
    if (item && item.stock_count !== null && item.stock_count !== undefined) {
      if (currentQty >= item.stock_count) {
        setStockPopup({ itemName: item.name, available: item.stock_count })
        return
      }
    }
    const nc = { ...cart, [id]: currentQty + 1 }
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
  const searchQ = search.trim().toLowerCase()
  const filtered = menuItems
    .filter(m => activeCategory === 'All' || m.category === activeCategory)
    .filter(m => !searchQ || m.name.toLowerCase().includes(searchQ) || m.description?.toLowerCase().includes(searchQ) || m.category?.toLowerCase().includes(searchQ))

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

  // Listen for SW push messages → play sound + refresh badge
  useEffect(() => {
    if (!navigator.serviceWorker) return
    const handler = (e) => {
      if (e.data?.type === 'PLAY_NOTIFICATION_SOUND') {
        playNotifSound()
        fetch('/api/notifications').then(r => r.json()).then(d => setUnreadCount(d.unreadCount || 0)).catch(() => {})
      }
    }
    navigator.serviceWorker.addEventListener('message', handler)
    return () => navigator.serviceWorker.removeEventListener('message', handler)
  }, [])

  // Poll for unread notification count every 30s
  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const d = await fetch('/api/notifications').then(r => r.json())
        const count = d.unreadCount || 0
        if (count > lastUnreadRef.current && lastUnreadRef.current >= 0) playNotifSound()
        lastUnreadRef.current = count
        setUnreadCount(count)
      } catch {}
    }
    fetchUnread()
    notifPollRef.current = setInterval(fetchUnread, 30000)
    return () => clearInterval(notifPollRef.current)
  }, [])

  if (loading) return <div className={styles.loading}><div className="spinner" /></div>

  // ── Save welcome name + address ──────────────────────────────────
  const saveWelcomeInfo = async () => {
    if (!welcomeName.trim()) { welcomeNameRef.current?.focus(); return }
    setWelcomeSaving(true)
    try {
      await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: welcomeName.trim(), address: welcomeAddress.trim() || undefined }),
      })
      setUser(u => ({ ...u, name: welcomeName.trim() }))
    } catch(e) { /* non-fatal */ }
    setWelcomeSaving(false)
    setShowWelcomeModal(false)
    // Remove ?new=1 from URL cleanly
    window.history.replaceState({}, '', '/menu')
  }

  return (
    <div className={styles.page}>

      {/* ── New Customer Welcome Modal ── */}
      {showWelcomeModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 99999,
          background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        }}>
          <div style={{
            background: '#fff', borderRadius: '24px 24px 0 0',
            width: '100%', maxWidth: 480, padding: '28px 24px 44px',
            animation: 'slideUpSheet 0.38s cubic-bezier(0.34,1.1,0.64,1)',
            boxShadow: '0 -8px 48px rgba(0,0,0,0.18)',
          }}>
            <div style={{ width: 40, height: 4, background: '#e5e7eb', borderRadius: 4, margin: '0 auto 22px' }} />
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 44, marginBottom: 8 }}>👋</div>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1a1a1a', margin: '0 0 6px' }}>FoodFi mein Welcome!</h2>
              <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>Bas naam batao — order karo! Address baad mein bhi de sakte ho.</p>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>
                Aapka Naam <span style={{ color: '#e85d04' }}>*</span>
              </label>
              <input
                ref={welcomeNameRef}
                type="text"
                value={welcomeName}
                onChange={e => setWelcomeName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveWelcomeInfo()}
                placeholder="Jaise: Rahul Kumar"
                autoComplete="name"
                style={{
                  width: '100%', padding: '13px 14px',
                  border: `1.5px solid ${welcomeName.trim() ? '#e85d04' : '#e5e7eb'}`,
                  borderRadius: 12, fontSize: 15, fontWeight: 500,
                  outline: 'none', boxSizing: 'border-box',
                  background: welcomeName.trim() ? '#fff7ed' : '#fff',
                }}
              />
            </div>

            <div style={{ marginBottom: 22 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>
                Delivery Address <span style={{ fontSize: 11, fontWeight: 400, color: '#9ca3af' }}>(optional)</span>
              </label>
              <textarea
                value={welcomeAddress}
                onChange={e => setWelcomeAddress(e.target.value)}
                placeholder="Ghar / office ka address..."
                rows={2}
                style={{
                  width: '100%', padding: '12px 14px',
                  border: `1.5px solid ${welcomeAddress ? '#16a34a' : '#e5e7eb'}`,
                  borderRadius: 12, fontSize: 13, outline: 'none',
                  boxSizing: 'border-box', resize: 'none', lineHeight: 1.5,
                  background: welcomeAddress ? '#f0fdf4' : '#fff',
                }}
              />
            </div>

            <button
              type="button"
              onClick={saveWelcomeInfo}
              disabled={!welcomeName.trim() || welcomeSaving}
              style={{
                width: '100%', padding: '15px',
                background: welcomeName.trim() ? 'linear-gradient(135deg,#e85d04,#f97316)' : '#e5e7eb',
                color: welcomeName.trim() ? '#fff' : '#9ca3af',
                border: 'none', borderRadius: 14, fontSize: 16, fontWeight: 800,
                cursor: welcomeName.trim() ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                boxShadow: welcomeName.trim() ? '0 4px 20px rgba(232,93,4,0.35)' : 'none',
              }}>
              {welcomeSaving ? <><span className="spinner" /> Saving...</> : 'FoodFi pe Chalo! 🍛'}
            </button>
          </div>
        </div>
      )}

      {/* Navbar */}
      <nav className={styles.nav} style={isGuest ? { marginTop: 44 } : {}}>
        <span className={styles.logo}>🍽️ <span style={{color:'#e85d04'}}>Food</span>Fi</span>
        <div className={styles.navRight}>
          <span className={`${styles.kitchenBadge} ${kitchenOpen ? styles.open : styles.closed}`}>
            <span className={styles.dot} /> {kitchenOpen ? 'Open' : 'Closed'}
          </span>
          {isGuest
            ? <button className="btn btn-primary" onClick={() => router.push('/login')} style={{ fontSize: 12, padding: '6px 12px', background: '#e85d04' }}>Login</button>
            : <span className={styles.greeting}>Hi, {user?.name?.split(' ')[0]}</span>
          }
          {!isGuest && (
            <button className={styles.cartBtn} onClick={() => router.push('/cart')}>
              🛒 Cart
              {cartCount > 0 && <span className={styles.cartBadge}>{cartCount}</span>}
            </button>
          )}
          {!isGuest && <button className="btn btn-secondary" onClick={() => router.push('/orders')} style={{ fontSize: 12, padding: '6px 10px' }}>My Orders</button>}
          {!isGuest && <button className="btn btn-secondary" onClick={() => router.push('/profile')} style={{ fontSize: 12, padding: '6px 10px' }}>👤 Profile</button>}
          {/* Notification Bell — logged-in only */}
          {!isGuest && (
            <button onClick={() => { setShowNotifDrawer(true); setUnreadCount(0); lastUnreadRef.current = 0 }}
              style={{ position:'relative', background:'none', border:'1px solid #e5e7eb', borderRadius:8, padding:'5px 10px', cursor:'pointer', fontSize:16 }}>
              🔔
              {unreadCount > 0 && (
                <span style={{ position:'absolute', top:-6, right:-6, background:'#e85d04', color:'#fff', borderRadius:'50%', width:18, height:18, fontSize:10, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          )}
          {/* Install button — only for guests (not logged-in customers) */}
          {!isInstalled && !user && (installPrompt || isIOS) && (
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

      {/* Greeting Banner */}
      {greetingBanner && (
        <div style={{
          margin: '0 16px 4px',
          background: 'linear-gradient(135deg, #fff7ed, #fef3c7)',
          border: '1px solid #fed7aa',
          borderRadius: 14,
          padding: '12px 16px',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 22, flexShrink: 0 }}>👋</span>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#92400e' }}>
              {user?.name?.split(' ')[0] ? `${user.name.split(' ')[0]}, ` : ''}{greetingBanner}
            </span>
          </div>
          <button onClick={() => setGreetingBanner(null)}
            style={{ background: 'none', border: 'none', fontSize: 16, color: '#d97706', cursor: 'pointer', flexShrink: 0, lineHeight: 1 }}>✕</button>
        </div>
      )}

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

      {/* Search bar */}
      <div className={styles.searchBar}>
        <span className={styles.searchIcon}>🔍</span>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search dishes, categories..."
          className={styles.searchInput}
        />
        {search && (
          <button className={styles.searchClear} onClick={() => setSearch('')}>✕</button>
        )}
      </div>

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
        {filtered.length === 0 && (
          <div style={{ gridColumn:'1/-1', textAlign:'center', padding:'48px 20px', color:'var(--t2)' }}>
            <div style={{ fontSize:40, marginBottom:12 }}>🍽️</div>
            <div style={{ fontSize:16, fontWeight:600, marginBottom:6 }}>No dishes found</div>
            <div style={{ fontSize:13 }}>Try a different search or category</div>
            <button onClick={() => { setSearch(''); setActiveCategory('All') }}
              style={{ marginTop:16, background:'var(--or)', color:'#fff', border:'none', borderRadius:8, padding:'8px 20px', cursor:'pointer', fontWeight:600, fontSize:13 }}>
              Show All
            </button>
          </div>
        )}
        {filtered.map(item => {
          const qty = cart[item.id] || 0
          const dp = discPrice(item)
          const isSoldOut = item.stock_count !== null && item.stock_count !== undefined && item.stock_count === 0
          const cardClass = `${styles.menuCard} ${isSoldOut ? styles.menuCardSoldOut : ''}`

          return (
            <div key={item.id} className={cardClass}
              onClick={() => setSelectedItem(item)}
              style={{ cursor: 'pointer' }}
            >
              <div className={styles.cardLeft}>
                <div className={styles.cardTitle}>
                  <span className={`veg-dot ${item.is_veg ? 'veg' : 'nonveg'}`} />
                  <h4>{item.name}</h4>
                  {isSoldOut && (
                    <span style={{ fontSize:10, background:'#fee2e2', color:'#dc2626', borderRadius:6, padding:'1px 6px', fontWeight:700, whiteSpace:'nowrap' }}>● Sold Out</span>
                  )}
                  {!isSoldOut && !kitchenOpen && (
                    <span style={{ fontSize:10, background:'#fef3c7', color:'#92400e', borderRadius:6, padding:'1px 6px', fontWeight:700, whiteSpace:'nowrap' }}>🔒 Closed</span>
                  )}
                  {!isSoldOut && kitchenOpen && itemRatings[item.id]?.avg >= 4.5 && itemRatings[item.id]?.count >= 3 && (
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
                {/* Image with sold-out overlay */}
                <div className={styles.imgWrap}>
                  {item.image_url
                    ? <img src={item.image_url} alt={item.name} className={`${styles.foodImg} ${isSoldOut ? styles.imgSoldOut : ''}`} />
                    : <div className={`${styles.foodEmoji} ${isSoldOut ? styles.imgSoldOut : ''}`}>🍛</div>
                  }
                  {isSoldOut && (
                    <div className={styles.soldOutBadge}><span>Sold Out</span></div>
                  )}
                </div>

                {/* Action button area — stopPropagation so card click doesn't fire */}
                <div onClick={e => e.stopPropagation()}>
                  {isSoldOut ? (
                    <button className={styles.soldOutBtn} disabled>❌ Sold Out</button>
                  ) : !kitchenOpen ? (
                    <button className={styles.closedBtn} disabled>🔒 Closed</button>
                  ) : qty === 0 ? (
                    <button className={styles.addBtn} onClick={() => addItem(item.id)}>+ Add</button>
                  ) : (
                    <div className={styles.qtyCtl}>
                      <button onClick={() => removeItem(item.id)}>−</button>
                      <span>{qty}</span>
                      <button onClick={() => addItem(item.id)}>+</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Cart sticky bar */}
      {cartCount > 0 && !isGuest && (
        <div className={styles.cartBar}>
          <span>{cartCount} item{cartCount > 1 ? 's' : ''} in cart</span>
          <button className="btn btn-primary" onClick={() => router.push('/cart')}>
            View Cart →
          </button>
        </div>
      )}

      {/* Guest cart bar — prompt login to checkout */}
      {cartCount > 0 && isGuest && (
        <div className={styles.cartBar} style={{ background: 'linear-gradient(135deg, #1e3a8a, #0f1f5c)' }}>
          <span style={{ fontSize: 13 }}>🛒 {cartCount} item{cartCount > 1 ? 's' : ''} — Login to order</span>
          <button
            className="btn btn-primary"
            style={{ background: '#fbbf24', color: '#1f2937', fontWeight: 800 }}
            onClick={() => router.push('/login')}
          >
            Login / Sign Up →
          </button>
        </div>
      )}

      {/* Guest top banner */}
      {isGuest && !loading && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 999,
          background: 'linear-gradient(135deg, #1e3a8a 0%, #e85d04 100%)',
          color: '#fff', padding: '10px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontSize: 13, gap: 10,
          boxShadow: '0 2px 12px rgba(0,0,0,0.2)',
        }}>
          <span style={{ fontWeight: 600 }}>👀 Guest mode — Browse karo, order ke liye login karo</span>
          <button
            onClick={() => router.push('/login')}
            style={{
              background: '#fbbf24', color: '#1f2937', border: 'none',
              borderRadius: 8, padding: '5px 12px', fontSize: 12,
              fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap',
            }}>
            Login →
          </button>
        </div>
      )}

      {/* Floating Support Chat */}
      <SupportChat />

      {/* Item Detail Modal */}
      {selectedItem && (
        <ItemDetailModal
          item={selectedItem}
          qty={cart[selectedItem.id] || 0}
          dp={discPrice(selectedItem)}
          rating={itemRatings[selectedItem.id]}
          kitchenOpen={kitchenOpen}
          onAdd={() => addItem(selectedItem.id)}
          onRemove={() => removeItem(selectedItem.id)}
          onClose={() => setSelectedItem(null)}
        />
      )}

      {/* Notification Drawer */}
      {showNotifDrawer && <NotificationDrawer onClose={() => setShowNotifDrawer(false)} />}

      {/* Stock Limit Popup */}
      {stockPopup && (
        <div
          onClick={() => setStockPopup(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
            zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px'
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: 20, padding: '28px 24px',
              maxWidth: 360, width: '100%', boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
              textAlign: 'center', fontFamily: 'inherit'
            }}
          >
            {/* Emoji header */}
            <div style={{ fontSize: 48, marginBottom: 8 }}>🙏</div>

            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#1a1a1a', margin: '0 0 10px' }}>
              We&apos;re Sorry!
            </h3>

            <p style={{ fontSize: 14, color: '#4b5563', lineHeight: 1.6, margin: '0 0 16px' }}>
              Only <strong>{stockPopup.available}</strong> serving{stockPopup.available !== 1 ? 's' : ''} of{' '}
              <strong>{stockPopup.itemName}</strong> are available right now.
            </p>

            <div style={{
              background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 12,
              padding: '14px 16px', marginBottom: 20
            }}>
              <p style={{ fontSize: 13, color: '#92400e', margin: '0 0 8px', fontWeight: 600 }}>
                🎉 Planning a party or large order?
              </p>
              <p style={{ fontSize: 13, color: '#78350f', margin: '0 0 12px', lineHeight: 1.5 }}>
                We&apos;d love to prepare fresh for you! Please call us and we&apos;ll arrange everything specially.
              </p>
              {kitchenPhone ? (
                <a
                  href={`tel:${kitchenPhone}`}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    background: '#e85d04', color: '#fff', borderRadius: 10,
                    padding: '10px 20px', fontSize: 15, fontWeight: 700,
                    textDecoration: 'none', letterSpacing: 0.3
                  }}
                >
                  📞 Call to Order: {kitchenPhone}
                </a>
              ) : (
                <p style={{ fontSize: 13, color: '#92400e', margin: 0, fontWeight: 600 }}>
                  📞 Please call the kitchen to place a large order.
                </p>
              )}
            </div>

            <button
              onClick={() => setStockPopup(null)}
              style={{
                background: '#f3f4f6', color: '#374151', border: 'none',
                borderRadius: 10, padding: '10px 28px', fontSize: 14,
                fontWeight: 600, cursor: 'pointer', width: '100%'
              }}
            >
              Got it, Thanks!
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function MenuPage() {
  return (
    <Suspense fallback={null}>
      <MenuPageContent />
    </Suspense>
  )
}

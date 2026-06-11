'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
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

// ── Splash Lines Pool ─────────────────────────────────────────────
const SPLASH_LINES = [
  { main: 'माँ के हाथों का स्वाद, अब आपके दरवाज़े तक', sub: 'ताज़ा बना, गरमागरम आया 🍽️' },
  { main: 'हर निवाले में माँ की दुआ है', sub: 'Har order mein dil lagate hain 🧡' },
  { main: 'वो पुरानी रसोई की महक... याद है?', sub: 'No shortcuts in our kitchen, only love 🌿' },
  { main: 'घर का खाना — दिल का खाना', sub: 'Saaf haath, saccha khana — hamara vaada ✨' },
  { main: 'दिल से बनाया, आपके लिए सजाया', sub: 'Pet khush, toh sab khush 😋' },
  { main: 'हर थाली में प्यार का तड़का', sub: 'Fresh · Homemade · Made with Love' },
  { main: 'आपकी भूख, हमारी ज़िम्मेदारी', sub: 'Bhook lagi? Hum aa rahe hain 🛵' },
  { main: 'खाने में जब प्यार हो, हर bite special हो', sub: 'Aaj kya khayein? — Ye sawaal khatam! ✅' },
  { main: '🙏 अतिथि देवो भव — आपका स्वागत है', sub: 'Har subah ek naya swad, har shaam ek naya ehsaas' },
  { main: 'अन्न ब्रह्म है — हम इज़्ज़त से बनाते हैं', sub: 'आपका भरोसा, हमारी ताकत 💪' },
  { main: 'खाना खाया? — हमारी सबसे बड़ी चिंता', sub: 'Ghar pe kuch nahi bana? Koi baat nahi! 😄' },
  { main: 'रोटी, प्यार aur FoodFi 🧡', sub: 'Ek order, hazaar yaadon jaisa swad' },
  { main: 'खुशबू आए रसोई से, दिल खुश हो जाए', sub: 'Chef special, delivered special ✨' },
  { main: 'Zindagi mein do cheezein khoobsurat hain —', sub: 'Accha insaan aur accha khana 🍛' },
  { main: 'Har subah ek naya swad', sub: 'Har shaam ek naya ehsaas — FoodFi ke saath 🌟' },
  { main: 'भूख लगी है? — चिंता मत करो, FoodFi हैं ना 🤗', sub: 'Bas ek order — baaki sab humpe chodo 🛵' },
  { main: 'थक गए? बैठो — खाना हम भेज रहे हैं 💆', sub: 'Aaram karo, hum kaam karte hain 🍽️' },
  { main: 'Diet कल से... आज FoodFi है 😅', sub: 'Ek din aur nahi bigdega — promise! 😄' },
  { main: 'Seedha रसोई से आपके पास', sub: 'No middleman, no delay — just fresh food ✨' },
  { main: 'Made with love. Delivered with care.', sub: 'Every order is personal to us 🧡' },
  { main: 'Khana nahi — khayaal hai yeh', sub: 'Aapki bhookh, hamari zimmedari 💝' },
]

export default function MenuPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
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

  // ── Splash Screen ─────────────────────────────────────────────
  const [showSplash, setShowSplash] = useState(true)
  const [splashPhase, setSplashPhase] = useState(0)
  const [splashLine] = useState(() => SPLASH_LINES[Math.floor(Math.random() * SPLASH_LINES.length)])

  useEffect(() => {
    const timers = [
      setTimeout(() => setSplashPhase(1), 100),
      setTimeout(() => setSplashPhase(2), 400),
      setTimeout(() => setSplashPhase(3), 750),
      setTimeout(() => setSplashPhase(4), 1150),
      setTimeout(() => setSplashPhase(5), 1500),
      setTimeout(() => setShowSplash(false), 2000), // 2 sec total — after login
    ]
    return () => timers.forEach(clearTimeout)
  }, [])

  // ── Kitchen Closed Splash (after regular splash, if kitchen is closed) ──
  const [showClosedSplash, setShowClosedSplash] = useState(false)
  const [closedPhase, setClosedPhase] = useState(0)

  useEffect(() => {
    if (!showSplash && !kitchenOpen && !loading) {
      setClosedPhase(0)
      setShowClosedSplash(true)
      const timers = [
        setTimeout(() => setClosedPhase(1), 150),   // 👩‍🍳 emoji bounce
        setTimeout(() => setClosedPhase(2), 500),   // title
        setTimeout(() => setClosedPhase(3), 900),   // line 1
        setTimeout(() => setClosedPhase(4), 1400),  // line 2
        setTimeout(() => setClosedPhase(5), 1900),  // notification hint
        setTimeout(() => setClosedPhase(6), 2500),  // fade out
        setTimeout(() => setShowClosedSplash(false), 3000), // 3 sec total
      ]
      return () => timers.forEach(clearTimeout)
    }
  }, [showSplash, kitchenOpen, loading])

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
      if (!authData.user || authData.user.role !== 'customer') { router.push('/login'); return }
      setUser(authData.user)
      // DB cart wins over localStorage (cross-device sync)
      if (cartData.cart && Object.keys(cartData.cart).length > 0) {
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

  if (loading && !showSplash) return <div className={styles.loading}><div className="spinner" /></div>

  return (
    <div className={styles.page}>

      {/* ── Splash Screen ── */}
      {showSplash && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 99999,
          background: 'linear-gradient(160deg, #0f0400 0%, #1e0a00 45%, #120600 100%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
          opacity: splashPhase >= 5 ? 0 : 1,
          transition: splashPhase >= 5 ? 'opacity 0.85s ease' : 'none',
          pointerEvents: splashPhase >= 5 ? 'none' : 'all',
        }}>
          <style>{`
            @keyframes ckFloatUp {
              0%   { transform: translateY(0) rotate(0deg);   opacity: 0.18; }
              50%  { opacity: 0.35; }
              100% { transform: translateY(-110vh) rotate(25deg); opacity: 0; }
            }
            @keyframes ckGlow {
              0%,100% { box-shadow: 0 0 28px rgba(232,93,4,0.55), 0 0 60px rgba(232,93,4,0.18); }
              50%      { box-shadow: 0 0 55px rgba(232,93,4,0.9), 0 0 110px rgba(232,93,4,0.4); }
            }
            @keyframes ckShimmer {
              0%   { background-position: -300% center; }
              100% { background-position:  300% center; }
            }
            @keyframes ckDot {
              0%,100% { opacity: 0.35; transform: scale(1); }
              50%      { opacity: 1;    transform: scale(1.5); }
            }
            @keyframes ckBar {
              0%   { width: 0; opacity: 0; }
              20%  { opacity: 1; }
              100% { width: 64px; opacity: 1; }
            }
          `}</style>

          {/* Floating food emojis */}
          {['🍛','🍜','🥘','🍱','🌮','🍝','🍚','🫕','🥗','🍲'].map((em, i) => (
            <div key={i} style={{
              position: 'absolute',
              left: `${i * 10 + 4}%`,
              bottom: `-${6 + (i % 3) * 2}%`,
              fontSize: `${14 + (i % 4) * 6}px`,
              animation: `ckFloatUp ${6 + i * 0.65}s linear ${i * 0.45}s infinite`,
              userSelect: 'none', pointerEvents: 'none',
            }}>{em}</div>
          ))}

          {/* Radial glow */}
          <div style={{
            position: 'absolute', width: 320, height: 320, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(232,93,4,0.13) 0%, transparent 70%)',
            top: '50%', left: '50%', transform: 'translate(-50%, -70%)',
            pointerEvents: 'none',
          }} />

          {/* Logo */}
          <div style={{
            opacity: splashPhase >= 1 ? 1 : 0,
            transform: splashPhase >= 1 ? 'scale(1)' : 'scale(0.2)',
            transition: 'opacity 0.5s ease, transform 0.65s cubic-bezier(0.34,1.56,0.64,1)',
            marginBottom: 14, borderRadius: 22,
            animation: splashPhase >= 1 ? 'ckGlow 2.2s ease-in-out 0.65s infinite' : 'none',
          }}>
            <div style={{
              width: 78, height: 78, borderRadius: 20,
              background: 'linear-gradient(135deg,#e85d04,#f97316)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 42,
            }}>🍽️</div>
          </div>

          {/* Brand name */}
          <div style={{
            opacity: splashPhase >= 2 ? 1 : 0,
            transform: splashPhase >= 2 ? 'translateY(0)' : 'translateY(22px)',
            transition: 'opacity 0.55s ease, transform 0.55s ease',
            textAlign: 'center', marginBottom: 6,
          }}>
            <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: '-0.5px', lineHeight: 1.1 }}>
              <span style={{ color: '#e85d04' }}>Food</span>
              <span style={{ color: '#fff' }}>Fi</span>
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', fontWeight: 600, letterSpacing: 3.5, textTransform: 'uppercase', marginTop: 3 }}>
              Cloud Kitchen
            </div>
          </div>

          {/* Animated bar */}
          <div style={{
            height: 2,
            background: 'linear-gradient(90deg, transparent, #e85d04, transparent)',
            borderRadius: 2, marginBottom: 24,
            animation: splashPhase >= 2 ? 'ckBar 0.7s ease forwards' : 'none',
            width: splashPhase >= 2 ? 64 : 0,
          }} />

          {/* Main line */}
          <div style={{
            opacity: splashPhase >= 3 ? 1 : 0,
            transform: splashPhase >= 3 ? 'translateY(0)' : 'translateY(20px)',
            transition: 'opacity 0.65s ease, transform 0.65s ease',
            textAlign: 'center', padding: '0 30px', marginBottom: 14, maxWidth: 360,
          }}>
            <div style={{
              fontSize: 21, fontWeight: 800, lineHeight: 1.45, letterSpacing: 0.2,
              background: 'linear-gradient(90deg, #fbbf24, #e85d04, #f59e0b, #e85d04, #fbbf24)',
              backgroundSize: '300% auto',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              animation: splashPhase >= 3 ? 'ckShimmer 3.5s linear infinite' : 'none',
            }}>
              {splashLine.main}
            </div>
          </div>

          {/* Sub line */}
          <div style={{
            opacity: splashPhase >= 4 ? 1 : 0,
            transform: splashPhase >= 4 ? 'translateY(0)' : 'translateY(14px)',
            transition: 'opacity 0.6s ease, transform 0.6s ease',
            textAlign: 'center', padding: '0 40px', maxWidth: 340,
          }}>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.58)', fontWeight: 500, letterSpacing: 0.3, lineHeight: 1.65 }}>
              {splashLine.sub}
            </div>
          </div>

          {/* Pulsing dots */}
          <div style={{
            display: 'flex', gap: 7, marginTop: 32,
            opacity: splashPhase >= 4 ? 1 : 0,
            transition: 'opacity 0.5s ease 0.2s',
          }}>
            {[0,1,2].map(i => (
              <div key={i} style={{
                width: 6, height: 6, borderRadius: '50%',
                background: i === 1 ? '#e85d04' : 'rgba(232,93,4,0.45)',
                animation: splashPhase >= 4 ? `ckDot 1.1s ease-in-out ${i * 0.22}s infinite` : 'none',
              }} />
            ))}
          </div>

          {/* Bottom label */}
          <div style={{
            position: 'absolute', bottom: 28,
            opacity: splashPhase >= 4 ? 0.35 : 0,
            transition: 'opacity 0.5s ease 0.4s',
            fontSize: 10, color: 'rgba(255,255,255,0.35)',
            letterSpacing: 2.5, textTransform: 'uppercase', fontWeight: 500,
          }}>
            foodfi.in
          </div>
        </div>
      )}

      {/* ── Kitchen Closed Splash ── */}
      {showClosedSplash && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 99998,
          background: 'linear-gradient(160deg, #1a0800 0%, #2d1200 50%, #1a0800 100%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
          opacity: closedPhase >= 6 ? 0 : 1,
          transition: closedPhase >= 6 ? 'opacity 0.9s ease' : 'none',
          pointerEvents: closedPhase >= 6 ? 'none' : 'all',
        }}>
          <style>{`
            @keyframes chefBounce {
              0%   { transform: scale(0) rotate(-15deg); opacity: 0; }
              55%  { transform: scale(1.2) rotate(5deg);  opacity: 1; }
              75%  { transform: scale(0.92) rotate(-2deg); }
              90%  { transform: scale(1.05) rotate(1deg); }
              100% { transform: scale(1) rotate(0deg); opacity: 1; }
            }
            @keyframes chefWiggle {
              0%,100% { transform: rotate(-4deg); }
              50%      { transform: rotate(4deg); }
            }
            @keyframes closedShimmer {
              0%   { background-position: -300% center; }
              100% { background-position:  300% center; }
            }
            @keyframes bellRing {
              0%,100% { transform: rotate(0deg); }
              20%      { transform: rotate(15deg); }
              40%      { transform: rotate(-12deg); }
              60%      { transform: rotate(8deg); }
              80%      { transform: rotate(-5deg); }
            }
            @keyframes floatUpClosed {
              0%   { transform: translateY(0) rotate(0deg); opacity: 0.12; }
              100% { transform: translateY(-110vh) rotate(20deg); opacity: 0; }
            }
          `}</style>

          {/* Floating soft emojis */}
          {['🍳','🥘','🫕','🍲','🥗','🍜','🫙','🧂'].map((em, i) => (
            <div key={i} style={{
              position: 'absolute',
              left: `${i * 12 + 3}%`,
              bottom: `-5%`,
              fontSize: `${12 + (i % 3) * 7}px`,
              animation: `floatUpClosed ${7 + i * 0.7}s linear ${i * 0.5}s infinite`,
              opacity: 0.15,
              userSelect: 'none', pointerEvents: 'none',
            }}>{em}</div>
          ))}

          {/* Warm radial glow */}
          <div style={{
            position: 'absolute', width: 280, height: 280, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(251,191,36,0.1) 0%, transparent 70%)',
            top: '50%', left: '50%', transform: 'translate(-50%, -65%)',
            pointerEvents: 'none',
          }} />

          {/* Chef emoji */}
          <div style={{
            fontSize: 72,
            marginBottom: 8,
            animation: closedPhase >= 1
              ? 'chefBounce 0.75s cubic-bezier(0.34,1.56,0.64,1) forwards'
              : 'none',
            opacity: closedPhase >= 1 ? 1 : 0,
            display: 'inline-block',
            transformOrigin: 'bottom center',
          }}>
            👩‍🍳
          </div>

          {/* Sad face sub-emoji */}
          <div style={{
            fontSize: 28,
            marginBottom: 18,
            opacity: closedPhase >= 1 ? 1 : 0,
            transition: 'opacity 0.4s ease 0.3s',
            animation: closedPhase >= 1 ? 'chefWiggle 1.8s ease-in-out 1s infinite' : 'none',
            display: 'inline-block',
          }}>
            😅
          </div>

          {/* Title */}
          <div style={{
            opacity: closedPhase >= 2 ? 1 : 0,
            transform: closedPhase >= 2 ? 'translateY(0)' : 'translateY(18px)',
            transition: 'opacity 0.55s ease, transform 0.55s ease',
            textAlign: 'center', marginBottom: 20, padding: '0 24px',
          }}>
            <div style={{
              fontSize: 22, fontWeight: 900, lineHeight: 1.3,
              background: 'linear-gradient(90deg, #fbbf24, #f59e0b, #fbbf24)',
              backgroundSize: '200% auto',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              animation: closedPhase >= 2 ? 'closedShimmer 2.5s linear infinite' : 'none',
            }}>
              Oops! FoodFi Thodi Der<br />Ke Liye Break Pe Hai!
            </div>
          </div>

          {/* Line 1 */}
          <div style={{
            opacity: closedPhase >= 3 ? 1 : 0,
            transform: closedPhase >= 3 ? 'translateY(0)' : 'translateY(14px)',
            transition: 'opacity 0.6s ease, transform 0.6s ease',
            textAlign: 'center', padding: '0 36px', marginBottom: 12, maxWidth: 340,
          }}>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.82)', fontWeight: 600, lineHeight: 1.6 }}>
              Chinta mat karo — garam khana lekar<br />jald wapas aayenge! 😄
            </div>
          </div>

          {/* Line 2 */}
          <div style={{
            opacity: closedPhase >= 4 ? 1 : 0,
            transform: closedPhase >= 4 ? 'translateY(0)' : 'translateY(14px)',
            transition: 'opacity 0.6s ease, transform 0.6s ease',
            textAlign: 'center', padding: '0 36px', marginBottom: 24, maxWidth: 340,
          }}>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.58)', fontWeight: 500, lineHeight: 1.6, fontStyle: 'italic' }}>
              "Tab tak thoda sabr... khana aur bhi<br />acha bana ke laayenge!" 🍛
            </div>
          </div>

          {/* Notification hint */}
          <div style={{
            opacity: closedPhase >= 5 ? 1 : 0,
            transform: closedPhase >= 5 ? 'translateY(0)' : 'translateY(10px)',
            transition: 'opacity 0.55s ease, transform 0.55s ease',
            background: 'rgba(251,191,36,0.12)',
            border: '1px solid rgba(251,191,36,0.3)',
            borderRadius: 14, padding: '10px 20px',
            display: 'flex', alignItems: 'center', gap: 10, maxWidth: 300,
          }}>
            <span style={{
              fontSize: 20,
              animation: closedPhase >= 5 ? 'bellRing 1.2s ease-in-out 0.3s infinite' : 'none',
              display: 'inline-block',
            }}>🔔</span>
            <span style={{ fontSize: 12, color: '#fbbf24', fontWeight: 600, lineHeight: 1.5 }}>
              Notification on rakho —<br />opening pe pehle aap! 🌟
            </span>
          </div>

          {/* Bottom */}
          <div style={{
            position: 'absolute', bottom: 28,
            opacity: closedPhase >= 5 ? 0.35 : 0,
            transition: 'opacity 0.5s ease 0.3s',
            fontSize: 10, color: 'rgba(255,255,255,0.35)',
            letterSpacing: 2.5, textTransform: 'uppercase', fontWeight: 500,
          }}>
            jald milenge ❤️
          </div>
        </div>
      )}

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
          {/* Notification Bell */}
          <button onClick={() => { setShowNotifDrawer(true); setUnreadCount(0); lastUnreadRef.current = 0 }}
            style={{ position:'relative', background:'none', border:'1px solid #e5e7eb', borderRadius:8, padding:'5px 10px', cursor:'pointer', fontSize:16 }}>
            🔔
            {unreadCount > 0 && (
              <span style={{ position:'absolute', top:-6, right:-6, background:'#e85d04', color:'#fff', borderRadius:'50%', width:18, height:18, fontSize:10, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center' }}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
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

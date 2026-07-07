'use client'
import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import styles from './menu.module.css'
import SupportChat from '../components/SupportChat'
import { usePWAInstall } from '@/lib/usePWAInstall'
import { findNearestBranchClient, findServingBranches } from '@/lib/branchSelect'

const GMAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY

// GPS coords → a short readable address (best-effort; falls back to coords).
async function reverseGeocode(lat, lng) {
  try {
    const r = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GMAPS_KEY}&language=en&region=IN`)
    const d = await r.json()
    if (d.results?.[0]) return d.results[0].formatted_address
  } catch {}
  return `${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}`
}

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
            {unread>0&&<button onClick={markAllRead} style={{fontSize:11,color:'#6b7280',background:'none',border:'none',cursor:'pointer',fontWeight:600}}>Mark all read</button>}
            {notifs.some(n=>n.is_read)&&<button onClick={clearRead} style={{fontSize:11,color:'#ef4444',background:'none',border:'none',cursor:'pointer',fontWeight:600}}>Clear</button>}
            <button onClick={onClose} style={{background:'none',border:'none',fontSize:20,cursor:'pointer',color:'#6b7280'}}>✕</button>
          </div>
        </div>
        <div style={{overflowY:'auto',flex:1,padding:'8px 0'}}>
          {loading&&<div style={{textAlign:'center',padding:32,color:'#9ca3af',fontSize:14}}>⏳ Loading…</div>}
          {!loading&&notifs.length===0&&(
            <div style={{textAlign:'center',padding:48}}>
              <div style={{fontSize:40,marginBottom:8}}>🔕</div>
              <div style={{fontSize:14,color:'#9ca3af'}}>No notifications yet</div>
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
            {item.image_url ? (
              <img
                src={item.image_url}
                alt={item.name}
                loading="lazy"
                style={{
                  width: '100%', height: '100%', objectFit: 'cover',
                  animation: 'itemImgIn 0.4s ease',
                  filter: isSoldOut ? 'grayscale(60%) brightness(0.75)' : 'none',
                }}
                onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }}
              />
            ) : null}
            <div style={{
              width: '100%', height: '100%',
              display: item.image_url ? 'none' : 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 80,
              background: 'linear-gradient(135deg,#fff7ed,#fef3c7)',
            }}>🍛</div>
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
              ⚡ Only {item.stock_count} left — order soon!
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
                In cart · ₹{dp * qty} total
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
  const [fitnessLive, setFitnessLive] = useState(null) // null=unknown, true=live, false=coming soon
  const [showNotifDrawer, setShowNotifDrawer] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [kitchenPhone, setKitchenPhone] = useState(null)
  const [stockPopup, setStockPopup] = useState(null)   // { itemName, available }
  const [selectedItem, setSelectedItem] = useState(null) // item detail modal
  const [greetingBanner, setGreetingBanner] = useState(null) // time-based banner
  // ── Phase 3: branch-aware (location-gated) menu ──
  const [allBranches, setAllBranches] = useState([])
  const [globalMaxKm, setGlobalMaxKm] = useState(0)
  const [custLoc, setCustLoc]   = useState(null)   // { lat, lng, address }
  const [branchInfo, setBranchInfo] = useState(null) // serving/nearest branch
  const [freeDelInfo, setFreeDelInfo] = useState(null) // { freeMin, festival } for the badge/nudge
  const [servingBranches, setServingBranches] = useState([]) // all in-range outlets
  const [cartOutlet, setCartOutlet] = useState(null) // { id, name } current cart's outlet
  const [switchPrompt, setSwitchPrompt] = useState(null) // { itemId, branch } for outlet-switch confirm
  const [locResolved, setLocResolved] = useState(false)
  const [serviceable, setServiceable] = useState(true)   // geographically covered by some branch
  const [areaClosed, setAreaClosed] = useState(false)    // covered, but every nearby outlet is closed right now
  const [kitchenOpenTime, setKitchenOpenTime] = useState('') // global fallback opening time (e.g. "09:00")
  const [kitchenCloseTime, setKitchenCloseTime] = useState('') // global fallback closing time (e.g. "22:00")
  const [showLocGate, setShowLocGate] = useState(false)
  const [locBusy, setLocBusy] = useState(false)
  const [gateAddr, setGateAddr] = useState('')
  const [notifyState, setNotifyState] = useState('idle') // idle | saving | done
  const [notifyPhone, setNotifyPhone] = useState('')
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
    try { const o = JSON.parse(localStorage.getItem('ck_outlet') || 'null'); if (o?.id) setCartOutlet(o) } catch {}

    Promise.all([
      fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'me' }) }).then(r => r.json()),
      fetch('/api/menu').then(r => r.json()),
      fetch('/api/admin').then(r => r.json()),
      fetch('/api/admin?type=offers').then(r => r.json()),
      fetch('/api/ratings?type=menu').then(r => r.json()).catch(() => ({ itemRatings: {} })),
      fetch('/api/cart').then(r => r.json()).catch(() => ({ cart: {} })),
      fetch('/api/fitness').then(r => r.json()).catch(() => ({ cornerEnabled: false })),
      fetch('/api/public/branches').then(r => r.json()).catch(() => ({ branches: [] })),
    ]).then(([authData, menuData, settingsData, offersData, ratingsData, cartData, fitnessData, branchData]) => {
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
      setKitchenOpenTime(settingsData.settings?.open_time || '')
      setKitchenCloseTime(settingsData.settings?.close_time || '')
      setKitchenPhone(settingsData.settings?.phone || null)
      setOffers(offersData.offers || [])
      setItemRatings(ratingsData.itemRatings || {})
      setFitnessLive(!!fitnessData.cornerEnabled)
      const branches = branchData.branches || []
      const gKm = parseFloat(settingsData.settings?.max_delivery_km) || 0
      setAllBranches(branches)
      setGlobalMaxKm(gKm)
      setLoading(false)
      // Auto-detect the customer's location the moment the app opens (Phase 3).
      autoLocate(branches, gKm, authData.user)
    })
  }, [])

  // ── Phase 3: auto-detect location on open ───────────────────────────
  // 1) Instant: if we have a cached/saved location, apply it right away.
  // 2) Live: silently ask the device GPS and refine to the real position.
  // Only if we have NOTHING and GPS is unavailable/denied do we show the gate.
  const autoLocate = async (branches, gKm, authUser) => {
    let cached = null
    try {
      const c = JSON.parse(localStorage.getItem('ck_loc') || 'null')
      if (c && Number.isFinite(c.lat) && Number.isFinite(c.lng)) cached = c
    } catch {}
    if (!cached && authUser) {
      try {
        const ad = await fetch('/api/addresses').then(r => r.json())
        const list = ad.addresses || []
        const def = list.find(a => a.is_default) || list[0]
        if (def && def.lat != null && def.lng != null) {
          cached = { lat: parseFloat(def.lat), lng: parseFloat(def.lng), address: def.address_text }
        }
      } catch {}
    }
    // Show the cached/saved menu instantly so the screen is never empty.
    if (cached) applyLocation(cached, branches, gKm)

    // Then try live GPS in the background for an accurate fix.
    if (navigator.geolocation) {
      const onPos = async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        const address = await reverseGeocode(lat, lng)
        applyLocation({ lat, lng, address }, branches, gKm)
      }
      const onErr = () => { if (!cached) { setShowLocGate(true); setLocResolved(true) } }
      navigator.geolocation.getCurrentPosition(
        onPos,
        () => navigator.geolocation.getCurrentPosition(onPos, onErr, { enableHighAccuracy: false, timeout: 15000, maximumAge: 120000 }),
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
      )
    } else if (!cached) {
      setShowLocGate(true); setLocResolved(true)
    }
  }

  // Apply a location: find ALL in-range outlets and show their MERGED menu.
  // Same dish in two outlets → keep the cheaper one (nearest breaks ties).
  // Every item is tagged with its outlet (_branchId/_branchName) so the cart
  // can keep an order to a single outlet.
  const applyLocation = async (loc, branches, gKm) => {
    const list = branches || allBranches
    const km = gKm != null ? gKm : globalMaxKm
    setCustLoc(loc)
    try { localStorage.setItem('ck_loc', JSON.stringify(loc)) } catch {}
    setNotifyState('idle')

    // Step 1 — GEOGRAPHY only: which branches' delivery zone covers this spot?
    // (open/closed ignored here, so a covered customer is never told we're absent)
    const geoServing = findServingBranches(list, loc.lat, loc.lng, km)

    // State C — truly outside every branch's range.
    if (!geoServing.length) {
      const nearest = findNearestBranchClient(list, loc.lat, loc.lng, km)
      setServiceable(false)
      setAreaClosed(false)
      setServingBranches([])
      setBranchInfo(nearest ? { name: nearest.name, dist: nearest.dist } : null)
      setShowLocGate(false)
      setLocResolved(true)
      return
    }

    // Step 2 — among the covering branches, which are OPEN right now?
    const openServing = geoServing.filter(b => b.open_now !== false)
    setServiceable(true)
    setShowLocGate(false)
    setLocResolved(true)

    // State B — covered, but every nearby outlet is closed right now.
    // Still show the menu (browse-only) so the customer sees we're in their area.
    const areaIsClosed = openServing.length === 0
    setAreaClosed(areaIsClosed)
    const menuSource = areaIsClosed ? geoServing : openServing
    setServingBranches(menuSource)
    setBranchInfo({ id: menuSource[0].id, name: menuSource[0].name, dist: menuSource[0].dist, count: menuSource.length, openTime: menuSource[0].opening_time || '', closeTime: menuSource[0].closing_time || '' })

    // Fetch each outlet's own menu, then merge (cheapest wins).
    try {
      const menus = await Promise.all(
        menuSource.map(b =>
          fetch(`/api/menu?branch_id=${b.id}`).then(r => r.json())
            .then(d => ({ branch: b, items: d.items || [] }))
            .catch(() => ({ branch: b, items: [] }))
        )
      )
      const merged = new Map()
      // serving is nearest-first, so on a price tie the nearer outlet is kept.
      for (const { branch, items } of menus) {
        for (const it of items) {
          const tagged = { ...it, _branchId: branch.id, _branchName: branch.name }
          const prev = merged.get(it.id)
          if (!prev || Number(it.price) < Number(prev.price)) merged.set(it.id, tagged)
        }
      }
      setMenuItems([...merged.values()])
    } catch {}
    // Free-delivery threshold for this location (for the menu badge + nudge).
    try {
      const dd = await fetch(`/api/distance?lat=${loc.lat}&lng=${loc.lng}`).then(r => r.json())
      if (dd && !dd.error) setFreeDelInfo({ freeMin: dd.freeDeliveryMin, festival: !!dd.festival, base: dd.deliveryBase })
    } catch {}
  }

  // Gate action: use device GPS to set the location.
  const useGateGPS = () => {
    if (!navigator.geolocation) { alert('GPS is not supported — please enter your address instead.'); return }
    setLocBusy(true)
    const ok = async (pos) => {
      const { latitude: lat, longitude: lng } = pos.coords
      const address = await reverseGeocode(lat, lng)
      await applyLocation({ lat, lng, address }, allBranches, globalMaxKm)
      setLocBusy(false)
    }
    const fail = () => {
      setLocBusy(false)
      alert('Couldn\'t get your location. Turn on location permission, or enter your address below.')
    }
    navigator.geolocation.getCurrentPosition(
      ok,
      () => navigator.geolocation.getCurrentPosition(ok, fail, { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  }

  // Gate action: geocode a typed address.
  const useGateAddress = async () => {
    const q = gateAddr.trim()
    if (!q) return
    setLocBusy(true)
    try {
      const r = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q)}&key=${GMAPS_KEY}&region=IN`)
      const d = await r.json()
      const g = d.results?.[0]?.geometry?.location
      if (g) {
        await applyLocation({ lat: g.lat, lng: g.lng, address: d.results[0].formatted_address }, allBranches, globalMaxKm)
      } else {
        alert('We couldn\'t find that address. Add more detail (area, city).')
      }
    } catch { alert('Couldn\'t verify the address. Please try again.') }
    setLocBusy(false)
  }

  // Let the customer change their location again (reopen the gate).
  const changeLocation = () => { setServiceable(true); setShowLocGate(true) }

  // Notify-me: save a retention lead — either "tell me when this area opens"
  // (covered but closed) or "tell me when you launch here" (out of area).
  const submitNotify = async (kind) => {
    const phone = (notifyPhone || '').trim()
    // Guests must give a number; logged-in users are identified by their account
    // (the server links the lead to their user_id → phone) so it's optional.
    if (!phone && !user?.id) { alert('Please enter your mobile number.'); return }
    setNotifyState('saving')
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind, phone,
          lat: custLoc?.lat, lng: custLoc?.lng, address: custLoc?.address,
          branch_id: branchInfo?.id || null,
        }),
      })
      if (res.ok) setNotifyState('done')
      else { setNotifyState('idle'); alert('Could not save — please try again.') }
    } catch { setNotifyState('idle'); alert('Network error — please try again.') }
  }

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

  // Remember which outlet the current cart belongs to (one outlet per order).
  const setOutlet = (branch) => {
    setCartOutlet(branch)
    try {
      if (branch?.id) localStorage.setItem('ck_outlet', JSON.stringify(branch))
      else localStorage.removeItem('ck_outlet')
    } catch {}
  }

  const addItem = (id) => {
    if (!orderOpen) return
    const item = menuItems.find(m => m.id === id)
    if (!item) return
    const itemBranch = item._branchId ? { id: item._branchId, name: item._branchName } : null
    // One outlet per order: if cart already has another outlet's items, confirm switch.
    if (itemBranch && Object.keys(cart).length > 0 && cartOutlet?.id && cartOutlet.id !== itemBranch.id) {
      setSwitchPrompt({ itemId: id, branch: itemBranch })
      return
    }
    const currentQty = cart[id] || 0
    // Stock limit check — only if stock_count is set (not null)
    if (item.stock_count !== null && item.stock_count !== undefined) {
      if (currentQty >= item.stock_count) {
        setStockPopup({ itemName: item.name, available: item.stock_count })
        return
      }
    }
    const nc = { ...cart, [id]: currentQty + 1 }
    saveCart(nc)
    if (itemBranch && !cartOutlet?.id) setOutlet(itemBranch)
  }

  // Clear the cart and start fresh at the new outlet (from the switch prompt).
  const confirmSwitch = () => {
    if (!switchPrompt) return
    const { itemId, branch } = switchPrompt
    saveCart({ [itemId]: 1 })
    setOutlet(branch)
    setSwitchPrompt(null)
  }

  const removeItem = (id) => {
    const nc = { ...cart }
    if (nc[id] > 1) nc[id]--
    else delete nc[id]
    saveCart(nc)
    if (Object.keys(nc).length === 0) setOutlet(null)
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

  // Live cart subtotal + how much more for FREE delivery (for the cart-bar nudge).
  const menuSubtotal = Object.entries(cart).reduce((a, [id, qty]) => {
    const it = menuItems.find(m => m.id === id); return it ? a + discPrice(it) * qty : a
  }, 0)
  const freeDelGap = (freeDelInfo && !freeDelInfo.festival && freeDelInfo.freeMin > 0 && menuSubtotal > 0 && menuSubtotal < freeDelInfo.freeMin)
    ? Math.ceil(freeDelInfo.freeMin - menuSubtotal) : 0

  // ⭐ Most Ordered — curated from real order history (top sellers). Only the
  // ones actually on the current menu show up; update this list as sales shift.
  const BESTSELLER_NAMES = ['Rajma Rice Bowl', 'Classic Chole Rice', 'Paneer Chola Rice', 'Matar Chola Rice', '5 Roti with Chole']
  const _norm = s => String(s || '').trim().toLowerCase()
  const bestSellers = BESTSELLER_NAMES
    .map(n => menuItems.find(m => _norm(m.name) === _norm(n)))
    .filter(Boolean)

  // ⭐ Overall rating from REAL per-item ratings (no fabricated numbers)
  const ratingAgg = (() => {
    let count = 0, weighted = 0
    for (const r of Object.values(itemRatings)) {
      if (r?.count > 0) { count += r.count; weighted += r.avg * r.count }
    }
    return count > 0 ? { avg: weighted / count, count } : null
  })()

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

  // Ordering is allowed only when the global kitchen is open AND the customer's
  // covering outlet is open right now (State B = covered-but-closed disables it).
  const orderOpen = kitchenOpen && !areaClosed

  // Distinguish WHY it's closed so the copy never lies:
  //  • outside operating hours  → "opens at {time}" (scheduled)
  //  • inside operating hours but the outlet toggled itself off → "closed for
  //    today" (a manual day-off — don't promise a reopen time).
  const _openTime  = branchInfo?.openTime  || kitchenOpenTime
  const _closeTime = branchInfo?.closeTime || kitchenCloseTime
  const _toMin = (s) => { if (!s) return null; const [h, m] = String(s).split(':').map(Number); return Number.isFinite(h) ? h * 60 + (m || 0) : null }
  const _nowMin = (() => { const d = new Date(); return d.getHours() * 60 + d.getMinutes() })()
  const _oM = _toMin(_openTime), _cM = _toMin(_closeTime)
  const withinHours = (_oM != null && _cM != null)
    ? (_cM > _oM ? (_nowMin >= _oM && _nowMin < _cM) : (_nowMin >= _oM || _nowMin < _cM)) // handles past-midnight close
    : false
  const closedForToday = areaClosed && withinHours // off despite being within hours = manual day-off

  return (
    <div className={styles.page}>

      {/* ── Phase 3: Location bar (Blinkit-style) — shows serving branch ── */}
      {serviceable && custLoc && !showLocGate && (
        <div
          onClick={changeLocation}
          style={{
            display:'flex', alignItems:'center', gap:8, padding:'8px 14px',
            background:'#fff7ed', borderBottom:'1px solid #fed7aa', cursor:'pointer',
            position:'sticky', top:0, zIndex:50,
          }}>
          <span style={{ fontSize:16 }}>📍</span>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:11, color:'#9a3412', fontWeight:700, lineHeight:1.1 }}>
              {areaClosed ? 'You\'re in our delivery area' : (branchInfo?.count > 1 ? `${branchInfo.count} outlets near you` : 'Delivering to')}{branchInfo?.dist != null ? ` · ${branchInfo.dist.toFixed(1)} km` : ''}
            </div>
            <div style={{ fontSize:12, color:'#1a1a1a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {custLoc.address || 'Aapki location'}
            </div>
          </div>
          <span style={{ fontSize:11, fontWeight:700, color:'#e85d04', flexShrink:0 }}>Change ▾</span>
        </div>
      )}

      {/* ── State B: covered but CLOSED right now — never a dead-end.
             Show the menu below (browse) + this banner with a "notify me" CTA. ── */}
      {serviceable && areaClosed && !showLocGate && (
        <div style={{ background:'#fffbeb', borderBottom:'1px solid #fde68a', padding:'14px 16px' }}>
          <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
            <span style={{ fontSize:22, lineHeight:1 }}>😴</span>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:14, fontWeight:800, color:'#78350f' }}>
                {closedForToday
                  ? 'Closed for today'
                  : `We’re closed right now${_openTime ? ` — opens at ${_openTime}` : ''}`}
              </div>
              <div style={{ fontSize:12, color:'#92400e', marginTop:2 }}>
                {closedForToday
                  ? <>The kitchen is off for today, but <strong>you&apos;re in our delivery area.</strong> Browse the menu, and we&apos;ll message you the moment we reopen.</>
                  : <>Good news — <strong>you&apos;re in our delivery area!</strong> Browse the menu below, and we&apos;ll ping you the moment we open.</>}
              </div>
              {notifyState === 'done' ? (
                <div style={{ marginTop:10, fontSize:13, fontWeight:700, color:'#15803d' }}>✅ Done! We&apos;ll notify you when we open.</div>
              ) : (
                <div style={{ marginTop:10, display:'flex', gap:8, flexWrap:'wrap' }}>
                  {!user?.id && (
                    <input value={notifyPhone} onChange={e => setNotifyPhone(e.target.value)}
                      placeholder="Your mobile number" inputMode="numeric"
                      style={{ flex:'1 1 150px', minWidth:0, padding:'9px 11px', border:'1px solid #fcd34d', borderRadius:9, fontSize:13, outline:'none' }} />
                  )}
                  <button onClick={() => submitNotify('closed')} disabled={notifyState === 'saving'}
                    style={{ padding:'9px 16px', borderRadius:9, border:'none', background:'#d97706', color:'#fff', fontSize:13, fontWeight:800, cursor:'pointer', opacity: notifyState === 'saving' ? 0.6 : 1 }}>
                    {notifyState === 'saving' ? 'Saving…' : (closedForToday ? '🔔 Notify me when it reopens' : '🔔 Notify me when open')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Free-delivery badge (delivery-as-offer) ── */}
      {serviceable && !areaClosed && !showLocGate && freeDelInfo && (freeDelInfo.festival || (freeDelInfo.freeMin > 0)) && (
        <div style={{ background: freeDelInfo.festival ? '#16a34a' : '#fff7ed', color: freeDelInfo.festival ? '#fff' : '#9a3412', textAlign:'center', padding:'7px 12px', fontSize:12.5, fontWeight:700, borderBottom: freeDelInfo.festival ? 'none' : '1px solid #fed7aa' }}>
          {freeDelInfo.festival
            ? '🎉 Free Delivery Festival — sab orders pe FREE delivery!'
            : `🛵 FREE delivery on orders over ₹${freeDelInfo.freeMin}`}
        </div>
      )}

      {/* ── Location Gate — ask for location before showing the menu ── */}
      {showLocGate && (
        <div style={{ position:'fixed', inset:0, zIndex:100000, background:'rgba(0,0,0,0.6)', backdropFilter:'blur(4px)', display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
          <div style={{ background:'#fff', borderRadius:'24px 24px 0 0', width:'100%', maxWidth:480, padding:'26px 22px 40px', animation:'slideUpSheet 0.38s cubic-bezier(0.34,1.1,0.64,1)' }}>
            <div style={{ width:40, height:4, background:'#e5e7eb', borderRadius:4, margin:'0 auto 20px' }} />
            <div style={{ textAlign:'center', marginBottom:20 }}>
              <div style={{ fontSize:42, marginBottom:6 }}>📍</div>
              <h2 style={{ fontSize:19, fontWeight:800, color:'#1a1a1a', margin:'0 0 6px' }}>Set your location</h2>
              <p style={{ fontSize:13, color:'#6b7280', margin:0 }}>So we can show the right menu, prices and stock for your area.</p>
            </div>
            <button onClick={useGateGPS} disabled={locBusy}
              style={{ width:'100%', padding:'13px', borderRadius:12, border:'none', background:'#e85d04', color:'#fff', fontSize:15, fontWeight:700, cursor:'pointer', marginBottom:14, opacity: locBusy?0.7:1 }}>
              {locBusy ? 'Getting your location…' : '🎯 Use my current location'}
            </button>
            <div style={{ display:'flex', alignItems:'center', gap:8, margin:'4px 0 12px' }}>
              <div style={{ flex:1, height:1, background:'#e5e7eb' }} />
              <span style={{ fontSize:11, color:'#9ca3af' }}>OR ENTER ADDRESS</span>
              <div style={{ flex:1, height:1, background:'#e5e7eb' }} />
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <input
                value={gateAddr} onChange={e => setGateAddr(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') useGateAddress() }}
                placeholder="Area, city — e.g. Boring Road, Patna"
                style={{ flex:1, padding:'11px 12px', border:'1px solid #e5e7eb', borderRadius:10, fontSize:13, outline:'none' }}
              />
              <button onClick={useGateAddress} disabled={locBusy || !gateAddr.trim()}
                style={{ padding:'0 16px', borderRadius:10, border:'none', background:'#1a1a1a', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', opacity:(locBusy||!gateAddr.trim())?0.5:1 }}>Go</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Not serviceable — location is outside every branch's range ── */}
      {locResolved && !serviceable && !showLocGate && (
        <div style={{ position:'fixed', inset:0, zIndex:100000, background:'#fff', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'32px 24px', textAlign:'center' }}>
          <div style={{ fontSize:60, marginBottom:14 }}>🚀</div>
          <h2 style={{ fontSize:21, fontWeight:800, color:'#1a1a1a', margin:'0 0 8px' }}>We&apos;re not in your area yet</h2>
          <p style={{ fontSize:14, color:'#6b7280', margin:'0 0 4px', maxWidth:340 }}>
            {branchInfo?.dist != null ? `Our nearest kitchen is ${branchInfo.dist.toFixed(1)} km away` : 'Your location is outside our current delivery range'} — but we&apos;re expanding fast!
          </p>
          <p style={{ fontSize:13, color:'#9ca3af', margin:'0 0 20px', maxWidth:340 }}>
            Leave your number and we&apos;ll be the first to tell you when we launch in your area.
          </p>

          {notifyState === 'done' ? (
            <div style={{ fontSize:15, fontWeight:800, color:'#15803d', marginBottom:22 }}>
              🎉 You&apos;re on the list! We&apos;ll notify you the moment we reach you.
            </div>
          ) : (
            <div style={{ width:'100%', maxWidth:340, marginBottom:20 }}>
              {!user?.id && (
                <input value={notifyPhone} onChange={e => setNotifyPhone(e.target.value)}
                  placeholder="Your mobile number" inputMode="numeric"
                  style={{ width:'100%', padding:'12px 14px', border:'1px solid #e5e7eb', borderRadius:11, fontSize:14, outline:'none', marginBottom:10, boxSizing:'border-box' }} />
              )}
              <button onClick={() => submitNotify('out_of_area')} disabled={notifyState === 'saving'}
                style={{ width:'100%', padding:'13px', borderRadius:12, border:'none', background:'#16a34a', color:'#fff', fontSize:15, fontWeight:800, cursor:'pointer', opacity: notifyState === 'saving' ? 0.6 : 1 }}>
                {notifyState === 'saving' ? 'Saving…' : '🔔 Notify me when you launch here'}
              </button>
            </div>
          )}

          <button onClick={changeLocation}
            style={{ padding:'11px 24px', borderRadius:12, border:'1px solid #e5e7eb', background:'#fff', color:'#374151', fontSize:14, fontWeight:700, cursor:'pointer' }}>
            📍 Try another location
          </button>
        </div>
      )}

      {/* ── Outlet switch confirm (one outlet per order) ── */}
      {switchPrompt && (
        <div style={{ position:'fixed', inset:0, zIndex:100001, background:'rgba(0,0,0,0.6)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
          onClick={e => { if (e.target === e.currentTarget) setSwitchPrompt(null) }}>
          <div style={{ background:'#fff', borderRadius:20, width:'100%', maxWidth:380, padding:'26px 22px', textAlign:'center' }}>
            <div style={{ fontSize:40, marginBottom:10 }}>🛍️</div>
            <h3 style={{ fontSize:18, fontWeight:800, color:'#1a1a1a', margin:'0 0 8px' }}>Switch to another outlet?</h3>
            <p style={{ fontSize:13, color:'#6b7280', margin:'0 0 20px' }}>
              Your cart has items from <strong>{cartOutlet?.name}</strong>. An order can only be from one outlet — switching to <strong>{switchPrompt.branch.name}</strong> will empty your cart.
            </p>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setSwitchPrompt(null)}
                style={{ flex:1, padding:'12px', borderRadius:12, border:'1px solid #e5e7eb', background:'#fff', color:'#374151', fontSize:14, fontWeight:700, cursor:'pointer' }}>Keep cart</button>
              <button onClick={confirmSwitch}
                style={{ flex:1, padding:'12px', borderRadius:12, border:'none', background:'#e85d04', color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer' }}>Clear &amp; switch</button>
            </div>
          </div>
        </div>
      )}

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
              <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1a1a1a', margin: '0 0 6px' }}>Welcome to FoodFi!</h2>
              <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>Just tell us your name to start ordering — you can add your address later.</p>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>
                Your Name <span style={{ color: '#e85d04' }}>*</span>
              </label>
              <input
                ref={welcomeNameRef}
                type="text"
                value={welcomeName}
                onChange={e => setWelcomeName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveWelcomeInfo()}
                placeholder="e.g. Rahul Kumar"
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
                placeholder="Home / office address…"
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
              {welcomeSaving ? <><span className="spinner" /> Saving…</> : 'Let\'s go! 🍛'}
            </button>
          </div>
        </div>
      )}

      {/* Navbar */}
      <nav className={styles.nav} style={isGuest ? { marginTop: 44 } : {}}>
        <span className={styles.logo}>🍽️ <span style={{color:'#e85d04'}}>Food</span>Fi</span>
        <div className={styles.navRight}>
          <span className={`${styles.kitchenBadge} ${orderOpen ? styles.open : styles.closed}`}>
            <span className={styles.dot} /> {orderOpen ? 'Open' : 'Closed'}
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
          {/* Install button — always visible (navbar me hona chahiye) */}
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
            <div style={{ fontSize:13, fontWeight:700 }}>📱 Install the FoodFi App</div>
            <div style={{ fontSize:11, color:'#fed7aa' }}>Add to your home screen for faster ordering!</div>
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
            <div style={{ fontSize:13, fontWeight:700 }}>📱 Install the FoodFi App</div>
            <div style={{ fontSize:11, color:'#fed7aa' }}>Tap here for a step-by-step guide</div>
          </div>
          <div style={{ display:'flex', gap:8, flexShrink:0 }}>
            <button onClick={(e) => { e.stopPropagation(); setShowIOSModal(true) }}
              style={{ background:'#e85d04', color:'#fff', border:'none', borderRadius:8, padding:'6px 14px', fontSize:12, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>
              How? 👆
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
              <h3 style={{ fontSize:18, fontWeight:800, color:'#1a1a1a', margin:'8px 0 4px' }}>Install FoodFi</h3>
              <p style={{ fontSize:13, color:'#6b7280', margin:0 }}>Get an app-like experience on iPhone / iPad</p>
            </div>

            {/* Steps */}
            {[
              { num:'1', icon:'⬆️', title:'Tap the Share button', desc:'In Safari — the box with an up-arrow (↑) icon on the right of the address bar.' },
              { num:'2', icon:'📋', title:'Select "Add to Home Screen"', desc:'Scroll down and tap the "Add to Home Screen" option.' },
              { num:'3', icon:'✅', title:'Tap "Add"', desc:'Confirm the name and tap "Add" at the top right — that\'s it!' },
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
              <span style={{ fontSize:12, color:'#92400e' }}>The Share button (↑) sits to the right of the address bar — <strong>scroll the page a little</strong> and the address bar will appear.</span>
            </div>

            <button onClick={() => setShowIOSModal(false)}
              style={{ width:'100%', background:'#e85d04', color:'#fff', border:'none', borderRadius:12, padding:'14px', fontSize:15, fontWeight:700, cursor:'pointer' }}>
              Got it — Close ✓
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

      {/* ⭐ Trust badge — real aggregate rating (only when enough reviews) */}
      {ratingAgg && ratingAgg.count >= 3 && (
        <div style={{ margin: '0 16px 10px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ display:'inline-flex', alignItems:'center', gap:5, background:'#fffbeb', border:'1px solid #fde68a', borderRadius:20, padding:'5px 12px', fontSize:13, fontWeight:700, color:'#92400e' }}>
            ⭐ {ratingAgg.avg.toFixed(1)} <span style={{ fontWeight:500, color:'#b45309' }}>· {ratingAgg.count} reviews</span>
          </span>
          <span style={{ display:'inline-flex', alignItems:'center', gap:5, background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:20, padding:'5px 12px', fontSize:13, fontWeight:700, color:'#15803d' }}>
            🍳 Freshly cooked
          </span>
        </div>
      )}

      {/* 🥗 Fitness Freak Corner entry banner */}
      <div onClick={() => router.push('/fitness')} style={{ margin:'0 16px 12px', background:'linear-gradient(135deg,#065f46,#10b981)', borderRadius:16, padding:'14px 16px', display:'flex', alignItems:'center', gap:12, cursor:'pointer', boxShadow:'0 4px 16px #05966733' }}>
        <div style={{ fontSize:30, flexShrink:0 }}>🥗</div>
        <div style={{ flex:1, color:'#fff' }}>
          <div style={{ fontSize:15, fontWeight:800, display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
            Fitness Freak Corner
            {fitnessLive === false && <span style={{ background:'#fbbf24', color:'#7c2d12', fontSize:9.5, fontWeight:800, padding:'2px 7px', borderRadius:20 }}>COMING SOON</span>}
            {fitnessLive === true && <span style={{ background:'#bbf7d0', color:'#065f46', fontSize:9.5, fontWeight:800, padding:'2px 7px', borderRadius:20 }}>● LIVE</span>}
          </div>
          <div style={{ fontSize:11.5, opacity:0.92, marginTop:2 }}>High-protein healthy meals · with calories & macros 💪</div>
        </div>
        <div style={{ color:'#fff', fontSize:22, flexShrink:0 }}>›</div>
      </div>

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

      {/* ⭐ Most Ordered strip — social proof, only on default view */}
      {activeCategory === 'All' && !searchQ && bestSellers.length > 0 && (
        <div style={{ margin: '4px 0 14px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, padding:'0 4px', marginBottom:10 }}>
            <span style={{ fontSize:18, fontWeight:800, color:'#b45309' }}>⭐ Most Ordered</span>
            <span style={{ fontSize:11, fontWeight:800, color:'#92400e', background:'#fef3c7', padding:'3px 9px', borderRadius:20 }}>Highly reordered</span>
          </div>
          <div style={{ display:'flex', gap:12, overflowX:'auto', padding:'2px 4px 8px', WebkitOverflowScrolling:'touch' }}>
            {bestSellers.map(item => {
              const isSoldOut = item.stock_count !== null && item.stock_count !== undefined && item.stock_count === 0
              const dp = discPrice(item)
              return (
                <div key={item.id} onClick={() => setSelectedItem(item)}
                  style={{ flex:'0 0 auto', width:150, background:'#fff', borderRadius:14, boxShadow:'0 2px 10px #0000000f', overflow:'hidden', cursor:'pointer', border:'1px solid #fde68a' }}>
                  <div style={{ position:'relative', width:'100%', height:100, background:'#fff7ed' }}>
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.name} loading="lazy"
                        style={{ width:'100%', height:'100%', objectFit:'cover', filter: isSoldOut ? 'grayscale(60%) brightness(0.8)' : 'none' }}
                        onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='flex' }} />
                    ) : null}
                    <div style={{ display:item.image_url?'none':'flex', alignItems:'center', justifyContent:'center', width:'100%', height:'100%', fontSize:44 }}>🍛</div>
                    <span style={{ position:'absolute', top:6, left:6, background:'#f59e0b', color:'#fff', fontSize:10, fontWeight:800, padding:'2px 6px', borderRadius:6 }}>⭐ Bestseller</span>
                    {isSoldOut && <div style={{ position:'absolute', inset:0, background:'#00000066', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:700, fontSize:13 }}>Sold Out</div>}
                  </div>
                  <div style={{ padding:'8px 10px 10px' }}>
                    <div style={{ fontSize:13, fontWeight:700, color:'#1f2937', lineHeight:1.25, height:32, overflow:'hidden' }}>{item.name}</div>
                    <div style={{ display:'flex', alignItems:'baseline', gap:6, marginTop:6 }}>
                      <span style={{ fontSize:15, fontWeight:800, color:'#1a1a1a' }}>₹{dp}</span>
                      {item.discount_percent > 0 && <span style={{ fontSize:11, color:'#9ca3af', textDecoration:'line-through' }}>₹{Math.round(item.price)}</span>}
                    </div>
                    {!isSoldOut && orderOpen && (
                      <button onClick={e => { e.stopPropagation(); addItem(item.id) }}
                        style={{ marginTop:8, width:'100%', background:'var(--or)', color:'#fff', border:'none', borderRadius:8, padding:'6px 0', fontSize:12, fontWeight:700, cursor:'pointer' }}>
                        + Add
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}


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
                  {!isSoldOut && !orderOpen && (
                    <span style={{ fontSize:10, background:'#fef3c7', color:'#92400e', borderRadius:6, padding:'1px 6px', fontWeight:700, whiteSpace:'nowrap' }}>🔒 Closed</span>
                  )}
                  {!isSoldOut && orderOpen && itemRatings[item.id]?.avg >= 4.5 && itemRatings[item.id]?.count >= 3 && (
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
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.name} loading="lazy"
                      className={`${styles.foodImg} ${isSoldOut ? styles.imgSoldOut : ''}`}
                      onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }} />
                  ) : null}
                  <div className={`${styles.foodEmoji} ${isSoldOut ? styles.imgSoldOut : ''}`}
                    style={{ display: item.image_url ? 'none' : 'flex' }}>🍛</div>
                  {isSoldOut && (
                    <div className={styles.soldOutBadge}><span>Sold Out</span></div>
                  )}
                </div>

                {/* Floating action pill — overhangs the image (Swiggy-style).
                    stopPropagation so tapping it doesn't open the item modal. */}
                <div className={styles.cardAction} onClick={e => e.stopPropagation()}>
                  {isSoldOut ? (
                    <button className={styles.soldOutBtn} disabled>Sold Out</button>
                  ) : !orderOpen ? (
                    <button className={styles.closedBtn} disabled>🔒 Closed</button>
                  ) : qty === 0 ? (
                    <button className={styles.addBtn} onClick={() => addItem(item.id)}>ADD</button>
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
        <div>
          {freeDelGap > 0 && (
            <div style={{ background:'#9a3412', color:'#fff', textAlign:'center', fontSize:12, fontWeight:600, padding:'5px 12px' }}>
              🎉 Add ₹{freeDelGap} more for FREE delivery!
            </div>
          )}
          {freeDelInfo?.festival && (
            <div style={{ background:'#16a34a', color:'#fff', textAlign:'center', fontSize:12, fontWeight:700, padding:'5px 12px' }}>
              🎉 FREE delivery on this order!
            </div>
          )}
          <div className={styles.cartBar}>
            <span>{cartCount} item{cartCount > 1 ? 's' : ''} in cart</span>
            <button className="btn btn-primary" onClick={() => router.push('/cart')}>
              View Cart →
            </button>
          </div>
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
          <span style={{ fontWeight: 600 }}>👀 Guest mode — browse freely, log in to order</span>
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
          kitchenOpen={orderOpen}
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

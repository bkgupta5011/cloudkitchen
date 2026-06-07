'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { usePushNotifications } from '@/lib/usePush'
import { usePWAInstall } from '@/lib/usePWAInstall'

// ── Helpers ──────────────────────────────────────────────────────────
const pf = (v, fb = 0) => { const n = parseFloat(v); return isNaN(n) ? fb : n }

const STATUS_CONFIG = {
  pending:          { label: '⏳ Kitchen confirmation ka wait kar raho...', color: '#d97706', bg: '#fffbeb', next: null },
  confirmed:        { label: '🍳 Kitchen me hai — pickup karo', color: '#3b82f6', bg: '#eff6ff', next: 'pickup' },
  preparing:        { label: '👨‍🍳 Ban raha hai — thoda wait karo', color: '#8b5cf6', bg: '#f5f3ff', next: 'pickup' },
  out_for_delivery: { label: '🛵 Raste me hai — deliver karo', color: '#e85d04', bg: '#fff7ed', next: 'deliver' },
}

// ── iOS Install Guide Modal ───────────────────────────────────────────
function IOSInstallModal({ onClose }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'#00000088', zIndex:9999, display:'flex', alignItems:'flex-end', justifyContent:'center' }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        style={{ background:'#fff', borderRadius:'20px 20px 0 0', width:'100%', maxWidth:480, padding:'24px 20px 40px', boxShadow:'0 -4px 32px #0003' }}>
        <div style={{ width:40, height:4, background:'#e5e7eb', borderRadius:4, margin:'0 auto 20px' }} />
        <div style={{ textAlign:'center', marginBottom:20 }}>
          <div style={{ fontSize:36 }}>🛵</div>
          <h3 style={{ fontSize:18, fontWeight:800, color:'#1a1a1a', margin:'8px 0 4px' }}>Delivery App Install Karo</h3>
          <p style={{ fontSize:13, color:'#6b7280', margin:0 }}>iPhone pe App jaisi feel ke liye</p>
        </div>
        {[
          { num:'1', icon:'⬆️', title:'Share Button Dabaao', desc:'Safari mein address bar ke right side mein box + arrow (↑) icon dabaao' },
          { num:'2', icon:'📋', title:'"Add to Home Screen" Select Karo', desc:'Neeche scroll karo — "Add to Home Screen" pe tap karo' },
          { num:'3', icon:'✅', title:'"Add" Pe Tap Karo', desc:'Name confirm karke upar "Add" button dabaao — done!' },
        ].map(s => (
          <div key={s.num} style={{ display:'flex', gap:14, marginBottom:16, alignItems:'flex-start' }}>
            <div style={{ width:36, height:36, borderRadius:'50%', background:'#16a34a', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:14, flexShrink:0 }}>{s.num}</div>
            <div>
              <div style={{ fontSize:14, fontWeight:700, color:'#1a1a1a' }}>{s.icon} {s.title}</div>
              <div style={{ fontSize:12, color:'#6b7280', marginTop:3, lineHeight:1.5 }}>{s.desc}</div>
            </div>
          </div>
        ))}
        <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:12, padding:'10px 14px', marginBottom:16, display:'flex', gap:10, alignItems:'center' }}>
          <span style={{ fontSize:20 }}>💡</span>
          <span style={{ fontSize:12, color:'#166534' }}>Share button (↑) address bar ke right mein hota hai — <strong>page scroll karo</strong>, bar visible ho jayega</span>
        </div>
        <button onClick={onClose}
          style={{ width:'100%', background:'#16a34a', color:'#fff', border:'none', borderRadius:12, padding:'14px', fontSize:15, fontWeight:700, cursor:'pointer' }}>
          Samajh Gaya ✓
        </button>
      </div>
    </div>
  )
}

// ── Install Banner ────────────────────────────────────────────────────
function InstallBanner({ onInstall, isIOS, onDismiss }) {
  if (isIOS) return (
    <div onClick={onInstall}
      style={{ background:'#052e16', color:'#fff', padding:'10px 16px', display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, cursor:'pointer' }}>
      <div>
        <div style={{ fontSize:13, fontWeight:700 }}>📱 Delivery App Install Karo</div>
        <div style={{ fontSize:11, color:'#86efac' }}>Step by step guide ke liye tap karo</div>
      </div>
      <div style={{ display:'flex', gap:8 }}>
        <button onClick={(e)=>{ e.stopPropagation(); onInstall() }}
          style={{ background:'#22c55e', color:'#fff', border:'none', borderRadius:8, padding:'6px 12px', fontSize:12, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>
          Kaise? 👆
        </button>
        <button onClick={(e)=>{ e.stopPropagation(); onDismiss() }}
          style={{ background:'none', border:'none', color:'#86efac', fontSize:18, cursor:'pointer' }}>✕</button>
      </div>
    </div>
  )
  return (
    <div style={{ background:'#052e16', color:'#fff', padding:'10px 16px', display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
      <div>
        <div style={{ fontSize:13, fontWeight:700 }}>📱 Delivery App Install Karo</div>
        <div style={{ fontSize:11, color:'#86efac' }}>Home screen pe add karo — faster access</div>
      </div>
      <div style={{ display:'flex', gap:8 }}>
        <button onClick={onInstall}
          style={{ background:'#22c55e', color:'#fff', border:'none', borderRadius:8, padding:'6px 14px', fontSize:12, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>
          Install ⬇️
        </button>
        <button onClick={onDismiss} style={{ background:'none', border:'none', color:'#86efac', fontSize:18, cursor:'pointer' }}>✕</button>
      </div>
    </div>
  )
}

// ── Android Notification Guide Modal ─────────────────────────────────
function NotifGuideModal({ onClose }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'#00000088', zIndex:9998, display:'flex', alignItems:'flex-end', justifyContent:'center' }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        style={{ background:'#fff', borderRadius:'20px 20px 0 0', width:'100%', maxWidth:480, padding:'24px 20px 40px', maxHeight:'85vh', overflowY:'auto' }}>
        <div style={{ width:40, height:4, background:'#e5e7eb', borderRadius:4, margin:'0 auto 20px' }} />
        <div style={{ textAlign:'center', marginBottom:18 }}>
          <div style={{ fontSize:36 }}>📳</div>
          <h3 style={{ fontSize:17, fontWeight:800, color:'#1a1a1a', margin:'8px 0 4px' }}>Phone pe Popup + Ring Enable Karo</h3>
          <p style={{ fontSize:13, color:'#6b7280', margin:0 }}>Sirf ek baar ye settings karo — hamesha ke liye popup aayega</p>
        </div>

        {[
          { num:'1', icon:'⚙️', title:'Android Settings kholo', desc:'Phone ke Settings app mein jao' },
          { num:'2', icon:'📱', title:'Apps → Chrome', desc:'"Apps" ya "Application Manager" mein Chrome dhundho → tap karo' },
          { num:'3', icon:'🔔', title:'Notifications tap karo', desc:'Chrome ke andar "Notifications" option tap karo' },
          { num:'4', icon:'🌐', title:'FoodFi site dhundho', desc:`"${typeof window !== 'undefined' ? window.location.hostname : 'aapki site'}" wali entry dhundho` },
          { num:'5', icon:'🔊', title:'Importance → Urgent set karo', desc:'"Importance" ya "Priority" ko "Urgent" ya "High" pe set karo' },
        ].map(s => (
          <div key={s.num} style={{ display:'flex', gap:14, marginBottom:14, alignItems:'flex-start' }}>
            <div style={{ width:34, height:34, borderRadius:'50%', background:'#1d4ed8', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:13, flexShrink:0 }}>{s.num}</div>
            <div>
              <div style={{ fontSize:14, fontWeight:700, color:'#1a1a1a' }}>{s.icon} {s.title}</div>
              <div style={{ fontSize:12, color:'#6b7280', marginTop:2, lineHeight:1.5 }}>{s.desc}</div>
            </div>
          </div>
        ))}

        <div style={{ background:'#fef3c7', border:'1px solid #fbbf24', borderRadius:12, padding:'10px 14px', marginBottom:16, fontSize:12, color:'#92400e', lineHeight:1.6 }}>
          💡 <strong>Shortcut:</strong> Kisi bhi notification ko <strong>thoda der dabao (long-press)</strong> → "More settings" tap karo → Importance change karo
        </div>

        <button onClick={onClose}
          style={{ width:'100%', background:'#1d4ed8', color:'#fff', border:'none', borderRadius:12, padding:'14px', fontSize:15, fontWeight:700, cursor:'pointer' }}>
          Samajh Gaya ✓
        </button>
      </div>
    </div>
  )
}

// ── Order Card ────────────────────────────────────────────────────────
function OrderCard({ order, onPickup, onDeliver, pickingUp, delivering }) {
  const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.confirmed
  const needsPickup = order.status === 'confirmed' || order.status === 'preparing'
  const needsDeliver = order.status === 'out_for_delivery'

  const openMap = () => {
    const q = order.delivery_lat && order.delivery_lng
      ? `${order.delivery_lat},${order.delivery_lng}`
      : encodeURIComponent(order.delivery_address || '')
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${q}`, '_blank')
  }

  return (
    <div style={{ background:'#fff', borderRadius:20, marginBottom:14, overflow:'hidden', boxShadow:'0 2px 16px #0001', border:'1px solid #f0f0f0' }}>
      {/* Status header */}
      <div style={{ background: cfg.bg, borderBottom:`2px solid ${cfg.color}20`, padding:'10px 16px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <span style={{ fontSize:11, fontWeight:800, color: cfg.color, letterSpacing:0.5 }}>ORDER #{order.order_number}</span>
          <div style={{ fontSize:13, fontWeight:700, color:'#1a1a1a', marginTop:2 }}>{cfg.label}</div>
        </div>
        <div style={{ textAlign:'right' }}>
          <div style={{ fontSize:20, fontWeight:800, color:'#e85d04' }}>₹{Math.round(order.total)}</div>
          <div style={{ fontSize:10, fontWeight:700, color:'#dc2626', background:'#fef2f2', borderRadius:6, padding:'2px 6px' }}>💵 CASH</div>
        </div>
      </div>

      <div style={{ padding:'14px 16px' }}>
        {/* Customer */}
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
          <div style={{ width:44, height:44, borderRadius:'50%', background: cfg.bg, border:`2px solid ${cfg.color}40`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:800, color: cfg.color, flexShrink:0 }}>
            {order.customer_name?.split(' ').map(n=>n[0]).join('').slice(0,2)}
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:15, fontWeight:700, color:'#1a1a1a' }}>{order.customer_name}</div>
            <a href={`tel:${order.customer_phone}`} style={{ fontSize:13, color:'#2563eb', fontWeight:600, textDecoration:'none' }}>
              📞 {order.customer_phone}
            </a>
          </div>
          <a href={`tel:${order.customer_phone}`}
            style={{ background:'#eff6ff', border:'1.5px solid #3b82f6', color:'#2563eb', borderRadius:12, padding:'8px 16px', fontSize:13, fontWeight:700, textDecoration:'none', whiteSpace:'nowrap' }}>
            Call
          </a>
        </div>

        {/* Address */}
        <div style={{ background:'#f8fafc', borderRadius:12, padding:'10px 14px', marginBottom:12, display:'flex', gap:10, alignItems:'flex-start' }}>
          <span style={{ fontSize:18, marginTop:1 }}>📍</span>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:13, fontWeight:600, color:'#1a1a1a', lineHeight:1.4 }}>{order.delivery_address}</div>
            {order.distance_km && (
              <div style={{ fontSize:11, color:'#64748b', marginTop:3 }}>
                {pf(order.distance_km).toFixed(1)} km kitchen se
              </div>
            )}
          </div>
          <button onClick={openMap}
            style={{ background:'#1e40af', color:'#fff', border:'none', borderRadius:10, padding:'8px 12px', fontSize:12, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 }}>
            🗺️ Navigate
          </button>
        </div>

        {/* Order Items */}
        {order.items && order.items.length > 0 && (
          <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:12, padding:'10px 14px', marginBottom:12 }}>
            <div style={{ fontSize:11, fontWeight:800, color:'#166534', marginBottom:8, letterSpacing:0.4 }}>📋 ORDER ITEMS</div>
            {order.items.map((item, i) => (
              <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:13, color:'#1a1a1a', paddingBottom: i < order.items.length - 1 ? 6 : 0, marginBottom: i < order.items.length - 1 ? 6 : 0, borderBottom: i < order.items.length - 1 ? '1px solid #d1fae5' : 'none' }}>
                <span style={{ fontWeight:600 }}>{item.quantity}× <span style={{ fontWeight:400 }}>{item.name}</span></span>
                <span style={{ fontWeight:700, color:'#16a34a' }}>₹{Math.round(parseFloat(item.price) * item.quantity)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Notes */}
        {order.notes && (
          <div style={{ background:'#fefce8', border:'1px solid #fde047', borderRadius:10, padding:'8px 12px', fontSize:12, color:'#713f12', marginBottom:12 }}>
            📝 <strong>Note:</strong> {order.notes}
          </div>
        )}

        {/* Time */}
        <div style={{ fontSize:11, color:'#94a3b8', marginBottom:12 }}>
          🕐 {new Date(order.created_at).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', hour12:true })}
          {' · '}
          {Math.round((Date.now() - new Date(order.created_at)) / 60000)} min ago
        </div>

        {/* Action Buttons */}
        {order.status === 'pending' && (
          <div style={{ background:'#fffbeb', border:'2px dashed #f59e0b', borderRadius:14, padding:'14px 16px', textAlign:'center' }}>
            <div style={{ fontSize:20, marginBottom:4 }}>⏳</div>
            <div style={{ fontSize:14, fontWeight:800, color:'#92400e' }}>Kitchen Confirmation Ka Wait Kar Raho</div>
            <div style={{ fontSize:12, color:'#b45309', marginTop:4 }}>Admin approve karega tab pickup kar paoge</div>
          </div>
        )}

        {needsPickup && (
          <button
            onClick={() => onPickup(order.id)}
            disabled={pickingUp === order.id}
            style={{ width:'100%', padding:'14px', background:'linear-gradient(135deg,#2563eb,#3b82f6)', color:'#fff', border:'none', borderRadius:14, fontSize:15, fontWeight:800, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, opacity: pickingUp===order.id ? 0.7 : 1 }}>
            {pickingUp === order.id ? '⏳ Updating...' : '📦 Kitchen se Pick Up Kar Liya'}
          </button>
        )}

        {needsDeliver && (
          <button
            onClick={() => onDeliver(order.id)}
            disabled={delivering === order.id}
            style={{ width:'100%', padding:'16px', background:'linear-gradient(135deg,#16a34a,#22c55e)', color:'#fff', border:'none', borderRadius:14, fontSize:16, fontWeight:800, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, opacity: delivering===order.id ? 0.7 : 1, boxShadow:'0 4px 20px #22c55e50' }}>
            {delivering === order.id ? '⏳ Marking...' : '✅ Delivered — Order Complete!'}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────
export default function DeliveryPage() {
  const router = useRouter()
  usePushNotifications(true)
  const { installPrompt, install, isIOS, isInstalled } = usePWAInstall()

  const [user, setUser]               = useState(null)
  const [orders, setOrders]           = useState([])
  const [history, setHistory]         = useState([])
  const [stats, setStats]             = useState(null)
  const [allTime, setAllTime]         = useState(null)
  const [boyInfo, setBoyInfo]         = useState(null)
  const [tab, setTab]                 = useState('orders')
  const [period, setPeriod]           = useState('today')
  const [loading, setLoading]         = useState(true)
  const [isOnline, setIsOnline]        = useState(false)
  const [toggling, setToggling]       = useState(false)
  const [pickingUp, setPickingUp]     = useState(null) // orderId being picked up
  const [delivering, setDelivering]   = useState(null) // orderId being delivered
  const [paymentHistory, setPaymentHistory] = useState([])
  const [profileEdit, setProfileEdit] = useState(false)
  const [profileForm, setProfileForm] = useState({})
  const [pwForm, setPwForm]           = useState({ current:'', newPw:'', confirm:'' })
  const [saveMsg, setSaveMsg]         = useState('')
  const [toast, setToast]             = useState('')
  const [showInstall, setShowInstall] = useState(false)
  const [showIOSModal, setShowIOSModal] = useState(false)
  const [showNotifGuide, setShowNotifGuide] = useState(false)
  const [showNotifModal, setShowNotifModal] = useState(false)
  const [deliveryNotifs, setDeliveryNotifs] = useState([])
  const [notifUnread, setNotifUnread] = useState(0)
  const notifPollRef = useRef(null)
  const lastNotifCount = useRef(-1)

  const pollRef        = useRef(null)
  const alertCtxRef    = useRef(null)
  const lastOrderIds   = useRef(new Set())
  const initialLoadDone = useRef(false)
  const sharedAudioCtx = useRef(null) // Pre-warmed AudioContext — avoids mobile autoplay block
  // Live location tracking refs
  const locationWatchRef    = useRef(null)
  const locationIntervalRef = useRef(null)
  const lastLocRef          = useRef(null)

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 5000) }

  const playAlert = () => {
    try {
      const ctx = sharedAudioCtx.current || new (window.AudioContext || window.webkitAudioContext)()
      if (!sharedAudioCtx.current) sharedAudioCtx.current = ctx
      alertCtxRef.current = ctx
      const doPlay = () => {
        for (let i = 0; i < 18; i++) {
          const base = ctx.currentTime + i * 0.55
          const o1 = ctx.createOscillator(), g1 = ctx.createGain()
          o1.type = 'square'; o1.frequency.value = 880
          o1.connect(g1); g1.connect(ctx.destination)
          g1.gain.setValueAtTime(0.9, base)
          g1.gain.exponentialRampToValueAtTime(0.001, base + 0.22)
          o1.start(base); o1.stop(base + 0.23)
        }
      }
      if (ctx.state === 'suspended') ctx.resume().then(doPlay).catch(() => {})
      else doPlay()
    } catch {}
  }

  useEffect(() => {
    fetch('/api/auth', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ action:'me' }) })
      .then(r => r.json())
      .then(({ user }) => {
        if (!user || user.role !== 'delivery') { router.push('/login'); return }
        setUser(user)
        loadData()
      })

    pollRef.current = setInterval(async () => {
      try {
        const d = await fetch('/api/orders').then(r => r.json())
        const newOrders = d.orders || []
        const newIds = new Set(newOrders.map(o => o.id))
        if (initialLoadDone.current && lastOrderIds.current.size > 0) {
          const added = newOrders.filter(o => !lastOrderIds.current.has(o.id))
          if (added.length > 0) {
            playAlert()
            showToast(`🛵 Naya order assign hua! #${added[0].order_number}`)
          }
        }
        lastOrderIds.current = newIds
        setOrders(newOrders)
      } catch {}
    }, 15000)

    return () => clearInterval(pollRef.current)
  }, [])

  // ── Unlock AudioContext on first user touch (mobile autoplay policy) ──
  useEffect(() => {
    const unlock = () => {
      try {
        if (!sharedAudioCtx.current) {
          sharedAudioCtx.current = new (window.AudioContext || window.webkitAudioContext)()
        }
        if (sharedAudioCtx.current.state === 'suspended') {
          sharedAudioCtx.current.resume().catch(() => {})
        }
      } catch {}
    }
    document.addEventListener('touchstart', unlock, { once: true, passive: true })
    document.addEventListener('click',      unlock, { once: true })
    return () => {
      document.removeEventListener('touchstart', unlock)
      document.removeEventListener('click',      unlock)
    }
  }, [])

  // ── SW message: play alert sound immediately when push arrives ────
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.serviceWorker) return
    const handler = (e) => {
      if (e.data?.type === 'PLAY_NOTIFICATION_SOUND' || e.data?.type === 'NEW_ORDER_ALARM') {
        playAlert()
        // Refresh orders list so new assignment shows immediately
        fetch('/api/orders').then(r => r.json()).then(d => {
          const newOrders = d.orders || []
          setOrders(newOrders)
          lastOrderIds.current = new Set(newOrders.map(o => o.id))
        }).catch(() => {})
      }
    }
    navigator.serviceWorker.addEventListener('message', handler)
    return () => navigator.serviceWorker.removeEventListener('message', handler)
  }, [])

  // Notification polling for delivery boy
  useEffect(() => {
    const fetchNotifs = async () => {
      try {
        const d = await fetch('/api/notifications').then(r => r.json())
        const notifs = d.notifications || []
        const count = d.unreadCount || 0
        if (count > lastNotifCount.current && lastNotifCount.current >= 0) {
          // New notification arrived — play alert sound
          try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)()
            const notes = [880, 1108, 1318]
            notes.forEach((freq, i) => {
              const o = ctx.createOscillator(), g = ctx.createGain()
              o.connect(g); g.connect(ctx.destination)
              o.type = 'sine'; o.frequency.value = freq
              const s = ctx.currentTime + i * 0.13
              g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(0.25, s+0.04)
              g.gain.exponentialRampToValueAtTime(0.001, s+0.45)
              o.start(s); o.stop(s+0.46)
            })
          } catch {}
        }
        lastNotifCount.current = count
        setNotifUnread(count)
        setDeliveryNotifs(notifs)
      } catch {}
    }
    fetchNotifs()
    notifPollRef.current = setInterval(fetchNotifs, 20000)
    return () => clearInterval(notifPollRef.current)
  }, [])

  // Auto-refresh earnings + payment info every 30s (catches admin payments instantly)
  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const d = await fetch(`/api/delivery/history?period=today&_t=${Date.now()}`, { cache: 'no-store' }).then(r => r.json())
        if (d.stats)          setStats(d.stats)
        if (d.boyInfo)        setBoyInfo(d.boyInfo)
        if (d.allTime)        setAllTime(d.allTime)
        if (d.paymentHistory) setPaymentHistory(d.paymentHistory)
      } catch {}
    }, 30000)
    return () => clearInterval(timer)
  }, [])

  // Show install banner after 3s if applicable
  useEffect(() => {
    if (!isInstalled && (installPrompt || isIOS)) {
      const t = setTimeout(() => setShowInstall(true), 3000)
      return () => clearTimeout(t)
    }
  }, [installPrompt, isIOS, isInstalled])

  // Show Android notification guide (once — until dismissed)
  useEffect(() => {
    try {
      if (!localStorage.getItem('notif_guide_dismissed')) {
        setTimeout(() => setShowNotifGuide(true), 5000)
      }
    } catch {}
  }, [])

  // ── Live Location Sender ──────────────────────────────────────────
  // Jab koi order out_for_delivery ho — GPS start, har 15s mein location bhejo
  useEffect(() => {
    const isDelivering = orders.some(o => o.status === 'out_for_delivery')

    if (isDelivering && !locationWatchRef.current && navigator.geolocation) {
      // Start GPS watch
      locationWatchRef.current = navigator.geolocation.watchPosition(
        pos => {
          lastLocRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        },
        () => {}, // silent fail — no GPS permission etc.
        { enableHighAccuracy: true, maximumAge: 8000, timeout: 12000 }
      )
      // Send location every 15 seconds
      locationIntervalRef.current = setInterval(() => {
        if (lastLocRef.current) {
          fetch('/api/delivery/location', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(lastLocRef.current)
          }).catch(() => {})
        }
      }, 15000)
    }

    // Delivery khatam ya koi delivery order nahi — GPS band karo
    if (!isDelivering) {
      if (locationWatchRef.current != null) {
        navigator.geolocation.clearWatch(locationWatchRef.current)
        locationWatchRef.current = null
      }
      if (locationIntervalRef.current) {
        clearInterval(locationIntervalRef.current)
        locationIntervalRef.current = null
      }
      lastLocRef.current = null
    }
  }, [orders])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (locationWatchRef.current != null) navigator.geolocation.clearWatch(locationWatchRef.current)
      if (locationIntervalRef.current) clearInterval(locationIntervalRef.current)
    }
  }, [])

  const loadData = async () => {
    try {
      const [ordersRes, historyRes, profileRes, statusRes] = await Promise.all([
        fetch('/api/orders').then(r => r.json()).catch(() => ({ orders: [] })),
        fetch(`/api/delivery/history?period=today&_t=${Date.now()}`, { cache: 'no-store' }).then(r => r.json()).catch(() => ({})),
        fetch('/api/profile').then(r => r.json()).catch(() => ({})),
        fetch('/api/delivery/status').then(r => r.json()).catch(() => ({})),
      ])
      const initial = ordersRes.orders || []
      setOrders(initial)
      lastOrderIds.current = new Set(initial.map(o => o.id))
      initialLoadDone.current = true
      setHistory(historyRes.orders || [])
      if (historyRes.stats) setStats(historyRes.stats)
      setAllTime(historyRes.allTime || null)
      setPaymentHistory(historyRes.paymentHistory || [])
      const info = historyRes.boyInfo || profileRes.profile
      if (info) {
        setBoyInfo(info)
        setProfileForm({ name: info?.name||'', phone: info?.phone||'', home_address: info?.home_address||'', emergency_contact: info?.emergency_contact||'' })
      }
      // Use dedicated status endpoint as source of truth for is_online
      // Falls back to boyInfo if status endpoint fails
      if (typeof statusRes.isOnline === 'boolean') {
        setIsOnline(statusRes.isOnline)
      } else if (info) {
        setIsOnline(info?.is_online ?? false)
      }
    } catch(e) {
      console.error('loadData error:', e)
    } finally {
      setLoading(false)
    }
  }

  const loadHistory = async (p) => {
    setPeriod(p)
    const res = await fetch(`/api/delivery/history?period=${p}&_t=${Date.now()}`, { cache: 'no-store' }).then(r => r.json()).catch(() => ({}))
    setHistory(res.orders || [])
    if (res.stats) setStats(res.stats)
    if (res.allTime) setAllTime(res.allTime)
    if (res.boyInfo) setBoyInfo(res.boyInfo)
  }

  const toggleOnline = async () => {
    setToggling(true)
    const next = !isOnline
    try {
      const res = await fetch('/api/delivery/status', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ isOnline: next }) })
      const data = await res.json()
      if (res.ok && data.success) {
        setIsOnline(next)
        showToast(next ? '🟢 Aap online ho gaye — orders milenge!' : '⚫ Aap offline ho gaye')
      } else {
        showToast('❌ Status update nahi hua — dobara try karo')
      }
    } catch {
      showToast('❌ Network error — dobara try karo')
    }
    setToggling(false)
  }

  const markPickup = async (orderId) => {
    setPickingUp(orderId)
    try {
      await fetch('/api/orders', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ orderId, status:'out_for_delivery' }) })
      setOrders(p => p.map(o => o.id === orderId ? { ...o, status:'out_for_delivery' } : o))
      showToast('📦 Picked up! Ab customer ko deliver karo')
    } catch { showToast('❌ Try again') }
    setPickingUp(null)
  }

  const markDelivered = async (orderId) => {
    setDelivering(orderId)
    try {
      const res = await fetch('/api/orders', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ orderId, status:'delivered' }) })
      if (res.ok) {
        setOrders(p => p.filter(o => o.id !== orderId))
        showToast('🎉 Delivered! Cash collect karna mat bhoolo 💵')
        // Wait 800ms for DB to commit before re-fetching earnings
        await new Promise(r => setTimeout(r, 800))
        const pr = await fetch(`/api/delivery/history?period=${period}`).then(r => r.json())
        setStats(pr.stats)
        setHistory(pr.orders || [])
        if (pr.allTime) setAllTime(pr.allTime)
        if (pr.boyInfo) setBoyInfo(pr.boyInfo)
      } else {
        showToast('❌ Try again')
      }
    } catch { showToast('❌ Try again') }
    setDelivering(null)
  }

  const saveProfile = async () => {
    const res = await fetch('/api/profile', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify(profileForm) })
    const data = await res.json()
    if (data.profile) { setBoyInfo(p => ({ ...p, ...data.profile })); setSaveMsg('✅ Saved!'); setProfileEdit(false) }
    else setSaveMsg('❌ Save nahi hua')
    setTimeout(() => setSaveMsg(''), 3000)
  }

  const changePassword = async (e) => {
    e.preventDefault()
    if (pwForm.newPw !== pwForm.confirm) { setSaveMsg('❌ Passwords match nahi'); return }
    const res = await fetch('/api/profile', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ currentPassword:pwForm.current, newPassword:pwForm.newPw }) })
    const data = await res.json()
    setSaveMsg(data.message || data.error || 'Done')
    if (data.success) setPwForm({ current:'', newPw:'', confirm:'' })
    setTimeout(() => setSaveMsg(''), 4000)
  }

  const logout = async () => {
    await fetch('/api/delivery/status', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ isOnline:false }) })
    await fetch('/api/auth', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ action:'logout' }) })
    router.push('/login')
  }

  if (loading) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100vh', background:'#f8fafc', gap:16 }}>
      <div style={{ fontSize:40 }}>🛵</div>
      <div style={{ width:40, height:40, border:'4px solid #e5e7eb', borderTop:'4px solid #16a34a', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  const pendingCount = orders.length

  return (
    <div style={{ minHeight:'100vh', background:'#f1f5f9', display:'flex', flexDirection:'column', maxWidth:480, margin:'0 auto', position:'relative' }}>

      {/* Android notification settings guide */}
      {showNotifModal && <NotifGuideModal onClose={() => setShowNotifModal(false)} />}
      {showNotifGuide && !showNotifModal && (
        <div style={{ background:'#1e40af', color:'#fff', padding:'9px 14px', display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
          <div style={{ fontSize:12, lineHeight:1.4 }}>
            <span style={{ fontWeight:700 }}>📳 Popup + Ring band hai?</span>
            <span style={{ color:'#93c5fd' }}> Settings guide dekho</span>
          </div>
          <div style={{ display:'flex', gap:6, flexShrink:0 }}>
            <button onClick={() => setShowNotifModal(true)}
              style={{ background:'#3b82f6', border:'none', color:'#fff', borderRadius:8, padding:'5px 10px', fontSize:11, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>
              Guide ▶
            </button>
            <button
              onClick={() => { setShowNotifGuide(false); try { localStorage.setItem('notif_guide_dismissed','1') } catch {} }}
              style={{ background:'none', border:'none', color:'#93c5fd', fontSize:20, cursor:'pointer', lineHeight:1 }}>✕</button>
          </div>
        </div>
      )}

      {/* Install banner */}
      {showInstall && !isInstalled && (
        <InstallBanner
          onInstall={async () => {
            if (isIOS) { setShowIOSModal(true); return }
            const ok = await install()
            if (ok) setShowInstall(false)
          }}
          isIOS={isIOS}
          onDismiss={() => setShowInstall(false)}
        />
      )}

      {/* iOS Install Guide Modal */}
      {showIOSModal && <IOSInstallModal onClose={() => setShowIOSModal(false)} />}

      {/* Toast */}
      {toast && (
        <div style={{ position:'fixed', top:16, left:'50%', transform:'translateX(-50%)', background:'#1e293b', color:'#fff', borderRadius:14, padding:'12px 20px', fontSize:13, fontWeight:600, boxShadow:'0 8px 32px #0004', zIndex:9999, whiteSpace:'nowrap', maxWidth:'90vw', textOverflow:'ellipsis', overflow:'hidden' }}>
          {toast}
        </div>
      )}

      {/* ── TOP STATUS BAR ── */}
      <div style={{ background: isOnline ? 'linear-gradient(135deg,#16a34a,#22c55e)' : 'linear-gradient(135deg,#374151,#6b7280)', padding:'14px 18px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:100 }}>
        <div>
          <div style={{ fontSize:11, color:'rgba(255,255,255,0.7)', marginBottom:2 }}>
            {boyInfo?.name}
          </div>
          <div style={{ fontSize:16, fontWeight:800, color:'#fff' }}>
            {isOnline ? '🟢 Online — Ready' : '⚫ Offline'}
          </div>
        </div>
        <button onClick={toggleOnline} disabled={toggling}
          style={{ background:'rgba(255,255,255,0.2)', border:'2px solid rgba(255,255,255,0.5)', color:'#fff', borderRadius:20, padding:'8px 18px', fontWeight:800, fontSize:13, cursor:'pointer', minWidth:100 }}>
          {toggling ? '...' : isOnline ? 'Go Offline' : 'Go Online'}
        </button>
      </div>

      {/* ── QUICK STATS ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, padding:'12px 14px' }}>
        {[
          { val:`₹${Math.round(pf(stats?.total_earned))}`, label:'Aaj Kamaai', color:'#16a34a', bg:'#dcfce7' },
          { val: String(pf(stats?.total_deliveries,0)), label:'Delivered', color:'#2563eb', bg:'#dbeafe' },
          { val: String(pendingCount), label:'Active Now', color:'#e85d04', bg:'#fff7ed', badge: pendingCount > 0 },
        ].map(({ val, label, color, bg, badge }) => (
          <div key={label} style={{ background:'#fff', borderRadius:14, padding:'12px 10px', textAlign:'center', boxShadow:'0 1px 6px #0001', position:'relative' }}>
            {badge && pendingCount > 0 && (
              <div style={{ position:'absolute', top:6, right:6, width:8, height:8, borderRadius:'50%', background:'#dc2626', animation:'pulse 1.5s infinite' }} />
            )}
            <div style={{ fontSize:20, fontWeight:800, color }}>{val}</div>
            <div style={{ fontSize:10, color:'#64748b', marginTop:2 }}>{label}</div>
          </div>
        ))}
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>

      {/* ── SCROLLABLE CONTENT ── */}
      <div style={{ flex:1, overflowY:'auto', paddingBottom:80 }}>

        {/* ── ORDERS TAB ── */}
        {tab === 'orders' && (
          <div style={{ padding:'0 14px' }}>
            {!isOnline && (
              <div style={{ background:'#fffbeb', border:'1.5px solid #fcd34d', borderRadius:16, padding:'16px', textAlign:'center', marginBottom:14 }}>
                <div style={{ fontSize:32, marginBottom:6 }}>⚫</div>
                <div style={{ fontWeight:700, fontSize:14, color:'#92400e' }}>Abhi Offline Hain</div>
                <div style={{ fontSize:12, color:'#b45309', marginTop:4 }}>Go Online karo — orders milenge</div>
              </div>
            )}

            {pendingCount === 0 ? (
              <div style={{ textAlign:'center', padding:'60px 20px', color:'#94a3b8' }}>
                <div style={{ fontSize:56, marginBottom:12 }}>✅</div>
                <div style={{ fontSize:16, fontWeight:600, color:'#64748b' }}>Koi order nahi hai</div>
                <div style={{ fontSize:13, marginTop:6 }}>Naya order assign hone par notification aayega</div>
              </div>
            ) : (
              orders.map(o => (
                <OrderCard
                  key={o.id}
                  order={o}
                  onPickup={markPickup}
                  onDeliver={markDelivered}
                  pickingUp={pickingUp}
                  delivering={delivering}
                />
              ))
            )}
          </div>
        )}

        {/* ── EARNINGS TAB ── */}
        {tab === 'earnings' && (
          <div style={{ padding:'0 14px' }}>
            {/* Period selector */}
            <div style={{ display:'flex', gap:8, marginBottom:14 }}>
              {['today','week','month','all'].map(p => (
                <button key={p} onClick={() => loadHistory(p)}
                  style={{ flex:1, padding:'8px 4px', borderRadius:10, border:'none', fontSize:12, fontWeight:700, cursor:'pointer',
                    background: period===p ? '#16a34a' : '#fff',
                    color: period===p ? '#fff' : '#64748b',
                    boxShadow: period===p ? '0 2px 8px #16a34a50' : '0 1px 4px #0001' }}>
                  {p==='today'?'Today':p==='week'?'Week':p==='month'?'Month':'All'}
                </button>
              ))}
            </div>

            {/* Big earnings card — period specific */}
            <div style={{ background:'linear-gradient(135deg,#052e16,#14532d)', borderRadius:20, padding:'24px 20px', marginBottom:14, color:'#fff' }}>
              <div style={{ fontSize:12, color:'#86efac', marginBottom:4 }}>
                {period==='today'?'Aaj ki Kamaai':period==='week'?'Is Hafte ki Kamaai':period==='month'?'Is Mahine ki Kamaai':'Sab Period ki Kamaai'}
              </div>
              <div style={{ fontSize:42, fontWeight:800, letterSpacing:-1 }}>₹{Math.round(pf(stats?.total_earned))}</div>
              <div style={{ fontSize:13, color:'#86efac', marginTop:6 }}>
                {pf(stats?.total_deliveries,0)} deliveries · Avg ₹{Math.round(pf(stats?.avg_delivery_charge)*0.7)} per delivery
              </div>
            </div>

            {/* All-time account — live calculated from orders */}
            <div style={{ background:'#fff', borderRadius:16, padding:'18px', marginBottom:14, boxShadow:'0 1px 6px #0001' }}>
              <div style={{ fontSize:12, fontWeight:700, color:'#64748b', marginBottom:4, letterSpacing:0.5 }}>💳 PAYMENT ACCOUNT (All Time)</div>
              <div style={{ fontSize:10, color:'#94a3b8', marginBottom:12 }}>Live calculation from orders — always accurate</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:12 }}>
                {[
                  { label:'Kul Kamaai', val:`₹${Math.round(pf(allTime?.total_earned || boyInfo?.total_earnings))}`, color:'#16a34a', bg:'#dcfce7' },
                  { label:'Mila Hua', val:`₹${Math.round(pf(boyInfo?.total_paid))}`, color:'#2563eb', bg:'#dbeafe' },
                  { label:'Baaki Hai', val:`₹${Math.round(pf(boyInfo?.payment_due))}`, color: pf(boyInfo?.payment_due)>0?'#dc2626':'#64748b', bg: pf(boyInfo?.payment_due)>0?'#fef2f2':'#f1f5f9' },
                ].map(({ label, val, color, bg }) => (
                  <div key={label} style={{ background: bg, borderRadius:12, padding:'12px 8px', textAlign:'center' }}>
                    <div style={{ fontSize:10, color:'#64748b', marginBottom:4, fontWeight:600 }}>{label}</div>
                    <div style={{ fontSize:15, fontWeight:800, color }}>{val}</div>
                  </div>
                ))}
              </div>
              {pf(boyInfo?.payment_due) > 0 && (
                <div style={{ background:'#fef3c7', borderRadius:10, padding:'10px 12px', fontSize:12, color:'#92400e', textAlign:'center', fontWeight:600 }}>
                  ⏳ Admin se ₹{Math.round(pf(boyInfo?.payment_due))} payment leni hai
                </div>
              )}
            </div>

            {/* Payment history */}
            {paymentHistory.length > 0 && (
              <div style={{ background:'#fff', borderRadius:16, padding:'18px', marginBottom:14, boxShadow:'0 1px 6px #0001' }}>
                <div style={{ fontSize:12, fontWeight:700, color:'#64748b', marginBottom:12 }}>📋 PAYMENTS RECEIVED</div>
                {paymentHistory.map((p,i) => (
                  <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom: i<paymentHistory.length-1?'1px solid #f1f5f9':'none' }}>
                    <div>
                      <div style={{ fontSize:14, fontWeight:700, color:'#16a34a' }}>✅ ₹{Math.round(pf(p.amount))} received</div>
                      {p.notes && <div style={{ fontSize:11, color:'#64748b' }}>{p.notes}</div>}
                    </div>
                    <div style={{ fontSize:11, color:'#94a3b8' }}>{new Date(p.created_at).toLocaleDateString('en-IN')}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Delivery history list */}
            {history.length > 0 && (
              <div style={{ background:'#fff', borderRadius:16, overflow:'hidden', boxShadow:'0 1px 6px #0001', marginBottom:14 }}>
                <div style={{ padding:'12px 16px', background:'#f8fafc', fontSize:11, fontWeight:700, color:'#64748b', letterSpacing:0.5, display:'grid', gridTemplateColumns:'60px 1fr 70px 70px', gap:8 }}>
                  <span>ORDER</span><span>CUSTOMER</span><span>AMT</span><span>EARNED</span>
                </div>
                {history.map((o,i) => (
                  <div key={o.id} style={{ display:'grid', gridTemplateColumns:'60px 1fr 70px 70px', gap:8, padding:'11px 16px', borderTop:'1px solid #f1f5f9', alignItems:'center' }}>
                    <span style={{ fontSize:12, fontWeight:700, color:'#2563eb' }}>#{o.order_number}</span>
                    <span style={{ fontSize:12, color:'#475569' }}>{o.customer_name?.split(' ')[0]}</span>
                    <span style={{ fontSize:12 }}>₹{Math.round(o.total)}</span>
                    <span style={{ fontSize:13, fontWeight:700, color:'#16a34a' }}>₹{Math.round(o.earned)}</span>
                  </div>
                ))}
              </div>
            )}
            {history.length === 0 && <div style={{ textAlign:'center', padding:'40px 20px', color:'#94a3b8' }}>Is period me koi delivery nahi</div>}
          </div>
        )}

        {/* ── ALERTS TAB ── */}
        {tab === 'alerts' && (
          <div style={{ padding:'0 14px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
              <h3 style={{ fontSize:15, fontWeight:800, margin:0 }}>🔔 Notifications</h3>
              <div style={{ display:'flex', gap:8 }}>
                {deliveryNotifs.some(n => !n.is_read) && (
                  <button onClick={async () => {
                    await fetch('/api/notifications', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({}) })
                    setDeliveryNotifs(prev => prev.map(n => ({ ...n, is_read:true })))
                  }} style={{ fontSize:11, color:'#64748b', background:'#f1f5f9', border:'none', borderRadius:8, padding:'5px 10px', cursor:'pointer', fontWeight:600 }}>
                    Sab read ✓
                  </button>
                )}
                {deliveryNotifs.some(n => n.is_read) && (
                  <button onClick={async () => {
                    await fetch('/api/notifications', { method:'DELETE' })
                    setDeliveryNotifs(prev => prev.filter(n => !n.is_read))
                  }} style={{ fontSize:11, color:'#dc2626', background:'#fef2f2', border:'none', borderRadius:8, padding:'5px 10px', cursor:'pointer', fontWeight:600 }}>
                    Clear
                  </button>
                )}
              </div>
            </div>

            {deliveryNotifs.length === 0 && (
              <div style={{ textAlign:'center', padding:'60px 20px' }}>
                <div style={{ fontSize:48, marginBottom:12 }}>🔕</div>
                <div style={{ fontSize:14, color:'#94a3b8' }}>Koi notification nahi abhi</div>
              </div>
            )}

            {deliveryNotifs.map(n => {
              const timeAgo = (d) => {
                const s = Math.floor((Date.now()-new Date(d))/1000)
                if(s<60) return 'abhi abhi'
                if(s<3600) return `${Math.floor(s/60)} min pehle`
                if(s<86400) return `${Math.floor(s/3600)} ghante pehle`
                return new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short'})
              }
              return (
                <div key={n.id}
                  onClick={async () => {
                    if (!n.is_read) {
                      await fetch('/api/notifications', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ notifId:n.id }) })
                      setDeliveryNotifs(prev => prev.map(x => x.id===n.id ? {...x, is_read:true} : x))
                    }
                  }}
                  style={{ background:'#fff', borderRadius:14, padding:'14px 16px', marginBottom:10, display:'flex', gap:12, alignItems:'flex-start', cursor:'pointer', boxShadow:'0 1px 6px #0001', borderLeft:`4px solid ${n.is_read ? '#e2e8f0' : '#16a34a'}`, opacity: n.is_read ? 0.75 : 1 }}>
                  <div style={{ width:38, height:38, borderRadius:'50%', background: n.is_read ? '#f1f5f9' : '#dcfce7', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>
                    {n.title?.startsWith('📦') ? '📦' : n.title?.startsWith('🛵') ? '🛵' : n.title?.startsWith('🎉') ? '🎉' : '🔔'}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight: n.is_read ? 500 : 700, color:'#1e293b', marginBottom:3 }}>{n.title}</div>
                    {n.body && <div style={{ fontSize:12, color:'#64748b', lineHeight:1.4, marginBottom:4 }}>{n.body}</div>}
                    <div style={{ fontSize:11, color:'#94a3b8' }}>{timeAgo(n.created_at)}</div>
                  </div>
                  {!n.is_read && <div style={{ width:8, height:8, borderRadius:'50%', background:'#16a34a', flexShrink:0, marginTop:6 }} />}
                </div>
              )
            })}
          </div>
        )}

        {/* ── PROFILE TAB ── */}
        {tab === 'profile' && boyInfo && (
          <div style={{ padding:'0 14px' }}>
            {saveMsg && (
              <div style={{ background:saveMsg.startsWith('✅')?'#dcfce7':'#fef2f2', border:`1px solid ${saveMsg.startsWith('✅')?'#86efac':'#fca5a5'}`, borderRadius:12, padding:'12px 16px', marginBottom:12, fontSize:13, fontWeight:600 }}>
                {saveMsg}
              </div>
            )}

            {/* Profile card */}
            <div style={{ background:'#fff', borderRadius:20, padding:20, marginBottom:14, boxShadow:'0 1px 6px #0001' }}>
              {/* Avatar */}
              <div style={{ textAlign:'center', marginBottom:16 }}>
                <div style={{ width:72, height:72, borderRadius:'50%', background:'linear-gradient(135deg,#16a34a,#22c55e)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 10px', fontSize:24, fontWeight:800, color:'#fff' }}>
                  {boyInfo.name?.split(' ').map(n=>n[0]).join('').slice(0,2)}
                </div>
                <div style={{ fontSize:18, fontWeight:800, color:'#1a1a1a' }}>{boyInfo.name}</div>
                <div style={{ fontSize:13, color:'#64748b' }}>{boyInfo.phone}</div>
                <div style={{ marginTop:6, display:'inline-flex', alignItems:'center', gap:4, background:'#f0fdf4', border:'1px solid #86efac', borderRadius:20, padding:'3px 12px' }}>
                  <span style={{ fontSize:12, fontWeight:700, color:'#16a34a' }}>⭐ {pf(boyInfo.rating||5).toFixed(1)} Rating</span>
                </div>
              </div>

              {/* Edit toggle */}
              <button onClick={() => setProfileEdit(!profileEdit)}
                style={{ width:'100%', padding:'10px', background:'#f8fafc', border:'1.5px solid #e2e8f0', borderRadius:10, fontSize:13, fontWeight:700, cursor:'pointer', color:'#475569', marginBottom:14 }}>
                {profileEdit ? '✕ Cancel' : '✏️ Edit Profile'}
              </button>

              {profileEdit ? (
                <div>
                  {[['Full Name','text',profileForm.name,v=>setProfileForm(p=>({...p,name:v}))],
                    ['Phone','tel',profileForm.phone,v=>setProfileForm(p=>({...p,phone:v}))],
                    ['Home Address','text',profileForm.home_address,v=>setProfileForm(p=>({...p,home_address:v}))],
                    ['Emergency Contact','tel',profileForm.emergency_contact,v=>setProfileForm(p=>({...p,emergency_contact:v}))],
                  ].map(([label,type,val,onChange]) => (
                    <div key={label} style={{ marginBottom:12 }}>
                      <label style={{ fontSize:12, fontWeight:600, color:'#64748b', display:'block', marginBottom:5 }}>{label}</label>
                      <input type={type} value={val} onChange={e=>onChange(e.target.value)}
                        style={{ width:'100%', padding:'11px 13px', border:'1.5px solid #e2e8f0', borderRadius:10, fontSize:14, boxSizing:'border-box', outline:'none', background:'#f8fafc' }} />
                    </div>
                  ))}
                  <button onClick={saveProfile}
                    style={{ width:'100%', padding:'12px', background:'linear-gradient(135deg,#16a34a,#22c55e)', color:'#fff', border:'none', borderRadius:12, fontSize:14, fontWeight:800, cursor:'pointer' }}>
                    💾 Save Changes
                  </button>
                </div>
              ) : (
                <div style={{ display:'grid', gap:8 }}>
                  {[['Email', boyInfo.email], ['Home Address', boyInfo.home_address], ['Emergency', boyInfo.emergency_contact]].map(([label,val])=>val&&(
                    <div key={label} style={{ background:'#f8fafc', borderRadius:10, padding:'10px 14px' }}>
                      <div style={{ fontSize:10, color:'#94a3b8', marginBottom:2, fontWeight:600 }}>{label.toUpperCase()}</div>
                      <div style={{ fontSize:13, fontWeight:600, color:'#1a1a1a' }}>{val}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Vehicle info */}
            <div style={{ background:'#fff', borderRadius:20, padding:20, marginBottom:14, boxShadow:'0 1px 6px #0001' }}>
              <div style={{ fontSize:13, fontWeight:800, color:'#1a1a1a', marginBottom:12 }}>🛵 Vehicle & ID</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {[['Vehicle Type',boyInfo.vehicle_type],['Vehicle No.',boyInfo.vehicle_number],['License',boyInfo.license_number],['Aadhar','••••'+boyInfo.aadhar_number?.slice(-4)||'—']].map(([label,val])=>(
                  <div key={label} style={{ background:'#f8fafc', borderRadius:10, padding:'10px 12px' }}>
                    <div style={{ fontSize:10, color:'#94a3b8', marginBottom:2, fontWeight:600 }}>{label.toUpperCase()}</div>
                    <div style={{ fontSize:13, fontWeight:600 }}>{val||'—'}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Change password */}
            <div style={{ background:'#fff', borderRadius:20, padding:20, marginBottom:14, boxShadow:'0 1px 6px #0001' }}>
              <div style={{ fontSize:13, fontWeight:800, color:'#1a1a1a', marginBottom:14 }}>🔒 Password Change</div>
              <form onSubmit={changePassword}>
                {[['Current','current'],['New','newPw'],['Confirm New','confirm']].map(([label,key])=>(
                  <div key={key} style={{ marginBottom:12 }}>
                    <label style={{ fontSize:12, fontWeight:600, color:'#64748b', display:'block', marginBottom:5 }}>{label} Password</label>
                    <input type="password" required value={pwForm[key]} onChange={e=>setPwForm(p=>({...p,[key]:e.target.value}))} placeholder="••••••••" minLength={key==='newPw'?6:undefined}
                      style={{ width:'100%', padding:'11px 13px', border:'1.5px solid #e2e8f0', borderRadius:10, fontSize:14, boxSizing:'border-box', outline:'none', background:'#f8fafc' }} />
                  </div>
                ))}
                <button type="submit"
                  style={{ width:'100%', padding:'12px', background:'#1e293b', color:'#fff', border:'none', borderRadius:12, fontSize:14, fontWeight:800, cursor:'pointer' }}>
                  🔒 Update Password
                </button>
              </form>
            </div>

            {/* Logout */}
            <button onClick={logout}
              style={{ width:'100%', padding:'14px', background:'#fef2f2', border:'1.5px solid #fca5a5', color:'#dc2626', borderRadius:16, fontSize:14, fontWeight:800, cursor:'pointer', marginBottom:14 }}>
              🚪 Logout
            </button>
          </div>
        )}
      </div>

      {/* ── BOTTOM NAVIGATION ── */}
      <nav style={{ position:'fixed', bottom:0, left:'50%', transform:'translateX(-50%)', width:'100%', maxWidth:480, background:'#fff', borderTop:'1px solid #e2e8f0', display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', boxShadow:'0 -4px 20px #0002', zIndex:200 }}>
        {[
          { key:'orders',  icon:'📋', label:'Orders',  badge: pendingCount },
          { key:'earnings',icon:'💰', label:'Earnings' },
          { key:'alerts',  icon:'🔔', label:'Alerts',  badge: notifUnread },
          { key:'profile', icon:'👤', label:'Me' },
        ].map(({ key, icon, label, badge }) => (
          <button key={key} onClick={() => { setTab(key); if(key==='alerts'){ setNotifUnread(0); lastNotifCount.current=0 } }}
            style={{ padding:'12px 8px 10px', border:'none', background:'transparent', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:3, position:'relative',
              color: tab===key ? '#16a34a' : '#94a3b8' }}>
            {badge > 0 && (
              <div style={{ position:'absolute', top:8, right:'22%', background:'#dc2626', color:'#fff', borderRadius:'50%', width:16, height:16, fontSize:10, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center' }}>
                {badge > 9 ? '9+' : badge}
              </div>
            )}
            <span style={{ fontSize:20 }}>{icon}</span>
            <span style={{ fontSize:10, fontWeight: tab===key ? 700 : 500 }}>{label}</span>
            {tab===key && <div style={{ position:'absolute', bottom:0, left:'20%', right:'20%', height:3, background:'#16a34a', borderRadius:2 }} />}
          </button>
        ))}
      </nav>
    </div>
  )
}

'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import styles from './orders.module.css'
import { usePushNotifications } from '@/lib/usePush'

// ── Notification Drawer ───────────────────────────────────────────────
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
    await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
    setNotifs(prev => prev.map(n => ({ ...n, is_read: true })))
  }

  const clearRead = async () => {
    await fetch('/api/notifications', { method: 'DELETE' })
    setNotifs(prev => prev.filter(n => !n.is_read))
  }

  const timeAgo = (d) => {
    const s = Math.floor((Date.now() - new Date(d)) / 1000)
    if (s < 60) return 'abhi abhi'
    if (s < 3600) return `${Math.floor(s/60)} min pehle`
    if (s < 86400) return `${Math.floor(s/3600)} ghante pehle`
    return new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short' })
  }

  const unread = notifs.filter(n => !n.is_read).length

  return (
    <div style={{ position:'fixed', inset:0, zIndex:9999, display:'flex', alignItems:'flex-end', justifyContent:'center' }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        style={{ background:'#fff', borderRadius:'20px 20px 0 0', width:'100%', maxWidth:520, maxHeight:'80vh', display:'flex', flexDirection:'column', boxShadow:'0 -4px 32px #0003' }}>
        {/* Header */}
        <div style={{ padding:'16px 20px 12px', borderBottom:'1px solid #f3f4f6', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
          <div>
            <h3 style={{ margin:0, fontSize:16, fontWeight:800 }}>🔔 Notifications</h3>
            {unread > 0 && <span style={{ fontSize:11, color:'#e85d04', fontWeight:600 }}>{unread} naye hain</span>}
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            {unread > 0 && <button onClick={markAllRead} style={{ fontSize:11, color:'#6b7280', background:'none', border:'none', cursor:'pointer', fontWeight:600 }}>Sab read karo</button>}
            {notifs.some(n => n.is_read) && <button onClick={clearRead} style={{ fontSize:11, color:'#ef4444', background:'none', border:'none', cursor:'pointer', fontWeight:600 }}>Clear</button>}
            <button onClick={onClose} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#6b7280' }}>✕</button>
          </div>
        </div>

        {/* List */}
        <div style={{ overflowY:'auto', flex:1, padding:'8px 0' }}>
          {loading && <div style={{ textAlign:'center', padding:32, color:'#9ca3af', fontSize:14 }}>⏳ Load ho raha hai...</div>}
          {!loading && notifs.length === 0 && (
            <div style={{ textAlign:'center', padding:48 }}>
              <div style={{ fontSize:40, marginBottom:8 }}>🔕</div>
              <div style={{ fontSize:14, color:'#9ca3af' }}>Koi notification nahi hai abhi</div>
            </div>
          )}
          {notifs.map(n => (
            <div key={n.id}
              onClick={async () => {
                if (!n.is_read) {
                  await fetch('/api/notifications', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ notifId: n.id }) })
                  setNotifs(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x))
                }
              }}
              style={{
                padding:'14px 20px', display:'flex', gap:14, alignItems:'flex-start', cursor:'pointer',
                background: n.is_read ? '#fff' : '#fff7ed',
                borderBottom:'1px solid #f9fafb',
                borderLeft: n.is_read ? '3px solid transparent' : '3px solid #e85d04',
                transition:'background 0.2s'
              }}>
              <div style={{ width:40, height:40, borderRadius:'50%', background: n.is_read ? '#f3f4f6' : '#fee2e2', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>
                {n.title?.startsWith('✅') ? '✅' : n.title?.startsWith('👨') ? '👨‍🍳' : n.title?.startsWith('🛵') ? '🛵' : n.title?.startsWith('🎉') ? '🎉' : n.title?.startsWith('❌') ? '❌' : '🔔'}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight: n.is_read ? 500 : 700, color:'#1a1a1a', marginBottom:3 }}>{n.title}</div>
                {n.body && <div style={{ fontSize:12, color:'#6b7280', lineHeight:1.4, marginBottom:4 }}>{n.body}</div>}
                <div style={{ fontSize:11, color:'#9ca3af' }}>{timeAgo(n.created_at)}</div>
              </div>
              {!n.is_read && <div style={{ width:8, height:8, borderRadius:'50%', background:'#e85d04', flexShrink:0, marginTop:6 }} />}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const STATUS_STEPS = ['pending','confirmed','preparing','out_for_delivery','delivered']
const STATUS_LABEL = {
  pending:'⏳ Pending', confirmed:'✅ Confirmed', preparing:'👨‍🍳 Preparing',
  out_for_delivery:'🛵 Out for Delivery', delivered:'🎉 Delivered', cancelled:'❌ Cancelled',
}
const STATUS_COLOR = {
  pending:'#f59e0b', confirmed:'#3b82f6', preparing:'#8b5cf6',
  out_for_delivery:'#f97316', delivered:'#22c55e', cancelled:'#ef4444',
}

function StarRating({ orderId, existing, onDone }) {
  const [hovered, setHovered] = useState(0)
  const [selected, setSelected] = useState(existing?.rating || 0)
  const [comment, setComment] = useState(existing?.comment || '')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(!!existing)

  const submit = async () => {
    if (!selected) return
    setSaving(true)
    try {
      await fetch('/api/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, rating: selected, comment })
      })
      setDone(true)
      onDone && onDone(selected)
    } catch {} finally { setSaving(false) }
  }

  if (done) return (
    <div style={{ marginTop:12, padding:'10px 12px', background:'#fefce8', borderRadius:8, fontSize:13, color:'#92400e' }}>
      {'⭐'.repeat(selected || existing?.rating || 0)} Shukriya! Aapki rating mili.
      {(comment || existing?.comment) && <span style={{color:'#6b7280'}}> · "{comment || existing?.comment}"</span>}
    </div>
  )

  return (
    <div style={{ marginTop:12, padding:'12px 14px', background:'#f8f7f5', borderRadius:10, border:'1px solid #e5e7eb' }}>
      <p style={{ fontSize:12, fontWeight:600, color:'#374151', marginBottom:8 }}>🌟 Is order ko rate karein</p>
      <div style={{ display:'flex', gap:4, marginBottom:10, alignItems:'center' }}>
        {[1,2,3,4,5].map(s => (
          <button key={s}
            onMouseEnter={() => setHovered(s)} onMouseLeave={() => setHovered(0)}
            onClick={() => setSelected(s)}
            style={{ fontSize:26, background:'none', border:'none', cursor:'pointer',
              filter:(hovered||selected)>=s?'none':'grayscale(1)',
              opacity:(hovered||selected)>=s?1:0.35, transition:'all 0.1s' }}>⭐</button>
        ))}
        {selected > 0 && <span style={{ fontSize:12, color:'#6b7280', marginLeft:6 }}>
          {['','Bahut bura 😞','Bura 😕','Theek hai 😐','Achha 😊','Bahut achha! 🤩'][selected]}
        </span>}
      </div>
      <input value={comment} onChange={e => setComment(e.target.value)}
        placeholder="Koi comment? (optional)"
        style={{ width:'100%', padding:'8px 10px', border:'1px solid #e5e7eb', borderRadius:8,
          fontSize:13, marginBottom:8, fontFamily:'inherit', background:'#fff', outline:'none' }} />
      <button onClick={submit} disabled={!selected || saving}
        style={{ background:selected?'#e85d04':'#d1d5db', color:'#fff', border:'none',
          borderRadius:8, padding:'8px 18px', fontSize:13, fontWeight:600,
          cursor:selected?'pointer':'not-allowed' }}>
        {saving ? '⏳ Saving...' : 'Submit Rating'}
      </button>
    </div>
  )
}

function viewBill(order, items) {
  const w = window.open('', '_blank', 'width=380,height=620')
  const rows = (items || []).map(i =>
    `<tr><td>${i.name}</td><td style="text-align:center">${i.quantity}</td><td style="text-align:right">₹${Math.round(i.subtotal ?? i.price * i.quantity)}</td></tr>`
  ).join('')
  w.document.write(`<html><head><title>Bill #${order.order_number}</title>
    <style>
      body{font-family:monospace;max-width:340px;margin:20px auto;font-size:13px}
      h2{text-align:center;margin:0;font-size:16px}
      p{text-align:center;color:#666;margin:4px 0;font-size:12px}
      table{width:100%;border-collapse:collapse;margin:12px 0}
      td,th{padding:5px 2px;font-size:12px}
      th{text-align:left;border-bottom:1px solid #ccc}
      hr{border:none;border-top:1px dashed #bbb;margin:10px 0}
      .row{display:flex;justify-content:space-between;font-size:12px;margin:4px 0}
      .total{font-size:15px;font-weight:bold;margin-top:8px}
      .btn{display:block;margin:14px auto 0;width:100%;padding:10px;background:#e85d04;color:#fff;border:none;border-radius:8px;font-size:14px;cursor:pointer}
      @media print{.btn{display:none}}
    </style></head><body>
    <h2>🍽️ FoodFi Cloud Kitchen</h2>
    <p>${new Date(order.created_at).toLocaleString('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}</p>
    <p>Bill #${order.order_number}</p>
    <hr/>
    <p style="text-align:left"><b>Customer:</b> ${order.customer_name || ''}</p>
    <p style="text-align:left">📍 ${order.delivery_address || ''}</p>
    <hr/>
    <table>
      <thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Amount</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="3" style="text-align:center;color:#999">—</td></tr>'}</tbody>
    </table>
    <hr/>
    <div class="row"><span>Subtotal</span><span>₹${Math.round(order.subtotal)}</span></div>
    ${order.discount_amount > 0 ? `<div class="row" style="color:green"><span>Discount</span><span>−₹${Math.round(order.discount_amount)}</span></div>` : ''}
    <div class="row"><span>Delivery Charge</span><span>₹${Math.round(order.delivery_charge)}</span></div>
    <hr/>
    <div class="row total"><span>TOTAL (COD)</span><span>₹${Math.round(order.total)}</span></div>
    <p style="margin-top:16px;font-size:12px">Shukriya aapke order ke liye! 🙏</p>
    <button class="btn" onclick="window.print()">🖨️ Print / Save as PDF</button>
  </body></html>`)
  w.document.close()
}

function OrderCard({ order, estimatedTime, expanded, items, rating, onExpand, onBill, onReorder, reorderLoading, onRated }) {
  const stepIdx = STATUS_STEPS.indexOf(order.status)
  const isCancelled = order.status === 'cancelled'
  const isDelivered = order.status === 'delivered'
  const isActive = !['delivered','cancelled'].includes(order.status)
  const minutesSincePlaced = Math.floor((Date.now() - new Date(order.created_at)) / 60000)
  const etaRemaining = Math.max(0, estimatedTime - minutesSincePlaced)

  return (
    <div className={styles.orderCard} style={{ borderLeft:`3px solid ${STATUS_COLOR[order.status]||'#e5e7eb'}` }}>
      <div className={styles.orderHeader}>
        <div>
          <span className={styles.orderNum}>Order #{order.order_number || order.id?.slice(0,8)}</span>
          <span className={styles.orderDate}>{new Date(order.created_at).toLocaleString('en-IN',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</span>
        </div>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4 }}>
          <span className={styles.statusBadge}
            style={{ background:STATUS_COLOR[order.status]+'22', color:STATUS_COLOR[order.status], border:`1px solid ${STATUS_COLOR[order.status]}` }}>
            {STATUS_LABEL[order.status]||order.status}
          </span>
          {isActive && etaRemaining > 0 && (
            <span style={{ fontSize:11, color:'#6b7280' }}>⏱ ~{etaRemaining} min baaki</span>
          )}
        </div>
      </div>

      {!isCancelled && (
        <div style={{ marginTop:10, marginBottom:4 }}>
          <div className={styles.progressBar}>
            {STATUS_STEPS.map((s,i) => (
              <div key={s} className={`${styles.progressStep} ${stepIdx>=i?styles.done:''}`} />
            ))}
          </div>
          <div className={styles.progressLabels}>
            <span>Placed</span><span>Confirmed</span><span>Preparing</span><span>On Way</span><span>Delivered</span>
          </div>
        </div>
      )}

      <div className={styles.orderAddress}>📍 {order.delivery_address}</div>

      {order.delivery_boy_name && (
        <div className={styles.deliveryInfo}>
          🛵 <strong>{order.delivery_boy_name}</strong>
          {order.delivery_boy_phone && <> · <a href={`tel:${order.delivery_boy_phone}`} style={{color:'#e85d04',textDecoration:'none'}}>{order.delivery_boy_phone}</a></>}
        </div>
      )}

      <button onClick={onExpand}
        style={{ background:'none', border:'none', color:'#e85d04', fontSize:13, cursor:'pointer', padding:'6px 0', fontWeight:500 }}>
        {expanded ? '▲ Items chhupao' : '▼ Items dekho'}
      </button>

      {expanded && items && (
        <div style={{ margin:'6px 0 10px', padding:'10px 12px', background:'#f9fafb', borderRadius:8 }}>
          {items.map((item, i) => (
            <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:13, padding:'5px 0', borderBottom:i<items.length-1?'1px solid #f3f4f6':'none' }}>
              <span style={{color:'#374151'}}>{item.name} <span style={{color:'#9ca3af'}}>×{item.quantity}</span></span>
              <span style={{ fontWeight:600 }}>₹{Math.round(item.subtotal)}</span>
            </div>
          ))}
        </div>
      )}

      <div className={styles.orderFooter}>
        <div className={styles.amounts}>
          <span>Subtotal: ₹{Math.round(order.subtotal)}</span>
          {order.discount_amount > 0 && <span className={styles.discount}>- ₹{Math.round(order.discount_amount)} off</span>}
          <span>Delivery: ₹{Math.round(order.delivery_charge)}</span>
        </div>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6 }}>
          <span className={styles.total}>₹{Math.round(order.total)}</span>
          <div style={{ display:'flex', gap:6 }}>
            <button onClick={onBill}
              style={{ background:'#f0fdf4', color:'#16a34a', border:'1px solid #86efac', borderRadius:8, padding:'5px 12px', fontSize:12, fontWeight:600, cursor:'pointer' }}>
              🧾 Bill
            </button>
            <button onClick={onReorder} disabled={reorderLoading}
              style={{ background:'#fff7ed', color:'#e85d04', border:'1px solid #e85d04', borderRadius:8, padding:'5px 12px', fontSize:12, fontWeight:600, cursor:'pointer' }}>
              {reorderLoading ? '⏳' : '🔄 Reorder'}
            </button>
          </div>
        </div>
      </div>

      {isDelivered && (
        <StarRating orderId={order.id} existing={rating} onDone={onRated} />
      )}
    </div>
  )
}

// Pleasant notification sound using Web Audio API
function playNotifSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const notes = [880, 1108, 1318] // A5 → C#6 → E6 (happy chord arpeggio)
    notes.forEach((freq, i) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.connect(g); g.connect(ctx.destination)
      o.type = 'sine'
      o.frequency.value = freq
      const start = ctx.currentTime + i * 0.13
      g.gain.setValueAtTime(0, start)
      g.gain.linearRampToValueAtTime(0.25, start + 0.04)
      g.gain.exponentialRampToValueAtTime(0.001, start + 0.45)
      o.start(start); o.stop(start + 0.46)
    })
  } catch {}
}

export default function OrdersPage() {
  const router = useRouter()
  usePushNotifications(true) // Subscribe so order status updates reach customer
  const [orders, setOrders] = useState([])
  const [ratings, setRatings] = useState({})
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  const [estimatedTime, setEstimatedTime] = useState(45)
  const [expandedOrder, setExpandedOrder] = useState(null)
  const [orderItems, setOrderItems] = useState({})
  const [reorderLoading, setReorderLoading] = useState(null)
  const [showNotifDrawer, setShowNotifDrawer] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const pollRef = useRef(null)
  const notifPollRef = useRef(null)
  const lastUnreadRef = useRef(0)

  // Fetch unread notification count
  const fetchUnread = async () => {
    try {
      const d = await fetch('/api/notifications').then(r => r.json())
      const count = d.unreadCount || 0
      // New notification arrived → play sound
      if (count > lastUnreadRef.current && lastUnreadRef.current !== -1) playNotifSound()
      lastUnreadRef.current = count
      setUnreadCount(count)
    } catch {}
  }

  // Listen for SW push messages → play sound
  useEffect(() => {
    if (!navigator.serviceWorker) return
    const handler = (e) => {
      if (e.data?.type === 'PLAY_NOTIFICATION_SOUND') {
        playNotifSound()
        // Refresh unread count
        fetchUnread()
      }
    }
    navigator.serviceWorker.addEventListener('message', handler)
    return () => navigator.serviceWorker.removeEventListener('message', handler)
  }, [])

  const loadOrders = () =>
    fetch('/api/orders').then(r => r.json()).then(d => setOrders(d.orders || []))

  useEffect(() => {
    Promise.all([
      fetch('/api/auth', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({action:'me'}) }).then(r => r.json()),
      fetch('/api/orders').then(r => r.json()),
      fetch('/api/admin').then(r => r.json()),
    ]).then(([authData, ordersData, settingsData]) => {
      if (!authData.user || authData.user.role !== 'customer') { router.push('/login'); return }
      setUser(authData.user)
      const loaded = ordersData.orders || []
      setOrders(loaded)
      setEstimatedTime(settingsData.settings?.estimated_time || 45)
      setLoading(false)

      // Ratings fetch karo delivered orders ke liye
      loaded.filter(o => o.status === 'delivered').forEach(o => {
        fetch(`/api/ratings?orderId=${o.id}`).then(r => r.json()).then(d => {
          if (d.rating) setRatings(prev => ({ ...prev, [o.id]: d.rating }))
        })
      })
    })

    pollRef.current = setInterval(loadOrders, 15000)
    // Poll for new notifications every 20s
    lastUnreadRef.current = -1 // skip first sound
    fetchUnread().then(() => { lastUnreadRef.current = unreadCount })
    notifPollRef.current = setInterval(fetchUnread, 20000)
    return () => { clearInterval(pollRef.current); clearInterval(notifPollRef.current) }
  }, [])

  const loadOrderItems = async (orderId) => {
    if (expandedOrder === orderId) { setExpandedOrder(null); return }
    if (!orderItems[orderId]) {
      const data = await fetch(`/api/orders?id=${orderId}`).then(r => r.json())
      setOrderItems(prev => ({ ...prev, [orderId]: data.order?.items || [] }))
    }
    setExpandedOrder(orderId)
  }

  const openBill = async (order) => {
    // Load items if not already fetched
    let its = orderItems[order.id]
    if (!its) {
      const data = await fetch(`/api/orders?id=${order.id}`).then(r => r.json())
      its = data.order?.items || []
      setOrderItems(prev => ({ ...prev, [order.id]: its }))
    }
    viewBill(order, its)
  }

  const reorder = async (orderId) => {
    setReorderLoading(orderId)
    try {
      const data = await fetch(`/api/orders?id=${orderId}`).then(r => r.json())
      const items = data.order?.items || []
      if (!items.length) return
      const cart = {}
      items.forEach(item => { if (item.menu_item_id) cart[item.menu_item_id] = item.quantity })
      localStorage.setItem('ck_cart', JSON.stringify(cart))
      router.push('/menu')
    } finally { setReorderLoading(null) }
  }

  const logout = async () => {
    await fetch('/api/auth', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({action:'logout'}) })
    router.push('/login')
  }

  const activeOrders = orders.filter(o => !['delivered','cancelled'].includes(o.status))
  const pastOrders   = orders.filter(o =>  ['delivered','cancelled'].includes(o.status))

  if (loading) return <div className={styles.loading}><div className={styles.spinner} /></div>

  return (
    <div className={styles.page}>
      <nav className={styles.nav}>
        <span className={styles.logo}>🍽️ <span style={{color:'#e85d04'}}>Food</span>Fi</span>
        <div className={styles.navRight}>
          <button className={styles.navBtn} onClick={() => router.push('/menu')}>← Menu</button>
          <span className={styles.greeting}>Hi, {user?.name?.split(' ')[0]}</span>
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
          <button className={styles.navBtn} onClick={logout}>Logout</button>
        </div>
      </nav>

      {/* Notification Drawer */}
      {showNotifDrawer && <NotificationDrawer onClose={() => setShowNotifDrawer(false)} />}

      <div className={styles.container}>
        <h2 className={styles.title}>My Orders</h2>

        {orders.length === 0 ? (
          <div className={styles.empty}>
            <p>Koi order nahi mila abhi tak.</p>
            <button className={styles.menuBtn} onClick={() => router.push('/menu')}>Order karo →</button>
          </div>
        ) : (
          <>
            {activeOrders.length > 0 && (
              <>
                <h3 style={{ fontSize:14, fontWeight:700, color:'#374151', marginBottom:12, display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ width:8, height:8, borderRadius:'50%', background:'#22c55e', display:'inline-block' }} />
                  Live Orders ({activeOrders.length})
                </h3>
                <div className={styles.orderList} style={{ marginBottom:28 }}>
                  {activeOrders.map(order => (
                    <OrderCard key={order.id} order={order} estimatedTime={estimatedTime}
                      expanded={expandedOrder===order.id} items={orderItems[order.id]}
                      rating={ratings[order.id]}
                      onExpand={() => loadOrderItems(order.id)}
                      onBill={() => openBill(order)}
                      onReorder={() => reorder(order.id)}
                      reorderLoading={reorderLoading===order.id}
                      onRated={r => setRatings(prev => ({...prev, [order.id]:{rating:r}}))}
                    />
                  ))}
                </div>
              </>
            )}
            {pastOrders.length > 0 && (
              <>
                <h3 style={{ fontSize:14, fontWeight:700, color:'#374151', marginBottom:12 }}>Order History</h3>
                <div className={styles.orderList}>
                  {pastOrders.map(order => (
                    <OrderCard key={order.id} order={order} estimatedTime={estimatedTime}
                      expanded={expandedOrder===order.id} items={orderItems[order.id]}
                      rating={ratings[order.id]}
                      onExpand={() => loadOrderItems(order.id)}
                      onBill={() => openBill(order)}
                      onReorder={() => reorder(order.id)}
                      reorderLoading={reorderLoading===order.id}
                      onRated={r => setRatings(prev => ({...prev, [order.id]:{rating:r}}))}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

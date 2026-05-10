'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import styles from './admin.module.css'

const SECTIONS = [
  { id: 'orders',   label: '📋 Orders',           badge: 'orders' },
  { id: 'menu',     label: '🍛 Menu Items' },
  { id: 'offers',   label: '🏷️ Offers' },
  { id: 'boys',     label: '🛵 Delivery Boys' },
  { id: 'apps',     label: '📝 Applications',     badge: 'apps' },
  { id: 'kitchen',  label: '⚙️ Kitchen Settings' },
  { id: 'pricing',  label: '📏 KM Pricing' },
  { id: 'customers',label: '👥 Customers' },
  { id: 'analytics',label: '📊 Analytics' },
]

export default function AdminPage() {
  const router = useRouter()
  const [section, setSection] = useState('orders')
  const [kitchenOpen, setKitchenOpen] = useState(true)
  const [kitchenSettings, setKitchenSettings] = useState({ kitchen_name:'', address:'', phone:'', lat:'', lng:'', max_delivery_km:5, open_time:'09:00', close_time:'22:00', estimated_time:45, auto_schedule:false })
  const [orders, setOrders] = useState([])
  const [menuItems, setMenuItems] = useState([])
  const [offers, setOffers] = useState([])
  const [boys, setBoys] = useState([])
  const [pendingBoys, setPendingBoys] = useState([])
  const [pricing, setPricing] = useState([])
  const [analytics, setAnalytics] = useState(null)
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddItem, setShowAddItem] = useState(false)
  const [showAddOffer, setShowAddOffer] = useState(false)
  const [showOrderDetail, setShowOrderDetail] = useState(false)
  const [orderDetail, setOrderDetail] = useState(null)
  const [showManualOrder, setShowManualOrder] = useState(false)
  const [manualOrder, setManualOrder] = useState({ customerName:'', customerPhone:'', address:'', notes:'', deliveryCharge:30, items:{} })
  const [newItem, setNewItem] = useState({ name:'', description:'', price:'', discount_percent:0, category:'Rice Combos', is_veg:true })
  const [newOffer, setNewOffer] = useState({ code:'', type:'percent', value:'', min_order:'', max_uses:1000, valid_till:'' })
  const [statusFilter, setStatusFilter] = useState('all')
  const [notifCount, setNotifCount] = useState(0)
  const [toast, setToast] = useState('')
  const lastOrderCount = useRef(0)
  const lastAppCount = useRef(0)

  const playAlert = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      ;[880, 1100, 880].forEach((freq, i) => {
        const osc = ctx.createOscillator(), g = ctx.createGain()
        osc.connect(g); g.connect(ctx.destination)
        osc.frequency.value = freq
        g.gain.setValueAtTime(0.5, ctx.currentTime + i * 0.22)
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.22 + 0.18)
        osc.start(ctx.currentTime + i * 0.22)
        osc.stop(ctx.currentTime + i * 0.22 + 0.2)
      })
    } catch (e) {}
  }

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3500) }

  useEffect(() => {
    fetch('/api/auth', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'me' }) })
      .then(r => r.json()).then(({ user }) => { if (!user || user.role !== 'admin') router.push('/login') })
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') Notification.requestPermission()
    loadAll()

    // Auto-poll every 10s
    const interval = setInterval(async () => {
      try {
        const [ordRes, appRes] = await Promise.all([
          fetch('/api/orders').then(r => r.json()),
          fetch('/api/admin?type=pending_boys').then(r => r.json()),
        ])
        const latest = ordRes.orders || []
        const activeCount = latest.filter(o => !['delivered','cancelled'].includes(o.status)).length
        if (lastOrderCount.current > 0 && activeCount > lastOrderCount.current) {
          playAlert()
          setNotifCount(n => n + (activeCount - lastOrderCount.current))
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            new Notification('🍽️ Naya Order!', { body: 'CloudKitchen pe naya order aa gaya!', icon: '/favicon.ico' })
          }
          showToast('🔔 Naya order aa gaya!')
        }
        lastOrderCount.current = activeCount
        setOrders(latest)

        const apps = appRes.boys || []
        if (lastAppCount.current > 0 && apps.length > lastAppCount.current) showToast('📝 Naya delivery boy application!')
        lastAppCount.current = apps.length
        setPendingBoys(apps)
      } catch (e) {}
    }, 10000)

    return () => clearInterval(interval)
  }, [])

  const loadAll = async () => {
    setLoading(true)
    const [settingsRes, ordersRes, menuRes, offersRes, boysRes, pendingRes, pricingRes, analyticsRes, customersRes] = await Promise.all([
      fetch('/api/admin').then(r => r.json()),
      fetch('/api/orders').then(r => r.json()),
      fetch('/api/menu?admin=true').then(r => r.json()),
      fetch('/api/admin?type=offers').then(r => r.json()),
      fetch('/api/admin?type=delivery_boys').then(r => r.json()),
      fetch('/api/admin?type=pending_boys').then(r => r.json()),
      fetch('/api/admin?type=pricing').then(r => r.json()),
      fetch('/api/admin?type=analytics').then(r => r.json()),
      fetch('/api/admin?type=customers').then(r => r.json()),
    ])
    const s = settingsRes.settings || {}
    setKitchenOpen(s.is_open ?? true)
    setKitchenSettings({ kitchen_name: s.kitchen_name||'', address: s.address||'', phone: s.phone||'', lat: s.lat||'', lng: s.lng||'', max_delivery_km: s.max_delivery_km||5, open_time: s.open_time||'09:00', close_time: s.close_time||'22:00', estimated_time: s.estimated_time||45, auto_schedule: s.auto_schedule||false })
    const loadedOrders = ordersRes.orders || []
    setOrders(loadedOrders)
    lastOrderCount.current = loadedOrders.filter(o => !['delivered','cancelled'].includes(o.status)).length
    setMenuItems(menuRes.items || [])
    setOffers(offersRes.offers || [])
    setBoys(boysRes.boys || [])
    const apps = pendingRes.boys || []
    setPendingBoys(apps)
    lastAppCount.current = apps.length
    setPricing(pricingRes.pricing || [])
    setAnalytics(analyticsRes)
    setCustomers(customersRes.customers || [])
    setLoading(false)
  }

  const toggleKitchen = async () => {
    const newVal = !kitchenOpen; setKitchenOpen(newVal)
    await fetch('/api/admin', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ type:'kitchen', is_open:newVal }) })
    showToast(newVal ? '✅ Kitchen OPEN hai' : '🔴 Kitchen CLOSED hai')
  }

  const saveKitchenSettings = async () => {
    await fetch('/api/admin', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ type:'kitchen', ...kitchenSettings }) })
    showToast('✅ Kitchen settings save ho gayi!')
  }

  const updateOrderStatus = async (orderId, status) => {
    await fetch('/api/orders', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ orderId, status }) })
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o))
  }

  const assignBoy = async (orderId, boyId) => {
    await fetch('/api/orders', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ orderId, deliveryBoyId: boyId }) })
    const boy = boys.find(b => b.id === boyId)
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, delivery_boy_id: boyId, delivery_boy_name: boy?.name } : o))
    showToast('✅ Delivery boy assign ho gaya!')
  }

  const openOrderDetail = async (orderId) => {
    const res = await fetch(`/api/orders?id=${orderId}`).then(r => r.json())
    setOrderDetail(res.order); setShowOrderDetail(true)
  }

  const submitManualOrder = async (e) => {
    e.preventDefault()
    if (!Object.values(manualOrder.items).some(q => q > 0)) { showToast('❌ Kam se kam ek item select karo'); return }
    showToast('⏳ Order create ho raha hai...')
    const res = await fetch('/api/orders/manual', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(manualOrder) })
    const data = await res.json()
    if (!res.ok) { showToast('❌ ' + data.error); return }
    setShowManualOrder(false)
    setManualOrder({ customerName:'', customerPhone:'', address:'', notes:'', deliveryCharge:30, items:{} })
    loadAll()
    showToast(`✅ Manual order #${data.orderNumber} create ho gaya!`)
  }

  const approveDeliveryBoy = async (id) => {
    await fetch('/api/admin', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ type:'approve_boy', id }) })
    setPendingBoys(prev => prev.filter(b => b.id !== id))
    showToast('✅ Delivery boy approved!')
    loadAll()
  }

  const rejectDeliveryBoy = async (id) => {
    if (!confirm('Is application ko reject karna chahte ho?')) return
    await fetch('/api/admin', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ type:'reject_boy', id }) })
    setPendingBoys(prev => prev.filter(b => b.id !== id))
    showToast('🗑️ Application reject ho gayi')
  }

  const suspendBoy = async (id) => {
    if (!confirm('Is delivery boy ko suspend karna chahte ho?')) return
    await fetch('/api/admin', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ type:'suspend_boy', id }) })
    showToast('🚫 Delivery boy suspend ho gaya')
    loadAll()
  }

  const reactivateBoy = async (id) => {
    await fetch('/api/admin', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ type:'reactivate_boy', id }) })
    showToast('✅ Delivery boy reactivate ho gaya')
    loadAll()
  }

  const toggleMenuItem = async (itemId, val) => {
    await fetch('/api/menu', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id:itemId, is_available:val }) })
    setMenuItems(prev => prev.map(m => m.id === itemId ? { ...m, is_available:val } : m))
  }

  const updateItemPrice = async (itemId, price, disc) => {
    await fetch('/api/menu', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id:itemId, price:parseFloat(price), discount_percent:parseInt(disc) }) })
    showToast('✅ Price update ho gayi!')
  }

  const addNewItem = async (e) => {
    e.preventDefault()
    await fetch('/api/menu', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(newItem) })
    setShowAddItem(false)
    setNewItem({ name:'', description:'', price:'', discount_percent:0, category:'Rice Combos', is_veg:true })
    await loadAll()
    showToast('✅ Item add ho gaya!')
  }

  const addNewOffer = async (e) => {
    e.preventDefault()
    await fetch('/api/admin', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ type:'offer', ...newOffer }) })
    setShowAddOffer(false)
    setNewOffer({ code:'', type:'percent', value:'', min_order:'', max_uses:1000, valid_till:'' })
    await loadAll()
    showToast('✅ Offer create ho gaya!')
  }

  const savePricing = async () => {
    await fetch('/api/admin', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ type:'pricing', rows:pricing }) })
    showToast('✅ Pricing save ho gayi!')
  }

  const logout = async () => {
    await fetch('/api/auth', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'logout' }) })
    router.push('/login')
  }

  const filteredOrders = statusFilter === 'all' ? orders : orders.filter(o => o.status === statusFilter)
  const pendingCount = orders.filter(o => !['delivered','cancelled'].includes(o.status)).length

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}><div className="spinner" /></div>

  return (
    <div className={styles.page}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarLogo}>⚙️ Admin Panel</div>
        {SECTIONS.map(s => (
          <button key={s.id} className={`${styles.sideLink} ${section === s.id ? styles.active : ''}`} onClick={() => { setSection(s.id); if(s.id==='orders') setNotifCount(0) }}>
            {s.label}
            {s.badge === 'orders' && pendingCount > 0 && <span className={styles.sideBadge}>{pendingCount}</span>}
            {s.badge === 'apps' && pendingBoys.length > 0 && <span className={styles.sideBadge}>{pendingBoys.length}</span>}
          </button>
        ))}
        <button className={styles.logoutBtn} onClick={logout}>🚪 Logout</button>
      </aside>

      {/* Main */}
      <main className={styles.main}>
        {/* Top bar */}
        <div className={styles.kitchenCard}>
          <div>
            <strong>🍽️ {kitchenSettings.kitchen_name || 'Kitchen'}</strong>
            <p style={{ fontSize:12, color:'var(--t2)', marginTop:3 }}>Toggle to open or close ordering</p>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:16 }}>
            {notifCount > 0 && (
              <div style={{ background:'#dc2626', color:'#fff', borderRadius:20, padding:'4px 12px', fontSize:13, fontWeight:700, cursor:'pointer' }} onClick={() => { setSection('orders'); setNotifCount(0) }}>
                🔔 {notifCount} New Order{notifCount > 1 ? 's' : ''}
              </div>
            )}
            <div className={styles.bigToggle}>
              <div className={`${styles.bigTrack} ${kitchenOpen ? styles.on : ''}`} onClick={toggleKitchen}><div className={styles.bigKnob} /></div>
              <span style={{ fontWeight:600, color: kitchenOpen ? 'var(--gr-d)' : 'var(--rd)', fontSize:14 }}>{kitchenOpen ? 'Open' : 'Closed'}</span>
            </div>
          </div>
        </div>

        {/* ── ORDERS ── */}
        {section === 'orders' && (
          <>
            <div className={styles.statsRow}>
              {[['Today Orders', analytics?.todayStats?.today_orders ?? '-',''],['Revenue',`₹${Math.round(analytics?.todayStats?.today_revenue??0)}`,''],['Pending',analytics?.todayStats?.pending_orders??'-','var(--am)'],['Delivered',(analytics?.todayStats?.today_orders-analytics?.todayStats?.pending_orders)||0,'var(--gr-d)']].map(([label,val,col])=>(
                <div key={label} className={styles.statCard}><div className={styles.statLabel}>{label}</div><div className={styles.statVal} style={{color:col||'var(--t1)'}}>{val}</div></div>
              ))}
            </div>
            <div className={styles.sectionHead}>
              <h2>Live Orders</h2>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
                <button className="btn btn-primary" style={{ fontSize:12 }} onClick={() => setShowManualOrder(true)}>📞 Phone Order</button>
                <div className={styles.filters}>
                  {['all','pending','preparing','out_for_delivery','delivered'].map(f => (
                    <button key={f} className={`${styles.fChip} ${statusFilter===f?styles.active:''}`} onClick={() => setStatusFilter(f)}>
                      {f==='all'?'All':f==='out_for_delivery'?'Out':f.charAt(0).toUpperCase()+f.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className={styles.table}>
              <div className={`${styles.tHead} ${styles.ordCols}`}><span>Order</span><span>Customer</span><span>Amount</span><span>Time</span><span>Status</span><span>Delivery Boy</span></div>
              {filteredOrders.map(o => (
                <div key={o.id} className={`${styles.tRow} ${styles.ordCols}`}>
                  <span className={styles.orderId} style={{ cursor:'pointer', textDecoration:'underline', color:'var(--bl)' }} onClick={() => openOrderDetail(o.id)}>#{o.order_number}</span>
                  <div>
                    <div style={{ fontWeight:500, fontSize:12 }}>{o.customer_name}</div>
                    <div style={{ fontSize:11, color:'var(--t2)' }}>{o.customer_phone}</div>
                    <div style={{ fontSize:10, color:'var(--t3)' }}>📍 {o.delivery_address?.slice(0,30)}...</div>
                  </div>
                  <span style={{ fontWeight:500 }}>₹{Math.round(o.total)}</span>
                  <span style={{ fontSize:11, color:'var(--t2)' }}>{new Date(o.created_at).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</span>
                  <select className={styles.statSel} value={o.status} onChange={e => updateOrderStatus(o.id, e.target.value)}>
                    {['pending','confirmed','preparing','out_for_delivery','delivered','cancelled'].map(s => (
                      <option key={s} value={s}>{s.replace('_',' ')}</option>
                    ))}
                  </select>
                  <div>
                    {o.delivery_boy_name && <div style={{ fontSize:11, color:'var(--bl)', fontWeight:600, marginBottom:4 }}>✅ {o.delivery_boy_name}</div>}
                    {(() => {
                      const onlineBoys = boys.filter(b => b.is_online)
                      if (!onlineBoys.length) return <span style={{ fontSize:11, color:'var(--rd)' }}>⚫ Koi Online Nahi</span>
                      return <select className={styles.statSel} onChange={e => e.target.value && assignBoy(o.id, e.target.value)} value="">
                        <option value="">{o.delivery_boy_name ? '↺ Change' : 'Assign'}</option>
                        {onlineBoys.map(b => <option key={b.id} value={b.id}>🟢 {b.name}</option>)}
                      </select>
                    })()}
                  </div>
                </div>
              ))}
              {filteredOrders.length === 0 && <div style={{ padding:'24px', textAlign:'center', color:'var(--t2)' }}>Koi order nahi mila</div>}
            </div>
          </>
        )}

        {/* ── MENU ── */}
        {section === 'menu' && (
          <>
            <div className={styles.sectionHead}><h2>Menu Items</h2><button className="btn btn-primary" onClick={() => setShowAddItem(true)}>+ Add Item</button></div>
            <div className={styles.menuGrid}>
              {menuItems.map(item => (
                <div key={item.id} className={styles.menuCard}>
                  {item.image_url && <img src={item.image_url} alt={item.name} style={{ width:'100%', height:100, objectFit:'cover', borderRadius:8, marginBottom:8 }} />}
                  <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:4 }}>
                    <span className={`veg-dot ${item.is_veg?'veg':'nonveg'}`} />
                    <strong style={{ fontSize:12 }}>{item.name}</strong>
                  </div>
                  <span className={styles.catTag}>{item.category}</span>
                  <div className={styles.priceEdit}>
                    <label style={{ fontSize:11, color:'var(--t2)' }}>₹ Price</label>
                    <input type="number" defaultValue={item.price} className={styles.priceInput} id={`price-${item.id}`} />
                    <label style={{ fontSize:11, color:'var(--t2)' }}>Disc%</label>
                    <input type="number" defaultValue={item.discount_percent} className={styles.priceInput} id={`disc-${item.id}`} />
                  </div>
                  <button className="btn btn-secondary" style={{ fontSize:11, padding:'4px 10px', marginBottom:8, width:'100%' }} onClick={() => updateItemPrice(item.id, document.getElementById(`price-${item.id}`).value, document.getElementById(`disc-${item.id}`).value)}>Save Price</button>
                  <div className={styles.availToggle}>
                    <div className={`switch ${item.is_available?'on':''}`} onClick={() => toggleMenuItem(item.id, !item.is_available)} />
                    <span style={{ fontSize:12, color:'var(--t2)' }}>{item.is_available?'Available':'Unavailable'}</span>
                  </div>
                </div>
              ))}
            </div>
            {showAddItem && (
              <div className={styles.modalBg} onClick={e => e.target===e.currentTarget && setShowAddItem(false)}>
                <div className={styles.modal}>
                  <h3>Add New Item</h3>
                  <form onSubmit={addNewItem}>
                    <div className="field"><label>Item Name</label><input required value={newItem.name} onChange={e => setNewItem({...newItem, name:e.target.value})} /></div>
                    <div className="field"><label>Description</label><input value={newItem.description} onChange={e => setNewItem({...newItem, description:e.target.value})} /></div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                      <div className="field"><label>Price (₹)</label><input required type="number" value={newItem.price} onChange={e => setNewItem({...newItem, price:e.target.value})} /></div>
                      <div className="field"><label>Discount %</label><input type="number" value={newItem.discount_percent} onChange={e => setNewItem({...newItem, discount_percent:e.target.value})} /></div>
                    </div>
                    <div className="field"><label>Category</label><select value={newItem.category} onChange={e => setNewItem({...newItem, category:e.target.value})}><option>Rice Combos</option><option>Fried Rice Combos</option><option>Roti &amp; Puri Combos</option><option>Add-Ons</option></select></div>
                    <div style={{ display:'flex', gap:8 }}>
                      <button type="button" className="btn btn-secondary" style={{ flex:1 }} onClick={() => setShowAddItem(false)}>Cancel</button>
                      <button type="submit" className="btn btn-primary" style={{ flex:1 }}>Add Item</button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── OFFERS ── */}
        {section === 'offers' && (
          <>
            <div className={styles.sectionHead}><h2>Active Offers</h2><button className="btn btn-primary" onClick={() => setShowAddOffer(true)}>+ New Offer</button></div>
            <div className={styles.offerGrid}>
              {offers.map(o => (
                <div key={o.id} className={styles.offerCard}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                    <strong style={{ fontSize:16, color:'var(--or)' }}>{o.code}</strong>
                    <span className={`badge ${o.is_active?'badge-done':'badge-cancelled'}`}>{o.is_active?'Active':'Inactive'}</span>
                  </div>
                  <p style={{ fontSize:12, color:'var(--t2)', marginBottom:6 }}>{o.type==='flat'?`₹${o.value} off`:o.type==='percent'?`${o.value}% off`:'Free delivery'} · Min ₹{o.min_order}</p>
                  <p style={{ fontSize:11, color:'var(--t3)' }}>Used {o.used_count}/{o.max_uses} times</p>
                  <div style={{ display:'flex', gap:6, marginTop:10 }}>
                    <button className="btn btn-secondary" style={{ flex:1, fontSize:11, padding:'5px 8px' }}
                      onClick={async () => { await fetch('/api/admin',{ method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({type:'offer',id:o.id,is_active:!o.is_active}) }); await loadAll() }}>
                      {o.is_active?'Disable':'Enable'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {showAddOffer && (
              <div className={styles.modalBg} onClick={e => e.target===e.currentTarget && setShowAddOffer(false)}>
                <div className={styles.modal}>
                  <h3>Create Offer</h3>
                  <form onSubmit={addNewOffer}>
                    <div className="field"><label>Offer Code</label><input required value={newOffer.code} onChange={e => setNewOffer({...newOffer, code:e.target.value.toUpperCase()})} placeholder="SAVE50" /></div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                      <div className="field"><label>Type</label><select value={newOffer.type} onChange={e => setNewOffer({...newOffer, type:e.target.value})}><option value="percent">% Discount</option><option value="flat">Flat Discount</option><option value="free_delivery">Free Delivery</option></select></div>
                      <div className="field"><label>Value</label><input required type="number" value={newOffer.value} onChange={e => setNewOffer({...newOffer, value:e.target.value})} /></div>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                      <div className="field"><label>Min Order ₹</label><input type="number" value={newOffer.min_order} onChange={e => setNewOffer({...newOffer, min_order:e.target.value})} /></div>
                      <div className="field"><label>Max Uses</label><input type="number" value={newOffer.max_uses} onChange={e => setNewOffer({...newOffer, max_uses:e.target.value})} /></div>
                    </div>
                    <div className="field"><label>Valid Till</label><input type="date" value={newOffer.valid_till} onChange={e => setNewOffer({...newOffer, valid_till:e.target.value})} /></div>
                    <div style={{ display:'flex', gap:8 }}>
                      <button type="button" className="btn btn-secondary" style={{ flex:1 }} onClick={() => setShowAddOffer(false)}>Cancel</button>
                      <button type="submit" className="btn btn-primary" style={{ flex:1 }}>Launch Offer</button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── DELIVERY BOYS ── */}
        {section === 'boys' && (
          <>
            <div className={styles.sectionHead}>
              <h2>Delivery Boys</h2>
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <span style={{ fontSize:12, padding:'4px 10px', borderRadius:12, background:'#dcfce7', color:'#16a34a', fontWeight:600 }}>🟢 {boys.filter(b=>b.is_online).length} Online</span>
                <span style={{ fontSize:12, padding:'4px 10px', borderRadius:12, background:'#fee2e2', color:'#dc2626', fontWeight:600 }}>⚫ {boys.filter(b=>!b.is_online).length} Offline</span>
              </div>
            </div>
            <div className={styles.table}>
              <div className={`${styles.tHead}`} style={{ gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr 1fr' }}><span>Name</span><span>Phone</span><span>Vehicle</span><span>Earnings</span><span>Status</span><span>Action</span></div>
              {boys.map(b => (
                <div key={b.id} className={`${styles.tRow}`} style={{ gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr 1fr' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <div className={styles.boyAvatar}>{b.name.split(' ').map(n=>n[0]).join('')}</div>
                    <div><div style={{ fontSize:13, fontWeight:500 }}>{b.name}</div><div style={{ fontSize:11, color:'var(--t2)' }}>{b.email}</div></div>
                  </div>
                  <span style={{ fontSize:12, color:'var(--t2)' }}>{b.phone}</span>
                  <span style={{ fontSize:12 }}>{b.vehicle_number}</span>
                  <span style={{ fontWeight:500 }}>₹{Math.round(b.total_earnings||0)}</span>
                  <span className={`badge ${b.is_online?'badge-done':'badge-cancelled'}`}>{b.is_online?'Online':'Offline'}</span>
                  <button className="btn btn-secondary" style={{ fontSize:11, padding:'4px 8px', background:'#fef2f2', color:'#dc2626', border:'1px solid #fca5a5' }}
                    onClick={() => suspendBoy(b.id)}>🚫 Suspend</button>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── APPLICATIONS ── */}
        {section === 'apps' && (
          <>
            <div className={styles.sectionHead}><h2>Delivery Boy Applications</h2><span style={{ fontSize:12, color:'var(--t2)' }}>{pendingBoys.length} pending</span></div>
            {pendingBoys.length === 0 ? (
              <div style={{ padding:'40px', textAlign:'center', color:'var(--t2)' }}>✅ Koi pending application nahi hai</div>
            ) : (
              pendingBoys.map(b => (
                <div key={b.id} style={{ background:'var(--card)', borderRadius:14, padding:'18px 20px', marginBottom:12, border:'1.5px solid var(--bdr)' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
                    <div>
                      <div style={{ fontSize:16, fontWeight:700 }}>{b.name}</div>
                      <div style={{ fontSize:12, color:'var(--t2)', marginTop:2 }}>Applied: {new Date(b.created_at).toLocaleDateString('en-IN')}</div>
                    </div>
                    <span className="badge badge-new">Pending</span>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(180px, 1fr))', gap:'8px 16px', fontSize:12, color:'var(--t1)', marginBottom:14 }}>
                    <div><span style={{ color:'var(--t2)' }}>📧 Email: </span>{b.email}</div>
                    <div><span style={{ color:'var(--t2)' }}>📱 Phone: </span>{b.phone}</div>
                    <div><span style={{ color:'var(--t2)' }}>🛵 Vehicle: </span>{b.vehicle_number} ({b.vehicle_type})</div>
                    <div><span style={{ color:'var(--t2)' }}>🪪 License: </span>{b.license_number || '—'}</div>
                    <div><span style={{ color:'var(--t2)' }}>🆔 Aadhar: </span>{b.aadhar_number || '—'}</div>
                    <div><span style={{ color:'var(--t2)' }}>🎂 DOB: </span>{b.date_of_birth ? new Date(b.date_of_birth).toLocaleDateString('en-IN') : '—'}</div>
                    <div><span style={{ color:'var(--t2)' }}>🆘 Emergency: </span>{b.emergency_contact || '—'}</div>
                    <div style={{ gridColumn:'1/-1' }}><span style={{ color:'var(--t2)' }}>🏠 Address: </span>{b.home_address || '—'}</div>
                  </div>
                  <div style={{ display:'flex', gap:10 }}>
                    <button className="btn btn-primary" style={{ flex:1 }} onClick={() => approveDeliveryBoy(b.id)}>✅ Approve</button>
                    <button className="btn btn-secondary" style={{ flex:1, color:'var(--rd)', borderColor:'#fca5a5' }} onClick={() => rejectDeliveryBoy(b.id)}>❌ Reject</button>
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {/* ── KITCHEN SETTINGS ── */}
        {section === 'kitchen' && (
          <>
            <div className={styles.sectionHead}><h2>⚙️ Kitchen Settings</h2><button className="btn btn-primary" onClick={saveKitchenSettings}>💾 Save All</button></div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
              <div style={{ background:'var(--card)', borderRadius:14, padding:'18px 20px', border:'1px solid var(--bdr)', gridColumn:'1/-1' }}>
                <h3 style={{ fontSize:14, fontWeight:700, marginBottom:14 }}>🏠 Basic Info</h3>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  <div className="field"><label>Kitchen Name</label><input value={kitchenSettings.kitchen_name} onChange={e => setKitchenSettings({...kitchenSettings, kitchen_name:e.target.value})} placeholder="HealthCare Cloud Kitchen" /></div>
                  <div className="field"><label>Phone Number</label><input value={kitchenSettings.phone} onChange={e => setKitchenSettings({...kitchenSettings, phone:e.target.value})} placeholder="+91 75469 83536" /></div>
                </div>
                <div className="field"><label>Address</label><input value={kitchenSettings.address} onChange={e => setKitchenSettings({...kitchenSettings, address:e.target.value})} placeholder="Road No 8, East Laxmi Nagar, Patna" /></div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  <div className="field"><label>Latitude</label><input type="number" step="any" value={kitchenSettings.lat} onChange={e => setKitchenSettings({...kitchenSettings, lat:e.target.value})} placeholder="25.5801392" /></div>
                  <div className="field"><label>Longitude</label><input type="number" step="any" value={kitchenSettings.lng} onChange={e => setKitchenSettings({...kitchenSettings, lng:e.target.value})} placeholder="85.1569214" /></div>
                </div>
              </div>

              <div style={{ background:'var(--card)', borderRadius:14, padding:'18px 20px', border:'1px solid var(--bdr)' }}>
                <h3 style={{ fontSize:14, fontWeight:700, marginBottom:14 }}>🚴 Delivery Settings</h3>
                <div className="field">
                  <label>Max Delivery Radius (km)</label>
                  <input type="number" value={kitchenSettings.max_delivery_km} onChange={e => setKitchenSettings({...kitchenSettings, max_delivery_km:e.target.value})} />
                  <p style={{ fontSize:11, color:'var(--t3)', marginTop:4 }}>Is radius se bahar ke customers order nahi kar payenge</p>
                </div>
                <div className="field">
                  <label>Estimated Delivery Time (min)</label>
                  <input type="number" value={kitchenSettings.estimated_time} onChange={e => setKitchenSettings({...kitchenSettings, estimated_time:e.target.value})} />
                </div>
              </div>

              <div style={{ background:'var(--card)', borderRadius:14, padding:'18px 20px', border:'1px solid var(--bdr)' }}>
                <h3 style={{ fontSize:14, fontWeight:700, marginBottom:14 }}>⏰ Kitchen Timing</h3>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                  <div className={`switch ${kitchenSettings.auto_schedule?'on':''}`} onClick={() => setKitchenSettings({...kitchenSettings, auto_schedule:!kitchenSettings.auto_schedule})} />
                  <span style={{ fontSize:13 }}>Auto Open/Close by Time</span>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  <div className="field"><label>Open Time</label><input type="time" value={kitchenSettings.open_time} onChange={e => setKitchenSettings({...kitchenSettings, open_time:e.target.value})} /></div>
                  <div className="field"><label>Close Time</label><input type="time" value={kitchenSettings.close_time} onChange={e => setKitchenSettings({...kitchenSettings, close_time:e.target.value})} /></div>
                </div>
                {kitchenSettings.auto_schedule && <p style={{ fontSize:11, color:'var(--gr-d)', marginTop:4 }}>✅ Kitchen {kitchenSettings.open_time} – {kitchenSettings.close_time} ke beech auto-open rahega</p>}
              </div>
            </div>
          </>
        )}

        {/* ── KM PRICING ── */}
        {section === 'pricing' && (
          <>
            <div className={styles.sectionHead}><h2>Delivery Pricing</h2><button className="btn btn-primary" onClick={savePricing}>Save Changes</button></div>
            <div className={styles.table}>
              <div className={`${styles.tHead}`} style={{ gridTemplateColumns:'1fr 1fr 1fr 1fr' }}><span>Range</span><span>Min KM</span><span>Base Charge (₹)</span><span>Per Extra KM (₹)</span></div>
              {pricing.map((row, i) => (
                <div key={row.id} className={styles.tRow} style={{ gridTemplateColumns:'1fr 1fr 1fr 1fr' }}>
                  <span style={{ fontWeight:500, fontSize:12 }}>{row.min_km} – {row.max_km??'∞'} km</span>
                  <span style={{ fontSize:12, color:'var(--t2)' }}>{row.min_km} km</span>
                  <input type="number" defaultValue={row.base_charge} className={styles.priceInput} onChange={e => { const p=[...pricing]; p[i]={...p[i],base_charge:e.target.value}; setPricing(p) }} />
                  <input type="number" defaultValue={row.per_km_charge} className={styles.priceInput} onChange={e => { const p=[...pricing]; p[i]={...p[i],per_km_charge:e.target.value}; setPricing(p) }} />
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── CUSTOMERS ── */}
        {section === 'customers' && (
          <>
            <div className={styles.sectionHead}><h2>Customers</h2><span style={{ fontSize:12, color:'var(--t2)' }}>{customers.length} registered</span></div>
            <div className={styles.table}>
              <div className={`${styles.tHead}`} style={{ gridTemplateColumns:'2fr 1.5fr 1fr 1fr 1fr 1.5fr' }}><span>Name</span><span>Phone</span><span>Orders</span><span>Total Spent</span><span>Joined</span><span>Last Order</span></div>
              {customers.map(c => (
                <div key={c.id} className={`${styles.tRow}`} style={{ gridTemplateColumns:'2fr 1.5fr 1fr 1fr 1fr 1.5fr' }}>
                  <div><div style={{ fontWeight:500, fontSize:13 }}>{c.name}</div><div style={{ fontSize:11, color:'var(--t2)' }}>{c.email}</div></div>
                  <span style={{ fontSize:12, color:'var(--t2)' }}>{c.phone||'—'}</span>
                  <span style={{ fontWeight:600, color:'var(--bl)' }}>{c.total_orders}</span>
                  <span style={{ fontWeight:600, color:'var(--gr-d)' }}>₹{Math.round(c.total_spent)}</span>
                  <span style={{ fontSize:11, color:'var(--t2)' }}>{new Date(c.created_at).toLocaleDateString('en-IN')}</span>
                  <span style={{ fontSize:11, color:'var(--t2)' }}>{c.last_order_at ? new Date(c.last_order_at).toLocaleDateString('en-IN') : '—'}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── ANALYTICS ── */}
        {section === 'analytics' && analytics && (
          <>
            <div className={styles.sectionHead}><h2>Analytics</h2><span style={{ fontSize:12, color:'var(--t2)' }}>Last 7 days</span></div>
            <div className={styles.statsRow}>
              {[['Total Orders (7d)',analytics.weekStats?.week_orders??'-',''],['Revenue (7d)',`₹${Math.round(analytics.weekStats?.week_revenue??0)}`,''],['Avg Order',`₹${Math.round((analytics.weekStats?.week_revenue??0)/Math.max(1,analytics.weekStats?.week_orders??1))}`,''],['Customers',analytics.customerCount??'-','']].map(([label,val])=>(
                <div key={label} className={styles.statCard}><div className={styles.statLabel}>{label}</div><div className={styles.statVal}>{val}</div></div>
              ))}
            </div>
            <div className={styles.table} style={{ padding:16 }}>
              <h3 style={{ fontSize:14, fontWeight:600, marginBottom:12 }}>Top Selling Items (7 days)</h3>
              {(analytics.topItems||[]).map((item,i)=>(
                <div key={i} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                  <span style={{ fontSize:12, minWidth:160 }}>{item.name}</span>
                  <div style={{ flex:1, background:'var(--bg)', borderRadius:4, height:8, overflow:'hidden' }}>
                    <div style={{ width:`${Math.round(item.total_qty/(analytics.topItems[0]?.total_qty||1)*100)}%`, height:'100%', background:'var(--or)', borderRadius:4 }} />
                  </div>
                  <span style={{ fontSize:11, color:'var(--t2)', minWidth:28, textAlign:'right' }}>{item.total_qty}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </main>

      {/* Order Detail Modal */}
      {showOrderDetail && orderDetail && (
        <div className={styles.modalBg} onClick={e => e.target===e.currentTarget && setShowOrderDetail(false)}>
          <div className={styles.modal} style={{ maxWidth:480 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <h3 style={{ margin:0 }}>Order #{orderDetail.order_number}</h3>
              <button onClick={() => setShowOrderDetail(false)} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer' }}>✕</button>
            </div>
            <div style={{ background:'var(--bg)', borderRadius:10, padding:'12px 14px', marginBottom:12 }}>
              <div style={{ fontSize:12, fontWeight:700, marginBottom:8, color:'var(--t2)' }}>👤 CUSTOMER</div>
              <div style={{ fontSize:13, fontWeight:600 }}>{orderDetail.customer_name}</div>
              <div style={{ fontSize:12, color:'var(--t2)' }}>{orderDetail.customer_phone}</div>
              <div style={{ fontSize:12, color:'var(--t3)', marginTop:4 }}>📍 {orderDetail.delivery_address}</div>
            </div>
            <div style={{ background:'var(--bg)', borderRadius:10, padding:'12px 14px', marginBottom:12 }}>
              <div style={{ fontSize:12, fontWeight:700, marginBottom:8, color:'var(--t2)' }}>📦 ITEMS</div>
              {(orderDetail.items||[]).map((item,i)=>(
                <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:6 }}>
                  <span>{item.name} <span style={{ color:'var(--t2)' }}>×{item.quantity}</span></span>
                  <span style={{ fontWeight:600 }}>₹{Math.round(item.price*item.quantity)}</span>
                </div>
              ))}
            </div>
            <div style={{ background:'var(--bg)', borderRadius:10, padding:'12px 14px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:4 }}><span>Subtotal</span><span>₹{Math.round(orderDetail.subtotal)}</span></div>
              {orderDetail.discount_amount>0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:4, color:'var(--gr-d)' }}><span>Discount</span><span>−₹{Math.round(orderDetail.discount_amount)}</span></div>}
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:4 }}><span>Delivery</span><span>₹{Math.round(orderDetail.delivery_charge)}</span></div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:15, fontWeight:700, marginTop:8, paddingTop:8, borderTop:'1px solid var(--bdr)' }}><span>Total (COD)</span><span style={{ color:'var(--or)' }}>₹{Math.round(orderDetail.total)}</span></div>
            </div>
            {orderDetail.notes && <div style={{ marginTop:10, fontSize:12, color:'var(--t2)', fontStyle:'italic' }}>📝 {orderDetail.notes}</div>}
          </div>
        </div>
      )}

      {/* Manual / Phone Order Modal */}
      {showManualOrder && (
        <div className={styles.modalBg} onClick={e => e.target===e.currentTarget && setShowManualOrder(false)}>
          <div className={styles.modal} style={{ maxWidth:500, maxHeight:'90vh', overflowY:'auto' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <h3 style={{ margin:0 }}>📞 Phone/WhatsApp Order</h3>
              <button onClick={() => setShowManualOrder(false)} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer' }}>✕</button>
            </div>
            <form onSubmit={submitManualOrder}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div className="field"><label>Customer Name</label><input required value={manualOrder.customerName} onChange={e => setManualOrder({...manualOrder, customerName:e.target.value})} placeholder="Rahul Kumar" /></div>
                <div className="field">
                  <label>Phone Number</label>
                  <div style={{ display:'flex', gap:0 }}>
                    <span style={{ padding:'8px 10px', background:'var(--bg)', border:'1px solid var(--bdr)', borderRight:'none', borderRadius:'8px 0 0 8px', fontSize:13, color:'var(--t2)', whiteSpace:'nowrap' }}>+91</span>
                    <input required value={manualOrder.customerPhone} onChange={e => setManualOrder({...manualOrder, customerPhone:'+91'+e.target.value.replace(/^\+91/,'')})} placeholder="98765 43210" style={{ borderRadius:'0 8px 8px 0' }} />
                  </div>
                </div>
              </div>
              <div className="field"><label>Delivery Address</label><input required value={manualOrder.address} onChange={e => setManualOrder({...manualOrder, address:e.target.value})} placeholder="Pura address daalo" /></div>
              <div className="field">
                <label>Items Select Karo</label>
                <div style={{ background:'var(--bg)', borderRadius:10, padding:'10px 12px', maxHeight:220, overflowY:'auto' }}>
                  {menuItems.filter(m=>m.is_available).map(item => {
                    const qty = manualOrder.items[item.id]||0
                    return (
                      <div key={item.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                        <div><div style={{ fontSize:13, fontWeight:500 }}>{item.name}</div><div style={{ fontSize:11, color:'var(--gr-d)' }}>₹{item.price}</div></div>
                        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                          <button type="button" onClick={() => { const ni={...manualOrder.items}; const q=Math.max(0,qty-1); if(q===0) delete ni[item.id]; else ni[item.id]=q; setManualOrder({...manualOrder,items:ni}) }} style={{ width:28, height:28, borderRadius:6, border:'1px solid var(--bdr)', background:'var(--card)', cursor:'pointer', fontWeight:700 }}>−</button>
                          <span style={{ minWidth:18, textAlign:'center', fontWeight:600 }}>{qty}</span>
                          <button type="button" onClick={() => setManualOrder({...manualOrder,items:{...manualOrder.items,[item.id]:qty+1}})} style={{ width:28, height:28, borderRadius:6, border:'1px solid var(--bdr)', background:qty>0?'var(--or)':'var(--card)', color:qty>0?'#fff':'inherit', cursor:'pointer', fontWeight:700 }}>+</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:10 }}>
                <div className="field"><label>Notes</label><input value={manualOrder.notes} onChange={e => setManualOrder({...manualOrder,notes:e.target.value})} placeholder="Less spicy..." /></div>
                <div className="field"><label>Delivery ₹</label><input type="number" value={manualOrder.deliveryCharge} onChange={e => setManualOrder({...manualOrder,deliveryCharge:e.target.value})} /></div>
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button type="button" className="btn btn-secondary" style={{ flex:1 }} onClick={() => setShowManualOrder(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flex:1 }}>✅ Order Create Karo</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && <div className={styles.toast}>{toast}</div>}
    </div>
  )
}

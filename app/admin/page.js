'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import styles from './admin.module.css'

const SECTIONS = [
  { id: 'orders', label: '📋 Orders', badge: true },
  { id: 'menu', label: '🍛 Menu Items' },
  { id: 'offers', label: '🏷️ Offers' },
  { id: 'boys', label: '🛵 Delivery Boys' },
  { id: 'pricing', label: '📏 KM Pricing' },
  { id: 'customers', label: '👥 Customers' },
  { id: 'analytics', label: '📊 Analytics' },
]

export default function AdminPage() {
  const router = useRouter()
  const [section, setSection] = useState('orders')
  const [kitchenOpen, setKitchenOpen] = useState(true)
  const [orders, setOrders] = useState([])
  const [menuItems, setMenuItems] = useState([])
  const [offers, setOffers] = useState([])
  const [boys, setBoys] = useState([])
  const [pricing, setPricing] = useState([])
  const [analytics, setAnalytics] = useState(null)
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddItem, setShowAddItem] = useState(false)
  const [showAddOffer, setShowAddOffer] = useState(false)
  const [showAddBoy, setShowAddBoy] = useState(false)
  const [newItem, setNewItem] = useState({ name:'', description:'', price:'', discount_percent:0, category:'Veg', is_veg:true })
  const [newOffer, setNewOffer] = useState({ code:'', type:'percent', value:'', min_order:'', max_uses:1000, valid_till:'' })
  const [newBoy, setNewBoy] = useState({ name:'', email:'', phone:'', vehicleNumber:'', password:'', perKmEarning:12 })
  const [statusFilter, setStatusFilter] = useState('all')
  const [toast, setToast] = useState('')

  useEffect(() => {
    fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'me' }) })
      .then(r => r.json())
      .then(({ user }) => { if (!user || user.role !== 'admin') router.push('/login') })

    loadAll()
  }, [])

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const loadAll = async () => {
    setLoading(true)
    const [settingsRes, ordersRes, menuRes, offersRes, boysRes, pricingRes, analyticsRes, customersRes] = await Promise.all([
      fetch('/api/admin').then(r => r.json()),
      fetch('/api/orders').then(r => r.json()),
      fetch('/api/menu?admin=true').then(r => r.json()),
      fetch('/api/admin?type=offers').then(r => r.json()),
      fetch('/api/admin?type=delivery_boys').then(r => r.json()),
      fetch('/api/admin?type=pricing').then(r => r.json()),
      fetch('/api/admin?type=analytics').then(r => r.json()),
      fetch('/api/admin?type=customers').then(r => r.json()),
    ])
    setKitchenOpen(settingsRes.settings?.is_open ?? true)
    setOrders(ordersRes.orders || [])
    setMenuItems(menuRes.items || [])
    setOffers(offersRes.offers || [])
    setBoys(boysRes.boys || [])
    setPricing(pricingRes.pricing || [])
    setAnalytics(analyticsRes)
    setCustomers(customersRes.customers || [])
    setLoading(false)
  }

  const toggleKitchen = async () => {
    const newVal = !kitchenOpen
    setKitchenOpen(newVal)
    await fetch('/api/admin', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'kitchen', is_open: newVal })
    })
    showToast(newVal ? '✅ Kitchen is now OPEN' : '🔴 Kitchen is now CLOSED')
  }

  const updateOrderStatus = async (orderId, status) => {
    await fetch('/api/orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, status })
    })
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o))
  }

  const assignBoy = async (orderId, boyId) => {
    await fetch('/api/orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, deliveryBoyId: boyId })
    })
    const boy = boys.find(b => b.id === boyId)
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, delivery_boy_id: boyId, delivery_boy_name: boy?.name } : o))
    showToast('✅ Delivery boy assigned!')
  }

  const toggleMenuItem = async (itemId, val) => {
    await fetch('/api/menu', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: itemId, is_available: val })
    })
    setMenuItems(prev => prev.map(m => m.id === itemId ? { ...m, is_available: val } : m))
  }

  const updateItemPrice = async (itemId, price, disc) => {
    await fetch('/api/menu', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: itemId, price: parseFloat(price), discount_percent: parseInt(disc) })
    })
    showToast('✅ Price updated!')
  }

  const addNewItem = async (e) => {
    e.preventDefault()
    await fetch('/api/menu', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newItem)
    })
    setShowAddItem(false)
    setNewItem({ name:'', description:'', price:'', discount_percent:0, category:'Veg', is_veg:true })
    loadAll()
    showToast('✅ Item added!')
  }

  const addNewOffer = async (e) => {
    e.preventDefault()
    await fetch('/api/admin', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'offer', ...newOffer })
    })
    setShowAddOffer(false)
    loadAll()
    showToast('✅ Offer created!')
  }

  const addNewBoy = async (e) => {
    e.preventDefault()
    await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'signup', role: 'delivery', ...newBoy })
    })
    setShowAddBoy(false)
    loadAll()
    showToast('✅ Delivery boy added!')
  }

  const savePricing = async () => {
    await fetch('/api/admin', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'pricing', rows: pricing })
    })
    showToast('✅ Pricing saved!')
  }

  const logout = async () => {
    await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'logout' }) })
    router.push('/login')
  }

  const filteredOrders = statusFilter === 'all' ? orders : orders.filter(o => o.status === statusFilter)
  const pendingCount = orders.filter(o => !['delivered', 'cancelled'].includes(o.status)).length

  const statusBadge = (s) => {
    const map = { pending: ['badge-new', 'New'], confirmed: ['badge-new', 'Confirmed'], preparing: ['badge-prep', 'Preparing'], out_for_delivery: ['badge-out', 'Out'], delivered: ['badge-done', 'Delivered'], cancelled: ['badge-cancelled', 'Cancelled'] }
    const [cls, label] = map[s] || ['badge-new', s]
    return <span className={`badge ${cls}`}>{label}</span>
  }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}><div className="spinner" /></div>

  return (
    <div className={styles.page}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarLogo}>⚙️ Admin Panel</div>
        {SECTIONS.map(s => (
          <button
            key={s.id}
            className={`${styles.sideLink} ${section === s.id ? styles.active : ''}`}
            onClick={() => setSection(s.id)}
          >
            {s.label}
            {s.badge && pendingCount > 0 && <span className={styles.sideBadge}>{pendingCount}</span>}
          </button>
        ))}
        <button className={styles.logoutBtn} onClick={logout}>🚪 Logout</button>
      </aside>

      {/* Main */}
      <main className={styles.main}>
        {/* Kitchen toggle — always visible */}
        <div className={styles.kitchenCard}>
          <div>
            <strong>🍽️ Kitchen Status</strong>
            <p style={{ fontSize: 12, color: 'var(--t2)', marginTop: 3 }}>Toggle to open or close ordering</p>
          </div>
          <div className={styles.bigToggle}>
            <div className={`${styles.bigTrack} ${kitchenOpen ? styles.on : ''}`} onClick={toggleKitchen}>
              <div className={styles.bigKnob} />
            </div>
            <span style={{ fontWeight: 600, color: kitchenOpen ? 'var(--gr-d)' : 'var(--rd)', fontSize: 14 }}>
              {kitchenOpen ? 'Open' : 'Closed'}
            </span>
          </div>
        </div>

        {/* ── ORDERS ── */}
        {section === 'orders' && (
          <>
            <div className={styles.statsRow}>
              {[['Today Orders', analytics?.todayStats?.today_orders ?? '-', ''], ['Revenue', `₹${Math.round(analytics?.todayStats?.today_revenue ?? 0)}`, ''], ['Pending', analytics?.todayStats?.pending_orders ?? '-', 'var(--am)'], ['Delivered', (analytics?.todayStats?.today_orders - analytics?.todayStats?.pending_orders) || 0, 'var(--gr-d)']].map(([label, val, col]) => (
                <div key={label} className={styles.statCard}><div className={styles.statLabel}>{label}</div><div className={styles.statVal} style={{ color: col || 'var(--t1)' }}>{val}</div></div>
              ))}
            </div>
            <div className={styles.sectionHead}>
              <h2>Live Orders</h2>
              <div className={styles.filters}>
                {['all', 'pending', 'preparing', 'out_for_delivery', 'delivered'].map(f => (
                  <button key={f} className={`${styles.fChip} ${statusFilter === f ? styles.active : ''}`} onClick={() => setStatusFilter(f)}>
                    {f === 'all' ? 'All' : f === 'out_for_delivery' ? 'Out' : f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.table}>
              <div className={`${styles.tHead} ${styles.ordCols}`}>
                <span>Order</span><span>Customer</span><span>Amount</span><span>Time</span><span>Status</span><span>Delivery Boy</span>
              </div>
              {filteredOrders.map(o => (
                <div key={o.id} className={`${styles.tRow} ${styles.ordCols}`}>
                  <span className={styles.orderId}>#{o.order_number}</span>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 12 }}>{o.customer_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--t2)' }}>{o.customer_phone}</div>
                    <div style={{ fontSize: 10, color: 'var(--t3)' }}>📍 {o.delivery_address?.slice(0, 30)}...</div>
                  </div>
                  <span style={{ fontWeight: 500 }}>₹{Math.round(o.total)}</span>
                  <span style={{ fontSize: 11, color: 'var(--t2)' }}>{new Date(o.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                  <select
                    className={styles.statSel}
                    value={o.status}
                    onChange={e => updateOrderStatus(o.id, e.target.value)}
                  >
                    {['pending','confirmed','preparing','out_for_delivery','delivered','cancelled'].map(s => (
                      <option key={s} value={s}>{s.replace('_', ' ')}</option>
                    ))}
                  </select>
                  <div>
                    {o.delivery_boy_name
                      ? <span style={{ fontSize: 11, color: 'var(--bl)', fontWeight: 500 }}>{o.delivery_boy_name}</span>
                      : <select className={styles.statSel} onChange={e => e.target.value && assignBoy(o.id, e.target.value)} defaultValue="">
                          <option value="">Assign Boy</option>
                          {boys.map(b => <option key={b.id} value={b.id}>{b.name} {b.is_online ? '🟢' : '⚫'}</option>)}
                        </select>
                    }
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── MENU ── */}
        {section === 'menu' && (
          <>
            <div className={styles.sectionHead}>
              <h2>Menu Items</h2>
              <button className="btn btn-primary" onClick={() => setShowAddItem(true)}>+ Add Item</button>
            </div>
            <div className={styles.menuGrid}>
              {menuItems.map(item => (
                <div key={item.id} className={styles.menuCard}>
                  <div className={styles.menuCardImg}>
                    {item.image_url ? <img src={item.image_url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }} /> : <span style={{ fontSize: 32 }}>🍛</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                    <span className={`veg-dot ${item.is_veg ? 'veg' : 'nonveg'}`} />
                    <strong style={{ fontSize: 13 }}>{item.name}</strong>
                  </div>
                  <span className={styles.catTag}>{item.category}</span>
                  <div className={styles.priceEdit}>
                    <label style={{ fontSize: 11, color: 'var(--t2)' }}>₹ Price</label>
                    <input
                      type="number"
                      defaultValue={item.price}
                      className={styles.priceInput}
                      id={`price-${item.id}`}
                    />
                    <label style={{ fontSize: 11, color: 'var(--t2)' }}>Disc%</label>
                    <input
                      type="number"
                      defaultValue={item.discount_percent}
                      className={styles.priceInput}
                      id={`disc-${item.id}`}
                    />
                  </div>
                  <button className="btn btn-secondary" style={{ fontSize: 11, padding: '4px 10px', marginBottom: 8, width: '100%' }}
                    onClick={() => updateItemPrice(item.id, document.getElementById(`price-${item.id}`).value, document.getElementById(`disc-${item.id}`).value)}>
                    Save Price
                  </button>
                  <div className={styles.availToggle}>
                    <div className={`switch ${item.is_available ? 'on' : ''}`} onClick={() => toggleMenuItem(item.id, !item.is_available)} />
                    <span style={{ fontSize: 12, color: 'var(--t2)' }}>{item.is_available ? 'Available' : 'Unavailable'}</span>
                  </div>
                </div>
              ))}
            </div>
            {showAddItem && (
              <div className={styles.modalBg} onClick={e => e.target === e.currentTarget && setShowAddItem(false)}>
                <div className={styles.modal}>
                  <h3>Add New Item</h3>
                  <form onSubmit={addNewItem}>
                    <div className="field"><label>Item Name</label><input required value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} placeholder="Masala Dosa" /></div>
                    <div className="field"><label>Description</label><input value={newItem.description} onChange={e => setNewItem({...newItem, description: e.target.value})} placeholder="Short description" /></div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div className="field"><label>Price (₹)</label><input required type="number" value={newItem.price} onChange={e => setNewItem({...newItem, price: e.target.value})} /></div>
                      <div className="field"><label>Discount %</label><input type="number" value={newItem.discount_percent} onChange={e => setNewItem({...newItem, discount_percent: e.target.value})} /></div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div className="field"><label>Category</label><select value={newItem.category} onChange={e => setNewItem({...newItem, category: e.target.value})}><option>Veg</option><option>Non-Veg</option><option>Dessert</option><option>Drinks</option></select></div>
                      <div className="field"><label>Type</label><select value={newItem.is_veg} onChange={e => setNewItem({...newItem, is_veg: e.target.value === 'true'})}><option value="true">Veg</option><option value="false">Non-Veg</option></select></div>
                    </div>
                    <div className="field"><label>Image URL (optional)</label><input type="url" value={newItem.image_url || ''} onChange={e => setNewItem({...newItem, image_url: e.target.value})} placeholder="https://..." /></div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                      <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowAddItem(false)}>Cancel</button>
                      <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Add Item</button>
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <strong style={{ fontSize: 16, color: 'var(--or)' }}>{o.code}</strong>
                    <span className={`badge ${o.is_active ? 'badge-done' : 'badge-cancelled'}`}>{o.is_active ? 'Active' : 'Inactive'}</span>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--t2)', marginBottom: 6 }}>{o.type === 'flat' ? `₹${o.value} off` : o.type === 'percent' ? `${o.value}% off` : 'Free delivery'} · Min ₹{o.min_order}</p>
                  <p style={{ fontSize: 11, color: 'var(--t3)' }}>Used {o.used_count}/{o.max_uses} times</p>
                  <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                    <button className="btn btn-secondary" style={{ flex: 1, fontSize: 11, padding: '5px 8px' }}
                      onClick={() => { fetch('/api/admin', { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ type: 'offer', id: o.id, is_active: !o.is_active }) }); loadAll() }}>
                      {o.is_active ? 'Disable' : 'Enable'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {showAddOffer && (
              <div className={styles.modalBg} onClick={e => e.target === e.currentTarget && setShowAddOffer(false)}>
                <div className={styles.modal}>
                  <h3>Create Offer</h3>
                  <form onSubmit={addNewOffer}>
                    <div className="field"><label>Offer Code</label><input required value={newOffer.code} onChange={e => setNewOffer({...newOffer, code: e.target.value.toUpperCase()})} placeholder="MONSOON30" /></div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div className="field"><label>Type</label><select value={newOffer.type} onChange={e => setNewOffer({...newOffer, type: e.target.value})}><option value="percent">% Discount</option><option value="flat">Flat Discount</option><option value="free_delivery">Free Delivery</option></select></div>
                      <div className="field"><label>Value</label><input required type="number" value={newOffer.value} onChange={e => setNewOffer({...newOffer, value: e.target.value})} placeholder="20" /></div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div className="field"><label>Min Order ₹</label><input type="number" value={newOffer.min_order} onChange={e => setNewOffer({...newOffer, min_order: e.target.value})} placeholder="200" /></div>
                      <div className="field"><label>Max Uses</label><input type="number" value={newOffer.max_uses} onChange={e => setNewOffer({...newOffer, max_uses: e.target.value})} /></div>
                    </div>
                    <div className="field"><label>Valid Till</label><input type="date" value={newOffer.valid_till} onChange={e => setNewOffer({...newOffer, valid_till: e.target.value})} /></div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowAddOffer(false)}>Cancel</button>
                      <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Launch Offer</button>
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
            <div className={styles.sectionHead}><h2>Delivery Boys</h2><button className="btn btn-primary" onClick={() => setShowAddBoy(true)}>+ Add Delivery Boy</button></div>
            <div className={styles.table}>
              <div className={`${styles.tHead} ${styles.boyCols}`}><span>Name</span><span>Phone</span><span>Vehicle</span><span>Orders</span><span>Status</span></div>
              {boys.map(b => (
                <div key={b.id} className={`${styles.tRow} ${styles.boyCols}`}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div className={styles.boyAvatar}>{b.name.split(' ').map(n=>n[0]).join('')}</div>
                    <div><div style={{ fontSize: 13, fontWeight: 500 }}>{b.name}</div><div style={{ fontSize: 11, color: 'var(--t2)' }}>{b.email}</div></div>
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--t2)' }}>{b.phone}</span>
                  <span style={{ fontSize: 12 }}>{b.vehicle_number}</span>
                  <span style={{ fontWeight: 500 }}>₹{Math.round(b.total_earnings)}</span>
                  <span className={`badge ${b.is_online ? 'badge-done' : 'badge-cancelled'}`}>{b.is_online ? 'Online' : 'Offline'}</span>
                </div>
              ))}
            </div>
            {showAddBoy && (
              <div className={styles.modalBg} onClick={e => e.target === e.currentTarget && setShowAddBoy(false)}>
                <div className={styles.modal}>
                  <h3>Add Delivery Boy</h3>
                  <form onSubmit={addNewBoy}>
                    <div className="field"><label>Full Name</label><input required value={newBoy.name} onChange={e => setNewBoy({...newBoy, name: e.target.value})} placeholder="Raju Kumar" /></div>
                    <div className="field"><label>Email</label><input required type="email" value={newBoy.email} onChange={e => setNewBoy({...newBoy, email: e.target.value})} placeholder="raju@email.com" /></div>
                    <div className="field"><label>Password</label><input required type="password" value={newBoy.password} onChange={e => setNewBoy({...newBoy, password: e.target.value})} placeholder="••••••••" /></div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div className="field"><label>Phone</label><input value={newBoy.phone} onChange={e => setNewBoy({...newBoy, phone: e.target.value})} placeholder="+91 98765..." /></div>
                      <div className="field"><label>Vehicle No.</label><input value={newBoy.vehicleNumber} onChange={e => setNewBoy({...newBoy, vehicleNumber: e.target.value})} placeholder="BR 01 AB 1234" /></div>
                    </div>
                    <div className="field"><label>Per KM Earning (₹)</label><input type="number" value={newBoy.perKmEarning} onChange={e => setNewBoy({...newBoy, perKmEarning: e.target.value})} /></div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowAddBoy(false)}>Cancel</button>
                      <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Add & Save</button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── KM PRICING ── */}
        {section === 'pricing' && (
          <>
            <div className={styles.sectionHead}><h2>Delivery Pricing</h2><button className="btn btn-primary" onClick={savePricing}>Save Changes</button></div>
            <p style={{ fontSize: 12, color: 'var(--t2)', marginBottom: 12 }}>Delivery charge auto-calculated at checkout based on customer distance.</p>
            <div className={styles.table}>
              <div className={`${styles.tHead}`} style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr' }}><span>Range</span><span>Min KM</span><span>Base Charge (₹)</span><span>Per Extra KM (₹)</span></div>
              {pricing.map((row, i) => (
                <div key={row.id} className={styles.tRow} style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr' }}>
                  <span style={{ fontWeight: 500, fontSize: 12 }}>{row.min_km} – {row.max_km ?? '∞'} km</span>
                  <span style={{ fontSize: 12, color: 'var(--t2)' }}>{row.min_km} km</span>
                  <input type="number" defaultValue={row.base_charge} className={styles.priceInput}
                    onChange={e => { const p = [...pricing]; p[i] = { ...p[i], base_charge: e.target.value }; setPricing(p) }} />
                  <input type="number" defaultValue={row.per_km_charge} className={styles.priceInput}
                    onChange={e => { const p = [...pricing]; p[i] = { ...p[i], per_km_charge: e.target.value }; setPricing(p) }} />
                </div>
              ))}
            </div>
            <div style={{ background: 'var(--am-l)', border: '0.5px solid var(--am)', borderRadius: 10, padding: '12px 14px', marginTop: 12, fontSize: 12, color: '#92400e' }}>
              ⚠️ Delivery boy earns 70% of delivery charge. Example: ₹40 delivery → ₹28 for delivery boy.
            </div>
          </>
        )}

        {/* ── CUSTOMERS ── */}
        {section === 'customers' && (
          <>
            <div className={styles.sectionHead}>
              <h2>Customers</h2>
              <span style={{ fontSize: 12, color: 'var(--t2)' }}>{customers.length} registered</span>
            </div>
            <div className={styles.table}>
              <div className={`${styles.tHead}`} style={{ gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr 1.5fr' }}>
                <span>Name</span><span>Phone</span><span>Orders</span><span>Total Spent</span><span>Joined</span><span>Last Order</span>
              </div>
              {customers.length === 0 && (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--t2)', fontSize: 13 }}>Koi customer nahi mila</div>
              )}
              {customers.map(c => (
                <div key={c.id} className={`${styles.tRow}`} style={{ gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr 1.5fr' }}>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--t2)' }}>{c.email}</div>
                    {c.address && <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 2 }}>📍 {c.address.slice(0, 30)}{c.address.length > 30 ? '...' : ''}</div>}
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--t2)' }}>{c.phone || '—'}</span>
                  <span style={{ fontWeight: 600, color: 'var(--bl)' }}>{c.total_orders}</span>
                  <span style={{ fontWeight: 600, color: 'var(--gr-d)' }}>₹{Math.round(c.total_spent)}</span>
                  <span style={{ fontSize: 11, color: 'var(--t2)' }}>{new Date(c.created_at).toLocaleDateString('en-IN')}</span>
                  <span style={{ fontSize: 11, color: 'var(--t2)' }}>{c.last_order_at ? new Date(c.last_order_at).toLocaleDateString('en-IN') : '—'}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── ANALYTICS ── */}
        {section === 'analytics' && analytics && (
          <>
            <div className={styles.sectionHead}><h2>Analytics</h2><span style={{ fontSize: 12, color: 'var(--t2)' }}>Last 7 days</span></div>
            <div className={styles.statsRow}>
              {[['Total Orders (7d)', analytics.weekStats?.week_orders ?? '-', ''], ['Revenue (7d)', `₹${Math.round(analytics.weekStats?.week_revenue ?? 0)}`, ''], ['Avg Order', `₹${Math.round((analytics.weekStats?.week_revenue ?? 0) / Math.max(1, analytics.weekStats?.week_orders ?? 1))}`, ''], ['Customers', analytics.customerCount ?? '-', '']].map(([label, val, col]) => (
                <div key={label} className={styles.statCard}><div className={styles.statLabel}>{label}</div><div className={styles.statVal}>{val}</div></div>
              ))}
            </div>
            <div className={styles.table} style={{ padding: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Top Selling Items (7 days)</h3>
              {(analytics.topItems || []).map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <span style={{ fontSize: 12, minWidth: 140 }}>{item.name}</span>
                  <div style={{ flex: 1, background: 'var(--bg)', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.round(item.total_qty / (analytics.topItems[0]?.total_qty || 1) * 100)}%`, height: '100%', background: 'var(--or)', borderRadius: 4 }} />
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--t2)', minWidth: 28, textAlign: 'right' }}>{item.total_qty}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </main>

      {/* Toast */}
      {toast && <div className={styles.toast}>{toast}</div>}
    </div>
  )
}

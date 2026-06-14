'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import styles from '../admin/admin.module.css'

const SECTIONS = [
  { id: 'orders', label: '📋 Orders',          badge: 'orders' },
  { id: 'items',  label: '📦 Item Availability' },
]

export default function BranchPage() {
  const router = useRouter()
  const [section,    setSection]    = useState('orders')
  const [user,       setUser]       = useState(null)
  const [branchInfo, setBranchInfo] = useState(null)
  const [orders,     setOrders]     = useState([])
  const [items,      setItems]      = useState([])
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading,    setLoading]    = useState(true)
  const [toast,      setToast]      = useState('')
  const prevNewCount = useRef(-1)
  const audioRef     = useRef(null)
  const pollRef      = useRef(null)

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  // ── Auth ──────────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/auth', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'me' }) })
      .then(r => r.json())
      .then(({ user }) => {
        if (!user || user.role !== 'admin' || !user.branch_id) { router.push('/login'); return }
        setUser(user)
      })
      .catch(() => router.push('/login'))
  }, [])

  // ── Load branch info + items ───────────────────────────────────────
  useEffect(() => {
    if (!user) return
    fetch('/api/admin?type=branch')
      .then(r => r.json())
      .then(({ branches }) => setBranchInfo((branches||[]).find(b => b.id === user.branch_id) || null))
    fetchItems()
  }, [user])

  const fetchItems = useCallback(() => {
    if (!user?.branch_id) return
    fetch(`/api/admin?type=branch_inventory&branch_id=${user.branch_id}`)
      .then(r => r.json())
      .then(({ items }) => setItems(items || []))
  }, [user])

  // ── Orders polling ────────────────────────────────────────────────
  const fetchOrders = useCallback(() => {
    fetch('/api/orders')
      .then(r => r.json())
      .then(({ orders: o }) => {
        const list = o || []
        setOrders(list)
        setLoading(false)
        const newCount = list.filter(x => x.status === 'pending').length
        if (prevNewCount.current >= 0 && newCount > prevNewCount.current) {
          try { audioRef.current?.play() } catch {}
        }
        prevNewCount.current = newCount
      })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!user) return
    fetchOrders()
    pollRef.current = setInterval(fetchOrders, 15000)
    return () => clearInterval(pollRef.current)
  }, [user, fetchOrders])

  // ── Update order status ────────────────────────────────────────────
  const updateOrderStatus = async (id, status) => {
    try {
      const res = await fetch('/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ id, status }),
      })
      if (!res.ok) { showToast('❌ Status update nahi hua'); return }
      setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o))
      showToast('✅ Status update ho gaya')
    } catch { showToast('❌ Network error') }
  }

  // ── Toggle item availability ───────────────────────────────────────
  const toggleItem = async (itemId, currentVal) => {
    const newVal = !currentVal
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, branch_available: newVal } : i))
    try {
      await fetch('/api/admin', {
        method: 'PATCH',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ type:'branch_inventory', action:'toggle_item', branch_id: user.branch_id, item_id: itemId, is_available: newVal }),
      })
      showToast(newVal ? '✅ Item available' : '🔴 Item unavailable')
    } catch { fetchItems() }
  }

  // ── Toggle branch open/close ──────────────────────────────────────
  const toggleBranch = async () => {
    if (!branchInfo) return
    try {
      const res = await fetch('/api/admin', {
        method: 'PATCH',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ type:'branch', action:'toggle', id: user.branch_id }),
      })
      const d = await res.json()
      if (!res.ok) { showToast('❌ ' + (d.error || 'Error')); return }
      setBranchInfo(prev => ({ ...prev, is_active: d.branch?.is_active ?? !prev.is_active }))
      showToast(d.branch?.is_active ? '🟢 Branch Open!' : '🔴 Branch Closed')
    } catch { showToast('❌ Network error') }
  }

  const logout = async () => {
    await fetch('/api/auth', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'logout' }) })
    router.push('/login')
  }

  // ── Order detail modal ────────────────────────────────────────────
  const [showOrderDetail, setShowOrderDetail] = useState(false)
  const [orderDetail,     setOrderDetail]     = useState(null)

  const openOrderDetail = async (orderId) => {
    const res = await fetch(`/api/orders?id=${orderId}`).then(r => r.json())
    setOrderDetail(res.order)
    setShowOrderDetail(true)
  }

  const pendingCount = orders.filter(o => o.status === 'pending').length

  const filteredOrders = statusFilter === 'all'
    ? orders
    : orders.filter(o => o.status === statusFilter)

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', fontSize:14, color:'var(--t2)' }}>Loading...</div>

  return (
    <div className={styles.page}>

      {/* Alert audio */}
      <audio ref={audioRef} src="/alert.mp3" preload="auto" />

      {/* Toast */}
      {toast && <div className={styles.toast}>{toast}</div>}

      {/* ── Sidebar ── */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarLogo}>🏪 Branch Panel</div>
        <div style={{ fontSize:11, color:'#f97316', fontWeight:700, padding:'0 8px 10px', letterSpacing:0.3 }}>
          {branchInfo?.name || 'Branch'}
        </div>
        {SECTIONS.map(s => (
          <button key={s.id}
            className={`${styles.sideLink} ${section === s.id ? styles.active : ''}`}
            onClick={() => setSection(s.id)}>
            {s.label}
            {s.badge === 'orders' && pendingCount > 0 && (
              <span className={styles.sideBadge}>{pendingCount}</span>
            )}
          </button>
        ))}
        <button className={styles.logoutBtn} onClick={logout}>🚪 Logout</button>
      </aside>

      {/* ── Main ── */}
      <main className={styles.main}>

        {/* Top bar — branch open/close */}
        <div className={styles.kitchenCard}>
          <div>
            <strong>🍽️ {branchInfo?.name || 'Branch'}</strong>
            <p style={{ fontSize:12, color:'var(--t2)', marginTop:3 }}>Branch kholo ya band karo</p>
          </div>
          <div className={styles.bigToggle}>
            <div
              className={`${styles.bigTrack} ${branchInfo?.is_active ? styles.on : ''}`}
              onClick={toggleBranch}>
              <div className={styles.bigKnob} />
            </div>
            <span style={{ fontWeight:600, color: branchInfo?.is_active ? 'var(--gr-d)' : 'var(--rd)', fontSize:14 }}>
              {branchInfo?.is_active ? 'Open' : 'Closed'}
            </span>
          </div>
        </div>

        {/* ── ORDERS SECTION ── */}
        {section === 'orders' && (() => {
          const deliveredCount  = orders.filter(o => o.status === 'delivered').length
          const deliveredRevenue = orders.filter(o => o.status === 'delivered').reduce((s, o) => s + parseFloat(o.total || 0), 0)
          const activeCount     = orders.filter(o => !['delivered','cancelled'].includes(o.status)).length

          return (
            <>
              {/* Stats */}
              <div className={styles.statsRow}>
                {[
                  ['Orders',    orders.length,                 ''],
                  ['Active',    activeCount,                   'var(--am)'],
                  ['Delivered', deliveredCount,                'var(--gr-d)'],
                  ['Revenue',   `₹${Math.round(deliveredRevenue)}`, 'var(--or)'],
                ].map(([label, val, col]) => (
                  <div key={label} className={styles.statCard}>
                    <div className={styles.statLabel}>{label}</div>
                    <div className={styles.statVal} style={{ color: col || 'var(--t1)' }}>{val}</div>
                  </div>
                ))}
              </div>

              {/* Filter + Refresh */}
              <div className={styles.sectionHead}>
                <h2>Live Orders</h2>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
                  <div className={styles.filters}>
                    {[
                      { key:'all',              label:'All' },
                      { key:'pending',          label:'🔴 New' },
                      { key:'preparing',        label:'🟡 Preparing' },
                      { key:'ready',            label:'🟢 Ready' },
                      { key:'out_for_delivery', label:'🛵 Out' },
                      { key:'delivered',        label:'✅ Delivered' },
                    ].map(f => (
                      <button key={f.key}
                        className={`${styles.fChip} ${statusFilter === f.key ? styles.active : ''}`}
                        onClick={() => setStatusFilter(f.key)}>
                        {f.label}
                        {f.key === 'pending' && pendingCount > 0 && ` (${pendingCount})`}
                      </button>
                    ))}
                  </div>
                  <button className="btn btn-secondary" style={{ fontSize:12 }} onClick={fetchOrders}>🔄 Refresh</button>
                </div>
              </div>

              {/* Table */}
              <div className={styles.tableWrap}>
                <div className={styles.table}>
                  <div className={`${styles.tHead} ${styles.ordCols}`}>
                    <span>Order</span>
                    <span>Customer</span>
                    <span>Amount</span>
                    <span>Time</span>
                    <span>Status</span>
                    <span>Items</span>
                  </div>
                  {filteredOrders.map(o => {
                    const rowBg = {
                      pending:          '#fffbeb',
                      confirmed:        '#eff6ff',
                      preparing:        '#f5f3ff',
                      out_for_delivery: '#fff7ed',
                      cancelled:        '#fef2f2',
                    }[o.status] || 'transparent'
                    return (
                      <div key={o.id} className={`${styles.tRow} ${styles.ordCols}`} style={{ background: rowBg }}>
                        <span className={styles.orderId} style={{ cursor:'pointer', textDecoration:'underline', color:'var(--bl)' }} onClick={() => openOrderDetail(o.id)}>#{o.order_number}</span>
                        <div>
                          <div style={{ fontWeight:500, fontSize:12 }}>{o.customer_name}</div>
                          <div style={{ fontSize:11, color:'var(--t2)' }}>{o.customer_phone}</div>
                          <div style={{ fontSize:10, color:'var(--t3)' }}>📍 {o.delivery_address?.slice(0,30)}</div>
                        </div>
                        <span style={{ fontWeight:500 }}>₹{Math.round(o.total)}</span>
                        <span style={{ fontSize:11, color:'var(--t2)' }}>
                          {new Date(o.created_at).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' })}
                        </span>
                        <select className={styles.statSel} value={o.status} onChange={e => updateOrderStatus(o.id, e.target.value)}>
                          {['pending','confirmed','preparing','out_for_delivery','ready','delivered','cancelled'].map(s => (
                            <option key={s} value={s}>{s.replace(/_/g,' ')}</option>
                          ))}
                        </select>
                        <div style={{ fontSize:11, color:'var(--t2)' }}>
                          {(o.items || []).map((it, i) => (
                            <div key={i}>{it.quantity}× {it.name}</div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                  {filteredOrders.length === 0 && (
                    <div style={{ padding:'24px', textAlign:'center', color:'var(--t2)' }}>Koi order nahi mila</div>
                  )}
                </div>
              </div>
            </>
          )
        })()}

        {/* ── ITEM AVAILABILITY SECTION ── */}
        {section === 'items' && (
          <>
            <div className={styles.sectionHead}>
              <h2>📦 Item Availability</h2>
              <button className="btn btn-secondary" style={{ fontSize:12 }} onClick={fetchItems}>🔄 Refresh</button>
            </div>
            <p style={{ fontSize:13, color:'var(--t2)', marginBottom:14 }}>
              Jo item aaj available nahi hai use band karo — customers ko order karte waqt nahi dikhega.
            </p>
            <div className={styles.menuGrid}>
              {items.map(item => (
                <div key={item.id} className={styles.menuCard} style={{ opacity: item.branch_available ? 1 : 0.55 }}>
                  <div className={styles.menuCardImg}>
                    {item.image_url
                      ? <img src={item.image_url} alt={item.name} style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:8 }} />
                      : <span style={{ fontSize:28 }}>🍛</span>}
                  </div>
                  <div className={styles.catTag}>{item.category}</div>
                  <div style={{ fontWeight:600, fontSize:13, marginBottom:4 }}>
                    {item.is_veg ? '🟢' : '🔴'} {item.name}
                  </div>
                  <div style={{ fontSize:12, color:'var(--t2)', marginBottom:10 }}>₹{item.price}</div>
                  <div className={styles.availToggle}>
                    <div
                      onClick={() => toggleItem(item.id, item.branch_available)}
                      style={{
                        width:40, height:22, borderRadius:11,
                        background: item.branch_available ? 'var(--gr)' : 'var(--rd)',
                        position:'relative', cursor:'pointer', transition:'background 0.2s', flexShrink:0
                      }}>
                      <div style={{
                        position:'absolute', top:2,
                        left: item.branch_available ? 20 : 2,
                        width:18, height:18, borderRadius:'50%', background:'#fff',
                        boxShadow:'0 1px 3px rgba(0,0,0,0.2)', transition:'left 0.2s'
                      }} />
                    </div>
                    <span style={{ fontSize:12, color: item.branch_available ? 'var(--gr-d)' : 'var(--rd)', fontWeight:600 }}>
                      {item.branch_available ? 'Available' : 'Unavailable'}
                    </span>
                  </div>
                </div>
              ))}
              {items.length === 0 && (
                <div style={{ color:'var(--t2)', fontSize:13 }}>Koi item nahi mila</div>
              )}
            </div>
          </>
        )}
      </main>

      {/* ── Order Detail Modal ── */}
      {showOrderDetail && orderDetail && (
        <div className={styles.modalBg} onClick={e => e.target === e.currentTarget && setShowOrderDetail(false)}>
          <div className={styles.modal} style={{ maxWidth:500, maxHeight:'90vh', overflowY:'auto' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <h3 style={{ margin:0 }}>Order #{orderDetail.order_number}</h3>
              <button onClick={() => setShowOrderDetail(false)} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer' }}>✕</button>
            </div>

            {/* Customer */}
            <div style={{ background:'var(--bg)', borderRadius:10, padding:'12px 14px', marginBottom:12 }}>
              <div style={{ fontSize:12, fontWeight:700, marginBottom:8, color:'var(--t2)' }}>👤 CUSTOMER</div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:600 }}>{orderDetail.customer_name}</div>
                  <div style={{ fontSize:12, color:'var(--t2)' }}>{orderDetail.customer_phone}</div>
                  <div style={{ fontSize:12, color:'var(--t3)', marginTop:4 }}>📍 {orderDetail.delivery_address}</div>
                  {orderDetail.distance_km && <div style={{ fontSize:11, color:'var(--t3)' }}>{parseFloat(orderDetail.distance_km).toFixed(1)} km</div>}
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  <a href={`tel:${orderDetail.customer_phone}`}
                    style={{ display:'flex', alignItems:'center', gap:4, background:'#dcfce7', color:'#16a34a', borderRadius:8, padding:'6px 12px', textDecoration:'none', fontSize:12, fontWeight:600 }}>
                    📞 Call
                  </a>
                  <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(orderDetail.delivery_address)}`}
                    target="_blank" rel="noopener noreferrer"
                    style={{ display:'flex', alignItems:'center', gap:4, background:'#dbeafe', color:'#1d4ed8', borderRadius:8, padding:'6px 12px', textDecoration:'none', fontSize:12, fontWeight:600 }}>
                    🗺️ Map
                  </a>
                </div>
              </div>
            </div>

            {/* Items */}
            <div style={{ background:'var(--bg)', borderRadius:10, padding:'12px 14px', marginBottom:12 }}>
              <div style={{ fontSize:12, fontWeight:700, marginBottom:8, color:'var(--t2)' }}>📦 ITEMS</div>
              {(orderDetail.items || []).map((item, i) => (
                <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:6 }}>
                  <span>{item.name} <span style={{ color:'var(--t2)' }}>×{item.quantity}</span></span>
                  <span style={{ fontWeight:600 }}>₹{Math.round(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>

            {/* Notes */}
            {orderDetail.notes && (
              <div style={{ background:'#fef3c7', borderRadius:10, padding:'10px 14px', marginBottom:12, fontSize:12, color:'#92400e' }}>
                📝 <strong>Customer Remarks:</strong> {orderDetail.notes}
              </div>
            )}

            {/* Bill */}
            <div style={{ background:'var(--bg)', borderRadius:10, padding:'12px 14px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:4 }}><span>Subtotal</span><span>₹{Math.round(orderDetail.subtotal)}</span></div>
              {orderDetail.discount_amount > 0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:4, color:'var(--gr-d)' }}><span>Discount</span><span>−₹{Math.round(orderDetail.discount_amount)}</span></div>}
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:4 }}><span>Delivery Charge</span><span>₹{Math.round(orderDetail.delivery_charge)}</span></div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:15, fontWeight:700, marginTop:8, paddingTop:8, borderTop:'1px solid var(--bd)' }}>
                <span>💵 Total (COD)</span><span style={{ color:'var(--or)' }}>₹{Math.round(orderDetail.total)}</span>
              </div>
            </div>

            {orderDetail.delivery_boy_name && (
              <div style={{ marginTop:10, fontSize:12, color:'var(--gr-d)', fontWeight:600 }}>🛵 {orderDetail.delivery_boy_name} · {orderDetail.delivery_boy_phone}</div>
            )}

            {/* Print Bill */}
            <button onClick={() => {
              const w = window.open('', '_blank', 'width=380,height=600')
              const rows = (orderDetail.items || []).map(i => `<tr><td>${i.name}</td><td style="text-align:center">${i.quantity}</td><td style="text-align:right">₹${Math.round(i.price * i.quantity)}</td></tr>`).join('')
              w.document.write(`<html><head><title>Receipt #${orderDetail.order_number}</title>
                <style>body{font-family:monospace;max-width:340px;margin:20px auto;font-size:13px}
                h2{text-align:center;margin:0}p{text-align:center;color:#666;margin:4px 0}
                table{width:100%;border-collapse:collapse;margin:12px 0}td{padding:4px 2px}hr{border:1px dashed #ccc}
                .total{font-size:16px;font-weight:bold}@media print{button{display:none}}</style></head>
                <body>
                <h2>🍽️ FoodFi Cloud Kitchen</h2>
                <p>${new Date(orderDetail.created_at).toLocaleString('en-IN')}</p>
                <p>Order #${orderDetail.order_number}</p><hr/>
                <p style="text-align:left"><b>Customer:</b> ${orderDetail.customer_name}<br/>${orderDetail.customer_phone}<br/>📍 ${orderDetail.delivery_address}</p><hr/>
                <table><thead><tr><th style="text-align:left">Item</th><th>Qty</th><th style="text-align:right">Amt</th></tr></thead>
                <tbody>${rows}</tbody></table><hr/>
                <div style="display:flex;justify-content:space-between"><span>Subtotal</span><span>₹${Math.round(orderDetail.subtotal)}</span></div>
                ${orderDetail.discount_amount > 0 ? `<div style="display:flex;justify-content:space-between;color:green"><span>Discount</span><span>-₹${Math.round(orderDetail.discount_amount)}</span></div>` : ''}
                <div style="display:flex;justify-content:space-between"><span>Delivery</span><span>₹${Math.round(orderDetail.delivery_charge)}</span></div><hr/>
                <div class="total" style="display:flex;justify-content:space-between"><span>TOTAL (COD)</span><span>₹${Math.round(orderDetail.total)}</span></div>
                <p style="margin-top:20px">Shukriya! 🙏 FoodFi Cloud Kitchen</p>
                <button onclick="window.print()" style="margin-top:12px;width:100%;padding:10px;background:#e85d04;color:#fff;border:none;border-radius:8px;font-size:14px;cursor:pointer">🖨️ Print</button>
                </body></html>`)
              w.document.close()
            }} style={{ marginTop:14, width:'100%', padding:'10px', background:'#1e293b', color:'#fff', border:'none', borderRadius:10, fontSize:14, fontWeight:600, cursor:'pointer' }}>
              🖨️ Print Bill / Receipt
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

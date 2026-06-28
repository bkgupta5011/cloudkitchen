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
  const [section,         setSection]         = useState('orders')
  const [user,            setUser]            = useState(null)
  const [branchInfo,      setBranchInfo]      = useState(null)
  const [orders,          setOrders]          = useState([])
  const [items,           setItems]           = useState([])
  const [boys,            setBoys]            = useState([])
  const [statusFilter,    setStatusFilter]    = useState('all')
  const [todayOnly,       setTodayOnly]       = useState(true)
  const [loading,         setLoading]         = useState(true)
  const [refreshing,      setRefreshing]      = useState(false)
  const [toast,           setToast]           = useState('')
  const [newOrderBanner,  setNewOrderBanner]  = useState(false)
  const [showOrderDetail, setShowOrderDetail] = useState(false)
  const [orderDetail,     setOrderDetail]     = useState(null)
  const [itemSearch,      setItemSearch]      = useState('')
  const [showAddItem,     setShowAddItem]     = useState(false)
  const [newItem,         setNewItem]         = useState({ name:'', category:'', price:'', discount_percent:'', stock_count:'', is_veg:true, description:'' })
  const [newCatMode,      setNewCatMode]      = useState(false)   // true = typing a brand-new category
  const [savingItem,      setSavingItem]      = useState(false)

  const prevNewCount = useRef(-1)
  const audioRef     = useRef(null)
  const pollRef      = useRef(null)

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  // ── Auth ──────────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'me' }) })
      .then(r => r.json())
      .then(({ user }) => {
        if (!user || user.role !== 'admin' || !user.branch_id) { router.push('/login'); return }
        setUser(user)
      })
      .catch(() => router.push('/login'))
  }, [])

  // ── Load branch info + items (once on login) ───────────────────────
  useEffect(() => {
    if (!user) return
    fetch('/api/admin?type=branches')
      .then(r => r.json())
      .then(({ branches }) => setBranchInfo((branches || []).find(b => b.id === user.branch_id) || null))
    fetchItems()
  }, [user])

  const fetchItems = useCallback(() => {
    if (!user?.branch_id) return
    fetch(`/api/admin?type=branch_inventory&branch_id=${user.branch_id}`)
      .then(r => r.json())
      .then(({ items }) => setItems(items || []))
  }, [user])

  // fetchBoys — stable reference (no deps), called in polling interval
  const fetchBoys = useCallback(() => {
    fetch('/api/admin?type=delivery_boys')
      .then(r => r.json())
      .then(({ boys }) => setBoys(boys || []))
      .catch(() => {})
  }, [])

  // ── Orders polling ────────────────────────────────────────────────
  // todayOnly in deps so a new fetchOrders fn is created when toggle changes,
  // which triggers the polling useEffect to restart with correct URL.
  const fetchOrders = useCallback((isManual = false) => {
    if (isManual) setRefreshing(true)

    // Build URL: today filter uses IST date
    let url = '/api/orders'
    if (todayOnly) {
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
      url = `/api/orders?date_from=${today}&date_to=${today}`
    }

    fetch(url)
      .then(r => r.json())
      .then(({ orders: o }) => {
        const list = o || []
        setOrders(list)
        setLoading(false)
        if (isManual) setRefreshing(false)

        const newCount = list.filter(x => x.status === 'pending').length
        if (prevNewCount.current >= 0 && newCount > prevNewCount.current) {
          // More pending than before → new order arrived
          try { audioRef.current?.play() } catch {}
          setNewOrderBanner(true)
          document.title = `🔴 ${newCount} Naya Order! — Branch Panel`
        }
        if (newCount === 0) {
          document.title = 'Branch Panel'
          setNewOrderBanner(false)
        }
        prevNewCount.current = newCount
      })
      .catch(() => {
        setLoading(false)
        if (isManual) setRefreshing(false)
      })
  }, [todayOnly])

  // Polling: restarts whenever fetchOrders changes (i.e. when todayOnly changes)
  useEffect(() => {
    if (!user) return
    fetchOrders()
    fetchBoys()
    pollRef.current = setInterval(() => { fetchOrders(); fetchBoys() }, 15000)
    return () => clearInterval(pollRef.current)
  }, [user, fetchOrders, fetchBoys])

  // ── Update order status ────────────────────────────────────────────
  const updateOrderStatus = async (id, status) => {
    try {
      const res = await fetch('/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: id, status }),   // ← orderId (not id)
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'branch_inventory', action: 'toggle', branch_id: user.branch_id, item_id: itemId, is_available: newVal }),
      })
      showToast(newVal ? '✅ Item available' : '🔴 Item unavailable')
    } catch { fetchItems() }
  }

  // ── Mark ALL items available ──────────────────────────────────────
  const markAllAvailable = async () => {
    // Capture list BEFORE optimistic update (state update is async)
    const unavailable = items.filter(i => !i.branch_available)
    if (!unavailable.length) { showToast('Sab items pehle se available hain!'); return }
    setItems(prev => prev.map(i => ({ ...i, branch_available: true })))
    let anyFail = false
    for (const item of unavailable) {
      try {
        await fetch('/api/admin', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'branch_inventory', action: 'toggle', branch_id: user.branch_id, item_id: item.id, is_available: true }),
        })
      } catch { anyFail = true }
    }
    showToast(anyFail ? '⚠️ Kuch items update nahi hue' : `✅ ${unavailable.length} items available kar diye!`)
    if (anyFail) fetchItems()
  }

  // ── Set this branch's own price for an item (blank = master rate) ──
  const setItemPrice = async (item, value) => {
    const num = value === '' ? null : Number(value)
    if (num !== null && (!Number.isFinite(num) || num < 0)) { showToast('❌ Galat price'); return }
    const cur = item.branch_price == null ? null : Number(item.branch_price)
    if (num === cur) return
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, branch_price: num == null ? item.master_price : num } : i))
    try {
      await fetch('/api/admin', { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'branch_inventory', action: 'set_price', branch_id: user.branch_id, item_id: item.id, price: num }) })
      showToast('💰 Price update ho gaya')
    } catch { fetchItems() }
  }

  // ── Set this branch's stock for an item (blank = unlimited) ───────
  const setItemStock = async (item, value) => {
    const num = value === '' ? null : Math.trunc(Number(value))
    if (num !== null && (!Number.isFinite(num) || num < 0)) { showToast('❌ Galat stock'); return }
    if (num === (item.branch_stock ?? null)) return
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, branch_stock: num } : i))
    try {
      await fetch('/api/admin', { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'branch_inventory', action: 'set_stock', branch_id: user.branch_id, item_id: item.id, stock_count: num }) })
      showToast('📦 Stock update ho gaya')
    } catch { fetchItems() }
  }

  // ── Add this branch's OWN item ────────────────────────────────────
  const addOwnItem = async () => {
    if (!newItem.name.trim() || !newItem.category.trim() || newItem.price === '') { showToast('❌ Naam, category, price bharo'); return }
    setSavingItem(true)
    try {
      const res = await fetch('/api/admin', { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'branch_inventory', action: 'add_item', branch_id: user.branch_id, ...newItem }) })
      const d = await res.json()
      if (!res.ok) { showToast('❌ ' + (d.error || 'Fail')) }
      else { showToast('✅ Item add ho gaya'); setShowAddItem(false); setNewCatMode(false); setNewItem({ name:'', category:'', price:'', discount_percent:'', stock_count:'', is_veg:true, description:'' }); fetchItems() }
    } catch { showToast('❌ Network error') }
    setSavingItem(false)
  }

  // ── Delete this branch's own item ─────────────────────────────────
  const deleteOwnItem = async (item) => {
    if (!confirm(`"${item.name}" delete kare? Permanently hat jayega.`)) return
    try {
      const res = await fetch('/api/admin', { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'branch_inventory', action: 'delete_item', branch_id: user.branch_id, item_id: item.id }) })
      if (res.ok) { setItems(prev => prev.filter(i => i.id !== item.id)); showToast('🗑 Item delete ho gaya') }
      else { const d = await res.json(); showToast('❌ ' + (d.error || 'Fail')) }
    } catch { showToast('❌ Network error') }
  }

  // ── Toggle branch open/close ──────────────────────────────────────
  const toggleBranch = async () => {
    if (!branchInfo) return
    try {
      const res = await fetch('/api/admin', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'branch', action: 'toggle', id: user.branch_id }),
      })
      const d = await res.json()
      if (!res.ok) { showToast('❌ ' + (d.error || 'Error')); return }
      setBranchInfo(prev => ({ ...prev, is_active: d.branch?.is_active ?? !prev.is_active }))
      showToast(d.branch?.is_active ? '🟢 Branch Open!' : '🔴 Branch Closed')
    } catch { showToast('❌ Network error') }
  }

  const logout = async () => {
    await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'logout' }) })
    router.push('/login')
  }

  // ── Assign delivery boy ───────────────────────────────────────────
  const assignBoy = async (orderId, boyId) => {
    try {
      const res = await fetch('/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, deliveryBoyId: boyId }),
      })
      if (!res.ok) { showToast('❌ Assign nahi hua'); return }
      const boy = boys.find(b => b.id === boyId)
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, delivery_boy_id: boyId, delivery_boy_name: boy?.name } : o))
      // Also update modal if it's open for this order
      if (orderDetail?.id === orderId) {
        setOrderDetail(prev => ({ ...prev, delivery_boy_id: boyId, delivery_boy_name: boy?.name, delivery_boy_phone: boy?.phone }))
      }
      showToast('✅ Delivery boy assign ho gaya!')
    } catch { showToast('❌ Network error') }
  }

  // ── Order detail modal ────────────────────────────────────────────
  const openOrderDetail = async (orderId) => {
    try {
      const res = await fetch(`/api/orders?id=${orderId}`)
      const data = await res.json()
      setOrderDetail(data.order)
      setShowOrderDetail(true)
    } catch { showToast('❌ Order detail load nahi hua') }
  }

  // ── Derived counts ────────────────────────────────────────────────
  const pendingCount   = orders.filter(o => o.status === 'pending').length
  const cancelledCount = orders.filter(o => o.status === 'cancelled').length

  const filteredOrders = statusFilter === 'all'
    ? orders
    : orders.filter(o => o.status === statusFilter)

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontSize: 14, color: 'var(--t2)' }}>
      Loading...
    </div>
  )

  return (
    <div className={styles.page}>

      {/* Alert audio */}
      <audio ref={audioRef} src="/alert.mp3" preload="auto" />

      {/* Toast */}
      {toast && <div className={styles.toast}>{toast}</div>}

      {/* ── New Order Banner (visual alert — audio alone is unreliable) ── */}
      {newOrderBanner && (
        <div
          onClick={() => {
            setNewOrderBanner(false)
            document.title = 'Branch Panel'
            setSection('orders')
            setStatusFilter('pending')
          }}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
            background: '#dc2626', color: '#fff', textAlign: 'center',
            padding: '11px 16px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
            animation: 'branchPulse 1s ease-in-out infinite',
          }}>
          🔴 NAYA ORDER AAYA HAI! — Click karke dekhein ✕
        </div>
      )}
      <style>{`@keyframes branchPulse { 0%,100%{opacity:1} 50%{opacity:0.65} }`}</style>

      {/* ── Sidebar ── */}
      <aside className={styles.sidebar} style={{ marginTop: newOrderBanner ? 44 : 0 }}>
        <div className={styles.sidebarLogo}>🏪 Branch Panel</div>
        <div style={{ fontSize: 11, color: '#f97316', fontWeight: 700, padding: '0 8px 10px', letterSpacing: 0.3 }}>
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
      <main className={styles.main} style={{ paddingTop: newOrderBanner ? 44 : undefined }}>

        {/* Top bar — branch open/close */}
        <div className={styles.kitchenCard}>
          <div>
            <strong>🍽️ {branchInfo?.name || 'Branch'}</strong>
            <p style={{ fontSize: 12, color: 'var(--t2)', marginTop: 3 }}>Branch kholo ya band karo</p>
          </div>
          <div className={styles.bigToggle}>
            <div
              className={`${styles.bigTrack} ${branchInfo?.is_active ? styles.on : ''}`}
              onClick={toggleBranch}>
              <div className={styles.bigKnob} />
            </div>
            <span style={{ fontWeight: 600, color: branchInfo?.is_active ? 'var(--gr-d)' : 'var(--rd)', fontSize: 14 }}>
              {branchInfo?.is_active ? 'Open' : 'Closed'}
            </span>
          </div>
        </div>

        {/* ── ORDERS SECTION ── */}
        {section === 'orders' && (() => {
          const deliveredCount   = orders.filter(o => o.status === 'delivered').length
          const deliveredRevenue = orders.filter(o => o.status === 'delivered').reduce((s, o) => s + parseFloat(o.total || 0), 0)
          const activeCount      = orders.filter(o => !['delivered', 'cancelled'].includes(o.status)).length

          return (
            <>
              {/* Stats */}
              <div className={styles.statsRow}>
                {[
                  ['Orders',    orders.length,                       ''],
                  ['Active',    activeCount,                         'var(--am)'],
                  ['Delivered', deliveredCount,                      'var(--gr-d)'],
                  ['Revenue',   `₹${Math.round(deliveredRevenue)}`, 'var(--or)'],
                  ['Cancelled', cancelledCount,                      'var(--rd)'],
                ].map(([label, val, col]) => (
                  <div key={label} className={styles.statCard}>
                    <div className={styles.statLabel}>{label}</div>
                    <div className={styles.statVal} style={{ color: col || 'var(--t1)' }}>{val}</div>
                  </div>
                ))}
              </div>

              {/* Section head: filters + today toggle + refresh */}
              <div className={styles.sectionHead}>
                <h2>Live Orders</h2>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>

                  {/* Today / Sabke toggle */}
                  <div style={{ display: 'flex', gap: 3, background: 'var(--bg)', borderRadius: 8, padding: 3, border: '1px solid var(--bd)' }}>
                    <button
                      onClick={() => setTodayOnly(true)}
                      style={{
                        padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                        fontSize: 12, fontWeight: 600, transition: 'all 0.15s',
                        background: todayOnly ? 'var(--or)' : 'transparent',
                        color: todayOnly ? '#fff' : 'var(--t2)',
                      }}>
                      📅 Aaj
                    </button>
                    <button
                      onClick={() => setTodayOnly(false)}
                      style={{
                        padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                        fontSize: 12, fontWeight: 600, transition: 'all 0.15s',
                        background: !todayOnly ? 'var(--or)' : 'transparent',
                        color: !todayOnly ? '#fff' : 'var(--t2)',
                      }}>
                      🗂️ Sabke
                    </button>
                  </div>

                  {/* Status filter chips */}
                  <div className={styles.filters}>
                    {[
                      { key: 'all',              label: 'All' },
                      { key: 'pending',          label: '🔴 New' },
                      { key: 'preparing',        label: '🟡 Preparing' },
                      { key: 'ready',            label: '🟢 Ready' },
                      { key: 'out_for_delivery', label: '🛵 Out' },
                      { key: 'delivered',        label: '✅ Delivered' },
                    ].map(f => (
                      <button key={f.key}
                        className={`${styles.fChip} ${statusFilter === f.key ? styles.active : ''}`}
                        onClick={() => setStatusFilter(f.key)}>
                        {f.label}
                        {f.key === 'pending' && pendingCount > 0 && ` (${pendingCount})`}
                      </button>
                    ))}
                  </div>

                  {/* Refresh */}
                  <button
                    className="btn btn-secondary"
                    style={{ fontSize: 12, minWidth: 84 }}
                    onClick={() => fetchOrders(true)}
                    disabled={refreshing}>
                    {refreshing ? '⏳ ...' : '🔄 Refresh'}
                  </button>
                </div>
              </div>

              {/* Orders table */}
              <div className={styles.tableWrap}>
                <div className={styles.table}>
                  <div className={`${styles.tHead} ${styles.ordCols}`}>
                    <span>Order</span>
                    <span>Customer</span>
                    <span>Amount</span>
                    <span>Time</span>
                    <span>Status</span>
                    <span>Delivery Boy</span>
                  </div>

                  {filteredOrders.map(o => {
                    const rowBg = {
                      pending:          '#fffbeb',
                      confirmed:        '#eff6ff',
                      preparing:        '#f5f3ff',
                      out_for_delivery: '#fff7ed',
                      cancelled:        '#fef2f2',
                    }[o.status] || 'transparent'

                    const d       = new Date(o.created_at)
                    const timeStr = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                    const dateStr = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })

                    return (
                      <div key={o.id} className={`${styles.tRow} ${styles.ordCols}`} style={{ background: rowBg }}>
                        {/* Order # — clickable */}
                        <span
                          className={styles.orderId}
                          style={{ cursor: 'pointer', textDecoration: 'underline', color: 'var(--bl)' }}
                          onClick={() => openOrderDetail(o.id)}>
                          #{o.order_number}
                        </span>

                        {/* Customer */}
                        <div>
                          <div style={{ fontWeight: 500, fontSize: 12 }}>{o.customer_name}</div>
                          <div style={{ fontSize: 11, color: 'var(--t2)' }}>{o.customer_phone}</div>
                          <div style={{ fontSize: 10, color: 'var(--t3)' }}>📍 {o.delivery_address?.slice(0, 30)}</div>
                        </div>

                        {/* Amount */}
                        <span style={{ fontWeight: 500 }}>₹{Math.round(o.total)}</span>

                        {/* Time — show date too when viewing all orders */}
                        <span style={{ fontSize: 11, color: 'var(--t2)' }}>
                          {timeStr}
                          {!todayOnly && (
                            <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 2 }}>{dateStr}</div>
                          )}
                        </span>

                        {/* Status dropdown */}
                        <select
                          className={styles.statSel}
                          value={o.status}
                          onChange={e => updateOrderStatus(o.id, e.target.value)}>
                          {['pending', 'confirmed', 'preparing', 'out_for_delivery', 'ready', 'delivered', 'cancelled'].map(s => (
                            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                          ))}
                        </select>

                        {/* Delivery boy */}
                        <div>
                          {o.delivery_boy_name && (
                            <div style={{ fontSize: 11, color: 'var(--bl)', fontWeight: 600, marginBottom: 4 }}>
                              ✅ {o.delivery_boy_name}
                            </div>
                          )}
                          {(() => {
                            const onlineBoys = boys.filter(b => b.is_online)
                            if (!onlineBoys.length) return (
                              <span style={{ fontSize: 11, color: 'var(--rd)' }}>⚫ Koi Online Nahi</span>
                            )
                            return (
                              <select
                                className={styles.statSel}
                                value=""
                                onChange={e => e.target.value && assignBoy(o.id, e.target.value)}>
                                <option value="">{o.delivery_boy_name ? '↺ Change' : 'Assign'}</option>
                                {onlineBoys.map(b => (
                                  <option key={b.id} value={b.id}>🟢 {b.name}</option>
                                ))}
                              </select>
                            )
                          })()}
                        </div>
                      </div>
                    )
                  })}

                  {filteredOrders.length === 0 && (
                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--t2)' }}>
                      Koi order nahi mila
                    </div>
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
              <h2>📦 Mera Menu</h2>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary" style={{ fontSize: 12, background:'#16a34a' }} onClick={() => setShowAddItem(v => !v)}>
                  {showAddItem ? '✕ Cancel' : '➕ Apna Item'}
                </button>
                {items.some(i => !i.branch_available) && (
                  <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={markAllAvailable}>
                    ✅ Sab Available
                  </button>
                )}
                <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={fetchItems}>
                  🔄 Refresh
                </button>
              </div>
            </div>
            <p style={{ fontSize: 13, color: 'var(--t2)', marginBottom: 14 }}>
              Apna price + stock set karo, items on/off karo. Price blank = master rate. Stock blank = unlimited. Customers ko sirf ON items dikhte hain.
            </p>

            {/* Add own item form */}
            {showAddItem && (
              <div style={{ padding: 14, border: '1px solid var(--bd2)', borderRadius: 12, background: 'var(--card)', marginBottom: 16, maxWidth: 560 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>➕ Apna naya item</div>
                <div style={{ fontSize: 11, color: 'var(--t2)', marginBottom: 12 }}>Ye item sirf aapki branch me dikhega.</div>

                {(() => {
                  const fld = { padding: '9px 11px', border: '1px solid var(--bd2)', borderRadius: 8, background: 'var(--bg)', color: 'var(--t1)', fontSize: 13, boxSizing: 'border-box' }
                  const lbl = { fontSize: 11, fontWeight: 700, color: 'var(--t2)', display: 'block', marginBottom: 4 }
                  // Category options = categories already in this branch's menu
                  const cats = [...new Set(items.map(i => i.category).filter(Boolean))].sort()
                  return (
                  <>
                    <div style={{ marginBottom: 10 }}>
                      <label style={lbl}>Item Name *</label>
                      <input value={newItem.name} onChange={e => setNewItem(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Special Thali"
                        style={{ ...fld, width: '100%' }} />
                    </div>

                    <div style={{ marginBottom: 10 }}>
                      <label style={lbl}>Description</label>
                      <input value={newItem.description} onChange={e => setNewItem(p => ({ ...p, description: e.target.value }))} placeholder="Chhota detail (optional)"
                        style={{ ...fld, width: '100%' }} />
                    </div>

                    <div style={{ marginBottom: 10 }}>
                      <label style={lbl}>Category *</label>
                      {newCatMode ? (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <input autoFocus value={newItem.category} onChange={e => setNewItem(p => ({ ...p, category: e.target.value }))} placeholder="Nayi category ka naam"
                            style={{ ...fld, flex: 1 }} />
                          <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => { setNewCatMode(false); setNewItem(p => ({ ...p, category: '' })) }}>↩︎ List</button>
                        </div>
                      ) : (
                        <select value={newItem.category}
                          onChange={e => { if (e.target.value === '__new__') { setNewCatMode(true); setNewItem(p => ({ ...p, category: '' })) } else setNewItem(p => ({ ...p, category: e.target.value })) }}
                          style={{ ...fld, width: '100%', appearance: 'auto' }}>
                          <option value="">— Category chuno —</option>
                          {cats.map(c => <option key={c} value={c}>{c}</option>)}
                          <option value="__new__">➕ Nayi category…</option>
                        </select>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                      <div style={{ flex: 1 }}>
                        <label style={lbl}>Price ₹ *</label>
                        <input type="number" min="0" value={newItem.price} onChange={e => setNewItem(p => ({ ...p, price: e.target.value }))} placeholder="0"
                          style={{ ...fld, width: '100%' }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={lbl}>Discount %</label>
                        <input type="number" min="0" max="100" value={newItem.discount_percent} onChange={e => setNewItem(p => ({ ...p, discount_percent: e.target.value }))} placeholder="0"
                          style={{ ...fld, width: '100%' }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={lbl}>Stock</label>
                        <input type="number" min="0" value={newItem.stock_count} onChange={e => setNewItem(p => ({ ...p, stock_count: e.target.value }))} placeholder="∞"
                          style={{ ...fld, width: '100%' }} />
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, cursor: 'pointer' }}>
                        <input type="radio" checked={newItem.is_veg} onChange={() => setNewItem(p => ({ ...p, is_veg: true }))} /> 🟢 Veg
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, cursor: 'pointer' }}>
                        <input type="radio" checked={!newItem.is_veg} onChange={() => setNewItem(p => ({ ...p, is_veg: false }))} /> 🔴 Non-veg
                      </label>
                    </div>
                  </>
                  )
                })()}

                <button className="btn btn-primary" style={{ width: '100%', fontSize: 14 }} disabled={savingItem} onClick={addOwnItem}>
                  {savingItem ? 'Adding…' : '✅ Add Item'}
                </button>
              </div>
            )}

            {/* Search */}
            <input value={itemSearch} onChange={e => setItemSearch(e.target.value)} placeholder="🔍 Item search karo..."
              style={{ width: '100%', maxWidth: 560, padding: '9px 12px', marginBottom: 14, border: '1px solid var(--bd2)', borderRadius: 8, background: 'var(--bg)', color: 'var(--t1)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            <div className={styles.menuGrid}>
              {items
                .filter(item => !itemSearch || item.name.toLowerCase().includes(itemSearch.toLowerCase()) || (item.category || '').toLowerCase().includes(itemSearch.toLowerCase()))
                .map(item => {
                const isOwned = item.owner_branch_id && item.owner_branch_id === user?.branch_id
                const priceOverridden = item.branch_price != null && Number(item.branch_price) !== Number(item.master_price)
                return (
                <div key={item.id} className={styles.menuCard} style={{ opacity: item.branch_available ? 1 : 0.55 }}>
                  <div className={styles.menuCardImg}>
                    {item.image_url
                      ? <img src={item.image_url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }} />
                      : <span style={{ fontSize: 28 }}>🍛</span>}
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap', marginBottom:2 }}>
                    <div className={styles.catTag}>{item.category}</div>
                    {isOwned && <span style={{ fontSize: 9, fontWeight: 700, color: '#16a34a', background: '#dcfce7', padding: '2px 6px', borderRadius: 5 }}>🏠 OWN</span>}
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>
                    {item.is_veg ? '🟢' : '🔴'} {item.name}
                  </div>

                  {/* Per-branch price + stock */}
                  <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--t3)', marginBottom: 2 }}>PRICE ₹</div>
                      <input type="number" min="0" inputMode="numeric"
                        defaultValue={item.branch_price ?? ''}
                        placeholder={String(item.master_price ?? '')}
                        onBlur={e => setItemPrice(item, e.target.value)}
                        style={{ width: '100%', padding: '6px 8px', fontSize: 13, textAlign: 'center', borderRadius: 6, boxSizing: 'border-box',
                          border: `1px solid ${priceOverridden ? 'var(--or)' : 'var(--bd2)'}`, background: 'var(--bg)', color: priceOverridden ? 'var(--or)' : 'var(--t1)', fontWeight: priceOverridden ? 700 : 400 }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--t3)', marginBottom: 2 }}>STOCK</div>
                      <input type="number" min="0" inputMode="numeric"
                        defaultValue={item.branch_stock ?? ''}
                        placeholder="∞"
                        onBlur={e => setItemStock(item, e.target.value)}
                        style={{ width: '100%', padding: '6px 8px', fontSize: 13, textAlign: 'center', borderRadius: 6, boxSizing: 'border-box',
                          border: `1px solid ${item.branch_stock != null && item.branch_stock <= 0 ? 'var(--rd)' : 'var(--bd2)'}`, background: 'var(--bg)', color: item.branch_stock != null && item.branch_stock <= 0 ? 'var(--rd)' : 'var(--t1)' }} />
                    </div>
                  </div>

                  <div className={styles.availToggle}>
                    <div
                      onClick={() => toggleItem(item.id, item.branch_available)}
                      style={{
                        width: 40, height: 22, borderRadius: 11,
                        background: item.branch_available ? 'var(--gr)' : 'var(--rd)',
                        position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0,
                      }}>
                      <div style={{
                        position: 'absolute', top: 2,
                        left: item.branch_available ? 20 : 2,
                        width: 18, height: 18, borderRadius: '50%', background: '#fff',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s',
                      }} />
                    </div>
                    <span style={{ fontSize: 12, color: item.branch_available ? 'var(--gr-d)' : 'var(--rd)', fontWeight: 600 }}>
                      {item.branch_available ? 'Available' : 'Unavailable'}
                    </span>
                    {isOwned && (
                      <button onClick={() => deleteOwnItem(item)} title="Delete"
                        style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, color: 'var(--rd)', padding: '2px 4px' }}>🗑</button>
                    )}
                  </div>
                </div>
                )
              })}
              {items.length === 0 && (
                <div style={{ color: 'var(--t2)', fontSize: 13 }}>Koi item nahi mila</div>
              )}
            </div>
          </>
        )}
      </main>

      {/* ── Order Detail Modal ── */}
      {showOrderDetail && orderDetail && (
        <div className={styles.modalBg} onClick={e => e.target === e.currentTarget && setShowOrderDetail(false)}>
          <div className={styles.modal} style={{ maxWidth: 500, maxHeight: '90vh', overflowY: 'auto' }}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>Order #{orderDetail.order_number}</h3>
              <button onClick={() => setShowOrderDetail(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>

            {/* Customer */}
            <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '12px 14px', marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: 'var(--t2)' }}>👤 CUSTOMER</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{orderDetail.customer_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--t2)' }}>{orderDetail.customer_phone}</div>
                  <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 4 }}>📍 {orderDetail.delivery_address}</div>
                  {orderDetail.distance_km && (
                    <div style={{ fontSize: 11, color: 'var(--t3)' }}>{parseFloat(orderDetail.distance_km).toFixed(1)} km</div>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <a href={`tel:${orderDetail.customer_phone}`}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#dcfce7', color: '#16a34a', borderRadius: 8, padding: '6px 12px', textDecoration: 'none', fontSize: 12, fontWeight: 600 }}>
                    📞 Call
                  </a>
                  <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(orderDetail.delivery_address)}`}
                    target="_blank" rel="noopener noreferrer"
                    style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#dbeafe', color: '#1d4ed8', borderRadius: 8, padding: '6px 12px', textDecoration: 'none', fontSize: 12, fontWeight: 600 }}>
                    🗺️ Map
                  </a>
                </div>
              </div>
            </div>

            {/* Items */}
            <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '12px 14px', marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: 'var(--t2)' }}>📦 ITEMS</div>
              {(orderDetail.items || []).map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                  <span>{item.name} <span style={{ color: 'var(--t2)' }}>×{item.quantity}</span></span>
                  <span style={{ fontWeight: 600 }}>₹{Math.round(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>

            {/* Notes */}
            {orderDetail.notes && (
              <div style={{ background: '#fef3c7', borderRadius: 10, padding: '10px 14px', marginBottom: 12, fontSize: 12, color: '#92400e' }}>
                📝 <strong>Customer Remarks:</strong> {orderDetail.notes}
              </div>
            )}

            {/* Delivery Boy — assign from modal */}
            <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '12px 14px', marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: 'var(--t2)' }}>🛵 DELIVERY BOY</div>
              {orderDetail.delivery_boy_name ? (
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gr-d)', marginBottom: 8 }}>
                  ✅ {orderDetail.delivery_boy_name}
                  {orderDetail.delivery_boy_phone && ` · ${orderDetail.delivery_boy_phone}`}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: 'var(--rd)', marginBottom: 8 }}>⚠️ Koi assign nahi hai</div>
              )}
              {(() => {
                const onlineBoys = boys.filter(b => b.is_online)
                if (!onlineBoys.length) return (
                  <div style={{ fontSize: 12, color: 'var(--t2)' }}>⚫ Koi boy online nahi hai</div>
                )
                return (
                  <select
                    className={styles.statSel}
                    value=""
                    onChange={e => e.target.value && assignBoy(orderDetail.id, e.target.value)}
                    style={{ width: '100%' }}>
                    <option value="">{orderDetail.delivery_boy_name ? '↺ Change Boy' : '👉 Boy Assign Karo'}</option>
                    {onlineBoys.map(b => (
                      <option key={b.id} value={b.id}>🟢 {b.name}</option>
                    ))}
                  </select>
                )
              })()}
            </div>

            {/* Bill */}
            <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                <span>Subtotal</span><span>₹{Math.round(orderDetail.subtotal)}</span>
              </div>
              {orderDetail.discount_amount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4, color: 'var(--gr-d)' }}>
                  <span>Discount</span><span>−₹{Math.round(orderDetail.discount_amount)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                <span>Delivery Charge</span><span>₹{Math.round(orderDetail.delivery_charge)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 700, marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--bd)' }}>
                <span>💵 Total (COD)</span>
                <span style={{ color: 'var(--or)' }}>₹{Math.round(orderDetail.total)}</span>
              </div>
            </div>

            {/* Print Bill */}
            <button
              onClick={() => {
                const w = window.open('', '_blank', 'width=380,height=600')
                const rows = (orderDetail.items || []).map(i =>
                  `<tr><td>${i.name}</td><td style="text-align:center">${i.quantity}</td><td style="text-align:right">₹${Math.round(i.price * i.quantity)}</td></tr>`
                ).join('')
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
              }}
              style={{ marginTop: 14, width: '100%', padding: '10px', background: '#1e293b', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              🖨️ Print Bill / Receipt
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

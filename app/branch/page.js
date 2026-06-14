'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'

const STATUS_LABELS = {
  pending:    { label: 'New',       color: '#ef4444', bg: '#fef2f2', emoji: '🔴' },
  confirmed:  { label: 'Confirmed', color: '#f97316', bg: '#fff7ed', emoji: '🟠' },
  preparing:  { label: 'Preparing', color: '#eab308', bg: '#fefce8', emoji: '🟡' },
  ready:      { label: 'Ready',     color: '#22c55e', bg: '#f0fdf4', emoji: '🟢' },
  delivered:  { label: 'Delivered', color: '#6b7280', bg: '#f9fafb', emoji: '✅' },
  cancelled:  { label: 'Cancelled', color: '#ef4444', bg: '#fef2f2', emoji: '❌' },
}

const NEXT_STATUS = {
  pending:   'preparing',
  confirmed: 'preparing',
  preparing: 'ready',
  ready:     'delivered',
}

export default function BranchDashboard() {
  const router = useRouter()
  const [user, setUser]           = useState(null)
  const [branchInfo, setBranchInfo] = useState(null)
  const [orders, setOrders]       = useState([])
  const [items, setItems]         = useState([])
  const [activeTab, setActiveTab] = useState('orders') // 'orders' | 'items'
  const [statusFilter, setStatusFilter] = useState('active') // 'active' | 'delivered' | 'all'
  const [loading, setLoading]     = useState(true)
  const [toast, setToast]         = useState('')
  const prevNewCount = useRef(0)
  const audioRef = useRef(null)
  const pollRef  = useRef(null)

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  // ── Auth check ──────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'me' }) })
      .then(r => r.json())
      .then(({ user }) => {
        if (!user || user.role !== 'admin' || !user.branch_id) {
          router.push('/login')
          return
        }
        setUser(user)
      })
      .catch(() => router.push('/login'))
  }, [])

  // ── Load branch info + items when user ready ────────────────────────
  useEffect(() => {
    if (!user) return
    // Get branch details
    fetch('/api/admin?type=branch')
      .then(r => r.json())
      .then(({ branches }) => {
        const mine = (branches || []).find(b => b.id === user.branch_id)
        setBranchInfo(mine || null)
      })
    // Get items availability
    fetchItems()
  }, [user])

  const fetchItems = useCallback(() => {
    if (!user?.branch_id) return
    fetch(`/api/admin?type=branch_inventory&branch_id=${user.branch_id}`)
      .then(r => r.json())
      .then(({ items }) => setItems(items || []))
  }, [user])

  // ── Orders polling ──────────────────────────────────────────────────
  const fetchOrders = useCallback(() => {
    fetch('/api/orders')
      .then(r => r.json())
      .then(({ orders: o }) => {
        const list = o || []
        setOrders(list)
        setLoading(false)
        // Alert sound if new orders arrived
        const newCount = list.filter(x => x.status === 'pending').length
        if (newCount > prevNewCount.current && prevNewCount.current >= 0) {
          try { audioRef.current?.play() } catch {}
        }
        prevNewCount.current = newCount
      })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!user) return
    fetchOrders()
    pollRef.current = setInterval(fetchOrders, 15000) // poll every 15s
    return () => clearInterval(pollRef.current)
  }, [user, fetchOrders])

  // ── Update order status ─────────────────────────────────────────────
  const updateStatus = async (orderId, newStatus) => {
    try {
      const res = await fetch('/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: orderId, status: newStatus }),
      })
      if (!res.ok) { showToast('❌ Status update failed'); return }
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o))
      showToast(newStatus === 'preparing' ? '🟡 Preparing...' : newStatus === 'ready' ? '🟢 Ready for pickup!' : '✅ Delivered')
    } catch { showToast('❌ Network error') }
  }

  // ── Toggle item availability ────────────────────────────────────────
  const toggleItem = async (itemId, currentVal) => {
    const newVal = !currentVal
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, branch_available: newVal } : i))
    try {
      await fetch('/api/admin', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'branch_inventory', action: 'toggle_item', branch_id: user.branch_id, item_id: itemId, is_available: newVal }),
      })
    } catch { fetchItems() }
  }

  // ── Toggle branch open/close ─────────────────────────────────────────
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

  // ── Filter orders ────────────────────────────────────────────────────
  const filteredOrders = orders.filter(o => {
    if (statusFilter === 'active')    return ['pending','confirmed','preparing','ready'].includes(o.status)
    if (statusFilter === 'delivered') return o.status === 'delivered'
    return true
  })

  const newCount       = orders.filter(o => o.status === 'pending').length
  const preparingCount = orders.filter(o => o.status === 'preparing').length
  const readyCount     = orders.filter(o => o.status === 'ready').length

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', fontSize:18, color:'#666' }}>
      Loading...
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background:'#f8fafc', fontFamily:'system-ui,sans-serif' }}>

      {/* Alert audio */}
      <audio ref={audioRef} src="/alert.mp3" preload="auto" />

      {/* Toast */}
      {toast && (
        <div style={{ position:'fixed', top:16, left:'50%', transform:'translateX(-50%)', background:'#1e293b', color:'#fff', padding:'10px 20px', borderRadius:8, zIndex:9999, fontSize:14, fontWeight:600 }}>
          {toast}
        </div>
      )}

      {/* ── Header ── */}
      <div style={{ background:'#fff', borderBottom:'1px solid #e2e8f0', padding:'12px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:100 }}>
        <div>
          <div style={{ fontWeight:700, fontSize:16, color:'#0f172a' }}>
            🍽️ {branchInfo?.name || 'Branch Dashboard'}
          </div>
          <div style={{ fontSize:12, color:'#64748b', marginTop:2 }}>
            {branchInfo?.is_active ? '🟢 Open' : '🔴 Closed'}
          </div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <button
            onClick={toggleBranch}
            style={{ padding:'6px 14px', borderRadius:8, border:'none', cursor:'pointer', fontWeight:600, fontSize:13,
              background: branchInfo?.is_active ? '#fef2f2' : '#f0fdf4',
              color:       branchInfo?.is_active ? '#ef4444' : '#16a34a' }}
          >
            {branchInfo?.is_active ? '🔒 Close Branch' : '🔓 Open Branch'}
          </button>
          <button onClick={logout} style={{ padding:'6px 12px', borderRadius:8, border:'1px solid #e2e8f0', background:'#fff', cursor:'pointer', fontSize:13, color:'#64748b' }}>
            Logout
          </button>
        </div>
      </div>

      {/* ── Stats row ── */}
      <div style={{ display:'flex', gap:12, padding:'12px 16px', overflowX:'auto' }}>
        {[
          { label:'New Orders', count:newCount, color:'#ef4444', bg:'#fef2f2', emoji:'🔴' },
          { label:'Preparing',  count:preparingCount, color:'#eab308', bg:'#fefce8', emoji:'🟡' },
          { label:'Ready',      count:readyCount,     color:'#22c55e', bg:'#f0fdf4', emoji:'🟢' },
          { label:'Total Today', count:orders.length, color:'#6366f1', bg:'#eef2ff', emoji:'📦' },
        ].map(s => (
          <div key={s.label} style={{ background:s.bg, borderRadius:12, padding:'12px 16px', minWidth:110, textAlign:'center', border:`1px solid ${s.color}22` }}>
            <div style={{ fontSize:22 }}>{s.emoji}</div>
            <div style={{ fontSize:24, fontWeight:700, color:s.color }}>{s.count}</div>
            <div style={{ fontSize:11, color:'#64748b', marginTop:2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div style={{ display:'flex', gap:0, padding:'0 16px', borderBottom:'2px solid #e2e8f0', marginBottom:0 }}>
        {[
          { key:'orders', label:'📋 Orders' },
          { key:'items',  label:'📦 Item Availability' },
        ].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            style={{ padding:'10px 18px', border:'none', background:'none', cursor:'pointer', fontWeight:600, fontSize:14,
              color: activeTab === t.key ? '#6366f1' : '#64748b',
              borderBottom: activeTab === t.key ? '2px solid #6366f1' : '2px solid transparent',
              marginBottom:-2 }}>
            {t.label}
            {t.key === 'orders' && newCount > 0 && (
              <span style={{ marginLeft:6, background:'#ef4444', color:'#fff', borderRadius:10, padding:'1px 7px', fontSize:11 }}>{newCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Orders Tab ── */}
      {activeTab === 'orders' && (
        <div style={{ padding:'12px 16px' }}>
          {/* Status filter */}
          <div style={{ display:'flex', gap:8, marginBottom:12, flexWrap:'wrap' }}>
            {[
              { key:'active',    label:'Active' },
              { key:'delivered', label:'Delivered' },
              { key:'all',       label:'All' },
            ].map(f => (
              <button key={f.key} onClick={() => setStatusFilter(f.key)}
                style={{ padding:'5px 14px', borderRadius:20, border:'1px solid', cursor:'pointer', fontSize:13, fontWeight:600,
                  background: statusFilter === f.key ? '#6366f1' : '#fff',
                  color:      statusFilter === f.key ? '#fff' : '#64748b',
                  borderColor: statusFilter === f.key ? '#6366f1' : '#e2e8f0' }}>
                {f.label}
              </button>
            ))}
            <button onClick={fetchOrders} style={{ padding:'5px 14px', borderRadius:20, border:'1px solid #e2e8f0', background:'#fff', cursor:'pointer', fontSize:13, color:'#64748b' }}>
              🔄 Refresh
            </button>
          </div>

          {filteredOrders.length === 0 && (
            <div style={{ textAlign:'center', color:'#94a3b8', padding:'40px 0', fontSize:15 }}>
              {statusFilter === 'active' ? '✅ No active orders right now' : 'No orders found'}
            </div>
          )}

          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {filteredOrders.map(order => {
              const st = STATUS_LABELS[order.status] || STATUS_LABELS.pending
              const next = NEXT_STATUS[order.status]
              const items = order.items || []
              return (
                <div key={order.id} style={{ background:'#fff', borderRadius:12, border:`2px solid ${st.color}44`, padding:'14px', boxShadow:'0 1px 3px rgba(0,0,0,0.06)' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                    <div>
                      <span style={{ fontWeight:700, fontSize:15 }}>#{order.order_number || order.id?.slice(-6)}</span>
                      <span style={{ marginLeft:8, background:st.bg, color:st.color, padding:'2px 8px', borderRadius:6, fontSize:12, fontWeight:600 }}>
                        {st.emoji} {st.label}
                      </span>
                    </div>
                    <div style={{ fontSize:14, fontWeight:700, color:'#0f172a' }}>₹{order.total}</div>
                  </div>

                  {/* Customer */}
                  <div style={{ fontSize:13, color:'#475569', marginBottom:6 }}>
                    👤 {order.customer_name || 'Customer'}
                    {order.customer_phone && <span style={{ marginLeft:8 }}>📞 {order.customer_phone}</span>}
                  </div>

                  {/* Address */}
                  {order.delivery_address && (
                    <div style={{ fontSize:12, color:'#64748b', marginBottom:8 }}>📍 {order.delivery_address}</div>
                  )}

                  {/* Items */}
                  <div style={{ borderTop:'1px solid #f1f5f9', paddingTop:8, marginBottom:8 }}>
                    {items.map((item, i) => (
                      <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:'#334155', marginBottom:2 }}>
                        <span>{item.quantity}× {item.name}</span>
                        <span>₹{item.price * item.quantity}</span>
                      </div>
                    ))}
                  </div>

                  {/* Action button */}
                  {next && (
                    <button
                      onClick={() => updateStatus(order.id, next)}
                      style={{ width:'100%', padding:'9px', borderRadius:8, border:'none', cursor:'pointer', fontWeight:700, fontSize:14,
                        background: next === 'preparing' ? '#fef9c3' : next === 'ready' ? '#dcfce7' : '#f0fdf4',
                        color:      next === 'preparing' ? '#854d0e' : next === 'ready' ? '#15803d' : '#166534' }}>
                      {next === 'preparing' ? '🟡 Start Preparing' : next === 'ready' ? '🟢 Mark as Ready' : '✅ Mark Delivered'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Item Availability Tab ── */}
      {activeTab === 'items' && (
        <div style={{ padding:'12px 16px' }}>
          <div style={{ fontSize:13, color:'#64748b', marginBottom:12 }}>
            Aaj jo item available nahi hai use band karo — customer ko order karte waqt nahi dikhega.
          </div>

          {/* Group by category */}
          {(() => {
            const cats = [...new Set(items.map(i => i.category || 'Other'))]
            return cats.map(cat => {
              const catItems = items.filter(i => (i.category || 'Other') === cat)
              return (
                <div key={cat} style={{ marginBottom:16 }}>
                  <div style={{ fontWeight:700, fontSize:13, color:'#64748b', textTransform:'uppercase', letterSpacing:1, marginBottom:8 }}>{cat}</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    {catItems.map(item => (
                      <div key={item.id} style={{ background:'#fff', borderRadius:10, padding:'12px 14px', display:'flex', justifyContent:'space-between', alignItems:'center', border:'1px solid #e2e8f0', opacity: item.branch_available ? 1 : 0.6 }}>
                        <div>
                          <div style={{ fontWeight:600, fontSize:14, color:'#0f172a' }}>
                            {item.is_veg ? '🟢' : '🔴'} {item.name}
                          </div>
                          <div style={{ fontSize:12, color:'#94a3b8', marginTop:2 }}>₹{item.price}</div>
                        </div>
                        <div
                          onClick={() => toggleItem(item.id, item.branch_available)}
                          style={{ width:44, height:24, borderRadius:12, background: item.branch_available ? '#22c55e' : '#e2e8f0', position:'relative', cursor:'pointer', transition:'background 0.2s' }}>
                          <div style={{ position:'absolute', top:2, left: item.branch_available ? 22 : 2, width:20, height:20, borderRadius:'50%', background:'#fff', boxShadow:'0 1px 3px rgba(0,0,0,0.2)', transition:'left 0.2s' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })
          })()}
        </div>
      )}
    </div>
  )
}

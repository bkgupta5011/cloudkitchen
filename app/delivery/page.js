'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import styles from './delivery.module.css'

export default function DeliveryPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [orders, setOrders] = useState([])
  const [history, setHistory] = useState([])
  const [stats, setStats] = useState(null)
  const [boyInfo, setBoyInfo] = useState(null)
  const [tab, setTab] = useState('orders') // orders | history
  const [period, setPeriod] = useState('today')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'me' }) })
      .then(r => r.json())
      .then(({ user }) => {
        if (!user || user.role !== 'delivery') { router.push('/login'); return }
        setUser(user)
        loadData()
      })
  }, [])

  const loadData = async () => {
    const [ordersRes, historyRes] = await Promise.all([
      fetch('/api/orders').then(r => r.json()),
      fetch(`/api/delivery/history?period=today`).then(r => r.json()),
    ])
    setOrders(ordersRes.orders || [])
    setHistory(historyRes.orders || [])
    setStats(historyRes.stats)
    setBoyInfo(historyRes.boyInfo)
    setLoading(false)
  }

  const loadHistory = async (p) => {
    setPeriod(p)
    const res = await fetch(`/api/delivery/history?period=${p}`).then(r => r.json())
    setHistory(res.orders || [])
    setStats(res.stats)
  }

  const markDelivered = async (orderId) => {
    await fetch('/api/orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, status: 'delivered' })
    })
    setOrders(prev => prev.filter(o => o.id !== orderId))
    loadHistory(period)
  }

  const openMap = (address, lat, lng) => {
    const query = lat && lng ? `${lat},${lng}` : encodeURIComponent(address)
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank')
  }

  const logout = async () => {
    await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'logout' }) })
    router.push('/login')
  }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}><div className="spinner" /></div>

  return (
    <div className={styles.page}>
      {/* Nav */}
      <nav className={styles.nav}>
        <span className={styles.logo}>🛵 Delivery Portal</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, color: 'var(--t2)' }}>{boyInfo?.name}</span>
          <span className={`badge ${boyInfo?.is_online ? 'badge-done' : 'badge-cancelled'}`}>{boyInfo?.is_online ? 'Online' : 'Offline'}</span>
          <button className="btn btn-secondary" style={{ fontSize: 12, padding: '5px 10px' }} onClick={logout}>Logout</button>
        </div>
      </nav>

      {/* Stats */}
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <div className={styles.statVal} style={{ color: 'var(--gr-d)' }}>₹{Math.round(stats?.total_earned ?? 0)}</div>
          <div className={styles.statLabel}>Today's Earnings</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statVal}>{stats?.total_deliveries ?? 0}</div>
          <div className={styles.statLabel}>Delivered Today</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statVal}>{orders.length}</div>
          <div className={styles.statLabel}>Pending Now</div>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button className={`${styles.tab} ${tab === 'orders' ? styles.active : ''}`} onClick={() => setTab('orders')}>
          📋 My Orders {orders.length > 0 && <span className={styles.tabBadge}>{orders.length}</span>}
        </button>
        <button className={`${styles.tab} ${tab === 'history' ? styles.active : ''}`} onClick={() => setTab('history')}>
          📊 History & Earnings
        </button>
      </div>

      {/* Orders tab */}
      {tab === 'orders' && (
        <div className={styles.body}>
          {orders.length === 0 ? (
            <div className={styles.empty}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
              <p>No pending orders assigned to you</p>
              <p style={{ fontSize: 12, color: 'var(--t3)', marginTop: 4 }}>New orders will appear here when assigned</p>
            </div>
          ) : (
            orders.map(o => (
              <div key={o.id} className={styles.orderCard}>
                <div className={styles.orderHead}>
                  <span className={styles.orderId}>Order #{o.order_number}</span>
                  <span className={`badge ${o.status === 'out_for_delivery' ? 'badge-out' : 'badge-prep'}`}>
                    {o.status === 'out_for_delivery' ? 'Out for Delivery' : 'Pickup Ready'}
                  </span>
                </div>

                {/* Customer info */}
                <div className={styles.custRow}>
                  <div className={styles.custAvatar}>{o.customer_name?.split(' ').map(n=>n[0]).join('')}</div>
                  <div>
                    <div className={styles.custName}>{o.customer_name}</div>
                    <a href={`tel:${o.customer_phone}`} className={styles.custPhone}>{o.customer_phone}</a>
                  </div>
                  <div className={styles.amount}>₹{Math.round(o.total)}<div style={{ fontSize: 10, color: 'var(--am)', fontWeight: 500 }}>COD</div></div>
                </div>

                {/* Address */}
                <div className={styles.addrBox}>
                  <span>📍</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>{o.delivery_address}</div>
                    {o.distance_km && <div style={{ fontSize: 11, color: 'var(--t3)' }}>{parseFloat(o.distance_km).toFixed(1)} km from kitchen</div>}
                  </div>
                </div>

                {/* Open map button */}
                <button className={styles.mapBtn} onClick={() => openMap(o.delivery_address, o.delivery_lat, o.delivery_lng)}>
                  🗺️ Open in Google Maps → Navigate
                </button>

                {/* Actions */}
                <div className={styles.actions}>
                  <a href={`tel:${o.customer_phone}`} className="btn btn-secondary" style={{ flex: 1, textDecoration: 'none', textAlign: 'center' }}>
                    📞 Call Customer
                  </a>
                  <button className={`btn ${styles.deliverBtn}`} style={{ flex: 1 }} onClick={() => markDelivered(o.id)}>
                    ✓ Mark Delivered
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* History tab */}
      {tab === 'history' && (
        <div className={styles.body}>
          <div className={styles.periodRow}>
            {['today', 'week', 'month', 'all'].map(p => (
              <button key={p} className={`${styles.periodBtn} ${period === p ? styles.active : ''}`} onClick={() => loadHistory(p)}>
                {p === 'today' ? 'Today' : p === 'week' ? 'This Week' : p === 'month' ? 'This Month' : 'All Time'}
              </button>
            ))}
          </div>

          <div className={styles.earningsCard}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--gr-d)', marginBottom: 4 }}>Total Earned</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--gr-d)' }}>₹{Math.round(stats?.total_earned ?? 0)}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, color: 'var(--t2)', marginBottom: 4 }}>Deliveries</div>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{stats?.total_deliveries ?? 0}</div>
            </div>
          </div>

          {history.length === 0 ? (
            <div className={styles.empty}><p>No deliveries in this period</p></div>
          ) : (
            <div className={styles.historyTable}>
              <div className={styles.histHead}><span>Order</span><span>Address</span><span>Order Amt</span><span>You Earned</span></div>
              {history.map(o => (
                <div key={o.id} className={styles.histRow}>
                  <span style={{ fontWeight: 600, color: 'var(--bl)', fontSize: 12 }}>#{o.order_number}</span>
                  <span style={{ fontSize: 12, color: 'var(--t2)' }}>{o.delivery_address?.slice(0, 25)}...</span>
                  <span style={{ fontSize: 12 }}>₹{Math.round(o.total)}</span>
                  <span style={{ fontWeight: 600, color: 'var(--gr-d)', fontSize: 12 }}>₹{Math.round(o.earned)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import styles from './delivery.module.css'

export default function DeliveryPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [orders, setOrders] = useState([])
  const [history, setHistory] = useState([])
  const [stats, setStats] = useState(null)
  const [boyInfo, setBoyInfo] = useState(null)
  const [tab, setTab] = useState('orders') // orders | history | profile
  const [period, setPeriod] = useState('today')
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(false)
  const [profileEdit, setProfileEdit] = useState(false)
  const [profileForm, setProfileForm] = useState({})
  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' })
  const [saveMsg, setSaveMsg] = useState('')
  const [paymentHistory, setPaymentHistory] = useState([])
  const pollRef = useRef(null)

  useEffect(() => {
    fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'me' }) })
      .then(r => r.json())
      .then(({ user }) => {
        if (!user || user.role !== 'delivery') { router.push('/login'); return }
        setUser(user)
        loadData()
      })

    // Poll orders every 20s
    pollRef.current = setInterval(() => {
      fetch('/api/orders').then(r => r.json()).then(d => setOrders(d.orders || []))
    }, 20000)
    return () => clearInterval(pollRef.current)
  }, [])

  const loadData = async () => {
    const [ordersRes, historyRes, profileRes] = await Promise.all([
      fetch('/api/orders').then(r => r.json()),
      fetch(`/api/delivery/history?period=today`).then(r => r.json()),
      fetch('/api/profile').then(r => r.json()),
    ])
    setOrders(ordersRes.orders || [])
    setHistory(historyRes.orders || [])
    setStats(historyRes.stats)
    setPaymentHistory(historyRes.paymentHistory || [])
    const info = historyRes.boyInfo || profileRes.profile
    setBoyInfo(info)
    setProfileForm({
      name: info?.name || '',
      phone: info?.phone || '',
      home_address: info?.home_address || '',
      emergency_contact: info?.emergency_contact || '',
    })
    setLoading(false)
  }

  const loadHistory = async (p) => {
    setPeriod(p)
    const res = await fetch(`/api/delivery/history?period=${p}`).then(r => r.json())
    setHistory(res.orders || [])
    setStats(res.stats)
  }

  const toggleOnline = async () => {
    setToggling(true)
    const newStatus = !boyInfo?.is_online
    await fetch('/api/delivery/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isOnline: newStatus })
    })
    setBoyInfo(prev => ({ ...prev, is_online: newStatus }))
    setToggling(false)
  }

  const markDelivered = async (orderId) => {
    if (!confirm('Order delivered mark karna chahte ho?')) return
    await fetch('/api/orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, status: 'delivered' })
    })
    setOrders(prev => prev.filter(o => o.id !== orderId))
    loadHistory(period)
    loadData()
  }

  const openMap = (address, lat, lng) => {
    const query = lat && lng ? `${lat},${lng}` : encodeURIComponent(address)
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${query}`, '_blank')
  }

  const saveProfile = async () => {
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profileForm)
    })
    const data = await res.json()
    if (data.profile) { setBoyInfo(prev => ({ ...prev, ...data.profile })); setSaveMsg('✅ Profile save ho gayi!'); setProfileEdit(false) }
    else setSaveMsg('❌ Save nahi hua')
    setTimeout(() => setSaveMsg(''), 3000)
  }

  const changePassword = async (e) => {
    e.preventDefault()
    if (pwForm.newPw !== pwForm.confirm) { setSaveMsg('❌ Passwords match nahi kar rahe'); return }
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: pwForm.current, newPassword: pwForm.newPw })
    })
    const data = await res.json()
    setSaveMsg(data.message || data.error || 'Done')
    if (data.success) setPwForm({ current: '', newPw: '', confirm: '' })
    setTimeout(() => setSaveMsg(''), 4000)
  }

  const logout = async () => {
    await fetch('/api/delivery/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isOnline: false })
    })
    await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'logout' }) })
    router.push('/login')
  }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}><div className="spinner" /></div>

  return (
    <div className={styles.page}>
      {/* Nav */}
      <nav className={styles.nav}>
        <span className={styles.logo}>🛵 Delivery Portal</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--t2)', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{boyInfo?.name}</span>
          <button className="btn btn-secondary" style={{ fontSize: 12, padding: '5px 10px' }} onClick={logout}>Logout</button>
        </div>
      </nav>

      {/* Online/Offline Toggle — BIG & PROMINENT */}
      <div style={{
        background: boyInfo?.is_online ? 'linear-gradient(135deg,#16a34a,#22c55e)' : 'linear-gradient(135deg,#374151,#6b7280)',
        padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>
            {boyInfo?.is_online ? '🟢 You are ONLINE' : '⚫ You are OFFLINE'}
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>
            {boyInfo?.is_online ? 'Orders assign ho sakte hain' : 'Toggle karke online aao'}
          </div>
        </div>
        <button
          onClick={toggleOnline}
          disabled={toggling}
          style={{
            background: boyInfo?.is_online ? '#fff' : '#e85d04',
            color: boyInfo?.is_online ? '#16a34a' : '#fff',
            border: 'none', borderRadius: 30, padding: '10px 22px',
            fontWeight: 800, fontSize: 14, cursor: 'pointer',
            boxShadow: '0 2px 8px #0003', minWidth: 110
          }}>
          {toggling ? '...' : boyInfo?.is_online ? 'Go Offline' : 'Go Online'}
        </button>
      </div>

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
        <div className={styles.statCard} style={{ background: parseFloat(boyInfo?.payment_due||0)>0 ? '#fef2f2' : 'var(--card)', border: parseFloat(boyInfo?.payment_due||0)>0 ? '1.5px solid #fca5a5' : '1px solid var(--bd)' }}>
          <div className={styles.statVal} style={{ color: parseFloat(boyInfo?.payment_due||0)>0 ? '#dc2626' : 'var(--t3)' }}>₹{Math.round(parseFloat(boyInfo?.payment_due??0))}</div>
          <div className={styles.statLabel}>💳 Due</div>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button className={`${styles.tab} ${tab === 'orders' ? styles.active : ''}`} onClick={() => setTab('orders')}>
          📋 Orders {orders.length > 0 && <span className={styles.tabBadge}>{orders.length}</span>}
        </button>
        <button className={`${styles.tab} ${tab === 'history' ? styles.active : ''}`} onClick={() => { setTab('history'); loadHistory(period) }}>
          📊 Earnings
        </button>
        <button className={`${styles.tab} ${tab === 'profile' ? styles.active : ''}`} onClick={() => setTab('profile')}>
          👤 Profile
        </button>
      </div>

      {/* ── ORDERS TAB ── */}
      {tab === 'orders' && (
        <div className={styles.body}>
          {!boyInfo?.is_online && (
            <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 12, padding: '14px 16px', textAlign: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 28, marginBottom: 4 }}>⚫</div>
              <strong style={{ fontSize: 14 }}>Aap offline hain</strong>
              <p style={{ fontSize: 12, color: '#92400e', margin: '4px 0 0' }}>Orders receive karne ke liye "Go Online" karo</p>
            </div>
          )}
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
                    {o.status === 'out_for_delivery' ? '🚀 Out for Delivery' : '🍳 Pickup Ready'}
                  </span>
                </div>

                {/* Customer info */}
                <div className={styles.custRow}>
                  <div className={styles.custAvatar}>{o.customer_name?.split(' ').map(n => n[0]).join('')}</div>
                  <div style={{ flex: 1 }}>
                    <div className={styles.custName}>{o.customer_name}</div>
                    <a href={`tel:${o.customer_phone}`} className={styles.custPhone}>📞 {o.customer_phone}</a>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className={styles.amount}>₹{Math.round(o.total)}</div>
                    <div style={{ fontSize: 10, color: 'var(--am)', fontWeight: 600 }}>💵 COLLECT CASH</div>
                  </div>
                </div>

                {/* Address */}
                <div className={styles.addrBox}>
                  <span>📍</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>{o.delivery_address}</div>
                    {o.distance_km && <div style={{ fontSize: 11, color: 'var(--t3)' }}>{parseFloat(o.distance_km).toFixed(1)} km from kitchen</div>}
                  </div>
                </div>

                {/* Notes */}
                {o.notes && (
                  <div style={{ background: '#fef3c7', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#92400e', marginBottom: 8 }}>
                    📝 {o.notes}
                  </div>
                )}

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <a href={`tel:${o.customer_phone}`}
                    className="btn btn-secondary"
                    style={{ flex: 1, textDecoration: 'none', textAlign: 'center', fontSize: 13 }}>
                    📞 Call
                  </a>
                  <button className={styles.mapBtn} style={{ flex: 2 }} onClick={() => openMap(o.delivery_address, o.delivery_lat, o.delivery_lng)}>
                    🗺️ Navigate →
                  </button>
                </div>
                <button
                  className="btn btn-primary"
                  style={{ width: '100%', marginTop: 8, background: 'var(--gr-d)', border: 'none' }}
                  onClick={() => markDelivered(o.id)}>
                  ✅ Mark as Delivered
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── EARNINGS TAB ── */}
      {tab === 'history' && (
        <div className={styles.body}>
          <div className={styles.periodRow}>
            {['today', 'week', 'month', 'all'].map(p => (
              <button key={p} className={`${styles.periodBtn} ${period === p ? styles.active : ''}`} onClick={() => loadHistory(p)}>
                {p === 'today' ? 'Today' : p === 'week' ? 'Week' : p === 'month' ? 'Month' : 'All'}
              </button>
            ))}
          </div>

          <div className={styles.earningsCard}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--gr-d)', marginBottom: 4 }}>Period Earned</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--gr-d)' }}>₹{Math.round(stats?.total_earned ?? 0)}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, color: 'var(--t2)', marginBottom: 4 }}>Deliveries</div>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{stats?.total_deliveries ?? 0}</div>
            </div>
          </div>

          {/* Payment breakdown */}
          <div style={{ background: 'var(--card)', borderRadius: 12, padding: '16px', marginBottom: 10, border: '1px solid var(--bd)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 12, color: 'var(--t2)' }}>💳 PAYMENT ACCOUNT</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, textAlign: 'center', marginBottom: 12 }}>
              <div style={{ background: '#dcfce7', borderRadius: 10, padding: '10px 6px' }}>
                <div style={{ fontSize: 10, color: '#166534', marginBottom: 4 }}>Total Earned</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#16a34a' }}>₹{Math.round(parseFloat(boyInfo?.total_earnings||0))}</div>
              </div>
              <div style={{ background: '#dbeafe', borderRadius: 10, padding: '10px 6px' }}>
                <div style={{ fontSize: 10, color: '#1d4ed8', marginBottom: 4 }}>Total Paid</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#2563eb' }}>₹{Math.round(parseFloat(boyInfo?.total_paid||0))}</div>
              </div>
              <div style={{ background: parseFloat(boyInfo?.payment_due||0)>0 ? '#fef2f2' : '#f3f4f6', borderRadius: 10, padding: '10px 6px' }}>
                <div style={{ fontSize: 10, color: '#dc2626', marginBottom: 4 }}>Pending Due</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: parseFloat(boyInfo?.payment_due||0)>0 ? '#dc2626' : 'var(--t3)' }}>
                  ₹{Math.round(parseFloat(boyInfo?.payment_due||0))}
                </div>
              </div>
            </div>
            {parseFloat(boyInfo?.payment_due||0) > 0 && (
              <div style={{ background: '#fef3c7', borderRadius: 10, padding: '10px 12px', fontSize: 12, color: '#92400e', textAlign: 'center' }}>
                ⏳ Admin se ₹{Math.round(parseFloat(boyInfo?.payment_due||0))} payment pending hai
              </div>
            )}
          </div>

          {/* Payment history */}
          {paymentHistory.length > 0 && (
            <div style={{ background: 'var(--card)', borderRadius: 12, padding: '14px', marginBottom: 10, border: '1px solid var(--bd)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, color: 'var(--t2)' }}>📋 PAYMENT RECEIVED HISTORY</div>
              {paymentHistory.map((p, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < paymentHistory.length-1 ? '1px solid var(--bg)' : 'none' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#16a34a' }}>✅ ₹{Math.round(parseFloat(p.amount))} received</div>
                    {p.notes && <div style={{ fontSize: 11, color: 'var(--t2)' }}>{p.notes}</div>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--t3)' }}>{new Date(p.created_at).toLocaleDateString('en-IN')}</div>
                </div>
              ))}
            </div>
          )}

          {history.length === 0 ? (
            <div className={styles.empty}><p>No deliveries in this period</p></div>
          ) : (
            <div className={styles.historyTable}>
              <div className={styles.histHead}><span>Order</span><span>Customer</span><span>Amt</span><span>Earned</span></div>
              {history.map(o => (
                <div key={o.id} className={styles.histRow}>
                  <span style={{ fontWeight: 600, color: 'var(--bl)', fontSize: 12 }}>#{o.order_number}</span>
                  <span style={{ fontSize: 11, color: 'var(--t2)' }}>{o.customer_name?.split(' ')[0]}</span>
                  <span style={{ fontSize: 12 }}>₹{Math.round(o.total)}</span>
                  <span style={{ fontWeight: 600, color: 'var(--gr-d)', fontSize: 12 }}>₹{Math.round(o.earned)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── PROFILE TAB ── */}
      {tab === 'profile' && boyInfo && (
        <div className={styles.body}>
          {saveMsg && (
            <div style={{ background: saveMsg.startsWith('✅') ? '#dcfce7' : '#fef2f2', border: '1px solid', borderColor: saveMsg.startsWith('✅') ? '#86efac' : '#fca5a5', borderRadius: 10, padding: '10px 14px', marginBottom: 12, fontSize: 13 }}>
              {saveMsg}
            </div>
          )}

          {/* Profile card */}
          <div style={{ background: 'var(--card)', borderRadius: 14, padding: '20px', border: '1px solid var(--bd)', marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 15 }}>👤 Personal Info</h3>
              <button className="btn btn-secondary" style={{ fontSize: 12, padding: '5px 12px' }} onClick={() => setProfileEdit(!profileEdit)}>
                {profileEdit ? 'Cancel' : '✏️ Edit'}
              </button>
            </div>

            {profileEdit ? (
              <div>
                <div className="field"><label>Full Name</label><input value={profileForm.name} onChange={e => setProfileForm({ ...profileForm, name: e.target.value })} /></div>
                <div className="field"><label>Phone</label><input value={profileForm.phone} onChange={e => setProfileForm({ ...profileForm, phone: e.target.value })} /></div>
                <div className="field"><label>Home Address</label><textarea rows={2} value={profileForm.home_address} onChange={e => setProfileForm({ ...profileForm, home_address: e.target.value })} style={{ resize: 'none' }} /></div>
                <div className="field"><label>Emergency Contact</label><input value={profileForm.emergency_contact} onChange={e => setProfileForm({ ...profileForm, emergency_contact: e.target.value })} /></div>
                <button className="btn btn-primary btn-full" onClick={saveProfile}>💾 Save Changes</button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: 13 }}>
                {[
                  ['Name', boyInfo.name],
                  ['Phone', boyInfo.phone],
                  ['Email', boyInfo.email],
                  ['Rating', `⭐ ${parseFloat(boyInfo.rating || 5).toFixed(1)}`],
                  ['Home Address', boyInfo.home_address, true],
                  ['Emergency Contact', boyInfo.emergency_contact],
                ].map(([label, val, full]) => val && (
                  <div key={label} style={full ? { gridColumn: '1/-1' } : {}}>
                    <div style={{ fontSize: 11, color: 'var(--t2)', marginBottom: 2 }}>{label}</div>
                    <div style={{ fontWeight: 500 }}>{val || '—'}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Vehicle & ID info */}
          <div style={{ background: 'var(--card)', borderRadius: 14, padding: '20px', border: '1px solid var(--bd)', marginBottom: 12 }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 15 }}>🛵 Vehicle & Identity</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: 13 }}>
              {[
                ['Vehicle Type', boyInfo.vehicle_type],
                ['Vehicle Number', boyInfo.vehicle_number],
                ['License Number', boyInfo.license_number],
                ['Aadhar Number', boyInfo.aadhar_number ? '••••' + boyInfo.aadhar_number.slice(-4) : '—'],
                ['Date of Birth', boyInfo.date_of_birth ? new Date(boyInfo.date_of_birth).toLocaleDateString('en-IN') : '—'],
              ].map(([label, val]) => (
                <div key={label}>
                  <div style={{ fontSize: 11, color: 'var(--t2)', marginBottom: 2 }}>{label}</div>
                  <div style={{ fontWeight: 500 }}>{val || '—'}</div>
                </div>
              ))}
            </div>
            <div style={{ background: '#fef3c7', borderRadius: 8, padding: '10px 12px', marginTop: 12, fontSize: 12, color: '#92400e' }}>
              ℹ️ Vehicle and ID details change karne ke liye admin se contact karein
            </div>
          </div>

          {/* Change Password */}
          <div style={{ background: 'var(--card)', borderRadius: 14, padding: '20px', border: '1px solid var(--bd)' }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 15 }}>🔒 Change Password</h3>
            <form onSubmit={changePassword}>
              <div className="field"><label>Current Password</label><input type="password" required value={pwForm.current} onChange={e => setPwForm({ ...pwForm, current: e.target.value })} placeholder="••••••••" /></div>
              <div className="field"><label>New Password</label><input type="password" required value={pwForm.newPw} onChange={e => setPwForm({ ...pwForm, newPw: e.target.value })} placeholder="••••••••" minLength={6} /></div>
              <div className="field"><label>Confirm New Password</label><input type="password" required value={pwForm.confirm} onChange={e => setPwForm({ ...pwForm, confirm: e.target.value })} placeholder="••••••••" /></div>
              <button type="submit" className="btn btn-primary btn-full">🔒 Update Password</button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

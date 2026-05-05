'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import styles from './orders.module.css'

const STATUS_LABEL = {
  pending: '⏳ Pending',
  confirmed: '✅ Confirmed',
  preparing: '👨‍🍳 Preparing',
  out_for_delivery: '🛵 Out for Delivery',
  delivered: '🎉 Delivered',
  cancelled: '❌ Cancelled',
}

const STATUS_COLOR = {
  pending: '#f59e0b',
  confirmed: '#3b82f6',
  preparing: '#8b5cf6',
  out_for_delivery: '#f97316',
  delivered: '#22c55e',
  cancelled: '#ef4444',
}

export default function OrdersPage() {
  const router = useRouter()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'me' }) }).then(r => r.json()),
      fetch('/api/orders').then(r => r.json()),
    ]).then(([authData, ordersData]) => {
      if (!authData.user || authData.user.role !== 'customer') { router.push('/login'); return }
      setUser(authData.user)
      setOrders(ordersData.orders || [])
      setLoading(false)
    })
  }, [])

  const logout = async () => {
    await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'logout' }) })
    sessionStorage.removeItem('ck_cart')
    router.push('/login')
  }

  if (loading) return <div className={styles.loading}><div className={styles.spinner} /></div>

  return (
    <div className={styles.page}>
      <nav className={styles.nav}>
        <span className={styles.logo}>🍽️ CloudKitchen</span>
        <div className={styles.navRight}>
          <button className={styles.navBtn} onClick={() => router.push('/menu')}>← Menu</button>
          <span className={styles.greeting}>Hi, {user?.name?.split(' ')[0]}</span>
          <button className={styles.navBtn} onClick={logout}>Logout</button>
        </div>
      </nav>

      <div className={styles.container}>
        <h2 className={styles.title}>My Orders</h2>

        {orders.length === 0 ? (
          <div className={styles.empty}>
            <p>Koi order nahi mila abhi tak.</p>
            <button className={styles.menuBtn} onClick={() => router.push('/menu')}>Order karo →</button>
          </div>
        ) : (
          <div className={styles.orderList}>
            {orders.map(order => (
              <div key={order.id} className={styles.orderCard}>
                <div className={styles.orderHeader}>
                  <div>
                    <span className={styles.orderNum}>Order #{order.order_number || order.id}</span>
                    <span className={styles.orderDate}>{new Date(order.created_at).toLocaleString('en-IN')}</span>
                  </div>
                  <span
                    className={styles.statusBadge}
                    style={{ background: STATUS_COLOR[order.status] + '22', color: STATUS_COLOR[order.status], border: `1px solid ${STATUS_COLOR[order.status]}` }}
                  >
                    {STATUS_LABEL[order.status] || order.status}
                  </span>
                </div>

                <div className={styles.orderAddress}>
                  📍 {order.delivery_address}
                </div>

                {order.delivery_boy_name && (
                  <div className={styles.deliveryInfo}>
                    🛵 Delivery by: <strong>{order.delivery_boy_name}</strong>
                    {order.delivery_boy_phone && <span> · {order.delivery_boy_phone}</span>}
                  </div>
                )}

                <div className={styles.orderFooter}>
                  <div className={styles.amounts}>
                    <span>Subtotal: ₹{Math.round(order.subtotal)}</span>
                    {order.discount_amount > 0 && <span className={styles.discount}>- ₹{Math.round(order.discount_amount)} off</span>}
                    <span>Delivery: ₹{Math.round(order.delivery_charge)}</span>
                  </div>
                  <span className={styles.total}>Total: ₹{Math.round(order.total)}</span>
                </div>

                <div className={styles.progressBar}>
                  {['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered'].map((s, i) => (
                    <div
                      key={s}
                      className={`${styles.progressStep} ${
                        order.status === 'cancelled' ? styles.cancelled :
                        ['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered'].indexOf(order.status) >= i ? styles.done : ''
                      }`}
                    />
                  ))}
                </div>
                <div className={styles.progressLabels}>
                  <span>Placed</span>
                  <span>Confirmed</span>
                  <span>Preparing</span>
                  <span>On Way</span>
                  <span>Delivered</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

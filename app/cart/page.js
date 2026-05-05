'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import styles from './cart.module.css'

export default function CartPage() {
  const router = useRouter()
  const [menuItems, setMenuItems] = useState([])
  const [cart, setCart] = useState({})
  const [address, setAddress] = useState('')
  const [lat, setLat] = useState(null)
  const [lng, setLng] = useState(null)
  const [distanceKm, setDistanceKm] = useState(null)
  const [deliveryCharge, setDeliveryCharge] = useState(30)
  const [offerCode, setOfferCode] = useState('')
  const [offerResult, setOfferResult] = useState(null)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [error, setError] = useState('')
  const [placed, setPlaced] = useState(false)
  const [orderNum, setOrderNum] = useState(null)

  useEffect(() => {
    const saved = sessionStorage.getItem('ck_cart')
    if (saved) setCart(JSON.parse(saved))
    fetch('/api/menu').then(r => r.json()).then(d => setMenuItems(d.items || []))
  }, [])

  const saveCart = (c) => { setCart(c); sessionStorage.setItem('ck_cart', JSON.stringify(c)) }
  const addItem = (id) => saveCart({ ...cart, [id]: (cart[id] || 0) + 1 })
  const removeItem = (id) => {
    const nc = { ...cart }
    if (nc[id] > 1) nc[id]--; else delete nc[id]
    saveCart(nc)
  }

  const discPrice = (item) => item?.discount_percent > 0
    ? Math.round(item.price * (1 - item.discount_percent / 100))
    : (item?.price || 0)

  const cartEntries = Object.entries(cart)
    .map(([id, qty]) => ({ item: menuItems.find(m => m.id === id), qty }))
    .filter(e => e.item)

  const subtotal = cartEntries.reduce((a, e) => a + discPrice(e.item) * e.qty, 0)
  const discount = offerResult?.discount || 0
  const total = Math.max(0, subtotal - discount) + (offerResult?.freeDelivery ? 0 : deliveryCharge)

  // GPS location detection
  const detectGPS = () => {
    setGpsLoading(true)
    if (!navigator.geolocation) { alert('GPS not supported'); setGpsLoading(false); return }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords
        setLat(latitude); setLng(longitude)
        // Reverse geocode using Nominatim (free, no API key)
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`)
          const data = await res.json()
          const addr = data.display_name || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
          setAddress(addr)
          // Estimate distance (kitchen lat/lng - you can set your kitchen coords in env)
          const kitchenLat = 25.5941 // Patna approx
          const kitchenLng = 85.1376
          const dist = calcDist(latitude, longitude, kitchenLat, kitchenLng)
          setDistanceKm(dist)
          // Get delivery charge
          const cr = await fetch(`/api/admin?type=pricing`)
          const pd = await cr.json()
          const charge = getCharge(dist, pd.pricing || [])
          setDeliveryCharge(charge)
        } catch { setAddress(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`) }
        setGpsLoading(false)
      },
      () => { alert('Could not get location. Please enter address manually.'); setGpsLoading(false) }
    )
  }

  function calcDist(lat1, lng1, lat2, lng2) {
    const R = 6371
    const dL = ((lat2 - lat1) * Math.PI) / 180
    const dG = ((lng2 - lng1) * Math.PI) / 180
    const a = Math.sin(dL/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dG/2)**2
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  }

  function getCharge(km, pricing) {
    const row = pricing.find(p => p.min_km <= km && (p.max_km == null || p.max_km > km))
    if (!row) return 50
    return parseFloat(row.base_charge) + Math.max(0, km - row.min_km) * parseFloat(row.per_km_charge)
  }

  const applyOffer = async () => {
    if (!offerCode.trim()) return
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'check_offer', code: offerCode, subtotal })
    })
    // Simplified: just show a success message for demo
    setOfferResult({ discount: 50, code: offerCode })
  }

  const placeOrder = async () => {
    if (!address.trim()) { setError('Please enter delivery address'); return }
    if (!cartEntries.length) { setError('Cart is empty'); return }
    setLoading(true); setError('')

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cartEntries.map(e => ({ id: e.item.id, qty: e.qty, name: e.item.name })),
          deliveryAddress: address,
          deliveryLat: lat,
          deliveryLng: lng,
          distanceKm,
          offerCode: offerResult ? offerCode : null,
          notes
        })
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      sessionStorage.removeItem('ck_cart')
      setOrderNum(data.orderNumber)
      setPlaced(true)
    } catch { setError('Something went wrong') }
    finally { setLoading(false) }
  }

  if (placed) return (
    <div className={styles.successWrap}>
      <div className={styles.successCard}>
        <div className={styles.checkCircle}>✓</div>
        <h2>Order Placed!</h2>
        <p>Order #{orderNum} confirmed</p>
        <p className={styles.eta}>Estimated delivery: 35–45 mins</p>
        <div className={styles.trackSteps}>
          {[['Order Confirmed', 'done', 'Just now'], ['Being Prepared', 'active', 'Kitchen is cooking'], ['Out for Delivery', 'wait', 'Soon'], ['Delivered', 'wait', 'Pay cash on arrival']].map(([label, state, sub]) => (
            <div key={label} className={styles.trackStep}>
              <div className={`${styles.trackDot} ${styles[state]}`} />
              <div><div className={styles.trackLabel}>{label}</div><div className={styles.trackSub}>{sub}</div></div>
            </div>
          ))}
        </div>
        <button className="btn btn-primary btn-full" onClick={() => router.push('/menu')}>Order More Food</button>
      </div>
    </div>
  )

  return (
    <div className={styles.page}>
      <nav className={styles.nav}>
        <button className="btn btn-secondary" onClick={() => router.push('/menu')}>← Menu</button>
        <span className={styles.title}>Your Cart</span>
        <span />
      </nav>

      <div className={styles.body}>
        {cartEntries.length === 0 ? (
          <div className={styles.empty}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🛒</div>
            <p>Your cart is empty</p>
            <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => router.push('/menu')}>Browse Menu</button>
          </div>
        ) : (
          <>
            {/* Items */}
            <div className={styles.section}>
              <h3>Items</h3>
              {cartEntries.map(({ item, qty }) => (
                <div key={item.id} className={styles.cartRow}>
                  <div>
                    <div className={styles.itemName}>{item.name}</div>
                    <div className={styles.itemSub}>₹{discPrice(item)} × {qty}</div>
                  </div>
                  <div className={styles.itemRight}>
                    <div className="qtyCtl" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <button className={styles.qBtn} onClick={() => removeItem(item.id)}>−</button>
                      <span style={{ fontWeight: 500, minWidth: 16, textAlign: 'center' }}>{qty}</span>
                      <button className={styles.qBtn} onClick={() => addItem(item.id)}>+</button>
                    </div>
                    <span className={styles.itemTotal}>₹{discPrice(item) * qty}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Address */}
            <div className={styles.section}>
              <h3>Delivery Address</h3>
              <button className={styles.gpsBtn} onClick={detectGPS} disabled={gpsLoading}>
                {gpsLoading ? <span className="spinner" /> : '📍'} {gpsLoading ? 'Detecting...' : 'Use My GPS Location'}
              </button>
              {lat && <div className={styles.gpsDetected}>✓ Location detected · {distanceKm?.toFixed(1)} km from kitchen</div>}
              <div className="field" style={{ marginTop: 10, marginBottom: 0 }}>
                <label>Full Address</label>
                <input
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder="Flat no, Street, Landmark, City - PIN"
                />
              </div>
            </div>

            {/* Offer */}
            <div className={styles.section}>
              <h3>Offer Code</h3>
              <div className={styles.offerRow}>
                <input
                  className={styles.offerInput}
                  value={offerCode}
                  onChange={e => setOfferCode(e.target.value.toUpperCase())}
                  placeholder="Enter code (e.g. WELCOME50)"
                />
                <button className="btn btn-secondary" onClick={applyOffer}>Apply</button>
              </div>
              {offerResult && <div className={styles.offerApplied}>✓ {offerResult.code} applied — ₹{offerResult.discount} off!</div>}
            </div>

            {/* Notes */}
            <div className={styles.section}>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>Special Instructions (optional)</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Less spicy, no onion, etc..." />
              </div>
            </div>

            {/* Bill */}
            <div className={styles.section}>
              <h3>Bill Summary</h3>
              <div className={styles.billRow}><span>Subtotal</span><span>₹{subtotal}</span></div>
              {discount > 0 && <div className={styles.billRow} style={{ color: 'var(--gr-d)' }}><span>Discount</span><span>−₹{discount}</span></div>}
              <div className={styles.billRow}><span>Delivery {distanceKm ? `(${distanceKm.toFixed(1)} km)` : ''}</span><span>₹{deliveryCharge}</span></div>
              <div className={`${styles.billRow} ${styles.total}`}><span>Total</span><span style={{ color: 'var(--or)' }}>₹{total}</span></div>
            </div>

            {/* COD notice */}
            <div className={styles.codNotice}>💵 Cash on Delivery — Pay ₹{total} when food arrives at your door</div>

            {error && <div className={styles.error}>{error}</div>}

            <button className="btn btn-primary btn-full" onClick={placeOrder} disabled={loading}>
              {loading ? <span className="spinner" /> : `Place Order · ₹${total}`}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

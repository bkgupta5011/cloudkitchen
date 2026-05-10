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
  const [offerError, setOfferError] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [error, setError] = useState('')
  const [placed, setPlaced] = useState(false)
  const [orderNum, setOrderNum] = useState(null)
  const [kitchenLat, setKitchenLat] = useState(25.5801392)
  const [kitchenLng, setKitchenLng] = useState(85.1569214)
  const [maxKm, setMaxKm] = useState(5)
  const [estimatedTime, setEstimatedTime] = useState(45)
  const [outOfRange, setOutOfRange] = useState(false)
  const [savedAddresses, setSavedAddresses] = useState([])
  const [showAddressModal, setShowAddressModal] = useState(false)
  const [newAddrLabel, setNewAddrLabel] = useState('Home')

  useEffect(() => {
    const saved = localStorage.getItem('ck_cart')
    if (saved) { try { setCart(JSON.parse(saved)) } catch {} }
    fetch('/api/menu').then(r => r.json()).then(d => setMenuItems(d.items || []))
    // Load kitchen settings for dynamic radius
    fetch('/api/admin').then(r => r.json()).then(d => {
      if (d.settings) {
        if (d.settings.lat) setKitchenLat(parseFloat(d.settings.lat))
        if (d.settings.lng) setKitchenLng(parseFloat(d.settings.lng))
        if (d.settings.max_delivery_km) setMaxKm(parseFloat(d.settings.max_delivery_km))
        if (d.settings.estimated_time) setEstimatedTime(parseInt(d.settings.estimated_time))
      }
    })
    // Load saved addresses
    fetch('/api/addresses').then(r => r.json()).then(d => {
      const addrs = d.addresses || []
      setSavedAddresses(addrs)
      // Auto-fill default address
      const def = addrs.find(a => a.is_default)
      if (def && !address) {
        setAddress(def.address_text)
        if (def.lat) setLat(parseFloat(def.lat))
        if (def.lng) setLng(parseFloat(def.lng))
      }
    }).catch(() => {})
  }, [])

  const saveCart = (c) => { setCart(c); localStorage.setItem('ck_cart', JSON.stringify(c)) }
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
  const freeDelivery = offerResult?.freeDelivery || false
  const total = Math.max(0, subtotal - discount) + (freeDelivery ? 0 : deliveryCharge)

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
          const dist = calcDist(latitude, longitude, kitchenLat, kitchenLng)
          setDistanceKm(dist)
          setOutOfRange(dist > maxKm)
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
    setOfferError('')
    setOfferResult(null)
    try {
      const res = await fetch(`/api/offers?code=${encodeURIComponent(offerCode)}&subtotal=${subtotal}`)
      const data = await res.json()
      if (!data.valid) {
        setOfferError(data.error || 'Invalid offer code')
        return
      }
      setOfferResult({ discount: data.discount, freeDelivery: data.freeDelivery, code: data.code })
    } catch {
      setOfferError('Offer check nahi ho paya')
    }
  }

  const selectSavedAddress = (addr) => {
    setAddress(addr.address_text)
    if (addr.lat) { setLat(parseFloat(addr.lat)); setLng(parseFloat(addr.lng)) }
    else { setLat(null); setLng(null); setDistanceKm(null) }
  }

  const saveCurrentAddress = async () => {
    if (!address.trim()) return
    await fetch('/api/addresses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: newAddrLabel, address_text: address, lat, lng })
    })
    const d = await fetch('/api/addresses').then(r => r.json())
    setSavedAddresses(d.addresses || [])
    setShowAddressModal(false)
  }

  const placeOrder = async () => {
    if (!address.trim()) { setError('Please enter delivery address'); return }
    if (!cartEntries.length) { setError('Cart is empty'); return }
    if (outOfRange) { setError(`Sorry, we only deliver within ${maxKm} km of our kitchen. Your location is too far.`); return }
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
      localStorage.removeItem('ck_cart')
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

              {/* Saved addresses */}
              {savedAddresses.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, color: 'var(--t2)', marginBottom: 6, fontWeight: 600 }}>SAVED ADDRESSES</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {savedAddresses.map(a => (
                      <button key={a.id}
                        onClick={() => selectSavedAddress(a)}
                        style={{
                          padding: '6px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                          border: address === a.address_text ? '1.5px solid var(--or)' : '1px solid var(--bd)',
                          background: address === a.address_text ? '#fff7ed' : 'var(--bg)',
                          color: address === a.address_text ? 'var(--or)' : 'var(--t1)',
                          fontWeight: address === a.address_text ? 600 : 400
                        }}>
                        {a.is_default ? '⭐ ' : ''}{a.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button className={styles.gpsBtn} onClick={detectGPS} disabled={gpsLoading}>
                {gpsLoading ? <span className="spinner" /> : '📍'} {gpsLoading ? 'Detecting...' : 'Use My GPS Location'}
              </button>
              {lat && !outOfRange && <div className={styles.gpsDetected}>✓ Location detected · {distanceKm?.toFixed(1)} km from kitchen</div>}
              {lat && outOfRange && <div className={styles.outOfRange}>⚠️ You are {distanceKm?.toFixed(1)} km away — we only deliver within {maxKm} km</div>}
              <div className="field" style={{ marginTop: 10, marginBottom: 0 }}>
                <label>Full Address</label>
                <input
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder="Flat no, Street, Landmark, City - PIN"
                />
              </div>
              {address && !savedAddresses.find(a => a.address_text === address) && (
                <button onClick={() => setShowAddressModal(true)}
                  style={{ marginTop: 6, fontSize: 11, color: 'var(--or)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  + Save this address for next time
                </button>
              )}
            </div>

            {/* Offer */}
            <div className={styles.section}>
              <h3>Offer Code</h3>
              <div className={styles.offerRow}>
                <input
                  className={styles.offerInput}
                  value={offerCode}
                  onChange={e => { setOfferCode(e.target.value.toUpperCase()); setOfferError(''); if (!e.target.value) setOfferResult(null) }}
                  placeholder="Enter code (e.g. WELCOME50)"
                />
                <button className="btn btn-secondary" onClick={applyOffer}>Apply</button>
              </div>
              {offerResult && (
                <div className={styles.offerApplied}>
                  ✓ {offerResult.code} applied — {offerResult.freeDelivery ? 'Free Delivery!' : `₹${offerResult.discount} off!`}
                </div>
              )}
              {offerError && <div className={styles.error} style={{ marginTop: 6 }}>❌ {offerError}</div>}
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
              <div className={styles.billRow}><span>Delivery {distanceKm ? `(${distanceKm.toFixed(1)} km)` : ''}</span><span>{freeDelivery ? <span style={{ color: 'var(--gr-d)', fontWeight: 600 }}>FREE 🎉</span> : `₹${deliveryCharge}`}</span></div>
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

      {/* Save Address Modal */}
      {showAddressModal && (
        <div style={{ position: 'fixed', inset: 0, background: '#0008', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}
          onClick={e => e.target === e.currentTarget && setShowAddressModal(false)}>
          <div style={{ background: 'var(--card)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 360 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>💾 Save Address</h3>
            <div className="field">
              <label>Label</label>
              <select value={newAddrLabel} onChange={e => setNewAddrLabel(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--bd)', background: 'var(--bg)', fontSize: 14 }}>
                <option>Home</option>
                <option>Work</option>
                <option>Other</option>
              </select>
            </div>
            <div className="field">
              <label>Address</label>
              <textarea value={address} readOnly rows={3} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--bd)', fontSize: 13, resize: 'none', background: 'var(--bg)', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowAddressModal(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveCurrentAddress}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

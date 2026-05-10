'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import styles from './cart.module.css'

const GMAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY

// Load Google Maps script once
function loadGoogleMaps() {
  return new Promise((resolve, reject) => {
    if (window.google?.maps) { resolve(window.google.maps); return }
    const existing = document.getElementById('gmaps-script')
    if (existing) { existing.addEventListener('load', () => resolve(window.google.maps)); return }
    const script = document.createElement('script')
    script.id = 'gmaps-script'
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GMAPS_KEY}&libraries=places`
    script.async = true
    script.defer = true
    script.onload = () => resolve(window.google.maps)
    script.onerror = reject
    document.head.appendChild(script)
  })
}

// Google reverse geocoding — GPS coords → detailed address
async function reverseGeocode(lat, lng) {
  try {
    fetch('/api/track-usage', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({type:'geocoding'}) }).catch(()=>{})
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GMAPS_KEY}&language=en&region=IN`
    )
    const data = await res.json()
    if (data.results?.[0]) return data.results[0].formatted_address
  } catch {}
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`
}

// Haversine distance
function calcDist(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dL = ((lat2 - lat1) * Math.PI) / 180
  const dG = ((lng2 - lng1) * Math.PI) / 180
  const a = Math.sin(dL / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dG / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function getCharge(km, pricing) {
  const row = pricing.find(p => parseFloat(p.min_km) <= km && (p.max_km == null || parseFloat(p.max_km) > km))
  if (!row) {
    // Out of range — use highest tier
    const last = [...pricing].sort((a, b) => parseFloat(b.min_km) - parseFloat(a.min_km))[0]
    if (!last) return 50
    return parseFloat(last.base_charge) + Math.max(0, km - parseFloat(last.min_km)) * parseFloat(last.per_km_charge)
  }
  return parseFloat(row.base_charge) + Math.max(0, km - parseFloat(row.min_km)) * parseFloat(row.per_km_charge)
}

// ── Map Picker Modal ──────────────────────────────────────────────
function MapPickerModal({ initialLat, initialLng, kitchenLat, kitchenLng, maxKm, onConfirm, onClose }) {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markerRef = useRef(null)
  const searchRef = useRef(null)
  const [pickedAddress, setPickedAddress] = useState('')
  const [pickedLat, setPickedLat] = useState(initialLat || kitchenLat)
  const [pickedLng, setPickedLng] = useState(initialLng || kitchenLng)
  const [loading, setLoading] = useState(true)
  const [gpsLoading, setGpsLoading] = useState(false)

  const updatePin = useCallback(async (lat, lng) => {
    setPickedLat(lat); setPickedLng(lng)
    const addr = await reverseGeocode(lat, lng)
    setPickedAddress(addr)
  }, [])

  useEffect(() => {
    let cancelled = false
    loadGoogleMaps().then(gmaps => {
      if (cancelled || !mapRef.current) return
      fetch('/api/track-usage', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({type:'maps'}) }).catch(()=>{})
      const center = { lat: pickedLat, lng: pickedLng }
      const map = new gmaps.Map(mapRef.current, {
        center, zoom: 15,
        mapTypeControl: false, streetViewControl: false, fullscreenControl: false,
        zoomControlOptions: { position: gmaps.ControlPosition.RIGHT_CENTER }
      })
      mapInstanceRef.current = map

      // Kitchen marker (static)
      new gmaps.Marker({
        position: { lat: kitchenLat, lng: kitchenLng },
        map, title: '🍽️ FoodFi Kitchen',
        icon: {
          url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png',
          scaledSize: new gmaps.Size(32, 32)
        }
      })

      // Delivery radius circle
      new gmaps.Circle({
        map, center: { lat: kitchenLat, lng: kitchenLng },
        radius: maxKm * 1000,
        strokeColor: '#e85d04', strokeOpacity: 0.4, strokeWeight: 2,
        fillColor: '#e85d04', fillOpacity: 0.05
      })

      // Draggable delivery marker
      const marker = new gmaps.Marker({
        position: center, map, draggable: true, title: 'Drag to your location',
        animation: gmaps.Animation.DROP
      })
      markerRef.current = marker
      marker.addListener('dragend', () => {
        const pos = marker.getPosition()
        updatePin(pos.lat(), pos.lng())
      })
      map.addListener('click', (e) => {
        const pos = e.latLng
        marker.setPosition(pos)
        updatePin(pos.lat(), pos.lng())
      })

      // Places search box
      if (searchRef.current) {
        const autocomplete = new gmaps.places.Autocomplete(searchRef.current, {
          componentRestrictions: { country: 'in' },
          fields: ['formatted_address', 'geometry']
        })
        autocomplete.addListener('place_changed', () => {
          fetch('/api/track-usage', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({type:'places'}) }).catch(()=>{})
          const place = autocomplete.getPlace()
          if (!place.geometry) return
          const loc = place.geometry.location
          map.setCenter(loc); map.setZoom(16)
          marker.setPosition(loc)
          setPickedLat(loc.lat()); setPickedLng(loc.lng())
          setPickedAddress(place.formatted_address)
        })
      }

      // Initial reverse geocode
      updatePin(pickedLat, pickedLng).then(() => setLoading(false))
    })
    return () => { cancelled = true }
  }, [])

  const useGPS = () => {
    setGpsLoading(true)
    if (!navigator.geolocation) { alert('GPS not supported'); setGpsLoading(false); return }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        const map = mapInstanceRef.current
        const marker = markerRef.current
        if (map && marker) {
          const pos2 = new window.google.maps.LatLng(lat, lng)
          map.setCenter(pos2); map.setZoom(16)
          marker.setPosition(pos2)
        }
        await updatePin(lat, lng)
        setGpsLoading(false)
      },
      () => { alert('GPS nahi mila — manually search karo'); setGpsLoading(false) }
    )
  }

  const dist = calcDist(pickedLat, pickedLng, kitchenLat, kitchenLng)
  const outOfRange = dist > maxKm

  return (
    <div style={{ position:'fixed', inset:0, background:'#000a', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:12 }}>
      <div style={{ background:'var(--card)', borderRadius:20, width:'100%', maxWidth:540, maxHeight:'92vh', display:'flex', flexDirection:'column', overflow:'hidden', boxShadow:'0 20px 60px #0006' }}>
        {/* Header */}
        <div style={{ padding:'14px 16px', borderBottom:'1px solid var(--bd)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ fontWeight:700, fontSize:15 }}>📍 Delivery Location Select Karo</div>
            <div style={{ fontSize:11, color:'var(--t2)', marginTop:2 }}>Map pe click karo ya pin drag karo</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:'var(--t2)', lineHeight:1 }}>✕</button>
        </div>

        {/* Search bar */}
        <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--bd)', display:'flex', gap:8 }}>
          <input
            ref={searchRef}
            placeholder="🔍 Address search karo..."
            style={{ flex:1, padding:'9px 12px', border:'1.5px solid var(--bd2)', borderRadius:10, fontSize:13, outline:'none', background:'var(--bg)', color:'var(--t1)' }}
          />
          <button onClick={useGPS} disabled={gpsLoading}
            style={{ padding:'8px 14px', background:'var(--bl-l)', color:'var(--bl)', border:'1.5px solid var(--bl)', borderRadius:10, fontSize:12, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' }}>
            {gpsLoading ? '⏳' : '📍 GPS'}
          </button>
        </div>

        {/* Map */}
        <div ref={mapRef} style={{ flex:1, minHeight:300 }} />

        {/* Footer */}
        <div style={{ padding:'12px 14px', borderTop:'1px solid var(--bd)', background:'var(--card)' }}>
          {loading ? (
            <div style={{ fontSize:12, color:'var(--t2)', textAlign:'center' }}>⏳ Location load ho rahi hai...</div>
          ) : (
            <>
              <div style={{ fontSize:12, color: outOfRange ? '#dc2626' : 'var(--t2)', marginBottom:8, lineHeight:1.4 }}>
                {outOfRange
                  ? `⚠️ Ye location hamare delivery zone se bahar hai (${dist.toFixed(1)} km — max ${maxKm} km)`
                  : `✅ ${dist.toFixed(1)} km kitchen se · ${pickedAddress || 'Location selected'}`
                }
              </div>
              <div style={{ fontSize:11, color:'var(--t3)', marginBottom:10, lineHeight:1.4, wordBreak:'break-word' }}>
                {pickedAddress}
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={onClose} style={{ flex:1, padding:'10px', background:'var(--bg)', border:'1px solid var(--bd2)', borderRadius:10, fontSize:13, cursor:'pointer' }}>
                  Cancel
                </button>
                <button
                  disabled={outOfRange}
                  onClick={() => onConfirm({ address: pickedAddress, lat: pickedLat, lng: pickedLng })}
                  style={{ flex:2, padding:'10px', background: outOfRange ? '#d1d5db' : 'var(--or)', color:'#fff', border:'none', borderRadius:10, fontSize:13, fontWeight:700, cursor: outOfRange ? 'not-allowed' : 'pointer' }}>
                  ✅ Ye Location Use Karo
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main Cart Page ────────────────────────────────────────────────
export default function CartPage() {
  const router = useRouter()
  const [menuItems, setMenuItems] = useState([])
  const [cart, setCart] = useState({})
  const [address, setAddress] = useState('')
  const [lat, setLat] = useState(null)
  const [lng, setLng] = useState(null)
  const [distanceKm, setDistanceKm] = useState(null)
  const [deliveryCharge, setDeliveryCharge] = useState(null)
  const [offerCode, setOfferCode] = useState('')
  const [offerResult, setOfferResult] = useState(null)
  const [offerError, setOfferError] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
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
  const [showMapPicker, setShowMapPicker] = useState(false)
  const [newAddrLabel, setNewAddrLabel] = useState('Home')
  const pricingRef = useRef([])

  useEffect(() => {
    const saved = localStorage.getItem('ck_cart')
    if (saved) { try { setCart(JSON.parse(saved)) } catch {} }
    fetch('/api/menu').then(r => r.json()).then(d => setMenuItems(d.items || []))

    // Load settings + pricing + addresses together so delivery charge can be computed immediately
    Promise.all([
      fetch('/api/admin').then(r => r.json()),
      fetch('/api/admin?type=pricing').then(r => r.json()),
      fetch('/api/addresses').then(r => r.json()).catch(() => ({ addresses: [] })),
    ]).then(([settingsData, pricingData, addrData]) => {
      const s = settingsData.settings
      const kLat = s?.lat ? parseFloat(s.lat) : kitchenLat
      const kLng = s?.lng ? parseFloat(s.lng) : kitchenLng
      const km   = s?.max_delivery_km ? parseFloat(s.max_delivery_km) : maxKm
      if (s) {
        setKitchenLat(kLat); setKitchenLng(kLng); setMaxKm(km)
        if (s.estimated_time) setEstimatedTime(parseInt(s.estimated_time))
      }
      const pricing = pricingData.pricing || []
      pricingRef.current = pricing

      const addrs = addrData.addresses || []
      setSavedAddresses(addrs)
      const def = addrs.find(a => a.is_default)
      if (def) {
        setAddress(def.address_text)
        if (def.lat && def.lng) {
          const la = parseFloat(def.lat), ln = parseFloat(def.lng)
          setLat(la); setLng(ln)
          const dist = calcDist(la, ln, kLat, kLng)
          setDistanceKm(dist); setOutOfRange(dist > km)
          if (pricing.length > 0) setDeliveryCharge(getCharge(dist, pricing))
        }
      }
    })
  }, [])

  // Auto-recalculate delivery charge when lat/lng changes
  useEffect(() => {
    if (lat && lng && kitchenLat && kitchenLng) {
      const dist = calcDist(lat, lng, kitchenLat, kitchenLng)
      setDistanceKm(dist)
      setOutOfRange(dist > maxKm)
      const pricing = pricingRef.current
      if (pricing.length > 0) {
        setDeliveryCharge(getCharge(dist, pricing))
      } else {
        fetch('/api/admin?type=pricing').then(r => r.json()).then(pd => {
          pricingRef.current = pd.pricing || []
          setDeliveryCharge(getCharge(dist, pd.pricing || []))
        })
      }
    } else if (!lat || !lng) {
      setDistanceKm(null); setDeliveryCharge(null); setOutOfRange(false)
    }
  }, [lat, lng, kitchenLat, kitchenLng, maxKm])

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
  const effectiveDelivery = freeDelivery ? 0 : (deliveryCharge ?? 0)
  const total = Math.max(0, subtotal - discount) + effectiveDelivery

  // Map picker confirm — calculate charge immediately without relying on useEffect timing
  const handleMapConfirm = async ({ address: addr, lat: la, lng: ln }) => {
    setAddress(addr); setLat(la); setLng(ln)
    const dist = calcDist(la, ln, kitchenLat, kitchenLng)
    setDistanceKm(dist)
    const oor = dist > maxKm
    setOutOfRange(oor)
    if (!oor) {
      let pricing = pricingRef.current
      if (!pricing.length) {
        try {
          const pd = await fetch('/api/admin?type=pricing').then(r => r.json())
          pricing = pd.pricing || []; pricingRef.current = pricing
        } catch {}
      }
      setDeliveryCharge(getCharge(dist, pricing))
    } else {
      setDeliveryCharge(null)
    }
    setShowMapPicker(false)
  }

  const selectSavedAddress = (addr) => {
    setAddress(addr.address_text)
    if (addr.lat && addr.lng) {
      setLat(parseFloat(addr.lat)); setLng(parseFloat(addr.lng))
    } else {
      setLat(null); setLng(null); setDistanceKm(null); setDeliveryCharge(null)
    }
  }

  const saveCurrentAddress = async () => {
    if (!address.trim()) return
    await fetch('/api/addresses', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: newAddrLabel, address_text: address, lat, lng })
    })
    const d = await fetch('/api/addresses').then(r => r.json())
    setSavedAddresses(d.addresses || [])
    setShowAddressModal(false)
  }

  const applyOffer = async () => {
    if (!offerCode.trim()) return
    setOfferError(''); setOfferResult(null)
    try {
      const res = await fetch(`/api/offers?code=${encodeURIComponent(offerCode)}&subtotal=${subtotal}`)
      const data = await res.json()
      if (!data.valid) { setOfferError(data.error || 'Invalid offer code'); return }
      setOfferResult({ discount: data.discount, freeDelivery: data.freeDelivery, code: data.code })
    } catch { setOfferError('Offer check nahi ho paya') }
  }

  const placeOrder = async () => {
    if (!address.trim()) { setError('Please enter delivery address'); return }
    if (!cartEntries.length) { setError('Cart is empty'); return }
    if (outOfRange) { setError(`Sorry, we only deliver within ${maxKm} km of our kitchen`); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cartEntries.map(e => ({ id: e.item.id, qty: e.qty, name: e.item.name })),
          deliveryAddress: address, deliveryLat: lat, deliveryLng: lng,
          distanceKm, offerCode: offerResult ? offerCode : null, notes
        })
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      localStorage.removeItem('ck_cart')
      setOrderNum(data.orderNumber); setPlaced(true)
    } catch { setError('Something went wrong') }
    finally { setLoading(false) }
  }

  if (placed) return (
    <div className={styles.successWrap}>
      <div className={styles.successCard}>
        <div className={styles.checkCircle}>✓</div>
        <h2>Order Placed!</h2>
        <p>Order #{orderNum} confirmed</p>
        <p className={styles.eta}>Estimated delivery: {estimatedTime}–{estimatedTime + 10} mins</p>
        <div className={styles.trackSteps}>
          {[['Order Confirmed','done','Just now'],['Being Prepared','active','Kitchen is cooking'],['Out for Delivery','wait','Soon'],['Delivered','wait','Pay cash on arrival']].map(([label,state,sub]) => (
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
            <div style={{ fontSize:48, marginBottom:12 }}>🛒</div>
            <p>Your cart is empty</p>
            <button className="btn btn-primary" style={{ marginTop:12 }} onClick={() => router.push('/menu')}>Browse Menu</button>
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
                    <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                      <button className={styles.qBtn} onClick={() => removeItem(item.id)}>−</button>
                      <span style={{ fontWeight:500, minWidth:16, textAlign:'center' }}>{qty}</span>
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
                <div style={{ marginBottom:10 }}>
                  <div style={{ fontSize:11, color:'var(--t2)', marginBottom:6, fontWeight:600 }}>SAVED ADDRESSES</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                    {savedAddresses.map(a => (
                      <button key={a.id} onClick={() => selectSavedAddress(a)}
                        style={{ padding:'6px 12px', borderRadius:20, fontSize:12, cursor:'pointer',
                          border: address===a.address_text ? '1.5px solid var(--or)' : '1px solid var(--bd)',
                          background: address===a.address_text ? '#fff7ed' : 'var(--bg)',
                          color: address===a.address_text ? 'var(--or)' : 'var(--t1)',
                          fontWeight: address===a.address_text ? 600 : 400 }}>
                        {a.is_default ? '⭐ ' : ''}{a.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Map picker button */}
              <button className={styles.gpsBtn} onClick={() => setShowMapPicker(true)}
                style={{ background:'linear-gradient(135deg,#e85d04,#f97316)', color:'#fff', border:'none', marginBottom:8 }}>
                🗺️ Map se Location Select Karo
              </button>

              {/* Location status */}
              {lat && !outOfRange && (
                <div className={styles.gpsDetected}>
                  ✅ Location set · {distanceKm?.toFixed(1)} km kitchen se · Delivery: ₹{Math.round(deliveryCharge ?? 0)}
                </div>
              )}
              {lat && outOfRange && (
                <div className={styles.outOfRange}>
                  ⚠️ Aap {distanceKm?.toFixed(1)} km door ho — hum sirf {maxKm} km tak deliver karte hain
                </div>
              )}

              {/* Manual address input */}
              <div className="field" style={{ marginTop:8, marginBottom:0 }}>
                <label>Full Address (edit if needed)</label>
                <textarea
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder="Map se select karo ya manually likhein — Flat no, Street, Landmark, City"
                  rows={2}
                  style={{ resize:'vertical' }}
                />
              </div>
              {address && !savedAddresses.find(a => a.address_text === address) && (
                <button onClick={() => setShowAddressModal(true)}
                  style={{ marginTop:6, fontSize:11, color:'var(--or)', background:'none', border:'none', cursor:'pointer', padding:0 }}>
                  + Save this address for next time
                </button>
              )}
            </div>

            {/* Offer */}
            <div className={styles.section}>
              <h3>Offer Code</h3>
              <div className={styles.offerRow}>
                <input className={styles.offerInput} value={offerCode}
                  onChange={e => { setOfferCode(e.target.value.toUpperCase()); setOfferError(''); if (!e.target.value) setOfferResult(null) }}
                  placeholder="Enter code (e.g. WELCOME50)" />
                <button className="btn btn-secondary" onClick={applyOffer}>Apply</button>
              </div>
              {offerResult && <div className={styles.offerApplied}>✓ {offerResult.code} applied — {offerResult.freeDelivery ? 'Free Delivery!' : `₹${offerResult.discount} off!`}</div>}
              {offerError && <div className={styles.error} style={{ marginTop:6 }}>❌ {offerError}</div>}
            </div>

            {/* Notes */}
            <div className={styles.section}>
              <div className="field" style={{ marginBottom:0 }}>
                <label>Special Instructions (optional)</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Less spicy, no onion, etc..." />
              </div>
            </div>

            {/* Bill */}
            <div className={styles.section}>
              <h3>Bill Summary</h3>
              <div className={styles.billRow}><span>Subtotal</span><span>₹{subtotal}</span></div>
              {discount > 0 && <div className={styles.billRow} style={{ color:'var(--gr-d)' }}><span>Discount</span><span>−₹{discount}</span></div>}
              <div className={styles.billRow}>
                <span>Delivery {distanceKm ? `(${distanceKm.toFixed(1)} km)` : ''}</span>
                <span>
                  {freeDelivery
                    ? <span style={{ color:'var(--gr-d)', fontWeight:600 }}>FREE 🎉</span>
                    : deliveryCharge === null
                      ? <span style={{ color:'var(--t2)', fontSize:12 }}>🗺️ Map se location select karo</span>
                      : `₹${Math.round(deliveryCharge)}`
                  }
                </span>
              </div>
              <div className={`${styles.billRow} ${styles.total}`}>
                <span>Total</span>
                <span style={{ color:'var(--or)' }}>
                  {deliveryCharge === null && !freeDelivery ? `₹${subtotal - discount} + delivery` : `₹${total}`}
                </span>
              </div>
            </div>

            <div className={styles.codNotice}>
              {deliveryCharge === null && !freeDelivery
                ? '🗺️ Pehle map se apni location select karo — delivery charge calculate hoga'
                : `💵 Cash on Delivery — Pay ₹${total} when food arrives`}
            </div>

            {error && <div className={styles.error}>{error}</div>}

            <button className="btn btn-primary btn-full" onClick={placeOrder} disabled={loading || outOfRange}>
              {loading ? <span className="spinner" /> : `Place Order · ₹${total}`}
            </button>
          </>
        )}
      </div>

      {/* Map Picker Modal */}
      {showMapPicker && (
        <MapPickerModal
          initialLat={lat} initialLng={lng}
          kitchenLat={kitchenLat} kitchenLng={kitchenLng}
          maxKm={maxKm}
          onConfirm={handleMapConfirm}
          onClose={() => setShowMapPicker(false)}
        />
      )}

      {/* Save Address Modal */}
      {showAddressModal && (
        <div style={{ position:'fixed', inset:0, background:'#0008', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, padding:16 }}
          onClick={e => e.target===e.currentTarget && setShowAddressModal(false)}>
          <div style={{ background:'var(--card)', borderRadius:16, padding:24, width:'100%', maxWidth:360 }}>
            <h3 style={{ margin:'0 0 16px', fontSize:16 }}>💾 Save Address</h3>
            <div className="field">
              <label>Label</label>
              <select value={newAddrLabel} onChange={e => setNewAddrLabel(e.target.value)}
                style={{ width:'100%', padding:'10px 12px', borderRadius:8, border:'1px solid var(--bd)', background:'var(--bg)', fontSize:14 }}>
                <option>Home</option><option>Work</option><option>Other</option>
              </select>
            </div>
            <div className="field">
              <label>Address</label>
              <textarea value={address} readOnly rows={3}
                style={{ width:'100%', padding:'10px 12px', borderRadius:8, border:'1px solid var(--bd)', fontSize:13, resize:'none', background:'var(--bg)', boxSizing:'border-box' }} />
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button className="btn btn-secondary" style={{ flex:1 }} onClick={() => setShowAddressModal(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex:1 }} onClick={saveCurrentAddress}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

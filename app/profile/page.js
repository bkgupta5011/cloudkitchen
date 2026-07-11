'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

const GMAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY

function loadGoogleMaps() {
  return new Promise((resolve, reject) => {
    if (window.google?.maps) { resolve(window.google.maps); return }
    const existing = document.getElementById('gmaps-script')
    if (existing) {
      existing.addEventListener('load', () => resolve(window.google.maps))
      if (window.google?.maps) resolve(window.google.maps)
      return
    }
    const script = document.createElement('script')
    script.id = 'gmaps-script'
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GMAPS_KEY}&libraries=places`
    script.async = true; script.defer = true
    script.onload = () => resolve(window.google.maps)
    script.onerror = reject
    document.head.appendChild(script)
  })
}

async function forwardGeocodeGoogle(addressText) {
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(addressText)}&key=${GMAPS_KEY}&region=IN`
    )
    const data = await res.json()
    const loc = data.results?.[0]?.geometry?.location
    if (loc) return { lat: loc.lat, lng: loc.lng }
  } catch {}
  return null
}

async function reverseGeocodeGoogle(lat, lng) {
  try {
    fetch('/api/track-usage', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({type:'geocoding'}) }).catch(()=>{})
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GMAPS_KEY}&language=en&region=IN`
    )
    const data = await res.json()
    if (data.results?.[0]) {
      const result = data.results[0]
      const comps = result.address_components || []
      const get = (type) => comps.find(c => c.types.includes(type))?.long_name || ''
      const area = [get('sublocality_level_1')||get('sublocality'), get('locality')].filter(Boolean).join(', ')
      const pincode = get('postal_code')
      return {
        full: result.formatted_address,
        area,
        pincode,
      }
    }
  } catch {}
  return { full: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, area: '', pincode: '' }
}

export default function ProfilePage() {
  const router = useRouter()
  const [profile, setProfile] = useState(null)
  const [role, setRole] = useState('')
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' })
  const [addresses, setAddresses] = useState([])
  const [orders, setOrders] = useState([])
  const [notices, setNotices] = useState([])
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState('ok')
  const [addingAddr, setAddingAddr] = useState(false)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [tab, setTab] = useState('profile')
  const mapRef = useRef(null)
  const gmapRef = useRef(null)      // Google Map instance
  const markerRef = useRef(null)    // Google Marker instance
  const searchInputRef = useRef(null) // Search box input element

  const [newAddr, setNewAddr] = useState({
    label: 'Home', recipient_name: '', recipient_phone: '',
    building: '', area: '', landmark: '', pincode: '',
    address_text: '', lat: null, lng: null, is_default: false
  })

  const showMsg = (text, type = 'ok') => { setMsg(text); setMsgType(type); setTimeout(() => setMsg(''), 4000) }

  // Init Google Map when address form opens
  useEffect(() => {
    if (!addingAddr) return
    let cancelled = false
    const timer = setTimeout(() => {
      if (!mapRef.current || gmapRef.current) return
      loadGoogleMaps().then(gmaps => {
        if (cancelled || !mapRef.current) return
        fetch('/api/track-usage', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({type:'maps'}) }).catch(()=>{})

        const defaultLat = 25.5801392, defaultLng = 85.1569214
        const center = { lat: defaultLat, lng: defaultLng }
        const map = new gmaps.Map(mapRef.current, {
          center, zoom: 14,
          mapTypeControl: false, streetViewControl: false, fullscreenControl: false,
          zoomControlOptions: { position: gmaps.ControlPosition.RIGHT_CENTER }
        })
        gmapRef.current = map

        const marker = new gmaps.Marker({
          position: center, map, draggable: true,
          animation: gmaps.Animation.DROP, title: 'Drag to your location'
        })
        markerRef.current = marker

        const onPick = async (lat, lng) => {
          setNewAddr(prev => ({ ...prev, lat, lng }))
          const geo = await reverseGeocodeGoogle(lat, lng)
          setNewAddr(prev => ({
            ...prev, lat, lng,
            area: geo.area || prev.area,
            pincode: geo.pincode || prev.pincode,
            address_text: geo.full || prev.address_text,
          }))
        }

        marker.addListener('dragend', () => {
          const pos = marker.getPosition()
          onPick(pos.lat(), pos.lng())
        })
        map.addListener('click', (e) => {
          marker.setPosition(e.latLng)
          onPick(e.latLng.lat(), e.latLng.lng())
        })

        // Google Places Autocomplete search
        if (searchInputRef.current) {
          const autocomplete = new gmaps.places.Autocomplete(searchInputRef.current, {
            componentRestrictions: { country: 'in' },
            fields: ['formatted_address', 'geometry', 'address_components']
          })
          autocomplete.addListener('place_changed', () => {
            fetch('/api/track-usage', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({type:'places'}) }).catch(()=>{})
            const place = autocomplete.getPlace()
            if (!place.geometry) return
            const loc = place.geometry.location
            map.setCenter(loc); map.setZoom(17)
            marker.setPosition(loc)
            const comps = place.address_components || []
            const get = (type) => comps.find(c => c.types.includes(type))?.long_name || ''
            const area = [get('sublocality_level_1')||get('sublocality'), get('locality')].filter(Boolean).join(', ')
            const pincode = get('postal_code')
            setNewAddr(prev => ({
              ...prev,
              lat: loc.lat(), lng: loc.lng(),
              area: area || prev.area,
              pincode: pincode || prev.pincode,
              address_text: place.formatted_address,
            }))
          })
        }
      }).catch(() => {})
    }, 150)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [addingAddr])

  // Cleanup map on close
  useEffect(() => {
    if (!addingAddr && gmapRef.current) {
      gmapRef.current = null
      markerRef.current = null
    }
  }, [addingAddr])

  const getCurrentLocation = () => {
    if (!navigator.geolocation) { showMsg('GPS isn\'t supported in this browser', 'err'); return }
    setGpsLoading(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        setGpsLoading(false)
        if (markerRef.current && gmapRef.current) {
          const pos2 = new window.google.maps.LatLng(lat, lng)
          gmapRef.current.setCenter(pos2); gmapRef.current.setZoom(17)
          markerRef.current.setPosition(pos2)
        }
        setNewAddr(prev => ({ ...prev, lat, lng }))
        const geo = await reverseGeocodeGoogle(lat, lng)
        setNewAddr(prev => ({
          ...prev, lat, lng,
          area: geo.area || prev.area,
          pincode: geo.pincode || prev.pincode,
          address_text: geo.full || prev.address_text,
        }))
      },
      () => {
        setGpsLoading(false)
        showMsg('Location access is blocked. Allow it in your browser settings.', 'err')
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  useEffect(() => {
    fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'me' }) })
      .then(r => r.json())
      .then(({ user }) => {
        if (!user) { router.push('/login'); return }
        setRole(user.role)
        return Promise.all([
          fetch('/api/profile').then(r => r.json()),
          user.role === 'customer' ? fetch('/api/addresses').then(r => r.json()) : Promise.resolve({ addresses: [] }),
          user.role === 'customer' ? fetch('/api/orders').then(r => r.json()) : Promise.resolve({ orders: [] }),
          fetch('/api/notices').then(r => r.json()),
        ])
      })
      .then(([profileRes, addrRes, ordersRes, noticesRes]) => {
        if (!profileRes) return
        setProfile(profileRes.profile)
        setForm({ name: profileRes.profile?.name || '', email: profileRes.profile?.email || '', phone: profileRes.profile?.phone || '', address: profileRes.profile?.address || '' })
        setAddresses(addrRes?.addresses || [])
        setOrders(ordersRes?.orders || [])
        setNotices(noticesRes?.notices || [])
        setLoading(false)
      })
  }, [])

  const saveProfile = async () => {
    const res = await fetch('/api/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    const data = await res.json()
    if (data.profile) { setProfile(data.profile); setEditing(false); showMsg('✅ Profile saved!') }
    else showMsg('❌ ' + (data.error || 'Save failed'), 'err')
  }

  const changePassword = async (e) => {
    e.preventDefault()
    if (pwForm.newPw !== pwForm.confirm) { showMsg('❌ Passwords don\'t match', 'err'); return }
    const res = await fetch('/api/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword: pwForm.current, newPassword: pwForm.newPw }) })
    const data = await res.json()
    showMsg(data.message || data.error || 'Done', data.success ? 'ok' : 'err')
    if (data.success) setPwForm({ current: '', newPw: '', confirm: '' })
  }

  const addAddress = async (e) => {
    e.preventDefault()
    if (!newAddr.building.trim()) { showMsg('❌ Flat/Building number is required', 'err'); return }
    const fullAddr = [newAddr.building, newAddr.area, newAddr.landmark ? `Near ${newAddr.landmark}` : '', newAddr.pincode].filter(Boolean).join(', ')
    const addrText = newAddr.address_text || fullAddr

    // Auto-fetch lat/lng from address text if not already set via map
    let finalLat = newAddr.lat, finalLng = newAddr.lng
    if (!finalLat || !finalLng) {
      const geo = await forwardGeocodeGoogle(addrText)
      if (geo) { finalLat = geo.lat; finalLng = geo.lng }
    }

    const payload = { ...newAddr, address_text: addrText, lat: finalLat, lng: finalLng, recipient_name: newAddr.recipient_name || profile?.name, recipient_phone: newAddr.recipient_phone || profile?.phone }
    const res = await fetch('/api/addresses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const data = await res.json()
    if (data.address) {
      setAddresses(prev => [...prev, data.address])
      setNewAddr({ label: 'Home', recipient_name: '', recipient_phone: '', building: '', area: '', landmark: '', pincode: '', address_text: '', lat: null, lng: null, is_default: false })
      setAddingAddr(false)
      showMsg('✅ Address saved!')
    } else showMsg('❌ ' + (data.error || 'Save failed'), 'err')
  }

  const setDefault = async (id) => {
    await fetch('/api/addresses', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, is_default: true }) })
    const d = await fetch('/api/addresses').then(r => r.json())
    setAddresses(d.addresses || [])
    showMsg('✅ Default address set!')
  }

  const deleteAddress = async (id) => {
    if (!confirm('Delete this address?')) return
    await fetch(`/api/addresses?id=${id}`, { method: 'DELETE' })
    setAddresses(prev => prev.filter(a => a.id !== id))
    showMsg('Address deleted')
  }

  const statusColor = { pending: 'badge-new', confirmed: 'badge-prep', preparing: 'badge-prep', out_for_delivery: 'badge-out', delivered: 'badge-done', cancelled: 'badge-cancelled' }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}><div className="spinner" /></div>

  const backPath = role === 'admin' ? '/admin' : role === 'delivery' ? '/delivery' : '/menu'

  const inp = (placeholder, value, onChange, extra = {}) => (
    <input value={value} onChange={onChange} placeholder={placeholder}
      style={{ width: '100%', padding: '11px 13px', borderRadius: 9, border: '1.5px solid var(--bd)', background: 'var(--bg)', fontSize: 14, boxSizing: 'border-box', outline: 'none' }}
      {...extra} />
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingBottom: 40 }}>
      <nav style={{ background: 'var(--card)', borderBottom: '1px solid var(--bd)', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => router.push(backPath)}>← Back</button>
        <span style={{ fontSize: 15, fontWeight: 600 }}>My Profile</span>
      </nav>

      <div style={{ maxWidth: 540, margin: '0 auto', padding: '20px 16px' }}>

        {/* Admin Notices */}
        {notices.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            {notices.map(n => (
              <div key={n.id} style={{ background: 'linear-gradient(135deg, #fff7ed, #fef3c7)', border: '1px solid #fed7aa', borderRadius: 12, padding: '10px 14px', marginBottom: 8, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span style={{ fontSize: 20 }}>{n.emoji || '📢'}</span>
                <span style={{ fontSize: 13, color: '#92400e', lineHeight: 1.5 }}>{n.message}</span>
              </div>
            ))}
          </div>
        )}

        {/* Profile header */}
        <div style={{ background: 'linear-gradient(135deg, #e85d04, #f97316)', borderRadius: 16, padding: '24px 20px', marginBottom: 16, color: '#fff', textAlign: 'center' }}>
          <div style={{ width: 60, height: 60, background: 'rgba(255,255,255,0.25)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: 24, fontWeight: 700 }}>
            {profile?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{profile?.name}</div>
          <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>{profile?.email}</div>
          <div style={{ fontSize: 12, background: 'rgba(255,255,255,0.2)', display: 'inline-block', borderRadius: 12, padding: '2px 12px', marginTop: 6 }}>
            {role === 'customer' ? '🛒 Customer' : role === 'delivery' ? '🛵 Delivery Boy' : '⚙️ Admin'}
          </div>
        </div>

        {msg && (
          <div style={{ background: msgType === 'ok' ? '#dcfce7' : '#fef2f2', border: `1px solid ${msgType === 'ok' ? '#86efac' : '#fca5a5'}`, borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 13 }}>
            {msg}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, background: 'var(--bg)', borderRadius: 10, padding: 4, marginBottom: 16, border: '1px solid var(--bd)' }}>
          {[
            ['profile', '👤 Info'],
            ...(role === 'customer' ? [['addresses', '📍 Addresses'], ['orders', '📋 Orders']] : []),
            ['password', '🔒 Password'],
          ].map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)}
              style={{ flex: 1, padding: '8px 4px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: tab === t ? 'var(--card)' : 'transparent',
                color: tab === t ? 'var(--or)' : 'var(--t2)',
                boxShadow: tab === t ? '0 1px 4px #0001' : 'none' }}>
              {label}
            </button>
          ))}
        </div>

        {/* ── PROFILE TAB ── */}
        {tab === 'profile' && (
          <div style={{ background: 'var(--card)', borderRadius: 14, padding: 20, border: '1px solid var(--bd)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 15 }}>Personal Information</h3>
              <button className="btn btn-secondary" style={{ fontSize: 12, padding: '5px 12px' }} onClick={() => setEditing(!editing)}>
                {editing ? 'Cancel' : '✏️ Edit'}
              </button>
            </div>
            {editing ? (
              <>
                <div className="field"><label>Full Name</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                <div className="field">
                  <label>Email Address <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 400 }}>(optional — receipts ke liye)</span></label>
                  <input type="email" value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="you@email.com" autoComplete="email" />
                </div>
                <div className="field">
                  <label>Phone Number</label>
                  <div style={{ display: 'flex', gap: 0 }}>
                    <span style={{ padding: '10px 12px', background: 'var(--bg)', border: '1px solid var(--bd)', borderRight: 'none', borderRadius: '8px 0 0 8px', fontSize: 13, color: 'var(--t2)', fontWeight: 600 }}>🇮🇳 +91</span>
                    <input value={form.phone?.replace(/^\+91/, '')} onChange={e => setForm({ ...form, phone: '+91' + e.target.value.replace(/[^0-9]/g, '').slice(-10) })} placeholder="98765 43210" maxLength={10} style={{ borderRadius: '0 8px 8px 0' }} />
                  </div>
                </div>
                {role === 'customer' && <div className="field"><label>Default Address</label><input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Your default address" /></div>}
                <button className="btn btn-primary btn-full" onClick={saveProfile}>💾 Save Changes</button>
              </>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                {[['Name', profile?.name], ['Email', profile?.email], ['Phone', profile?.phone],
                  ...(role === 'customer' ? [['Address', profile?.address]] : []),
                  ['Member Since', profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'long' }) : '—'],
                ].map(([label, val]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, paddingBottom: 10, borderBottom: '1px solid var(--bg)' }}>
                    <span style={{ color: 'var(--t2)' }}>{label}</span>
                    <span style={{ fontWeight: 500, textAlign: 'right', maxWidth: '60%' }}>{val || '—'}</span>
                  </div>
                ))}
              </div>
            )}
            {role === 'customer' && !editing && (
              <button onClick={() => router.push('/health')} style={{ marginTop: 16, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, background: 'linear-gradient(135deg,#065f46,#059669)', color: '#fff', border: 'none', borderRadius: 12, padding: '14px 16px', cursor: 'pointer', textAlign: 'left' }}>
                <span>
                  <span style={{ fontSize: 15, fontWeight: 800, display: 'block' }}>💚 My Health (BMI)</span>
                  <span style={{ display: 'block', fontSize: 11.5, opacity: 0.9, fontWeight: 500 }}>Get your calorie &amp; protein target + healthy meal ideas</span>
                </span>
                <span style={{ fontSize: 20 }}>›</span>
              </button>
            )}
          </div>
        )}

        {/* ── ADDRESSES TAB ── */}
        {tab === 'addresses' && role === 'customer' && (
          <div>
            {!addingAddr && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>Saved Addresses</span>
                <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={() => setAddingAddr(true)}>+ Add New</button>
              </div>
            )}

            {addresses.length === 0 && !addingAddr && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--t2)' }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>📍</div>
                <p>No saved addresses yet</p>
                <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => setAddingAddr(true)}>Add Address</button>
              </div>
            )}

            {!addingAddr && addresses.map(a => (
              <div key={a.id} style={{ background: 'var(--card)', borderRadius: 12, padding: '14px 16px', marginBottom: 10, border: a.is_default ? '1.5px solid var(--or)' : '1px solid var(--bd)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: a.is_default ? 'var(--or)' : 'var(--t1)' }}>
                      {a.label === 'Home' ? '🏠' : a.label === 'Work' ? '🏢' : '📍'} {a.label}
                    </span>
                    {a.is_default && <span style={{ fontSize: 10, background: '#fff7ed', color: 'var(--or)', borderRadius: 8, padding: '2px 8px', fontWeight: 600 }}>DEFAULT</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {!a.is_default && <button onClick={() => setDefault(a.id)} style={{ fontSize: 11, color: 'var(--or)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Set Default</button>}
                    <button onClick={() => deleteAddress(a.id)} style={{ fontSize: 11, color: 'var(--rd)', background: 'none', border: 'none', cursor: 'pointer' }}>Delete</button>
                  </div>
                </div>
                {(a.recipient_name || a.recipient_phone) && (
                  <div style={{ fontSize: 12, color: 'var(--t2)', marginBottom: 4 }}>
                    👤 {a.recipient_name}{a.recipient_phone ? ` • 📞 ${a.recipient_phone}` : ''}
                  </div>
                )}
                {a.building && <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)', marginBottom: 2 }}>{a.building}</div>}
                <p style={{ fontSize: 13, color: 'var(--t2)', margin: 0 }}>{a.area}{a.landmark ? ` • Near ${a.landmark}` : ''}{a.pincode ? ` - ${a.pincode}` : ''}</p>
              </div>
            ))}

            {/* Add Address Form */}
            {addingAddr && (
              <div style={{ background: 'var(--card)', borderRadius: 14, border: '1.5px solid var(--or)' }}>
                {/* Search bar */}
                <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--bd)' }}>
                  <input
                    ref={searchInputRef}
                    placeholder="🔍 Search address or area…"
                    style={{ width: '100%', padding: '10px 13px', border: '1.5px solid var(--bd2)', borderRadius: 10, fontSize: 13, outline: 'none', background: 'var(--bg)', color: 'var(--t1)', boxSizing: 'border-box' }}
                  />
                </div>
                {/* Map */}
                <div style={{ position: 'relative' }}>
                  <div ref={mapRef} style={{ width: '100%', height: 260 }} />
                  <div style={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 1000 }}>
                    <button type="button" onClick={getCurrentLocation}
                      style={{ background: '#fff', border: '1.5px solid var(--or)', color: 'var(--or)', borderRadius: 20, padding: '8px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 8px #0003', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                      {gpsLoading ? '⏳' : '🎯'} {gpsLoading ? 'Location fetch ho raha...' : 'Current Location Use Karo'}
                    </button>
                  </div>
                </div>

                <div style={{ padding: 20 }}>
                  <div style={{ fontSize: 13, color: 'var(--t2)', marginBottom: 14, textAlign: 'center' }}>
                    📍 Search, tap the map, or use GPS — then fill in the details
                  </div>

                  {/* Save As */}
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--t2)', display: 'block', marginBottom: 6 }}>Save As</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {['Home', 'Work', 'Other'].map(lbl => (
                        <button key={lbl} type="button" onClick={() => setNewAddr(prev => ({ ...prev, label: lbl }))}
                          style={{ flex: 1, padding: '8px', borderRadius: 8, border: `1.5px solid ${newAddr.label === lbl ? 'var(--or)' : 'var(--bd)'}`, background: newAddr.label === lbl ? '#fff7ed' : 'var(--bg)', color: newAddr.label === lbl ? 'var(--or)' : 'var(--t2)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                          {lbl === 'Home' ? '🏠' : lbl === 'Work' ? '🏢' : '📍'} {lbl}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Recipient */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--t2)', display: 'block', marginBottom: 5 }}>Recipient Name</label>
                      {inp('Full Name', newAddr.recipient_name, e => setNewAddr(p => ({ ...p, recipient_name: e.target.value })))}
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--t2)', display: 'block', marginBottom: 5 }}>Mobile Number</label>
                      {inp('10 digit number', newAddr.recipient_phone, e => setNewAddr(p => ({ ...p, recipient_phone: e.target.value.replace(/[^0-9]/g, '').slice(0,10) })), { inputMode: 'numeric' })}
                    </div>
                  </div>

                  {/* Building */}
                  <div style={{ marginBottom: 10 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--t2)', display: 'block', marginBottom: 5 }}>Flat / House / Building No. <span style={{ color: 'var(--rd)' }}>*</span></label>
                    {inp('e.g. Flat 3B, Tower A, Shiv Niwas', newAddr.building, e => setNewAddr(p => ({ ...p, building: e.target.value })))}
                  </div>

                  {/* Area */}
                  <div style={{ marginBottom: 10 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--t2)', display: 'block', marginBottom: 5 }}>Area / Street / Colony</label>
                    {inp('e.g. Ashok Nagar, Main Road', newAddr.area, e => setNewAddr(p => ({ ...p, area: e.target.value })))}
                  </div>

                  {/* Landmark & Pincode */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--t2)', display: 'block', marginBottom: 5 }}>Landmark</label>
                      {inp('Near school/temple...', newAddr.landmark, e => setNewAddr(p => ({ ...p, landmark: e.target.value })))}
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--t2)', display: 'block', marginBottom: 5 }}>Pincode</label>
                      {inp('e.g. 800001', newAddr.pincode, e => setNewAddr(p => ({ ...p, pincode: e.target.value.replace(/[^0-9]/g,'').slice(0,6) })), { inputMode: 'numeric' })}
                    </div>
                  </div>

                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--t2)', display: 'block', marginBottom: 5 }}>Full Address (auto-filled from map)</label>
                    <textarea rows={2} value={newAddr.address_text} onChange={e => setNewAddr(p => ({ ...p, address_text: e.target.value }))}
                      placeholder="Auto-filled when you select location on map..."
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 9, border: '1.5px solid var(--bd)', background: 'var(--bg)', fontSize: 13, resize: 'none', boxSizing: 'border-box' }} />
                  </div>

                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, cursor: 'pointer', fontSize: 13 }}>
                    <input type="checkbox" checked={newAddr.is_default} onChange={e => setNewAddr(p => ({ ...p, is_default: e.target.checked }))} />
                    Set as default address
                  </label>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { setAddingAddr(false); setNewAddr({ label: 'Home', recipient_name: '', recipient_phone: '', building: '', area: '', landmark: '', pincode: '', address_text: '', lat: null, lng: null, is_default: false }) }}>Cancel</button>
                    <button type="button" className="btn btn-primary" style={{ flex: 2 }} onClick={addAddress}>💾 Save Address</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── ORDERS TAB ── */}
        {tab === 'orders' && role === 'customer' && (
          <div>
            {orders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--t2)' }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>📋</div>
                <p>No orders yet</p>
                <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => router.push('/menu')}>Order Karo</button>
              </div>
            ) : (
              orders.map(o => (
                <div key={o.id} style={{ background: 'var(--card)', borderRadius: 12, padding: '14px 16px', marginBottom: 10, border: '1px solid var(--bd)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontWeight: 600, color: 'var(--bl)' }}>Order #{o.order_number}</span>
                    <span className={`badge ${statusColor[o.status] || 'badge-new'}`}>{o.status?.replace('_', ' ')}</span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--t2)', marginBottom: 4 }}>
                    {new Date(o.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 600 }}>
                    <span style={{ color: 'var(--t2)', fontSize: 12 }}>{o.delivery_address?.slice(0, 40)}...</span>
                    <span style={{ color: 'var(--or)' }}>₹{Math.round(o.total)}</span>
                  </div>
                  {o.delivery_boy_name && <div style={{ fontSize: 11, color: 'var(--gr-d)', marginTop: 6 }}>🛵 {o.delivery_boy_name}</div>}
                </div>
              ))
            )}
          </div>
        )}

        {/* ── PASSWORD TAB ── */}
        {tab === 'password' && (
          <div style={{ background: 'var(--card)', borderRadius: 14, padding: 20, border: '1px solid var(--bd)' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 15 }}>🔒 Change Password</h3>
            <form onSubmit={changePassword}>
              <div className="field"><label>Current Password</label><input type="password" required value={pwForm.current} onChange={e => setPwForm({ ...pwForm, current: e.target.value })} placeholder="••••••••" /></div>
              <div className="field"><label>New Password</label><input type="password" required value={pwForm.newPw} onChange={e => setPwForm({ ...pwForm, newPw: e.target.value })} placeholder="Min 6 characters" minLength={6} /></div>
              <div className="field"><label>Confirm New Password</label><input type="password" required value={pwForm.confirm} onChange={e => setPwForm({ ...pwForm, confirm: e.target.value })} placeholder="Repeat new password" /></div>
              <button type="submit" className="btn btn-primary btn-full">🔒 Update Password</button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}

'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

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
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState('ok')
  const [addingAddr, setAddingAddr] = useState(false)
  const [newAddr, setNewAddr] = useState({ label: 'Home', address_text: '' })
  const [tab, setTab] = useState('profile') // profile | orders | addresses | password

  const showMsg = (text, type = 'ok') => { setMsg(text); setMsgType(type); setTimeout(() => setMsg(''), 4000) }

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
        ])
      })
      .then(([profileRes, addrRes, ordersRes]) => {
        if (!profileRes) return
        setProfile(profileRes.profile)
        setForm({
          name: profileRes.profile?.name || '',
          phone: profileRes.profile?.phone || '',
          address: profileRes.profile?.address || '',
        })
        setAddresses(addrRes?.addresses || [])
        setOrders(ordersRes?.orders || [])
        setLoading(false)
      })
  }, [])

  const saveProfile = async () => {
    const res = await fetch('/api/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    const data = await res.json()
    if (data.profile) { setProfile(data.profile); setEditing(false); showMsg('✅ Profile save ho gayi!') }
    else showMsg('❌ ' + (data.error || 'Save failed'), 'err')
  }

  const changePassword = async (e) => {
    e.preventDefault()
    if (pwForm.newPw !== pwForm.confirm) { showMsg('❌ Passwords match nahi kar rahe', 'err'); return }
    const res = await fetch('/api/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword: pwForm.current, newPassword: pwForm.newPw }) })
    const data = await res.json()
    showMsg(data.message || data.error || 'Done', data.success ? 'ok' : 'err')
    if (data.success) setPwForm({ current: '', newPw: '', confirm: '' })
  }

  const addAddress = async (e) => {
    e.preventDefault()
    const res = await fetch('/api/addresses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newAddr) })
    const data = await res.json()
    if (data.address) {
      setAddresses(prev => [...prev, data.address])
      setNewAddr({ label: 'Home', address_text: '' })
      setAddingAddr(false)
      showMsg('✅ Address save ho gaya!')
    }
  }

  const setDefault = async (id) => {
    await fetch('/api/addresses', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, is_default: true }) })
    const d = await fetch('/api/addresses').then(r => r.json())
    setAddresses(d.addresses || [])
    showMsg('✅ Default address set ho gaya!')
  }

  const deleteAddress = async (id) => {
    if (!confirm('Is address ko delete karna chahte ho?')) return
    await fetch(`/api/addresses?id=${id}`, { method: 'DELETE' })
    setAddresses(prev => prev.filter(a => a.id !== id))
    showMsg('Address delete ho gaya')
  }

  const statusColor = { pending: 'badge-new', confirmed: 'badge-prep', preparing: 'badge-prep', out_for_delivery: 'badge-out', delivered: 'badge-done', cancelled: 'badge-cancelled' }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}><div className="spinner" /></div>

  const backPath = role === 'admin' ? '/admin' : role === 'delivery' ? '/delivery' : '/menu'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingBottom: 40 }}>
      {/* Nav */}
      <nav style={{ background: 'var(--card)', borderBottom: '1px solid var(--bd)', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => router.push(backPath)}>← Back</button>
        <span style={{ fontSize: 15, fontWeight: 600 }}>My Profile</span>
      </nav>

      <div style={{ maxWidth: 520, margin: '0 auto', padding: '20px 16px' }}>
        {/* Profile header */}
        <div style={{ background: 'linear-gradient(135deg, #e85d04, #f97316)', borderRadius: 16, padding: '24px 20px', marginBottom: 16, color: '#fff', textAlign: 'center' }}>
          <div style={{ width: 60, height: 60, background: 'rgba(255,255,255,0.25)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: 24, fontWeight: 700 }}>
            {profile?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{profile?.name}</div>
          <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>{profile?.email}</div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2, background: 'rgba(255,255,255,0.2)', display: 'inline-block', borderRadius: 12, padding: '2px 12px', marginTop: 6 }}>
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
            <button key={t}
              onClick={() => setTab(t)}
              style={{ flex: 1, padding: '8px 4px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: tab === t ? 'var(--card)' : 'transparent',
                color: tab === t ? 'var(--or)' : 'var(--t2)',
                boxShadow: tab === t ? '0 1px 4px #0001' : 'none'
              }}>
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
                {[
                  ['Name', profile?.name],
                  ['Email', profile?.email],
                  ['Phone', profile?.phone],
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
          </div>
        )}

        {/* ── ADDRESSES TAB ── */}
        {tab === 'addresses' && role === 'customer' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>Saved Addresses</span>
              <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={() => setAddingAddr(true)}>+ Add New</button>
            </div>

            {addresses.length === 0 && !addingAddr && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--t2)' }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>📍</div>
                <p>Koi saved address nahi hai</p>
                <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => setAddingAddr(true)}>Add Address</button>
              </div>
            )}

            {addresses.map(a => (
              <div key={a.id} style={{ background: 'var(--card)', borderRadius: 12, padding: '14px 16px', marginBottom: 10, border: a.is_default ? '1.5px solid var(--or)' : '1px solid var(--bd)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: a.is_default ? 'var(--or)' : 'var(--t1)' }}>
                      {a.label === 'Home' ? '🏠' : a.label === 'Work' ? '🏢' : '📍'} {a.label}
                    </span>
                    {a.is_default && <span style={{ fontSize: 10, background: '#fff7ed', color: 'var(--or)', borderRadius: 8, padding: '2px 8px', fontWeight: 600 }}>DEFAULT</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {!a.is_default && (
                      <button onClick={() => setDefault(a.id)} style={{ fontSize: 11, color: 'var(--or)', background: 'none', border: 'none', cursor: 'pointer' }}>Set Default</button>
                    )}
                    <button onClick={() => deleteAddress(a.id)} style={{ fontSize: 11, color: 'var(--rd)', background: 'none', border: 'none', cursor: 'pointer' }}>Delete</button>
                  </div>
                </div>
                <p style={{ fontSize: 13, color: 'var(--t2)', margin: 0 }}>{a.address_text}</p>
              </div>
            ))}

            {addingAddr && (
              <div style={{ background: 'var(--card)', borderRadius: 14, padding: 20, border: '1.5px solid var(--or)' }}>
                <h3 style={{ margin: '0 0 14px', fontSize: 14 }}>➕ Add New Address</h3>
                <form onSubmit={addAddress}>
                  <div className="field">
                    <label>Label</label>
                    <select value={newAddr.label} onChange={e => setNewAddr({ ...newAddr, label: e.target.value })} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--bd)', background: 'var(--bg)', fontSize: 14 }}>
                      <option>Home</option>
                      <option>Work</option>
                      <option>Other</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Full Address</label>
                    <textarea required rows={3} value={newAddr.address_text} onChange={e => setNewAddr({ ...newAddr, address_text: e.target.value })} placeholder="Flat no, Street, Landmark, City - PIN" style={{ resize: 'none' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setAddingAddr(false)}>Cancel</button>
                    <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>💾 Save</button>
                  </div>
                </form>
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
                <p>Koi order nahi hai abhi</p>
                <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => router.push('/menu')}>Order Karo</button>
              </div>
            ) : (
              orders.map(o => (
                <div key={o.id} style={{ background: 'var(--card)', borderRadius: 12, padding: '14px 16px', marginBottom: 10, border: '1px solid var(--bd)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontWeight: 600, color: 'var(--bl)' }}>Order #{o.order_number}</span>
                    <span className={`badge ${statusColor[o.status] || 'badge-new'}`}>{o.status.replace('_', ' ')}</span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--t2)', marginBottom: 4 }}>
                    {new Date(o.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 600 }}>
                    <span style={{ color: 'var(--t2)', fontSize: 12 }}>{o.delivery_address?.slice(0, 40)}...</span>
                    <span style={{ color: 'var(--or)' }}>₹{Math.round(o.total)}</span>
                  </div>
                  {o.delivery_boy_name && (
                    <div style={{ fontSize: 11, color: 'var(--gr-d)', marginTop: 6 }}>🛵 {o.delivery_boy_name}</div>
                  )}
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

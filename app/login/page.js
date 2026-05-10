'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import styles from './login.module.css'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState('login')
  const [loginType, setLoginType] = useState('email') // email | phone
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ name:'', email:'', phone:'', password:'', address:'' })

  useEffect(() => {
    fetch('/api/auth', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'me' }) })
      .then(r => r.json())
      .then(({ user }) => {
        if (user?.role === 'admin') router.push('/admin')
        else if (user?.role === 'delivery') router.push('/delivery')
        else if (user?.role === 'customer') router.push('/menu')
      })
  }, [])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      // Build identifier: email or phone with +91
      const identifier = loginType === 'phone'
        ? (form.phone.startsWith('+91') ? form.phone : '+91' + form.phone.replace(/\s/g,''))
        : form.email

      const res = await fetch('/api/auth', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          action: mode,
          role: 'customer',
          identifier,
          email: form.email,
          phone: loginType === 'phone' ? identifier : form.phone,
          password: form.password,
          name: form.name,
          address: form.address,
        })
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      const { user } = data
      if (user.role === 'admin') router.push('/admin')
      else if (user.role === 'delivery') router.push('/delivery')
      else router.push('/menu')
    } catch { setError('Kuch gadbad ho gayi. Dobara try karo.') }
    finally { setLoading(false) }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <span>🍽️</span>
          <h1>CloudKitchen</h1>
          <p>Fresh food, delivered fast</p>
        </div>

        {/* Login / Sign Up tabs */}
        <div className={styles.modeToggle}>
          <button className={mode==='login'?styles.active:''} onClick={() => { setMode('login'); setError('') }}>Login</button>
          <button className={mode==='signup'?styles.active:''} onClick={() => { setMode('signup'); setError('') }}>Sign Up</button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Sign up extra fields */}
          {mode === 'signup' && (
            <>
              <div className="field">
                <label>Full Name</label>
                <input required value={form.name} onChange={e => set('name', e.target.value)} placeholder="Rahul Kumar" />
              </div>
              <div className="field">
                <label>Default Delivery Address</label>
                <input value={form.address} onChange={e => set('address', e.target.value)} placeholder="Flat 4B, Frazer Road, Patna" />
              </div>
            </>
          )}

          {/* Email / Phone toggle for login identifier */}
          <div style={{ display:'flex', gap:0, marginBottom:12, borderRadius:8, overflow:'hidden', border:'1.5px solid var(--bdr)' }}>
            {['email','phone'].map(t => (
              <button key={t} type="button"
                onClick={() => { setLoginType(t); setError('') }}
                style={{ flex:1, padding:'8px', border:'none', background: loginType===t ? '#e85d04' : '#fff', color: loginType===t ? '#fff' : '#6b7280', fontWeight:600, cursor:'pointer', fontSize:13 }}>
                {t==='email' ? '📧 Email' : '📱 Phone'}
              </button>
            ))}
          </div>

          {loginType === 'email' ? (
            <div className="field">
              <label>Email</label>
              <input type="email" required value={form.email} onChange={e => set('email', e.target.value)} placeholder="you@email.com" />
            </div>
          ) : (
            <div className="field">
              <label>Phone Number</label>
              <div style={{ display:'flex', gap:0 }}>
                <span style={{ padding:'10px 12px', background:'#f3f4f6', border:'1.5px solid var(--bdr)', borderRight:'none', borderRadius:'8px 0 0 8px', fontSize:14, color:'#374151', fontWeight:600, whiteSpace:'nowrap' }}>🇮🇳 +91</span>
                <input required value={form.phone} onChange={e => set('phone', e.target.value.replace(/[^0-9]/g,''))}
                  placeholder="98765 43210" maxLength={10}
                  style={{ borderRadius:'0 8px 8px 0', borderLeft:'none' }} />
              </div>
            </div>
          )}

          {/* For signup, also collect email + phone */}
          {mode === 'signup' && loginType === 'phone' && (
            <div className="field">
              <label>Email (optional)</label>
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="you@email.com" />
            </div>
          )}
          {mode === 'signup' && loginType === 'email' && (
            <div className="field">
              <label>Phone Number</label>
              <div style={{ display:'flex', gap:0 }}>
                <span style={{ padding:'10px 12px', background:'#f3f4f6', border:'1.5px solid var(--bdr)', borderRight:'none', borderRadius:'8px 0 0 8px', fontSize:14, color:'#374151', fontWeight:600 }}>🇮🇳 +91</span>
                <input value={form.phone} onChange={e => set('phone', e.target.value.replace(/[^0-9]/g,''))} placeholder="98765 43210" maxLength={10} style={{ borderRadius:'0 8px 8px 0', borderLeft:'none' }} />
              </div>
            </div>
          )}

          <div className="field">
            <label>Password</label>
            <input type="password" required value={form.password} onChange={e => set('password', e.target.value)} placeholder="••••••••" minLength={6} />
          </div>

          {mode === 'login' && (
            <div style={{ textAlign:'right', marginBottom:8 }}>
              <button type="button" onClick={() => router.push('/forgot-password')}
                style={{ background:'none', border:'none', color:'#e85d04', fontSize:13, cursor:'pointer' }}>
                Password bhool gaye?
              </button>
            </div>
          )}

          {error && <div className={styles.error}>{error}</div>}

          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? <span className="spinner" /> : mode === 'login' ? 'Login' : 'Account Banao'}
          </button>
        </form>

        <p className={styles.switchMode}>
          {mode === 'login' ? 'Naya account?' : 'Pehle se account hai?'}{' '}
          <button onClick={() => { setMode(mode==='login'?'signup':'login'); setError('') }}>
            {mode === 'login' ? 'Sign Up karo' : 'Login karo'}
          </button>
        </p>

        {mode === 'login' && (
          <p style={{ fontSize:11, color:'#9ca3af', textAlign:'center', marginTop:8 }}>
            Admin aur Delivery Boy bhi yahi se login karein
          </p>
        )}

        {/* Delivery Boy Apply link */}
        <div style={{ borderTop:'1px solid #f3f4f6', marginTop:16, paddingTop:14, textAlign:'center' }}>
          <p style={{ fontSize:12, color:'#6b7280', marginBottom:6 }}>Delivery Boy banana chahte ho?</p>
          <button onClick={() => router.push('/delivery/apply')}
            style={{ background:'none', border:'1.5px solid #e85d04', color:'#e85d04', borderRadius:8, padding:'8px 20px', fontSize:13, fontWeight:600, cursor:'pointer' }}>
            🛵 Delivery Boy Application
          </button>
        </div>
      </div>
    </div>
  )
}

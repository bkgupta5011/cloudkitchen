'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import styles from './login.module.css'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', address: '' })

  useEffect(() => {
    fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'me' }) })
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
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: mode,
          role: 'customer',
          email: form.email,
          password: form.password,
          name: form.name,
          phone: form.phone,
          address: form.address,
        })
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }

      const { user } = data
      if (user.role === 'admin') router.push('/admin')
      else if (user.role === 'delivery') router.push('/delivery')
      else router.push('/menu')
    } catch {
      setError('Kuch gadbad ho gayi. Dobara try karo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <span>🍽️</span>
          <h1>CloudKitchen</h1>
          <p>Fresh food, delivered fast</p>
        </div>

        <div className={styles.modeToggle}>
          <button className={mode === 'login' ? styles.active : ''} onClick={() => { setMode('login'); setError('') }}>Login</button>
          <button className={mode === 'signup' ? styles.active : ''} onClick={() => { setMode('signup'); setError('') }}>Sign Up</button>
        </div>

        <form onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <>
              <div className="field">
                <label>Full Name</label>
                <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Rahul Kumar" required />
              </div>
              <div className="field">
                <label>Phone</label>
                <input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+91 98765 43210" />
              </div>
              <div className="field">
                <label>Default Delivery Address</label>
                <input value={form.address} onChange={e => set('address', e.target.value)} placeholder="Flat 4B, Frazer Road, Patna" />
              </div>
            </>
          )}

          <div className="field">
            <label>Email</label>
            <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="you@email.com" required />
          </div>
          <div className="field">
            <label>Password</label>
            <input type="password" value={form.password} onChange={e => set('password', e.target.value)} placeholder="••••••••" required minLength={6} />
          </div>

          {mode === 'login' && (
            <div style={{ textAlign: 'right', marginBottom: 8 }}>
              <button type="button" onClick={() => router.push('/forgot-password')}
                style={{ background: 'none', border: 'none', color: '#e85d04', fontSize: 13, cursor: 'pointer' }}>
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
          <button onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError('') }}>
            {mode === 'login' ? 'Sign Up karo' : 'Login karo'}
          </button>
        </p>

        {mode === 'login' && (
          <p style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center', marginTop: 12 }}>
            Admin aur Delivery Boy bhi yahi se login karein
          </p>
        )}
      </div>
    </div>
  )
}

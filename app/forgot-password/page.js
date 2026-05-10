'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import styles from '../login/login.module.css'
import FoodFiLogo from '../components/FoodFiLogo'

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'forgot-password', email })
      })
      let data
      try { data = await res.json() } catch { data = {} }
      if (!res.ok) {
        setError(data.error || `Server error (${res.status}). Dobara try karo.`)
        return
      }
      setSent(true)
    } catch (e) {
      setError('Network error: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <FoodFiLogo size={56} style={{ borderRadius: 14, boxShadow: '0 4px 16px rgba(232,93,4,0.25)', marginBottom: 10 }} />
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 2px 0', lineHeight: 1.1 }}>
            <span style={{ color: '#e85d04' }}>Food</span><span style={{ color: '#1f2937' }}>Fi</span>
          </h1>
          <h2 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 4px 0', color: '#1e293b', lineHeight: 1.1 }}>
            Cloud Kitchen
          </h2>
          <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>Password Reset</p>
        </div>

        {sent ? (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📧</div>
            <h3 style={{ color: '#1f2937', marginBottom: 8 }}>Email bhej di gayi!</h3>
            <p style={{ color: '#6b7280', fontSize: 14, lineHeight: 1.6 }}>
              <strong>{email}</strong> pe password reset link bheja gaya hai.<br />
              Apna inbox check karein (Spam bhi dekh lein).
            </p>
            <button
              className="btn btn-primary btn-full"
              style={{ marginTop: 20 }}
              onClick={() => router.push('/login')}
            >
              Login Page pe Jao
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16, lineHeight: 1.6 }}>
              Apna registered email daalo. Hum aapko password reset ka link bhejenge.
            </p>
            <div className="field">
              <label>Email Address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@email.com"
                required
              />
            </div>
            {error && <div className={styles.error}>{error}</div>}
            <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
              {loading ? <span className="spinner" /> : 'Reset Link Bhejo'}
            </button>
          </form>
        )}

        <p className={styles.switchMode}>
          <button onClick={() => router.push('/login')}>← Login pe wapas jao</button>
        </p>
      </div>
    </div>
  )
}

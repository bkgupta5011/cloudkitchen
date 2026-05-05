'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import styles from '../login/login.module.css'

function ResetForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) setError('Invalid link. Login page se dobara try karein.')
  }, [token])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (password !== confirm) { setError('Dono passwords match nahi kar rahe'); return }
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset-password', token, newPassword: password })
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      setDone(true)
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
          <p>Naya Password Set Karein</p>
        </div>

        {done ? (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <h3 style={{ color: '#1f2937', marginBottom: 8 }}>Password badal gaya!</h3>
            <p style={{ color: '#6b7280', fontSize: 14 }}>Ab naye password se login karein.</p>
            <button className="btn btn-primary btn-full" style={{ marginTop: 20 }} onClick={() => router.push('/login')}>
              Login Karein
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label>Naya Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
            <div className="field">
              <label>Password Confirm Karein</label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
            {error && <div className={styles.error}>{error}</div>}
            <button type="submit" className="btn btn-primary btn-full" disabled={loading || !token}>
              {loading ? <span className="spinner" /> : 'Password Save Karein'}
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

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  )
}

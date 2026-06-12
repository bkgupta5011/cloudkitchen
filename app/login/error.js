'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

// Catches any client-side crash on the login page.
// If the user is actually logged in (e.g. new customer OTP verified but modal crashed),
// auto-redirect them to the right page instead of showing a blank error screen.
export default function LoginError({ error, reset }) {
  const router = useRouter()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    console.error('[Login] Client error:', error?.message || error)
    fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'me' }),
    })
      .then(r => r.json())
      .then(({ user }) => {
        if (user?.role === 'admin')    { router.replace('/admin');    return }
        if (user?.role === 'delivery') { router.replace('/delivery'); return }
        if (user?.role === 'customer') { router.replace('/menu');     return }
        // Not logged in — show retry
        setChecking(false)
      })
      .catch(() => setChecking(false))
  }, [error])

  if (checking) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: '#0f0500', gap: 16,
      }}>
        <div style={{
          width: 24, height: 24, border: '3px solid rgba(255,255,255,0.2)',
          borderTopColor: '#e85d04', borderRadius: '50%',
          animation: 'spin 0.7s linear infinite',
        }} />
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, margin: 0 }}>
          Redirect ho raha hai...
        </p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: '#0f0500', gap: 16, padding: 24,
    }}>
      <div style={{ fontSize: 48 }}>😕</div>
      <p style={{ color: '#fff', fontSize: 16, fontWeight: 700, margin: 0, textAlign: 'center' }}>
        Kuch gadbad ho gayi
      </p>
      <button
        onClick={reset}
        style={{
          background: '#e85d04', color: '#fff', border: 'none',
          borderRadius: 10, padding: '12px 28px', fontSize: 15,
          fontWeight: 700, cursor: 'pointer',
        }}>
        Dobara Try Karo
      </button>
    </div>
  )
}

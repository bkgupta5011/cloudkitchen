'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    // Check if user is logged in and redirect accordingly
    fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'me' })
    })
      .then(r => r.json())
      .then(({ user }) => {
        if (!user) return router.push('/login')
        if (user.role === 'admin') return router.push('/admin')
        if (user.role === 'delivery') return router.push('/delivery')
        router.push('/menu')
      })
      .catch(() => router.push('/login'))
  }, [])

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <div className="spinner" />
    </div>
  )
}

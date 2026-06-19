'use client'
import { useState, useEffect, useRef } from 'react'

export default function PWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [showBanner, setShowBanner] = useState(false)
  const [showFloat, setShowFloat] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const [isIos, setIsIos] = useState(false)
  const [showIosTip, setShowIosTip] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [authChecked, setAuthChecked] = useState(false) // wait for auth before showing anything
  const timerRef = useRef(null)

  // Step 1: Check login status FIRST — only after confirmed set authChecked=true
  useEffect(() => {
    fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'me' })
    })
      .then(r => r.json())
      .then(d => {
        if (d.user) setIsLoggedIn(true)
      })
      .catch(() => {})
      .finally(() => setAuthChecked(true)) // always mark as checked, even on error
  }, [])

  // Step 2: Setup install prompts ONLY after auth is confirmed and user is NOT logged in
  useEffect(() => {
    if (!authChecked) return   // still checking — do nothing
    if (isLoggedIn) return     // logged in — never show install prompts
    // order.foodfi.in is NOT separately installable — users install the app from foodfi.in
    if (typeof window !== 'undefined' && window.location.hostname === 'order.foodfi.in') return

    // Already installed as standalone app?
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true
    if (standalone) { setIsInstalled(true); return }

    // iOS detection (no beforeinstallprompt on iOS Safari)
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream
    setIsIos(ios)

    // Dismissed recently? (3 din tak nahi dikhayenge)
    const dismissed = localStorage.getItem('pwa_banner_dismissed')
    const recentlyDismissed = dismissed && (Date.now() - parseInt(dismissed)) < 3 * 24 * 60 * 60 * 1000

    if (ios) {
      if (!recentlyDismissed) {
        timerRef.current = setTimeout(() => setShowBanner(true), 3000)
      } else {
        setShowFloat(true)
      }
      return
    }

    // Android / Desktop — capture beforeinstallprompt
    const handler = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      if (!recentlyDismissed) {
        timerRef.current = setTimeout(() => setShowBanner(true), 3000)
      } else {
        setShowFloat(true)
      }
    }

    const installedHandler = () => {
      setIsInstalled(true)
      setShowBanner(false)
      setShowFloat(false)
    }

    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', installedHandler)
    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', installedHandler)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [authChecked, isLoggedIn]) // re-run when auth status is known

  const handleInstall = async () => {
    if (isIos) {
      setShowBanner(false)
      setShowIosTip(true)
      return
    }
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setIsInstalled(true)
      setShowBanner(false)
      setShowFloat(false)
    }
    setDeferredPrompt(null)
    setShowBanner(false)
    setShowFloat(false)
  }

  const handleDismiss = () => {
    setShowBanner(false)
    setShowFloat(true)
    localStorage.setItem('pwa_banner_dismissed', Date.now().toString())
  }

  const handleFloatClick = () => {
    setShowFloat(false)
    setShowBanner(true)
    localStorage.removeItem('pwa_banner_dismissed')
  }

  // Don't render anything until auth status is confirmed
  if (!authChecked) return null
  if (isInstalled || isLoggedIn) return null

  return (
    <>
      {/* ── Bottom Banner ─────────────────────────────── */}
      {showBanner && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
          background: '#fff',
          borderTop: '1px solid #f3f4f6',
          borderRadius: '16px 16px 0 0',
          padding: '16px 20px 24px',
          boxShadow: '0 -8px 32px rgba(0,0,0,0.12)',
          animation: 'slideUp 0.3s ease',
        }}>
          {/* Handle bar */}
          <div style={{ width: 40, height: 4, background: '#e5e7eb', borderRadius: 4, margin: '0 auto 16px' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
            <img src="/icons/icon-192.png" alt="FoodFi"
              style={{ width: 56, height: 56, borderRadius: 14, boxShadow: '0 4px 12px rgba(232,93,4,0.25)' }} />
            <div>
              <p style={{ margin: 0, fontWeight: 800, fontSize: 16, color: '#1f2937' }}>
                FoodFi App Install Karo!
              </p>
              <p style={{ margin: '3px 0 0', fontSize: 13, color: '#6b7280', lineHeight: 1.4 }}>
                Fast access • Offline support • Push notifications
              </p>
            </div>
          </div>

          {isIos ? (
            <div style={{ background: '#fff7ed', border: '1.5px solid #fed7aa', borderRadius: 10, padding: '12px 14px', marginBottom: 12 }}>
              <p style={{ margin: 0, fontSize: 13, color: '#92400e', lineHeight: 1.6 }}>
                📱 Safari mein{' '}
                <span style={{ background: '#e85d04', color: '#fff', borderRadius: 5, padding: '1px 7px', fontSize: 12, fontWeight: 700 }}>
                  Share ⎋
                </span>
                {' '}button dabao, phir{' '}
                <strong>"Add to Home Screen"</strong> choose karo
              </p>
            </div>
          ) : null}

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={handleDismiss}
              style={{
                flex: 1, padding: '12px', background: '#f9fafb',
                border: '1.5px solid #e5e7eb', borderRadius: 10,
                fontSize: 14, color: '#6b7280', cursor: 'pointer', fontWeight: 600,
              }}>
              Baad Mein
            </button>
            <button onClick={handleInstall}
              style={{
                flex: 2, padding: '12px', background: '#e85d04',
                border: 'none', borderRadius: 10,
                fontSize: 14, fontWeight: 700, color: '#fff', cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(232,93,4,0.35)',
              }}>
              {isIos ? '📲 Kaise Install Karein?' : '📲 Install Karo'}
            </button>
          </div>
        </div>
      )}

      {/* ── iOS Step-by-Step Tip ──────────────────────── */}
      {showIosTip && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 10000,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end',
        }} onClick={() => setShowIosTip(false)}>
          <div style={{
            width: '100%', background: '#fff', borderRadius: '20px 20px 0 0',
            padding: '20px 20px 36px',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ width: 40, height: 4, background: '#e5e7eb', borderRadius: 4, margin: '0 auto 20px' }} />
            <h3 style={{ margin: '0 0 16px', fontSize: 17, fontWeight: 800, color: '#1f2937' }}>
              📱 iPhone/iPad pe Install Karein
            </h3>
            {[
              ['1️⃣', 'Safari browser mein yeh site kholo (Chrome pe nahi hoga)'],
              ['2️⃣', 'Neeche toolbar mein Share button (⎋) dabao'],
              ['3️⃣', '"Add to Home Screen" option choose karo'],
              ['4️⃣', 'Upar se naam confirm karo → "Add" dabao'],
            ].map(([num, text]) => (
              <div key={num} style={{ display: 'flex', gap: 12, marginBottom: 14, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 20, lineHeight: 1.3 }}>{num}</span>
                <p style={{ margin: 0, fontSize: 14, color: '#374151', lineHeight: 1.5 }}>{text}</p>
              </div>
            ))}
            <button onClick={() => setShowIosTip(false)}
              style={{
                width: '100%', padding: '14px', marginTop: 8,
                background: '#e85d04', border: 'none', borderRadius: 12,
                fontSize: 15, fontWeight: 700, color: '#fff', cursor: 'pointer',
              }}>
              Samajh Gaya ✓
            </button>
          </div>
        </div>
      )}

      {/* ── Floating Install Button (after banner dismiss) ── */}
      {showFloat && !showBanner && (
        <button onClick={handleFloatClick}
          style={{
            position: 'fixed', bottom: 24, right: 16, zIndex: 9998,
            background: '#e85d04', color: '#fff',
            border: 'none', borderRadius: 50,
            padding: '12px 18px',
            fontSize: 13, fontWeight: 700, cursor: 'pointer',
            boxShadow: '0 4px 18px rgba(232,93,4,0.45)',
            display: 'flex', alignItems: 'center', gap: 6,
            whiteSpace: 'nowrap',
            animation: 'fadeIn 0.3s ease',
          }}>
          📲 Install App
        </button>
      )}

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.8); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </>
  )
}

'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import styles from './login.module.css'
import FoodFiLogo from '../components/FoodFiLogo'

// Food emojis for hero background
const FOOD_EMOJIS = ['🍛','🍜','🥘','🍱','🌮','🍝','🍚','🫕','🥗','🍲','🧆','🍖','🥙','🫔','🍣','🥩']

export default function LoginPage() {
  const router = useRouter()

  // ── Auth redirect check ──────────────────────────────────────────
  useEffect(() => {
    fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'me' }) })
      .then(r => r.json())
      .then(({ user }) => {
        if (user?.role === 'admin') router.push(user.branch_id ? '/branch' : '/admin')
        else if (user?.role === 'delivery') router.push('/delivery')
        else if (user?.role === 'customer') router.push('/menu')
      })
  }, [])

  // ── Form state ───────────────────────────────────────────────────
  const [tab, setTab] = useState('otp')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [savedPhone, setSavedPhone] = useState('')   // phone already in localStorage

  // ── Load saved phone on mount ────────────────────────────────────
  useEffect(() => {
    try {
      const s = localStorage.getItem('ck_saved_phone')
      if (s) { setSavedPhone(s); setPhone(s); setRememberMe(true) }
    } catch(e) {}
  }, [])

  const phoneDigits = phone.replace(/[^0-9]/g, '').slice(0, 10)
  const phoneReady = phoneDigits.length === 10

  // ── OTP state ────────────────────────────────────────────────────
  const [otpStep, setOtpStep] = useState('idle')
  const [otpProvider, setOtpProvider] = useState('fast2sms') // 'fast2sms' | 'firebase'
  const [otpInput, setOtpInput] = useState(['', '', '', '', '', ''])
  const [otpTimer, setOtpTimer] = useState(0)
  const timerRef = useRef(null)
  const otpBoxRefs = useRef([])
  const hiddenOtpRef = useRef(null)   // single real input for auto-fill

  // Firebase refs
  const confirmationResultRef = useRef(null)
  const recaptchaVerifierRef  = useRef(null)
  const firebaseTokenRef      = useRef(null)
  const otpStepRef            = useRef('idle')        // always-fresh otpStep for async callbacks
  const otpProviderRef        = useRef('fast2sms')   // always-fresh otpProvider for async callbacks

  // ── New user welcome modal ───────────────────────────────────────
  const [showNameModal, setShowNameModal] = useState(false)
  const [newUserName, setNewUserName] = useState('')
  const [newUserAddress, setNewUserAddress] = useState('')
  const [locationLoading, setLocationLoading] = useState(false)
  const [newUserSaving, setNewUserSaving] = useState(false)
  const nameInputRef = useRef(null)
  const pendingUserRef = useRef(null)

  // Keep refs in sync so async callbacks (Web OTP, auto-verify) always see fresh values
  useEffect(() => { otpStepRef.current = otpStep }, [otpStep])
  useEffect(() => { otpProviderRef.current = otpProvider }, [otpProvider])

  // Countdown timer
  useEffect(() => {
    if (otpTimer > 0) {
      timerRef.current = setTimeout(() => setOtpTimer(t => t - 1), 1000)
    }
    return () => clearTimeout(timerRef.current)
  }, [otpTimer])

  // Reset OTP + Firebase when phone changes
  useEffect(() => {
    setOtpStep('idle'); setOtpInput(['', '', '', '', '', ''])
    setOtpTimer(0); setError(''); setOtpProvider('fast2sms')
    cleanupFirebase()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone])

  // Reset OTP + Firebase when tab changes
  useEffect(() => {
    setOtpStep('idle'); setOtpInput(['', '', '', '', '', ''])
    setOtpTimer(0); setError(''); setOtpProvider('fast2sms')
    cleanupFirebase()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  // ── Web OTP API — auto-fill from SMS (Android Chrome) ───────────
  useEffect(() => {
    if (otpStep !== 'sent') return
    if (typeof window === 'undefined' || !('OTPCredential' in window)) return
    const ac = new AbortController()
    // Focus the hidden input so Chrome links the OTP dialog to our field
    setTimeout(() => hiddenOtpRef.current?.focus(), 50)
    navigator.credentials.get({ otp: { transport: ['sms'] }, signal: ac.signal })
      .then(otpCredential => {
        if (!otpCredential?.code) return
        const code = otpCredential.code.replace(/[^0-9]/g, '').slice(0, 6)
        if (code.length !== 6) return
        const arr = Array(6).fill('').map((_, i) => code[i] || '')
        setOtpInput(arr)
        autoVerifyOtp(code)
      })
      .catch(err => {
        if (err?.name !== 'AbortError') console.log('Web OTP:', err?.name)
      })
    return () => { try { ac.abort() } catch(e) {} }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otpStep])

  // Focus name input when modal opens
  useEffect(() => {
    if (showNameModal) setTimeout(() => nameInputRef.current?.focus(), 150)
  }, [showNameModal])

  // ── GPS Location ─────────────────────────────────────────────────
  const fetchLocation = () => {
    if (!navigator.geolocation) { setError('Browser does not support GPS'); return }
    setLocationLoading(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords
          const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY
          const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${key}&language=en`)
          const data = await res.json()
          if (data.status !== 'OK' || !data.results?.length) { setLocationLoading(false); return }
          const best = data.results.find(r => r.types.includes('street_address')) || data.results.find(r => r.types.includes('premise')) || data.results[0]
          const comp = {}
          best.address_components.forEach(c => { c.types.forEach(t => { if (!comp[t]) comp[t] = c.long_name }) })
          const parts = [
            [comp.street_number, comp.route].filter(Boolean).join(' '),
            comp.sublocality_level_2, comp.sublocality_level_1 || comp.sublocality,
            comp.neighborhood, comp.locality || comp.administrative_area_level_2,
            comp.administrative_area_level_1, comp.postal_code,
          ].filter(Boolean)
          setNewUserAddress(parts.length >= 3 ? parts.join(', ') : best.formatted_address.replace(/, India$/, '').replace(/, भारत$/, ''))
        } catch { /* silent */ }
        finally { setLocationLoading(false) }
      },
      () => setLocationLoading(false),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  }

  // ── OTP Box handlers ─────────────────────────────────────────────
  const handleOtpBox = (index, val) => {
    // Multi-digit: browser auto-fill / paste into single box
    const digits = val.replace(/[^0-9]/g, '')
    if (digits.length > 1) {
      const arr = ['', '', '', '', '', '']
      digits.slice(0, 6).split('').forEach((d, j) => { if (index + j < 6) arr[index + j] = d })
      // Keep existing digits for unfilled spots
      const next = otpInput.map((existing, j) => arr[j] || (j < index ? existing : ''))
      const filled = digits.slice(0, 6 - index)
      filled.split('').forEach((d, j) => { next[index + j] = d })
      setOtpInput(next)
      const lastIdx = Math.min(index + filled.length - 1, 5)
      otpBoxRefs.current[lastIdx]?.focus()
      const full = next.join('')
      if (full.length === 6) autoVerifyOtp(full)
      return
    }
    if (!/^[0-9]?$/.test(val)) return
    const next = [...otpInput]
    next[index] = val
    setOtpInput(next)
    if (val && index < 5) otpBoxRefs.current[index + 1]?.focus()
    if (val && index === 5) {
      const full = next.join('')
      if (full.length === 6) autoVerifyOtp(full, next)
    }
  }

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpInput[index] && index > 0) otpBoxRefs.current[index - 1]?.focus()
  }

  const handleOtpPaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/[^0-9]/g, '').slice(0, 6)
    if (pasted.length === 6) {
      const arr = pasted.split('')
      setOtpInput(arr)
      otpBoxRefs.current[5]?.focus()
      autoVerifyOtp(pasted, arr)
    }
    e.preventDefault()
  }

  // ── Cleanup verifier + replace container div ─────────────────────
  const cleanupFirebase = () => {
    if (recaptchaVerifierRef.current) {
      try { recaptchaVerifierRef.current.clear() } catch(e) {}
      recaptchaVerifierRef.current = null
    }
    confirmationResultRef.current = null
    firebaseTokenRef.current = null
    try {
      const old = document.getElementById('recaptcha-container')
      if (old?.parentNode) {
        const fresh = document.createElement('div')
        fresh.id = 'recaptcha-container'
        old.parentNode.replaceChild(fresh, old)
      }
    } catch(e) {}
  }

  // Pre-warm Firebase on mount
  useEffect(() => {
    import('@/lib/firebase-client').catch(() => {})
    import('firebase/auth').catch(() => {})
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => { cleanupFirebase() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Shared: handle successful login response ──────────────────────
  const handleLoginSuccess = (data) => {
    const { user, newUser } = data
    if (rememberMe) { try { localStorage.setItem('ck_saved_phone', phoneDigits) } catch(e) {} }
    else { try { localStorage.removeItem('ck_saved_phone') } catch(e) {} }
    if (newUser) { window.location.href = '/menu?new=1'; return }
    if (user.role === 'admin') router.push(user.branch_id ? '/branch' : '/admin')
    else if (user.role === 'delivery') router.push('/delivery')
    else router.push('/menu')
  }

  // ── Firebase fallback: send OTP via Firebase ──────────────────────
  const sendFirebaseOtp = async () => {
    cleanupFirebase()
    try {
      const { getFirebaseAuth } = await import('@/lib/firebase-client')
      const { RecaptchaVerifier, signInWithPhoneNumber } = await import('firebase/auth')
      const auth = getFirebaseAuth()
      if (!auth) throw new Error('Firebase auth init failed')
      const verifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible', callback: () => {}, 'expired-callback': () => { cleanupFirebase() },
      })
      recaptchaVerifierRef.current = verifier
      const result = await signInWithPhoneNumber(auth, '+91' + phoneDigits, verifier)
      confirmationResultRef.current = result
      setOtpProvider('firebase')
      setOtpStep('sent')
      setOtpTimer(60)
      setTimeout(() => hiddenOtpRef.current?.focus(), 100)
    } catch (e) {
      console.error('Firebase OTP error:', e.code, e.message)
      cleanupFirebase()
      const msg = e.code === 'auth/too-many-requests' ? 'Too many OTP requests on this number. Please try again in 10–15 min.'
        : e.code === 'auth/invalid-phone-number' ? 'Invalid phone number. Enter a 10-digit Indian number.'
        : e.code === 'auth/captcha-check-failed' ? 'reCAPTCHA failed. Reload the page and try again.'
        : e.code === 'auth/network-request-failed' ? 'Network error. Please check your internet.'
        : 'Couldn\'t send the OTP. Please try again.'
      setError(msg); setOtpStep('idle')
    }
  }

  // ── Send OTP — 2Factor (Fast2SMS) primary, Firebase automatic fallback ──
  const sendOtp = async () => {
    if (!phoneReady) { setError('Please enter a valid 10-digit mobile number'); return }
    setError(''); setOtpStep('sending'); setOtpInput(['', '', '', '', '', ''])

    // ── Try 2Factor SMS OTP first ─────────────────────────────────
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send-otp', phone: '+91' + phoneDigits }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        otpProviderRef.current = 'fast2sms'
        setOtpProvider('fast2sms')
        setOtpStep('sent')
        setOtpTimer(60)
        setTimeout(() => hiddenOtpRef.current?.focus(), 100)
        return
      }
      // 2Factor unavailable (no balance / API error) → fall through to Firebase
    } catch (e) {
      // network error → fall through to Firebase
    }

    // ── Fallback: Firebase phone auth ─────────────────────────────
    otpProviderRef.current = 'firebase'
    setOtpProvider('firebase')
    await sendFirebaseOtp()
  }

  // ── Auto-verify OTP ───────────────────────────────────────────────
  const autoVerifyOtp = async (otp) => {
    if (otpStepRef.current === 'verifying') return   // use ref — never stale
    setOtpStep('verifying'); setError('')

    const provider = otpProviderRef.current   // always-fresh — avoids stale closure

    // ── Fast2SMS path ─────────────────────────────────────────────
    if (provider === 'fast2sms') {
      try {
        const res = await fetch('/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'verify-otp', phone: '+91' + phoneDigits, otp }),
        })
        const data = await res.json()
        if (!res.ok || !data.success) {
          setError(data.error || 'Incorrect OTP. Please check and try again.')
          setOtpStep('sent')
          setOtpInput(['', '', '', '', '', ''])
          setTimeout(() => hiddenOtpRef.current?.focus(), 100)
          return
        }
        handleLoginSuccess(data)
      } catch (e) {
        setError('OTP verification failed. Please try again.')
        setOtpStep('sent')
        setOtpInput(['', '', '', '', '', ''])
        setTimeout(() => hiddenOtpRef.current?.focus(), 100)
      }
      return
    }

    // ── Firebase path ─────────────────────────────────────────────
    if (!confirmationResultRef.current) {
      setError('Request an OTP first — tap Send OTP.')
      setOtpStep('sent')
      return
    }
    try {
      const result = await confirmationResultRef.current.confirm(otp)
      const idToken = await result.user.getIdToken()
      firebaseTokenRef.current = idToken
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login-otp', phone: '+91' + phoneDigits, firebaseToken: idToken }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Login failed. Please try again.')
        setOtpStep('sent')
        setOtpInput(['', '', '', '', '', ''])
        setTimeout(() => hiddenOtpRef.current?.focus(), 100)
        return
      }
      if (!data.user) {
        setError('Login failed. Please try again.')
        setOtpStep('sent'); setOtpInput(['','','','','',''])
        return
      }
      handleLoginSuccess(data)
    } catch (e) {
      const msg = e.code === 'auth/invalid-verification-code' ? 'Incorrect OTP. Please check and try again.'
        : e.code === 'auth/code-expired' ? 'OTP expired. Please resend.'
        : 'OTP verification failed. Please try again.'
      setError(msg)
      setOtpStep('sent')
      setOtpInput(['', '', '', '', '', ''])
      setTimeout(() => hiddenOtpRef.current?.focus(), 100)
    }
  }

  // ── New User: Save name + address then redirect ──────────────────
  const saveNewUserInfo = async () => {
    if (!newUserName.trim()) { nameInputRef.current?.focus(); return }
    setNewUserSaving(true)
    try {
      await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newUserName.trim(),
          address: newUserAddress.trim() || undefined,
        }),
      })
    } catch(e) { /* non-fatal */ }
    setNewUserSaving(false)
    const u = pendingUserRef.current
    const dest = u?.role === 'admin' ? '/admin' : u?.role === 'delivery' ? '/delivery' : '/menu'
    window.location.href = dest  // hard redirect — avoids any React state issues after new user save
  }

  // ── Password Login ───────────────────────────────────────────────
  const handlePasswordLogin = async (e) => {
    e.preventDefault()
    if (!phoneReady) { setError('Please enter a valid 10-digit mobile number'); return }
    if (!password) { setError('Please enter your password'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'login', role: 'customer',
          identifier: '+91' + phoneDigits,
          phone: '+91' + phoneDigits,
          password,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Login failed. Please check your password.'); return }
      const { user } = data
      if (rememberMe) { try { localStorage.setItem('ck_saved_phone', phoneDigits) } catch(e) {} }
      else { try { localStorage.removeItem('ck_saved_phone') } catch(e) {} }
      if (user.role === 'admin') router.push(user.branch_id ? '/branch' : '/admin')
      else if (user.role === 'delivery') router.push('/delivery')
      else router.push('/menu')
    } catch { setError('Something went wrong. Please try again.') }
    finally { setLoading(false) }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0f0500', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', position: 'relative' }}>
    <div style={{ width: '100%', maxWidth: 480, minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative', boxShadow: '0 0 80px rgba(0,0,0,0.6)' }}>

      {/* ── New User Welcome Modal ── */}
      {showNameModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 99998,
          background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        }}>
          <div style={{
            background: '#fff', borderRadius: '24px 24px 0 0',
            width: '100%', maxWidth: 480, padding: '28px 24px 44px',
            animation: 'slideUpSheet 0.38s cubic-bezier(0.34,1.1,0.64,1)',
            boxShadow: '0 -8px 48px rgba(0,0,0,0.18)',
          }}>
            <div style={{ width: 40, height: 4, background: '#e5e7eb', borderRadius: 4, margin: '0 auto 22px' }} />
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 44, marginBottom: 8 }}>👋</div>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1a1a1a', margin: '0 0 6px' }}>Welcome to FoodFi!</h2>
              <p style={{ fontSize: 13, color: '#6b7280', margin: 0, lineHeight: 1.5 }}>Just add your name and address to start ordering!</p>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>
                Aapka Naam <span style={{ color: '#e85d04' }}>*</span>
              </label>
              <input
                ref={nameInputRef}
                type="text"
                value={newUserName}
                onChange={e => setNewUserName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveNewUserInfo()}
                placeholder="Jaise: Rahul Kumar"
                autoComplete="name"
                style={{
                  width: '100%', padding: '13px 14px', border: '1.5px solid',
                  borderColor: newUserName.trim() ? '#e85d04' : '#e5e7eb',
                  borderRadius: 12, fontSize: 15, fontWeight: 500,
                  outline: 'none', boxSizing: 'border-box',
                  background: newUserName.trim() ? '#fff7ed' : '#fff',
                  transition: 'all 0.15s',
                }}
              />
            </div>
            <div style={{ marginBottom: 22 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>
                Delivery Address
                <span style={{ fontSize: 11, fontWeight: 500, color: '#9ca3af', marginLeft: 6 }}>(optional)</span>
              </label>
              <div style={{ position: 'relative' }}>
                <textarea
                  value={newUserAddress}
                  onChange={e => setNewUserAddress(e.target.value)}
                  placeholder="Ghar / office ka address..."
                  rows={2}
                  style={{
                    width: '100%', padding: '12px 14px', paddingRight: 130,
                    border: '1.5px solid', borderColor: newUserAddress ? '#16a34a' : '#e5e7eb',
                    borderRadius: 12, fontSize: 13, outline: 'none',
                    boxSizing: 'border-box', resize: 'none', lineHeight: 1.5,
                    background: newUserAddress ? '#f0fdf4' : '#fff',
                    transition: 'all 0.15s',
                  }}
                />
                <button type="button" onClick={fetchLocation} disabled={locationLoading}
                  style={{
                    position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                    background: locationLoading ? '#f1f5f9' : 'linear-gradient(135deg,#16a34a,#22c55e)',
                    color: locationLoading ? '#94a3b8' : '#fff',
                    border: 'none', borderRadius: 8, padding: '7px 10px',
                    fontSize: 11, fontWeight: 700, cursor: locationLoading ? 'not-allowed' : 'pointer',
                    whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4,
                  }}>
                  {locationLoading ? <><span style={{ fontSize: 13 }}>⏳</span> Dhundh raha...</> : <><span style={{ fontSize: 13 }}>📍</span> GPS se lo</>}
                </button>
              </div>
              {newUserAddress && (
                <div style={{ marginTop: 6, fontSize: 11, color: '#16a34a', fontWeight: 600 }}>✅ Address found — you can edit it too</div>
              )}
            </div>
            <button type="button" onClick={saveNewUserInfo} disabled={!newUserName.trim() || newUserSaving}
              style={{
                width: '100%', padding: '15px',
                background: newUserName.trim() ? 'linear-gradient(135deg, #e85d04, #f97316)' : '#e5e7eb',
                color: newUserName.trim() ? '#fff' : '#9ca3af',
                border: 'none', borderRadius: 14, fontSize: 16, fontWeight: 800,
                cursor: newUserName.trim() ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                boxShadow: newUserName.trim() ? '0 4px 20px rgba(232,93,4,0.35)' : 'none',
                transition: 'all 0.2s',
              }}>
              {newUserSaving
                ? <><span className="spinner" /> Saving…</>
                : <>Let&apos;s go! 🍛</>}
            </button>
            {!newUserName.trim() && (
              <p style={{ textAlign: 'center', fontSize: 12, color: '#9ca3af', marginTop: 10 }}>Name is required — you can add your address later</p>
            )}
          </div>
        </div>
      )}

      {/* Invisible reCAPTCHA container */}
      <div id="recaptcha-container" />

      {/* ══════════════════════════════════════════════════════════
          HERO SECTION
      ══════════════════════════════════════════════════════════ */}
      <div style={{
        flex: '0 0 auto',
        minHeight: '44vh',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px 36px',
        overflow: 'hidden',
      }}>

        {/* Radial glow */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse 80% 60% at 50% 60%, rgba(232,93,4,0.18) 0%, transparent 70%)',
        }} />

        {/* Floating food emojis */}
        {FOOD_EMOJIS.map((em, i) => (
          <div key={i} style={{
            position: 'absolute',
            left: `${(i * 23 + 3) % 90}%`,
            top: `${(i * 31 + 5) % 82}%`,
            fontSize: `${16 + (i % 4) * 7}px`,
            opacity: 0.10 + (i % 3) * 0.04,
            userSelect: 'none', pointerEvents: 'none',
            transform: `rotate(${(i * 17) % 30 - 15}deg)`,
          }}>{em}</div>
        ))}

        {/* Skip button */}
        <button
          onClick={() => router.push('/menu?guest=true')}
          style={{
            position: 'absolute', top: 16, right: 16,
            background: 'rgba(255,255,255,0.12)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.2)',
            color: 'rgba(255,255,255,0.85)', borderRadius: 20,
            padding: '7px 18px', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', letterSpacing: 0.3,
            transition: 'all 0.2s',
          }}>
          Skip
        </button>

        {/* Logo + Brand */}
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
          <div style={{ marginBottom: 14, display: 'inline-block' }}>
            <FoodFiLogo size={70} style={{
              borderRadius: 20,
              boxShadow: '0 0 0 3px rgba(232,93,4,0.3), 0 8px 32px rgba(232,93,4,0.45)',
              display: 'block',
            }} />
          </div>

          <h1 style={{
            fontSize: 36, fontWeight: 900, letterSpacing: '-0.5px',
            color: '#fff', margin: '0 0 10px', lineHeight: 1.1,
          }}>
            <span style={{ color: '#e85d04' }}>Food</span>Fi
            <span style={{
              display: 'inline-block', marginLeft: 10, fontSize: 11,
              background: 'linear-gradient(135deg, #e85d04, #f97316)',
              color: '#fff', borderRadius: 6, padding: '3px 8px',
              fontWeight: 700, letterSpacing: 1, verticalAlign: 'middle',
            }}>CLOUD KITCHEN</span>
          </h1>

          <p style={{
            fontSize: 15, color: 'rgba(255,255,255,0.78)',
            margin: '0 0 18px', fontWeight: 500, lineHeight: 1.5,
          }}>
            Homestyle taste, delivered to your door 🍛
          </p>

          {/* Social proof pills */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            <div style={{
              background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 20, padding: '6px 14px',
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
              <span style={{ fontSize: 13 }}>⭐</span>
              <span style={{ fontSize: 12, color: '#fbbf24', fontWeight: 700 }}>4.8 Rating</span>
            </div>
            <div style={{
              background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 20, padding: '6px 14px',
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
              <span style={{ fontSize: 13 }}>📦</span>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>1000+ Orders</span>
            </div>
            <div style={{
              background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 20, padding: '6px 14px',
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
              <span style={{ fontSize: 13 }}>⚡</span>
              <span style={{ fontSize: 12, color: '#86efac', fontWeight: 600 }}>30 Min Delivery</span>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          BOTTOM SHEET
      ══════════════════════════════════════════════════════════ */}
      <div style={{
        flex: 1, background: '#fff', borderRadius: '24px 24px 0 0',
        boxShadow: '0 -12px 48px rgba(0,0,0,0.3)',
        overflow: 'hidden', position: 'relative',
      }}>

        {/* ════ OTP SCREEN (Zomato-style new page) ════ */}
        {tab === 'otp' && otpStep !== 'idle' && (
          <div style={{
            position: 'absolute', inset: 0, background: '#fff',
            display: 'flex', flexDirection: 'column',
            padding: '0 0 32px', overflowY: 'auto',
            animation: 'slideInRight 0.28s cubic-bezier(0.25,0.46,0.45,0.94)',
          }}>
            {/* Top bar with back button */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '20px 20px 0',
              borderBottom: '1px solid #f3f4f6', paddingBottom: 16,
            }}>
              <button
                onClick={() => { setOtpStep('idle'); setOtpInput(['','','','','','']); setError(''); cleanupFirebase() }}
                style={{
                  background: '#f9fafb', border: 'none', borderRadius: 10,
                  width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', fontSize: 18, color: '#374151',
                  flexShrink: 0,
                }}>
                ←
              </button>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#111827' }}>Verify OTP</div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 1 }}>+91 {phoneDigits}</div>
              </div>
            </div>

            {/* OTP Content */}
            <div style={{ padding: '32px 24px 0', flex: 1 }}>

              {/* Sending state */}
              {otpStep === 'sending' && (
                <div style={{ textAlign: 'center', paddingTop: 40 }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>📲</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontSize: 15, color: '#6b7280' }}>
                    <span className="spinner" /> Sending OTP…
                  </div>
                </div>
              )}

              {/* Sent / Verifying state */}
              {(otpStep === 'sent' || otpStep === 'verifying') && (
                <>
                  <p style={{ fontSize: 14, color: '#374151', margin: '0 0 6px', fontWeight: 600, textAlign: 'center' }}>
                    OTP sent 📲
                  </p>
                  <p style={{ fontSize: 13, color: '#9ca3af', margin: '0 0 32px', textAlign: 'center', lineHeight: 1.5 }}>
                    Enter the <strong style={{ color: '#e85d04' }}>6-digit OTP</strong><br/>
                    from the SMS sent to +91 {phoneDigits} — it verifies automatically ✨
                  </p>

                  {/* OTP Boxes — hidden real input + visual divs (most reliable auto-fill) */}
                  <div
                    style={{ position: 'relative', display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 28 }}
                    onClick={() => hiddenOtpRef.current?.focus()}
                  >
                    {/* Hidden single input — receives ALL auto-fill (Web OTP, keyboard chip, paste) */}
                    <input
                      ref={hiddenOtpRef}
                      type="tel"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      value={otpInput.join('')}
                      disabled={otpStep === 'verifying'}
                      onChange={e => {
                        const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 6)
                        const arr = Array(6).fill('').map((_, i) => val[i] || '')
                        setOtpInput(arr)
                        if (val.length === 6) autoVerifyOtp(val)
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Backspace') {
                          const cur = otpInput.join('')
                          const nxt = cur.slice(0, -1)
                          setOtpInput(Array(6).fill('').map((_, i) => nxt[i] || ''))
                        }
                      }}
                      onPaste={e => {
                        const pasted = e.clipboardData.getData('text').replace(/[^0-9]/g, '').slice(0, 6)
                        if (pasted.length > 0) {
                          const arr = Array(6).fill('').map((_, i) => pasted[i] || '')
                          setOtpInput(arr)
                          if (pasted.length === 6) autoVerifyOtp(pasted)
                        }
                        e.preventDefault()
                      }}
                      style={{
                        position: 'absolute', inset: 0,
                        width: '100%', height: '100%',
                        opacity: 0, zIndex: 10,
                        cursor: 'text', border: 'none',
                        background: 'transparent',
                      }}
                    />

                    {/* Visual digit boxes (divs) */}
                    {otpInput.map((digit, i) => {
                      const filledCount = otpInput.filter(d => d).length
                      const isCursor = i === filledCount && otpStep !== 'verifying'
                      return (
                        <div key={i} style={{
                          width: 46, height: 58,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 24, fontWeight: 800, color: '#1f2937',
                          border: digit ? '2.5px solid #f97316' : isCursor ? '2px solid #f97316' : '2px solid #e5e7eb',
                          borderRadius: 12, userSelect: 'none',
                          background: otpStep === 'verifying' ? '#f9fafb' : digit ? '#fff7ed' : '#fff',
                          boxShadow: digit ? '0 0 0 4px rgba(249,115,22,0.12)' : isCursor ? '0 0 0 3px rgba(249,115,22,0.18)' : 'none',
                          opacity: otpStep === 'verifying' ? 0.7 : 1,
                          transition: 'all 0.15s',
                          position: 'relative', overflow: 'hidden',
                        }}>
                          {digit || (isCursor
                            ? <span style={{ width: 2, height: 26, background: '#f97316', borderRadius: 2, animation: 'otpBlink 1s step-end infinite', display: 'block' }} />
                            : ''
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* Verifying indicator */}
                  {otpStep === 'verifying' && (
                    <div style={{ textAlign: 'center', marginBottom: 20 }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 20, padding: '8px 18px' }}>
                        <span className="spinner" />
                        <span style={{ fontSize: 13, color: '#92400e', fontWeight: 600 }}>Verifying…</span>
                      </div>
                    </div>
                  )}

                  {/* Error */}
                  {error && <div className={styles.error} style={{ marginBottom: 16 }}>{error}</div>}

                  {/* Resend */}
                  <div style={{ textAlign: 'center', marginTop: 8 }}>
                    {otpTimer > 0 ? (
                      <span style={{ fontSize: 13, color: '#9ca3af' }}>
                        Resend OTP in <strong style={{ color: '#374151' }}>{otpTimer}s</strong>
                      </span>
                    ) : (
                      <button type="button" onClick={sendOtp}
                        style={{ fontSize: 14, color: '#e85d04', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
                        🔄 Resend OTP
                      </button>
                    )}
                  </div>

                  {/* Change number link */}
                  <div style={{ textAlign: 'center', marginTop: 16 }}>
                    <button type="button"
                      onClick={() => { setOtpStep('idle'); setOtpInput(['','','','','','']); setError(''); cleanupFirebase() }}
                      style={{ fontSize: 13, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                      Change number?
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ════ MAIN FORM (phone entry + tabs) ════ */}
        <div style={{ padding: '22px 20px 32px', overflowY: 'auto', height: '100%' }}>
          {/* Handle bar */}
          <div style={{ width: 40, height: 4, background: '#e5e7eb', borderRadius: 4, margin: '0 auto 20px' }} />

          <h2 style={{ fontSize: 17, fontWeight: 800, color: '#111827', margin: '0 0 20px', textAlign: 'center' }}>
            Log in or Sign up
          </h2>

          {/* Phone Number */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>
                Mobile Number
              </label>
              {savedPhone && phone !== savedPhone && (
                <button type="button"
                  onClick={() => { setPhone(savedPhone); setRememberMe(true) }}
                  style={{
                    fontSize: 11, color: '#e85d04', background: '#fff7ed',
                    border: '1px solid #fed7aa', borderRadius: 6,
                    padding: '2px 8px', cursor: 'pointer', fontWeight: 700,
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}>
                  📱 +91 {savedPhone}
                </button>
              )}
              {savedPhone && phone === savedPhone && (
                <button type="button"
                  onClick={() => { try { localStorage.removeItem('ck_saved_phone') } catch(e) {} setSavedPhone(''); setRememberMe(false) }}
                  style={{
                    fontSize: 11, color: '#6b7280', background: 'none',
                    border: 'none', cursor: 'pointer', textDecoration: 'underline',
                  }}>
                  Remove saved
                </button>
              )}
            </div>
            <div style={{ display: 'flex' }}>
              <span style={{
                padding: '12px 14px', background: '#f9fafb',
                border: '1.5px solid #e5e7eb', borderRight: 'none',
                borderRadius: '10px 0 0 10px', fontSize: 14, color: '#374151',
                fontWeight: 600, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6,
              }}>🇮🇳 +91</span>
              <input
                type="text" inputMode="numeric" maxLength={10}
                value={phone}
                onChange={e => setPhone(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
                placeholder="10 digit mobile number"
                autoComplete="tel"
                style={{
                  flex: 1, padding: '12px 14px',
                  border: '1.5px solid #e5e7eb', borderLeft: 'none',
                  borderRadius: '0 10px 10px 0', fontSize: 16, fontWeight: 500,
                  outline: 'none',
                  background: phoneReady ? '#fff7ed' : '#fff',
                  transition: 'background 0.2s',
                }}
              />
            </div>
          </div>

          {/* Tab Toggle */}
          {phoneReady && (
            <div style={{ display: 'flex', marginBottom: 18, background: '#f3f4f6', borderRadius: 10, padding: 4, gap: 4 }}>
              <button type="button" onClick={() => setTab('password')}
                style={{
                  flex: 1, padding: '9px', fontSize: 13, fontWeight: 700, border: 'none',
                  cursor: 'pointer', transition: 'all 0.18s', borderRadius: 8,
                  background: tab === 'password' ? '#e85d04' : 'transparent',
                  color: tab === 'password' ? '#fff' : '#6b7280',
                  boxShadow: tab === 'password' ? '0 2px 8px rgba(232,93,4,0.35)' : 'none',
                }}>🔑 Password</button>
              <button type="button" onClick={() => setTab('otp')}
                style={{
                  flex: 1, padding: '9px', fontSize: 13, fontWeight: 700, border: 'none',
                  cursor: 'pointer', transition: 'all 0.18s', borderRadius: 8,
                  background: tab === 'otp' ? '#e85d04' : 'transparent',
                  color: tab === 'otp' ? '#fff' : '#6b7280',
                  boxShadow: tab === 'otp' ? '0 2px 8px rgba(232,93,4,0.35)' : 'none',
                }}>📱 OTP</button>
            </div>
          )}

          {/* ── OTP TAB — Continue button ── */}
          {tab === 'otp' && (
            <div>
              {!phoneReady && (
                <div style={{ textAlign: 'center', padding: '10px 0 6px', fontSize: 13, color: '#9ca3af' }}>
                  👆 Enter your mobile number above
                </div>
              )}
              {phoneReady && (
                <>
                  {/* Remember me checkbox */}
                  <label style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    marginBottom: 14, cursor: 'pointer', userSelect: 'none',
                    padding: '10px 12px',
                    background: rememberMe ? '#fff7ed' : '#f9fafb',
                    border: `1.5px solid ${rememberMe ? '#fed7aa' : '#e5e7eb'}`,
                    borderRadius: 10, transition: 'all 0.18s',
                  }}>
                    <div
                      onClick={() => setRememberMe(r => !r)}
                      style={{
                        width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                        background: rememberMe ? '#e85d04' : '#fff',
                        border: `2px solid ${rememberMe ? '#e85d04' : '#d1d5db'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.18s',
                      }}>
                      {rememberMe && <span style={{ color: '#fff', fontSize: 13, lineHeight: 1 }}>✓</span>}
                    </div>
                    <div onClick={() => setRememberMe(r => !r)} style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: rememberMe ? '#92400e' : '#374151' }}>
                        📱 Remember this number
                      </div>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>
                        Faster sign-in next time — your number auto-fills
                      </div>
                    </div>
                    {savedPhone && savedPhone === phoneDigits && (
                      <span style={{
                        fontSize: 10, fontWeight: 700, color: '#16a34a',
                        background: '#f0fdf4', border: '1px solid #bbf7d0',
                        borderRadius: 6, padding: '2px 7px',
                      }}>Saved ✓</span>
                    )}
                  </label>

                  <button type="button" onClick={sendOtp}
                    style={{
                      width: '100%', padding: '15px', marginBottom: 14,
                      background: 'linear-gradient(135deg, #e85d04, #f97316)',
                      color: '#fff', fontSize: 16, fontWeight: 800, border: 'none',
                      borderRadius: 12, cursor: 'pointer',
                      boxShadow: '0 4px 20px rgba(232,93,4,0.4)',
                      letterSpacing: 0.3,
                    }}>
                    Continue →
                  </button>
                </>
              )}
              {error && <div className={styles.error}>{error}</div>}
            </div>
          )}

          {/* ── PASSWORD TAB ── */}
          {tab === 'password' && (
            <form onSubmit={handlePasswordLogin}>
              {!phoneReady && (
                <div style={{ textAlign: 'center', padding: '10px 0 6px', fontSize: 13, color: '#9ca3af' }}>
                  👆 Enter your mobile number above
                </div>
              )}
              {phoneReady && (
                <>
                  <div className="field" style={{ marginBottom: 8 }}>
                    <label style={{ fontWeight: 700, color: '#374151', fontSize: 12 }}>Password</label>
                    <input type="password" required value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••" minLength={6} autoComplete="current-password"
                      style={{ borderRadius: 10, padding: '12px 14px', fontSize: 15 }}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', userSelect: 'none' }}>
                      <div
                        onClick={() => setRememberMe(r => !r)}
                        style={{
                          width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                          background: rememberMe ? '#e85d04' : '#fff',
                          border: `2px solid ${rememberMe ? '#e85d04' : '#d1d5db'}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 0.18s',
                        }}>
                        {rememberMe && <span style={{ color: '#fff', fontSize: 11, lineHeight: 1 }}>✓</span>}
                      </div>
                      <span onClick={() => setRememberMe(r => !r)} style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>Remember me</span>
                    </label>
                    <button type="button" onClick={() => router.push('/forgot-password')}
                      style={{ background: 'none', border: 'none', color: '#e85d04', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
                      Forgot Password?
                    </button>
                  </div>
                  {error && <div className={styles.error}>{error}</div>}
                  <button type="submit" disabled={loading}
                    style={{
                      width: '100%', padding: '15px',
                      background: loading ? '#f9a87a' : 'linear-gradient(135deg, #e85d04, #f97316)',
                      color: '#fff', fontSize: 16, fontWeight: 800, border: 'none',
                      borderRadius: 12, cursor: loading ? 'not-allowed' : 'pointer',
                      boxShadow: '0 4px 20px rgba(232,93,4,0.4)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    }}>
                    {loading ? <><span className="spinner" /> Logging in...</> : 'Login →'}
                  </button>
                </>
              )}
            </form>
          )}

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '20px 0 16px' }}>
            <div style={{ flex: 1, height: 1, background: '#f3f4f6' }} />
            <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 500 }}>or</span>
            <div style={{ flex: 1, height: 1, background: '#f3f4f6' }} />
          </div>

          {/* Guest Button */}
          <button type="button" onClick={() => router.push('/menu?guest=true')}
            style={{
              width: '100%', padding: '13px', fontSize: 14, fontWeight: 700,
              background: 'transparent', color: '#6b7280',
              border: '1.5px dashed #d1d5db', borderRadius: 10, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'all 0.2s',
            }}
            onMouseOver={e => { e.currentTarget.style.borderColor = '#e85d04'; e.currentTarget.style.color = '#e85d04'; e.currentTarget.style.background = '#fff7ed' }}
            onMouseOut={e => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.color = '#6b7280'; e.currentTarget.style.background = 'transparent' }}>
            👀 Browse as a guest
          </button>
          <p style={{ margin: '6px 0 0', fontSize: 11, color: '#9ca3af', textAlign: 'center' }}>
            Browse the menu without logging in — you&apos;ll add your name + address at checkout
          </p>

          {/* Footer */}
          <div style={{ borderTop: '1px solid #f3f4f6', marginTop: 18, paddingTop: 14 }}>
            <p style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center', margin: '0 0 10px' }}>
              Admins and delivery partners can also log in here
            </p>
            <div style={{ textAlign: 'center' }}>
              <button onClick={() => router.push('/delivery/apply')}
                style={{ background: 'none', border: '1.5px solid #e85d04', color: '#e85d04', borderRadius: 8, padding: '8px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                🛵 Apply as a Delivery Partner
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
    </div>
  )
}

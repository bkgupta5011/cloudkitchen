'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import styles from './login.module.css'
import FoodFiLogo from '../components/FoodFiLogo'

// Auto-detect for LOGIN only: email if @ or letters, phone if digits
function detectType(val) {
  if (!val) return 'unknown'
  if (val.includes('@') || /[a-zA-Z]/.test(val)) return 'email'
  if (/^[0-9\s\-\+]+$/.test(val)) return 'phone'
  return 'unknown'
}

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // ── LOGIN: single auto-detect field ──
  const [identifier, setIdentifier] = useState('')
  const loginType = detectType(identifier)

  // ── SIGNUP: separate fields ──
  const [form, setForm] = useState({ name:'', email:'', phone:'', password:'', address:'' })
  const [locationLoading, setLocationLoading] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // OTP states (used in signup for phone verification)
  const [otpStep, setOtpStep] = useState('idle') // idle|sending|sent|verifying|verified|failed
  const [otpInput, setOtpInput] = useState(['','','','','',''])
  const [otpTimer, setOtpTimer] = useState(0)
  const timerRef = useRef(null)
  const otpBoxRefs = useRef([])

  // Firebase refs
  const recaptchaVerifierRef = useRef(null)
  const confirmationResultRef = useRef(null)
  const firebaseTokenRef = useRef(null)

  // Derived
  const signupPhoneDigits = form.phone.replace(/[^0-9]/g, '')
  const signupPhoneReady = signupPhoneDigits.length === 10
  const loginPhoneDigits = identifier.replace(/[^0-9]/g, '')
  const otpString = otpInput.join('')

  useEffect(() => {
    fetch('/api/auth', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'me' }) })
      .then(r => r.json())
      .then(({ user }) => {
        if (user?.role === 'admin') router.push('/admin')
        else if (user?.role === 'delivery') router.push('/delivery')
        else if (user?.role === 'customer') router.push('/menu')
      })
  }, [])

  // Countdown timer
  useEffect(() => {
    if (otpTimer > 0) {
      timerRef.current = setTimeout(() => setOtpTimer(t => t - 1), 1000)
    }
    return () => clearTimeout(timerRef.current)
  }, [otpTimer])

  // Reset OTP when switching mode
  useEffect(() => {
    setOtpStep('idle')
    setOtpInput(['','','','','',''])
    setOtpTimer(0)
    confirmationResultRef.current = null
    firebaseTokenRef.current = null
    if (recaptchaVerifierRef.current) {
      try { recaptchaVerifierRef.current.clear() } catch(e) {}
      recaptchaVerifierRef.current = null
    }
  }, [mode])

  // Reset OTP when login method changes to OTP (fresh state)
  useEffect(() => {
    if (loginMethod === 'otp') {
      setOtpStep('idle')
      setOtpInput(['','','','','',''])
      setOtpTimer(0)
      confirmationResultRef.current = null
      if (recaptchaVerifierRef.current) {
        try { recaptchaVerifierRef.current.clear() } catch(e) {}
        recaptchaVerifierRef.current = null
      }
    }
  }, [loginMethod])

  // ── GPS Location Fetch (Google Maps Geocoding API) ──────────────
  const fetchLocation = () => {
    if (!navigator.geolocation) { setError('Aapka browser GPS support nahi karta'); return }
    setLocationLoading(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords
          const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY
          const res = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${key}&language=en`
          )
          const data = await res.json()

          if (data.status !== 'OK' || !data.results?.length) {
            setError('Address nahi mili. Manually bharo.')
            setLocationLoading(false)
            return
          }

          // Pick most detailed result — prefer street_address, then premise, else first
          const best =
            data.results.find(r => r.types.includes('street_address')) ||
            data.results.find(r => r.types.includes('premise'))        ||
            data.results[0]

          // Map address_components by type
          const comp = {}
          best.address_components.forEach(c => {
            c.types.forEach(t => { if (!comp[t]) comp[t] = c.long_name })
          })

          // Build detailed structured address
          const houseRoad = [comp.street_number, comp.route].filter(Boolean).join(' ')
          const parts = [
            houseRoad,
            comp.sublocality_level_2,
            comp.sublocality_level_1 || comp.sublocality,
            comp.neighborhood,
            comp.locality || comp.administrative_area_level_2,
            comp.administrative_area_level_1,
            comp.postal_code,
          ].filter(Boolean)

          const address = parts.length >= 3
            ? parts.join(', ')
            : best.formatted_address.replace(/, India$/, '').replace(/, भारत$/, '')

          set('address', address)
        } catch (e) {
          console.error('Geocoding error:', e)
          setError('Location address fetch nahi ho saka. Manually bharo.')
        } finally { setLocationLoading(false) }
      },
      (err) => {
        setLocationLoading(false)
        if (err.code === 1) setError('Location permission denied. Browser settings se allow karein.')
        else if (err.code === 2) setError('GPS signal nahi mila. Dobara try karo.')
        else setError('Location timeout. Manually address bharo.')
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  }

  // ── 6 OTP Boxes ────────────────────────────────────────────────
  const handleOtpBox = (index, val) => {
    if (!/^[0-9]?$/.test(val)) return
    const next = [...otpInput]
    next[index] = val
    setOtpInput(next)
    if (val && index < 5) otpBoxRefs.current[index + 1]?.focus()
  }
  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpInput[index] && index > 0) otpBoxRefs.current[index - 1]?.focus()
    if (e.key === 'Enter' && otpString.length === 6) verifyOtp()
  }
  const handleOtpPaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/[^0-9]/g, '').slice(0, 6)
    if (pasted.length === 6) { setOtpInput(pasted.split('')); otpBoxRefs.current[5]?.focus() }
    e.preventDefault()
  }

  // ── Firebase RecaptchaVerifier ──────────────────────────────────
  const getRecaptchaVerifier = async () => {
    const { getFirebaseAuth } = await import('@/lib/firebase-client')
    const { RecaptchaVerifier } = await import('firebase/auth')
    const auth = getFirebaseAuth()
    if (!auth) throw new Error('Firebase auth init failed')
    if (recaptchaVerifierRef.current) {
      try { recaptchaVerifierRef.current.clear() } catch(e) {}
      recaptchaVerifierRef.current = null
    }
    const verifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
      size: 'invisible', callback: () => {},
      'expired-callback': () => {
        if (recaptchaVerifierRef.current) {
          try { recaptchaVerifierRef.current.clear() } catch(e) {}
          recaptchaVerifierRef.current = null
        }
      }
    })
    recaptchaVerifierRef.current = verifier
    return { auth, verifier }
  }

  // ── Send OTP (signup phone) ─────────────────────────────────────
  const sendOtp = async () => {
    if (!signupPhoneReady) { setError('Valid 10-digit phone number do'); return }
    setError(''); setOtpStep('sending')
    setOtpInput(['','','','','',''])
    try {
      const { signInWithPhoneNumber } = await import('firebase/auth')
      const { auth, verifier } = await getRecaptchaVerifier()
      const confirmationResult = await signInWithPhoneNumber(auth, '+91' + signupPhoneDigits, verifier)
      confirmationResultRef.current = confirmationResult
      setOtpStep('sent')
      setOtpTimer(60)
      setTimeout(() => otpBoxRefs.current[0]?.focus(), 100)
    } catch (e) {
      console.error('Firebase OTP send error:', e)
      setOtpStep('failed')
      setError('')
    }
  }

  // ── Verify OTP ─────────────────────────────────────────────────
  const verifyOtp = async () => {
    if (otpString.length !== 6) { setError('6-digit OTP enter karo'); return }
    if (!confirmationResultRef.current) { setError('Pehle OTP bhejo'); return }
    setError(''); setOtpStep('verifying')
    try {
      const result = await confirmationResultRef.current.confirm(otpString)
      const idToken = await result.user.getIdToken()
      firebaseTokenRef.current = idToken
      setOtpStep('verified')
      // If login mode — auto-login immediately after verify
      if (mode === 'login' && loginMethod === 'otp') {
        setLoading(true)
        try {
          const res = await fetch('/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'login-otp', phone: '+91' + loginPhoneDigits, firebaseToken: idToken })
          })
          const data = await res.json()
          if (!res.ok) { setError(data.error || 'Login nahi hua. Dobara try karo.'); setOtpStep('idle'); return }
          const { user } = data
          if (user.role === 'admin') router.push('/admin')
          else if (user.role === 'delivery') router.push('/delivery')
          else router.push('/menu')
        } catch { setError('Kuch gadbad ho gayi. Dobara try karo.'); setOtpStep('idle') }
        finally { setLoading(false) }
      }
    } catch (e) {
      const msg = e.code === 'auth/invalid-verification-code' ? 'Galat OTP. Dobara check karo.'
        : e.code === 'auth/code-expired' ? 'OTP expire ho gaya. Dobara bhejo.'
        : 'OTP verify nahi hua. Dobara try karo.'
      setError(msg); setOtpStep('sent')
    }
  }

  // ── Final Submit ────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (mode === 'signup') {
      if (!form.email) { setError('Email address required hai'); return }
      if (!signupPhoneReady) { setError('Valid 10-digit phone number required hai'); return }
      if (otpStep === 'idle') { await sendOtp(); return }
      if (otpStep === 'sent') { setError('Pehle phone OTP verify karo 👇'); return }
    }

    // OTP Login validation
    if (mode === 'login' && loginType === 'phone' && loginMethod === 'otp') {
      if (loginPhoneDigits.length !== 10) { setError('Valid 10-digit phone number do'); return }
      if (otpStep === 'idle' || otpStep === 'failed') { await sendLoginOtp(); return }
      if (otpStep === 'sending') return
      if (otpStep === 'sent') { setError('Pehle OTP verify karo 👇'); return }
      if (otpStep !== 'verified') return
      // verified — proceed to submit
    }

    setLoading(true)
    try {
      let payload

      if (mode === 'signup') {
        payload = {
          action: 'signup', role: 'customer', password: form.password,
          name: form.name, address: form.address,
          email: form.email, phone: '+91' + signupPhoneDigits,
          identifier: form.email,
          phoneVerified: otpStep === 'verified',
          firebaseToken: firebaseTokenRef.current || null,
        }
      } else if (mode === 'login' && loginType === 'phone' && loginMethod === 'otp') {
        // OTP Login — Firebase verified
        payload = {
          action: 'login-otp',
          phone: '+91' + loginPhoneDigits,
          firebaseToken: firebaseTokenRef.current,
        }
      } else {
        // Password Login (email or phone)
        const finalIdentifier = loginType === 'phone' ? '+91' + loginPhoneDigits : identifier
        payload = {
          action: 'login', role: 'customer', password: form.password,
          identifier: finalIdentifier,
          email: loginType === 'email' ? identifier : '',
          phone: loginType === 'phone' ? '+91' + loginPhoneDigits : '',
        }
      }

      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
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

  // ── Submit button label ─────────────────────────────────────────
  const submitLabel = () => {
    if (loading) return <span className="spinner" />
    if (mode === 'login') {
      if (loginType === 'phone' && loginMethod === 'otp') {
        if (otpStep === 'idle' || otpStep === 'failed') return '📲 OTP Bhejo'
        if (otpStep === 'sending') return <span className="spinner" />
        if (otpStep === 'sent' || otpStep === 'verifying') return '✓ OTP Verify Karo'
        if (otpStep === 'verified') return <><span className="spinner" /> Login ho raha hai...</>
      }
      return '🔑 Login'
    }
    if (otpStep === 'idle') return '📱 Phone Verify Karo'
    if (otpStep === 'sending') return <span className="spinner" />
    if (otpStep === 'failed') return '✅ Account Banao (bina OTP)'
    return '✅ Account Banao'
  }

  // ── Login method toggle (only for phone) ──────────────────────
  const [loginMethod, setLoginMethod] = useState('password') // 'password' | 'otp'

  // Reset login OTP when identifier changes
  useEffect(() => {
    if (loginType !== 'phone') setLoginMethod('password')
    setOtpStep('idle'); setOtpInput(['','','','','','']); setOtpTimer(0)
    confirmationResultRef.current = null; firebaseTokenRef.current = null
    if (recaptchaVerifierRef.current) {
      try { recaptchaVerifierRef.current.clear() } catch(e) {}
      recaptchaVerifierRef.current = null
    }
  }, [identifier])

  // ── Send OTP for LOGIN (phone) ─────────────────────────────────
  const sendLoginOtp = async () => {
    if (loginPhoneDigits.length !== 10) { setError('Valid 10-digit phone number do'); return }
    setError(''); setOtpStep('sending'); setOtpInput(['','','','','',''])

    // Always clean up previous verifier before creating a new one
    if (recaptchaVerifierRef.current) {
      try { recaptchaVerifierRef.current.clear() } catch(e) {}
      recaptchaVerifierRef.current = null
    }
    confirmationResultRef.current = null

    try {
      const { getFirebaseAuth } = await import('@/lib/firebase-client')
      const { RecaptchaVerifier, signInWithPhoneNumber } = await import('firebase/auth')
      const auth = getFirebaseAuth()
      if (!auth) throw new Error('Firebase auth init failed')

      const verifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
        callback: () => {},
        'expired-callback': () => {
          if (recaptchaVerifierRef.current) {
            try { recaptchaVerifierRef.current.clear() } catch(e) {}
            recaptchaVerifierRef.current = null
          }
        }
      })
      recaptchaVerifierRef.current = verifier

      const result = await signInWithPhoneNumber(auth, '+91' + loginPhoneDigits, verifier)
      confirmationResultRef.current = result
      setOtpStep('sent'); setOtpTimer(60)
      setTimeout(() => otpBoxRefs.current[0]?.focus(), 100)
    } catch (e) {
      console.error('Login OTP error:', e.code, e.message)
      if (recaptchaVerifierRef.current) {
        try { recaptchaVerifierRef.current.clear() } catch(err) {}
        recaptchaVerifierRef.current = null
      }
      setOtpStep('failed')
      const msg = e.code === 'auth/too-many-requests'
        ? 'Bahut zyada OTP requests ho gayi. 10-15 minute baad try karein.'
        : e.code === 'auth/invalid-phone-number'
        ? 'Phone number galat hai. 10-digit Indian number daalo.'
        : e.code === 'auth/captcha-check-failed'
        ? 'reCAPTCHA fail hua. Page refresh (F5) karke try karein.'
        : e.code === 'auth/network-request-failed'
        ? 'Network error. Internet check karein aur dobara try karein.'
        : `OTP nahi bheja ja saka (${e.code || e.message}). Page refresh karke try karein.`
      setError(msg)
    }
  }

  // ── LOGIN identifier prefix ─────────────────────────────────────
  const loginPrefix = loginType === 'phone'
    ? <span style={{ padding:'10px 12px', background:'#f3f4f6', border:'1.5px solid var(--bdr)', borderRight:'none', borderRadius:'8px 0 0 8px', fontSize:14, color:'#374151', fontWeight:600, whiteSpace:'nowrap', display:'flex', alignItems:'center' }}>🇮🇳 +91</span>
    : loginType === 'email'
    ? <span style={{ padding:'10px 12px', background:'#f3f4f6', border:'1.5px solid var(--bdr)', borderRight:'none', borderRadius:'8px 0 0 8px', fontSize:16, display:'flex', alignItems:'center' }}>📧</span>
    : <span style={{ padding:'10px 12px', background:'#f3f4f6', border:'1.5px solid var(--bdr)', borderRight:'none', borderRadius:'8px 0 0 8px', fontSize:13, color:'#9ca3af', display:'flex', alignItems:'center' }}>@/📱</span>

  return (
    <div className={styles.wrap}>
      <div id="recaptcha-container" />

      <div className={styles.card}>
        <div className={styles.logo}>
          <FoodFiLogo size={64} style={{ borderRadius: 16, boxShadow: '0 4px 20px rgba(232,93,4,0.3)', marginBottom: 10 }} />
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px', margin: '0 0 2px 0', lineHeight: 1.1 }}>
            <span style={{ color: '#e85d04' }}>Food</span><span style={{ color: '#1f2937' }}>Fi</span>
          </h1>
          <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px', margin: '0 0 4px 0', color: '#1e293b', lineHeight: 1.1 }}>
            Cloud Kitchen
          </h2>
          <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>Fresh food, delivered fast</p>
        </div>

        {/* Login / Sign Up tabs */}
        <div className={styles.modeToggle}>
          <button className={mode==='login'?styles.active:''} onClick={() => { setMode('login'); setError(''); setIdentifier('') }}>Login</button>
          <button className={mode==='signup'?styles.active:''} onClick={() => { setMode('signup'); setError(''); setIdentifier('') }}>Sign Up</button>
        </div>

        <form onSubmit={handleSubmit}>

          {/* ════════════════ SIGNUP FORM ════════════════ */}
          {mode === 'signup' && (
            <>
              {/* Full Name */}
              <div className="field">
                <label>Full Name</label>
                <input required value={form.name} onChange={e => set('name', e.target.value)} placeholder="Rahul Kumar" />
              </div>

              {/* Email */}
              <div className="field">
                <label>Email Address <span style={{ color:'#e85d04' }}>*</span></label>
                <div style={{ display:'flex' }}>
                  <span style={{ padding:'10px 12px', background:'#f3f4f6', border:'1.5px solid var(--bdr)', borderRight:'none', borderRadius:'8px 0 0 8px', fontSize:16, display:'flex', alignItems:'center' }}>📧</span>
                  <input
                    type="email" required
                    value={form.email} onChange={e => set('email', e.target.value)}
                    placeholder="you@email.com"
                    style={{ borderRadius:'0 8px 8px 0', borderLeft:'none', flex:1 }}
                    autoComplete="email"
                  />
                </div>
              </div>

              {/* Phone */}
              <div className="field">
                <label>Mobile Number <span style={{ color:'#e85d04' }}>*</span></label>
                <div style={{ display:'flex' }}>
                  <span style={{ padding:'10px 12px', background:'#f3f4f6', border:'1.5px solid var(--bdr)', borderRight:'none', borderRadius:'8px 0 0 8px', fontSize:14, color:'#374151', fontWeight:600, whiteSpace:'nowrap', display:'flex', alignItems:'center' }}>🇮🇳 +91</span>
                  <input
                    required
                    value={form.phone}
                    onChange={e => {
                      set('phone', e.target.value.replace(/[^0-9]/g, ''))
                      if (otpStep !== 'idle') { setOtpStep('idle'); setOtpInput(['','','','','','']); confirmationResultRef.current = null; firebaseTokenRef.current = null }
                    }}
                    placeholder="98765 43210"
                    maxLength={10}
                    inputMode="numeric"
                    disabled={otpStep === 'verified'}
                    style={{ borderRadius: otpStep === 'verified' ? '0' : '0 8px 8px 0', borderLeft:'none', flex:1 }}
                    autoComplete="tel"
                  />
                  {otpStep === 'verified' && (
                    <span style={{ padding:'10px 12px', background:'#dcfce7', border:'1.5px solid #86efac', borderLeft:'none', borderRadius:'0 8px 8px 0', fontSize:13, color:'#16a34a', fontWeight:700, whiteSpace:'nowrap' }}>
                      ✓ Verified
                    </span>
                  )}
                </div>

                {/* Send OTP button — appears when phone is ready and OTP not yet sent */}
                {signupPhoneReady && otpStep === 'idle' && (
                  <button type="button" onClick={sendOtp}
                    style={{ marginTop:8, width:'100%', padding:'9px', background:'#fff7ed', color:'#e85d04', border:'1.5px solid #fed7aa', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer' }}>
                    📲 OTP Bhejo — +91{signupPhoneDigits}
                  </button>
                )}
                {otpStep === 'sending' && (
                  <div style={{ marginTop:8, textAlign:'center', fontSize:13, color:'#9ca3af' }}>⏳ OTP bheja ja raha hai...</div>
                )}
              </div>

              {/* OTP Box */}
              {(otpStep === 'sent' || otpStep === 'verifying') && (
                <div style={{ background:'#fff7ed', border:'1.5px solid #fed7aa', borderRadius:12, padding:'16px', marginBottom:14 }}>
                  <p style={{ margin:'0 0 12px 0', fontSize:13, color:'#92400e', fontWeight:600, textAlign:'center' }}>
                    📲 OTP +91{signupPhoneDigits} pe bheja gaya
                  </p>
                  {/* 6 individual boxes */}
                  <div style={{ display:'flex', gap:8, justifyContent:'center', marginBottom:14 }} onPaste={handleOtpPaste}>
                    {otpInput.map((digit, i) => (
                      <input key={i}
                        ref={el => otpBoxRefs.current[i] = el}
                        type="text" inputMode="numeric" maxLength={1}
                        value={digit}
                        onChange={e => handleOtpBox(i, e.target.value)}
                        onKeyDown={e => handleOtpKeyDown(i, e)}
                        style={{
                          width:42, height:52, textAlign:'center', fontSize:22, fontWeight:700,
                          border: digit ? '2px solid #f97316' : '2px solid #e5e7eb',
                          borderRadius:10, outline:'none',
                          background: digit ? '#fff7ed' : '#fff',
                          color:'#1f2937', transition:'all 0.15s',
                          boxShadow: digit ? '0 0 0 3px rgba(249,115,22,0.1)' : 'none'
                        }}
                      />
                    ))}
                  </div>
                  {/* Verify button — below boxes */}
                  <button type="button" onClick={verifyOtp}
                    disabled={otpString.length !== 6 || otpStep === 'verifying'}
                    style={{
                      width:'100%', padding:'13px', fontSize:15, fontWeight:700, border:'none',
                      borderRadius:10, cursor: otpString.length === 6 ? 'pointer' : 'not-allowed',
                      background: otpString.length === 6 ? '#16a34a' : '#d1d5db',
                      color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                      transition:'background 0.2s',
                    }}>
                    {otpStep === 'verifying'
                      ? <><span className="spinner" /> Verify ho raha hai...</>
                      : <><span style={{ fontSize:18 }}>✓</span> OTP Verify Karo</>}
                  </button>
                  <div style={{ marginTop:10, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ fontSize:12, color:'#9ca3af' }}>OTP 5 min mein expire hoga</span>
                    {otpTimer > 0
                      ? <span style={{ fontSize:12, color:'#9ca3af' }}>Resend {otpTimer}s mein</span>
                      : <button type="button" onClick={sendOtp} style={{ fontSize:12, color:'#e85d04', background:'none', border:'none', cursor:'pointer', fontWeight:600 }}>🔄 Resend OTP</button>}
                  </div>
                </div>
              )}

              {/* OTP verified */}
              {otpStep === 'verified' && (
                <div style={{ background:'#f0fdf4', border:'1.5px solid #86efac', borderRadius:10, padding:'10px 14px', marginBottom:12, display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:20 }}>✅</span>
                  <span style={{ fontSize:13, color:'#16a34a', fontWeight:700 }}>Phone number verify ho gaya!</span>
                </div>
              )}
              {/* OTP failed */}
              {otpStep === 'failed' && (
                <div style={{ background:'#fef9c3', border:'1.5px solid #fde047', borderRadius:10, padding:'10px 14px', marginBottom:12 }}>
                  <p style={{ margin:'0 0 4px 0', fontSize:13, color:'#854d0e', fontWeight:600 }}>⚠️ OTP nahi bheja ja saka</p>
                  <p style={{ margin:0, fontSize:12, color:'#78350f' }}>Account ban jayega, phone baad mein verify kar sakte ho.</p>
                </div>
              )}

              {/* Delivery Address with GPS */}
              <div className="field">
                <label style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span>Default Delivery Address</span>
                  <button type="button" onClick={fetchLocation} disabled={locationLoading}
                    style={{
                      display:'flex', alignItems:'center', gap:4,
                      background: locationLoading ? '#f3f4f6' : '#fff7ed',
                      color: locationLoading ? '#9ca3af' : '#e85d04',
                      border:'1.5px solid', borderColor: locationLoading ? '#e5e7eb' : '#fed7aa',
                      borderRadius:6, padding:'3px 10px', fontSize:12, fontWeight:600,
                      cursor: locationLoading ? 'not-allowed' : 'pointer',
                    }}>
                    {locationLoading
                      ? <><span className="spinner" style={{ width:12, height:12, borderWidth:2 }} /> Fetching...</>
                      : <>📍 Use GPS</>}
                  </button>
                </label>
                <textarea
                  value={form.address}
                  onChange={e => set('address', e.target.value)}
                  placeholder="Flat 4B, Frazer Road, Patna — ya GPS se auto-fill karein"
                  rows={2}
                  style={{ width:'100%', padding:'10px 12px', border:'1.5px solid var(--bdr)', borderRadius:8, fontSize:14, fontFamily:'inherit', resize:'vertical', outline:'none', boxSizing:'border-box', lineHeight:1.5 }}
                />
                <p style={{ margin:'3px 0 0', fontSize:11, color:'#9ca3af' }}>
                  📍 GPS button se Google Maps ka detailed address auto-fill ho jayega
                </p>
              </div>
            </>
          )}

          {/* ════════════════ LOGIN FORM ════════════════ */}
          {mode === 'login' && (
            <div className="field">
              <label style={{ display:'flex', alignItems:'center', gap:6 }}>
                Email ya Mobile Number
                {loginType === 'phone' && <span style={{ fontSize:11, background:'#fff7ed', color:'#e85d04', border:'1px solid #fed7aa', borderRadius:4, padding:'1px 6px', fontWeight:600 }}>📱 Mobile</span>}
                {loginType === 'email' && <span style={{ fontSize:11, background:'#eff6ff', color:'#2563eb', border:'1px solid #bfdbfe', borderRadius:4, padding:'1px 6px', fontWeight:600 }}>📧 Email</span>}
              </label>
              <div style={{ display:'flex' }}>
                {loginPrefix}
                <input
                  required
                  type={loginType === 'email' ? 'email' : 'text'}
                  value={identifier}
                  onChange={e => {
                    const val = detectType(e.target.value) === 'phone'
                      ? e.target.value.replace(/[^0-9]/g, '').slice(0, 10)
                      : e.target.value
                    setIdentifier(val)
                    setError('')
                  }}
                  placeholder={loginType === 'phone' ? '98765 43210' : loginType === 'email' ? 'you@email.com' : 'Email ya 10-digit mobile...'}
                  maxLength={loginType === 'phone' ? 10 : 100}
                  inputMode={loginType === 'phone' ? 'numeric' : 'email'}
                  style={{ borderRadius:'0 8px 8px 0', borderLeft:'none', flex:1 }}
                  autoComplete="username"
                />
              </div>
              {loginType === 'unknown' && identifier.length > 0 && (
                <p style={{ fontSize:11, color:'#9ca3af', margin:'4px 0 0' }}>Email ke liye @ likho, phone ke liye sirf digits</p>
              )}
            </div>
          )}

          {/* ── Phone Login Method Toggle ── */}
          {mode === 'login' && loginType === 'phone' && loginPhoneDigits.length === 10 && (
            <div style={{ display:'flex', gap:0, marginBottom:14, border:'1.5px solid var(--bdr)', borderRadius:10, overflow:'hidden' }}>
              <button type="button"
                onClick={() => { setLoginMethod('password'); setOtpStep('idle'); setOtpInput(['','','','','','']); confirmationResultRef.current = null; firebaseTokenRef.current = null }}
                style={{ flex:1, padding:'9px', fontSize:13, fontWeight:700, border:'none', cursor:'pointer', transition:'all 0.15s',
                  background: loginMethod === 'password' ? '#e85d04' : 'var(--bg)',
                  color: loginMethod === 'password' ? '#fff' : 'var(--t2)' }}>
                🔑 Password
              </button>
              <button type="button"
                onClick={() => { setLoginMethod('otp'); setOtpStep('idle'); setOtpInput(['','','','','','']); confirmationResultRef.current = null; firebaseTokenRef.current = null }}
                style={{ flex:1, padding:'9px', fontSize:13, fontWeight:700, border:'none', borderLeft:'1.5px solid var(--bdr)', cursor:'pointer', transition:'all 0.15s',
                  background: loginMethod === 'otp' ? '#e85d04' : 'var(--bg)',
                  color: loginMethod === 'otp' ? '#fff' : 'var(--t2)' }}>
                📱 OTP se Login
              </button>
            </div>
          )}

          {/* Password field — show only for password login */}
          {!(mode === 'login' && loginType === 'phone' && loginMethod === 'otp') && (
            <div className="field">
              <label>Password</label>
              <input type="password" required={!(mode === 'login' && loginMethod === 'otp')} value={form.password} onChange={e => set('password', e.target.value)} placeholder="••••••••" minLength={6} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
            </div>
          )}

          {/* ── OTP Login Flow (phone) ── */}
          {mode === 'login' && loginType === 'phone' && loginMethod === 'otp' && (
            <div style={{ marginBottom:14 }}>
              {/* Send OTP button */}
              {(otpStep === 'idle' || otpStep === 'failed') && (
                <button type="button" onClick={sendLoginOtp}
                  style={{ width:'100%', padding:'12px', background:'#fff7ed', color:'#e85d04', border:'1.5px solid #fed7aa', borderRadius:10, fontSize:14, fontWeight:700, cursor:'pointer' }}>
                  📲 OTP Bhejo — +91{loginPhoneDigits}
                </button>
              )}
              {otpStep === 'sending' && (
                <div style={{ textAlign:'center', padding:'12px', fontSize:13, color:'#9ca3af' }}>⏳ OTP bheja ja raha hai...</div>
              )}

              {/* OTP boxes */}
              {(otpStep === 'sent' || otpStep === 'verifying') && (
                <div style={{ background:'#fff7ed', border:'1.5px solid #fed7aa', borderRadius:12, padding:'16px' }}>
                  <p style={{ margin:'0 0 12px', fontSize:13, color:'#92400e', fontWeight:600, textAlign:'center' }}>
                    📲 OTP +91{loginPhoneDigits} pe bheja gaya
                  </p>
                  <div style={{ display:'flex', gap:8, justifyContent:'center', marginBottom:14 }} onPaste={handleOtpPaste}>
                    {otpInput.map((digit, i) => (
                      <input key={i}
                        ref={el => otpBoxRefs.current[i] = el}
                        type="text" inputMode="numeric" maxLength={1}
                        value={digit}
                        onChange={e => handleOtpBox(i, e.target.value)}
                        onKeyDown={e => handleOtpKeyDown(i, e)}
                        style={{
                          width:42, height:52, textAlign:'center', fontSize:22, fontWeight:700,
                          border: digit ? '2px solid #f97316' : '2px solid #e5e7eb',
                          borderRadius:10, outline:'none',
                          background: digit ? '#fff7ed' : '#fff',
                          color:'#1f2937', transition:'all 0.15s',
                          boxShadow: digit ? '0 0 0 3px rgba(249,115,22,0.1)' : 'none'
                        }}
                      />
                    ))}
                  </div>
                  <button type="button" onClick={verifyOtp}
                    disabled={otpString.length !== 6 || otpStep === 'verifying'}
                    style={{
                      width:'100%', padding:'13px', fontSize:15, fontWeight:700, border:'none',
                      borderRadius:10, cursor: otpString.length === 6 ? 'pointer' : 'not-allowed',
                      background: otpString.length === 6 ? '#e85d04' : '#d1d5db',
                      color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', gap:8, transition:'background 0.2s',
                    }}>
                    {otpStep === 'verifying'
                      ? <><span className="spinner" /> Verify ho raha hai...</>
                      : <><span style={{ fontSize:18 }}>✓</span> OTP Verify Karo</>}
                  </button>
                  <div style={{ marginTop:10, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ fontSize:12, color:'#9ca3af' }}>5 min mein expire hoga</span>
                    {otpTimer > 0
                      ? <span style={{ fontSize:12, color:'#9ca3af' }}>Resend {otpTimer}s mein</span>
                      : <button type="button" onClick={sendLoginOtp} style={{ fontSize:12, color:'#e85d04', background:'none', border:'none', cursor:'pointer', fontWeight:600 }}>🔄 Resend OTP</button>}
                  </div>
                </div>
              )}

              {/* OTP Verified */}
              {otpStep === 'verified' && (
                <div style={{ background:'#f0fdf4', border:'1.5px solid #86efac', borderRadius:10, padding:'10px 14px', display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:20 }}>✅</span>
                  <span style={{ fontSize:13, color:'#16a34a', fontWeight:700 }}>OTP verify ho gaya! Login ho raha hai...</span>
                </div>
              )}
            </div>
          )}

          {mode === 'login' && loginMethod === 'password' && (
            <div style={{ textAlign:'right', marginBottom:8 }}>
              <button type="button" onClick={() => router.push('/forgot-password')}
                style={{ background:'none', border:'none', color:'#e85d04', fontSize:13, cursor:'pointer' }}>
                Password bhool gaye?
              </button>
            </div>
          )}

          {error && <div className={styles.error}>{error}</div>}

          <button type="submit" className="btn btn-primary btn-full"
            disabled={loading || otpStep === 'sending' || otpStep === 'verifying'}>
            {submitLabel()}
          </button>
        </form>

        <p className={styles.switchMode}>
          {mode === 'login' ? 'Naya account?' : 'Pehle se account hai?'}{' '}
          <button onClick={() => { setMode(mode==='login'?'signup':'login'); setError(''); setIdentifier(''); setForm({ name:'', email:'', phone:'', password:'', address:'' }) }}>
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

'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import styles from './login.module.css'
import FoodFiLogo from '../components/FoodFiLogo'

// ── Splash Lines Pool ─────────────────────────────────────────────
const SPLASH_LINES = [
  { main: 'माँ के हाथों का स्वाद, अब आपके दरवाज़े तक', sub: 'ताज़ा बना, गरमागरम आया 🍽️' },
  { main: 'हर निवाले में माँ की दुआ है', sub: 'Har order mein dil lagate hain 🧡' },
  { main: 'वो पुरानी रसोई की महक... याद है?', sub: 'No shortcuts in our kitchen, only love 🌿' },
  { main: 'घर का खाना — दिल का खाना', sub: 'Saaf haath, saccha khana — hamara vaada ✨' },
  { main: 'दिल से बनाया, आपके लिए सजाया', sub: 'Pet khush, toh sab khush 😋' },
  { main: 'हर थाली में प्यार का तड़का', sub: 'Fresh · Homemade · Made with Love' },
  { main: 'आपकी भूख, हमारी ज़िम्मेदारी', sub: 'Bhook lagi? Hum aa rahe hain 🛵' },
  { main: 'खाने में जब प्यार हो, हर bite special हो', sub: 'Aaj kya khayein? — Ye sawaal khatam! ✅' },
  { main: '🙏 अतिथि देवो भव — आपका स्वागत है', sub: 'Har subah ek naya swad, har shaam ek naya ehsaas' },
  { main: 'अन्न ब्रह्म है — हम इज़्ज़त से बनाते हैं', sub: 'आपका भरोसा, हमारी ताकत 💪' },
  { main: 'खाना खाया? — हमारी सबसे बड़ी चिंता', sub: 'Ghar pe kuch nahi bana? Koi baat nahi! 😄' },
  { main: 'रोटी, प्यार aur FoodFi 🧡', sub: 'Ek order, hazaar yaadon jaisa swad' },
  { main: 'खुशबू आए रसोई से, दिल खुश हो जाए', sub: 'Chef special, delivered special ✨' },
  { main: 'Zindagi mein do cheezein khoobsurat hain —', sub: 'Accha insaan aur accha khana 🍛' },
  { main: 'Har subah ek naya swad', sub: 'Har shaam ek naya ehsaas — FoodFi ke saath 🌟' },
  { main: 'भूख लगी है? — चिंता मत करो, FoodFi हैं ना 🤗', sub: 'Bas ek order — baaki sab humpe chodo 🛵' },
  { main: 'थक गए? बैठो — खाना हम भेज रहे हैं 💆', sub: 'Aaram karo, hum kaam karte hain 🍽️' },
  { main: 'Diet कल से... आज FoodFi है 😅', sub: 'Ek din aur nahi bigdega — promise! 😄' },
  { main: 'Seedha रसोई से आपके पास', sub: 'No middleman, no delay — just fresh food ✨' },
  { main: 'Made with love. Delivered with care.', sub: 'Every order is personal to us 🧡' },
  { main: 'Khana nahi — khayaal hai yeh', sub: 'Aapki bhookh, hamari zimmedari 💝' },
]

export default function LoginPage() {
  const router = useRouter()

  // ── Splash Screen ────────────────────────────────────────────────
  const [showSplash, setShowSplash] = useState(true)
  const [splashPhase, setSplashPhase] = useState(0)
  const [splashLine] = useState(() => SPLASH_LINES[Math.floor(Math.random() * SPLASH_LINES.length)])

  useEffect(() => {
    const timers = [
      setTimeout(() => setSplashPhase(1), 150),
      setTimeout(() => setSplashPhase(2), 600),
      setTimeout(() => setSplashPhase(3), 1100),
      setTimeout(() => setSplashPhase(4), 1700),
      setTimeout(() => setSplashPhase(5), 2500),
      setTimeout(() => setShowSplash(false), 3000),
    ]
    return () => timers.forEach(clearTimeout)
  }, [])

  // ── Auth redirect check ──────────────────────────────────────────
  useEffect(() => {
    fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'me' }) })
      .then(r => r.json())
      .then(({ user }) => {
        if (user?.role === 'admin') router.push('/admin')
        else if (user?.role === 'delivery') router.push('/delivery')
        else if (user?.role === 'customer') router.push('/menu')
      })
  }, [])

  // ── Form state ───────────────────────────────────────────────────
  const [tab, setTab] = useState('otp')           // 'password' | 'otp'
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const phoneDigits = phone.replace(/[^0-9]/g, '').slice(0, 10)
  const phoneReady = phoneDigits.length === 10

  // ── OTP state ────────────────────────────────────────────────────
  const [otpStep, setOtpStep] = useState('idle') // idle|sending|sent|verifying
  const [otpInput, setOtpInput] = useState(['', '', '', '', '', ''])
  const [otpTimer, setOtpTimer] = useState(0)
  const timerRef = useRef(null)
  const otpBoxRefs = useRef([])

  // Firebase refs
  const confirmationResultRef = useRef(null)
  const recaptchaVerifierRef  = useRef(null)
  const firebaseTokenRef      = useRef(null)

  // ── Name modal (new user) ────────────────────────────────────────
  const [showNameModal, setShowNameModal] = useState(false)
  const [newUserName, setNewUserName] = useState('')
  const [newUserAddress, setNewUserAddress] = useState('')
  const [locationLoading, setLocationLoading] = useState(false)
  const nameInputRef = useRef(null)

  // Countdown timer
  useEffect(() => {
    if (otpTimer > 0) {
      timerRef.current = setTimeout(() => setOtpTimer(t => t - 1), 1000)
    }
    return () => clearTimeout(timerRef.current)
  }, [otpTimer])

  // Reset OTP + Firebase when phone changes
  useEffect(() => {
    setOtpStep('idle')
    setOtpInput(['', '', '', '', '', ''])
    setOtpTimer(0)
    setError('')
    confirmationResultRef.current = null
    firebaseTokenRef.current = null
    if (recaptchaVerifierRef.current) {
      try { recaptchaVerifierRef.current.clear() } catch(e) {}
      recaptchaVerifierRef.current = null
    }
  }, [phone])

  // Reset OTP + Firebase when tab changes
  useEffect(() => {
    setOtpStep('idle')
    setOtpInput(['', '', '', '', '', ''])
    setOtpTimer(0)
    setError('')
    confirmationResultRef.current = null
    firebaseTokenRef.current = null
    if (recaptchaVerifierRef.current) {
      try { recaptchaVerifierRef.current.clear() } catch(e) {}
      recaptchaVerifierRef.current = null
    }
  }, [tab])

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
    if (!/^[0-9]?$/.test(val)) return
    const next = [...otpInput]
    next[index] = val
    setOtpInput(next)
    if (val && index < 5) otpBoxRefs.current[index + 1]?.focus()
    // Auto-verify on 6th digit
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

  // ── Send OTP (Firebase — client-side, no server IP issues) ──────
  const sendOtp = async () => {
    if (!phoneReady) { setError('Please enter a valid 10-digit mobile number'); return }
    setError(''); setOtpStep('sending'); setOtpInput(['', '', '', '', '', ''])

    // Clean up previous recaptcha
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
        size: 'invisible', callback: () => {},
        'expired-callback': () => {
          if (recaptchaVerifierRef.current) {
            try { recaptchaVerifierRef.current.clear() } catch(e) {}
            recaptchaVerifierRef.current = null
          }
        }
      })
      recaptchaVerifierRef.current = verifier

      const result = await signInWithPhoneNumber(auth, '+91' + phoneDigits, verifier)
      confirmationResultRef.current = result
      setOtpStep('sent')
      setOtpTimer(60)
      setTimeout(() => otpBoxRefs.current[0]?.focus(), 100)
    } catch (e) {
      console.error('Firebase OTP error:', e.code, e.message)
      if (recaptchaVerifierRef.current) {
        try { recaptchaVerifierRef.current.clear() } catch(err) {}
        recaptchaVerifierRef.current = null
      }
      const msg = e.code === 'auth/too-many-requests'  ? 'Too many requests. 10-15 min baad try karo.'
        : e.code === 'auth/invalid-phone-number'        ? 'Invalid phone number. 10-digit Indian number daalo.'
        : e.code === 'auth/captcha-check-failed'        ? 'reCAPTCHA failed. Page refresh (F5) karke dobara try karo.'
        : e.code === 'auth/network-request-failed'      ? 'Network error. Internet check karo.'
        : 'OTP nahi bheja ja saka. Page refresh karke dobara try karo.'
      setError(msg); setOtpStep('idle')
    }
  }

  // ── Auto-verify OTP (Firebase confirm → backend login-otp) ──────
  const autoVerifyOtp = async (otp) => {
    if (otpStep === 'verifying') return
    if (!confirmationResultRef.current) { setError('Please send OTP first'); return }
    setOtpStep('verifying'); setError('')
    try {
      // Step 1: Firebase confirms OTP → get idToken
      const result = await confirmationResultRef.current.confirm(otp)
      const idToken = await result.user.getIdToken()
      firebaseTokenRef.current = idToken

      // Step 2: Backend looks up user by phone
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
        setTimeout(() => otpBoxRefs.current[0]?.focus(), 100)
        return
      }
      if (data.needsName) {
        // New user — show name modal
        setShowNameModal(true)
      } else {
        const { user } = data
        if (user.role === 'admin') router.push('/admin')
        else if (user.role === 'delivery') router.push('/delivery')
        else router.push('/menu')
      }
    } catch (e) {
      const msg = e.code === 'auth/invalid-verification-code' ? 'Galat OTP. Dobara check karo.'
        : e.code === 'auth/code-expired' ? 'OTP expire ho gaya. Dobara bhejo.'
        : 'OTP verify nahi hua. Please try again.'
      setError(msg)
      setOtpStep('sent')
      setOtpInput(['', '', '', '', '', ''])
      setTimeout(() => otpBoxRefs.current[0]?.focus(), 100)
    }
  }

  // ── Name Modal Submit (new user) ─────────────────────────────────
  const handleNameSubmit = async (e) => {
    e.preventDefault()
    if (!newUserName.trim()) { setError('Please enter your name'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'otp-signup',
          phone: '+91' + phoneDigits,
          name: newUserName.trim(),
          address: newUserAddress.trim(),
          firebaseToken: firebaseTokenRef.current,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Could not create account. Please try again.'); return }
      router.push('/menu')
    } catch { setError('Something went wrong. Please try again.') }
    finally { setLoading(false) }
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
      if (user.role === 'admin') router.push('/admin')
      else if (user.role === 'delivery') router.push('/delivery')
      else router.push('/menu')
    } catch { setError('Something went wrong. Please try again.') }
    finally { setLoading(false) }
  }

  // ── Shared prefix tag ────────────────────────────────────────────
  const PhonePrefix = () => (
    <span style={{
      padding: '10px 12px', background: '#f3f4f6',
      border: '1.5px solid var(--bdr)', borderRight: 'none',
      borderRadius: '8px 0 0 8px', fontSize: 14, color: '#374151',
      fontWeight: 600, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center',
    }}>🇮🇳 +91</span>
  )

  return (
    <div className={styles.wrap}>

      {/* ── Splash Screen ── */}
      {showSplash && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 99999,
          background: 'linear-gradient(160deg, #0f0400 0%, #1e0a00 45%, #120600 100%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
          opacity: splashPhase >= 5 ? 0 : 1,
          transition: splashPhase >= 5 ? 'opacity 0.85s ease' : 'none',
          pointerEvents: splashPhase >= 5 ? 'none' : 'all',
        }}>
          <style>{`
            @keyframes ckFloatUp {
              0%   { transform: translateY(0) rotate(0deg);   opacity: 0.18; }
              50%  { opacity: 0.35; }
              100% { transform: translateY(-110vh) rotate(25deg); opacity: 0; }
            }
            @keyframes ckGlow {
              0%,100% { box-shadow: 0 0 28px rgba(232,93,4,0.55), 0 0 60px rgba(232,93,4,0.18); }
              50%      { box-shadow: 0 0 55px rgba(232,93,4,0.9), 0 0 110px rgba(232,93,4,0.4); }
            }
            @keyframes ckShimmer {
              0%   { background-position: -300% center; }
              100% { background-position:  300% center; }
            }
            @keyframes ckDot {
              0%,100% { opacity: 0.35; transform: scale(1); }
              50%      { opacity: 1;    transform: scale(1.5); }
            }
            @keyframes ckBar {
              0%   { width: 0; opacity: 0; }
              20%  { opacity: 1; }
              100% { width: 64px; opacity: 1; }
            }
          `}</style>

          {['🍛','🍜','🥘','🍱','🌮','🍝','🍚','🫕','🥗','🍲'].map((em, i) => (
            <div key={i} style={{
              position: 'absolute', left: `${i * 10 + 4}%`, bottom: `-${6 + (i % 3) * 2}%`,
              fontSize: `${14 + (i % 4) * 6}px`,
              animation: `ckFloatUp ${6 + i * 0.65}s linear ${i * 0.45}s infinite`,
              userSelect: 'none', pointerEvents: 'none',
            }}>{em}</div>
          ))}

          <div style={{
            position: 'absolute', width: 320, height: 320, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(232,93,4,0.13) 0%, transparent 70%)',
            top: '50%', left: '50%', transform: 'translate(-50%, -70%)', pointerEvents: 'none',
          }} />

          <div style={{
            opacity: splashPhase >= 1 ? 1 : 0,
            transform: splashPhase >= 1 ? 'scale(1)' : 'scale(0.2)',
            transition: 'opacity 0.5s ease, transform 0.65s cubic-bezier(0.34,1.56,0.64,1)',
            marginBottom: 14, borderRadius: 22,
            animation: splashPhase >= 1 ? 'ckGlow 2.2s ease-in-out 0.65s infinite' : 'none',
          }}>
            <FoodFiLogo size={78} style={{ borderRadius: 20, display: 'block' }} />
          </div>

          <div style={{
            opacity: splashPhase >= 2 ? 1 : 0,
            transform: splashPhase >= 2 ? 'translateY(0)' : 'translateY(22px)',
            transition: 'opacity 0.55s ease, transform 0.55s ease',
            textAlign: 'center', marginBottom: 6,
          }}>
            <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: '-0.5px', lineHeight: 1.1 }}>
              <span style={{ color: '#e85d04' }}>Food</span>
              <span style={{ color: '#fff' }}>Fi</span>
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', fontWeight: 600, letterSpacing: 3.5, textTransform: 'uppercase', marginTop: 3 }}>
              Cloud Kitchen
            </div>
          </div>

          <div style={{
            height: 2, background: 'linear-gradient(90deg, transparent, #e85d04, transparent)',
            borderRadius: 2, marginBottom: 24,
            animation: splashPhase >= 2 ? 'ckBar 0.7s ease forwards' : 'none',
            width: splashPhase >= 2 ? 64 : 0,
          }} />

          <div style={{
            opacity: splashPhase >= 3 ? 1 : 0,
            transform: splashPhase >= 3 ? 'translateY(0)' : 'translateY(20px)',
            transition: 'opacity 0.65s ease, transform 0.65s ease',
            textAlign: 'center', padding: '0 30px', marginBottom: 14, maxWidth: 360,
          }}>
            <div style={{
              fontSize: 21, fontWeight: 800, lineHeight: 1.45, letterSpacing: 0.2,
              background: 'linear-gradient(90deg, #fbbf24, #e85d04, #f59e0b, #e85d04, #fbbf24)',
              backgroundSize: '300% auto',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              animation: splashPhase >= 3 ? 'ckShimmer 3.5s linear infinite' : 'none',
            }}>
              {splashLine.main}
            </div>
          </div>

          <div style={{
            opacity: splashPhase >= 4 ? 1 : 0,
            transform: splashPhase >= 4 ? 'translateY(0)' : 'translateY(14px)',
            transition: 'opacity 0.6s ease, transform 0.6s ease',
            textAlign: 'center', padding: '0 40px', maxWidth: 340,
          }}>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.58)', fontWeight: 500, letterSpacing: 0.3, lineHeight: 1.65 }}>
              {splashLine.sub}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 7, marginTop: 32, opacity: splashPhase >= 4 ? 1 : 0, transition: 'opacity 0.5s ease 0.2s' }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                width: 6, height: 6, borderRadius: '50%',
                background: i === 1 ? '#e85d04' : 'rgba(232,93,4,0.45)',
                animation: splashPhase >= 4 ? `ckDot 1.1s ease-in-out ${i * 0.22}s infinite` : 'none',
              }} />
            ))}
          </div>

          <div style={{
            position: 'absolute', bottom: 28,
            opacity: splashPhase >= 4 ? 0.35 : 0, transition: 'opacity 0.5s ease 0.4s',
            fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: 2.5, textTransform: 'uppercase', fontWeight: 500,
          }}>
            foodfi.in
          </div>
        </div>
      )}

      {/* ── Name Modal (new user after OTP) ── */}
      {showNameModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px',
        }}>
          <div style={{
            background: '#fff', borderRadius: 20, padding: '28px 24px', width: '100%', maxWidth: 380,
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}>
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: 22 }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>🎉</div>
              <h2 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 900, color: '#1f2937' }}>
                Welcome to <span style={{ color: '#e85d04' }}>FoodFi</span>!
              </h2>
              <p style={{ margin: 0, fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>
                Aapka number verify ho gaya!<br />
                Sirf apna naam batao — account ready ho jayega 😊
              </p>
              <div style={{ marginTop: 10, background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8, padding: '6px 12px', display: 'inline-block' }}>
                <span style={{ fontSize: 12, color: '#c2410c', fontWeight: 600 }}>📱 +91{phoneDigits}</span>
              </div>
            </div>

            <form onSubmit={handleNameSubmit}>
              {/* Name */}
              <div className="field" style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
                  Aapka Naam <span style={{ color: '#e85d04' }}>*</span>
                </label>
                <input
                  ref={nameInputRef}
                  required
                  value={newUserName}
                  onChange={e => setNewUserName(e.target.value)}
                  placeholder="Jaise: Rahul Kumar"
                  autoComplete="name"
                  style={{
                    width: '100%', padding: '11px 14px', fontSize: 15, fontWeight: 500,
                    border: '1.5px solid #e5e7eb', borderRadius: 10, outline: 'none',
                    boxSizing: 'border-box', fontFamily: 'inherit',
                  }}
                  onFocus={e => e.target.style.borderColor = '#f97316'}
                  onBlur={e => e.target.style.borderColor = '#e5e7eb'}
                />
              </div>

              {/* Address (optional) */}
              <div className="field" style={{ marginBottom: 18 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span>Delivery Address <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 400 }}>(optional, fill now or at checkout)</span></span>
                  <button type="button" onClick={fetchLocation} disabled={locationLoading}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      background: locationLoading ? '#f3f4f6' : '#fff7ed',
                      color: locationLoading ? '#9ca3af' : '#e85d04',
                      border: '1.5px solid', borderColor: locationLoading ? '#e5e7eb' : '#fed7aa',
                      borderRadius: 6, padding: '3px 9px', fontSize: 11, fontWeight: 600,
                      cursor: locationLoading ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
                    }}>
                    {locationLoading
                      ? <><span className="spinner" style={{ width: 10, height: 10, borderWidth: 2 }} /> Fetching...</>
                      : <>📍 GPS</>}
                  </button>
                </label>
                <textarea
                  value={newUserAddress}
                  onChange={e => setNewUserAddress(e.target.value)}
                  placeholder="Flat 4B, Frazer Road, Patna — ya GPS se auto-fill karein"
                  rows={2}
                  style={{
                    width: '100%', padding: '10px 12px', fontSize: 13, fontFamily: 'inherit',
                    border: '1.5px solid #e5e7eb', borderRadius: 10, outline: 'none',
                    resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.5,
                  }}
                  onFocus={e => e.target.style.borderColor = '#f97316'}
                  onBlur={e => e.target.style.borderColor = '#e5e7eb'}
                />
              </div>

              {error && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 13, color: '#dc2626' }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !newUserName.trim()}
                style={{
                  width: '100%', padding: '14px', fontSize: 16, fontWeight: 800, border: 'none',
                  borderRadius: 12, cursor: newUserName.trim() ? 'pointer' : 'not-allowed',
                  background: newUserName.trim() ? 'linear-gradient(135deg, #e85d04, #f97316)' : '#d1d5db',
                  color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  boxShadow: newUserName.trim() ? '0 4px 16px rgba(232,93,4,0.35)' : 'none',
                  transition: 'all 0.2s',
                }}>
                {loading ? <><span className="spinner" /> Creating account...</> : <>🛒 Account Banao & Order Karo</>}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Invisible reCAPTCHA container (Firebase needs this) */}
      <div id="recaptcha-container" />

      {/* ── Main Card ── */}
      <div className={styles.card}>

        {/* Logo */}
        <div className={styles.logo}>
          <FoodFiLogo size={64} style={{ borderRadius: 16, boxShadow: '0 4px 20px rgba(232,93,4,0.3)', marginBottom: 10 }} />
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px', margin: '0 0 2px 0', lineHeight: 1.1 }}>
            <span style={{ color: '#e85d04' }}>Food</span><span style={{ color: '#1f2937' }}>Fi</span>
          </h1>
          <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px', margin: '0 0 4px 0', color: '#1e293b', lineHeight: 1.1 }}>
            Cloud Kitchen
          </h2>
          <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 6px 0' }}>Fresh food, delivered fast</p>
          <a href="https://order.foodfi.in" target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 12, color: '#e85d04', fontWeight: 700, textDecoration: 'none', letterSpacing: 0.3, borderBottom: '1.5px dashed #e85d04', paddingBottom: 1 }}>
            🌐 order.foodfi.in
          </a>
        </div>

        {/* ── Phone Number (always visible) ── */}
        <div className="field">
          <label style={{ fontWeight: 700, color: '#374151', fontSize: 13 }}>Mobile Number</label>
          <div style={{ display: 'flex' }}>
            <PhonePrefix />
            <input
              type="text"
              inputMode="numeric"
              maxLength={10}
              value={phone}
              onChange={e => setPhone(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
              placeholder="Apna 10 digit number"
              autoComplete="tel"
              style={{ borderRadius: '0 8px 8px 0', borderLeft: 'none', flex: 1, fontSize: 16, fontWeight: 500 }}
            />
          </div>
        </div>

        {/* ── Tab Toggle (Password | OTP) — shown when phone is ready ── */}
        {phoneReady && (
          <div style={{ display: 'flex', gap: 0, marginBottom: 18, border: '1.5px solid var(--bdr)', borderRadius: 10, overflow: 'hidden' }}>
            <button type="button"
              onClick={() => setTab('password')}
              style={{
                flex: 1, padding: '10px', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                background: tab === 'password' ? '#e85d04' : 'var(--bg)',
                color: tab === 'password' ? '#fff' : 'var(--t2)',
              }}>
              🔑 Password
            </button>
            <button type="button"
              onClick={() => setTab('otp')}
              style={{
                flex: 1, padding: '10px', fontSize: 13, fontWeight: 700, border: 'none', borderLeft: '1.5px solid var(--bdr)', cursor: 'pointer', transition: 'all 0.15s',
                background: tab === 'otp' ? '#e85d04' : 'var(--bg)',
                color: tab === 'otp' ? '#fff' : 'var(--t2)',
              }}>
              📱 OTP
            </button>
          </div>
        )}

        {/* ════════════════ OTP TAB ════════════════ */}
        {tab === 'otp' && (
          <div>
            {!phoneReady && (
              <div style={{ textAlign: 'center', padding: '14px 0 8px', fontSize: 13, color: '#9ca3af' }}>
                👆 Enter your mobile number above
              </div>
            )}

            {/* Send OTP button */}
            {phoneReady && otpStep === 'idle' && (
              <button type="button" onClick={sendOtp}
                style={{
                  width: '100%', padding: '14px', marginBottom: 14,
                  background: 'linear-gradient(135deg, #e85d04, #f97316)',
                  color: '#fff', fontSize: 16, fontWeight: 800, border: 'none',
                  borderRadius: 12, cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(232,93,4,0.35)',
                }}>
                📲 Send OTP — +91{phoneDigits}
              </button>
            )}

            {otpStep === 'sending' && (
              <div style={{ textAlign: 'center', padding: '14px', fontSize: 14, color: '#9ca3af', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <span className="spinner" /> OTP bheja ja raha hai...
              </div>
            )}

            {/* OTP Boxes */}
            {(otpStep === 'sent' || otpStep === 'verifying') && (
              <div style={{ background: '#fff7ed', border: '1.5px solid #fed7aa', borderRadius: 14, padding: '18px 16px', marginBottom: 14 }}>
                <p style={{ margin: '0 0 4px', fontSize: 13, color: '#92400e', fontWeight: 700, textAlign: 'center' }}>
                  📲 OTP sent to +91{phoneDigits}
                </p>
                <p style={{ margin: '0 0 14px', fontSize: 11, color: '#b45309', textAlign: 'center' }}>
                  {otpStep === 'verifying' ? '⏳ Verifying...' : '6 digits enter karo — auto-verify ho jayega ✨'}
                </p>

                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 14 }} onPaste={handleOtpPaste}>
                  {otpInput.map((digit, i) => (
                    <input key={i}
                      ref={el => otpBoxRefs.current[i] = el}
                      type="text" inputMode="numeric" maxLength={1}
                      value={digit}
                      onChange={e => handleOtpBox(i, e.target.value)}
                      onKeyDown={e => handleOtpKeyDown(i, e)}
                      disabled={otpStep === 'verifying'}
                      style={{
                        width: 42, height: 52, textAlign: 'center', fontSize: 22, fontWeight: 700,
                        border: digit ? '2px solid #f97316' : '2px solid #e5e7eb',
                        borderRadius: 10, outline: 'none',
                        background: otpStep === 'verifying' ? '#f9fafb' : digit ? '#fff7ed' : '#fff',
                        color: '#1f2937', transition: 'all 0.15s',
                        boxShadow: digit ? '0 0 0 3px rgba(249,115,22,0.12)' : 'none',
                        opacity: otpStep === 'verifying' ? 0.7 : 1,
                      }}
                    />
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#9ca3af' }}>OTP 10 min mein expire hoga</span>
                  {otpTimer > 0
                    ? <span style={{ fontSize: 12, color: '#9ca3af' }}>Resend in {otpTimer}s</span>
                    : <button type="button" onClick={sendOtp}
                        style={{ fontSize: 12, color: '#e85d04', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
                        🔄 Resend OTP
                      </button>}
                </div>
              </div>
            )}

            {error && <div className={styles.error}>{error}</div>}
          </div>
        )}

        {/* ════════════════ PASSWORD TAB ════════════════ */}
        {tab === 'password' && (
          <form onSubmit={handlePasswordLogin}>
            {!phoneReady && (
              <div style={{ textAlign: 'center', padding: '14px 0 8px', fontSize: 13, color: '#9ca3af' }}>
                👆 Enter your mobile number above
              </div>
            )}

            {phoneReady && (
              <>
                <div className="field">
                  <label style={{ fontWeight: 700, color: '#374151', fontSize: 13 }}>Password</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    minLength={6}
                    autoComplete="current-password"
                  />
                </div>

                <div style={{ textAlign: 'right', marginBottom: 14 }}>
                  <button type="button" onClick={() => router.push('/forgot-password')}
                    style={{ background: 'none', border: 'none', color: '#e85d04', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
                    Forgot Password?
                  </button>
                </div>

                {error && <div className={styles.error}>{error}</div>}

                <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
                  {loading ? <span className="spinner" /> : '🔑 Login'}
                </button>
              </>
            )}
          </form>
        )}

        {/* ── Guest Order Button ── */}
        <div style={{ marginTop: 20, textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{ flex: 1, height: 1, background: '#f3f4f6' }} />
            <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 500 }}>ya phir</span>
            <div style={{ flex: 1, height: 1, background: '#f3f4f6' }} />
          </div>

          <button
            type="button"
            onClick={() => router.push('/menu?guest=true')}
            style={{
              width: '100%', padding: '12px', fontSize: 14, fontWeight: 700,
              background: 'transparent', color: '#6b7280',
              border: '1.5px dashed #d1d5db', borderRadius: 10, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'all 0.2s',
            }}
            onMouseOver={e => { e.currentTarget.style.borderColor = '#e85d04'; e.currentTarget.style.color = '#e85d04'; e.currentTarget.style.background = '#fff7ed' }}
            onMouseOut={e => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.color = '#6b7280'; e.currentTarget.style.background = 'transparent' }}
          >
            👀 Guest ke roop mein browse karo
          </button>
          <p style={{ margin: '8px 0 0', fontSize: 11, color: '#9ca3af' }}>
            Login ke bina menu dekho — checkout pe naam + address dena hoga
          </p>
        </div>

        {/* Admin/Delivery note */}
        <p style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center', marginTop: 16 }}>
          Admin aur Delivery Boy bhi yahan login kar sakte hain
        </p>

        {/* Delivery Partner apply */}
        <div style={{ borderTop: '1px solid #f3f4f6', marginTop: 14, paddingTop: 14, textAlign: 'center' }}>
          <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Delivery Partner banna chahte ho?</p>
          <button onClick={() => router.push('/delivery/apply')}
            style={{ background: 'none', border: '1.5px solid #e85d04', color: '#e85d04', borderRadius: 8, padding: '8px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            🛵 Delivery Partner Application
          </button>
        </div>
      </div>
    </div>
  )
}

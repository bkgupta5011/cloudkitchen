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

// Food emojis for hero background
const FOOD_EMOJIS = ['🍛','🍜','🥘','🍱','🌮','🍝','🍚','🫕','🥗','🍲','🧆','🍖','🥙','🫔','🍣','🥩']

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
  const [tab, setTab] = useState('otp')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const phoneDigits = phone.replace(/[^0-9]/g, '').slice(0, 10)
  const phoneReady = phoneDigits.length === 10

  // ── OTP state ────────────────────────────────────────────────────
  const [otpStep, setOtpStep] = useState('idle')
  const [otpInput, setOtpInput] = useState(['', '', '', '', '', ''])
  const [otpTimer, setOtpTimer] = useState(0)
  const timerRef = useRef(null)
  const otpBoxRefs = useRef([])

  // Firebase refs
  const confirmationResultRef = useRef(null)
  const recaptchaVerifierRef  = useRef(null)
  const firebaseTokenRef      = useRef(null)

  // ── New user welcome modal ───────────────────────────────────────
  const [showNameModal, setShowNameModal] = useState(false)
  const [newUserName, setNewUserName] = useState('')
  const [newUserAddress, setNewUserAddress] = useState('')
  const [locationLoading, setLocationLoading] = useState(false)
  const [newUserSaving, setNewUserSaving] = useState(false)
  const nameInputRef = useRef(null)
  const pendingUserRef = useRef(null)

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
    cleanupFirebase()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone])

  // Reset OTP + Firebase when tab changes
  useEffect(() => {
    setOtpStep('idle')
    setOtpInput(['', '', '', '', '', ''])
    setOtpTimer(0)
    setError('')
    cleanupFirebase()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  // ── Web OTP API — auto-fill from SMS (Android Chrome) ───────────
  // Requires SMS format: "... @foodfi.in #XXXXXX" (origin-bound)
  // Fallback: autocomplete="one-time-code" on input handles iOS + Android
  useEffect(() => {
    if (otpStep !== 'sent') return
    if (typeof window === 'undefined' || !('OTPCredential' in window)) return
    const ac = new AbortController()
    navigator.credentials.get({ otp: { transport: ['sms'] }, signal: ac.signal })
      .then(otp => {
        if (otp?.code?.length === 6) {
          const arr = otp.code.split('')
          setOtpInput(arr)
          autoVerifyOtp(otp.code)
        }
      })
      .catch(() => {}) // user dismissed or not supported — silent
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

  // ── Send OTP ─────────────────────────────────────────────────────
  const sendOtp = async () => {
    if (!phoneReady) { setError('Please enter a valid 10-digit mobile number'); return }
    setError(''); setOtpStep('sending'); setOtpInput(['', '', '', '', '', ''])
    cleanupFirebase()
    try {
      const { getFirebaseAuth } = await import('@/lib/firebase-client')
      const { RecaptchaVerifier, signInWithPhoneNumber } = await import('firebase/auth')
      const auth = getFirebaseAuth()
      if (!auth) throw new Error('Firebase auth init failed')
      const verifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
        callback: () => {},
        'expired-callback': () => { cleanupFirebase() },
      })
      recaptchaVerifierRef.current = verifier
      const result = await signInWithPhoneNumber(auth, '+91' + phoneDigits, verifier)
      confirmationResultRef.current = result
      setOtpStep('sent')
      setOtpTimer(60)
      setTimeout(() => otpBoxRefs.current[0]?.focus(), 100)
    } catch (e) {
      console.error('Firebase OTP error:', e.code, e.message)
      cleanupFirebase()
      const msg = e.code === 'auth/too-many-requests'
        ? 'Is number pe bahut zyada OTP gaye. 10-15 min baad try karo.'
        : e.code === 'auth/invalid-phone-number'
        ? 'Invalid phone number. 10-digit Indian number daalo.'
        : e.code === 'auth/captcha-check-failed'
        ? 'reCAPTCHA fail hua. Page reload karke dobara try karo.'
        : e.code === 'auth/network-request-failed'
        ? 'Network error. Internet check karo.'
        : 'OTP nahi bheja ja saka. Dobara try karo.'
      setError(msg)
      setOtpStep('idle')
    }
  }

  // ── Auto-verify OTP ───────────────────────────────────────────────
  const autoVerifyOtp = async (otp) => {
    if (otpStep === 'verifying') return
    if (!confirmationResultRef.current) {
      setError('OTP bhejne ke baad fill karo. Pehle Send OTP dabaao.')
      return
    }
    setOtpStep('verifying'); setError('')
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
        setError(data.error || 'Login fail hua. Dobara try karo.')
        setOtpStep('sent')
        setOtpInput(['', '', '', '', '', ''])
        setTimeout(() => otpBoxRefs.current[0]?.focus(), 100)
        return
      }
      const { user } = data
      if (!user) {
        setError('Login nahi hua. Dobara try karo.')
        setOtpStep('sent'); setOtpInput(['','','','','',''])
        return
      }
      if (data.newUser) {
        pendingUserRef.current = user
        setShowNameModal(true)
        setTimeout(() => nameInputRef.current?.focus(), 350)
        return
      }
      if (user.role === 'admin') router.push('/admin')
      else if (user.role === 'delivery') router.push('/delivery')
      else router.push('/menu')
    } catch (e) {
      const msg = e.code === 'auth/invalid-verification-code' ? 'Galat OTP. Dobara check karo.'
        : e.code === 'auth/code-expired' ? 'OTP expire ho gaya. Resend karo.'
        : 'OTP verify nahi hua. Dobara try karo.'
      setError(msg)
      setOtpStep('sent')
      setOtpInput(['', '', '', '', '', ''])
      setTimeout(() => otpBoxRefs.current[0]?.focus(), 100)
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
    if (u?.role === 'admin') router.push('/admin')
    else if (u?.role === 'delivery') router.push('/delivery')
    else router.push('/menu')
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

  return (
    <div style={{ minHeight: '100vh', background: '#0f0500', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', position: 'relative' }}>
    <div style={{ width: '100%', maxWidth: 480, minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative', boxShadow: '0 0 80px rgba(0,0,0,0.6)' }}>

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
              <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1a1a1a', margin: '0 0 6px' }}>FoodFi mein Welcome!</h2>
              <p style={{ fontSize: 13, color: '#6b7280', margin: 0, lineHeight: 1.5 }}>Bas naam aur address batao — order karo!</p>
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
                <div style={{ marginTop: 6, fontSize: 11, color: '#16a34a', fontWeight: 600 }}>✅ Address mil gaya — edit bhi kar sakte ho</div>
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
                ? <><span className="spinner" /> Saving...</>
                : <>FoodFi pe Chalo! 🍛</>}
            </button>
            {!newUserName.trim() && (
              <p style={{ textAlign: 'center', fontSize: 12, color: '#9ca3af', marginTop: 10 }}>Naam zaroori hai — address baad mein bhi de sakte hain</p>
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
            Ghar jaisa swad, aapke darwaazon tak 🍛
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
                <div style={{ fontSize: 15, fontWeight: 800, color: '#111827' }}>OTP Verify Karo</div>
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
                    <span className="spinner" /> OTP bheja ja raha hai...
                  </div>
                </div>
              )}

              {/* Sent / Verifying state */}
              {(otpStep === 'sent' || otpStep === 'verifying') && (
                <>
                  <p style={{ fontSize: 14, color: '#374151', margin: '0 0 6px', fontWeight: 600, textAlign: 'center' }}>
                    OTP bheja gaya 📲
                  </p>
                  <p style={{ fontSize: 13, color: '#9ca3af', margin: '0 0 32px', textAlign: 'center', lineHeight: 1.5 }}>
                    +91 {phoneDigits} par aaye SMS ka<br/>
                    <strong style={{ color: '#e85d04' }}>6-digit OTP</strong> enter karo — auto verify hoga ✨
                  </p>

                  {/* 6 OTP Boxes */}
                  <div
                    style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 28 }}
                    onPaste={handleOtpPaste}
                  >
                    {otpInput.map((digit, i) => (
                      <input key={i}
                        ref={el => otpBoxRefs.current[i] = el}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        // autocomplete="one-time-code" on first box → browser/iOS shows OTP suggestion
                        autoComplete={i === 0 ? 'one-time-code' : 'off'}
                        value={digit}
                        onChange={e => handleOtpBox(i, e.target.value)}
                        onKeyDown={e => handleOtpKeyDown(i, e)}
                        disabled={otpStep === 'verifying'}
                        style={{
                          width: 46, height: 58, textAlign: 'center',
                          fontSize: 24, fontWeight: 800,
                          border: digit ? '2.5px solid #f97316' : '2px solid #e5e7eb',
                          borderRadius: 12, outline: 'none',
                          background: otpStep === 'verifying' ? '#f9fafb' : digit ? '#fff7ed' : '#fff',
                          color: '#1f2937', transition: 'all 0.15s',
                          boxShadow: digit ? '0 0 0 4px rgba(249,115,22,0.12)' : 'none',
                          opacity: otpStep === 'verifying' ? 0.7 : 1,
                        }}
                      />
                    ))}
                  </div>

                  {/* Verifying indicator */}
                  {otpStep === 'verifying' && (
                    <div style={{ textAlign: 'center', marginBottom: 20 }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 20, padding: '8px 18px' }}>
                        <span className="spinner" />
                        <span style={{ fontSize: 13, color: '#92400e', fontWeight: 600 }}>Verify ho raha hai...</span>
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
                      Number change karna hai?
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
            <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>
              Mobile Number
            </label>
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
                  👆 Upar apna mobile number daalo
                </div>
              )}
              {phoneReady && (
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
              )}
              {error && <div className={styles.error}>{error}</div>}
            </div>
          )}

          {/* ── PASSWORD TAB ── */}
          {tab === 'password' && (
            <form onSubmit={handlePasswordLogin}>
              {!phoneReady && (
                <div style={{ textAlign: 'center', padding: '10px 0 6px', fontSize: 13, color: '#9ca3af' }}>
                  👆 Upar apna mobile number daalo
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
                  <div style={{ textAlign: 'right', marginBottom: 14 }}>
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
            <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 500 }}>ya phir</span>
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
            👀 Guest ke roop mein browse karo
          </button>
          <p style={{ margin: '6px 0 0', fontSize: 11, color: '#9ca3af', textAlign: 'center' }}>
            Login ke bina menu dekho — checkout pe naam + address dena hoga
          </p>

          {/* Footer */}
          <div style={{ borderTop: '1px solid #f3f4f6', marginTop: 18, paddingTop: 14 }}>
            <p style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center', margin: '0 0 10px' }}>
              Admin aur Delivery Boy bhi yahan login kar sakte hain
            </p>
            <div style={{ textAlign: 'center' }}>
              <button onClick={() => router.push('/delivery/apply')}
                style={{ background: 'none', border: '1.5px solid #e85d04', color: '#e85d04', borderRadius: 8, padding: '8px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                🛵 Delivery Partner Apply Karo
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
    </div>
  )
}

'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import styles from '../login/login.module.css'
import FoodFiLogo from '../components/FoodFiLogo'

function detectType(val) {
  if (!val) return 'unknown'
  if (val.includes('@') || /[a-zA-Z]/.test(val)) return 'email'
  if (/^[0-9]+$/.test(val)) return 'phone'
  return 'unknown'
}

export default function ForgotPasswordPage() {
  const router = useRouter()

  const [identifier, setIdentifier] = useState('')
  const loginType = detectType(identifier)
  const phoneDigits = identifier.replace(/[^0-9]/g, '')
  const phoneReady = phoneDigits.length === 10
  const emailReady = identifier.includes('@') && identifier.includes('.')

  // Steps: 'idle' → 'sending' → 'sent' → 'verifying' → 'verified' (shows password form) → 'done'
  const [otpStep, setOtpStep] = useState('idle')
  const [otpInput, setOtpInput] = useState(['', '', '', '', '', ''])
  const [otpTimer, setOtpTimer] = useState(0)
  const otpBoxRefs = useRef([])
  const timerRef = useRef(null)

  // Firebase phone OTP
  const recaptchaVerifierRef = useRef(null)
  const confirmationResultRef = useRef(null)
  const recaptchaContainerRef = useRef(null)

  // After OTP verified — reset token + new password form
  const [resetToken, setResetToken] = useState(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Timer countdown
  useEffect(() => {
    if (otpTimer > 0) {
      timerRef.current = setTimeout(() => setOtpTimer(t => t - 1), 1000)
    }
    return () => clearTimeout(timerRef.current)
  }, [otpTimer])

  const otpString = otpInput.join('')

  const handleIdentifierChange = (val) => {
    const type = detectType(val)
    if (type === 'phone') {
      val = val.replace(/[^0-9]/g, '')
      if (val.length > 10) return
    }
    setIdentifier(val)
    setError('')
    if (otpStep !== 'idle') {
      setOtpStep('idle')
      setOtpInput(['', '', '', '', '', ''])
      confirmationResultRef.current = null
    }
  }

  // 6 OTP boxes
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

  // ── Full Firebase + recaptcha cleanup ──────────────────────────
  const cleanupFirebase = async () => {
    if (recaptchaVerifierRef.current) {
      try { recaptchaVerifierRef.current.clear() } catch(e) {}
      recaptchaVerifierRef.current = null
    }
    confirmationResultRef.current = null
    try {
      const { getFirebaseAuth } = await import('@/lib/firebase-client')
      const auth = getFirebaseAuth()
      if (auth) await auth.signOut()
    } catch(e) {}
    try {
      const el = document.getElementById('fp-recaptcha-container')
      if (el) el.innerHTML = ''
    } catch(e) {}
  }

  // ── SEND OTP ────────────────────────────────────────────────────
  const sendOtp = async () => {
    if (loginType === 'phone' && !phoneReady) { setError('Valid 10-digit phone number do'); return }
    if (loginType === 'email' && !emailReady) { setError('Valid email address do'); return }
    if (loginType === 'unknown') { setError('Email ya phone number do'); return }

    setError(''); setLoading(true); setOtpStep('sending')
    setOtpInput(['', '', '', '', '', ''])

    // Full cleanup before every attempt
    await cleanupFirebase()

    try {
      if (loginType === 'phone') {
        const { getFirebaseAuth } = await import('@/lib/firebase-client')
        const { RecaptchaVerifier, signInWithPhoneNumber } = await import('firebase/auth')
        const auth = getFirebaseAuth()
        if (!auth) throw new Error('Firebase init failed')

        const verifier = new RecaptchaVerifier(auth, 'fp-recaptcha-container', {
          size: 'invisible',
          callback: () => {},
          'expired-callback': () => { cleanupFirebase().catch(() => {}) }
        })
        recaptchaVerifierRef.current = verifier
        const result = await signInWithPhoneNumber(auth, '+91' + phoneDigits, verifier)
        confirmationResultRef.current = result
      } else {
        // Email OTP via our API
        const res = await fetch('/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'send-reset-otp', email: identifier })
        })
        const data = await res.json()
        if (!res.ok) { setError(data.error || 'OTP nahi bheja ja saka'); setOtpStep('idle'); return }
      }
      setOtpStep('sent')
      setOtpTimer(60)
      setTimeout(() => otpBoxRefs.current[0]?.focus(), 100)
    } catch (e) {
      console.error('Send OTP error:', e)
      await cleanupFirebase()
      const msg = e.code === 'auth/too-many-requests' ? 'Bahut zyada attempts. 10-15 min baad try karo.'
        : e.code === 'auth/captcha-check-failed' || e.code === 'auth/internal-error' ? 'Dobara try karo.'
        : 'OTP nahi bheja ja saka. Dobara try karo.'
      setError(msg)
      setOtpStep('idle')
    } finally { setLoading(false) }
  }

  // ── VERIFY OTP ──────────────────────────────────────────────────
  const verifyOtp = async () => {
    if (otpString.length !== 6) { setError('6-digit OTP daalo'); return }
    setError(''); setOtpStep('verifying'); setLoading(true)
    try {
      let token = null

      if (loginType === 'phone') {
        const result = await confirmationResultRef.current.confirm(otpString)
        const firebaseToken = await result.user.getIdToken()
        const res = await fetch('/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'forgot-password-phone', phone: '+91' + phoneDigits, firebaseToken })
        })
        const data = await res.json()
        if (!res.ok || !data.token) { setError(data.error || 'Account nahi mila is number se.'); setOtpStep('sent'); return }
        token = data.token
      } else {
        const res = await fetch('/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'verify-reset-otp', email: identifier, otp: otpString })
        })
        const data = await res.json()
        if (!res.ok || !data.token) { setError(data.error || 'OTP galat hai.'); setOtpStep('sent'); return }
        token = data.token
      }

      setResetToken(token)
      setOtpStep('verified')
    } catch (e) {
      console.error('Verify OTP error:', e)
      const msg = e.code === 'auth/invalid-verification-code' ? 'Galat OTP. Dobara check karo.'
        : e.code === 'auth/code-expired' ? 'OTP expire ho gaya. Resend karo.'
        : 'OTP verify nahi hua. Dobara try karo.'
      setError(msg)
      setOtpStep('sent')
    } finally { setLoading(false) }
  }

  // ── SAVE NEW PASSWORD ───────────────────────────────────────────
  const savePassword = async (e) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) { setError('Dono passwords match nahi kar rahe'); return }
    if (newPassword.length < 6) { setError('Password kam se kam 6 characters ka hona chahiye'); return }
    setError(''); setSaving(true)
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset-password', token: resetToken, newPassword })
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Password reset nahi hua.'); return }
      setDone(true)
    } catch { setError('Kuch gadbad ho gayi. Dobara try karo.') }
    finally { setSaving(false) }
  }

  // ── Identifier prefix display ────────────────────────────────────
  const prefix = loginType === 'phone'
    ? <span style={{ padding:'10px 12px', background:'#f3f4f6', border:'1.5px solid var(--bdr)', borderRight:'none', borderRadius:'8px 0 0 8px', fontSize:14, color:'#374151', fontWeight:600, whiteSpace:'nowrap', display:'flex', alignItems:'center' }}>🇮🇳 +91</span>
    : loginType === 'email'
    ? <span style={{ padding:'10px 12px', background:'#f3f4f6', border:'1.5px solid var(--bdr)', borderRight:'none', borderRadius:'8px 0 0 8px', fontSize:16, display:'flex', alignItems:'center' }}>📧</span>
    : <span style={{ padding:'10px 12px', background:'#f3f4f6', border:'1.5px solid var(--bdr)', borderRight:'none', borderRadius:'8px 0 0 8px', fontSize:13, color:'#9ca3af', display:'flex', alignItems:'center' }}>@/📱</span>

  return (
    <div className={styles.wrap}>
      <div id="fp-recaptcha-container" ref={recaptchaContainerRef} />

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

        {/* ── DONE ── */}
        {done ? (
          <div style={{ textAlign:'center', padding:'16px 0' }}>
            <div style={{ fontSize:52, marginBottom:12 }}>✅</div>
            <h3 style={{ color:'#1f2937', marginBottom:8, fontSize:18 }}>Password badal gaya!</h3>
            <p style={{ color:'#6b7280', fontSize:14 }}>Ab naye password se login karein.</p>
            <button className="btn btn-primary btn-full" style={{ marginTop:20 }} onClick={() => router.push('/login')}>
              Login Karein →
            </button>
          </div>
        ) : resetToken ? (
          /* ── NEW PASSWORD FORM (after OTP verified) ── */
          <>
            <div style={{ background:'#f0fdf4', border:'1.5px solid #86efac', borderRadius:10, padding:'10px 14px', marginBottom:16, display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:20 }}>✅</span>
              <span style={{ fontSize:13, color:'#16a34a', fontWeight:700 }}>Verify ho gaya! Naya password set karein.</span>
            </div>
            <form onSubmit={savePassword}>
              <div className="field">
                <label>Naya Password</label>
                <input type="password" required value={newPassword} onChange={e => setNewPassword(e.target.value)}
                  placeholder="••••••••" minLength={6} autoFocus />
              </div>
              <div className="field">
                <label>Password Confirm Karein</label>
                <input type="password" required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="••••••••" minLength={6} />
              </div>
              {error && <div className={styles.error}>{error}</div>}
              <button type="submit" className="btn btn-primary btn-full" disabled={saving}>
                {saving ? <span className="spinner" /> : '🔐 Password Save Karein'}
              </button>
            </form>
          </>
        ) : (
          /* ── IDENTIFIER + OTP FLOW ── */
          <>
            <p style={{ fontSize:13, color:'#6b7280', marginBottom:16, lineHeight:1.6 }}>
              Registered email ya mobile number daalo — OTP se verify karke password reset karo.
            </p>

            {/* Identifier input */}
            <div className="field">
              <label style={{ display:'flex', alignItems:'center', gap:6 }}>
                Email ya Mobile Number
                {loginType === 'phone' && <span style={{ fontSize:11, background:'#fff7ed', color:'#e85d04', border:'1px solid #fed7aa', borderRadius:4, padding:'1px 6px', fontWeight:600 }}>📱 Mobile</span>}
                {loginType === 'email' && <span style={{ fontSize:11, background:'#eff6ff', color:'#2563eb', border:'1px solid #bfdbfe', borderRadius:4, padding:'1px 6px', fontWeight:600 }}>📧 Email</span>}
              </label>
              <div style={{ display:'flex' }}>
                {prefix}
                <input
                  type={loginType === 'email' ? 'email' : 'text'}
                  value={identifier}
                  onChange={e => handleIdentifierChange(e.target.value)}
                  placeholder={loginType === 'phone' ? '98765 43210' : loginType === 'email' ? 'you@email.com' : 'Email ya 10-digit mobile...'}
                  maxLength={loginType === 'phone' ? 10 : 100}
                  inputMode={loginType === 'phone' ? 'numeric' : 'email'}
                  disabled={otpStep === 'sent' || otpStep === 'verifying'}
                  style={{ borderRadius:'0 8px 8px 0', borderLeft:'none', flex:1 }}
                  autoFocus
                />
              </div>
            </div>

            {/* OTP Box — shown after sent */}
            {(otpStep === 'sent' || otpStep === 'verifying') && (
              <div style={{ background:'#fff7ed', border:'1.5px solid #fed7aa', borderRadius:12, padding:'16px', marginBottom:12 }}>
                <p style={{ margin:'0 0 12px 0', fontSize:13, color:'#92400e', fontWeight:600, textAlign:'center' }}>
                  {loginType === 'email'
                    ? `📧 OTP ${identifier} pe bheja gaya`
                    : `📲 OTP +91${phoneDigits} pe bheja gaya`}
                </p>

                {/* 6 individual OTP boxes */}
                <div style={{ display:'flex', gap:8, justifyContent:'center', marginBottom:14 }} onPaste={handleOtpPaste}>
                  {otpInput.map((digit, i) => (
                    <input
                      key={i}
                      ref={el => otpBoxRefs.current[i] = el}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
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
                <button
                  type="button"
                  onClick={verifyOtp}
                  disabled={otpString.length !== 6 || loading}
                  style={{
                    width:'100%', padding:'13px', fontSize:15, fontWeight:700, border:'none',
                    borderRadius:10, cursor: otpString.length === 6 ? 'pointer' : 'not-allowed',
                    background: otpString.length === 6 ? '#16a34a' : '#d1d5db',
                    color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                    transition:'background 0.2s',
                  }}>
                  {loading && otpStep === 'verifying'
                    ? <><span className="spinner" /> Verify ho raha hai...</>
                    : <><span style={{ fontSize:18 }}>✓</span> OTP Verify Karo</>}
                </button>

                <div style={{ marginTop:10, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontSize:12, color:'#9ca3af' }}>
                    {loginType === 'email' ? '10 min' : '5 min'} mein expire hoga
                  </span>
                  {otpTimer > 0
                    ? <span style={{ fontSize:12, color:'#9ca3af' }}>Resend {otpTimer}s mein</span>
                    : <button type="button" onClick={sendOtp}
                        style={{ fontSize:12, color:'#e85d04', background:'none', border:'none', cursor:'pointer', fontWeight:600 }}>
                        🔄 Resend OTP
                      </button>
                  }
                </div>
              </div>
            )}

            {error && <div className={styles.error}>{error}</div>}

            {/* Main CTA button */}
            {otpStep === 'idle' && (
              <button
                type="button"
                onClick={sendOtp}
                disabled={loading || (loginType === 'phone' ? !phoneReady : loginType === 'email' ? !emailReady : true)}
                className="btn btn-primary btn-full">
                {loading
                  ? <span className="spinner" />
                  : loginType === 'phone' ? '📱 OTP Bhejo'
                  : loginType === 'email' ? '📧 OTP Bhejo'
                  : 'OTP Bhejo'}
              </button>
            )}

            {otpStep === 'sending' && (
              <button className="btn btn-primary btn-full" disabled>
                <span className="spinner" /> OTP bheja ja raha hai...
              </button>
            )}
          </>
        )}

        <p className={styles.switchMode}>
          <button onClick={() => router.push('/login')}>← Login pe wapas jao</button>
        </p>
      </div>
    </div>
  )
}

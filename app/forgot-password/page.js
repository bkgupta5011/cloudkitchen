'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import styles from '../login/login.module.css'
import FoodFiLogo from '../components/FoodFiLogo'

export default function ForgotPasswordPage() {
  const router = useRouter()

  // mode: 'email' | 'phone'
  const [mode, setMode] = useState('email')
  const [input, setInput] = useState('')       // email or phone digits
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Email flow
  const [emailSent, setEmailSent] = useState(false)

  // Phone / OTP flow
  const [otpStep, setOtpStep] = useState('idle') // idle | sending | sent | verifying | verified
  const [otpInput, setOtpInput] = useState('')
  const [otpTimer, setOtpTimer] = useState(0)
  const timerRef = useRef(null)
  const otpInputRef = useRef(null)
  const confirmationResultRef = useRef(null)

  const switchMode = (m) => {
    setMode(m); setInput(''); setError('')
    setOtpStep('idle'); setOtpInput(''); setOtpTimer(0)
    confirmationResultRef.current = null
    if (timerRef.current) clearTimeout(timerRef.current)
  }

  const startTimer = () => {
    setOtpTimer(60)
    const tick = () => setOtpTimer(t => { if (t <= 1) return 0; timerRef.current = setTimeout(tick, 1000); return t - 1 })
    timerRef.current = setTimeout(tick, 1000)
  }

  // ── EMAIL FLOW ──────────────────────────────────────────────────
  const handleEmailSubmit = async (e) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'forgot-password', email: input })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error || 'Kuch gadbad ho gayi.'); return }
      setEmailSent(true)
    } catch (e) {
      setError('Network error: ' + e.message)
    } finally { setLoading(false) }
  }

  // ── PHONE / OTP FLOW ────────────────────────────────────────────
  const phoneDigits = input.replace(/[^0-9]/g, '')
  const phoneReady = phoneDigits.length === 10

  const getRecaptchaVerifier = async () => {
    const { getFirebaseAuth } = await import('@/lib/firebase-client')
    const { RecaptchaVerifier } = await import('firebase/auth')
    const auth = getFirebaseAuth()
    if (!auth) throw new Error('Firebase init failed')
    const verifier = new RecaptchaVerifier(auth, 'fp-recaptcha-container', {
      size: 'invisible', callback: () => {}
    })
    return { auth, verifier }
  }

  const sendOtp = async () => {
    if (!phoneReady) { setError('Valid 10-digit phone number do'); return }
    setError(''); setOtpStep('sending')
    try {
      const { signInWithPhoneNumber } = await import('firebase/auth')
      const { auth, verifier } = await getRecaptchaVerifier()
      const result = await signInWithPhoneNumber(auth, '+91' + phoneDigits, verifier)
      confirmationResultRef.current = result
      setOtpStep('sent')
      startTimer()
      setTimeout(() => otpInputRef.current?.focus(), 100)
    } catch (e) {
      console.error('OTP send error:', e)
      setError('OTP nahi bheja ja saka. Dobara try karo.')
      setOtpStep('idle')
    }
  }

  const verifyOtp = async () => {
    if (otpInput.length !== 6) { setError('6-digit OTP daalo'); return }
    setError(''); setOtpStep('verifying')
    try {
      const result = await confirmationResultRef.current.confirm(otpInput)
      const firebaseToken = await result.user.getIdToken()
      setOtpStep('verified')

      // Ask backend to generate a reset token for this phone
      setLoading(true)
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'forgot-password-phone', phone: '+91' + phoneDigits, firebaseToken })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.token) {
        setError(data.error || 'Account nahi mila is number se.')
        setOtpStep('sent')
        return
      }
      // Redirect to reset-password with the token
      router.push('/reset-password?token=' + data.token)
    } catch (e) {
      const msg = e.code === 'auth/invalid-verification-code' ? 'Galat OTP. Dobara check karo.'
        : e.code === 'auth/code-expired' ? 'OTP expire ho gaya. Resend karo.'
        : 'OTP verify nahi hua.'
      setError(msg)
      setOtpStep('sent')
    } finally { setLoading(false) }
  }

  const handlePhoneSubmit = async (e) => {
    e.preventDefault()
    if (otpStep === 'idle') { await sendOtp(); return }
    if (otpStep === 'sent') { setError('Pehle OTP verify karo 👇'); return }
  }

  // ── RENDER ──────────────────────────────────────────────────────
  return (
    <div className={styles.wrap}>
      <div id="fp-recaptcha-container" />

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

        {/* Email sent success */}
        {emailSent ? (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📧</div>
            <h3 style={{ color: '#1f2937', marginBottom: 8 }}>Email bhej di gayi!</h3>
            <p style={{ color: '#6b7280', fontSize: 14, lineHeight: 1.6 }}>
              <strong>{input}</strong> pe password reset link bheja gaya hai.<br />
              Apna inbox check karein (Spam bhi dekh lein).
            </p>
            <button className="btn btn-primary btn-full" style={{ marginTop: 20 }} onClick={() => router.push('/login')}>
              Login Page pe Jao
            </button>
          </div>
        ) : (
          <>
            {/* Mode toggle */}
            <div style={{ display:'flex', gap:0, marginBottom:16, borderRadius:8, overflow:'hidden', border:'1.5px solid var(--bdr)' }}>
              {[['email','📧 Email'],['phone','📱 Phone']].map(([m, label]) => (
                <button key={m} type="button"
                  onClick={() => switchMode(m)}
                  style={{ flex:1, padding:'9px', border:'none', background: mode===m ? '#e85d04' : '#fff', color: mode===m ? '#fff' : '#6b7280', fontWeight:600, cursor:'pointer', fontSize:13 }}>
                  {label}
                </button>
              ))}
            </div>

            {/* EMAIL mode */}
            {mode === 'email' && (
              <form onSubmit={handleEmailSubmit}>
                <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 14, lineHeight: 1.6 }}>
                  Registered email daalo — reset link bhej denge.
                </p>
                <div className="field">
                  <label>Email Address</label>
                  <input type="email" value={input} onChange={e => setInput(e.target.value)}
                    placeholder="you@email.com" required />
                </div>
                {error && <div className={styles.error}>{error}</div>}
                <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
                  {loading ? <span className="spinner" /> : '📧 Reset Link Bhejo'}
                </button>
              </form>
            )}

            {/* PHONE mode */}
            {mode === 'phone' && (
              <form onSubmit={handlePhoneSubmit}>
                <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 14, lineHeight: 1.6 }}>
                  Registered phone number daalo — OTP se verify karke password reset karo.
                </p>

                <div className="field">
                  <label>Phone Number</label>
                  <div style={{ display:'flex', gap:0 }}>
                    <span style={{ padding:'10px 12px', background:'#f3f4f6', border:'1.5px solid var(--bdr)', borderRight:'none', borderRadius:'8px 0 0 8px', fontSize:14, color:'#374151', fontWeight:600, whiteSpace:'nowrap' }}>
                      🇮🇳 +91
                    </span>
                    <input
                      value={input}
                      onChange={e => { setInput(e.target.value.replace(/[^0-9]/g,'')); if (otpStep !== 'idle') { setOtpStep('idle'); setOtpInput('') } }}
                      placeholder="98765 43210"
                      maxLength={10}
                      required
                      disabled={otpStep === 'verified'}
                      style={{ borderRadius:'0 8px 8px 0', borderLeft:'none' }}
                    />
                  </div>
                </div>

                {/* OTP box */}
                {(otpStep === 'sent' || otpStep === 'verifying') && (
                  <div style={{ background:'#fff7ed', border:'1.5px solid #fed7aa', borderRadius:10, padding:'14px 14px 10px', marginBottom:12 }}>
                    <p style={{ margin:'0 0 10px 0', fontSize:13, color:'#92400e', fontWeight:600 }}>
                      📲 OTP +91{phoneDigits} pe bheja gaya
                    </p>
                    <div style={{ display:'flex', gap:8 }}>
                      <input
                        ref={otpInputRef}
                        value={otpInput}
                        onChange={e => setOtpInput(e.target.value.replace(/[^0-9]/g,''))}
                        placeholder="6-digit OTP"
                        maxLength={6}
                        style={{ flex:1, textAlign:'center', letterSpacing:6, fontSize:20, fontWeight:700, padding:'10px 8px', border:'2px solid #f97316', borderRadius:8, outline:'none' }}
                      />
                      <button type="button" onClick={verifyOtp}
                        disabled={otpInput.length !== 6 || otpStep === 'verifying' || loading}
                        style={{ background: otpInput.length === 6 ? '#16a34a' : '#d1d5db', color:'#fff', border:'none', borderRadius:8, padding:'10px 16px', fontWeight:700, fontSize:14, cursor: otpInput.length === 6 ? 'pointer' : 'default', whiteSpace:'nowrap', minWidth:80 }}>
                        {otpStep === 'verifying' || loading ? <span className="spinner" /> : 'Verify'}
                      </button>
                    </div>
                    <div style={{ marginTop:8, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <span style={{ fontSize:12, color:'#9ca3af' }}>OTP 5 minute mein expire hoga</span>
                      {otpTimer > 0
                        ? <span style={{ fontSize:12, color:'#9ca3af' }}>Resend: {otpTimer}s</span>
                        : <button type="button" onClick={sendOtp} style={{ fontSize:12, color:'#e85d04', background:'none', border:'none', cursor:'pointer', fontWeight:600 }}>Resend OTP</button>
                      }
                    </div>
                  </div>
                )}

                {/* Verified state */}
                {otpStep === 'verified' && (
                  <div style={{ background:'#f0fdf4', border:'1.5px solid #86efac', borderRadius:10, padding:'10px 14px', marginBottom:12, display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ fontSize:18 }}>✅</span>
                    <span style={{ fontSize:13, color:'#16a34a', fontWeight:600 }}>Verified! Reset page pe ja rahe hain...</span>
                  </div>
                )}

                {error && <div className={styles.error}>{error}</div>}

                {otpStep === 'idle' && (
                  <button type="submit" className="btn btn-primary btn-full" disabled={!phoneReady || otpStep === 'sending'}>
                    {otpStep === 'sending' ? <span className="spinner" /> : '📱 OTP Bhejo'}
                  </button>
                )}
              </form>
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

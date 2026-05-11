'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import styles from './login.module.css'
import FoodFiLogo from '../components/FoodFiLogo'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState('login')
  const [loginType, setLoginType] = useState('phone') // phone | email
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ name:'', email:'', phone:'', password:'', address:'' })

  // OTP states
  const [otpStep, setOtpStep] = useState('idle') // idle | sending | sent | verifying | verified
  const [otpInput, setOtpInput] = useState('')
  const [otpTimer, setOtpTimer] = useState(0)
  const timerRef = useRef(null)
  const otpInputRef = useRef(null)

  useEffect(() => {
    fetch('/api/auth', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'me' }) })
      .then(r => r.json())
      .then(({ user }) => {
        if (user?.role === 'admin') router.push('/admin')
        else if (user?.role === 'delivery') router.push('/delivery')
        else if (user?.role === 'customer') router.push('/menu')
      })
  }, [])

  // Countdown timer for resend OTP
  useEffect(() => {
    if (otpTimer > 0) {
      timerRef.current = setTimeout(() => setOtpTimer(t => t - 1), 1000)
    }
    return () => clearTimeout(timerRef.current)
  }, [otpTimer])

  // Reset OTP state when switching mode or loginType
  useEffect(() => {
    setOtpStep('idle')
    setOtpInput('')
    setOtpTimer(0)
  }, [mode, loginType])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const phoneDigits = form.phone.replace(/[^0-9]/g, '')
  const isPhoneSignup = mode === 'signup' && loginType === 'phone'
  const phoneReady = phoneDigits.length === 10

  // Step 1 — Send OTP
  const sendOtp = async () => {
    if (!phoneReady) { setError('10-digit valid phone number do'); return }
    setError(''); setOtpStep('sending')
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneDigits })
      })
      const data = await res.json()
      if (!res.ok) {
        // OTP send failed (e.g. Twilio trial limit) — allow signup without phone verify
        setOtpStep('failed')
        setError('')
        return
      }
      setOtpStep('sent')
      setOtpTimer(60)
      setTimeout(() => otpInputRef.current?.focus(), 100)
    } catch { setOtpStep('failed'); setError('') }
  }

  // Step 2 — Verify OTP
  const verifyOtp = async () => {
    if (otpInput.length !== 6) { setError('6-digit OTP enter karo'); return }
    setError(''); setOtpStep('verifying')
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneDigits, otp: otpInput })
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); setOtpStep('sent'); return }
      setOtpStep('verified')
      setError('')
    } catch { setError('OTP verify nahi hua.'); setOtpStep('sent') }
  }

  // Final submit
  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    // If phone signup and OTP not yet verified — trigger OTP send
    if (isPhoneSignup && otpStep === 'idle') {
      if (!phoneReady) { setError('Valid 10-digit phone number do'); return }
      await sendOtp()
      return
    }

    // If phone signup and OTP sent but not verified
    if (isPhoneSignup && otpStep === 'sent') {
      setError('Pehle OTP verify karo 👇')
      return
    }

    // OTP failed — allow signup without phone verification
    // (phoneVerified will be false, backend accepts it)

    setLoading(true)
    try {
      const identifier = loginType === 'phone'
        ? (form.phone.startsWith('+91') ? form.phone : '+91' + phoneDigits)
        : form.email

      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: mode,
          role: 'customer',
          identifier,
          email: form.email,
          phone: loginType === 'phone' ? ('+91' + phoneDigits) : (form.phone ? '+91' + form.phone.replace(/[^0-9]/g,'').replace(/^91/,'') : ''),
          password: form.password,
          name: form.name,
          address: form.address,
          phoneVerified: otpStep === 'verified', // flag — OTP was successfully verified
        })
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

  // What to show on the submit button
  const submitLabel = () => {
    if (loading) return <span className="spinner" />
    if (mode === 'login') return 'Login'
    if (isPhoneSignup && otpStep === 'idle') return '📱 OTP Bhejo'
    if (isPhoneSignup && otpStep === 'sending') return <span className="spinner" />
    if (isPhoneSignup && otpStep === 'failed') return '✅ Account Banao (bina OTP)'
    return '✅ Account Banao'
  }

  return (
    <div className={styles.wrap}>
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
          <button className={mode==='login'?styles.active:''} onClick={() => { setMode('login'); setError('') }}>Login</button>
          <button className={mode==='signup'?styles.active:''} onClick={() => { setMode('signup'); setError('') }}>Sign Up</button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Sign up extra fields */}
          {mode === 'signup' && (
            <>
              <div className="field">
                <label>Full Name</label>
                <input required value={form.name} onChange={e => set('name', e.target.value)} placeholder="Rahul Kumar" />
              </div>
              <div className="field">
                <label>Default Delivery Address</label>
                <input value={form.address} onChange={e => set('address', e.target.value)} placeholder="Flat 4B, Frazer Road, Patna" />
              </div>
            </>
          )}

          {/* Email / Phone toggle */}
          <div style={{ display:'flex', gap:0, marginBottom:12, borderRadius:8, overflow:'hidden', border:'1.5px solid var(--bdr)' }}>
            {['email','phone'].map(t => (
              <button key={t} type="button"
                onClick={() => { setLoginType(t); setError('') }}
                style={{ flex:1, padding:'8px', border:'none', background: loginType===t ? '#e85d04' : '#fff', color: loginType===t ? '#fff' : '#6b7280', fontWeight:600, cursor:'pointer', fontSize:13 }}>
                {t==='email' ? '📧 Email' : '📱 Phone'}
              </button>
            ))}
          </div>

          {loginType === 'email' ? (
            <div className="field">
              <label>Email</label>
              <input type="email" required value={form.email} onChange={e => set('email', e.target.value)} placeholder="you@email.com" />
            </div>
          ) : (
            <div className="field">
              <label>Phone Number</label>
              <div style={{ display:'flex', gap:0 }}>
                <span style={{ padding:'10px 12px', background:'#f3f4f6', border:'1.5px solid var(--bdr)', borderRight:'none', borderRadius:'8px 0 0 8px', fontSize:14, color:'#374151', fontWeight:600, whiteSpace:'nowrap' }}>🇮🇳 +91</span>
                <input
                  required
                  value={form.phone}
                  onChange={e => { set('phone', e.target.value.replace(/[^0-9]/g,'')); if (otpStep !== 'idle') { setOtpStep('idle'); setOtpInput('') } }}
                  placeholder="98765 43210"
                  maxLength={10}
                  style={{ borderRadius:'0 8px 8px 0', borderLeft:'none' }}
                  disabled={otpStep === 'verified'}
                />
                {/* Verified badge */}
                {otpStep === 'verified' && (
                  <span style={{ padding:'10px 12px', background:'#dcfce7', border:'1.5px solid #86efac', borderLeft:'none', borderRadius:'0 8px 8px 0', fontSize:13, color:'#16a34a', fontWeight:700, whiteSpace:'nowrap' }}>
                    ✓ Verified
                  </span>
                )}
              </div>
            </div>
          )}

          {/* OTP Section — only during signup with phone */}
          {isPhoneSignup && otpStep === 'sent' && (
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
                <button
                  type="button"
                  onClick={verifyOtp}
                  disabled={otpInput.length !== 6 || otpStep === 'verifying'}
                  style={{ background: otpInput.length === 6 ? '#16a34a' : '#d1d5db', color:'#fff', border:'none', borderRadius:8, padding:'10px 16px', fontWeight:700, fontSize:14, cursor: otpInput.length === 6 ? 'pointer' : 'default', whiteSpace:'nowrap', minWidth:80 }}>
                  {otpStep === 'verifying' ? <span className="spinner" /> : 'Verify'}
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

          {/* OTP failed — allow skip */}
          {isPhoneSignup && otpStep === 'failed' && (
            <div style={{ background:'#fef9c3', border:'1.5px solid #fde047', borderRadius:10, padding:'10px 14px', marginBottom:12 }}>
              <p style={{ margin:'0 0 6px 0', fontSize:13, color:'#854d0e', fontWeight:600 }}>⚠️ OTP nahi bheja ja saka</p>
              <p style={{ margin:0, fontSize:12, color:'#78350f' }}>Phone verify nahi hoga, par account ban jayega. Baad mein verify kar sakte ho.</p>
            </div>
          )}

          {/* OTP verified success */}
          {isPhoneSignup && otpStep === 'verified' && (
            <div style={{ background:'#f0fdf4', border:'1.5px solid #86efac', borderRadius:10, padding:'10px 14px', marginBottom:12, display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:18 }}>✅</span>
              <span style={{ fontSize:13, color:'#16a34a', fontWeight:600 }}>Phone number verify ho gaya!</span>
            </div>
          )}

          {/* For signup, also collect the other field */}
          {mode === 'signup' && loginType === 'phone' && (
            <div className="field">
              <label>Email (optional)</label>
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="you@email.com" />
            </div>
          )}
          {mode === 'signup' && loginType === 'email' && (
            <div className="field">
              <label>Phone Number (optional)</label>
              <div style={{ display:'flex', gap:0 }}>
                <span style={{ padding:'10px 12px', background:'#f3f4f6', border:'1.5px solid var(--bdr)', borderRight:'none', borderRadius:'8px 0 0 8px', fontSize:14, color:'#374151', fontWeight:600 }}>🇮🇳 +91</span>
                <input value={form.phone} onChange={e => set('phone', e.target.value.replace(/[^0-9]/g,''))} placeholder="98765 43210" maxLength={10} style={{ borderRadius:'0 8px 8px 0', borderLeft:'none' }} />
              </div>
            </div>
          )}

          <div className="field">
            <label>Password</label>
            <input type="password" required value={form.password} onChange={e => set('password', e.target.value)} placeholder="••••••••" minLength={6} />
          </div>

          {mode === 'login' && (
            <div style={{ textAlign:'right', marginBottom:8 }}>
              <button type="button" onClick={() => router.push('/forgot-password')}
                style={{ background:'none', border:'none', color:'#e85d04', fontSize:13, cursor:'pointer' }}>
                Password bhool gaye?
              </button>
            </div>
          )}

          {error && <div className={styles.error}>{error}</div>}

          <button type="submit" className="btn btn-primary btn-full" disabled={loading || otpStep === 'sending' || otpStep === 'verifying'}>
            {submitLabel()}
          </button>
        </form>

        <p className={styles.switchMode}>
          {mode === 'login' ? 'Naya account?' : 'Pehle se account hai?'}{' '}
          <button onClick={() => { setMode(mode==='login'?'signup':'login'); setError('') }}>
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

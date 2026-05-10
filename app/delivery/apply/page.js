'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DeliveryApplyPage() {
  const router = useRouter()
  const [step, setStep] = useState(1) // 1: personal, 2: vehicle, 3: done
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: '', email: '', phone: '', password: '', confirmPassword: '',
    dateOfBirth: '', homeAddress: '', emergencyContact: '',
    vehicleType: 'Bike', vehicleNumber: '', licenseNumber: '', aadharNumber: '',
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (form.password !== form.confirmPassword) { setError('Passwords match nahi kar rahe'); return }
    if (form.password.length < 6) { setError('Password kam se kam 6 characters ka hona chahiye'); return }
    if (!form.phone || form.phone.length < 10) { setError('Valid phone number daalo'); return }
    setLoading(true)
    try {
      const phone = '+91' + form.phone.replace(/[^0-9]/g, '').slice(-10)
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'signup', role: 'delivery',
          name: form.name, email: form.email, phone,
          password: form.password,
          vehicleType: form.vehicleType,
          vehicleNumber: form.vehicleNumber,
          licenseNumber: form.licenseNumber,
          aadharNumber: form.aadharNumber,
          dateOfBirth: form.dateOfBirth || null,
          emergencyContact: form.emergencyContact,
          homeAddress: form.homeAddress,
        })
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      setStep(3)
    } catch { setError('Kuch gadbad ho gayi. Dobara try karo.') }
    finally { setLoading(false) }
  }

  if (step === 3) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#f9fafb' }}>
      <div style={{ background:'#fff', borderRadius:20, padding:'40px 32px', maxWidth:440, textAlign:'center', boxShadow:'0 4px 24px #0001' }}>
        <div style={{ fontSize:64, marginBottom:16 }}>✅</div>
        <h2 style={{ fontSize:22, fontWeight:800, marginBottom:8 }}>Application Submit Ho Gayi!</h2>
        <p style={{ color:'#6b7280', fontSize:14, marginBottom:24, lineHeight:1.6 }}>
          Aapki delivery boy application hamare admin ko bhej di gayi hai.<br/>
          <strong>Admin verify karke 24-48 ghante mein approve karega.</strong><br/>
          Approve hone ke baad aap login kar payenge.
        </p>
        <div style={{ background:'#fef3c7', borderRadius:12, padding:'12px 16px', fontSize:13, color:'#92400e', marginBottom:20 }}>
          ⚠️ Tab tak login karne ki koshish mat karo — ek message aayega ya admin se contact karo:<br/>
          <strong>+91 75469 83536</strong>
        </div>
        <button onClick={() => router.push('/login')} style={{ background:'#e85d04', color:'#fff', border:'none', borderRadius:10, padding:'12px 28px', fontWeight:700, cursor:'pointer', fontSize:15 }}>
          Login Page Pe Jao →
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background:'#f9fafb', padding:'24px 16px' }}>
      <div style={{ maxWidth:560, margin:'0 auto' }}>
        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:24 }}>
          <button onClick={() => router.push('/login')} style={{ background:'none', border:'1px solid #e5e7eb', borderRadius:8, padding:'6px 12px', cursor:'pointer', fontSize:13 }}>← Back</button>
          <div>
            <h1 style={{ fontSize:20, fontWeight:800, margin:0 }}>🛵 Delivery Boy Application</h1>
            <p style={{ fontSize:12, color:'#6b7280', margin:0 }}>FoodFi Cloud Kitchen · Patna</p>
          </div>
        </div>

        {/* Step indicator */}
        <div style={{ display:'flex', gap:8, marginBottom:24 }}>
          {['Personal Info', 'Vehicle & ID'].map((label, i) => (
            <div key={i} style={{ flex:1, padding:'8px 12px', borderRadius:10, background: step > i ? '#e85d04' : step === i+1 ? '#fff7ed' : '#f3f4f6', border: step === i+1 ? '2px solid #e85d04' : '2px solid transparent', textAlign:'center', fontSize:12, fontWeight:600, color: step > i ? '#fff' : step === i+1 ? '#e85d04' : '#9ca3af' }}>
              {step > i ? '✓ ' : `${i+1}. `}{label}
            </div>
          ))}
        </div>

        <form onSubmit={step === 1 ? (e) => { e.preventDefault(); setError(''); if(!form.name||!form.phone||!form.password) { setError('Sab required fields bharo'); return }; if(form.password!==form.confirmPassword){setError('Passwords match nahi kar rahe');return}; setStep(2) } : handleSubmit}>
          <div style={{ background:'#fff', borderRadius:16, padding:'24px 20px', boxShadow:'0 1px 8px #0001' }}>

            {/* Step 1: Personal Info */}
            {step === 1 && (
              <>
                <h3 style={{ fontSize:15, fontWeight:700, marginBottom:16, color:'#374151' }}>👤 Personal Information</h3>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <div style={{ gridColumn:'1/-1' }}>
                    <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:4 }}>Full Name *</label>
                    <input required value={form.name} onChange={e => set('name', e.target.value)} placeholder="Raju Kumar" style={{ width:'100%', padding:'10px 12px', borderRadius:8, border:'1.5px solid #e5e7eb', fontSize:14, boxSizing:'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:4 }}>Phone Number *</label>
                    <div style={{ display:'flex' }}>
                      <span style={{ padding:'10px 10px', background:'#f9fafb', border:'1.5px solid #e5e7eb', borderRight:'none', borderRadius:'8px 0 0 8px', fontSize:14, fontWeight:700, color:'#374151' }}>🇮🇳 +91</span>
                      <input required value={form.phone} onChange={e => set('phone', e.target.value.replace(/[^0-9]/g,''))} placeholder="98765 43210" maxLength={10} style={{ flex:1, padding:'10px 12px', borderRadius:'0 8px 8px 0', border:'1.5px solid #e5e7eb', borderLeft:'none', fontSize:14 }} />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:4 }}>Email (optional)</label>
                    <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="raju@email.com" style={{ width:'100%', padding:'10px 12px', borderRadius:8, border:'1.5px solid #e5e7eb', fontSize:14, boxSizing:'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:4 }}>Date of Birth</label>
                    <input type="date" value={form.dateOfBirth} onChange={e => set('dateOfBirth', e.target.value)} style={{ width:'100%', padding:'10px 12px', borderRadius:8, border:'1.5px solid #e5e7eb', fontSize:14, boxSizing:'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:4 }}>Password *</label>
                    <input required type="password" value={form.password} onChange={e => set('password', e.target.value)} placeholder="••••••••" minLength={6} style={{ width:'100%', padding:'10px 12px', borderRadius:8, border:'1.5px solid #e5e7eb', fontSize:14, boxSizing:'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:4 }}>Confirm Password *</label>
                    <input required type="password" value={form.confirmPassword} onChange={e => set('confirmPassword', e.target.value)} placeholder="••••••••" style={{ width:'100%', padding:'10px 12px', borderRadius:8, border:'1.5px solid #e5e7eb', fontSize:14, boxSizing:'border-box' }} />
                  </div>
                  <div style={{ gridColumn:'1/-1' }}>
                    <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:4 }}>Home Address *</label>
                    <textarea required value={form.homeAddress} onChange={e => set('homeAddress', e.target.value)} placeholder="Pura ghar ka address daalo" rows={2} style={{ width:'100%', padding:'10px 12px', borderRadius:8, border:'1.5px solid #e5e7eb', fontSize:14, boxSizing:'border-box', resize:'none' }} />
                  </div>
                  <div style={{ gridColumn:'1/-1' }}>
                    <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:4 }}>Emergency Contact Number *</label>
                    <div style={{ display:'flex' }}>
                      <span style={{ padding:'10px 10px', background:'#f9fafb', border:'1.5px solid #e5e7eb', borderRight:'none', borderRadius:'8px 0 0 8px', fontSize:14, fontWeight:700, color:'#374151' }}>🇮🇳 +91</span>
                      <input required value={form.emergencyContact} onChange={e => set('emergencyContact', e.target.value.replace(/[^0-9]/g,''))} placeholder="Family member ka number" maxLength={10} style={{ flex:1, padding:'10px 12px', borderRadius:'0 8px 8px 0', border:'1.5px solid #e5e7eb', borderLeft:'none', fontSize:14 }} />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Step 2: Vehicle & ID */}
            {step === 2 && (
              <>
                <h3 style={{ fontSize:15, fontWeight:700, marginBottom:16, color:'#374151' }}>🛵 Vehicle & Identity Verification</h3>
                <div style={{ background:'#fef3c7', borderRadius:10, padding:'10px 14px', marginBottom:16, fontSize:12, color:'#92400e' }}>
                  ⚠️ Ye details admin verify karega. Galat information dene par application reject ho sakti hai.
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <div>
                    <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:4 }}>Vehicle Type *</label>
                    <select required value={form.vehicleType} onChange={e => set('vehicleType', e.target.value)} style={{ width:'100%', padding:'10px 12px', borderRadius:8, border:'1.5px solid #e5e7eb', fontSize:14, boxSizing:'border-box' }}>
                      <option value="Bike">🏍️ Bike</option>
                      <option value="Scooter">🛵 Scooter</option>
                      <option value="Cycle">🚲 Cycle</option>
                      <option value="EV Scooter">⚡ EV Scooter</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:4 }}>Vehicle Number *</label>
                    <input required value={form.vehicleNumber} onChange={e => set('vehicleNumber', e.target.value.toUpperCase())} placeholder="BR 01 AB 1234" style={{ width:'100%', padding:'10px 12px', borderRadius:8, border:'1.5px solid #e5e7eb', fontSize:14, boxSizing:'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:4 }}>Driving License Number *</label>
                    <input required value={form.licenseNumber} onChange={e => set('licenseNumber', e.target.value.toUpperCase())} placeholder="BR-0120200012345" style={{ width:'100%', padding:'10px 12px', borderRadius:8, border:'1.5px solid #e5e7eb', fontSize:14, boxSizing:'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:4 }}>Aadhar Card Number *</label>
                    <input required value={form.aadharNumber} onChange={e => set('aadharNumber', e.target.value.replace(/[^0-9]/g,''))} placeholder="XXXX XXXX XXXX" maxLength={12} style={{ width:'100%', padding:'10px 12px', borderRadius:8, border:'1.5px solid #e5e7eb', fontSize:14, boxSizing:'border-box' }} />
                  </div>
                </div>
                <div style={{ background:'#f0fdf4', borderRadius:10, padding:'12px 14px', marginTop:16, fontSize:12, color:'#166534' }}>
                  ✅ Application submit hone ke baad:<br/>
                  1. Admin aapki details verify karega<br/>
                  2. 24-48 ghante mein approve/reject ka notification milega<br/>
                  3. Approve hone ke baad aap delivery portal use kar sakte ho
                </div>
              </>
            )}
          </div>

          {error && <div style={{ background:'#fef2f2', border:'1px solid #fca5a5', borderRadius:8, padding:'10px 14px', marginTop:12, fontSize:13, color:'#dc2626' }}>{error}</div>}

          <div style={{ display:'flex', gap:10, marginTop:16 }}>
            {step === 2 && <button type="button" onClick={() => setStep(1)} style={{ flex:1, padding:'13px', borderRadius:10, border:'1.5px solid #e5e7eb', background:'#fff', fontWeight:600, cursor:'pointer', fontSize:15 }}>← Back</button>}
            <button type="submit" disabled={loading} style={{ flex:2, padding:'13px', borderRadius:10, border:'none', background:'#e85d04', color:'#fff', fontWeight:700, cursor:'pointer', fontSize:15 }}>
              {loading ? '⏳ Submit ho raha hai...' : step === 1 ? 'Next: Vehicle Info →' : '✅ Application Submit Karo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

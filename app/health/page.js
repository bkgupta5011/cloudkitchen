'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const ACTIVITY = [
  { v: 'sedentary', mult: 1.2,   label: 'Sedentary — little or no exercise (desk job)' },
  { v: 'light',     mult: 1.375, label: 'Lightly active — light exercise 1–3 days/week' },
  { v: 'moderate',  mult: 1.55,  label: 'Moderately active — 3–5 days/week' },
  { v: 'very',      mult: 1.725, label: 'Very active — hard exercise 6–7 days/week' },
  { v: 'extra',     mult: 1.9,   label: 'Extra active — very hard / physical job' },
]
const GOALS = [
  { v: 'lose',     label: '🔻 Lose weight' },
  { v: 'maintain', label: '⚖️ Stay fit / maintain' },
  { v: 'gain',     label: '🔺 Gain weight / muscle' },
]

// ── Credible formulas: ICMR Indian BMI cut-offs, Mifflin-St Jeor BMR,
// activity-based TDEE, goal-based protein, macro split. Values are approximate
// general guidance — not medical advice.
function compute(p) {
  const w = Number(p.weight_kg), h = Number(p.height_cm), age = Number(p.age)
  const hM = h / 100
  const bmi = w / (hM * hM)
  // ICMR (Indian) categories
  let cat, catColor
  if (bmi < 18.5)      { cat = 'Underweight'; catColor = '#2563eb' }
  else if (bmi < 23)   { cat = 'Healthy';     catColor = '#16a34a' }
  else if (bmi < 25)   { cat = 'Overweight';  catColor = '#d97706' }
  else                 { cat = 'Obese';       catColor = '#dc2626' }

  const lo = 18.5 * hM * hM, hi = 22.9 * hM * hM
  let deltaText = 'You are within the healthy weight range 🎉', deltaKg = 0
  if (w > hi) { deltaKg = w - hi; deltaText = `${deltaKg.toFixed(1)} kg above the healthy range` }
  else if (w < lo) { deltaKg = lo - w; deltaText = `${deltaKg.toFixed(1)} kg below the healthy range` }

  // Mifflin-St Jeor BMR
  const bmr = 10 * w + 6.25 * h - 5 * age + (p.gender === 'male' ? 5 : -161)
  const mult = (ACTIVITY.find(a => a.v === p.activity) || ACTIVITY[0]).mult
  const tdee = bmr * mult

  // Calorie target by goal (safe deficit / floor)
  let cals
  if (p.goal === 'lose') cals = Math.max(p.gender === 'male' ? 1500 : 1200, tdee - 500)
  else if (p.goal === 'gain') cals = tdee + 400
  else cals = tdee
  cals = Math.round(cals / 10) * 10

  // Protein — reference weight avoids over-estimating for higher BMI
  const refW = bmi > 25 ? 22 * hM * hM : w
  const pFactor = p.goal === 'lose' ? 1.8 : p.goal === 'gain' ? 2.0 : 1.0
  const proteinG = Math.round(refW * pFactor)
  const fatG = Math.round((cals * 0.27) / 9)
  const carbsG = Math.max(0, Math.round((cals - proteinG * 4 - fatG * 9) / 4))
  const fiberG = 30
  const waterL = +(w * 35 / 1000).toFixed(1)

  // Indian waist risk (visceral fat)
  let waistRisk = null
  if (p.waist_cm) {
    const wc = Number(p.waist_cm)
    const limit = p.gender === 'male' ? 90 : 80
    if (wc >= limit) waistRisk = `High (waist ${wc} cm ≥ ${limit} cm)`
    else waistRisk = `Healthy (waist ${wc} cm)`
  }

  return { bmi: +bmi.toFixed(1), cat, catColor, lo: +lo.toFixed(1), hi: +hi.toFixed(1), deltaText,
    tdee: Math.round(tdee), cals, proteinG, carbsG, fatG, fiberG, waterL, waistRisk }
}

// Rank Fitness Corner meals against the customer's goal + calorie target.
function rankMeals(items, result, goal) {
  const perCals = (result?.cals || 1800) / 3   // ~3 meals/day
  const scored = (items || []).filter(it => Number(it.calories) > 0).map(it => {
    const cal = Number(it.calories), pro = Number(it.protein_g) || 0
    let score, reason
    if (goal === 'lose') {
      const density = pro / (cal / 100)                 // protein per 100 kcal
      score = density * 12 - Math.max(0, cal - perCals * 1.2) / 25
      reason = 'High protein · light on calories'
    } else if (goal === 'gain') {
      score = cal * 0.4 + pro * 3                        // calorie-dense + protein
      reason = 'Calorie-rich · high protein'
    } else {
      score = pro * 3 - Math.abs(cal - perCals) / 30     // balanced near per-meal
      reason = 'Balanced protein & calories'
    }
    return { ...it, _score: score, _reason: reason }
  })
  scored.sort((a, b) => b._score - a._score)
  return scored.slice(0, 6)
}

const EMPTY = { gender: '', age: '', height_cm: '', weight_kg: '', waist_cm: '', activity: 'moderate', goal: 'maintain' }
const inputStyle = { width: '100%', padding: '11px 12px', borderRadius: 10, border: '1px solid #d1d5db', fontSize: 14, outline: 'none', boxSizing: 'border-box', background: '#fff', color: '#111' }
const labelStyle = { fontSize: 12.5, fontWeight: 700, color: '#374151', marginBottom: 5, display: 'block' }

export default function MyHealth() {
  const router = useRouter()
  const [form, setForm] = useState(EMPTY)
  const [result, setResult] = useState(null)
  const [editing, setEditing] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [allMeals, setAllMeals] = useState([])

  useEffect(() => {
    fetch('/api/fitness?mode=suggest').then(r => r.json()).then(d => setAllMeals(d.items || [])).catch(() => {})
    fetch('/api/health').then(r => {
      if (r.status === 401) { router.push('/login'); return null }
      return r.json()
    }).then(d => {
      if (d?.profile) {
        const p = { gender: d.profile.gender || '', age: d.profile.age || '', height_cm: d.profile.height_cm || '',
          weight_kg: d.profile.weight_kg || '', waist_cm: d.profile.waist_cm || '', activity: d.profile.activity || 'moderate', goal: d.profile.goal || 'maintain' }
        setForm(p); setResult(compute(p)); setEditing(false)
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const save = async () => {
    setErr('')
    if (!form.gender) return setErr('Please select your gender')
    for (const [k, l] of [['age', 'age'], ['height_cm', 'height'], ['weight_kg', 'weight']]) {
      if (form[k] === '' || isNaN(Number(form[k]))) return setErr(`Please enter your ${l}`)
    }
    setSaving(true)
    const res = await fetch('/api/health', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    const d = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) return setErr(d.error || 'Could not save')
    setResult(compute(form)); setEditing(false)
  }

  const meals = result ? rankMeals(allMeals, result, form.goal) : []
  const goalWord = form.goal === 'lose' ? 'fat loss' : form.goal === 'gain' ? 'muscle gain' : 'staying fit'

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg,#f0fdf4,#ffffff 260px)', paddingBottom: 48 }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'linear-gradient(135deg,#065f46,#059669)', color: '#fff', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.push('/profile')} style={{ background: 'rgba(255,255,255,0.18)', border: 'none', color: '#fff', width: 34, height: 34, borderRadius: 10, fontSize: 18, cursor: 'pointer' }}>←</button>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>💚 My Health</div>
            <div style={{ fontSize: 11.5, opacity: 0.9 }}>Your BMI, daily calories &amp; protein target</div>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#6b7280' }}>Loading…</div>
        ) : editing ? (
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 13, color: '#6b7280' }}>Enter a few details to get your personalized health targets.</div>

            <div>
              <label style={labelStyle}>Gender</label>
              <div style={{ display: 'flex', gap: 10 }}>
                {['male', 'female'].map(g => (
                  <button key={g} onClick={() => set('gender', g)} style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1.5px solid ' + (form.gender === g ? '#059669' : '#e5e7eb'), background: form.gender === g ? '#059669' : '#fff', color: form.gender === g ? '#fff' : '#374151', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', textTransform: 'capitalize' }}>{g === 'male' ? '👨 Male' : '👩 Female'}</button>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div><label style={labelStyle}>Age (years)</label><input type="number" inputMode="numeric" value={form.age} onChange={e => set('age', e.target.value)} placeholder="e.g. 28" style={inputStyle} /></div>
              <div><label style={labelStyle}>Height (cm)</label><input type="number" inputMode="numeric" value={form.height_cm} onChange={e => set('height_cm', e.target.value)} placeholder="e.g. 170" style={inputStyle} /></div>
              <div><label style={labelStyle}>Weight (kg)</label><input type="number" inputMode="decimal" value={form.weight_kg} onChange={e => set('weight_kg', e.target.value)} placeholder="e.g. 72" style={inputStyle} /></div>
              <div><label style={labelStyle}>Waist (cm) <span style={{ color: '#9ca3af', fontWeight: 500 }}>· optional</span></label><input type="number" inputMode="decimal" value={form.waist_cm} onChange={e => set('waist_cm', e.target.value)} placeholder="e.g. 86" style={inputStyle} /></div>
            </div>

            <div>
              <label style={labelStyle}>Activity level</label>
              <select value={form.activity} onChange={e => set('activity', e.target.value)} style={inputStyle}>
                {ACTIVITY.map(a => <option key={a.v} value={a.v}>{a.label}</option>)}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Your goal</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {GOALS.map(g => (
                  <button key={g.v} onClick={() => set('goal', g.v)} style={{ flex: 1, padding: '10px 6px', borderRadius: 10, border: '1.5px solid ' + (form.goal === g.v ? '#059669' : '#e5e7eb'), background: form.goal === g.v ? '#ecfdf5' : '#fff', color: '#065f46', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>{g.label}</button>
                ))}
              </div>
            </div>

            {err && <div style={{ color: '#dc2626', fontSize: 13, fontWeight: 600 }}>⚠️ {err}</div>}
            <button onClick={save} disabled={saving} style={{ background: '#059669', color: '#fff', border: 'none', padding: '13px', borderRadius: 12, fontSize: 15, fontWeight: 800, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Calculating…' : '✅ Calculate My Health'}
            </button>
          </div>
        ) : result && (
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* BMI card */}
            <div style={{ background: '#fff', borderRadius: 16, padding: 18, border: '1px solid #ecfdf5', boxShadow: '0 2px 12px #0000000d', textAlign: 'center' }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>Your BMI (Indian standard)</div>
              <div style={{ fontSize: 46, fontWeight: 900, color: result.catColor, lineHeight: 1.1 }}>{result.bmi}</div>
              <div style={{ display: 'inline-block', background: result.catColor, color: '#fff', fontSize: 13, fontWeight: 800, padding: '4px 14px', borderRadius: 20 }}>{result.cat}</div>
              <div style={{ fontSize: 12.5, color: '#374151', marginTop: 10 }}>Healthy weight for you: <b>{result.lo}–{result.hi} kg</b></div>
              <div style={{ fontSize: 12.5, color: result.deltaText.includes('healthy range 🎉') ? '#16a34a' : '#d97706', fontWeight: 700, marginTop: 2 }}>{result.deltaText}</div>
              {result.waistRisk && <div style={{ fontSize: 11.5, color: result.waistRisk.startsWith('High') ? '#dc2626' : '#16a34a', fontWeight: 700, marginTop: 6 }}>📏 Belly-fat risk: {result.waistRisk}</div>}
            </div>

            {/* Daily target */}
            <div style={{ background: 'linear-gradient(135deg,#065f46,#059669)', color: '#fff', borderRadius: 16, padding: 18, textAlign: 'center' }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, opacity: 0.9, textTransform: 'uppercase', letterSpacing: 0.5 }}>Your daily calorie target</div>
              <div style={{ fontSize: 40, fontWeight: 900, lineHeight: 1.1 }}>{result.cals} <span style={{ fontSize: 16 }}>kcal</span></div>
              <div style={{ fontSize: 11.5, opacity: 0.85 }}>Maintenance ≈ {result.tdee} kcal · {form.goal === 'lose' ? 'calorie deficit for fat loss' : form.goal === 'gain' ? 'surplus for muscle gain' : 'to maintain'}</div>
            </div>

            {/* Macros */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              {[['Protein', result.proteinG, '#059669'], ['Carbs', result.carbsG, '#2563eb'], ['Fat', result.fatG, '#d97706']].map(([l, v, c]) => (
                <div key={l} style={{ background: '#fff', borderRadius: 12, padding: '12px 6px', textAlign: 'center', border: '1px solid #e5e7eb' }}>
                  <div style={{ fontSize: 20, fontWeight: 900, color: c }}>{v}<span style={{ fontSize: 12 }}>g</span></div>
                  <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 700, textTransform: 'uppercase' }}>{l}/day</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1, background: '#fff', borderRadius: 12, padding: '10px', textAlign: 'center', border: '1px solid #e5e7eb', fontSize: 12.5, fontWeight: 700, color: '#7c3aed' }}>🌾 Fiber: {result.fiberG} g/day</div>
              <div style={{ flex: 1, background: '#fff', borderRadius: 12, padding: '10px', textAlign: 'center', border: '1px solid #e5e7eb', fontSize: 12.5, fontWeight: 700, color: '#0891b2' }}>💧 Water: {result.waterL} L/day</div>
            </div>

            {/* Phase 2 — meals matched to the goal + calorie/protein target */}
            {meals.length > 0 && (
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#065f46', margin: '4px 2px 8px' }}>🥗 Recommended meals for {goalWord}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {meals.map(m => (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: '1px solid #ecfdf5', borderRadius: 12, padding: '10px 12px' }}>
                      <div style={{ width: 46, height: 46, borderRadius: 10, flexShrink: 0, background: 'linear-gradient(135deg,#d1fae5,#a7f3d0)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', fontSize: 22 }}>
                        {m.image_url ? <img src={m.image_url} alt={m.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '🥗'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.is_veg ? '🟢' : '🔴'} {m.name}</div>
                        <div style={{ fontSize: 11, color: '#6b7280' }}>🔥 {m.calories} kcal · 💪 {m.protein_g}g protein</div>
                        <div style={{ fontSize: 10.5, color: '#059669', fontWeight: 700 }}>✓ {m._reason}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 10.5, color: '#9ca3af', marginTop: 6, textAlign: 'center' }}>Availability depends on the Fitness Corner being live in your area.</div>
              </div>
            )}

            {/* CTA to fitness corner */}
            <button onClick={() => router.push('/fitness')} style={{ background: '#065f46', color: '#fff', border: 'none', padding: '13px', borderRadius: 12, fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>
              🥗 See &amp; order healthy meals →
            </button>
            <button onClick={() => setEditing(true)} style={{ background: '#fff', color: '#065f46', border: '1.5px solid #a7f3d0', padding: '11px', borderRadius: 12, fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>
              ✏️ Update my details
            </button>

            <div style={{ fontSize: 11, color: '#9ca3af', lineHeight: 1.5, textAlign: 'center', marginTop: 4 }}>
              These are approximate, general guidance values (ICMR &amp; Mifflin-St Jeor based). Not medical advice. For any medical condition, pregnancy, or a specific diet plan, please consult a doctor or a registered dietician.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

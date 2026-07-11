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

// Daily water tracker — tap glasses (250 ml each) to fill toward the goal.
// Saved per-day in localStorage so it resets each day and persists on refresh.
function WaterTracker({ targetL }) {
  const glasses = Math.max(4, Math.round((Number(targetL) || 2.5) / 0.25))
  const key = 'ck_water_' + new Date().toISOString().slice(0, 10)
  const [done, setDone] = useState(0)
  useEffect(() => {
    try { setDone(Math.min(glasses, Number(localStorage.getItem(key)) || 0)) } catch {}
  }, [key, glasses])
  const setCount = (n) => { setDone(n); try { localStorage.setItem(key, String(n)) } catch {} }
  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: 16, border: '1px solid #e0f2fe', boxShadow: '0 2px 12px #0000000d' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 13.5, fontWeight: 800, color: '#0369a1' }}>💧 Today&apos;s water</div>
        <div style={{ fontSize: 12, fontWeight: 800, color: '#0891b2', background: '#e0f2fe', borderRadius: 20, padding: '3px 10px' }}>{done}/{glasses} glasses</div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {Array.from({ length: glasses }).map((_, i) => {
          const filled = i < done
          return (
            <button key={i} onClick={() => setCount(i + 1 === done ? i : i + 1)} title="Tap to update"
              style={{ width: 34, height: 40, borderRadius: 8, cursor: 'pointer', fontSize: 18, lineHeight: '38px',
                border: '1.5px solid ' + (filled ? '#0891b2' : '#e5e7eb'), background: filled ? '#e0f2fe' : '#fff', padding: 0 }}>
              {filled ? '💧' : '·'}
            </button>
          )
        })}
      </div>
      <div style={{ fontSize: 10.5, color: '#9ca3af', marginTop: 8 }}>Goal ≈ {targetL} L/day ({glasses} glasses of 250 ml). Tap a glass as you drink.</div>
    </div>
  )
}

// Weight progress — start-vs-now, a mini trend chart, a check-in streak,
// and a quick "log today's weight". Uses only the customer's real logged data.
function Progress({ log, lo, hi, goal, onLog }) {
  const [wt, setWt] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const points = (log || []).map(p => ({ w: Number(p.weight_kg), t: new Date(p.logged_at) })).filter(p => p.w > 0)

  const submit = async () => {
    const v = Number(wt)
    if (!v || v < 25 || v > 300) { setMsg('Enter a valid weight (kg)'); return }
    setBusy(true); setMsg('')
    try { await onLog(v); setWt(''); setMsg('✓ Logged for today!') } catch (e) { setMsg(e.message || 'Could not log') }
    setBusy(false)
  }

  // Check-in streak: consecutive calendar days with a log, ending today/yesterday.
  let streak = 0
  if (points.length) {
    const days = [...new Set(points.map(p => p.t.toISOString().slice(0, 10)))].sort().reverse()
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const latest = new Date(days[0] + 'T00:00:00')
    if (Math.round((today - latest) / 86400000) <= 1) {
      streak = 1
      let cursor = latest
      for (let i = 1; i < days.length; i++) {
        const d = new Date(days[i] + 'T00:00:00')
        if (Math.round((cursor - d) / 86400000) === 1) { streak++; cursor = d } else break
      }
    }
  }

  const start = points[0], now = points[points.length - 1]
  const change = points.length >= 2 ? +(now.w - start.w).toFixed(1) : 0
  const good = goal === 'lose' ? change < 0 : goal === 'gain' ? change > 0 : Math.abs(change) < 1

  // Mini SVG chart geometry
  const W = 320, H = 120, pad = 22
  const ws = points.map(p => p.w)
  let minW = Math.min(...ws, lo), maxW = Math.max(...ws, hi)
  const range = (maxW - minW) || 1
  minW -= range * 0.12; maxW += range * 0.12
  const X = i => pad + (points.length <= 1 ? (W - 2 * pad) / 2 : (i / (points.length - 1)) * (W - 2 * pad))
  const Y = w => H - pad - ((w - minW) / (maxW - minW)) * (H - 2 * pad)
  const line = points.map((p, i) => `${X(i).toFixed(1)},${Y(p.w).toFixed(1)}`).join(' ')

  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: 16, border: '1px solid #ecfdf5', boxShadow: '0 2px 12px #0000000d' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 13.5, fontWeight: 800, color: '#065f46' }}>📊 My progress</div>
        {streak > 0 && <div style={{ fontSize: 12, fontWeight: 800, color: '#c2410c', background: '#ffedd5', borderRadius: 20, padding: '3px 10px' }}>🔥 {streak}-day streak</div>}
      </div>

      {points.length >= 2 ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
            {[['Start', start.w, '#6b7280'], ['Now', now.w, '#065f46'], [change <= 0 ? 'Lost' : 'Gained', Math.abs(change), good ? '#16a34a' : '#d97706']].map(([l, v, c], i) => (
              <div key={i} style={{ background: '#f0fdf4', borderRadius: 10, padding: '9px 6px', textAlign: 'center' }}>
                <div style={{ fontSize: 17, fontWeight: 900, color: c }}>{v}<span style={{ fontSize: 11 }}>kg</span></div>
                <div style={{ fontSize: 10.5, color: '#6b7280', fontWeight: 700 }}>{l}</div>
              </div>
            ))}
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
            {/* healthy range band */}
            <rect x={pad} y={Y(hi)} width={W - 2 * pad} height={Math.max(0, Y(lo) - Y(hi))} fill="#dcfce7" />
            <text x={pad + 2} y={Y(hi) - 3} fontSize="8" fill="#16a34a">healthy range</text>
            <polyline points={line} fill="none" stroke="#059669" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
            {points.map((p, i) => (i === 0 || i === points.length - 1) && (
              <circle key={i} cx={X(i)} cy={Y(p.w)} r="3.5" fill="#065f46" />
            ))}
          </svg>
          <div style={{ fontSize: 11, color: good ? '#16a34a' : '#6b7280', fontWeight: 700, textAlign: 'center', marginTop: 4 }}>
            {change === 0 ? 'Holding steady — keep it up!' : good ? `Great — ${Math.abs(change)} kg in the right direction! 🎉` : `${Math.abs(change)} kg ${change > 0 ? 'up' : 'down'} — stay consistent, you've got this.`}
          </div>
        </>
      ) : (
        <div style={{ fontSize: 12.5, color: '#6b7280', textAlign: 'center', padding: '6px 0 12px' }}>
          Log your weight regularly to see your trend and BMI journey here. 📈
        </div>
      )}

      {/* Quick log */}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <input type="number" inputMode="decimal" value={wt} onChange={e => setWt(e.target.value)} placeholder="Today's weight (kg)"
          style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px solid #d1d5db', fontSize: 14, outline: 'none', boxSizing: 'border-box', background: '#fff', color: '#111' }} />
        <button onClick={submit} disabled={busy} style={{ background: '#059669', color: '#fff', border: 'none', padding: '0 16px', borderRadius: 10, fontSize: 13.5, fontWeight: 800, cursor: 'pointer', opacity: busy ? 0.6 : 1, whiteSpace: 'nowrap' }}>
          {busy ? '…' : '＋ Log'}
        </button>
      </div>
      {msg && <div style={{ fontSize: 11.5, color: msg.startsWith('✓') ? '#16a34a' : '#dc2626', fontWeight: 600, marginTop: 6 }}>{msg}</div>}
    </div>
  )
}

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

  // Calorie target by goal (safe deficit / floor). Gym-goers get a leaner
  // surplus (% of TDEE, not a flat number) so it scales with body size.
  let cals
  if (p.goal === 'lose') cals = Math.max(p.gender === 'male' ? 1500 : 1200, tdee - 500)
  else if (p.goal === 'gain') cals = tdee * (p.gym_goer ? 1.10 : 1.12)
  else cals = tdee
  cals = Math.round(cals / 10) * 10

  // Protein — reference weight avoids over-estimating for higher BMI.
  // Gym-goers need more (muscle retention on a cut, growth on a bulk).
  const refW = bmi > 25 ? 22 * hM * hM : w
  const pFactor = p.gym_goer
    ? (p.goal === 'lose' ? 2.2 : p.goal === 'gain' ? 2.0 : 1.6)
    : (p.goal === 'lose' ? 1.8 : p.goal === 'gain' ? 2.0 : 1.0)
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

  // Weight-change timeline — 7700 kcal ≈ 1 kg body fat.
  // Uses the ACTUAL calorie gap (after floors) so it stays honest.
  let timeline = null
  const kcalGap = p.goal === 'lose' ? (tdee - cals) : p.goal === 'gain' ? (cals - tdee) : 0
  if (kcalGap > 0) {
    const weeklyKg = +(kcalGap * 7 / 7700).toFixed(2)
    const monthlyKg = +(weeklyKg * 4.33).toFixed(1)
    // Weeks to reach the healthy range (only when there's a gap to close)
    const weeksToTarget = deltaKg > 0 && weeklyKg > 0 ? Math.ceil(deltaKg / weeklyKg) : null
    timeline = { dir: p.goal, weeklyKg, monthlyKg, weeksToTarget, targetKg: +deltaKg.toFixed(1) }
  }

  return { bmi: +bmi.toFixed(1), cat, catColor, lo: +lo.toFixed(1), hi: +hi.toFixed(1), deltaText, deltaKg: +deltaKg.toFixed(1),
    tdee: Math.round(tdee), cals, proteinG, carbsG, fatG, fiberG, waterL, waistRisk, timeline, gymGoer: !!p.gym_goer }
}

// Rank Fitness Corner meals against the customer's goal + calorie target.
// dietPref 'veg' shows only veg items; 'nonveg' shows everything.
function rankMeals(items, result, goal, dietPref) {
  const perCals = (result?.cals || 1800) / 3   // ~3 meals/day
  const pool = (items || []).filter(it => Number(it.calories) > 0 && (dietPref === 'nonveg' || it.is_veg))
  const scored = pool.map(it => {
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

const EMPTY = { gender: '', age: '', height_cm: '', weight_kg: '', waist_cm: '', activity: 'moderate', goal: 'maintain', diet_pref: 'veg', gym_goer: false }
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
  const [log, setLog] = useState([])

  useEffect(() => {
    fetch('/api/fitness?mode=suggest').then(r => r.json()).then(d => setAllMeals(d.items || [])).catch(() => {})
    fetch('/api/health').then(r => {
      if (r.status === 401) { router.push('/login'); return null }
      return r.json()
    }).then(d => {
      if (d?.log) setLog(d.log)
      if (d?.profile) {
        const p = { gender: d.profile.gender || '', age: d.profile.age || '', height_cm: d.profile.height_cm || '',
          weight_kg: d.profile.weight_kg || '', waist_cm: d.profile.waist_cm || '', activity: d.profile.activity || 'moderate', goal: d.profile.goal || 'maintain',
          diet_pref: d.profile.diet_pref || 'veg', gym_goer: !!d.profile.gym_goer }
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
    if (d.log) setLog(d.log)
    setResult(compute(form)); setEditing(false)
  }

  // Quick "log today's weight" — updates current weight + progress chart.
  const logWeight = async (wt) => {
    const res = await fetch('/api/health', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ logWeight: true, weight_kg: wt }) })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(d.error || 'Could not log weight')
    if (d.log) setLog(d.log)
    const np = { ...form, weight_kg: wt }
    setForm(np); setResult(compute(np))
  }

  const meals = result ? rankMeals(allMeals, result, form.goal, form.diet_pref) : []
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

            <div>
              <label style={labelStyle}>Food preference</label>
              <div style={{ display: 'flex', gap: 10 }}>
                {[['veg', '🟢 Veg'], ['nonveg', '🔴 Non-veg (egg too)']].map(([v, l]) => (
                  <button key={v} onClick={() => set('diet_pref', v)} style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1.5px solid ' + (form.diet_pref === v ? '#059669' : '#e5e7eb'), background: form.diet_pref === v ? '#ecfdf5' : '#fff', color: '#065f46', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>{l}</button>
                ))}
              </div>
            </div>

            <div>
              <label style={labelStyle}>Do you go to the gym / train regularly?</label>
              <div style={{ display: 'flex', gap: 10 }}>
                {[[true, '🏋️ Yes, I train'], [false, '🙅 No']].map(([v, l]) => (
                  <button key={String(v)} onClick={() => set('gym_goer', v)} style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1.5px solid ' + (form.gym_goer === v ? '#059669' : '#e5e7eb'), background: form.gym_goer === v ? '#ecfdf5' : '#fff', color: '#065f46', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>{l}</button>
                ))}
              </div>
              {form.gym_goer && <div style={{ fontSize: 11, color: '#059669', marginTop: 5 }}>💪 We&apos;ll raise your protein target for muscle building/retention.</div>}
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

            {/* Weight-change timeline — from the calorie deficit/surplus */}
            {result.timeline && (
              <div style={{ background: '#fff', borderRadius: 16, padding: 16, border: '1px solid #ecfdf5', boxShadow: '0 2px 12px #0000000d' }}>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: '#065f46', marginBottom: 10 }}>
                  📈 Your {result.timeline.dir === 'lose' ? 'weight-loss' : 'weight-gain'} timeline
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div style={{ background: '#f0fdf4', borderRadius: 12, padding: '12px 8px', textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 900, color: '#059669' }}>{result.timeline.weeklyKg} kg</div>
                    <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 700 }}>per week</div>
                  </div>
                  <div style={{ background: '#f0fdf4', borderRadius: 12, padding: '12px 8px', textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 900, color: '#059669' }}>{result.timeline.monthlyKg} kg</div>
                    <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 700 }}>per month</div>
                  </div>
                </div>
                {result.timeline.weeksToTarget && (
                  <div style={{ fontSize: 12.5, color: '#374151', marginTop: 10, textAlign: 'center', fontWeight: 600 }}>
                    🎯 At this pace you can reach your healthy range (~{result.timeline.targetKg} kg to {result.timeline.dir === 'lose' ? 'lose' : 'gain'}) in about <b style={{ color: '#065f46' }}>{result.timeline.weeksToTarget} weeks</b>.
                  </div>
                )}
                <div style={{ fontSize: 10.5, color: '#9ca3af', marginTop: 8, lineHeight: 1.5 }}>
                  Based on ~7700 kcal ≈ 1 kg body fat. Early weeks may look faster (water weight); the body also adapts over time — so treat this as a guide, not a guarantee.
                </div>
              </div>
            )}

            {/* Gym-goer specific guidance */}
            {result.gymGoer && (
              <div style={{ background: 'linear-gradient(135deg,#eff6ff,#f0fdf4)', borderRadius: 16, padding: 16, border: '1px solid #dbeafe' }}>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: '#1e3a8a', marginBottom: 8 }}>🏋️ Because you train — a few tips</div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: '#374151', lineHeight: 1.7 }}>
                  <li>Hit your <b>{result.proteinG} g protein</b> daily — spread across 4–5 meals (~20–40 g each) for best muscle synthesis.</li>
                  <li>Eat some protein + carbs within ~1–2 hours after your workout for recovery.</li>
                  <li>{form.goal === 'gain' ? 'Lean bulk: keep the surplus small so you gain muscle, not just fat.' : form.goal === 'lose' ? 'On a cut, the higher protein protects your muscle while you lose fat.' : 'For recomposition, stay near maintenance calories and keep protein high.'}</li>
                  <li>Stay hydrated — aim for your <b>{result.waterL} L</b> water goal, a bit more on training days.</li>
                </ul>
              </div>
            )}

            {/* Weight progress — real logged data, chart + streak + quick log */}
            <Progress log={log} lo={result.lo} hi={result.hi} goal={form.goal} onLog={logWeight} />

            {/* Daily water tracker — small engagement tool, saved per day on this device */}
            <WaterTracker targetL={result.waterL} />

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

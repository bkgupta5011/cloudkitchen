'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const fieldStyle = { width: '100%', padding: '10px 12px', border: '1px solid #e7e5e4', borderRadius: 10, fontSize: 14, outline: 'none', fontFamily: 'inherit', background: '#fff', boxSizing: 'border-box' }
const label = { fontSize: 12.5, fontWeight: 700, color: '#57534e', display: 'block', marginBottom: 5, marginTop: 14 }

export default function BlogWrite() {
  const router = useRouter()
  const [pw, setPw] = useState('')
  const [unlocked, setUnlocked] = useState(false)
  const [form, setForm] = useState({ title: '', excerpt: '', content: '', author: 'FoodFi', cover_image_url: '', food_name: '', calories: '', protein_g: '', carbs_g: '', fat_g: '', fiber_g: '' })
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const uploadImage = (file) => {
    setUploading(true); setErr('')
    const reader = new FileReader()
    reader.onload = ev => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const MAX = 1100
        let { width, height } = img
        if (width > MAX) { height = Math.round(height * MAX / width); width = MAX }
        canvas.width = width; canvas.height = height
        canvas.getContext('2d').drawImage(img, 0, 0, width, height)
        const base64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1]
        fetch('/api/blog', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'upload', password: pw, base64, mimeType: 'image/jpeg' }) })
          .then(r => r.json()).then(d => { setUploading(false); if (d.url) set('cover_image_url', d.url); else setErr(d.error || 'Image upload fail') })
          .catch(() => { setUploading(false); setErr('Upload error') })
      }
      img.src = ev.target.result
    }
    reader.readAsDataURL(file)
  }

  const submit = async () => {
    setErr('')
    if (!form.title.trim() || !form.content.trim()) { setErr('Title aur content zaroori hai'); return }
    setSaving(true)
    try {
      const r = await fetch('/api/blog', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, password: pw }) })
      const d = await r.json()
      setSaving(false)
      if (!r.ok) { setErr(d.error || 'Save fail'); return }
      router.push('/blog/' + d.post.slug)
    } catch { setSaving(false); setErr('Network error') }
  }

  if (!unlocked) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#faf9f7', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: '30px 24px', maxWidth: 360, width: '100%', boxShadow: '0 4px 24px #0000000f', textAlign: 'center' }}>
        <div style={{ fontSize: 38 }}>🔒</div>
        <div style={{ fontSize: 18, fontWeight: 800, margin: '8px 0 4px' }}>Blog Writer</div>
        <div style={{ fontSize: 13, color: '#78716c', marginBottom: 18 }}>Post karne ke liye password daalo</div>
        <input type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="Password"
          onKeyDown={e => e.key === 'Enter' && pw && setUnlocked(true)}
          style={{ ...fieldStyle, marginBottom: 12, textAlign: 'center' }} />
        <button onClick={() => pw && setUnlocked(true)} style={{ width: '100%', background: '#ea580c', color: '#fff', border: 'none', borderRadius: 10, padding: '11px', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>Unlock →</button>
        <div style={{ fontSize: 11, color: '#a8a29e', marginTop: 10 }}>Galat password pe submit reject ho jayega</div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#faf9f7' }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: '#fff', borderBottom: '1px solid #eee', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontWeight: 800, color: '#1c1917' }}>✍️ New Blog Post</span>
        <button onClick={() => router.push('/blog')} style={{ background: '#f5f5f4', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 13, cursor: 'pointer' }}>← Blog</button>
      </div>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '18px 16px 60px' }}>
        <div style={{ background: '#fff', borderRadius: 16, padding: '18px 18px 22px', boxShadow: '0 2px 14px #0000000d' }}>

          <label style={label}>Cover Photo</label>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {form.cover_image_url && <img src={form.cover_image_url} alt="" style={{ width: 90, height: 64, objectFit: 'cover', borderRadius: 8 }} />}
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', background: '#faf9f7', border: '1px dashed #d6d3d1', borderRadius: 10, cursor: 'pointer', fontSize: 13 }}>
              📷 {uploading ? 'Uploading...' : (form.cover_image_url ? 'Change photo' : 'Choose photo')}
              <input type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} disabled={uploading}
                onChange={e => { if (e.target.files[0]) uploadImage(e.target.files[0]) }} />
            </label>
          </div>

          <label style={label}>Title *</label>
          <input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Blog ka title" style={fieldStyle} />

          <label style={label}>Short summary (optional)</label>
          <input value={form.excerpt} onChange={e => set('excerpt', e.target.value)} placeholder="1-2 line summary (khaali chhoda to apне aap ban jayega)" style={fieldStyle} />

          <label style={label}>Content * <span style={{ fontWeight: 400, color: '#a8a29e' }}>(naye paragraph ke liye Enter dabao)</span></label>
          <textarea value={form.content} onChange={e => set('content', e.target.value)} placeholder="Apna blog yahan likho... health benefits, tips, etc." rows={12} style={{ ...fieldStyle, resize: 'vertical', lineHeight: 1.6 }} />

          <label style={label}>Author</label>
          <input value={form.author} onChange={e => set('author', e.target.value)} placeholder="FoodFi" style={fieldStyle} />

          <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 12, padding: '12px 14px', marginTop: 18 }}>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: '#9a3412', marginBottom: 4 }}>🍽️ Food Nutrition (optional)</div>
            <div style={{ fontSize: 11.5, color: '#b45309', marginBottom: 8 }}>Agar kisi food ke baare mein likh rahe ho to ye bharo — blog mein nutrition card dikhega.</div>
            <input value={form.food_name} onChange={e => set('food_name', e.target.value)} placeholder="Food ka naam (e.g. Paneer Bhurji)" style={{ ...fieldStyle, marginBottom: 8 }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px,1fr))', gap: 8 }}>
              <input value={form.calories} onChange={e => set('calories', e.target.value)} placeholder="Calories" type="number" style={fieldStyle} />
              <input value={form.protein_g} onChange={e => set('protein_g', e.target.value)} placeholder="Protein g" type="number" style={fieldStyle} />
              <input value={form.carbs_g} onChange={e => set('carbs_g', e.target.value)} placeholder="Carbs g" type="number" style={fieldStyle} />
              <input value={form.fat_g} onChange={e => set('fat_g', e.target.value)} placeholder="Fat g" type="number" style={fieldStyle} />
              <input value={form.fiber_g} onChange={e => set('fiber_g', e.target.value)} placeholder="Fiber g" type="number" style={fieldStyle} />
            </div>
          </div>

          {err && <div style={{ background: '#fef2f2', color: '#dc2626', borderRadius: 8, padding: '9px 12px', fontSize: 13, marginTop: 14 }}>❌ {err}</div>}

          <button onClick={submit} disabled={saving || uploading} style={{ width: '100%', background: '#ea580c', color: '#fff', border: 'none', borderRadius: 12, padding: '13px', fontSize: 15, fontWeight: 800, cursor: 'pointer', marginTop: 18, opacity: (saving || uploading) ? 0.6 : 1 }}>
            {saving ? 'Publishing...' : '🚀 Publish Blog'}
          </button>
        </div>
      </div>
    </div>
  )
}

'use client'
import { useState, useEffect, useRef } from 'react'

export default function SupportChat() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [unread, setUnread] = useState(0)
  const [threadState, setThreadState] = useState({ resolved: false, csat: null })
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef(null)
  const bottomRef = useRef(null)
  const pollRef = useRef(null)
  const lastAdminMsgCount = useRef(0)
  const openRef = useRef(false)

  // openRef ko open ke saath sync karo (setInterval closure ke liye)
  useEffect(() => { openRef.current = open }, [open])

  // 0.5-sec soft beep — admin reply aane par
  const playAdminReplyBeep = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      // Ek smooth ding — 700Hz sine wave
      const osc = ctx.createOscillator(), g = ctx.createGain()
      osc.type = 'sine'; osc.frequency.value = 700
      osc.connect(g); g.connect(ctx.destination)
      g.gain.setValueAtTime(0.6, ctx.currentTime)
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45)
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.47)
      setTimeout(() => { try { ctx.close() } catch {} }, 1000)
    } catch {}
  }

  const loadMessages = async () => {
    try {
      const d = await fetch('/api/support').then(r => r.json())
      const msgs = d.messages || []
      if (d.state) setThreadState(d.state)

      // Admin ke naye messages detect karo
      const adminMsgs = msgs.filter(m => m.is_from_admin)
      const newAdminCount = adminMsgs.length

      if (lastAdminMsgCount.current > 0 && newAdminCount > lastAdminMsgCount.current) {
        // Naya admin reply aaya!
        if (!openRef.current) {
          // Chat band hai — beep bajao aur unread badge badhao
          playAdminReplyBeep()
          setUnread(prev => prev + (newAdminCount - lastAdminMsgCount.current))
        }
        // Chat khuli hai to seedha messages update ho jayenge
      }
      lastAdminMsgCount.current = newAdminCount

      setMessages(msgs)

      // Unread badge: sirf jab chat band ho
      if (!openRef.current) {
        const adminUnread = msgs.filter(m => m.is_from_admin && !m.is_read).length
        setUnread(adminUnread)
      }
    } catch {}
  }

  useEffect(() => {
    loadMessages()
    pollRef.current = setInterval(loadMessages, 8000)  // 8 sec poll — thoda faster
    return () => clearInterval(pollRef.current)
  }, [])

  useEffect(() => {
    if (open) {
      setUnread(0)
      loadMessages()
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    }
  }, [open])

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    if (!input.trim()) return
    const text = input
    setInput('')
    const res = await fetch('/api/support', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text })
    }).then(r => r.json()).catch(() => null)
    await loadMessages()
    if (res?.reorder?.items?.length) doReorder(res.reorder.items)
  }

  // Quick-help chip → instant smart bot answer (order status, timing, etc.)
  const [botBusy, setBotBusy] = useState(false)
  const sendTopic = async (topic) => {
    if (botBusy) return
    setBotBusy(true)
    try {
      const res = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic })
      }).then(r => r.json()).catch(() => null)
      await loadMessages()
      if (res?.reorder?.items?.length) doReorder(res.reorder.items)
    } catch {}
    setBotBusy(false)
  }

  const QUICK_HELP = [
    { topic: 'order_status', label: '📦 Order kaha hai?' },
    { topic: 'reorder',      label: '🔁 Reorder' },
    { topic: 'offers',       label: '🎉 Offers' },
    { topic: 'reward',       label: '🎁 Reward' },
    { topic: 'timing',       label: '🕐 Timing' },
    { topic: 'wrong_item',   label: '❌ Galat item' },
    { topic: 'refund',       label: '💰 Refund' },
  ]

  // Reorder: pre-fill the cart with the last order's items and go to /cart.
  const doReorder = async (items) => {
    try {
      const menu = await fetch('/api/menu').then(r => r.json()).catch(() => ({ items: [] }))
      const avail = new Set((menu.items || []).map(i => String(i.id)))
      let cart = {}
      try { cart = JSON.parse(localStorage.getItem('ck_cart') || '{}') } catch {}
      let added = 0
      for (const it of items) {
        if (!it?.id) continue
        if (avail.size && !avail.has(String(it.id))) continue  // skip items no longer on the menu
        cart[it.id] = (cart[it.id] || 0) + (it.qty || 1)
        added++
      }
      localStorage.setItem('ck_cart', JSON.stringify(cart))
      fetch('/api/cart', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cart }) }).catch(() => {})
      if (added > 0) setTimeout(() => { window.location.href = '/cart' }, 700)
    } catch {}
  }

  // Photo attach — resize on the client, upload to /api/upload, then send URL
  const uploadPhoto = async (file) => {
    if (!file) return
    setUploading(true)
    try {
      const dataUrl = await new Promise((res, rej) => {
        const reader = new FileReader()
        reader.onload = ev => {
          const img = new Image()
          img.onload = () => {
            const canvas = document.createElement('canvas')
            const MAX = 900
            let { width, height } = img
            if (width > MAX) { height = Math.round(height * MAX / width); width = MAX }
            if (height > MAX) { width = Math.round(width * MAX / height); height = MAX }
            canvas.width = width; canvas.height = height
            canvas.getContext('2d').drawImage(img, 0, 0, width, height)
            res(canvas.toDataURL('image/jpeg', 0.82).split(',')[1])
          }
          img.onerror = rej
          img.src = ev.target.result
        }
        reader.onerror = rej
        reader.readAsDataURL(file)
      })
      const up = await fetch('/api/upload', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64: dataUrl, mimeType: 'image/jpeg' }),
      }).then(r => r.json())
      if (up.url) {
        await fetch('/api/support', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image_url: up.url }),
        })
        await loadMessages()
      }
    } catch {}
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const rateChat = async (val) => {
    setThreadState(s => ({ ...s, csat: val }))
    try {
      await fetch('/api/support', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csat: val }),
      })
      loadMessages()
    } catch {}
  }

  return (
    <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 1000 }}>
      {/* Chat window */}
      {open && (
        <div style={{
          position: 'absolute', bottom: 60, right: 0,
          width: 320, height: 420,
          background: 'var(--card)', borderRadius: 16,
          boxShadow: '0 8px 32px #0003',
          border: '1px solid var(--bd)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden'
        }}>
          {/* Header */}
          <div style={{ background: 'linear-gradient(135deg,#e85d04,#f97316)', padding: '12px 16px', color: '#fff' }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>💬 FoodFi Support</div>
            <div style={{ fontSize: 11, opacity: 0.85 }}>Kitchen team typically replies in minutes</div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--t2)', fontSize: 13, marginTop: 20 }}>
                <div style={{ fontSize: 30, marginBottom: 8 }}>👋</div>
                Hi there! How can we help you?
              </div>
            )}
            {messages.map(m => (
              <div key={m.id} style={{ display: 'flex', justifyContent: m.is_from_admin ? 'flex-start' : 'flex-end' }}>
                <div style={{
                  maxWidth: '80%',
                  background: m.is_from_admin ? 'var(--bg)' : 'var(--or)',
                  color: m.is_from_admin ? 'var(--t1)' : '#fff',
                  borderRadius: m.is_from_admin ? '14px 14px 14px 4px' : '14px 14px 4px 14px',
                  padding: '8px 12px', fontSize: 13
                }}>
                  {m.is_from_admin && <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--or)', marginBottom: 3 }}>{m.is_bot ? '🤖 FoodFi Bot' : '🍽️ Kitchen'}</div>}
                  {m.image_url && (
                    <img src={m.image_url} alt="attachment" onClick={() => window.open(m.image_url, '_blank')}
                      style={{ maxWidth: '100%', width: 160, borderRadius: 10, marginBottom: m.message && m.message !== '📷 Photo' ? 5 : 0, cursor: 'pointer', display: 'block' }} />
                  )}
                  {(!m.image_url || (m.message && m.message !== '📷 Photo')) && <span style={{ whiteSpace: 'pre-line' }}>{m.message}</span>}
                  <div style={{ fontSize: 10, opacity: 0.6, marginTop: 3, textAlign: 'right' }}>
                    {new Date(m.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* CSAT — after a resolve, ask once whether it helped */}
          {threadState.resolved && threadState.csat == null && messages.length > 0 && (
            <div style={{ padding: '8px 12px', borderTop: '1px solid var(--bd)', display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg)' }}>
              <span style={{ fontSize: 12, color: 'var(--t2)', flex: 1 }}>Kya ye helpful tha?</span>
              <button onClick={() => rateChat(1)} style={{ border: '1px solid var(--bd)', background: 'var(--card)', borderRadius: 8, padding: '4px 12px', fontSize: 15, cursor: 'pointer' }}>👍</button>
              <button onClick={() => rateChat(-1)} style={{ border: '1px solid var(--bd)', background: 'var(--card)', borderRadius: 8, padding: '4px 12px', fontSize: 15, cursor: 'pointer' }}>👎</button>
            </div>
          )}

          {/* Quick-help chips — instant answers without waiting for a human */}
          <div style={{ padding: '8px 10px 0', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {QUICK_HELP.map(q => (
              <button key={q.topic} onClick={() => sendTopic(q.topic)} disabled={botBusy}
                style={{ background: 'var(--bg)', border: '1px solid var(--bd)', borderRadius: 16, padding: '5px 10px', fontSize: 11.5, fontWeight: 600, color: 'var(--t1)', cursor: botBusy ? 'default' : 'pointer', opacity: botBusy ? 0.6 : 1 }}>
                {q.label}
              </button>
            ))}
          </div>

          {/* Input */}
          <div style={{ padding: '10px 12px', borderTop: '1px solid var(--bd)', display: 'flex', gap: 8, alignItems: 'center' }}>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => uploadPhoto(e.target.files?.[0])} />
            <button onClick={() => fileRef.current?.click()} disabled={uploading} title="Photo bhejo"
              style={{ width: 34, height: 34, flexShrink: 0, borderRadius: '50%', background: 'var(--bg)', border: '1px solid var(--bd)', color: 'var(--t1)', cursor: uploading ? 'default' : 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {uploading ? '…' : '📎'}
            </button>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              placeholder="Type a message…"
              style={{ flex: 1, minWidth: 0, padding: '8px 12px', borderRadius: 20, border: '1px solid var(--bd)', fontSize: 13, outline: 'none', background: 'var(--bg)', color: 'var(--t1)' }}
            />
            <button
              onClick={sendMessage}
              style={{ width: 36, height: 36, flexShrink: 0, borderRadius: '50%', background: 'var(--or)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              ➤
            </button>
          </div>
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: 50, height: 50, borderRadius: '50%',
          background: 'linear-gradient(135deg,#e85d04,#f97316)',
          border: 'none', cursor: 'pointer',
          boxShadow: '0 4px 16px #e85d0440',
          fontSize: 22, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative'
        }}>
        {open ? '✕' : '💬'}
        {!open && unread > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            background: '#dc2626', color: '#fff',
            borderRadius: '50%', width: 18, height: 18,
            fontSize: 10, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>{unread}</span>
        )}
      </button>
    </div>
  )
}

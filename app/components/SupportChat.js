'use client'
import { useState, useEffect, useRef } from 'react'

export default function SupportChat() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [unread, setUnread] = useState(0)
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
    await fetch('/api/support', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text })
    })
    loadMessages()
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
                Namaste! Kaise help kar sakte hain?
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
                  {m.is_from_admin && <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--or)', marginBottom: 3 }}>🍽️ Kitchen</div>}
                  {m.message}
                  <div style={{ fontSize: 10, opacity: 0.6, marginTop: 3, textAlign: 'right' }}>
                    {new Date(m.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{ padding: '10px 12px', borderTop: '1px solid var(--bd)', display: 'flex', gap: 8 }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              placeholder="Message likhiye..."
              style={{ flex: 1, padding: '8px 12px', borderRadius: 20, border: '1px solid var(--bd)', fontSize: 13, outline: 'none', background: 'var(--bg)', color: 'var(--t1)' }}
            />
            <button
              onClick={sendMessage}
              style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--or)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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

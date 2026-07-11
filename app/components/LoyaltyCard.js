'use client'
import { useState, useEffect } from 'react'

// Loyalty stamp card — shows N slots (= threshold). Each delivered order stamps
// a ✓; when all slots are filled the card turns green and the reward auto-applies
// on the next order. Self-fetches /api/loyalty (which also self-heals the grant).
export default function LoyaltyCard({ compact = false }) {
  const [loyalty, setLoyalty] = useState(null)

  useEffect(() => {
    let alive = true
    fetch('/api/loyalty').then(r => r.json()).then(d => { if (alive && d?.enabled) setLoyalty(d) }).catch(() => {})
    return () => { alive = false }
  }, [])

  if (!loyalty?.enabled) return null

  const n = loyalty.threshold || 5
  const ready = loyalty.availableReward > 0
  // Stamps reflect ACTUAL delivered orders in the current cycle — never inflated
  // to "all filled" just because a reward is available.
  const filled = Math.min(n, loyalty.progress || 0)
  const slot = compact ? 30 : 38

  return (
    <div style={{
      background: 'linear-gradient(135deg,#fffbeb,#fef3c7)',
      border: `1.5px solid ${ready ? '#16a34a' : '#fde68a'}`,
      borderRadius: 16, padding: compact ? '12px 14px' : '16px 18px',
      marginBottom: 16, boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#92400e' }}>🎟️ Loyalty Card</div>
          <div style={{ fontSize: 11.5, color: '#b45309', marginTop: 2 }}>
            {ready
              ? `🎉 ₹${loyalty.availableReward} off unlocked${loyalty.minOrder > 0 ? ` — on orders over ₹${loyalty.minOrder}` : ' — applies on your next order'}!`
              : `${loyalty.ordersToGo} more ${loyalty.ordersToGo === 1 ? 'order' : 'orders'} to unlock ₹${loyalty.reward} off`}
          </div>
        </div>
        <span style={{ fontSize: 11, fontWeight: 800, color: ready ? '#16a34a' : '#d97706', background: '#fff', borderRadius: 20, padding: '4px 10px', whiteSpace: 'nowrap' }}>
          {filled}/{n}
        </span>
      </div>

      {/* Stamp slots */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {Array.from({ length: n }).map((_, i) => {
          const stamped = i < filled
          return (
            <div key={i} style={{
              width: slot, height: slot, borderRadius: '50%', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: compact ? 15 : 18, fontWeight: 800,
              background: stamped ? (ready ? '#16a34a' : '#f59e0b') : '#fff',
              color: stamped ? '#fff' : '#d1d5db',
              border: `2px solid ${stamped ? (ready ? '#16a34a' : '#f59e0b') : '#fde68a'}`,
              transition: 'all 0.2s',
            }}>
              {stamped ? '✓' : i + 1}
            </div>
          )
        })}
      </div>

      {ready && (
        <div style={{ marginTop: 12, background: '#16a34a', color: '#fff', borderRadius: 10, padding: '8px 12px', fontSize: 12.5, fontWeight: 700, textAlign: 'center' }}>
          ✅ ₹{loyalty.availableReward} will be applied automatically on your next order
        </div>
      )}

      {/* Subtle entry to the health tool — non-intrusive */}
      <a href="/health" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12, paddingTop: 10, borderTop: '1px dashed #fde68a', fontSize: 12, fontWeight: 700, color: '#065f46', textDecoration: 'none' }}>
        💚 Check My Health — BMI &amp; calorie target ›
      </a>
    </div>
  )
}

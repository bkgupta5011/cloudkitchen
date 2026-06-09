'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import FoodFiLogo from './components/FoodFiLogo'

const SPLASH_LINES = [
  { main: 'माँ के हाथों का स्वाद, अब आपके दरवाज़े तक', sub: 'ताज़ा बना, गरमागरम आया 🍽️' },
  { main: 'हर निवाले में माँ की दुआ है', sub: 'Har order mein dil lagate hain 🧡' },
  { main: 'वो पुरानी रसोई की महक... याद है?', sub: 'No shortcuts in our kitchen, only love 🌿' },
  { main: 'घर का खाना — दिल का खाना', sub: 'Saaf haath, saccha khana — hamara vaada ✨' },
  { main: 'दिल से बनाया, आपके लिए सजाया', sub: 'Pet khush, toh sab khush 😋' },
  { main: 'हर थाली में प्यार का तड़का', sub: 'Fresh · Homemade · Made with Love' },
  { main: 'आपकी भूख, हमारी ज़िम्मेदारी', sub: 'Bhook lagi? Hum aa rahe hain 🛵' },
  { main: 'खाने में जब प्यार हो, हर bite special हो', sub: 'Aaj kya khayein? — Ye sawaal khatam! ✅' },
  { main: '🙏 अतिथि देवो भव — आपका स्वागत है', sub: 'Har subah ek naya swad, har shaam ek naya ehsaas' },
  { main: 'अन्न ब्रह्म है — हम इज़्ज़त से बनाते हैं', sub: 'आपका भरोसा, हमारी ताकत 💪' },
  { main: 'खाना खाया? — हमारी सबसे बड़ी चिंता', sub: 'Ghar pe kuch nahi bana? Koi baat nahi! 😄' },
  { main: 'रोटी, प्यार aur FoodFi 🧡', sub: 'Ek order, hazaar yaadon jaisa swad' },
  { main: 'खुशबू आए रसोई से, दिल खुश हो जाए', sub: 'Chef special, delivered special ✨' },
  { main: 'Zindagi mein do cheezein khoobsurat hain —', sub: 'Accha insaan aur accha khana 🍛' },
  { main: 'Har subah ek naya swad', sub: 'Har shaam ek naya ehsaas — FoodFi ke saath 🌟' },
]

export default function Home() {
  const router = useRouter()
  const [splashPhase, setSplashPhase] = useState(0)
  const [splashDone, setSplashDone] = useState(false)
  const [redirectTo, setRedirectTo] = useState(null)
  const [splashLine] = useState(() => SPLASH_LINES[Math.floor(Math.random() * SPLASH_LINES.length)])

  // Auth check — runs in background while splash shows
  useEffect(() => {
    fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'me' })
    })
      .then(r => r.json())
      .then(({ user }) => {
        if (!user) setRedirectTo('/login')
        else if (user.role === 'admin') setRedirectTo('/admin')
        else if (user.role === 'delivery') setRedirectTo('/delivery')
        else setRedirectTo('/menu')
      })
      .catch(() => setRedirectTo('/login'))
  }, [])

  // Splash animation phases
  useEffect(() => {
    const timers = [
      setTimeout(() => setSplashPhase(1), 200),
      setTimeout(() => setSplashPhase(2), 850),
      setTimeout(() => setSplashPhase(3), 1550),
      setTimeout(() => setSplashPhase(4), 2400),
      setTimeout(() => setSplashPhase(5), 3700),
      setTimeout(() => setSplashDone(true), 4500),
    ]
    return () => timers.forEach(clearTimeout)
  }, [])

  // Redirect when BOTH splash is done AND auth is resolved
  useEffect(() => {
    if (splashDone && redirectTo) {
      setTimeout(() => router.push(redirectTo), 900)
    }
  }, [splashDone, redirectTo])

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'linear-gradient(160deg, #0f0400 0%, #1e0a00 45%, #120600 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
      opacity: splashDone ? 0 : 1,
      transition: splashDone ? 'opacity 0.85s ease' : 'none',
    }}>
      <style>{`
        @keyframes ckFloatUp {
          0%   { transform: translateY(0) rotate(0deg); opacity: 0.18; }
          50%  { opacity: 0.35; }
          100% { transform: translateY(-110vh) rotate(25deg); opacity: 0; }
        }
        @keyframes ckGlow {
          0%,100% { box-shadow: 0 0 28px rgba(232,93,4,0.55), 0 0 60px rgba(232,93,4,0.18); }
          50%      { box-shadow: 0 0 55px rgba(232,93,4,0.9), 0 0 110px rgba(232,93,4,0.4); }
        }
        @keyframes ckShimmer {
          0%   { background-position: -300% center; }
          100% { background-position:  300% center; }
        }
        @keyframes ckDot {
          0%,100% { opacity: 0.35; transform: scale(1); }
          50%      { opacity: 1;    transform: scale(1.5); }
        }
        @keyframes ckBar {
          0%   { width: 0; opacity: 0; }
          20%  { opacity: 1; }
          100% { width: 64px; opacity: 1; }
        }
      `}</style>

      {/* Floating food emojis */}
      {['🍛','🍜','🥘','🍱','🌮','🍝','🍚','🫕','🥗','🍲'].map((em, i) => (
        <div key={i} style={{
          position: 'absolute',
          left: `${i * 10 + 4}%`,
          bottom: `-${6 + (i % 3) * 2}%`,
          fontSize: `${14 + (i % 4) * 6}px`,
          animation: `ckFloatUp ${6 + i * 0.65}s linear ${i * 0.45}s infinite`,
          userSelect: 'none', pointerEvents: 'none',
        }}>{em}</div>
      ))}

      {/* Radial glow */}
      <div style={{
        position: 'absolute', width: 320, height: 320, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(232,93,4,0.13) 0%, transparent 70%)',
        top: '50%', left: '50%', transform: 'translate(-50%, -70%)',
        pointerEvents: 'none',
      }} />

      {/* Logo */}
      <div style={{
        opacity: splashPhase >= 1 ? 1 : 0,
        transform: splashPhase >= 1 ? 'scale(1)' : 'scale(0.2)',
        transition: 'opacity 0.5s ease, transform 0.65s cubic-bezier(0.34,1.56,0.64,1)',
        marginBottom: 14, borderRadius: 22,
        animation: splashPhase >= 1 ? 'ckGlow 2.2s ease-in-out 0.65s infinite' : 'none',
      }}>
        <FoodFiLogo size={78} style={{ borderRadius: 20, display: 'block' }} />
      </div>

      {/* Brand name */}
      <div style={{
        opacity: splashPhase >= 2 ? 1 : 0,
        transform: splashPhase >= 2 ? 'translateY(0)' : 'translateY(22px)',
        transition: 'opacity 0.55s ease, transform 0.55s ease',
        textAlign: 'center', marginBottom: 6,
      }}>
        <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: '-0.5px', lineHeight: 1.1 }}>
          <span style={{ color: '#e85d04' }}>Food</span>
          <span style={{ color: '#fff' }}>Fi</span>
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', fontWeight: 600, letterSpacing: 3.5, textTransform: 'uppercase', marginTop: 3 }}>
          Cloud Kitchen
        </div>
      </div>

      {/* Animated bar */}
      <div style={{
        height: 2,
        background: 'linear-gradient(90deg, transparent, #e85d04, transparent)',
        borderRadius: 2, marginBottom: 24,
        animation: splashPhase >= 2 ? 'ckBar 0.7s ease forwards' : 'none',
        width: splashPhase >= 2 ? 64 : 0,
      }} />

      {/* Main line */}
      <div style={{
        opacity: splashPhase >= 3 ? 1 : 0,
        transform: splashPhase >= 3 ? 'translateY(0)' : 'translateY(20px)',
        transition: 'opacity 0.65s ease, transform 0.65s ease',
        textAlign: 'center', padding: '0 30px', marginBottom: 14, maxWidth: 360,
      }}>
        <div style={{
          fontSize: 21, fontWeight: 800, lineHeight: 1.45, letterSpacing: 0.2,
          background: 'linear-gradient(90deg, #fbbf24, #e85d04, #f59e0b, #e85d04, #fbbf24)',
          backgroundSize: '300% auto',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          animation: splashPhase >= 3 ? 'ckShimmer 3.5s linear infinite' : 'none',
        }}>
          {splashLine.main}
        </div>
      </div>

      {/* Sub line */}
      <div style={{
        opacity: splashPhase >= 4 ? 1 : 0,
        transform: splashPhase >= 4 ? 'translateY(0)' : 'translateY(14px)',
        transition: 'opacity 0.6s ease, transform 0.6s ease',
        textAlign: 'center', padding: '0 40px', maxWidth: 340,
      }}>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.58)', fontWeight: 500, letterSpacing: 0.3, lineHeight: 1.65 }}>
          {splashLine.sub}
        </div>
      </div>

      {/* Pulsing dots */}
      <div style={{
        display: 'flex', gap: 7, marginTop: 32,
        opacity: splashPhase >= 4 ? 1 : 0,
        transition: 'opacity 0.5s ease 0.2s',
      }}>
        {[0,1,2].map(i => (
          <div key={i} style={{
            width: 6, height: 6, borderRadius: '50%',
            background: i === 1 ? '#e85d04' : 'rgba(232,93,4,0.45)',
            animation: splashPhase >= 4 ? `ckDot 1.1s ease-in-out ${i * 0.22}s infinite` : 'none',
          }} />
        ))}
      </div>

      {/* Bottom label */}
      <div style={{
        position: 'absolute', bottom: 28,
        opacity: splashPhase >= 4 ? 0.35 : 0,
        transition: 'opacity 0.5s ease 0.4s',
        fontSize: 10, color: 'rgba(255,255,255,0.35)',
        letterSpacing: 2.5, textTransform: 'uppercase', fontWeight: 500,
      }}>
        order.foodfi.in
      </div>
    </div>
  )
}

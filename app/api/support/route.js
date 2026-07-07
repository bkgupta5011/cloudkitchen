export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { sendPushToUser } from '@/lib/push'
import { getLoyaltyStatus } from '@/lib/loyalty'

async function ensureTable(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS support_messages (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id UUID NOT NULL,
      user_name VARCHAR(100),
      user_phone VARCHAR(20),
      message TEXT NOT NULL,
      is_from_admin BOOLEAN DEFAULT false,
      is_read BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `
  try { await sql`ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS is_bot BOOLEAN DEFAULT false` } catch {}
  try { await sql`ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS image_url TEXT` } catch {}
  // Per-conversation state: resolved flag + last CSAT rating (1 up / -1 down)
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS support_thread_state (
        user_id UUID PRIMARY KEY,
        resolved BOOLEAN DEFAULT false,
        csat SMALLINT,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )`
  } catch {}
}

// Reopen a thread whenever the customer sends anything new.
async function reopenThread(sql, userId) {
  try {
    await sql`
      INSERT INTO support_thread_state (user_id, resolved, updated_at)
      VALUES (${userId}, false, NOW())
      ON CONFLICT (user_id) DO UPDATE SET resolved = false, updated_at = NOW()
    `
  } catch {}
}

// ── Smart bot helpers ───────────────────────────────────────────────
function orderStatusText(order) {
  if (!order) {
    return "Mujhe aapka koi recent order nahi mila. 🤔 Agar aapne abhi-abhi order kiya hai to thodi der me update aayega — ya order number bata dein, hum check karte hain."
  }
  const map = {
    pending:          "🕐 Order mil gaya hai — kitchen abhi ise confirm kar rahi hai.",
    confirmed:        "✅ Order confirm ho gaya hai, jaldi banana shuru hoga.",
    preparing:        "👨‍🍳 Aapka khana ban raha hai — garma-garam taiyaar ho raha hai!",
    out_for_delivery: "🛵 Order nikal chuka hai — delivery partner raste me hai, bas pahunchne wala hai!",
    delivered:        "📦 Ye order deliver ho chuka hai. Agar koi dikkat hai to yahin bata dein.",
    cancelled:        "❌ Ye order cancel ho gaya tha.",
  }
  const line = map[order.status] || "Aapka order process ho raha hai."
  return `Order #${order.order_number} (₹${Math.round(order.total)}):\n${line}`
}

function toMin(s) { if (!s) return null; const [h, m] = String(s).split(':').map(Number); return Number.isFinite(h) ? h * 60 + (m || 0) : null }
function withinHours(open, close) {
  const o = toMin(open), c = toMin(close); if (o == null || c == null) return true
  const now = (() => { const d = new Date(); return d.getHours() * 60 + d.getMinutes() })()
  return c > o ? (now >= o && now < c) : (now >= o || now < c)
}

const TOPIC_LABEL = {
  order_status:   '📦 Mera order kaha hai?',
  reorder:        '🔁 Phir se wahi order',
  offers:         '🎉 Aaj kya offer hai?',
  reward:         '🎁 Mera reward / stamp',
  timing:         '🕐 Aap kab tak open ho?',
  wrong_item:     '❌ Galat / kam item aaya',
  refund:         '💰 Mujhe refund chahiye',
  delivery_charge:'🛵 Delivery charge kitna?',
}

// Intents the bot can FULLY answer on its own (no human needed → mark read).
const RESOLVING = new Set(['order_status', 'timing', 'offers', 'reward', 'delivery_charge', 'reorder'])

// Lightweight keyword intent detection for free-typed messages (Hinglish + EN).
// Order matters — complaints and specific intents are checked before the broad
// "order" catch so "order galat aaya" isn't mistaken for a status query.
function classifyIntent(text) {
  const t = ' ' + String(text).toLowerCase() + ' '
  const has = (...ws) => ws.some(w => t.includes(w))
  if (has('galat', 'wrong', 'missing', 'kam mila', 'kam aaya', 'kharab', 'thanda', ' cold', 'ganda', 'bad quality')) return 'wrong_item'
  if (has('refund', 'paisa wapas', 'paise wapas', 'money back', 'wapas kar')) return 'refund'
  if (has('reorder', 're-order', 'phir se', 'dobara', 'fir se', 'wahi order', 'same order', 'repeat order')) return 'reorder'
  if (has('reward', 'stamp', 'loyalty', 'point')) return 'reward'
  if (has('offer', 'discount', 'coupon', 'promo', 'deal', 'sasta', 'combo')) return 'offers'
  if (has('delivery charge', 'delivery kitna', 'delivery fee', 'delivery cost', 'free delivery', 'shipping')) return 'delivery_charge'
  if (has('open', 'khula', 'khulega', 'band ', 'close', 'timing', 'kitne baje', 'kab tak', 'time kya')) return 'timing'
  if (has('order', 'kaha', 'kahan', 'kab aa', 'kb aa', 'kitni der', 'kitna time', 'track', 'pahunch', 'status', 'where is')) return 'order_status'
  return null
}

// Build the bot's answer for an intent. Returns { reply, ack?, reorder? }.
// ack:true means it still needs a human (don't mark the question read).
async function buildBotAnswer(sql, userId, intent) {
  if (intent === 'order_status') {
    const [order] = await sql`
      SELECT o.order_number, o.status, o.total, d.name AS boy_name, d.phone AS boy_phone
      FROM orders o LEFT JOIN delivery_boys d ON o.delivery_boy_id = d.id
      WHERE o.user_id = ${userId} ORDER BY o.created_at DESC LIMIT 1`
    let reply = orderStatusText(order)
    if (order?.status === 'out_for_delivery' && order.boy_phone) {
      reply += `\n\n🛵 Delivery partner: ${order.boy_name || 'Partner'} — 📞 ${order.boy_phone}`
    }
    return { reply }
  }
  if (intent === 'timing') {
    const [ks] = await sql`SELECT is_open, open_time, close_time FROM kitchen_settings WHERE id = 1`
    const openNow = ks?.is_open && withinHours(ks?.open_time, ks?.close_time)
    return { reply: openNow
      ? `🟢 Hum abhi OPEN hain! Aaj ${ks?.open_time || '09:00'} se ${ks?.close_time || '22:00'} tak orders le rahe hain.`
      : `😴 Abhi hum band hain. Timing: ${ks?.open_time || '09:00'} – ${ks?.close_time || '22:00'} roz. Khulte hi order kar sakte hain!` }
  }
  if (intent === 'offers') {
    const [ks] = await sql`SELECT free_delivery_all FROM kitchen_settings WHERE id = 1`
    let offers = []
    try { offers = await sql`SELECT code, type, value FROM offers WHERE is_active = true AND (valid_till IS NULL OR valid_till >= CURRENT_DATE) ORDER BY created_at DESC LIMIT 5` } catch {}
    const lines = []
    if (ks?.free_delivery_all) lines.push('🎉 Abhi SAB orders pe FREE delivery!')
    for (const o of offers) {
      const v = o.type === 'flat' ? `₹${o.value} off` : o.type === 'percent' ? `${o.value}% off` : 'Free delivery'
      lines.push(`🏷️ ${o.code} — ${v}`)
    }
    lines.push('🔥 ₹99 Combos hamesha available!')
    return { reply: 'Aaj ke offers:\n' + lines.join('\n') }
  }
  if (intent === 'delivery_charge') {
    return { reply: '🛵 Delivery charge aapke ghar ki doori pe depend karta hai — cart me apna address daalte hi exact charge dikh jaata hai. Aur bade order pe delivery FREE ho jaati hai!' }
  }
  if (intent === 'reward') {
    let st = null
    try { st = await getLoyaltyStatus(sql, userId) } catch {}
    if (!st?.enabled) return { reply: '🎁 Abhi loyalty reward program active nahi hai. Jald hi aayega — order karte rahiye!' }
    if (st.ready) return { reply: `🎉 Aapka ₹${st.reward} off ready hai — next order pe apne aap lag jayega!` }
    return { reply: `🎟️ Aapke ${st.stamps}/${st.threshold} stamps ho gaye. Bas ${st.ordersToGo} aur order — phir ₹${st.reward} off milega!` }
  }
  if (intent === 'reorder') {
    const [lastOrder] = await sql`SELECT id, order_number FROM orders WHERE user_id = ${userId} AND status <> 'cancelled' ORDER BY created_at DESC LIMIT 1`
    if (!lastOrder) return { reply: 'Aapka koi pichhla order nahi mila. Pehli baar? Menu dekhiye — kaafi kuch acha hai! 🍽️' }
    const items = await sql`SELECT menu_item_id, quantity, name FROM order_items WHERE order_id = ${lastOrder.id} AND menu_item_id IS NOT NULL`
    if (!items.length) return { reply: 'Reorder ke liye items nahi mile.' }
    const list = items.map(i => `${i.name} × ${i.quantity}`).join(', ')
    return {
      reply: `🔁 Aapka pichhla order (#${lastOrder.order_number}): ${list}.\nCart me daal raha hoon — bas checkout karein! 👇`,
      reorder: { items: items.map(i => ({ id: i.menu_item_id, qty: Number(i.quantity) })), order_number: lastOrder.order_number },
    }
  }
  if (intent === 'refund') {
    return { ack: true, reply: "Sorry for the trouble 🙏 Aapki refund request note kar li. Order number aur short reason bhej dein — humari team turant dekhegi aur reply karegi." }
  }
  if (intent === 'wrong_item') {
    return { ack: true, reply: "Oh no, iske liye maafi 🙏 Kya aap galat/kam mile item ki ek photo aur order number bhej sakte hain? (Neeche 📎 se photo bhejein.) Team turant sahi karegi." }
  }
  return null
}

// GET — customer: own messages + thread state; admin: all threads (or one user's)
export async function GET(request) {
  const sql = getDb()
  const token = request.cookies.get('ck_token')?.value
  const user = verifyToken(token)
  if (!user) return NextResponse.json({ error: 'Login required' }, { status: 401 })
  await ensureTable(sql)

  if (user.role === 'admin') {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (userId) {
      const msgs = await sql`SELECT * FROM support_messages WHERE user_id = ${userId} ORDER BY created_at ASC`
      await sql`UPDATE support_messages SET is_read = true WHERE user_id = ${userId} AND is_from_admin = false`
      return NextResponse.json({ messages: msgs })
    }

    const threads = await sql`
      SELECT
        latest.user_id, u.name AS user_name, u.phone AS user_phone,
        latest.message, latest.is_from_admin, latest.is_read, latest.created_at,
        COALESCE(unread.cnt, 0) AS unread_count,
        COALESCE(st.resolved, false) AS resolved, st.csat
      FROM (
        SELECT DISTINCT ON (user_id) * FROM support_messages ORDER BY user_id, created_at DESC
      ) latest
      JOIN users u ON latest.user_id = u.id
      LEFT JOIN (
        SELECT user_id, COUNT(*) AS cnt FROM support_messages
        WHERE is_read = false AND is_from_admin = false GROUP BY user_id
      ) unread ON unread.user_id = latest.user_id
      LEFT JOIN support_thread_state st ON st.user_id = latest.user_id
      ORDER BY CASE WHEN COALESCE(unread.cnt, 0) > 0 THEN 0 ELSE 1 END, latest.created_at DESC
    `
    return NextResponse.json({ threads })
  }

  if (user.role === 'customer') {
    const msgs = await sql`SELECT * FROM support_messages WHERE user_id = ${user.id} ORDER BY created_at ASC`
    await sql`UPDATE support_messages SET is_read = true WHERE user_id = ${user.id} AND is_from_admin = true`
    const [state] = await sql`SELECT resolved, csat FROM support_thread_state WHERE user_id = ${user.id}`
    return NextResponse.json({ messages: msgs, state: state || { resolved: false, csat: null } })
  }

  return NextResponse.json({ messages: [] })
}

// POST — messages, quick-help topics, photo, admin reply/resolve, CSAT
export async function POST(request) {
  const sql = getDb()
  const token = request.cookies.get('ck_token')?.value
  const user = verifyToken(token)
  if (!user) return NextResponse.json({ error: 'Login required' }, { status: 401 })
  await ensureTable(sql)

  const { message, targetUserId, topic, image_url, action, csat } = await request.json()

  // ── Admin: resolve / reopen a thread ──
  if (user.role === 'admin' && action && targetUserId) {
    if (action === 'resolve') {
      await sql`
        INSERT INTO support_thread_state (user_id, resolved, updated_at)
        VALUES (${targetUserId}, true, NOW())
        ON CONFLICT (user_id) DO UPDATE SET resolved = true, updated_at = NOW()
      `
      // Ask the customer to rate — a bot message + a push.
      await sql`
        INSERT INTO support_messages (user_id, user_name, user_phone, message, is_from_admin, is_bot)
        VALUES (${targetUserId}, 'FoodFi Bot', 'Bot',
          'Aapka issue resolve ho gaya? 🙏 Neeche 👍 / 👎 se batayein — isse hum aur behtar ho paayenge.', true, true)
      `
      sendPushToUser(String(targetUserId), { title: '✅ Support resolved', body: 'Aapka issue resolve ho gaya — kaisa laga? 👍/👎', url: '/menu', tag: 'support-reply' }, 'customer').catch(() => {})
      return NextResponse.json({ ok: true })
    }
    if (action === 'reopen') {
      await sql`
        INSERT INTO support_thread_state (user_id, resolved, updated_at)
        VALUES (${targetUserId}, false, NOW())
        ON CONFLICT (user_id) DO UPDATE SET resolved = false, updated_at = NOW()
      `
      return NextResponse.json({ ok: true })
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }

  // ── Admin replying to a customer ──
  if (user.role === 'admin' && targetUserId) {
    if (!message?.trim()) return NextResponse.json({ error: 'Message required' }, { status: 400 })
    const [m] = await sql`
      INSERT INTO support_messages (user_id, user_name, user_phone, message, is_from_admin)
      VALUES (${targetUserId}, 'Admin', 'Kitchen', ${message.trim()}, true)
      RETURNING *
    `
    sendPushToUser(String(targetUserId), { title: '💬 Reply from FoodFi', body: message.trim().slice(0, 120), url: '/menu', tag: 'support-reply' }, 'customer').catch(() => {})
    return NextResponse.json({ message: m })
  }

  if (user.role !== 'customer') return NextResponse.json({ error: 'Not allowed' }, { status: 403 })

  // ── Customer: submit a CSAT rating ──
  if (csat === 1 || csat === -1) {
    await sql`
      INSERT INTO support_thread_state (user_id, csat, updated_at)
      VALUES (${user.id}, ${csat}, NOW())
      ON CONFLICT (user_id) DO UPDATE SET csat = ${csat}, updated_at = NOW()
    `
    await sql`
      INSERT INTO support_messages (user_id, user_name, user_phone, message, is_from_admin, is_bot, is_read)
      VALUES (${user.id}, 'FoodFi Bot', 'Bot',
        ${csat === 1 ? '🙏 Shukriya! Aapke feedback ke liye dhanyavaad.' : '🙏 Feedback ke liye shukriya — hum aur behtar karenge. Zyada dikkat ho to yahin likh dein.'},
        true, true, true)
    `
    return NextResponse.json({ ok: true })
  }

  const [custInfo] = await sql`SELECT name, phone FROM users WHERE id = ${user.id}`
  const cName = custInfo?.name || 'Customer'
  const cPhone = custInfo?.phone || ''

  // ── Photo message ──
  if (image_url) {
    const [m] = await sql`
      INSERT INTO support_messages (user_id, user_name, user_phone, message, image_url, is_from_admin)
      VALUES (${user.id}, ${cName}, ${cPhone}, ${message?.trim() || '📷 Photo'}, ${image_url}, false)
      RETURNING *
    `
    await reopenThread(sql, user.id)
    return NextResponse.json({ message: m })
  }

  // ── Intent: either a quick-help chip (topic) or detected from typed text ──
  const intent = (topic && TOPIC_LABEL[topic]) ? topic : (message?.trim() ? classifyIntent(message) : null)

  // Quick-help chip tap: the customer's shown message is the chip label.
  if (topic && TOPIC_LABEL[topic]) {
    const ans = await buildBotAnswer(sql, user.id, intent)
    const resolvesFully = intent && RESOLVING.has(intent) && !ans?.ack
    const [q] = await sql`
      INSERT INTO support_messages (user_id, user_name, user_phone, message, is_from_admin, is_read)
      VALUES (${user.id}, ${cName}, ${cPhone}, ${TOPIC_LABEL[topic]}, false, ${!!resolvesFully})
      RETURNING *
    `
    await reopenThread(sql, user.id)
    const [bot] = await sql`
      INSERT INTO support_messages (user_id, user_name, user_phone, message, is_from_admin, is_bot, is_read)
      VALUES (${user.id}, 'FoodFi Bot', 'Bot', ${ans?.reply || 'Team jaldi reply karegi 🙏'}, true, true, true)
      RETURNING *
    `
    return NextResponse.json({ message: q, bot, reorder: ans?.reorder || null })
  }

  // ── Free-text message ──
  if (!message?.trim()) return NextResponse.json({ error: 'Message required' }, { status: 400 })

  const ans = intent ? await buildBotAnswer(sql, user.id, intent) : null
  const resolvesFully = !!(ans && intent && RESOLVING.has(intent) && !ans.ack)

  const [m] = await sql`
    INSERT INTO support_messages (user_id, user_name, user_phone, message, is_from_admin, is_read)
    VALUES (${user.id}, ${cName}, ${cPhone}, ${message.trim()}, false, ${resolvesFully})
    RETURNING *
  `
  await reopenThread(sql, user.id)

  // If the bot understood the question, answer instantly and stop here.
  if (ans) {
    const [bot] = await sql`
      INSERT INTO support_messages (user_id, user_name, user_phone, message, is_from_admin, is_bot, is_read)
      VALUES (${user.id}, 'FoodFi Bot', 'Bot', ${ans.reply}, true, true, true)
      RETURNING *
    `
    return NextResponse.json({ message: m, bot, reorder: ans.reorder || null })
  }

  // After-hours auto-reply
  try {
    const [ks] = await sql`SELECT is_open, open_time, close_time, phone FROM kitchen_settings WHERE id = 1`
    const closed = !(ks?.is_open && withinHours(ks?.open_time, ks?.close_time))
    if (closed) {
      const [prevBot] = await sql`SELECT is_bot FROM support_messages WHERE user_id = ${user.id} AND id <> ${m.id} ORDER BY created_at DESC LIMIT 1`
      if (!prevBot?.is_bot) {
        const phoneTxt = ks?.phone ? ` Urgent order issue ke liye call: ${ks.phone}.` : ''
        await sql`
          INSERT INTO support_messages (user_id, user_name, user_phone, message, is_from_admin, is_bot)
          VALUES (${user.id}, 'FoodFi Bot', 'Bot',
            ${`🕘 Abhi hum band hain (timing: ${ks?.open_time || '09:00'}–${ks?.close_time || '22:00'}). Aapka message mil gaya — hum khulte hi reply karenge.${phoneTxt}`},
            true, true)
        `
      }
    }
  } catch {}

  return NextResponse.json({ message: m })
}

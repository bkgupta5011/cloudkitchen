export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { sendPushToUser } from '@/lib/push'

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
  order_status: '📦 Mera order kaha hai?',
  refund:       '💰 Mujhe refund chahiye',
  wrong_item:   '❌ Galat / kam item aaya',
  timing:       '🕐 Aap kab tak open ho?',
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

  // ── Quick-help topic tap → instant smart bot answer ──
  if (topic && TOPIC_LABEL[topic]) {
    const botResolves = topic === 'order_status' || topic === 'timing'
    const [q] = await sql`
      INSERT INTO support_messages (user_id, user_name, user_phone, message, is_from_admin, is_read)
      VALUES (${user.id}, ${cName}, ${cPhone}, ${TOPIC_LABEL[topic]}, false, ${botResolves})
      RETURNING *
    `
    await reopenThread(sql, user.id)

    let botReply
    if (topic === 'order_status') {
      const [order] = await sql`SELECT order_number, status, total FROM orders WHERE user_id = ${user.id} ORDER BY created_at DESC LIMIT 1`
      botReply = orderStatusText(order)
    } else if (topic === 'timing') {
      const [ks] = await sql`SELECT is_open, open_time, close_time FROM kitchen_settings WHERE id = 1`
      const openNow = ks?.is_open && withinHours(ks?.open_time, ks?.close_time)
      botReply = openNow
        ? `🟢 Hum abhi OPEN hain! Aaj ${ks?.open_time || '09:00'} se ${ks?.close_time || '22:00'} tak orders le rahe hain.`
        : `😴 Abhi hum band hain. Timing: ${ks?.open_time || '09:00'} – ${ks?.close_time || '22:00'} roz. Khulte hi order kar sakte hain!`
    } else if (topic === 'refund') {
      botReply = "Sorry for the trouble 🙏 Aapki refund request note kar li. Order number aur short reason bhej dein — humari team turant dekhegi aur reply karegi."
    } else if (topic === 'wrong_item') {
      botReply = "Oh no, iske liye maafi 🙏 Kya aap galat/kam mile item ki ek photo aur order number bhej sakte hain? (Neeche 📎 se photo bhejein.) Team turant sahi karegi."
    }

    const [bot] = await sql`
      INSERT INTO support_messages (user_id, user_name, user_phone, message, is_from_admin, is_bot, is_read)
      VALUES (${user.id}, 'FoodFi Bot', 'Bot', ${botReply}, true, true, true)
      RETURNING *
    `
    return NextResponse.json({ message: q, bot })
  }

  // ── Regular free-text message ──
  if (!message?.trim()) return NextResponse.json({ error: 'Message required' }, { status: 400 })
  const [m] = await sql`
    INSERT INTO support_messages (user_id, user_name, user_phone, message, is_from_admin)
    VALUES (${user.id}, ${cName}, ${cPhone}, ${message.trim()}, false)
    RETURNING *
  `
  await reopenThread(sql, user.id)

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

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
  // is_bot = an auto-generated reply (order-status bot / after-hours notice)
  try { await sql`ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS is_bot BOOLEAN DEFAULT false` } catch {}
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

// Labels shown as the customer's own message when they tap a quick-help chip
const TOPIC_LABEL = {
  order_status: '📦 Mera order kaha hai?',
  refund:       '💰 Mujhe refund chahiye',
  wrong_item:   '❌ Galat / kam item aaya',
  timing:       '🕐 Aap kab tak open ho?',
}

// GET — customer: own messages; admin: all threads (or one user's thread)
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
        COALESCE(unread.cnt, 0) AS unread_count
      FROM (
        SELECT DISTINCT ON (user_id) * FROM support_messages ORDER BY user_id, created_at DESC
      ) latest
      JOIN users u ON latest.user_id = u.id
      LEFT JOIN (
        SELECT user_id, COUNT(*) AS cnt FROM support_messages
        WHERE is_read = false AND is_from_admin = false GROUP BY user_id
      ) unread ON unread.user_id = latest.user_id
      ORDER BY CASE WHEN COALESCE(unread.cnt, 0) > 0 THEN 0 ELSE 1 END, latest.created_at DESC
    `
    return NextResponse.json({ threads })
  }

  if (user.role === 'customer') {
    const msgs = await sql`SELECT * FROM support_messages WHERE user_id = ${user.id} ORDER BY created_at ASC`
    await sql`UPDATE support_messages SET is_read = true WHERE user_id = ${user.id} AND is_from_admin = true`
    return NextResponse.json({ messages: msgs })
  }

  return NextResponse.json({ messages: [] })
}

// POST — send a message (free text) OR tap a quick-help topic (customer)
export async function POST(request) {
  const sql = getDb()
  const token = request.cookies.get('ck_token')?.value
  const user = verifyToken(token)
  if (!user) return NextResponse.json({ error: 'Login required' }, { status: 401 })
  await ensureTable(sql)

  const { message, targetUserId, topic } = await request.json()

  // ── Admin replying to a customer ──
  if (user.role === 'admin' && targetUserId) {
    if (!message?.trim()) return NextResponse.json({ error: 'Message required' }, { status: 400 })
    const [m] = await sql`
      INSERT INTO support_messages (user_id, user_name, user_phone, message, is_from_admin)
      VALUES (${targetUserId}, 'Admin', 'Kitchen', ${message.trim()}, true)
      RETURNING *
    `
    // Notify the customer even if the app is closed.
    sendPushToUser(String(targetUserId), {
      title: '💬 Reply from FoodFi',
      body: message.trim().slice(0, 120),
      url: '/menu',
      tag: 'support-reply',
    }, 'customer').catch(() => {})
    return NextResponse.json({ message: m })
  }

  if (user.role !== 'customer') return NextResponse.json({ error: 'Not allowed' }, { status: 403 })

  const [custInfo] = await sql`SELECT name, phone FROM users WHERE id = ${user.id}`
  const cName = custInfo?.name || 'Customer'
  const cPhone = custInfo?.phone || ''

  // ── Quick-help topic tap → instant smart bot answer ──
  if (topic && TOPIC_LABEL[topic]) {
    // Topics the bot fully answers → mark read so the founder isn't pinged.
    const botResolves = topic === 'order_status' || topic === 'timing'

    const [q] = await sql`
      INSERT INTO support_messages (user_id, user_name, user_phone, message, is_from_admin, is_read)
      VALUES (${user.id}, ${cName}, ${cPhone}, ${TOPIC_LABEL[topic]}, false, ${botResolves})
      RETURNING *
    `

    let botReply
    if (topic === 'order_status') {
      const [order] = await sql`
        SELECT order_number, status, total FROM orders
        WHERE user_id = ${user.id} ORDER BY created_at DESC LIMIT 1
      `
      botReply = orderStatusText(order)
    } else if (topic === 'timing') {
      const [ks] = await sql`SELECT is_open, open_time, close_time, phone FROM kitchen_settings WHERE id = 1`
      const openNow = ks?.is_open && withinHours(ks?.open_time, ks?.close_time)
      botReply = openNow
        ? `🟢 Hum abhi OPEN hain! Aaj ${ks?.open_time || '09:00'} se ${ks?.close_time || '22:00'} tak orders le rahe hain.`
        : `😴 Abhi hum band hain. Timing: ${ks?.open_time || '09:00'} – ${ks?.close_time || '22:00'} roz. Khulte hi order kar sakte hain!`
    } else if (topic === 'refund') {
      botReply = "Sorry for the trouble 🙏 Aapki refund request note kar li. Order number aur short reason bhej dein — humari team turant dekhegi aur reply karegi."
    } else if (topic === 'wrong_item') {
      botReply = "Oh no, iske liye maafi 🙏 Kya aap galat/kam mile item ki ek photo aur order number bhej sakte hain? Team turant sahi karegi."
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

  // After-hours auto-reply: if we're closed and the last thing in the thread
  // wasn't already a bot notice, drop a friendly "we'll reply when we open".
  try {
    const [ks] = await sql`SELECT is_open, open_time, close_time, phone FROM kitchen_settings WHERE id = 1`
    const closed = !(ks?.is_open && withinHours(ks?.open_time, ks?.close_time))
    if (closed) {
      const [prevBot] = await sql`
        SELECT is_bot FROM support_messages
        WHERE user_id = ${user.id} AND id <> ${m.id}
        ORDER BY created_at DESC LIMIT 1
      `
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

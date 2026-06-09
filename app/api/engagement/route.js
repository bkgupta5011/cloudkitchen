export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { verifyToken } from '@/lib/auth'

// Default messages seeded on first use
const DEFAULTS = {
  morning_notif: [
    "Uthh gaye? 😴 Nashta nahi kiya toh dimaag nahi chalega... hum hain na! 🍳",
    "Good Morning! ☀️ Subah ka nashta ghar jaisa ho toh din banta hai — order karo!",
    "🌅 Nayi subah, nayi bhook! Aaj nashta FoodFi ke saath karein?",
  ],
  lunch_notif: [
    "Bhai lunch hua? 😅 Ya abhi bhi kaam mein dube ho? Ghar ka khana ready hai!",
    "⏰ 12 baj gaye! Lunch ka time ho gaya — ab kaam baad mein, pehle pet pooja!",
    "☀️ Dopahar ho gayi! Aaj kya khana hai? Hum 30 min mein pahuncha dete hain 🛵",
  ],
  dinner_notif: [
    "Dinner ka time ho gaya! Ghar mein kuch nahi bana? Koi baat nahi — 30 min mein aa jaata hai 🛵",
    "🌙 Shaam ho gayi! Din bhar ki mehnat ke baad, aaj khana hum banayenge!",
    "🍽️ Dinner time! Table laga lo, hum khana laate hain!",
  ],
  miss_you: [
    "3 din ho gaye! Sab theek ho na? 🥺 Hum aapka wait kar rahe hain... aur khana bhi! 😄",
    "Kya hua? Diet pe ho? 😂 Hum bhi healthy options laate hain! Aa jao wapas!",
    "Roz naye log aa rahe hain... aap kahan ho? 🫣 Aapki jagah koi nahi le sakta!",
  ],
  post_delivery: [
    "Khana mil gaya? 😊 Kaisa laga? Ek review doge toh hamare chef ka dil khush ho jaayega! ⭐",
    "Umeed hai khana pasand aaya! Bartan hum nahi dhotey 😂 But wapas zaroor aana!",
    "🙏 Shukriya! Khana deliver ho gaya. Kaisa laga? Zaroor batana!",
  ],
  friday: [
    "🎉 Weekend aa gaya! Khana banane ka time nahi — order karne ka time hai! 😄",
    "Friday hai bhai! Deserve karte ho ghar ka khana — ghar par baithke! 🛋️",
    "TGIF! 🥳 Aaj koi kaam nahi, bas mast khana aur aaram!",
  ],
  morning_banner: [
    "🌅 Subah ka nashta, ghar jaisa swad!",
    "☀️ Nayi subah, nayi bhook! Kya order karein aaj?",
    "🌄 Din ki shuruwaat acha khane ke saath karein!",
  ],
  afternoon_banner: [
    "☀️ Lunch time! Kya khaoge aaj? Hum tayaar hain!",
    "🍽️ Dopahar ho gayi — order karo, 30 min mein aa jaata hai!",
    "⏰ Pet pooja ka time! Kya order karein aaj?",
  ],
  evening_banner: [
    "🌆 Shaam ho gayi! Kuch chhota sa order karte hain?",
    "🌅 Shaam ki bhook — ghar jaisa swad, darwaze tak!",
    "🌆 Evening vibes! Aaj dinner ghar pe hi mangate hain?",
  ],
  night_banner: [
    "🌙 Din bhar ki mehnat ke baad, aaj khana hum banayenge!",
    "🌙 Raat ho gayi — ghar ka khana, ghar pe delivery!",
    "✨ Good Evening! Aaj ka dinner FoodFi ke saath?",
  ],
  late_night_banner: [
    "🦉 Itni raat ko? Late night hunger — hum hain na! 😄",
    "🌙 Raat ko bhi bhook lagi? Koi baat nahi — hum hain!",
  ],
}

const CATEGORY_LABELS = {
  morning_notif:     '🌅 Subah ki Notification (8 AM)',
  lunch_notif:       '☀️ Lunch Notification (12:30 PM)',
  dinner_notif:      '🌙 Dinner Notification (7:30 PM)',
  miss_you:          '🥺 Miss You (3 din baad)',
  post_delivery:     '🚚 Post Delivery Care',
  friday:            '🎉 Friday Special',
  morning_banner:    '🌅 Menu Banner — Subah (6am–11am)',
  afternoon_banner:  '☀️ Menu Banner — Dopahar (11am–4pm)',
  evening_banner:    '🌆 Menu Banner — Shaam (4pm–8pm)',
  night_banner:      '🌙 Menu Banner — Raat (8pm–11pm)',
  late_night_banner: '🦉 Menu Banner — Late Night (11pm–6am)',
}

async function ensureTable(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS engagement_messages (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      category   VARCHAR(60) NOT NULL,
      message    TEXT NOT NULL,
      is_active  BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `.catch(() => {})
}

async function seedDefaults(sql) {
  const [{ count }] = await sql`SELECT COUNT(*) as count FROM engagement_messages`
  if (parseInt(count) > 0) return
  for (const [cat, msgs] of Object.entries(DEFAULTS)) {
    for (const msg of msgs) {
      await sql`INSERT INTO engagement_messages (category, message) VALUES (${cat}, ${msg})`.catch(() => {})
    }
  }
}

// GET — fetch all messages (admin) OR random active message for a category (menu)
export async function GET(request) {
  const sql = getDb()
  await ensureTable(sql)
  await seedDefaults(sql)

  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category')

  // Single category — return random active message (for menu banner)
  if (category) {
    const msgs = await sql`SELECT message FROM engagement_messages WHERE category = ${category} AND is_active = true`
    if (!msgs.length) return NextResponse.json({ message: null })
    const random = msgs[Math.floor(Math.random() * msgs.length)]
    return NextResponse.json({ message: random.message })
  }

  // Admin — return all messages grouped by category
  const all = await sql`SELECT * FROM engagement_messages ORDER BY category, created_at`
  const grouped = {}
  for (const [cat, label] of Object.entries(CATEGORY_LABELS)) {
    grouped[cat] = { label, messages: all.filter(m => m.category === cat) }
  }
  return NextResponse.json({ grouped, categoryLabels: CATEGORY_LABELS })
}

// POST — add new message (admin only)
export async function POST(request) {
  const sql = getDb()
  const token = request.cookies.get('ck_token')?.value
  const user = verifyToken(token)
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { category, message } = await request.json()
  if (!category || !message?.trim()) return NextResponse.json({ error: 'Category aur message dono chahiye' }, { status: 400 })
  if (!CATEGORY_LABELS[category]) return NextResponse.json({ error: 'Invalid category' }, { status: 400 })

  await ensureTable(sql)
  const [row] = await sql`INSERT INTO engagement_messages (category, message) VALUES (${category}, ${message.trim()}) RETURNING *`
  return NextResponse.json({ success: true, message: row })
}

// PATCH — toggle active / update message (admin only)
export async function PATCH(request) {
  const sql = getDb()
  const token = request.cookies.get('ck_token')?.value
  const user = verifyToken(token)
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, is_active, message } = await request.json()
  if (!id) return NextResponse.json({ error: 'ID chahiye' }, { status: 400 })

  if (typeof is_active === 'boolean') {
    await sql`UPDATE engagement_messages SET is_active = ${is_active} WHERE id = ${id}`
  }
  if (message?.trim()) {
    await sql`UPDATE engagement_messages SET message = ${message.trim()} WHERE id = ${id}`
  }
  return NextResponse.json({ success: true })
}

// DELETE — remove message (admin only)
export async function DELETE(request) {
  const sql = getDb()
  const token = request.cookies.get('ck_token')?.value
  const user = verifyToken(token)
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await request.json()
  if (!id) return NextResponse.json({ error: 'ID chahiye' }, { status: 400 })
  await sql`DELETE FROM engagement_messages WHERE id = ${id}`
  return NextResponse.json({ success: true })
}

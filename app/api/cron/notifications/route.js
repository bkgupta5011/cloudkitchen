export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { sendPushToUser, sendPushToRole } from '@/lib/push'

// Vercel calls this with ?type=morning|lunch|dinner|miss_you|friday
// Protected by CRON_SECRET header (set in Vercel env vars)
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')

  // Security: only Vercel cron or admin can call this
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!type) return NextResponse.json({ error: 'type param required' }, { status: 400 })

  const sql = getDb()

  // Get random active message for this notification type
  async function getMsg(category) {
    try {
      const msgs = await sql`SELECT message FROM engagement_messages WHERE category = ${category} AND is_active = true`
      if (!msgs.length) return null
      return msgs[Math.floor(Math.random() * msgs.length)].message
    } catch { return null }
  }

  try {
    if (type === 'morning') {
      const body = await getMsg('morning_notif') || "Uthh gaye? 😴 Nashta nahi kiya toh dimaag nahi chalega... hum hain na! 🍳"
      await sendPushToRole('customer', {
        title: '🌅 Good Morning — FoodFi',
        body,
        url: '/menu',
        tag: 'morning-notif',
      })
      return NextResponse.json({ success: true, type, body })
    }

    if (type === 'lunch') {
      const body = await getMsg('lunch_notif') || "Bhai lunch hua? 😅 Ghar ka khana ready hai!"
      await sendPushToRole('customer', {
        title: '☀️ Lunch Time — FoodFi',
        body,
        url: '/menu',
        tag: 'lunch-notif',
      })
      return NextResponse.json({ success: true, type, body })
    }

    if (type === 'dinner') {
      const body = await getMsg('dinner_notif') || "Dinner ka time ho gaya! 30 min mein aa jaata hai 🛵"
      await sendPushToRole('customer', {
        title: '🌙 Dinner Time — FoodFi',
        body,
        url: '/menu',
        tag: 'dinner-notif',
      })
      return NextResponse.json({ success: true, type, body })
    }

    if (type === 'friday') {
      const body = await getMsg('friday') || "🎉 Weekend aa gaya! Khana banane ka time nahi — order karne ka time hai!"
      await sendPushToRole('customer', {
        title: '🎉 Friday Special — FoodFi',
        body,
        url: '/menu',
        tag: 'friday-notif',
      })
      return NextResponse.json({ success: true, type, body })
    }

    if (type === 'miss_you') {
      // Find customers who haven't ordered in 3+ days and have push subscriptions
      const missedUsers = await sql`
        SELECT DISTINCT ps.user_id
        FROM push_subscriptions ps
        WHERE ps.role = 'customer'
          AND NOT EXISTS (
            SELECT 1 FROM orders o
            WHERE o.user_id::text = ps.user_id
              AND o.created_at >= NOW() - INTERVAL '3 days'
              AND o.status != 'cancelled'
          )
          AND EXISTS (
            SELECT 1 FROM orders o2
            WHERE o2.user_id::text = ps.user_id
          )
      `.catch(() => [])

      const body = await getMsg('miss_you') || "Kal se nahi aaye! Sab theek ho na? 🥺 Hum aapka wait kar rahe hain!"
      let sent = 0
      for (const { user_id } of missedUsers) {
        await sendPushToUser(user_id, {
          title: '🥺 Hum Miss Kar Rahe Hain — FoodFi',
          body,
          url: '/menu',
          tag: 'miss-you-notif',
        }, 'customer')
        sent++
      }
      return NextResponse.json({ success: true, type, sent })
    }

    return NextResponse.json({ error: 'Unknown type' }, { status: 400 })

  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

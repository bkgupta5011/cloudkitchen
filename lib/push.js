// Internal helper — send push from server-side (API routes)
import webpush from 'web-push'
import { getDb } from './db'

let vapidReady = false

function initVapid() {
  if (vapidReady) return
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL || 'mailto:admin@foodfi.in',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )
  vapidReady = true
}

// Save notification to DB so it shows in Notifications tab
async function saveNotification(sql, userId, role, { title, body, url, tag }) {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id TEXT NOT NULL, role TEXT NOT NULL,
        title TEXT NOT NULL, body TEXT, url TEXT DEFAULT '/', tag TEXT,
        is_read BOOLEAN DEFAULT FALSE, created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `.catch(() => {})
    await sql`
      INSERT INTO notifications (user_id, role, title, body, url, tag)
      VALUES (${String(userId)}, ${role}, ${title}, ${body || null}, ${url || '/'}, ${tag || null})
    `
  } catch {}
}

// Send to a specific user (by userId)
export async function sendPushToUser(userId, { title, body, url = '/', tag, requireInteraction = false, orderId, isDismiss, silent }, role = 'customer') {
  try {
    initVapid()
    const sql = getDb()

    // Save to notifications DB (always — even if no push subscription)
    // Don't save dismiss signals — they're transient
    if (!isDismiss) {
      await saveNotification(sql, userId, role, { title, body, url, tag })
    }

    if (!vapidReady) return
    const subs = await sql`SELECT * FROM push_subscriptions WHERE user_id = ${String(userId)}`
    if (!subs.length) return

    const payload = JSON.stringify({ title, body, url, tag, requireInteraction, orderId, isDismiss: isDismiss || false, silent: silent || false })

    // urgency:'high' → Android shows heads-up popup instead of silent bar notification
    // TTL: 300s — if device offline, push expires after 5 min (order might be taken by then)
    const pushOptions = { urgency: 'high', TTL: 300 }

    await Promise.all(subs.map(s =>
      webpush.sendNotification(s.subscription, payload, pushOptions).catch(async err => {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await sql`DELETE FROM push_subscriptions WHERE id = ${s.id}`.catch(() => {})
        }
      })
    ))
  } catch {}
}

// Send to all users with a given role (e.g. 'admin', 'delivery')
export async function sendPushToRole(role, { title, body, url = '/', tag, requireInteraction = false, orderId }) {
  try {
    initVapid()
    if (!vapidReady) return
    const sql = getDb()
    const subs = await sql`SELECT * FROM push_subscriptions WHERE role = ${role}`
    if (!subs.length) return
    const payload = JSON.stringify({ title, body, url, tag, requireInteraction, orderId })
    const pushOptions = { urgency: 'high', TTL: 300 }
    await Promise.all(subs.map(async s => {
      await saveNotification(sql, s.user_id, role, { title, body, url, tag })
      return webpush.sendNotification(s.subscription, payload, pushOptions).catch(async err => {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await sql`DELETE FROM push_subscriptions WHERE id = ${s.id}`.catch(() => {})
        }
      })
    }))
  } catch {}
}

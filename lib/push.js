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

// Send to a specific user (by userId)
export async function sendPushToUser(userId, { title, body, url = '/', tag, requireInteraction = false }) {
  try {
    initVapid()
    if (!vapidReady) return
    const sql = getDb()
    const subs = await sql`SELECT * FROM push_subscriptions WHERE user_id = ${String(userId)}`
    if (!subs.length) return
    const payload = JSON.stringify({ title, body, url, tag, requireInteraction })
    await Promise.all(subs.map(s =>
      webpush.sendNotification(s.subscription, payload).catch(async err => {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await sql`DELETE FROM push_subscriptions WHERE id = ${s.id}`.catch(() => {})
        }
      })
    ))
  } catch {}
}

// Send to all users with a given role (e.g. 'admin', 'delivery')
export async function sendPushToRole(role, { title, body, url = '/', tag, requireInteraction = false }) {
  try {
    initVapid()
    if (!vapidReady) return
    const sql = getDb()
    const subs = await sql`SELECT * FROM push_subscriptions WHERE role = ${role}`
    if (!subs.length) return
    const payload = JSON.stringify({ title, body, url, tag, requireInteraction })
    await Promise.all(subs.map(s =>
      webpush.sendNotification(s.subscription, payload).catch(async err => {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await sql`DELETE FROM push_subscriptions WHERE id = ${s.id}`.catch(() => {})
        }
      })
    ))
  } catch {}
}

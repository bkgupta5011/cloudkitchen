// ── FCM HTTP v1 sender ───────────────────────────────────────────────
// Sends push to the mobile app's FCM device tokens (works even when the app
// is minimised or closed — unlike web-push, which Android WebView ignores).
// Auth: a Firebase service account (FIREBASE_SERVICE_ACCOUNT env = full JSON),
// minted into a short-lived OAuth token with Node crypto (no extra deps).
import crypto from 'crypto'

let cachedToken = null
let cachedExp = 0

function getServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000)
  if (cachedToken && cachedExp > now + 60) return cachedToken

  const sa = getServiceAccount()
  if (!sa?.client_email || !sa?.private_key) return null

  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }))
  const unsigned = `${header}.${claims}`
  const key = sa.private_key.replace(/\\n/g, '\n')
  const signature = crypto.createSign('RSA-SHA256').update(unsigned).sign(key)
  const jwt = `${unsigned}.${b64url(signature)}`

  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
    })
    const data = await res.json()
    if (!data.access_token) return null
    cachedToken = data.access_token
    cachedExp = now + (data.expires_in || 3600)
    return cachedToken
  } catch { return null }
}

// Send a high-priority notification to many device tokens.
export async function sendFcmToTokens(tokens, { title, body, orderId, tag }) {
  const sa = getServiceAccount()
  const accessToken = await getAccessToken()
  const list = (tokens || []).filter(Boolean)
  if (!sa?.project_id || !accessToken || !list.length) return

  const url = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`
  await Promise.all(list.map(token =>
    fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          token,
          notification: { title, body },
          data: { orderId: String(orderId || ''), tag: String(tag || '') },
          android: {
            priority: 'HIGH',
            notification: {
              sound: 'default',
              channel_id: 'foodfi_default',
              notification_priority: 'PRIORITY_MAX',
              tag: String(tag || ''),
            },
          },
        },
      }),
    }).catch(() => {})
  ))
}

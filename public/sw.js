// FoodFi Service Worker — Push Notifications + PWA Cache
// v3 — broadcast dispatch: ring all boys, accept/reject from notification

const CACHE = 'foodfi-v3'
const OFFLINE_URL = '/'

// Install — cache essential pages
self.addEventListener('install', (e) => {
  self.skipWaiting()
  e.waitUntil(
    caches.open(CACHE).then(cache =>
      cache.addAll([OFFLINE_URL, '/menu', '/orders', '/icons/icon-192.png'])
    ).catch(() => {})
  )
})

// Activate — clean old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

// Fetch — network first, fallback to cache
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return
  if (e.request.url.includes('/api/')) return
  e.respondWith(
    fetch(e.request).catch(() =>
      caches.match(e.request).then(r => r || caches.match(OFFLINE_URL))
    )
  )
})

// ── Push handler ──────────────────────────────────────────────────────
self.addEventListener('push', (e) => {
  if (!e.data) return
  let payload
  try { payload = e.data.json() } catch { payload = { title: 'FoodFi', body: e.data.text(), url: '/' } }

  const isNewOrder = !!(payload.tag?.startsWith('new-order-') && !payload.isDismiss)

  // ── DISMISS: another boy accepted — close existing notification silently ──
  if (payload.isDismiss) {
    e.waitUntil(
      self.registration.getNotifications({ tag: payload.tag }).then(notifs => {
        notifs.forEach(n => n.close())
      }).then(() =>
        // Tell open delivery pages to stop alarm for this order
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list =>
          list.forEach(c => c.postMessage({ type: 'ORDER_TAKEN', orderId: payload.orderId }))
        )
      )
    )
    return
  }

  // ── NEW ORDER notification — big vibration + action buttons ──────────
  const options = {
    body:             payload.body || '',
    icon:             '/icons/icon-192.png',
    badge:            '/icons/icon-192.png',
    tag:              payload.tag || 'foodfi-notif',
    renotify:         true,   // Always re-alert even if same tag is already showing
    requireInteraction: isNewOrder ? true : (payload.requireInteraction || false),
    data:             { url: payload.url || '/', orderId: payload.orderId },

    // Long ringing vibration pattern for new orders (short beep for others)
    vibrate: isNewOrder
      ? [700, 200, 700, 200, 700, 200, 700, 200, 700, 200, 700, 200, 700]
      : [200, 100, 200, 100, 200],

    // Accept / Reject directly from notification (Android Chrome supports this)
    actions: isNewOrder ? [
      { action: 'accept', title: '✅ Accept Karo' },
      { action: 'reject', title: '❌ Reject' },
    ] : [],
  }

  e.waitUntil(
    Promise.all([
      self.registration.showNotification(payload.title || 'FoodFi', options),

      // Tell ALL open delivery pages to start alarm immediately (don't wait for poll)
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list =>
        list.forEach(c =>
          c.postMessage({
            type: isNewOrder ? 'NEW_ORDER_ALARM' : 'PLAY_NOTIFICATION_SOUND',
            payload,
          })
        )
      ),
    ])
  )
})

// ── Notification click / action button handler ────────────────────────
self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const { url, orderId } = e.notification.data || {}

  // ── Accept from notification bar ──
  if (e.action === 'accept' && orderId) {
    e.waitUntil(
      fetch('/api/delivery/respond', {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify({ orderId, action: 'accept' }),
        credentials: 'include',  // Sends auth cookie
      })
        .then(res => res.json())
        .then(data => {
          // Tell open pages the result
          return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
            list.forEach(c => c.postMessage({
              type:    'ORDER_RESPOND_RESULT',
              action:  'accept',
              success: data.success,
              reason:  data.reason,
              orderId,
              orderNumber: data.orderNumber,
            }))
            // Focus / open delivery page
            if (list.length > 0) {
              list[0].focus()
              return
            }
            return clients.openWindow('/delivery')
          })
        })
        .catch(() => clients.openWindow('/delivery'))
    )
    return
  }

  // ── Reject from notification bar ──
  if (e.action === 'reject' && orderId) {
    e.waitUntil(
      fetch('/api/delivery/respond', {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify({ orderId, action: 'reject' }),
        credentials: 'include',
      })
        .then(() =>
          self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list =>
            list.forEach(c => c.postMessage({ type: 'ORDER_TAKEN', orderId }))
          )
        )
        .catch(() => {})
    )
    return
  }

  // ── Default tap — open/focus delivery page ──
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.includes(self.location.origin) && 'focus' in c) {
          c.focus()
          return
        }
      }
      return clients.openWindow(url || '/delivery')
    })
  )
})

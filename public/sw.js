// FoodFi Service Worker — Push Notifications + PWA Cache
// v5 — auto-assign: single boy, simple notification, tap → /delivery

const CACHE = 'foodfi-v5'
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

  const isNewOrder = !!(payload.tag?.startsWith('delivery-') || payload.tag?.startsWith('new-order-'))

  const options = {
    body:               payload.body || '',
    icon:               '/icons/icon-192.png',
    badge:              '/icons/icon-192.png',
    tag:                payload.tag || 'foodfi-notif',
    renotify:           true,
    requireInteraction: payload.requireInteraction || false,
    data:               { url: payload.url || '/', orderId: payload.orderId },

    vibrate: isNewOrder
      ? [700, 200, 700, 200, 700, 200, 700, 200, 700, 200, 700, 200, 700]
      : [200, 100, 200, 100, 200],
  }

  e.waitUntil(
    Promise.all([
      self.registration.showNotification(payload.title || 'FoodFi', options),

      // Tell ALL open delivery pages to start alarm immediately
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

// ── Notification click — open/focus /delivery page ────────────────────
self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const { url } = e.notification.data || {}
  const targetUrl = (url && url.includes('/delivery')) ? url : '/delivery'

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      // First choice: an already-open delivery page
      const deliveryClient = list.find(c => c.url.includes('/delivery'))
      if (deliveryClient) {
        deliveryClient.focus()
        deliveryClient.postMessage({ type: 'NEW_ORDER_ALARM', payload: e.notification.data || {} })
        return
      }
      // Second choice: any origin window — navigate it to delivery
      const anyClient = list.find(c => c.url.includes(self.location.origin) && 'focus' in c)
      if (anyClient) {
        anyClient.focus()
        anyClient.postMessage({ type: 'NEW_ORDER_ALARM', payload: e.notification.data || {} })
        return
      }
      // No window open — open a new one
      return clients.openWindow(targetUrl)
    })
  )
})

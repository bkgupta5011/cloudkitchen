// FoodFi Service Worker — Push Notifications + PWA Cache

const CACHE = 'foodfi-v1'
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
  if (e.request.url.includes('/api/')) return // never cache API calls
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request).then(r => r || caches.match(OFFLINE_URL)))
  )
})

// Push — show notification
self.addEventListener('push', (e) => {
  if (!e.data) return
  let payload
  try { payload = e.data.json() } catch { payload = { title: 'FoodFi', body: e.data.text(), url: '/' } }

  const options = {
    body: payload.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: payload.tag || 'foodfi-notif',
    renotify: true,
    requireInteraction: payload.requireInteraction || false,
    data: { url: payload.url || '/' },
    actions: payload.actions || [],
    vibrate: [200, 100, 200],
  }

  e.waitUntil(self.registration.showNotification(payload.title || 'FoodFi', options))
})

// Notification click — open relevant page
self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const url = e.notification.data?.url || '/'
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      // If app already open, focus it and navigate
      for (const client of list) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus()
          client.navigate(url)
          return
        }
      }
      // Otherwise open new window
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})

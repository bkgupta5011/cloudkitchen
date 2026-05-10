'use client'
import { useEffect, useRef } from 'react'

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

// Auto-subscribe hook — call in any page component
// Pass `enabled` (true when user is logged in)
export function usePushNotifications(enabled = true) {
  const attempted = useRef(false)

  useEffect(() => {
    if (!enabled || attempted.current) return
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    if (!VAPID_PUBLIC) return

    attempted.current = true

    const subscribe = async () => {
      try {
        // Wait for SW to be ready
        const reg = await navigator.serviceWorker.ready

        // Check existing subscription
        const existing = await reg.pushManager.getSubscription()
        if (existing) {
          // Already subscribed — re-register with server (in case server lost it)
          await fetch('/api/push', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subscription: existing.toJSON() })
          })
          return
        }

        // Check permission — don't ask if denied
        if (Notification.permission === 'denied') return

        // Ask for permission
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') return

        // Create push subscription
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC)
        })

        // Save to server
        await fetch('/api/push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription: sub.toJSON() })
        })
      } catch (e) {
        // Silent fail — push is optional feature
      }
    }

    // Small delay so page renders first
    const timer = setTimeout(subscribe, 2000)
    return () => clearTimeout(timer)
  }, [enabled])
}

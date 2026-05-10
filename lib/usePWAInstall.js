'use client'
import { useState, useEffect } from 'react'

// Captures the beforeinstallprompt event so we can show a custom install button
export function usePWAInstall() {
  const [installPrompt, setInstallPrompt] = useState(null)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    // Already running as installed PWA
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
      return
    }
    // iOS Safari — no beforeinstallprompt, show manual instructions
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
    if (isIOS && !window.navigator.standalone) {
      setInstallPrompt('ios')
      return
    }
    const handler = (e) => {
      e.preventDefault()
      setInstallPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', () => { setIsInstalled(true); setInstallPrompt(null) })
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const install = async () => {
    if (!installPrompt || installPrompt === 'ios') return false
    installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    if (outcome === 'accepted') { setIsInstalled(true); setInstallPrompt(null) }
    return outcome === 'accepted'
  }

  return { installPrompt, isInstalled, install, isIOS: installPrompt === 'ios' }
}

/**
 * InstallBanner — shows a small dismissible banner prompting the user
 * to install the PWA. Only appears on mobile + before install.
 *
 * Detects:
 * - display-mode: 'standalone' (already installed → hide)
 * - iOS Safari: shows manual "Share → Add to Home Screen" instructions
 *   (iOS doesn't fire the beforeinstallprompt event)
 * - Android Chrome: shows an "Install" button that triggers the prompt
 */

import { useState, useEffect } from 'react'
import { X, Download, Share, Plus } from 'lucide-react'

const STORAGE_KEY = 'coc-install-banner-dismissed'

export default function InstallBanner() {
  const [show, setShow] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    // Already installed (running in standalone mode) → never show
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
      return
    }
    if (window.navigator.standalone === true) {
      // iOS Safari installed check
      setIsInstalled(true)
      return
    }

    // User already dismissed → don't show
    if (localStorage.getItem(STORAGE_KEY) === '1') return

    // Detect iOS (no beforeinstallprompt support)
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream
    setIsIOS(isIOSDevice)

    // Android/Chrome: capture the install prompt
    const handleBeforeInstall = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShow(true)
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstall)

    // iOS users: show manual instructions
    if (isIOSDevice) {
      setShow(true)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
    }
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setShow(false)
    }
    setDeferredPrompt(null)
  }

  const handleDismiss = () => {
    setShow(false)
    localStorage.setItem(STORAGE_KEY, '1')
  }

  if (!show || isInstalled) return null

  return (
    <div className="fixed bottom-20 md:bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-sm w-[calc(100%-2rem)] animate-slide-up">
      <div className="card border-clan-accent/40 !p-3 shadow-2xl shadow-clan-accent/20 flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-clan-accent to-clan-gold-dark flex items-center justify-center text-clan-darker shrink-0">
          {isIOS ? <Share className="w-5 h-5" /> : <Download className="w-5 h-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">Install Clan Hub</p>
          {isIOS ? (
            <p className="text-xs text-clan-muted mt-0.5">
              Tap <Share className="w-3 h-3 inline" /> then "Add to Home Screen"
              <Plus className="w-3 h-3 inline ml-1" />
            </p>
          ) : (
            <p className="text-xs text-clan-muted mt-0.5">
              Add to your home screen for the full app experience
            </p>
          )}
          {!isIOS && deferredPrompt && (
            <button onClick={handleInstall} className="btn-primary text-xs !px-3 !py-1 mt-2">
              <Download className="w-3 h-3" /> Install
            </button>
          )}
        </div>
        <button onClick={handleDismiss} className="btn-ghost !p-1 shrink-0" aria-label="Dismiss">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

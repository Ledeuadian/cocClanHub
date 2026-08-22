/**
 * usePushNotifications — React hook for managing push notification state.
 *
 * Exposes:
 *   supported     — boolean: can this browser/device do push?
 *   permission    — 'default' | 'granted' | 'denied' | 'unsupported'
 *   enabled       — boolean: is this device currently subscribed?
 *   enable()      — request permission + subscribe + register backend
 *   disable()     — unregister from backend + unsubscribe
 *   loading       — true while an async operation is in flight
 */

import { useState, useEffect, useCallback } from 'react'
import {
  isPushSupported,
  getPermissionState,
  requestPermission,
  enablePushNotifications,
  disablePushNotifications,
  isCurrentlySubscribed
} from '../services/pushService.js'

export function usePushNotifications() {
  const [supported, setSupported] = useState(false)
  const [permission, setPermission] = useState('default')
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(false)

  // Initial state check
  useEffect(() => {
    const supp = isPushSupported()
    setSupported(supp)
    if (!supp) {
      // Might still work via Capacitor — check if Notification exists
      setPermission('unsupported')
      return
    }
    getPermissionState().then(setPermission)
    isCurrentlySubscribed().then(setEnabled)
  }, [])

  const enable = useCallback(async () => {
    setLoading(true)
    try {
      const result = await enablePushNotifications()
      if (result.ok) {
        setEnabled(true)
        setPermission('granted')
      }
      return result
    } finally {
      setLoading(false)
    }
  }, [])

  const disable = useCallback(async () => {
    setLoading(true)
    try {
      await disablePushNotifications()
      setEnabled(false)
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    supported,
    permission,
    enabled,
    enable,
    disable,
    loading
  }
}

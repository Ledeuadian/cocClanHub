/**
 * Push notification client service.
 *
 * Handles:
 *   • Web Push API (browser/PWA installs) — subscribes via service worker,
 *     registers with the backend.
 *   • Capacitor Push Notifications (Android/iOS) — via @capacitor/push-notifications
 *     if installed (optional; falls back to web push on browser).
 *
 * Flow:
 *   1. User grants notification permission (Settings page).
 *   2. We subscribe via PushManager.subscribe() with the backend's VAPID key.
 *   3. We POST the subscription to /api/push/subscribe.
 *   4. The backend stores it. When the user is offline (no socket) and a
 *      message arrives, the backend sends a push through the push service.
 *   5. The service worker (sw-push-handler.js) receives the push and shows
 *      a system Notification. Clicking it deep-links into /chat.
 *
 * On Android via Capacitor with @capacitor/push-notifications installed,
 * the same flow uses FCM tokens instead of web push subscriptions.
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase.js'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

// ── Permission helpers ───────────────────────────────────────

export function isPushSupported() {
  return typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window
}

export async function getPermissionState() {
  if (!('Notification' in window)) return 'unsupported'
  return Notification.permission  // 'default' | 'granted' | 'denied'
}

/**
 * Request notification permission from the user.
 * Returns 'granted' | 'denied' | 'default' | 'unsupported'.
 */
export async function requestPermission() {
  if (!('Notification' in window)) return 'unsupported'
  const result = await Notification.requestPermission()
  return result
}

// ── VAPID key ────────────────────────────────────────────────

let cachedVapidKey = null

export async function getVapidPublicKey() {
  if (cachedVapidKey) return cachedVapidKey
  try {
    const res = await fetch(`${API_BASE}/push/vapid`)
    if (!res.ok) return null
    const data = await res.json()
    if (data?.ok && data.publicKey) {
      cachedVapidKey = data.publicKey
      return data.publicKey
    }
  } catch (e) {
    console.warn('[push] failed to fetch VAPID key', e?.message)
  }
  return null
}

/**
 * Convert a base64 public key to Uint8Array (required by PushManager).
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const output = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    output[i] = rawData.charCodeAt(i)
  }
  return output
}

// ── Subscribe (web push) ─────────────────────────────────────

/**
 * Subscribe the current browser to web push notifications.
 * Returns the PushSubscription or null if unsupported/denied.
 */
async function subscribeWebPush(vapidKey) {
  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()

  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey)
    })
  }
  return sub
}

/**
 * Register the subscription with the backend.
 */
async function registerWithBackend(subscription) {
  const { data } = await supabase.auth.getSession()
  const token = data?.session?.access_token
  if (!token) {
    console.warn('[push] no auth token — subscription will not be registered')
    return false
  }

  const res = await fetch(`${API_BASE}/push/subscribe`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      endpoint: subscription.endpoint,
      keys: subscription.toJSON().keys,
      platform: 'web'
    })
  })
  return res.ok
}

// ── Capacitor (Android/iOS via FCM) ──────────────────────────
//
// Lazy-loaded so the browser build doesn't crash if the plugin isn't
// installed. On Android, @capacitor/push-notifications handles FCM
// registration automatically once google-services.json is configured.
//
// We use a variable specifier so Vite's static analysis can't resolve
// the import at build time — only at runtime inside try/catch.
async function loadCapacitorPushNotifications() {
  // Variable indirection — prevents Vite from statically resolving
  // (and failing on) '@capacitor/push-notifications' when it isn't
  // installed in the browser-only build.
  const specifier = '@capacitor/push-notifications'
  const mod = await import(/* @vite-ignore */ specifier)
  return mod.PushNotifications
}

async function subscribeCapacitor() {
  let PushNotifications
  try {
    PushNotifications = await loadCapacitorPushNotifications()
  } catch {
    return null // plugin not installed — fall back to web push
  }

  let perm = await PushNotifications.checkPermissions()
  if (perm.receive === 'prompt') {
    perm = await PushNotifications.requestPermissions()
  }
  if (perm.receive !== 'granted') return null

  await PushNotifications.register()

  // Wait for the registration token (FCM) to arrive
  return new Promise((resolve) => {
    let resolved = false
    PushNotifications.addListener('registration', async ({ value: token }) => {
      if (resolved) return
      resolved = true

      const { data } = await supabase.auth.getSession()
      const authToken = data?.session?.access_token
      if (!authToken) return resolve(null)

      await fetch(`${API_BASE}/push/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          endpoint: token,
          platform: 'fcm'
        })
      })
      resolve(token)
    })

    PushNotifications.addListener('registrationError', (err) => {
      console.error('[push] Capacitor registration error', err)
      if (!resolved) { resolved = true; resolve(null) }
    })

    // Timeout fallback
    setTimeout(() => { if (!resolved) { resolved = true; resolve(null) } }, 10000)
  })
}

// ── Main entry point ─────────────────────────────────────────

/**
 * Enable push notifications for the current user.
 * Detects platform automatically (web push vs Capacitor FCM).
 *
 * Returns { ok: boolean, platform: string, error?: string }.
 */
export async function enablePushNotifications() {
  if (!isPushSupported()) {
    // Try Capacitor (Android/iOS native)
    const cap = await subscribeCapacitor()
    if (cap) return { ok: true, platform: 'fcm' }
    return { ok: false, error: 'push-notifications-not-supported' }
  }

  // 1. Request permission
  const permission = await requestPermission()
  if (permission !== 'granted') {
    return { ok: false, error: permission || 'denied' }
  }

  // 2. Fetch the VAPID public key
  const vapidKey = await getVapidPublicKey()
  if (!vapidKey) {
    // VAPID not configured on the backend — try Capacitor
    const cap = await subscribeCapacitor()
    if (cap) return { ok: true, platform: 'fcm' }
    return { ok: false, error: 'vapid-not-configured' }
  }

  // 3. Subscribe via the service worker
  let sub
  try {
    sub = await subscribeWebPush(vapidKey)
  } catch (e) {
    console.error('[push] subscribe failed', e)
    return { ok: false, error: e.message }
  }
  if (!sub) return { ok: false, error: 'subscription-failed' }

  // 4. Register with the backend
  const registered = await registerWithBackend(sub)
  if (!registered) return { ok: false, error: 'backend-registration-failed' }

  return { ok: true, platform: 'web', endpoint: sub.endpoint }
}

/**
 * Disable push notifications for the current device.
 */
export async function disablePushNotifications() {
  if (isPushSupported()) {
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        const { data } = await supabase.auth.getSession()
        const token = data?.session?.access_token
        if (token) {
          await fetch(`${API_BASE}/push/unsubscribe`, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ endpoint: sub.endpoint })
          })
        }
        await sub.unsubscribe()
      }
    } catch (e) {
      console.warn('[push] disable failed', e?.message)
    }
  }
  return { ok: true }
}

/**
 * Check whether the current browser is already subscribed.
 */
export async function isCurrentlySubscribed() {
  if (!isPushSupported()) return false
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    return !!sub
  } catch {
    return false
  }
}

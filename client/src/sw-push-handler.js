/**
 * Custom service worker for COC Clan Hub.
 *
 * Used by vite-plugin-pwa's injectManifest strategy. This file is
 * bundled (not generated) so we can add custom event listeners that
 * Workbox's generateSW can't do — specifically push notifications.
 *
 * Responsibilities:
 *   • Precache + runtime caching (delegated to Workbox via the
 *     `workbox-*` imports injected by vite-plugin-pwa at build time).
 *   • `push` event handler → show a system Notification.
 *   • `notificationclick` → focus the app / deep-link to the chat.
 */

// ── Precaching ───────────────────────────────────────────────
// vite-plugin-pwa injects `self.__WB_MANIFEST` (a list of precache
// entries) at build time. The injectManifest strategy requires
// EXACTLY ONE occurrence of this token in the file, so we reference
// the variable once and pass it to Workbox.
//
// At runtime in dev mode, __WB_MANIFEST is an empty array — the
// importScripts + precache call is a safe no-op.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

try {
  importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js')

  // eslint-disable-next-line no-undef
  if (workbox) {
    // eslint-disable-next-line no-undef
    workbox.precaching.precacheAndRoute(self.__WB_MANIFEST || [])
    // eslint-disable-next-line no-undef
    workbox.clientsClaim()
  }
} catch (e) {
  console.warn('[sw] Workbox failed to load', e)
}

// ── Push event handler ───────────────────────────────────────

self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = { title: 'Clan Hub', body: event.data ? event.data.text() : '' }
  }

  const title = payload.title || 'New message'
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/icons/android-chrome-192x192.png',
    badge: '/icons/favicon-32x32.png',
    tag: payload.tag || 'clanhub-message',
    data: payload.data || {},
    requireInteraction: false,
    // vibrate on Android
    vibrate: [100, 50, 100]
  }

  event.waitUntil(
    self.registration.showNotification(title, options)
  )
})

// ── Notification click ───────────────────────────────────────

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const targetUrl = event.notification.data?.url || '/'

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true
      })

      // If a client is already open, focus it and navigate to the chat
      for (const client of allClients) {
        if ('focus' in client) {
          client.postMessage({
            type: 'notification-click',
            url: targetUrl
          })
          return client.focus()
        }
      }

      // No open client — open a new one
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl)
      }
    })()
  )
})

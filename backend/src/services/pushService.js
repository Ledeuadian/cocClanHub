/**
 * Push notification delivery service.
 *
 * Sends notifications to users who are NOT currently connected via
 * Socket.IO. Call this when an offline message is detected.
 *
 * Supports two platforms:
 *   • 'web'   → Web Push (web-push library + VAPID keys)
 *   • 'fcm'   → Firebase Cloud Messaging (android + iOS via Capacitor)
 *
 * Generating VAPID keys (one-time, on the server host):
 *   npx web-push generate-vapid-keys
 *
 * Required env vars:
 *   VAPID_PUBLIC_KEY
 *   VAPID_PRIVATE_KEY
 *   VAPID_SUBJECT      (e.g. "mailto:admin@yourdomain.com")
 *   FCM_SERVER_KEY     (Firebase Cloud Messaging legacy server key —
 *                       optional; only needed if FCM is enabled)
 *
 * Required Supabase table: push_subscriptions (see migration 007).
 */

import webpush from 'web-push'
import { getSupabaseAdmin } from '../config/supabase.js'
import { config } from '../config/index.js'

// ── Configuration ────────────────────────────────────────────

let configured = false

function configure() {
  if (configured) return true
  if (!config.vapidPublicKey || !config.vapidPrivateKey || !config.vapidSubject) {
    return false
  }
  webpush.setVapidDetails(
    config.vapidSubject,
    config.vapidPublicKey,
    config.vapidPrivateKey
  )
  configured = true
  return true
}

/**
 * Returns the VAPID public key for the client to use when subscribing.
 * The private key NEVER leaves the server.
 */
export function getVapidPublicKey() {
  return config.vapidPublicKey || null
}

// ── Subscription CRUD ────────────────────────────────────────

/**
 * Save (or refresh) a push subscription row.
 * Idempotent — upserts on (user_id, endpoint).
 */
export async function saveSubscription({
  userId,
  cocTag,
  platform,
  endpoint,
  p256dhKey,
  authKey,
  userAgent
}) {
  const supabase = getSupabaseAdmin()
  if (!supabase) return { ok: false, error: 'supabase not configured' }
  if (!endpoint) return { ok: false, error: 'endpoint required' }

  const row = {
    user_id: userId || null,
    coc_tag: cocTag || null,
    platform: platform || 'web',
    endpoint,
    p256dh_key: p256dhKey || null,
    auth_key: authKey || null,
    user_agent: userAgent || null,
    updated_at: new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('push_subscriptions')
    .upsert(row, { onConflict: 'endpoint' })
    .select()
    .single()

  if (error) {
    console.error('[push] saveSubscription error', error)
    return { ok: false, error: error.message }
  }
  return { ok: true, subscription: data }
}

/**
 * Delete a subscription (called when the user revokes permission or
 * the subscription expires).
 */
export async function deleteSubscription({ userId, endpoint }) {
  const supabase = getSupabaseAdmin()
  if (!supabase) return { ok: false }
  let query = supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
  if (userId) query = query.eq('user_id', userId)
  const { error } = await query
  if (error) {
    console.error('[push] deleteSubscription error', error)
    return { ok: false, error: error.message }
  }
  return { ok: true }
}

/**
 * Auto-prune a dead subscription (called when web-push returns 404/410).
 */
async function pruneSubscription(endpoint) {
  const supabase = getSupabaseAdmin()
  if (!supabase) return
  await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
}

// ── Lookup ───────────────────────────────────────────────────

/**
 * Fetch all subscriptions matching a Supabase user id OR a COC tag.
 * Used by the Socket.IO layer when an offline recipient needs a push.
 */
export async function getSubscriptionsForUser({ userId, cocTag }) {
  const supabase = getSupabaseAdmin()
  if (!supabase) return []
  let q = supabase.from('push_subscriptions').select('*')
  if (userId && cocTag) {
    q = q.or(`user_id.eq.${userId},coc_tag.eq.${(cocTag || '').replace(/^#/, '').toUpperCase()}`)
  } else if (userId) {
    q = q.eq('user_id', userId)
  } else if (cocTag) {
    q = q.eq('coc_tag', (cocTag || '').replace(/^#/, '').toUpperCase())
  } else {
    return []
  }
  const { data, error } = await q
  if (error) {
    console.warn('[push] getSubscriptionsForUser error', error)
    return []
  }
  return data || []
}

// ── Sending ──────────────────────────────────────────────────

/**
 * Send a Web Push notification to a single subscription row.
 * Returns true on success; auto-prunes expired (404/410) subscriptions.
 */
async function sendWebPush(sub, payload) {
  if (!configure()) {
    console.warn('[push] VAPID not configured — skipping web push')
    return false
  }
  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh_key,
          auth: sub.auth_key
        }
      },
      JSON.stringify(payload),
      { TTL: 60 * 60 }  // 1 hour — push services re-deliver for up to 1h if device is offline
    )
    return true
  } catch (e) {
    const status = e?.statusCode || 0
    if (status === 404 || status === 410) {
      // Subscription expired or revoked — drop it.
      console.log('[push] pruning dead subscription', sub.endpoint.slice(0, 60))
      await pruneSubscription(sub.endpoint)
      return false
    }
    console.error('[push] sendWebPush error', status, e?.message)
    return false
  }
}

/**
 * Send via FCM (Android/iOS). Implemented as a plain HTTP POST to the
 * FCM Legacy API for simplicity. For production scale, switch to
 * `firebase-admin` SDK which handles batching, retries, etc.
 */
async function sendFcm(sub, payload) {
  const serverKey = config.fcmServerKey
  if (!serverKey) {
    console.warn('[push] FCM_SERVER_KEY not configured — skipping fcm push')
    return false
  }
  try {
    const res = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `key=${serverKey}`
      },
      body: JSON.stringify({
        to: sub.endpoint,
        notification: {
          title: payload.title,
          body: payload.body,
          icon: payload.icon,
          tag: payload.tag,
          click_action: payload.data?.url
        },
        data: payload.data || {}
      })
    })
    if (!res.ok) {
      const err = await res.text().catch(() => '')
      // 404 = unregistered token; prune it.
      if (res.status === 404) {
        await pruneSubscription(sub.endpoint)
      }
      console.warn('[push] FCM error', res.status, err.slice(0, 200))
      return false
    }
    return true
  } catch (e) {
    console.error('[push] sendFcm error', e.message)
    return false
  }
}

/**
 * Send a push to every subscription belonging to the user.
 * Sends concurrently and resolves with `{ sent, total }`.
 *
 * @param {{userId?: string, cocTag?: string}} target
 * @param {object} payload — { title, body, icon?, tag?, data? }
 */
export async function sendPushToUser(target, payload) {
  const subs = await getSubscriptionsForUser(target)
  if (subs.length === 0) return { sent: 0, total: 0 }

  const results = await Promise.all(
    subs.map((sub) => {
      if (sub.platform === 'fcm') return sendFcm(sub, payload)
      return sendWebPush(sub, payload)
    })
  )

  const sent = results.filter(Boolean).length
  return { sent, total: subs.length }
}

/**
 * Format a chat-message push payload. Used by the Socket.IO layer.
 */
export function buildChatPushPayload({ kind, senderName, text, channelName, senderTag, recipientTag, url }) {
  const title = kind === 'dm' ? senderName : `#${channelName || 'channel'}`
  const body = kind === 'dm'
    ? text
    : `${senderName}: ${text}`
  return {
    title,
    body: (body || '').slice(0, 200),
    icon: '/icons/android-chrome-192x192.png',
    tag: kind === 'dm'
      ? `dm-${[senderTag, recipientTag].sort().join('-')}`
      : `channel-${channelName}`,
    data: {
      url: url || (kind === 'dm' ? `/chat?dm=${senderTag}` : '/chat'),
      kind,
      senderTag,
      channelName
    }
  }
}
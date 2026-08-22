/**
 * Push notification subscription endpoints.
 *
 *   POST   /api/push/subscribe   → register a new push subscription
 *   DELETE /api/push/unsubscribe → remove a push subscription by endpoint
 *   GET    /api/push/vapid       → get the public VAPID key for the client
 *
 * All routes expect a Supabase access token in the Authorization header
 * (or the X-Supabase-Token custom header) so we can attribute the
 * subscription to the right user.
 */

import { Router } from 'express'
import { getSupabaseAdmin } from '../config/supabase.js'
import {
  saveSubscription,
  deleteSubscription,
  getVapidPublicKey
} from '../services/pushService.js'
import { asyncHandler } from '../middleware/errorMiddleware.js'

const router = Router()

const normalizeTag = (tag) => (tag || '').replace(/^#/, '').toUpperCase()

/**
 * Extract + verify the Supabase JWT from the request and resolve the
 * user id and (if available) COC player tag from their profile row.
 * Returns null if the token is missing/invalid.
 */
async function resolveUser(req) {
  const supabase = getSupabaseAdmin()
  if (!supabase) return null

  const token =
    (req.headers.authorization || '').replace(/^Bearer\s+/i, '') ||
    req.headers['x-supabase-token']

  if (!token) return null

  try {
    const { data, error } = await supabase.auth.getUser(token)
    if (error || !data?.user) return null

    const user = data.user
    let cocTag = null
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('coc_player_tag')
        .eq('id', user.id)
        .maybeSingle()
      cocTag = profile?.coc_player_tag ? normalizeTag(profile.coc_player_tag) : null
    } catch { /* profile row may not exist yet */ }

    return { userId: user.id, cocTag }
  } catch {
    return null
  }
}

// ── GET /api/push/vapid ──────────────────────────────────────
// Returns the public VAPID key (safe to expose to the client).
router.get('/vapid', (_req, res) => {
  const key = getVapidPublicKey()
  if (!key) return res.status(503).json({ ok: false, error: 'VAPID not configured' })
  res.json({ ok: true, publicKey: key })
})

// ── POST /api/push/subscribe ─────────────────────────────────
// Body: { endpoint, keys?: { p256dh, auth }, platform?: 'web'|'fcm' }
router.post('/subscribe', asyncHandler(async (req, res, next) => {
  const authed = await resolveUser(req)
  if (!authed) return res.status(401).json({ ok: false, error: 'unauthorized' })

  const { endpoint, keys, platform } = req.body || {}
  if (!endpoint) return res.status(400).json({ ok: false, error: 'endpoint required' })

  const result = await saveSubscription({
    userId: authed.userId,
    cocTag: authed.cocTag,
    platform: platform || 'web',
    endpoint,
    p256dhKey: keys?.p256dh,
    authKey: keys?.auth,
    userAgent: req.headers['user-agent'] || null
  })

  if (!result.ok) return next(new Error(result.error || 'subscribe failed'))
  res.json(result)
}))

// ── DELETE /api/push/unsubscribe ─────────────────────────────
// Body: { endpoint }
router.delete('/unsubscribe', asyncHandler(async (req, res, next) => {
  const authed = await resolveUser(req)
  if (!authed) return res.status(401).json({ ok: false, error: 'unauthorized' })

  const { endpoint } = req.body || {}
  if (!endpoint) return res.status(400).json({ ok: false, error: 'endpoint required' })

  const result = await deleteSubscription({ userId: authed.userId, endpoint })
  if (!result.ok) return next(new Error(result.error || 'unsubscribe failed'))
  res.json(result)
}))

export default router

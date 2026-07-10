/**
 * Admin Routes — protected by database-level authorization.
 *
 * No shared secret. Instead:
 * 1. The frontend sends the user's Supabase access token (Bearer header)
 * 2. We verify it with Supabase to get the user id
 * 3. We look up the user's profile and check is_admin = true
 *
 * To make yourself an admin, run in Supabase SQL Editor:
 *   UPDATE profiles SET is_admin = TRUE WHERE email = 'your@email.com';
 */

import { Router } from 'express'
import { getSupabaseAdmin } from '../config/supabase.js'
import { cocService } from '../services/cocService.js'
import { asyncHandler } from '../middleware/errorMiddleware.js'

const router = Router()

/**
 * Middleware: extract the Bearer token from the Authorization header,
 * verify it with Supabase, and attach the authenticated user to req.
 * Also loads the profile row so we can check is_admin.
 */
async function requireAdmin(req, res, next) {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Missing authorization token' })
    }

    const token = authHeader.split(' ')[1]
    const supabase = getSupabaseAdmin()
    if (!supabase) {
      return res.status(503).json({ message: 'Supabase not configured' })
    }

    // Verify the token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) {
      return res.status(401).json({ message: 'Invalid or expired token' })
    }

    // Load the profile to check is_admin
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('id, is_admin, display_name, email')
      .eq('id', user.id)
      .single()

    if (profileErr || !profile) {
      return res.status(403).json({ message: 'Profile not found' })
    }

    if (!profile.is_admin) {
      return res.status(403).json({ message: 'Admin privileges required' })
    }

    req.admin = profile
    next()
  } catch (err) {
    res.status(500).json({ message: 'Auth check failed', error: err.message })
  }
}

// ── List users pending approval ──────────────────────────────
router.get('/pending-users', requireAdmin, asyncHandler(async (_req, res) => {
  const supabase = getSupabaseAdmin()
  if (!supabase) return res.json([])

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('approval_status', 'pending')
    .order('approval_requested_at', { ascending: true })

  if (error) throw error

  // For each pending user, enrich with live COC data from Supercell API
  const enriched = await Promise.all(
    (data || []).map(async (profile) => {
      if (!profile.coc_player_tag) {
        return { ...profile, coc_full: null, coc_error: 'No COC tag linked' }
      }
      try {
        const player = await cocService.getPlayer(profile.coc_player_tag)
        let leagueHistory = null
        try {
          leagueHistory = await cocService.getPlayerLeagueHistory(profile.coc_player_tag)
        } catch (e) {
          // League history might 404 if not in any league — non-fatal
        }
        return { ...profile, coc_full: player, coc_league_history: leagueHistory }
      } catch (e) {
        return { ...profile, coc_full: null, coc_error: e.message }
      }
    })
  )

  res.json(enriched)
}))

// ── Get a single pending user with full COC profile (mirrors in-game) ─
router.get('/users/:id/coc-profile', requireAdmin, asyncHandler(async (req, res) => {
  const supabase = getSupabaseAdmin()
  if (!supabase) return res.status(503).json({ message: 'Supabase not configured' })

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', req.params.id)
    .single()
  if (error) throw error

  if (!profile.coc_player_tag) {
    return res.json({ profile, coc: null, error: 'User has no COC tag linked' })
  }

  try {
    const player = await cocService.getPlayer(profile.coc_player_tag)
    let leagueHistory = null
    try {
      leagueHistory = await cocService.getPlayerLeagueHistory(profile.coc_player_tag)
    } catch (e) { /* non-fatal */ }
    res.json({ profile, coc: player, leagueHistory })
  } catch (e) {
    res.status(502).json({ profile, error: `COC API error: ${e.message}` })
  }
}))

// ── Approve a user ──────────────────────────────────────────
router.post('/users/:id/approve', requireAdmin, asyncHandler(async (req, res) => {
  const supabase = getSupabaseAdmin()
  if (!supabase) return res.status(503).json({ message: 'Supabase not configured' })

  const { data, error } = await supabase
    .from('profiles')
    .update({
      approval_status: 'approved',
      approval_reviewed_at: new Date().toISOString(),
      approval_reviewed_by: req.admin.id,
      approval_note: req.body?.note || null
    })
    .eq('id', req.params.id)
    .select()
    .single()

  if (error) throw error
  res.json(data)
}))

// ── Reject a user ────────────────────────────────────────────
router.post('/users/:id/reject', requireAdmin, asyncHandler(async (req, res) => {
  const supabase = getSupabaseAdmin()
  if (!supabase) return res.status(503).json({ message: 'Supabase not configured' })

  const { data, error } = await supabase
    .from('profiles')
    .update({
      approval_status: 'rejected',
      approval_reviewed_at: new Date().toISOString(),
      approval_reviewed_by: req.admin.id,
      approval_note: req.body?.note || 'Rejected by admin'
    })
    .eq('id', req.params.id)
    .select()
    .single()

  if (error) throw error
  res.json(data)
}))

// ── Pending count (for the bell badge) ──────────────────────
router.get('/pending-count', requireAdmin, asyncHandler(async (_req, res) => {
  const supabase = getSupabaseAdmin()
  if (!supabase) return res.json({ count: 0 })

  const { count, error } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('approval_status', 'pending')

  if (error) throw error
  res.json({ count: count || 0 })
}))

// ── Check if current user is an admin (used by frontend) ──────
router.get('/check', requireAdmin, asyncHandler(async (req, res) => {
  res.json({
    is_admin: true,
    admin: {
      id: req.admin.id,
      email: req.admin.email,
      display_name: req.admin.display_name
    }
  })
}))

export default router

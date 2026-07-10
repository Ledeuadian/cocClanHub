import { Router } from 'express'
import { getSupabaseAdmin } from '../config/supabase.js'
import { config } from '../config/index.js'
import { asyncHandler, errorMiddleware } from '../middleware/errorMiddleware.js'

const router = Router()

/**
 * These routes are examples for how the backend can interact with Supabase.
 * They use the service role key (server-side only, bypasses RLS).
 * Once Supabase is configured and tables are created, these will work.
 */

// ── Health check ─────────────────────────────────────────────
router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    supabase: config.isSupabaseConfigured() ? 'connected' : 'not configured',
    coc: config.isCocConfigured() ? 'configured' : 'not configured'
  })
})

// ── Example: Get all profiles ────────────────────────────────
router.get('/profiles', asyncHandler(async (_req, res, next) => {
  const supabase = getSupabaseAdmin()
  if (!supabase) return next(new Error('Supabase not configured'))

  const { data, error } = await supabase.from('profiles').select('*')
  if (error) return next(error)
  res.json(data)
}))

// ── Example: Update profile ──────────────────────────────────
router.patch('/profiles/:id', asyncHandler(async (req, res, next) => {
  const supabase = getSupabaseAdmin()
  if (!supabase) return next(new Error('Supabase not configured'))

  const { data, error } = await supabase
    .from('profiles')
    .update(req.body)
    .eq('id', req.params.id)
    .select()
    .single()

  if (error) return next(error)
  res.json(data)
}))

router.use(errorMiddleware)

export default router
/**
 * Express middleware for verifying a Supabase JWT from the frontend.
 *
 * Frontend sets: Authorization: Bearer <access_token>
 * This middleware verifies with Supabase and attaches user to req.user.
 */
import { getSupabaseAdmin } from '../config/supabase.js'

export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Missing authorization header' })
    }

    const token = authHeader.split(' ')[1]
    const supabase = getSupabaseAdmin()

    if (!supabase) {
      // Fallback for dev mode when Supabase isn't configured
      req.user = { id: 'dev-user', email: 'dev@local' }
      return next()
    }

    const { data, error } = await supabase.auth.getUser(token)

    if (error || !data?.user) {
      return res.status(401).json({ message: 'Invalid token' })
    }

    req.user = data.user
    next()
  } catch (err) {
    res.status(500).json({ message: 'Auth check failed', error: err.message })
  }
}

export function optionalAuth(req, _res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) return next()
  return requireAuth(req, _res, next)
}
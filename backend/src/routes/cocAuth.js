/**
 * COC Tag-based authentication routes.
 *
 * Lets players sign up & sign in using their Clash of Clans player tag
 * and a password — no email required. The COC API token supplied at
 * signup is verified against Supercell's official verifytoken endpoint
 * (cocService.verifyPlayerToken), which cryptographically proves the
 * person owns that in-game account.
 *
 * Internally we map each tag to a synthetic, unguessable email of the
 * form  coc-<TAG>@cocclanhub.internal  stored in auth.users. The user
 * never sees or uses this email — they only ever interact with their
 * tag. Because we pass email_confirm: true, no verification email is
 * sent.
 *
 * Endpoints:
 *   POST /api/coc-auth/signup  { tag, password, api_token, display_name? }
 *     → verifies the COC token → creates the Supabase auth user →
 *       links the profile row → returns { session, profile }
 *   POST /api/coc-auth/signin  { tag, password }
 *     → resolves tag → internal email → returns { session, profile }
 */

import { Router } from 'express'
import { getSupabaseAdmin } from '../config/supabase.js'
import { cocService } from '../services/cocService.js'
import { config } from '../config/index.js'
import { asyncHandler } from '../middleware/errorMiddleware.js'
import { authLimiter } from '../middleware/rateLimit.js'

const router = Router()

// Apply the strict auth rate limiter to every endpoint in this router.
router.use(authLimiter)

const INTERNAL_DOMAIN = 'cocclanhub.internal'

/**
 * Normalize a player tag: strip '#', uppercase.
 */
const normalizeTag = (tag) => (tag || '').replace(/^#/, '').toUpperCase()

/**
 * Build the synthetic internal email for a tag. NOT user-facing.
 */
const tagToInternalEmail = (tag) => `coc-${normalizeTag(tag)}@${INTERNAL_DOMAIN}`

/**
 * Build a tag validation regex — alphanumeric, 4-12 chars (matches the
 * real COC tag format used in-game).
 */
const isValidTag = (tag) => /^[A-Z0-9]{4,12}$/i.test(normalizeTag(tag))

/**
 * Validate the password meets minimum requirements.
 */
const isValidPassword = (pw) => typeof pw === 'string' && pw.length >= 6 && pw.length <= 128

// ── Helpers ──────────────────────────────────────────────────

/**
 * Resolve a Supabase auth user by their COC tag. Returns the user row
 * (id, email, etc.) or null if no user is linked to that tag.
 *
 * Looks the user up via the profiles.coc_player_tag column rather than
 * guessing the email — this is the canonical source of truth.
 */
async function findAuthUserByTag(supabase, tag) {
  const normalized = normalizeTag(tag)
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email')
    .eq('coc_player_tag', normalized)
    .maybeSingle()

  if (error || !data) return null

  // Now fetch the actual auth user — we need the real email to use
  // signInWithPassword from the server side.
  const { data: userData, error: userErr } = await supabase.auth.admin.getUserById(data.id)
  if (userErr || !userData?.user) return null
  return userData.user
}

/**
 * Fetch the public profile for a user id (used after signup/signin to
 * return profile data to the client).
 */
async function fetchProfile(supabase, userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  if (error) return null
  return data
}

// ── POST /api/coc-auth/signup ────────────────────────────────

router.post('/signup', asyncHandler(async (req, res) => {
  const { tag, password, api_token, display_name } = req.body || {}

  if (!isValidTag(tag)) {
    return res.status(400).json({ message: 'Invalid COC player tag format' })
  }
  if (!isValidPassword(password)) {
    return res.status(400).json({ message: 'Password must be 6–128 characters' })
  }
  if (!api_token || typeof api_token !== 'string') {
    return res.status(400).json({ message: 'COC API token is required for signup' })
  }

  const supabase = getSupabaseAdmin()
  if (!supabase) {
    return res.status(503).json({ message: 'Auth service not configured' })
  }

  const normalized = normalizeTag(tag)

  // 1. Reject if the tag is already linked to another profile.
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('coc_player_tag', normalized)
    .maybeSingle()
  if (existing) {
    return res.status(409).json({ message: 'This COC tag is already registered. Try signing in.' })
  }

  // 2. Verify the player actually owns this account via Supercell's
  //    official verifytoken endpoint. The token is single-use and
  //    expires after 15 minutes — so a leaked token can never be
  //    replayed for signup.
  let playerInfo
  try {
    playerInfo = await cocService.verifyPlayerToken(`#${normalized}`, api_token)
  } catch (err) {
    return res.status(400).json({
      message: err.message || 'COC API token verification failed',
      hint: 'Generate a fresh API token in-game (Settings → More Settings → API Token), then paste it here within 15 minutes.'
    })
  }

  if (playerInfo?.status !== 'ok') {
    return res.status(400).json({
      message: 'COC API token is invalid or expired. Generate a new one and try again.'
    })
  }

  // 3. Fetch the player profile to capture name/townHall/trophies.
  let playerProfile = null
  try {
    playerProfile = await cocService.getPlayer(`#${normalized}`)
  } catch {
    // Non-fatal — we can still create the account with just the verified tag.
  }

  // 4. Create the Supabase auth user with email_confirm: true so no
  //    verification email is sent. The synthetic email is unguessable
  //    to anyone who doesn't know the tag.
  const internalEmail = tagToInternalEmail(normalized)

  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email: internalEmail,
    password,
    email_confirm: true,
    user_metadata: {
      display_name: display_name || playerProfile?.name || `#${normalized}`,
      coc_player_tag: normalized,
      coc_player_name: playerProfile?.name || null,
      coc_town_hall: playerProfile?.townHallLevel || null,
      coc_trophies: playerProfile?.trophies || null,
      // mark as auto-approved because we cryptographically verified ownership
      approval_status: 'approved'
    }
  })

  if (createErr || !created?.user) {
    // Common race: tag collision between step 1 and step 4, or the
    // email format conflicts with an existing user.
    return res.status(409).json({
      message: createErr?.message || 'Could not create account. The tag or internal email may already be in use.'
    })
  }

  // 5. The handle_new_user() trigger created a profile row from the
  //    metadata above. Patch it to mark COC as verified + set the
  //    approval timestamp so the user bypasses the pending queue.
  await supabase
    .from('profiles')
    .update({
      coc_verified: true,
      coc_verified_at: new Date().toISOString(),
      coc_linked_at: new Date().toISOString(),
      approval_status: 'approved',
      approval_reviewed_at: new Date().toISOString()
    })
    .eq('id', created.user.id)

  // 6. Issue a session for the new user — this is a server-side sign
  //    in so we don't need to round-trip the password back through
  //    the client.
  const { data: signinData, error: signinErr } = await supabase.auth.signInWithPassword({
    email: internalEmail,
    password
  })

  if (signinErr || !signinData?.session) {
    return res.status(500).json({
      message: 'Account created but sign-in failed. Please try signing in manually.',
      user_id: created.user.id
    })
  }

  const profile = await fetchProfile(supabase, created.user.id)

  res.status(201).json({
    session: signinData.session,
    profile,
    mode: 'coc_tag'
  })
}))

// ── POST /api/coc-auth/signin ────────────────────────────────

router.post('/signin', asyncHandler(async (req, res) => {
  const { tag, password } = req.body || {}

  if (!isValidTag(tag)) {
    return res.status(400).json({ message: 'Invalid COC player tag format' })
  }
  if (!isValidPassword(password)) {
    return res.status(400).json({ message: 'Password must be 6–128 characters' })
  }

  const supabase = getSupabaseAdmin()
  if (!supabase) {
    return res.status(503).json({ message: 'Auth service not configured' })
  }

  // Look up the user by tag → resolve their internal email →
  // sign in with that. Doing it this way means the client never
  // needs to know the synthetic email exists.
  const user = await findAuthUserByTag(supabase, tag)
  if (!user?.email) {
    return res.status(401).json({ message: 'No account found for that tag' })
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: user.email,
    password
  })

  if (error || !data?.session) {
    return res.status(401).json({ message: error?.message || 'Invalid credentials' })
  }

  const profile = await fetchProfile(supabase, data.user.id)

  res.json({
    session: data.session,
    profile,
    mode: 'coc_tag'
  })
}))

// ── GET /api/coc-auth/health ────────────────────────────────
// Lightweight check so the client can decide whether to even show the
// COC tag option (e.g. the COC API token must be configured).
router.get('/health', asyncHandler(async (_req, res) => {
  res.json({
    coc_api_configured: config.isCocConfigured(),
    supabase_configured: config.isSupabaseConfigured()
  })
}))

export default router

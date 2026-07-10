import { Router } from 'express'
import { cocService } from '../services/cocService.js'
import { asyncHandler } from '../middleware/errorMiddleware.js'
import { cocApiLimiter } from '../middleware/rateLimit.js'

const router = Router()

// Apply rate limit to all COC API endpoints
router.use(cocApiLimiter)

// ── Clan endpoints ───────────────────────────────────────────

// Get clan info
router.get('/clans/:tag', asyncHandler(async (req, res) => {
  const data = await cocService.getClan(req.params.tag)
  res.json(data)
}))

// Get clan members
router.get('/clans/:tag/members', asyncHandler(async (req, res) => {
  const data = await cocService.getClanMembers(req.params.tag)
  res.json(data)
}))

// Get current war
router.get('/clans/:tag/currentwar', asyncHandler(async (req, res) => {
  const data = await cocService.getCurrentWar(req.params.tag)
  res.json(data)
}))

// Get war log
router.get('/clans/:tag/warlog', asyncHandler(async (req, res) => {
  const data = await cocService.getWarLog(req.params.tag)
  res.json(data)
}))

// Get CWL group
router.get('/clans/:tag/currentwar/leaguegroup', asyncHandler(async (req, res) => {
  const data = await cocService.getCWLGroup(req.params.tag)
  res.json(data)
}))

// Get specific CWL war
router.get('/clanwarleagues/wars/:warTag', asyncHandler(async (req, res) => {
  const data = await cocService.getCWLWar(req.params.warTag)
  res.json(data)
}))

// ── Player endpoints ─────────────────────────────────────────

// Test endpoint: confirms the COC API token works from this server's IP.
// Hit GET /api/coc/test to see the status.
router.get('/test', asyncHandler(async (_req, res) => {
  const { config } = await import('../config/index.js')
  res.json({
    coc_token_configured: Boolean(config.cocApiToken),
    coc_token_preview: config.cocApiToken
      ? config.cocApiToken.substring(0, 10) + '...'
      : 'not set',
    coc_clan_tag: config.cocClanTag,
    note: 'To check IP authorization, hit /api/coc/clans/<your_clan_tag>'
  })
}))

// Clear all cached COC data (useful after changing clan tag).
// GET /api/coc/clear-cache
router.get('/clear-cache', asyncHandler(async (_req, res) => {
  cocService.clearCache()
  res.json({ message: 'Cache cleared' })
}))

router.get('/players/:tag', asyncHandler(async (req, res) => {
  const data = await cocService.getPlayer(req.params.tag)
  res.json(data)
}))

// Player league history (ranked league progression per season).
// Mirrors the in-game Player → League History screen.
router.get('/players/:tag/leaguehistory', asyncHandler(async (req, res) => {
  const data = await cocService.getPlayerLeagueHistory(req.params.tag)
  res.json(data)
}))

// Verify player owns the COC account via in-game API token.
// POST /api/coc/players/:tag/verifytoken
// Body: { token: "abc123..." }
// Returns: { tag, token, status } where status is "ok" | "invalid"
router.post('/players/:tag/verifytoken', asyncHandler(async (req, res) => {
  const { token } = req.body
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ message: 'API token is required in request body' })
  }
  const data = await cocService.verifyPlayerToken(req.params.tag, token)
  res.json(data)
}))

// ── Misc ─────────────────────────────────────────────────────

// Search clans
router.get('/clans', asyncHandler(async (req, res) => {
  const data = await cocService.searchClans(req.query)
  res.json(data)
}))

// Get leagues
router.get('/leagues', asyncHandler(async (_req, res) => {
  const data = await cocService.getLeagues()
  res.json(data)
}))

export default router
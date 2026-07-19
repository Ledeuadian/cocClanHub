/**
 * Clash of Clans API service.
 * Server-side proxy with caching to respect rate limits.
 *
 * NOTE: The COC API uses IP-bound tokens. You need to whitelist your
 * server's IP at https://developer.clashofclans.com/
 */

import axios from 'axios'
import NodeCache from 'node-cache'
import { config } from '../config/index.js'
import { getSupabaseAdmin } from '../config/supabase.js'

const coc = axios.create({
  baseURL: config.cocApiBase,
  headers: {
    Authorization: `Bearer ${config.cocApiToken}`,
    Accept: 'application/json'
  },
  timeout: 15000
})

// Cache: short TTL to reduce upstream calls while keeping data fresh
const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 }) // 5 min default

/**
 * Build a COC-API-shaped member object from a row in clan_members_roster.
 * Keeps the field names identical to the real API so downstream code
 * never has to branch.
 */
function rosterRowToCOCMember(row) {
  return {
    tag: '#' + row.tag,
    name: row.name,
    role: row.role,
    townHallLevel: row.town_hall,
    trophies: row.trophies,
    donations: row.donations,
    // Mark synthetic rows so the UI can (optionally) distinguish them.
    _dummy: row.is_dummy === true
  }
}

/**
 * Load the dev/dummy roster from Supabase. Returns [] if not configured.
 */
async function loadDummyRoster() {
  try {
    const supabase = getSupabaseAdmin()
    if (!supabase) return []
    const { data, error } = await supabase
      .from('clan_members_roster')
      .select('*')
      .order('donations', { ascending: false })
    if (error) {
      console.warn('[cocService] dummy roster load failed:', error.message)
      return []
    }
    return data || []
  } catch (e) {
    return []
  }
}

/**
 * Generic GET with cache wrapper.
 * @param {string} endpoint - e.g. '/clans/%232PP'
 */
async function cachedGet(endpoint, cacheKey = endpoint, ttlSeconds = 300) {
  const cached = cache.get(cacheKey)
  if (cached) return cached

  try {
    const { data } = await coc.get(endpoint)
    cache.set(cacheKey, data, ttlSeconds)
    return data
  } catch (err) {
    // Surface a clean error to controller
    if (err.response) {
      console.error(`[cocService] ${endpoint} → ${err.response.status}:`, err.response.data?.message || err.message)
      const err2 = new Error(err.response.data?.message || `COC API ${err.response.status}`)
      err2.status = err.response.status
      throw err2
    }
    console.error(`[cocService] Network error for ${endpoint}:`, err.message)
    throw err
  }
}

// Helper to encode clan/player tags for the COC API URL.
// Strips any '#' from the input, adds it back, then URL-encodes the whole thing
// so the final URL is /players/%2328JCLC9RP (which the COC API requires).
const encodeTag = (tag) => {
  // Ensure the tag starts with '#'
  const normalized = '#' + tag.replace(/^#/, '').toUpperCase()
  return encodeURIComponent(normalized)
}

export const cocService = {
  /**
   * Get clan info
   */
  getClan(tag = config.cocClanTag) {
    return cachedGet(`/clans/${encodeTag(tag)}`, `clan:${tag}`)
  },

  /**
   * Get clan members list.
   *
   * In development, when the live COC API returns an empty list (e.g.
   * the token isn't whitelisted, you're the only member, or you don't
   * own 50 accounts to populate the clan), we fall back to the
   * `clan_members_roster` table in Supabase. The merge keeps the
   * response shape identical to the real COC API so callers don't
   * need to branch.
   */
  async getClanMembers(tag = config.cocClanTag) {
    try {
      const live = await cachedGet(`/clans/${encodeTag(tag)}/members`, `members:${tag}`, 180)
      const liveItems = live?.items || []
      // Healthy live data → use as-is
      if (liveItems.length > 0) return live
    } catch (err) {
      // Live API failed (no token, IP not whitelisted, etc.) — fall through.
      console.warn('[cocService] live member fetch failed, using dummy roster:', err.message)
    }

    // Fall back to (or merge with) the dummy roster
    const roster = await loadDummyRoster()
    if (roster.length === 0) return { items: [] }

    return {
      items: roster.map(rosterRowToCOCMember)
    }
  },

  /**
   * Get current war (if active)
   */
  getCurrentWar(tag = config.cocClanTag) {
    return cachedGet(`/clans/${encodeTag(tag)}/currentwar`, `war:${tag}`, 60)
  },

  /**
   * Get war log (last 15 wars)
   */
  getWarLog(tag = config.cocClanTag) {
    return cachedGet(`/clans/${encodeTag(tag)}/warlog`, `warlog:${tag}`, 600)
  },

  /**
   * Get CWL group
   */
  getCWLGroup(tag = config.cocClanTag) {
    return cachedGet(`/clans/${encodeTag(tag)}/currentwar/leaguegroup`, `cwl:${tag}`, 300)
  },

  /**
   * Get specific CWL war
   */
  getCWLWar(warTag) {
    return cachedGet(`/clanwarleagues/wars/${encodeTag(warTag)}`, `cwlwar:${warTag}`)
  },

  /**
   * Get player info
   */
  getPlayer(playerTag) {
    return cachedGet(`/players/${encodeTag(playerTag)}`, `player:${playerTag}`, 300)
  },

  /**
   * Verify player owns the COC account by validating the in-game API token.
   * This is the official Supercell-recommended way to prove account ownership.
   * Tokens are one-time use and expire after 15 minutes.
   *
   * Returns: { tag, token, status: 'ok' | 'invalid' | 'expired' }
   * The token check is NEVER cached — every call hits Supercell directly.
   *
   * @param {string} playerTag  - e.g. '#P8L8Y0QJ'
   * @param {string} apiToken   - the temporary token from in-game settings
   */
  async verifyPlayerToken(playerTag, apiToken) {
    try {
      const { data } = await coc.post(
        `/players/${encodeTag(playerTag)}/verifytoken`,
        { token: apiToken }
      )
      return data
    } catch (err) {
      if (err.response) {
        const err2 = new Error(
          err.response.data?.message ||
          `Verification failed: ${err.response.status}`
        )
        err2.status = err.response.status
        err2.body = err.response.data
        throw err2
      }
      throw err
    }
  },

  /**
   * Get player's league history (ranked/trophy league progression per season).
   * This is the data shown in-game at Player → League History.
   *
   * @param {string} playerTag
   */
  getPlayerLeagueHistory(playerTag) {
    return cachedGet(
      `/players/${encodeTag(playerTag)}/leaguehistory`,
      `leaguehistory:${playerTag}`,
      600 // 10 min — history doesn't change often
    )
  },

  /**
   * Search clans
   */
  searchClans(params) {
    const qs = new URLSearchParams(params).toString()
    return cachedGet(`/clans?${qs}`, `search:${qs}`, 120)
  },

  /**
   * Get leagues (used for TH filtering on recruiting)
   */
  getLeagues() {
    return cachedGet('/leagues', 'leagues', 86400) // 24h
  },

  /**
   * Force-bust cache (admin only)
   */
  clearCache() {
    cache.flushAll()
  }
}

export default cocService
/**
 * Clash of Clans API Service
 *
 * To use the official COC API:
 * 1. Sign up at https://developer.clashofclans.com/
 * 2. Create an API key
 * 3. Use this key in the backend (NEVER expose it in the frontend)
 *
 * The backend will proxy requests to api.clashofclans.com/v1
 *
 * This service hits our backend, which then proxies to the official COC API.
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

/**
 * Helper for making authenticated requests to our backend.
 * The backend handles the COC API key securely.
 */
async function cocFetch(endpoint, options = {}) {
  const url = `${API_BASE}/coc${endpoint}`
  if (import.meta.env.DEV) console.log('[cocApi] GET', url)
  let res
  try {
    res = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      credentials: 'include',
      ...options
    })
  } catch (err) {
    throw new Error(`Cannot reach backend (${API_BASE}). Is the server running?`)
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }))
    // Map status codes to friendly messages
    let msg = body.message || body.reason || `COC API error: ${res.status}`
    if (res.status === 404) {
      msg = `Player or clan not found (tag may be wrong or the account is private).`
    } else if (res.status === 403) {
      msg = `COC API key not authorized for this IP. Check backend/Supercell setup.`
    } else if (res.status === 429) {
      msg = `Rate limit hit. Try again in a minute.`
    } else if (res.status >= 500) {
      msg = `Supercell server error. Try again later.`
    }
    throw new Error(msg)
  }

  return res.json()
}

export const cocApi = {
  /**
   * Get clan info by clan tag
   * @param {string} tag - Clan tag with or without leading #
   */
  getClan(tag) {
    const encoded = encodeURIComponent(tag.replace('#', ''))
    return cocFetch(`/clans/${encoded}`)
  },

  /**
   * Get clan member list
   * @param {string} tag
   */
  getClanMembers(tag) {
    const encoded = encodeURIComponent(tag.replace('#', ''))
    return cocFetch(`/clans/${encoded}/members`)
  },

  /**
   * Get clan war log (last 15 wars)
   * @param {string} tag
   */
  getWarLog(tag) {
    const encoded = encodeURIComponent(tag.replace('#', ''))
    return cocFetch(`/clans/${encoded}/warlog`)
  },

  /**
   * Get current clan war
   * @param {string} tag
   */
  getCurrentWar(tag) {
    const encoded = encodeURIComponent(tag.replace('#', ''))
    return cocFetch(`/clans/${encoded}/currentwar`)
  },

  /**
   * Get CWL group
   * @param {string} tag
   */
  getCWL(tag) {
    const encoded = encodeURIComponent(tag.replace('#', ''))
    return cocFetch(`/clans/${encoded}/currentwar/leaguegroup`)
  },

  /**
   * Get player info
   * @param {string} playerTag
   */
  getPlayer(playerTag) {
    const encoded = encodeURIComponent(playerTag.replace('#', ''))
    return cocFetch(`/players/${encoded}`)
  },

  /**
   * Verify player owns the COC account by validating the in-game API token.
   * Returns: { tag, token, status: 'ok' | 'invalid' | 'expired' }
   *
   * The user gets the token from in-game:
   *   Settings → More Settings → API Token
   * It expires after 15 minutes and is one-time use.
   *
   * @param {string} playerTag
   * @param {string} apiToken  the temporary token from the player's game
   */
  async verifyPlayerToken(playerTag, apiToken) {
    const encoded = encodeURIComponent(playerTag.replace('#', ''))
    return cocFetch(`/players/${encoded}/verifytoken`, {
      method: 'POST',
      body: JSON.stringify({ token: apiToken })
    })
  },

  /**
   * Search clans by name/filters
   */
  searchClans(params = {}) {
    const qs = new URLSearchParams(params).toString()
    return cocFetch(`/clans${qs ? `?${qs}` : ''}`)
  },

  /**
   * Get leagues list (for TH level filtering on recruiting)
   */
  getLeagues() {
    return cocFetch('/leagues')
  },

  /**
   * Backend health check — returns the configured clan tag + API status.
   * Used by ClanContext to know which clan to fetch.
   */
  getTest() {
    return cocFetch('/test')
  }
}

export default cocApi

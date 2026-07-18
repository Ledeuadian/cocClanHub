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
 * fetch() wrapper with retry + timeout — survives Render free-tier cold starts.
 * - First attempt: generous timeout (45s) to let Render spin up.
 * - If it fails, retries up to 2 more times with a short delay.
 */
async function fetchWithRetry(url, options, maxRetries = 2) {
  const fetchWithTimeout = async () => {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 45000) // 45s for Render cold start
    try {
      return await fetch(url, { ...options, signal: controller.signal })
    } finally {
      clearTimeout(timeoutId)
    }
  }

  let lastErr
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fetchWithTimeout()
    } catch (err) {
      lastErr = err
      // Don't retry on abort (timeout) of the last attempt
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 2000)) // wait 2s before retry
      }
    }
  }
  throw lastErr
}

/**
 * Helper for making authenticated requests to our backend.
 * The backend handles the COC API key securely.
 *
 * Retries on network failure to survive Render free-tier cold starts
 * (the first request after idle can take 30–60s to wake the service).
 */
async function cocFetch(endpoint, options = {}) {
  const url = `${API_BASE}/coc${endpoint}`
  if (import.meta.env.DEV) console.log('[cocApi] GET', url)
  let res
  try {
    res = await fetchWithRetry(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      credentials: 'include',
      ...options
    })
  } catch (err) {
    // Only label it "Cannot reach backend" when fetch truly fails (network error / timeout).
    // A 404 or 500 response does NOT enter this branch — it returns a Response object.
    throw new Error(`Cannot reach backend (${API_BASE}). Is the server running?`)
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }))
    // Map status codes to friendly messages
    let msg = body.message || body.reason || `Server error: ${res.status}`
    if (res.status === 404) {
      msg = `Route not found: ${endpoint}`
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
   * @param {string} tag - Clan tag with or without leading #.
   *   Pass 'default' to let the backend use its configured COC_CLAN_TAG.
   */
  getClan(tag) {
    if (tag === 'default') return cocFetch('/clans/default')
    const encoded = encodeURIComponent(tag.replace('#', ''))
    return cocFetch(`/clans/${encoded}`)
  },

  /**
   * Get clan member list
   * @param {string} tag
   */
  getClanMembers(tag) {
    if (tag === 'default') return cocFetch('/clans/default/members')
    const encoded = encodeURIComponent(tag.replace('#', ''))
    return cocFetch(`/clans/${encoded}/members`)
  },

  /**
   * Get clan war log (last 15 wars)
   * @param {string} tag
   */
  getWarLog(tag) {
    if (tag === 'default') return cocFetch('/clans/default/warlog')
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
   *
   * cocFetch already prepends `/coc`, so passing `/test` here hits the right
   * route: /api/coc/test. (Calling `/test` directly was 404'ing and being
   * mis-labelled as "Cannot reach backend" — see error handling in cocFetch.)
   */
  getTest() {
    return cocFetch('/test')
  }
}

export default cocApi

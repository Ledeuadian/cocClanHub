/**
 * Client service for COC tag-based auth.
 *
 * Wraps the backend's /api/coc-auth/* endpoints. On a successful
 * signup/signin the returned Supabase session is fed back into the
 * Supabase client via setSession() so:
 *   - The existing AuthContext picks up the new user via onAuthStateChange
 *   - The Socket.IO JWT middleware we built uses the new access token
 *   - persistSession in localStorage works the same as email login
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase.js'

const API_URL = import.meta.env.VITE_API_URL || '/api'

async function postJson(path, body) {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const message = data?.message || `HTTP ${res.status}`
    const err = new Error(message)
    err.status = res.status
    err.body = data
    throw err
  }
  return data
}

/**
 * Is the COC-tag auth flow available right now? Both Supabase and
 * the COC API must be configured on the backend.
 */
export async function isCocTagAuthAvailable() {
  try {
    const res = await fetch(`${API_URL}/coc-auth/health`)
    if (!res.ok) return false
    const data = await res.json()
    return Boolean(data?.coc_api_configured && data?.supabase_configured)
  } catch {
    return false
  }
}

/**
 * Sign up a new account using only a COC tag + password + API token.
 * The backend verifies the COC token via Supercell's verifytoken
 * endpoint, so we know the person owns the in-game account.
 *
 * @param {object} params
 * @param {string} params.tag         - e.g. '#P8L8Y0QJ' or 'P8L8Y0QJ'
 * @param {string} params.password
 * @param {string} params.api_token   - in-game API token (15-min expiry)
 * @param {string} [params.display_name]
 */
export async function signUpWithCocTag({ tag, password, api_token, display_name }) {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured')
  }
  const { session } = await postJson('/coc-auth/signup', {
    tag,
    password,
    api_token,
    display_name
  })

  if (!session?.access_token) {
    throw new Error('Server did not return a session')
  }

  // Push the session into the Supabase client so AuthContext picks it up.
  const { error } = await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token
  })
  if (error) throw new Error(`Session hydration failed: ${error.message}`)

  return session
}

/**
 * Sign in using an existing tag + password.
 */
export async function signInWithCocTag({ tag, password }) {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured')
  }
  const { session } = await postJson('/coc-auth/signin', { tag, password })

  if (!session?.access_token) {
    throw new Error('Server did not return a session')
  }

  const { error } = await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token
  })
  if (error) throw new Error(`Session hydration failed: ${error.message}`)

  return session
}

export default {
  isCocTagAuthAvailable,
  signUpWithCocTag,
  signInWithCocTag
}

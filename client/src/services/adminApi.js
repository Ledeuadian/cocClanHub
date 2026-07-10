/**
 * Admin API service
 *
 * Uses the user's Supabase access token to authenticate admin requests.
 * No shared secret — the backend checks profiles.is_admin for authorization.
 *
 * To become an admin, run in Supabase SQL Editor:
 *   UPDATE profiles SET is_admin = TRUE WHERE email = 'your@email.com';
 */

import { supabase } from '../lib/supabase.js'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

async function adminFetch(endpoint, options = {}) {
  // Get the current user's access token
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) {
    throw new Error('Not authenticated. Please sign in.')
  }

  const url = `${API_BASE}/admin${endpoint}`
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      ...options.headers
    },
    ...options
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }))
    if (res.status === 401) {
      throw new Error('Your session has expired. Please sign in again.')
    }
    if (res.status === 403) {
      throw new Error('Admin privileges required. Your account is not an admin.')
    }
    throw new Error(body.message || `Admin API error: ${res.status}`)
  }

  return res.json()
}

export const adminApi = {
  /**
   * Check if the current user is an admin.
   * Returns { is_admin: true, admin: {...} } or throws.
   */
  checkAdmin() {
    return adminFetch('/check')
  },

  /**
   * Get count of users pending approval (for badge).
   */
  getPendingCount() {
    return adminFetch('/pending-count')
  },

  /**
   * List all pending users with full COC player data enriched.
   */
  listPendingUsers() {
    return adminFetch('/pending-users')
  },

  /**
   * Get a single user with their full in-game COC profile (for review).
   */
  getUserCOCProfile(userId) {
    return adminFetch(`/users/${userId}/coc-profile`)
  },

  /**
   * Approve a user.
   */
  approveUser(userId, note = '') {
    return adminFetch(`/users/${userId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ note })
    })
  },

  /**
   * Reject a user.
   */
  rejectUser(userId, note = '') {
    return adminFetch(`/users/${userId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ note })
    })
  }
}

export default adminApi

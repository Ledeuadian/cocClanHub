import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase.js'

/* ── Guest identity ──────────────────────────────────────────── */
const GUEST_USER_KEY = 'coc_guest_user'

function loadGuestUser() {
  try {
    const raw = localStorage.getItem(GUEST_USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function createGuestUser() {
  const guest = {
    id: `guest-${Date.now()}`,
    isGuest: true,
    email: null,
    user_metadata: { display_name: 'Guest' }
  }
  try { localStorage.setItem(GUEST_USER_KEY, JSON.stringify(guest)) } catch { /* */ }
  return guest
}

function clearGuestUser() {
  try { localStorage.removeItem(GUEST_USER_KEY) } catch { /* */ }
}

const AuthContext = createContext({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  signInAsGuest: () => {}
})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Restore guest session first so guests persist across reloads.
    const guest = loadGuestUser()
    if (guest) {
      setUser(guest)
      setLoading(false)
      return
    }

    if (!isSupabaseConfigured()) {
      // Mock auth state for development without Supabase
      setLoading(false)
      return
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) loadProfile(session.user.id)
      else setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        // Real Supabase sign-in always wins over a cached guest session.
        if (session?.user) clearGuestUser()
        setUser(session?.user ?? null)
        if (session?.user) await loadProfile(session.user.id)
        else setProfile(null)
        setLoading(false)
      }
    )

    return () => subscription?.unsubscribe()
  }, [])

  async function loadProfile(userId) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      if (!error && data) setProfile(data)
    } catch (err) {
      console.error('Profile load error:', err)
    } finally {
      setLoading(false)
    }
  }

  /**
   * Force-refresh the current user's profile row.
   * Called after profile edits (avatar, display name, etc.) so all
   * components see the new data without a full page reload.
   */
  async function refreshProfile() {
    if (!user) return
    await loadProfile(user.id)
  }

  /**
   * Start a guest session — no Supabase account required.
   * Guests can browse but are blocked from DMs, base copying, CWL, and strategies.
   */
  function signInAsGuest() {
    const guest = createGuestUser()
    setUser(guest)
    setProfile(null) // guests have no profile row
  }

  async function signOut() {
    if (user?.isGuest) {
      clearGuestUser()
    } else if (isSupabaseConfigured()) {
      await supabase.auth.signOut()
    }
    setUser(null)
    setProfile(null)
  }

  const isGuest = !!user?.isGuest

  return (
    <AuthContext.Provider value={{ user, profile, loading, isGuest, signOut, refreshProfile, signInAsGuest }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
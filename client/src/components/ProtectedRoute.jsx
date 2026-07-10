/**
 * ProtectedRoute — redirects unauthenticated users to /login.
 *
 * Two modes:
 * - "supabase" (default): if no Supabase session, redirect to /login
 * - "guest":   if no Supabase session, allow access as guest (dev mode)
 *
 * The mode is determined by whether Supabase is configured.
 * While loading, shows a small spinner.
 */

import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { isSupabaseConfigured } from '../lib/supabase.js'
import { Loader2 } from 'lucide-react'

export default function ProtectedRoute({ children, allowGuest = false }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  // Supabase not configured: dev mode, allow everything
  if (!isSupabaseConfigured()) return children

  // Still checking session
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-clan-accent animate-spin" />
          <p className="text-sm text-clan-muted">Loading...</p>
        </div>
      </div>
    )
  }

  // No session → redirect to login (preserving intended destination)
  if (!user) {
    if (allowGuest) return children
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  return children
}
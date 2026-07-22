/**
 * OnboardingGate
 *
 * Forces new users to link their COC account before they can use the app.
 *
 * Behavior:
 * - If user has NO COC link (coc_player_tag is null), the gate blocks
 *   ALL non-Profile routes and shows a full-screen "link your account" overlay.
 * - If user is on /profile, the gate stays out of the way.
 * - Once linked AND token-verified (coc_verified = true), the gate disappears
 *   and full app access is granted.
 *
 * The "Skip for now" button is for dev/testing — in production you can
 * remove it (or hide it behind an env flag).
 */

import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useState, useEffect } from 'react'
import { Shield, Lock, ArrowRight, X, Loader2 } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function OnboardingGate({ children }) {
  const { user, profile, loading } = useAuth()
  const location = useLocation()
  const [bypass, setBypass] = useState(false)

  // Multi-step check:
  // 1. COC tag linked & verified
  // 2. Admin approval status = 'approved'
  const isLinked = Boolean(profile?.coc_player_tag) && Boolean(profile?.coc_verified)
  const isApproved = profile?.approval_status === 'approved' || profile?.is_admin === true
  const isPending = profile?.approval_status === 'pending'
  const isRejected = profile?.approval_status === 'rejected'
  const passGate = isLinked && isApproved

  // If we're still loading the profile, don't flash the gate
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-sm text-clan-muted">Loading...</div>
      </div>
    )
  }

  // Not signed in → let ProtectedRoute handle the redirect
  if (!user) return children

  // Guests skip onboarding entirely — no COC link needed for browsing
  if (user?.isGuest) return children

  // Fully onboarded → no gate
  if (passGate) return children

  // Dev/test bypass
  if (bypass) return children

  // Allow /profile so users can complete linking
  if (location.pathname === '/profile') return children

  // Show the appropriate gate screen
  if (isPending && isLinked) return <PendingApprovalScreen />
  if (isRejected) return <RejectedScreen />

  // Default: show linking gate
  return <GateScreen onSkip={() => setBypass(true)} />

  // Otherwise: show the gate, redirect to /profile
  return <GateScreen onSkip={() => setBypass(true)} />
}

function GateScreen({ onSkip }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background orbs (matches login style) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="glow-orb glow-orb-slow w-96 h-96 bg-clan-accent/20 -top-32 -left-32" />
        <div className="glow-orb glow-orb-delay w-96 h-96 bg-clan-elixir/20 -bottom-32 -right-32" />
      </div>

      <div className="relative card max-w-md w-full text-center space-y-4">
        <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-clan-accent via-clan-gold-dark to-clan-accent flex items-center justify-center shadow-2xl shadow-clan-accent/30">
          <Lock className="w-10 h-10 text-clan-darker" />
        </div>

        <h1 className="font-display text-2xl font-bold text-gold-shimmer">One more step, chief</h1>

        <p className="text-sm text-clan-muted">
          Before you can enter the clan hub, you need to <strong className="text-clan-text">link your Clash of Clans account</strong>.
          This proves you own the player and unlocks live stats, war tracking, and more.
        </p>

        <div className="text-xs text-clan-muted space-y-1 text-left bg-clan-surface rounded-lg p-3">
          <p className="flex items-center gap-2">
            <Shield className="w-3 h-3 text-clan-accent" />
            <span>Your tag is verified with the official Supercell API</span>
          </p>
          <p className="flex items-center gap-2">
            <Shield className="w-3 h-3 text-clan-accent" />
            <span>Only takes 30 seconds</span>
          </p>
        </div>

        <Link
          to="/profile?onboard=1"
          className="btn-primary w-full"
        >
          Link my COC Account <ArrowRight className="w-4 h-4" />
        </Link>

        <button
          onClick={onSkip}
          className="text-xs text-clan-muted hover:text-clan-text"
        >
          Skip for now (dev only)
        </button>
      </div>
    </div>
  )
}

function PendingApprovalScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="glow-orb glow-orb-slow w-96 h-96 bg-amber-500/20 -top-32 -left-32" />
        <div className="glow-orb glow-orb-delay w-96 h-96 bg-clan-elixir/15 -bottom-32 -right-32" />
      </div>

      <div className="relative card max-w-md w-full text-center space-y-4">
        <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-2xl shadow-amber-500/30">
          <Loader2 className="w-10 h-10 text-white animate-spin" />
        </div>

        <h1 className="font-display text-2xl font-bold text-gold-shimmer">Awaiting Approval</h1>

        <p className="text-sm text-clan-muted">
          Your COC account is linked! An admin is now reviewing your registration to confirm you belong to the clan.
        </p>

        <div className="text-xs text-clan-muted space-y-1 text-left bg-clan-surface rounded-lg p-3">
          <p className="flex items-center gap-2">
            <Shield className="w-3 h-3 text-clan-accent" />
            <span>This usually takes a few minutes</span>
          </p>
          <p className="flex items-center gap-2">
            <Shield className="w-3 h-3 text-clan-accent" />
            <span>You'll get full app access once approved</span>
          </p>
        </div>

        <p className="text-xs text-clan-muted">
          Need to update something? You can edit your linked COC account on the profile page.
        </p>

        <details className="text-left text-xs">
          <summary className="cursor-pointer text-clan-muted hover:text-clan-text">
            Stuck here? (Developer help)
          </summary>
          <div className="mt-2 space-y-2 text-clan-muted">
            <p>If you're the first user and no admin exists yet, run this in Supabase SQL Editor:</p>
            <pre className="bg-clan-bg border border-clan-border rounded p-2 overflow-x-auto text-[10px] text-clan-text">
{`UPDATE profiles
SET is_admin = TRUE,
    approval_status = 'approved'
WHERE email = 'your@email.com';`}
            </pre>
            <p>Then hard-refresh this page (Ctrl+Shift+R).</p>
          </div>
        </details>
      </div>
    </div>
  )
}

function RejectedScreen() {
  const navigate = useNavigate()
  const { signOut } = useAuth()

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="glow-orb glow-orb-slow w-96 h-96 bg-red-500/20 -top-32 -left-32" />
        <div className="glow-orb glow-orb-delay w-96 h-96 bg-clan-elixir/15 -bottom-32 -right-32" />
      </div>

      <div className="relative card max-w-md w-full text-center space-y-4">
        <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center shadow-2xl shadow-red-500/30">
          <X className="w-10 h-10 text-white" />
        </div>

        <h1 className="font-display text-2xl font-bold text-red-300">Registration Declined</h1>

        <p className="text-sm text-clan-muted">
          Your registration was not approved. This may be because your account doesn't match our clan's member list.
        </p>

        <p className="text-xs text-clan-muted">
          If you believe this is a mistake, contact a clan leader on Discord.
        </p>

        <button
          onClick={async () => { await signOut(); navigate('/login') }}
          className="btn-secondary w-full"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}

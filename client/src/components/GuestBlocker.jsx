/**
 * GuestBlocker
 *
 * Wraps content that should only be accessible to registered members.
 * When the current user is a guest, a blurred overlay with a "Members Only"
 * message and a sign-in CTA replaces the wrapped children.
 *
 * Props:
 *   - title  – headline on the blocker card (default: "Members Only")
 *   - message – supporting text (default explains the restriction)
 *   - compact – if true, renders an inline block instead of a full-page overlay
 */

import { Lock, LogIn } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export default function GuestBlocker({
  title = 'Members Only',
  message = 'This feature is available to signed-in members only. Create a free account or sign in to access it.',
  compact = false,
  children
}) {
  const { isGuest } = useAuth()
  const navigate = useNavigate()

  // Not a guest — render children normally
  if (!isGuest) return children

  if (compact) {
    // Inline-block variant (used inside cards, modals, etc.)
    return (
      <div className="relative">
        {/* Blurred content (semi-visible, gives a preview) */}
        <div className="blur-sm pointer-events-none select-none opacity-40">{children}</div>
        {/* Overlay card */}
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <div className="card text-center space-y-3 max-w-xs mx-auto shadow-xl">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-br from-clan-accent to-clan-gold-dark flex items-center justify-center">
              <Lock className="w-6 h-6 text-clan-darker" />
            </div>
            <h3 className="font-display text-lg font-bold">{title}</h3>
            <p className="text-xs text-clan-muted">{message}</p>
            <button
              onClick={() => navigate('/login')}
              className="btn-primary w-full inline-flex items-center justify-center gap-2"
            >
              <LogIn className="w-4 h-4" />
              Sign In
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Full-page variant (used as page-level replacement)
  return (
    <div className="page-container flex items-center justify-center min-h-[60vh]">
      <div className="relative w-full">
        {/* Blurred background preview */}
        <div className="blur-sm pointer-events-none select-none opacity-30 absolute inset-0">
          {children}
        </div>
        {/* Foreground card */}
        <div className="relative card text-center space-y-4 max-w-sm mx-auto shadow-2xl">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-clan-accent to-clan-gold-dark flex items-center justify-center shadow-lg shadow-clan-accent/30">
            <Lock className="w-8 h-8 text-clan-darker" />
          </div>
          <h2 className="font-display text-2xl font-bold">{title}</h2>
          <p className="text-sm text-clan-muted">{message}</p>
          <button
            onClick={() => navigate('/login')}
            className="btn-primary w-full inline-flex items-center justify-center gap-2"
          >
            <LogIn className="w-4 h-4" />
            Sign In
          </button>
        </div>
      </div>
    </div>
  )
}

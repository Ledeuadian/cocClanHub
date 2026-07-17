import { useState, useEffect } from 'react'
import { Mail, Lock, Shield, Loader2, Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { supabase, isSupabaseConfigured } from '../lib/supabase.js'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, loading } = useAuth()

  const [mode, setMode] = useState('signin') // 'signin' | 'signup' | 'forgot' | 'check-email'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [info, setInfo] = useState(null)

  // If already authenticated, redirect away from /login
  useEffect(() => {
    if (!loading && user) {
      navigate(location.state?.from || '/', { replace: true })
    }
  }, [user, loading, navigate, location.state])

  // Where to redirect after login
  const redirectTo = location.state?.from || '/profile?onboard=1'

  // ── Form submit (signin / signup) ──────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setSubmitting(true)

    if (!isSupabaseConfigured()) {
      setSubmitting(false)
      navigate(redirectTo)
      return
    }

    try {
      if (mode === 'signup') {
        const { error, data } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: displayName || email.split('@')[0] },
            emailRedirectTo: window.location.origin
          }
        })
        if (error) throw error
        // If email confirmation is required, show the check-email screen
        if (data?.user && !data.session) {
          setMode('check-email')
        } else {
          navigate(redirectTo)
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        navigate(redirectTo)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // ── Forgot password ────────────────────────────────────────
  const handleForgot = async (e) => {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setSubmitting(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login`
      })
      if (error) throw error
      setInfo('Password reset link sent! Check your inbox.')
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="glow-orb glow-orb-slow w-96 h-96 bg-clan-accent/20 -top-32 -left-32" />
        <div className="glow-orb glow-orb-delay w-96 h-96 bg-clan-elixir/15 -bottom-32 -right-32" />
        <div className="glow-orb glow-orb-slow glow-orb-delay w-72 h-72 bg-clan-primary/10 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 rounded-3xl flex items-center justify-center mb-4 hover-lift">
            <img
              src="/icons/android-chrome-192x192.png"
              alt="Clan Hub logo"
              className="w-20 h-20 object-contain"
              draggable="false"
            />
          </div>
          <h1 className="font-display text-4xl font-bold text-gold-shimmer">Clan Hub</h1>
          <p className="text-clan-muted text-sm mt-2">Your Clash of Clans clan headquarters</p>
        </div>

        <div className="card space-y-4">
          {/* Configuration banner */}
          {!isSupabaseConfigured() && (
            <div className="text-xs text-amber-300 bg-amber-900/20 border border-amber-700/50 rounded-lg p-3 flex gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold">Dev mode:</strong> Supabase isn't configured yet.
                Add credentials to <code className="text-clan-accent">client/.env</code> to enable real auth,
                OAuth, and database features.
              </div>
            </div>
          )}

          {/* ── CHECK EMAIL SCREEN ──────────────────────── */}
          {mode === 'check-email' ? (
            <div className="text-center py-4 space-y-3">
              <CheckCircle2 className="w-12 h-12 text-clan-success mx-auto" />
              <h2 className="font-display text-xl font-semibold">Check your inbox</h2>
              <p className="text-sm text-clan-muted">
                We sent a confirmation link to <span className="text-clan-text font-medium">{email}</span>.
                Click it to activate your account.
              </p>
              <button
                onClick={() => { setMode('signin'); setInfo(null) }}
                className="text-sm text-clan-accent hover:text-clan-gold"
              >
                Back to sign in
              </button>
            </div>
          ) : mode === 'forgot' ? (
            // ── FORGOT PASSWORD ────────────────────────────
            <form onSubmit={handleForgot} className="space-y-3">
              <h2 className="font-display text-lg font-semibold">Reset password</h2>
              <p className="text-xs text-clan-muted -mt-1">
                Enter your email and we'll send you a reset link.
              </p>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-clan-muted" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="input pl-9"
                />
              </div>
              {info && (
                <div className="text-xs text-green-300 bg-green-900/20 border border-green-700/50 rounded-lg p-2">
                  {info}
                </div>
              )}
              {error && (
                <div className="text-xs text-red-300 bg-red-900/20 border border-red-700/50 rounded-lg p-2">
                  {error}
                </div>
              )}
              <button type="submit" disabled={submitting} className="btn-primary w-full">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send reset link'}
              </button>
              <button
                type="button"
                onClick={() => { setMode('signin'); setError(null); setInfo(null) }}
                className="text-xs text-clan-muted hover:text-clan-text w-full text-center"
              >
                Back to sign in
              </button>
            </form>
          ) : (
            // ── SIGN IN / SIGN UP ─────────────────────────
            <>
              <div className="flex gap-1 p-1 bg-clan-surface rounded-lg">
                <button
                  onClick={() => setMode('signin')}
                  className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                    mode === 'signin' ? 'bg-clan-accent text-clan-darker' : 'text-clan-muted'
                  }`}
                >
                  Sign In
                </button>
                <button
                  onClick={() => setMode('signup')}
                  className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                    mode === 'signup' ? 'bg-clan-accent text-clan-darker' : 'text-clan-muted'
                  }`}
                >
                  Sign Up
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                {mode === 'signup' && (
                  <div className="relative">
                    <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-clan-muted" />
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Display name (optional)"
                      className="input pl-9"
                      maxLength={32}
                    />
                  </div>
                )}
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-clan-muted" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@example.com"
                    className="input pl-9"
                    autoComplete="email"
                  />
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-clan-muted" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="input pl-9 pr-10"
                    autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-clan-muted hover:text-clan-text"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {mode === 'signin' && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => { setMode('forgot'); setError(null) }}
                      className="text-xs text-clan-accent hover:text-clan-gold"
                    >
                      Forgot password?
                    </button>
                  </div>
                )}

                {error && (
                  <div className="text-xs text-red-300 bg-red-900/20 border border-red-700/50 rounded-lg p-2">
                    {error}
                  </div>
                )}

                <button type="submit" disabled={submitting} className="btn-primary w-full">
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : mode === 'signin' ? (
                    'Sign In'
                  ) : (
                    'Create Account'
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}


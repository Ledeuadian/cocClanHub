import { useTheme } from '../context/ThemeContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { usePushNotifications } from '../hooks/usePushNotifications.js'
import {
  Bell, Moon, Sun, Globe, Shield, Database,
  Check, X, AlertCircle, Loader2, Smartphone
} from 'lucide-react'

export default function Settings() {
  const { theme, toggle } = useTheme()
  const { signOut, isGuest } = useAuth()
  const push = usePushNotifications()

  return (
    <div className="page-container space-y-6">
      <h1 className="page-title">Settings</h1>

      {/* Appearance */}
      <div className="card space-y-4">
        <h2 className="section-title flex items-center gap-2">
          {theme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          Appearance
        </h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Theme</p>
            <p className="text-xs text-clan-muted">Currently using {theme} mode</p>
          </div>
          <button onClick={toggle} className="btn-secondary">
            Switch to {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
        </div>
      </div>

      {/* Notifications */}
      <div className="card space-y-4">
        <h2 className="section-title flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Notifications
        </h2>

        {/* Push notification status panel — hidden for guests */}
        {!isGuest && <PushNotificationPanel push={push} />}

        {isGuest && (
          <div className="rounded-lg bg-clan-surface border border-clan-border p-3 text-xs text-clan-muted">
            Sign in to enable push notifications for new messages.
          </div>
        )}

        {['War start/end alerts', 'Attack reminders', 'Donation requests', 'New announcements'].map((label, i) => (
          <div key={i} className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{label}</p>
              <p className="text-xs text-clan-muted">Push notifications</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" defaultChecked className="sr-only peer" />
              <div className="w-11 h-6 bg-clan-border rounded-full peer peer-checked:bg-clan-accent after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full" />
            </label>
          </div>
        ))}
      </div>

      {/* Connected services */}
      <div className="card space-y-4">
        <h2 className="section-title flex items-center gap-2">
          <Globe className="w-5 h-5" />
          Connected Services
        </h2>
        <ServiceRow
          icon={Shield}
          name="Supabase"
          status="not configured"
          description="Database and authentication backend"
        />
        <ServiceRow
          icon={Database}
          name="Clash of Clans API"
          status="not configured"
          description="Live clan and player data"
        />
      </div>

      {/* Danger zone */}
      <div className="card border-clan-danger/30 space-y-3">
        <h2 className="section-title text-clan-danger">Danger Zone</h2>
        <button onClick={signOut} className="btn-danger w-full">Sign Out</button>
      </div>
    </div>
  )
}

// ── Push notification status + control panel ────────────────

function PushNotificationPanel({ push }) {
  const { supported, permission, enabled, enable, disable, loading } = push

  // Unsupported: browser too old, or no Notification API
  if (!supported) {
    return (
      <div className="rounded-lg bg-clan-surface border border-clan-border p-3 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-clan-muted shrink-0 mt-0.5" />
        <div className="text-xs text-clan-muted">
          <p className="font-semibold text-clan-text mb-0.5">Push not available</p>
          <p>
            Your browser doesn't support push notifications.
            Try Chrome, Firefox, Edge, or install the app to your home screen.
          </p>
        </div>
      </div>
    )
  }

  // Permission denied — user must enable in browser settings
  if (permission === 'denied') {
    return (
      <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 flex items-start gap-3">
        <X className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
        <div className="text-xs flex-1">
          <p className="font-semibold text-red-300 mb-0.5">Notifications blocked</p>
          <p className="text-clan-muted">
            You've blocked notifications for this site. To enable them,
            click the lock icon in the address bar and turn notifications back on.
          </p>
        </div>
      </div>
    )
  }

  // Currently subscribed — show "Disable" option
  if (enabled && permission === 'granted') {
    return (
      <div className="rounded-lg bg-green-500/10 border border-green-500/30 p-3">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-9 h-9 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
            <Check className="w-5 h-5 text-green-400" />
          </div>
          <div className="text-xs flex-1">
            <p className="font-semibold text-green-300 mb-0.5">Push notifications enabled</p>
            <p className="text-clan-muted">
              You'll receive system notifications for new messages, even when the app is closed.
            </p>
          </div>
        </div>
        <button
          onClick={disable}
          disabled={loading}
          className="btn-secondary w-full text-xs !py-1.5"
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bell className="w-3 h-3" />}
          Disable notifications
        </button>
      </div>
    )
  }

  // Permission not yet requested — show "Enable" button
  return (
    <div className="rounded-lg bg-clan-surface border border-clan-border p-3">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-9 h-9 rounded-full bg-clan-accent/20 flex items-center justify-center shrink-0">
          <Smartphone className="w-5 h-5 text-clan-accent" />
        </div>
        <div className="text-xs flex-1">
          <p className="font-semibold text-clan-text mb-0.5">Get notified about new messages</p>
          <p className="text-clan-muted">
            Show system notifications when you receive a direct message or
            @mention, even when you're using other apps.
          </p>
        </div>
      </div>
      <button
        onClick={enable}
        disabled={loading}
        className="btn-primary w-full text-xs !py-1.5"
      >
        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bell className="w-3 h-3" />}
        Enable push notifications
      </button>
    </div>
  )
}

function ServiceRow({ icon: Icon, name, status, description }) {
  const isConfigured = status === 'connected'
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-clan-surface border border-clan-border">
      <div className="w-10 h-10 rounded-lg bg-clan-card flex items-center justify-center">
        <Icon className="w-5 h-5 text-clan-muted" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium">{name}</p>
        <p className="text-xs text-clan-muted">{description}</p>
      </div>
      <span className={`badge ${isConfigured ? 'bg-green-900/40 text-green-300 border border-green-700' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>
        {status}
      </span>
    </div>
  )
}
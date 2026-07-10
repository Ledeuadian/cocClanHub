import { useTheme } from '../context/ThemeContext.jsx'
import { Bell, Moon, Sun, Globe, Shield, Database } from 'lucide-react'

export default function Settings() {
  const { theme, toggle } = useTheme()

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
        <button className="btn-danger w-full">Sign Out</button>
      </div>
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
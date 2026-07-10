import { NavLink, Outlet } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  Swords,
  CalendarDays,
  Shield,
  Megaphone,
  Home as HomeIcon,
  Trophy,
  User,
  Settings as SettingsIcon
} from 'lucide-react'
import { cn } from '../../lib/utils.js'
import { useClan } from '../../context/ClanContext.jsx'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/members', label: 'Members', icon: Users },
  { to: '/chat', label: 'Chat', icon: MessageSquare },
  { to: '/wars', label: 'War Tracker', icon: Swords },
  { to: '/cwl', label: 'CWL Planner', icon: Shield },
  { to: '/bases', label: 'Base Layouts', icon: HomeIcon },
  { to: '/strategies', label: 'Strategies', icon: Trophy },
  { to: '/announcements', label: 'Announcements', icon: Megaphone },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays }
]

export default function Sidebar() {
  const { clan } = useClan()
  return (
    <aside className="hidden md:flex flex-col w-60 bg-clan-surface/60 backdrop-blur-xl border-r border-clan-border h-screen sticky top-0 z-30">
      {/* Logo */}
      <div className="flex items-center gap-2 p-4 border-b border-clan-border">
        {clan?.badgeUrls?.small ? (
          <img
            src={clan.badgeUrls.small}
            alt={clan.name}
            className="w-9 h-9 rounded-xl shadow-lg shadow-clan-accent/20"
          />
        ) : (
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-clan-accent to-clan-gold-dark flex items-center justify-center shadow-lg shadow-clan-accent/20">
            <Shield className="w-5 h-5 text-clan-darker" />
          </div>
        )}
        <span className="font-display text-lg font-bold text-gold-shimmer truncate">
          {clan?.name || 'Clan Hub'}
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-clan-card text-clan-accent border border-clan-accent/30'
                  : 'text-clan-muted hover:text-clan-text hover:bg-clan-card'
              )
            }
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer links */}
      <div className="border-t border-clan-border p-2 space-y-1">
        <NavLink to="/profile" className={({ isActive }) =>
          cn(
            'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
            isActive ? 'bg-clan-card text-clan-accent' : 'text-clan-muted hover:text-clan-text hover:bg-clan-card'
          )
        }>
          <User className="w-4 h-4" />
          Profile
        </NavLink>
        <NavLink to="/admin" className={({ isActive }) =>
          cn(
            'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
            isActive ? 'bg-clan-card text-clan-accent' : 'text-clan-muted hover:text-clan-text hover:bg-clan-card'
          )
        }>
          <Shield className="w-4 h-4" />
          Admin
        </NavLink>
        <NavLink to="/settings" className={({ isActive }) =>
          cn(
            'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
            isActive ? 'bg-clan-card text-clan-accent' : 'text-clan-muted hover:text-clan-text hover:bg-clan-card'
          )
        }>
          <SettingsIcon className="w-4 h-4" />
          Settings
        </NavLink>
      </div>
    </aside>
  )
}

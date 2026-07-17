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
import { useChat } from '../../context/ChatContext.jsx'
import Avatar from '../ui/Avatar.jsx'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/members', label: 'Members', icon: Users },
  { to: '/chat', label: 'Chat', icon: MessageSquare, isChat: true },
  { to: '/wars', label: 'War Tracker', icon: Swords },
  { to: '/cwl', label: 'CWL Planner', icon: Shield },
  { to: '/bases', label: 'Base Layouts', icon: HomeIcon },
  { to: '/strategies', label: 'Strategies', icon: Trophy },
  { to: '/announcements', label: 'Announcements', icon: Megaphone },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays }
]

export default function Sidebar() {
  const { clan } = useClan()
  const { threads, members } = useChat()

  // Find the most recent unread DM thread for the badge
  const mostRecentUnread = threads
    .filter((t) => t.unread > 0)
    .map((t) => ({
      ...t,
      user: members.find((m) => m.id === t.userId) || { name: t.userId[0] || '?', tag: t.userId }
    }))
    .sort((a, b) => (b.lastTime > a.lastTime ? 1 : -1))[0] || null

  const totalUnread = threads.reduce((sum, t) => sum + (t.unread || 0), 0)

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
        {navItems.map(({ to, label, icon: Icon, isChat }) => (
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
            {isChat ? (
              <div className="relative shrink-0">
                <Icon className="w-4 h-4" />
                {totalUnread > 0 && (
                  <>
                    {/* Messenger-style: sender avatar of most recent unread */}
                    {mostRecentUnread ? (
                      <span
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full border-2 border-clan-surface shadow-sm"
                        title={`New from ${mostRecentUnread.user?.name || 'someone'}`}
                      >
                        <Avatar
                          fallback={mostRecentUnread.user?.name?.[0] || '?'}
                          size="xs"
                          className="w-full h-full"
                        />
                      </span>
                    ) : (
                      <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-0.5 rounded-full bg-clan-danger text-white text-[10px] font-bold flex items-center justify-center">
                        {totalUnread}
                      </span>
                    )}
                  </>
                )}
              </div>
            ) : (
              <Icon className="w-4 h-4 shrink-0" />
            )}
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

import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Users, MessageSquare, Swords, Home as HomeIcon } from 'lucide-react'
import { cn } from '../../lib/utils.js'
import { useChat } from '../../context/ChatContext.jsx'
import { useMobileNav } from '../../context/MobileNavContext.jsx'

const mobileNavItems = [
  { to: '/', label: 'Home', icon: LayoutDashboard },
  { to: '/members', label: 'Members', icon: Users },
  { to: '/chat', label: 'Chat', icon: MessageSquare, isChat: true },
  { to: '/wars', label: 'Wars', icon: Swords },
  { to: '/bases', label: 'Bases', icon: HomeIcon }
]

export default function MobileNav() {
  const { threads } = useChat()
  const dmUnread = threads.reduce((acc, t) => acc + (t.unread || 0), 0)
  const { visible } = useMobileNav()

  // Hidden state: AppLayout forces the nav hidden on /chat (and any
  // other full-screen pages). Otherwise always visible.
  if (!visible) return null

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-clan-surface/80 backdrop-blur-xl border-t border-clan-border safe-bottom">
      <div className="flex justify-around items-center h-14">
        {mobileNavItems.map(({ to, label, icon: Icon, isChat }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'relative flex flex-col items-center justify-center gap-0.5 px-2 py-1 text-[10px] font-medium transition-colors',
                isActive ? 'text-clan-accent' : 'text-clan-muted'
              )
            }
          >
            <Icon className="w-5 h-5" />
            {label}
            {isChat && dmUnread > 0 && (
              <span className="absolute top-0 right-1 min-w-[16px] h-4 px-1 rounded-full bg-clan-danger text-white text-[9px] font-bold flex items-center justify-center">
                {dmUnread}
              </span>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

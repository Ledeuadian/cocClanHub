import { useState, useMemo, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Search, Bell, Sun, Moon, Shield, MessageCircle, Hash, User, Users, ArrowLeft } from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'
import { useTheme } from '../../context/ThemeContext.jsx'
import { useChat } from '../../context/ChatContext.jsx'
import { useClan } from '../../context/ClanContext.jsx'
import Avatar from '../ui/Avatar.jsx'
import { timeAgo } from '../../lib/utils.js'
import { adminApi } from '../../services/adminApi.js'

export default function Topbar() {
  const { user, profile, signOut } = useAuth()
  const { theme, toggle } = useTheme()
  const { threads, channels, members, markThreadRead } = useChat()
  const { clan } = useClan()
  const navigate = useNavigate()
  const location = useLocation()
  // When on /chat, the mobile nav is hidden — show a back button instead
  const isChatPage = location.pathname === '/chat' || location.pathname.startsWith('/chat/')
  const [showMenu, setShowMenu] = useState(false)
  const [showNotifs, setShowNotifs] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)

  // Poll pending count every 30s (only for admins)
  useEffect(() => {
    if (!profile?.is_admin) return
    let cancelled = false
    const tick = async () => {
      try {
        const { count } = await adminApi.getPendingCount()
        if (!cancelled) setPendingCount(count || 0)
      } catch (e) { /* ignore 403s — non-admins get rejected */ }
    }
    tick()
    const interval = setInterval(tick, 30_000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [profile?.is_admin])

  // Aggregate all unread DMs into a list, sorted by recency
  const dmUnread = useMemo(() =>
    threads
      .filter(t => t.unread > 0)
      .map(t => ({ ...t, user: members.find(m => m.id === t.userId) }))
      .filter(t => t.user),
    [threads, members]
  )

  const handleSelectNotif = (userId) => {
    markThreadRead(userId)
    setShowNotifs(false)
    navigate('/chat')
  }

  return (
    <header className="sticky top-0 z-40 bg-clan-surface/60 backdrop-blur-xl border-b border-clan-border safe-top">
      <div className="flex items-center justify-between px-4 py-3">
        {/* Mobile logo — or back arrow on /chat (where the nav is hidden) */}
        <div className="flex items-center gap-2 md:hidden">
          {isChatPage ? (
            <button
              onClick={() => navigate(-1)}
              className="btn-ghost !p-2"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          ) : clan?.badgeUrls?.small ? (
            <img src={clan.badgeUrls.small} alt={clan.name} className="w-6 h-6 rounded" />
          ) : (
            <Shield className="w-6 h-6 text-clan-accent" />
          )}
          <span className="font-display text-base font-bold truncate">
            {isChatPage ? 'Chat' : (clan?.name || 'Clan Hub')}
          </span>
        </div>

        {/* Search bar */}
        <div className="hidden md:flex items-center gap-2 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-clan-muted" />
            <input
              type="text"
              placeholder="Search members, bases, strategies..."
              className="input pl-9"
            />
          </div>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          <button onClick={toggle} className="btn-ghost !p-2">
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>

          {/* Notifications / DM bell */}
          <div className="relative">
            <button
              onClick={() => setShowNotifs(!showNotifs)}
              className="btn-ghost !p-2 relative"
              title="Notifications"
            >
              <Bell className="w-5 h-5" />
              {dmUnread.length + pendingCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-clan-danger text-white text-[10px] font-bold flex items-center justify-center">
                  {dmUnread.length + pendingCount}
                </span>
              )}
              {pendingCount > 0 && (
                <span className="absolute -bottom-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-clan-bg">
                  <Users className="w-2.5 h-2.5" />
                </span>
              )}
            </button>

            {showNotifs && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowNotifs(false)} />
                <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-clan-card border border-clan-border rounded-xl shadow-2xl z-50 animate-fade-in">
                  <div className="p-3 border-b border-clan-border flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Direct Messages</h3>
                    {dmUnread.length > 0 && (
                      <span className="badge bg-clan-accent text-clan-darker">{dmUnread.length} new</span>
                    )}
                  </div>

                  {dmUnread.length === 0 ? (
                    <div className="p-6 text-center text-clan-muted text-sm">
                      <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      No new messages
                    </div>
                  ) : (
                    <div className="p-1">
                      {dmUnread.map(t => (
                        <button
                          key={t.id}
                          onClick={() => handleSelectNotif(t.userId)}
                          className="flex items-start gap-2 w-full p-2 rounded-lg hover:bg-clan-surface transition-colors text-left"
                        >
                          <Avatar fallback={t.user.name[0]} size="sm" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <p className="text-sm font-semibold truncate">{t.user.name}</p>
                              <span className="text-[10px] text-clan-muted shrink-0">{t.lastTime}</span>
                            </div>
                            <p className="text-xs text-clan-muted truncate">{t.lastMessage}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Pending approvals — admin only */}
                  {pendingCount > 0 && (
                    <button
                      onClick={() => { setShowNotifs(false); navigate('/admin') }}
                      className="w-full flex items-center gap-2 p-2 m-1 rounded-lg bg-amber-900/20 border border-amber-700/40 hover:bg-amber-900/40 transition-colors text-left"
                    >
                      <Users className="w-4 h-4 text-amber-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-amber-200">
                          {pendingCount} pending registration{pendingCount > 1 ? 's' : ''}
                        </p>
                        <p className="text-xs text-amber-300/70">Click to review</p>
                      </div>
                    </button>
                  )}

                  <div className="p-2 border-t border-clan-border">
                    <button
                      onClick={() => { setShowNotifs(false); navigate('/chat') }}
                      className="w-full text-center text-xs text-clan-accent hover:text-clan-gold font-medium py-1.5"
                    >
                      Open chat →
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* User avatar / menu */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="flex items-center gap-2 rounded-lg p-1 hover:bg-clan-card transition-colors"
            >
              {user ? (
                <Avatar
                  src={profile?.avatar_url}
                  fallback={profile?.display_name?.[0] || user.email?.[0]?.toUpperCase() || '?'}
                  size="sm"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-clan-card flex items-center justify-center text-clan-muted text-sm font-bold">
                  ?
                </div>
              )}
            </button>

            {showMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 mt-2 w-48 bg-clan-card border border-clan-border rounded-lg shadow-xl z-50 animate-fade-in">
                  <div className="p-2">
                    <button
                      onClick={() => { navigate('/profile'); setShowMenu(false) }}
                      className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-clan-surface transition-colors"
                    >
                      My Profile
                    </button>
                    <button
                      onClick={() => { navigate('/settings'); setShowMenu(false) }}
                      className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-clan-surface transition-colors"
                    >
                      Settings
                    </button>
                    {user ? (
                      <button
                        onClick={() => { signOut(); setShowMenu(false); navigate('/login') }}
                        className="w-full text-left px-3 py-2 text-sm rounded-md text-clan-danger hover:bg-clan-surface transition-colors"
                      >
                        Sign Out
                      </button>
                    ) : (
                      <button
                        onClick={() => { navigate('/login'); setShowMenu(false) }}
                        className="w-full text-left px-3 py-2 text-sm rounded-md text-clan-accent hover:bg-clan-surface transition-colors"
                      >
                        Sign In
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

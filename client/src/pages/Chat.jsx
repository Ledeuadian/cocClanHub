import { useState, useEffect, useRef, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Hash, Send, Paperclip, Smile, Search, Plus,
  MessageCircle, Phone, Video, Info, ArrowLeft
} from 'lucide-react'
import { useChat } from '../context/ChatContext.jsx'
import { useMobileNav } from '../context/MobileNavContext.jsx'
import Avatar from '../components/ui/Avatar.jsx'
import RoleBadge from '../components/ui/RoleBadge.jsx'
import { cn } from '../lib/utils.js'

// ── Single conversation view (reused for channels + DMs) ──────

function ConversationView({ kind, id, title, subtitle, onBack }) {
  const { me, getChannelMessages, getDMMessages, sendChannelMessage, sendDM, members } = useChat()
  const { hide: hideMobileNav, show: showMobileNav } = useMobileNav()
  const [input, setInput] = useState('')
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  const conversation = useMemo(() => {
    if (kind === 'channel') return getChannelMessages(id)
    return getDMMessages(id)
  }, [kind, id, getChannelMessages, getDMMessages])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversation])

  // Auto-hide the bottom nav when the chat input is focused (on mobile).
  // Restores the nav when focus is lost.
  const handleInputFocus = () => hideMobileNav()
  const handleInputBlur = () => showMobileNav()

  const handleSend = (e) => {
    e.preventDefault()
    if (!input.trim()) return
    if (kind === 'channel') sendChannelMessage(id, input)
    else sendDM(id, input)
    setInput('')
  }

  const otherUser = kind === 'dm' ? members.find(m => m.id === id) : null

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-clan-border bg-clan-surface/50 backdrop-blur">
        <button onClick={onBack} className="md:hidden btn-ghost !p-2" aria-label="Back">
          <ArrowLeft className="w-5 h-5" />
        </button>
        {kind === 'channel' ? (
          <>
            <Hash className="w-5 h-5 text-clan-muted" />
            <h1 className="font-semibold">{title}</h1>
            {subtitle && <span className="text-xs text-clan-muted hidden sm:inline">· {subtitle}</span>}
          </>
        ) : (
          <>
            <Avatar fallback={otherUser?.name?.[0]} size="sm" />
            <div>
              <h1 className="font-semibold text-sm">{otherUser?.name}</h1>
              <p className="text-xs text-clan-muted">
                {otherUser?.online
                  ? <span className="text-clan-success">● Online</span>
                  : 'Offline'}
              </p>
            </div>
          </>
        )}
        <div className="ml-auto flex items-center gap-1">
          <button className="btn-ghost !p-2" title="Voice call"><Phone className="w-5 h-5" /></button>
          <button className="btn-ghost !p-2" title="Video call"><Video className="w-5 h-5" /></button>
          <button className="btn-ghost !p-2" title="Info"><Info className="w-5 h-5" /></button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
        {conversation.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-clan-muted">
            {kind === 'channel' ? (
              <>
                <Hash className="w-12 h-12 mb-2 opacity-50" />
                <p className="text-sm">No messages in #{title} yet. Say hi!</p>
              </>
            ) : (
              <>
                <Avatar fallback={otherUser?.name?.[0]} size="xl" />
                <p className="text-sm mt-3">{otherUser?.name}</p>
                <p className="text-xs">Start a private conversation</p>
              </>
            )}
          </div>
        ) : (
          <>
            {conversation.map((msg, i) => {
              const isMe = msg.authorId === me.id || msg.fromId === me.id
              const prev = conversation[i - 1]
              const showAvatar = !isMe && (!prev || prev.author !== msg.author)
              const showHeader = !isMe && showAvatar

              return (
                <div
                  key={msg.id}
                  className={cn(
                    'flex gap-2 animate-slide-up',
                    isMe ? 'flex-row-reverse' : 'flex-row'
                  )}
                >
                  {!isMe ? (
                    showAvatar
                      ? <Avatar fallback={msg.author?.[0]} size="sm" />
                      : <div className="w-8" />
                  ) : (
                    <div className="w-8" />
                  )}

                  <div className={cn('flex flex-col max-w-[75%]', isMe && 'items-end')}>
                    {showHeader && (
                      <div className="flex items-center gap-2 mb-0.5 px-1">
                        <span className="text-sm font-semibold text-clan-text">{msg.author}</span>
                        <span className="text-[10px] text-clan-muted">{msg.time}</span>
                      </div>
                    )}
                    <div
                      className={cn(
                        'px-3 py-2 rounded-2xl text-sm break-words',
                        isMe
                          ? 'bg-clan-accent text-clan-darker rounded-tr-sm'
                          : 'bg-clan-surface text-clan-text border border-clan-border rounded-tl-sm'
                      )}
                    >
                      {msg.text}
                    </div>
                    {isMe && i === conversation.length - 1 && (
                      <span className="text-[10px] text-clan-muted mt-0.5 px-1">{msg.time}</span>
                    )}
                  </div>
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={handleSend}
        className="p-4 pb-4 md:pb-4 border-t border-clan-border bg-clan-surface/50 safe-bottom"
      >
        <div className="flex items-center gap-2">
          <button type="button" className="btn-ghost !p-2" title="Attach">
            <Paperclip className="w-5 h-5" />
          </button>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            placeholder={kind === 'channel' ? `Message #${title}...` : `Message ${otherUser?.name || 'user'}...`}
            className="input flex-1"
          />
          <button type="button" className="btn-ghost !p-2" title="Emoji">
            <Smile className="w-5 h-5" />
          </button>
          <button type="submit" className="btn-primary !p-2" disabled={!input.trim()}>
            <Send className="w-5 h-5" />
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Main Chat page ────────────────────────────────────────────

export default function Chat() {
  const { channels, threads, members, markThreadRead, openDMWith } = useChat()
  const [searchParams, setSearchParams] = useSearchParams()
  // Default to the first available channel, or null if none loaded yet.
  const [activeView, setActiveView] = useState(() => ({ kind: 'channel', id: channels[0]?.id || null }))
  const [showNewDM, setShowNewDM] = useState(false)
  const [search, setSearch] = useState('')
  // On mobile: show the channel list (false) or the conversation (true)?
  const [mobileShowChat, setMobileShowChat] = useState(false)

  // Deep-link: /chat?dm=#TAG  -> auto-open that DM thread.
  // Match by canonical (uppercase, no leading #) tag so URLs from
  // various places (Members page, profile, etc.) all resolve the IGN.
  useEffect(() => {
    const dmTagRaw = searchParams.get('dm')
    if (!dmTagRaw) return
    const dmTag = `#${dmTagRaw.replace(/^#/, '').toUpperCase()}`
    const known = members.find((m) => (m.tag || '').replace(/^#/, '').toUpperCase() === dmTag.slice(1))
    const member = known || { name: 'Unknown player', tag: dmTag, role: 'member' }
    openDMWith(member)
    setActiveView({ kind: 'dm', id: dmTag })
    setMobileShowChat(true)
    // Strip the param so re-navigating works
    const next = new URLSearchParams(searchParams)
    next.delete('dm')
    setSearchParams(next, { replace: true })
  }, [searchParams, members, openDMWith, setSearchParams])

  const openView = (view) => {
    setActiveView(view)
    setMobileShowChat(true)   // on mobile, navigate to the conversation view
  }

  const closeView = () => {
    setMobileShowChat(false)  // on mobile, go back to the channel list
  }

  const handleSelectThread = (userId) => {
    markThreadRead(userId)
    openView({ kind: 'dm', id: userId })
  }

  const handleNewDM = (userId) => {
    setShowNewDM(false)
    openView({ kind: 'dm', id: userId })
  }

  // Read mobile nav visibility so the chat container can expand when
  // the nav is collapsed (e.g. user is typing a long message)
  const { visible: mobileNavVisible } = useMobileNav()

  return (
    <div
      className={cn(
        // Fill the flex parent (GsapScrollScene's <main>), which already
        // excludes the Topbar height. Computing against 100vh double-counts
        // the topbar and pushes the input form below the viewport.
        // min-h-0 lets the flex chain actually shrink to fit.
        'flex overflow-hidden min-h-0 h-full'
      )}
    >
      {/* Sidebar: Channels + DMs — hidden on mobile when a conversation is open */}
      <aside
        className={cn(
          'bg-clan-surface/40 backdrop-blur-xl border-r border-clan-border flex-col min-w-0',
          // Mobile: hide if a conversation is open. Desktop: always show as 288px sidebar.
          mobileShowChat ? 'hidden md:flex md:w-72' : 'flex w-full md:w-72'
        )}
      >
        {/* Search */}
        <div className="p-3 border-b border-clan-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-clan-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search chats..."
              className="input pl-9 !py-1.5"
            />
          </div>
        </div>

        {/* Channels */}
        <div className="px-3 pt-3 pb-1 flex items-center justify-between">
          <h2 className="font-display text-xs font-bold text-clan-muted uppercase tracking-wider">Channels</h2>
          <button className="btn-ghost !p-1" title="Browse channels">
            <Plus className="w-3 h-3" />
          </button>
        </div>
        <nav className="px-2 space-y-0.5 max-h-[35%] overflow-y-auto">
          {channels
            .filter(c => !search || c.name.includes(search.toLowerCase()))
            .map((ch) => (
            <button
              key={ch.id}
              onClick={() => openView({ kind: 'channel', id: ch.id })}
              className={cn(
                'flex items-center gap-2 w-full px-3 py-1.5 rounded-lg text-sm transition-colors',
                activeView.kind === 'channel' && activeView.id === ch.id
                  ? 'bg-clan-card text-clan-text'
                  : 'text-clan-muted hover:text-clan-text hover:bg-clan-card/50'
              )}
            >
              <Hash className="w-4 h-4 shrink-0" />
              <span className="flex-1 text-left truncate">{ch.name}</span>
              {ch.unread > 0 && (
                <span className="badge bg-clan-danger text-white !px-1.5 !text-[10px]">
                  {ch.unread}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Direct Messages */}
        <div className="px-3 pt-4 pb-1 flex items-center justify-between">
          <h2 className="font-display text-xs font-bold text-clan-muted uppercase tracking-wider">Direct Messages</h2>
          <button onClick={() => setShowNewDM(true)} className="btn-ghost !p-1" title="New DM">
            <Plus className="w-3 h-3" />
          </button>
        </div>
        <nav className="flex-1 px-2 space-y-0.5 overflow-y-auto pb-2">
          {threads
            .filter(t => {
              if (!search) return true
              const m = members.find(mm => mm.id === t.userId)
              return m?.name.toLowerCase().includes(search.toLowerCase())
            })
            .map((thread) => {
            const user = members.find(m => m.id === thread.userId)
            if (!user) return null
            return (
              <button
                key={thread.id}
                onClick={() => handleSelectThread(thread.userId)}
                className={cn(
                  'flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-sm transition-colors',
                  activeView.kind === 'dm' && activeView.id === thread.userId
                    ? 'bg-clan-card text-clan-text'
                    : 'text-clan-muted hover:text-clan-text hover:bg-clan-card/50'
                )}
              >
                <div className="relative shrink-0">
                  <Avatar fallback={user.name[0]} size="sm" />
                  {user.online && (
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-clan-success border-2 border-clan-surface rounded-full" />
                  )}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-medium truncate">{user.name}</p>
                  <p className="text-xs text-clan-muted truncate">{thread.lastMessage}</p>
                </div>
                <div className="flex flex-col items-end gap-0.5 shrink-0">
                  <span className="text-[10px] text-clan-muted">{thread.lastTime}</span>
                  {thread.unread > 0 && (
                    <span className="badge bg-clan-accent text-clan-darker !px-1.5 !text-[10px]">
                      {thread.unread}
                    </span>
                  )}
                </div>
              </button>
            )
          })}

          {threads.length === 0 && (
            <div className="text-center py-6 text-clan-muted text-xs">
              <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
              No DMs yet
            </div>
          )}
        </nav>
      </aside>

      {/* Active conversation — only show if a channel/DM is selected */}
      {activeView ? (
        <div className={cn('flex-1 flex flex-col min-w-0', !mobileShowChat && 'hidden md:flex')}>
          {activeView.kind === 'channel' ? (
            <ConversationView
              kind="channel"
              id={activeView.id}
              title={channels.find(c => c.id === activeView.id)?.name || ''}
              subtitle={`${channels.find(c => c.id === activeView.id)?.name || ''} channel`}
              onBack={closeView}
            />
          ) : (
            <ConversationView
              kind="dm"
              id={activeView.id}
              title={members.find(m => m.id === activeView.id)?.name || ''}
              onBack={closeView}
            />
          )}
        </div>
      ) : (
        <div className="hidden md:flex flex-1 items-center justify-center bg-clan-bg/30">
          <div className="text-center text-clan-muted">
            <Hash className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Select a channel or DM to start chatting</p>
          </div>
        </div>
      )}

      {/* New DM modal */}
      {showNewDM && (
        <NewDMDialog
          members={members}
          onSelect={handleNewDM}
          onClose={() => setShowNewDM(false)}
        />
      )}
    </div>
  )
}

// ── New DM picker ─────────────────────────────────────────────

function NewDMDialog({ members, onSelect, onClose }) {
  const [search, setSearch] = useState('')
  // Search by in-game name (IGN). We don't show the player tag anywhere
  // in the DM UI, so we don't search by it either.
  const filtered = members.filter(m =>
    (m.name || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="card max-w-md w-full max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="section-title">New Direct Message</h2>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-clan-muted" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search members..."
            className="input pl-9"
            autoFocus
          />
        </div>
        <div className="flex-1 overflow-y-auto space-y-1">
          {filtered.map(m => (
            <button
              key={m.id}
              onClick={() => onSelect(m.id)}
              className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-clan-surface transition-colors text-left"
            >
              <div className="relative shrink-0">
                <Avatar fallback={m.name?.[0]} size="md" />
                {m.online && (
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-clan-success border-2 border-clan-surface rounded-full" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                {/* Show only the in-game name (IGN). The COC player tag
                    (#ABCD1234) is intentionally omitted here — DMs use the IGN. */}
                <p className="text-sm font-semibold truncate">{m.name}</p>
              </div>
              <RoleBadge role={m.role} />
            </button>
          ))}
        </div>
        <button onClick={onClose} className="btn-secondary mt-3">Cancel</button>
      </div>
    </div>
  )
}

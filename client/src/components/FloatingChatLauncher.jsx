/**
 * FloatingChatLauncher — a persistent Messenger-style floating button
 * that sits over every page (except /chat itself). Click to open a
 * popover panel with the conversation list + active thread, without
 * a full route change.
 *
 * Features:
 *   - Round FAB (bottom-right) with unread badge
 *   - Popover panel: thread list (channels + DMs), inline conversation
 *   - Send messages directly from the popover (uses ChatContext)
 *   - Marks thread as read on open (decrements badge)
 *   - Hidden on /chat (avoids duplicate UI)
 *   - Mobile: panel is near-fullscreen; Desktop: 384px popover
 *   - Click outside or X to close
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  MessageCircle,
  X,
  Send,
  Hash,
  ArrowLeft,
  Search,
  Users,
} from 'lucide-react'
import { useChat } from '../context/ChatContext.jsx'
import { cn } from '../lib/utils.js'
import Avatar from './ui/Avatar.jsx'

// ── Main component ─────────────────────────────────────────────

export default function FloatingChatLauncher() {
  const location = useLocation()

  // Don't render on the full chat page — it has its own UI
  if (location.pathname.startsWith('/chat')) return null

  return <LauncherInner />
}

function LauncherInner() {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState(null) // null = list, { kind:'channel'|'dm', id } = conversation
  const [bubblePos, setBubblePos] = useState(null) // shared with panel for anchoring

  return (
    <>
      <LauncherButton
        open={open}
        onToggle={() => { setOpen(o => !o); setView(null) }}
        onPosChange={setBubblePos}
      />
      {open && (
        <LauncherPanel
          view={view}
          onView={setView}
          onClose={() => { setOpen(false); setView(null) }}
          bubblePos={bubblePos}
        />
      )}
    </>
  )
}

// ── Floating Action Button (draggable) ────────────────────────
//
// Supports both mouse and touch dragging. The bubble can be placed
// anywhere on screen. Distinguishes drag from click:
//   • pointer moves < 6px  → treated as a click → toggles popover
//   • pointer moves ≥ 6px  → treated as a drag → repositions bubble
//
// Position persists to localStorage so the bubble stays where the
// user left it across page navigations and reloads.
//
// Edge-snapping: when released, the bubble snaps to the nearest
// left/right edge for a clean look (like Facebook Messenger).

const BUBBLE_SIZE = 56 // w-14 h-14
const DRAG_THRESHOLD = 6 // px — below this it's a click, not a drag
const EDGE_MARGIN = 16 // px from screen edge after snap
const TOP_MARGIN = 80 // px — keep below the Topbar
const BOTTOM_MARGIN = 90 // px — keep above the mobile nav
const SNAP_ANIM_MS = 300

const POS_STORAGE_KEY = 'coc-chat-bubble-pos'

/** Load saved position from localStorage (returns default if none). */
function loadSavedPos() {
  try {
    const raw = localStorage.getItem(POS_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (typeof parsed.x === 'number' && typeof parsed.y === 'number') return parsed
    }
  } catch { /* */ }
  // Default: bottom-right corner
  return { x: window.innerWidth - BUBBLE_SIZE - EDGE_MARGIN, y: window.innerHeight - BUBBLE_SIZE - BOTTOM_MARGIN }
}

/** Clamp position so the bubble stays within the viewport. */
function clampPos(x, y) {
  const maxX = window.innerWidth - BUBBLE_SIZE
  const maxY = window.innerHeight - BUBBLE_SIZE
  return {
    x: Math.max(EDGE_MARGIN, Math.min(x, maxX - EDGE_MARGIN)),
    y: Math.max(TOP_MARGIN, Math.min(y, maxY - BOTTOM_MARGIN + BUBBLE_SIZE))
  }
}

/** Snap X to the nearest left/right edge. */
function snapToEdge(x, y) {
  const centerX = x + BUBBLE_SIZE / 2
  const snapLeft = centerX < window.innerWidth / 2
  const snappedX = snapLeft
    ? EDGE_MARGIN
    : window.innerWidth - BUBBLE_SIZE - EDGE_MARGIN
  return { x: snappedX, y }
}

function LauncherButton({ open, onToggle, onPosChange }) {
  const { threads, channels } = useChat()
  const btnRef = useRef(null)

  // Position state — initialized from localStorage on mount (client-only).
  const [pos, setPos] = useState(null)

  // Drag tracking refs (no re-render needed during drag)
  const dragState = useRef({
    dragging: false,
    moved: false,         // true once movement exceeds threshold
    startX: 0, startY: 0, // pointer position at drag start
    baseX: 0, baseY: 0,   // bubble position at drag start
    pointerId: null,
  })

  // "snapping" animation state — when true, CSS transition is enabled
  const [snapping, setSnapping] = useState(false)

  // Initialize position on mount
  useEffect(() => {
    const initial = loadSavedPos()
    setPos(initial)
    onPosChange?.(initial)
  }, [onPosChange])

  // Persist position whenever it changes (skip during active drag)
  const savePos = useCallback((p) => {
    try { localStorage.setItem(POS_STORAGE_KEY, JSON.stringify(p)) } catch { /* */ }
  }, [])

  // Re-clamp on viewport resize (e.g. orientation change)
  useEffect(() => {
    function onResize() {
      if (!pos) return
      const clamped = clampPos(pos.x, pos.y)
      if (clamped.x !== pos.x || clamped.y !== pos.y) {
        setSnapping(true)
        setPos(clamped)
        savePos(clamped)
        setTimeout(() => setSnapping(false), SNAP_ANIM_MS)
      }
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [pos, savePos])

  // ── Pointer handlers (unified mouse + touch via Pointer Events) ──

  const onPointerDown = useCallback((e) => {
    // Only respond to primary button (left click / single touch)
    if (e.button !== undefined && e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragState.current = {
      dragging: true,
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
      baseX: pos?.x ?? 0,
      baseY: pos?.y ?? 0,
      pointerId: e.pointerId,
    }
  }, [pos])

  const onPointerMove = useCallback((e) => {
    const ds = dragState.current
    if (!ds.dragging || e.pointerId !== ds.pointerId) return

    const dx = e.clientX - ds.startX
    const dy = e.clientY - ds.startY

    // Check if we've crossed the drag threshold
    if (!ds.moved && Math.abs(dx) + Math.abs(dy) > DRAG_THRESHOLD) {
      ds.moved = true
      setSnapping(false) // disable transition during free-drag
    }

    if (ds.moved) {
      e.preventDefault() // prevent scrolling on touch
      const newX = ds.baseX + dx
      const newY = ds.baseY + dy
      const clamped = clampPos(newX, newY)
      setPos(clamped)
      onPosChange?.(clamped)
    }
  }, [onPosChange])

  const onPointerUp = useCallback((e) => {
    const ds = dragState.current
    if (!ds.dragging || e.pointerId !== ds.pointerId) return

    try { e.currentTarget.releasePointerCapture(e.pointerId) } catch { /* */ }
    dragState.current.dragging = false

    if (ds.moved) {
      // It was a drag — snap to nearest edge
      setPos((current) => {
        const snapped = snapToEdge(current.x, current.y)
        savePos(snapped)
        onPosChange?.(snapped)
        return snapped
      })
      setSnapping(true)
      setTimeout(() => setSnapping(false), SNAP_ANIM_MS)
    } else {
      // It was a click (no significant movement) — toggle popover
      onToggle()
    }
  }, [onToggle, savePos, onPosChange])

  const totalUnread = useMemo(() => {
    const dmUnread   = threads.reduce((n, t) => n + (t.unread || 0), 0)
    const chanUnread = channels.reduce((n, c) => n + (c.unread || 0), 0)
    return dmUnread + chanUnread
  }, [threads, channels])

  // Don't render until position is initialized (avoids flash at 0,0)
  if (!pos) return null

  return (
    <button
      ref={btnRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        transition: snapping ? `left ${SNAP_ANIM_MS}ms ease-out, top ${SNAP_ANIM_MS}ms ease-out` : 'none',
        // touch-action: none prevents the browser from interpreting
        // the drag as a scroll/pan gesture on mobile.
        touchAction: 'none',
      }}
      className={cn(
        'fixed z-[90] w-14 h-14 rounded-full select-none',
        'bg-gradient-to-br from-clan-accent to-clan-gold-dark',
        'text-clan-darker shadow-2xl shadow-clan-accent/40',
        'flex items-center justify-center cursor-pointer',
        'hover:scale-110 active:scale-95',
        open && 'rotate-12'
      )}
      aria-label={open ? 'Close chat' : 'Open chat'}
    >
      {open ? (
        <X className="w-6 h-6 pointer-events-none" />
      ) : (
        <MessageCircle className="w-6 h-6 pointer-events-none" fill="currentColor" />
      )}

      {/* Unread badge */}
      {!open && totalUnread > 0 && (
        <span
          className={cn(
            'absolute -top-1 -right-1 min-w-[20px] h-5 px-1',
            'rounded-full bg-clan-danger text-white',
            'text-[10px] font-bold flex items-center justify-center',
            'border-2 border-clan-bg animate-pulse-slow pointer-events-none'
          )}
        >
          {totalUnread > 99 ? '99+' : totalUnread}
        </span>
      )}

      {/* Online pulse ring (decorative) */}
      {!open && totalUnread > 0 && (
        <span className="absolute inset-0 rounded-full bg-clan-accent animate-ping opacity-20 pointer-events-none" />
      )}
    </button>
  )
}

// ── Popover panel (the chat window) ────────────────────────────
//
// Anchors near the bubble. On mobile (< 768px) it's near-fullscreen
// regardless of bubble position. On desktop it appears next to the
// bubble: if the bubble is on the left half → panel opens to the
// right; if on the right half → panel opens to the left. Vertically
// it opens above the bubble unless there's no room, then below.

const PANEL_WIDTH = 384
const PANEL_HEIGHT_DESKTOP = 600
const PANEL_GAP = 12 // px between bubble and panel

function LauncherPanel({ view, onView, onClose, bubblePos }) {
  const panelRef = useRef(null)

  // Close on click outside / Escape
  useEffect(() => {
    function handleClick(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        // Also ignore the FAB itself (it has its own toggle)
        const fab = e.target.closest('[aria-label="Open chat"], [aria-label="Close chat"]')
        if (!fab) onClose()
      }
    }
    function handleEsc(e) {
      if (e.key === 'Escape') onClose()
    }
    // Delay to avoid the same click that opened the panel
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClick)
      document.addEventListener('touchstart', handleClick)
    }, 0)
    document.addEventListener('keydown', handleEsc)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('touchstart', handleClick)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [onClose])

  // Compute panel position from the bubble position
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768
  const panelStyle = {}
  if (!isMobile && bubblePos) {
    const bubbleCenterX = bubblePos.x + BUBBLE_SIZE / 2
    const openRight = bubbleCenterX < window.innerWidth / 2

    if (openRight) {
      // Panel to the right of the bubble
      panelStyle.left = `${bubblePos.x + BUBBLE_SIZE + PANEL_GAP}px`
    } else {
      // Panel to the left of the bubble
      panelStyle.left = `${bubblePos.x - PANEL_WIDTH - PANEL_GAP}px`
    }

    // Vertical: try to top-align with the bubble, but keep within viewport
    const desiredTop = bubblePos.y - 20
    const maxTop = window.innerHeight - PANEL_HEIGHT_DESKTOP - 16
    panelStyle.top = `${Math.max(16, Math.min(desiredTop, maxTop))}px`
    panelStyle.height = `${Math.min(PANEL_HEIGHT_DESKTOP, window.innerHeight - 32)}px`
  }

  return (
    <div
      ref={panelRef}
      style={panelStyle}
      className={cn(
        'fixed z-[95] flex flex-col overflow-hidden',
        'bg-clan-surface/95 backdrop-blur-xl',
        'border border-clan-border rounded-2xl shadow-2xl shadow-black/40',
        'animate-slide-up',
        // Mobile: near full-screen with safe areas
        isMobile
          ? 'bottom-[88px] right-3 left-3 top-20'
          : 'w-[384px] max-h-[75vh]'
      )}
    >
      {view ? (
        <PopoverConversation view={view} onBack={() => onView(null)} />
      ) : (
        <PopoverThreadList onPick={onView} onClose={onClose} />
      )}
    </div>
  )
}

// ── Thread list (channels + DMs) ───────────────────────────────

function PopoverThreadList({ onPick, onClose }) {
  const { channels, threads, members, markThreadRead } = useChat()
  const [search, setSearch] = useState('')

  const filteredChannels = channels.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase())
  )

  const filteredThreads = threads.filter(t => {
    if (!search) return true
    const m = members.find(mm => mm.id === t.userId)
    return m?.name?.toLowerCase().includes(search.toLowerCase())
  })

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-clan-border bg-clan-card/50">
        <MessageCircle className="w-5 h-5 text-clan-accent" />
        <h2 className="font-display font-semibold text-clan-text flex-1">Chats</h2>
        <button onClick={onClose} className="btn-ghost !p-2" aria-label="Close">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Search */}
      <div className="p-3 border-b border-clan-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-clan-muted" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search..."
            className="input pl-9 !py-1.5"
          />
        </div>
      </div>

      {/* Scroll area */}
      <div className="flex-1 overflow-y-auto">
        {/* Channels */}
        {filteredChannels.length > 0 && (
          <div className="px-2 pt-3 pb-1">
            <p className="px-2 text-[10px] font-bold text-clan-muted uppercase tracking-wider flex items-center gap-1">
              <Hash className="w-3 h-3" /> Channels
            </p>
          </div>
        )}
        <div className="px-2 space-y-0.5">
          {filteredChannels.map(ch => (
            <button
              key={ch.id}
              onClick={() => onPick({ kind: 'channel', id: ch.id })}
              className="flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-clan-card/50 transition-colors text-left"
            >
              <div className="w-9 h-9 rounded-full bg-clan-card flex items-center justify-center shrink-0">
                <Hash className="w-4 h-4 text-clan-muted" />
              </div>
              <span className="flex-1 text-sm font-medium text-clan-text truncate">
                {ch.name}
              </span>
              {ch.unread > 0 && (
                <span className="badge bg-clan-danger text-white !text-[10px] !px-1.5">
                  {ch.unread}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* DMs */}
        {filteredThreads.length > 0 && (
          <div className="px-2 pt-4 pb-1">
            <p className="px-2 text-[10px] font-bold text-clan-muted uppercase tracking-wider flex items-center gap-1">
              <Users className="w-3 h-3" /> Direct Messages
            </p>
          </div>
        )}
        <div className="px-2 space-y-0.5 pb-2">
          {filteredThreads.map(thread => {
            const user = members.find(m => m.id === thread.userId)
            return (
              <button
                key={thread.id}
                onClick={() => {
                  markThreadRead(thread.userId)
                  onPick({ kind: 'dm', id: thread.userId })
                }}
                className="flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-clan-card/50 transition-colors text-left"
              >
                <div className="relative shrink-0">
                  <Avatar fallback={user?.name?.[0] || '?'} size="sm" />
                  {user?.online && (
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-clan-success border-2 border-clan-surface rounded-full" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate text-clan-text">
                    {user?.name || thread.name || thread.userId}
                  </p>
                  <p className="text-xs text-clan-muted truncate">
                    {thread.lastMessage || 'Start chatting'}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-0.5 shrink-0">
                  <span className="text-[10px] text-clan-muted">{thread.lastTime}</span>
                  {thread.unread > 0 && (
                    <span className="badge bg-clan-accent text-clan-darker !text-[10px] !px-1.5">
                      {thread.unread}
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {/* Empty state */}
        {filteredChannels.length === 0 && filteredThreads.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-clan-muted">
            <MessageCircle className="w-10 h-10 mb-2 opacity-40" />
            <p className="text-sm">No conversations found</p>
          </div>
        )}
      </div>
    </>
  )
}

// ── Inline conversation view ───────────────────────────────────

function PopoverConversation({ view, onBack }) {
  const {
    me,
    channels,
    members,
    getChannelMessages,
    getDMMessages,
    sendChannelMessage,
    sendDM,
    refreshDMs,
  } = useChat()

  const [input, setInput] = useState('')
  const messagesEndRef = useRef(null)

  const conversation = useMemo(() => {
    if (view.kind === 'channel') return getChannelMessages(view.id)
    return getDMMessages(view.id)
  }, [view, getChannelMessages, getDMMessages])

  // Re-fetch chat history from the DB when a conversation is opened — in
  // case realtime/polling missed anything while the panel was closed.
  useEffect(() => {
    refreshDMs()
  }, [view, refreshDMs])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversation])

  const handleSend = (e) => {
    e.preventDefault()
    if (!input.trim()) return
    if (view.kind === 'channel') sendChannelMessage(view.id, input)
    else sendDM(view.id, input)
    setInput('')
    // Belt-and-suspenders: also re-fetch from DB so the canonical row lands
    // in state even if the optimistic + ack path somehow diverged.
    refreshDMs()
  }

  const otherUser = view.kind === 'dm' ? members.find(m => m.id === view.id) : null
  const channel   = view.kind === 'channel' ? channels.find(c => c.id === view.id) : null
  const title     = view.kind === 'channel' ? `#${channel?.name || view.id}` : (otherUser?.name || view.id)

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-clan-border bg-clan-card/50">
        <button onClick={onBack} className="btn-ghost !p-2" aria-label="Back">
          <ArrowLeft className="w-4 h-4" />
        </button>
        {view.kind === 'dm' ? (
          <>
            <Avatar fallback={otherUser?.name?.[0] || '?'} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">{otherUser?.name || title}</p>
              <p className="text-[10px] text-clan-muted">
                {otherUser?.online
                  ? <span className="text-clan-success">● Online</span>
                  : 'Offline'}
              </p>
            </div>
          </>
        ) : (
          <>
            <Hash className="w-4 h-4 text-clan-muted" />
            <p className="font-semibold text-sm flex-1 truncate">{channel?.name || view.id}</p>
          </>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
        {conversation.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-clan-muted">
            <MessageCircle className="w-8 h-8 mb-1 opacity-40" />
            <p className="text-xs">No messages yet</p>
          </div>
        ) : (
          conversation.map((msg, i) => {
            // DM rows use COC tags in fromId; channel rows use authorId (auth uuid)
            const nt = (t) => (t || '').replace(/^#/, '').toUpperCase()
            const isMe = msg.authorId === me.id || (msg.fromId && me.tag && nt(msg.fromId) === nt(me.tag)) || msg.fromId === me.id
            const prev = conversation[i - 1]
            const showAvatar = !isMe && (!prev || prev.author !== msg.author)

            return (
              <div
                key={msg.id}
                className={cn('flex gap-1.5', isMe ? 'flex-row-reverse' : 'flex-row')}
              >
                {!isMe ? (
                  showAvatar
                    ? <Avatar fallback={msg.author?.[0] || '?'} size="sm" />
                    : <div className="w-8 shrink-0" />
                ) : (
                  <div className="w-8 shrink-0" />
                )}
                <div className={cn('flex flex-col max-w-[75%]', isMe && 'items-end')}>
                  {showAvatar && (
                    <span className="text-[10px] text-clan-muted mb-0.5 px-1">{msg.author}</span>
                  )}
                  <div
                    className={cn(
                      'px-3 py-1.5 rounded-2xl text-sm break-words',
                      isMe
                        ? 'bg-clan-accent text-clan-darker rounded-tr-sm'
                        : 'bg-clan-card text-clan-text border border-clan-border rounded-tl-sm'
                    )}
                  >
                    {msg.text}
                  </div>
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-2.5 border-t border-clan-border safe-bottom">
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={`Message ${title}...`}
            className="input flex-1 !py-1.5"
          />
          <button
            type="submit"
            className="btn-primary !p-2 shrink-0"
            disabled={!input.trim()}
            aria-label="Send"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  )
}

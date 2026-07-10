/**
 * Toast notification system + chat event bus
 *
 * Provides two things:
 * 1. Toast notifications (Messenger-style pop-ups in the corner)
 * 2. A simple in-memory event bus for chat messages, so the chat page
 *    and the toast system can communicate without wiring up Socket.IO yet.
 *
 * The toast for chat messages looks like:
 *   ┌─────────────────────────┐
 *   │ ◯ QueenSlayer           │  ← avatar + sender
 *   │ Anyone got a TH16 base? │  ← message preview (truncated)
 *   └─────────────────────────┘
 *
 * Auto-dismisses after 5s. Click to jump to the chat. Stack of 4 max.
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef
} from 'react'
import { useNavigate } from 'react-router-dom'
import { X, MessageCircle } from 'lucide-react'
import Avatar from '../components/ui/Avatar.jsx'

const ToastContext = createContext({
  toasts: [],
  toast: () => {},
  dismiss: () => {}
})

// ── Event bus for chat messages ─────────────────────────────────
// Any component can publish a message; any other can subscribe.
// In production this becomes a Socket.IO listener.
const chatBusListeners = new Set()

export function publishChatMessage(message) {
  chatBusListeners.forEach((fn) => {
    try { fn(message) } catch (e) { console.error('chatBus listener error', e) }
  })
}

export function subscribeChatMessages(fn) {
  chatBusListeners.add(fn)
  return () => chatBusListeners.delete(fn)
}

// ── Toast types ─────────────────────────────────────────────────
// Each toast is { id, type, title, body, avatar, action, createdAt }

const DEFAULT_DURATIONS = {
  default: 4000,
  chat: 5000,
  success: 3000,
  error: 5000,
  info: 4000,
  warning: 4000
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const counter = useRef(0)

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback((opts) => {
    const id = ++counter.current
    const t = {
      id,
      type: opts.type || 'default',
      title: opts.title,
      body: opts.body,
      avatar: opts.avatar,
      action: opts.action,          // e.g. { label, onClick, navigateTo }
      duration: opts.duration ?? DEFAULT_DURATIONS[opts.type] ?? DEFAULT_DURATIONS.default,
      createdAt: Date.now()
    }
    setToasts((prev) => {
      // Cap at 4 to keep UI calm
      const next = [...prev, t]
      return next.length > 4 ? next.slice(-4) : next
    })
    return id
  }, [])

  // Convenience helpers
  const api = {
    toasts,
    toast,
    dismiss,
    success: (title, body, opts = {}) => toast({ ...opts, type: 'success', title, body }),
    error:   (title, body, opts = {}) => toast({ ...opts, type: 'error',   title, body }),
    info:    (title, body, opts = {}) => toast({ ...opts, type: 'info',    title, body }),
    warning: (title, body, opts = {}) => toast({ ...opts, type: 'warning', title, body }),
    chat:    (msg, opts = {}) => toast({
      ...opts,
      type: 'chat',
      title: msg.author,
      body: msg.text,
      avatar: msg.avatar ?? msg.author?.[0] ?? '?',
      action: opts.action ?? {
        label: 'Reply',
        navigateTo: '/chat'
      }
    })
  }

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastViewport toasts={toasts} dismiss={dismiss} />
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)

// ── Viewport (rendered toasts) ───────────────────────────────────

function ToastViewport({ toasts, dismiss }) {
  return (
    <div
      className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none max-w-sm w-full"
      aria-live="polite"
      aria-atomic="true"
    >
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
      ))}
    </div>
  )
}

const TYPE_STYLES = {
  default: 'border-clan-border',
  success: 'border-green-500/40',
  error:   'border-red-500/40',
  info:    'border-blue-500/40',
  warning: 'border-amber-500/40',
  chat:    'border-clan-accent/40'
}

const TYPE_ACCENT = {
  success: 'bg-green-500',
  error:   'bg-red-500',
  info:    'bg-blue-500',
  warning: 'bg-amber-500',
  chat:    'bg-clan-accent',
  default: 'bg-clan-muted'
}

function ToastCard({ toast, onDismiss }) {
  const navigate = useNavigate()
  const [isExiting, setIsExiting] = useState(false)

  // Auto dismiss
  useEffect(() => {
    if (toast.duration <= 0) return
    const timer = setTimeout(() => {
      setIsExiting(true)
      setTimeout(onDismiss, 200) // wait for exit anim
    }, toast.duration)
    return () => clearTimeout(timer)
  }, [toast.duration, onDismiss])

  const handleAction = () => {
    if (toast.action?.navigateTo) navigate(toast.action.navigateTo)
    toast.action?.onClick?.()
    onDismiss()
  }

  const handleDismiss = () => {
    setIsExiting(true)
    setTimeout(onDismiss, 200)
  }

  return (
    <div
      className={`pointer-events-auto card !p-0 overflow-hidden border ${TYPE_STYLES[toast.type] || TYPE_STYLES.default} ${
        isExiting ? 'animate-fade-out' : 'animate-slide-in-right'
      }`}
      role="status"
    >
      {/* Accent bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${TYPE_ACCENT[toast.type] || TYPE_ACCENT.default}`} />

      <div className="flex items-start gap-3 p-3 pl-4">
        {/* Avatar (chat) or icon */}
        {toast.type === 'chat' ? (
          <Avatar fallback={toast.avatar} size="md" />
        ) : (
          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${TYPE_ACCENT[toast.type] || 'bg-clan-card'} text-white`}>
            <MessageCircle className="w-5 h-5" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-clan-text truncate">{toast.title}</p>
          {toast.body && (
            <p className="text-xs text-clan-muted mt-0.5 line-clamp-2 break-words">{toast.body}</p>
          )}
          {toast.action && (
            <button
              onClick={handleAction}
              className="text-xs text-clan-accent hover:text-clan-gold font-medium mt-1.5"
            >
              {toast.action.label || 'Open'} →
            </button>
          )}
        </div>

        <button
          onClick={handleDismiss}
          className="btn-ghost !p-1 shrink-0"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
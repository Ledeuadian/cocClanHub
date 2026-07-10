/**
 * Chat data store + DM support
 *
 * Single source of truth for ALL messages (channel + direct).
 * Uses Zustand-style state with subscribe/publish so the toast
 * system can react to new incoming messages regardless of who
 * sent them.
 *
 * Production note: replace the in-memory arrays with Supabase
 * tables (channels, chat_messages, direct_messages) and the bus
 * with Socket.IO. The component API stays the same.
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { publishChatMessage, subscribeChatMessages } from './ToastContext.jsx'
import { useClan } from './ClanContext.jsx'

const ChatContext = createContext(null)

// All chat state starts empty. Real data flows in via Supabase
// subscriptions and Socket.IO once the backend is wired up.

const CURRENT_USER = { id: 'me', name: 'You', tag: '', role: 'member' }

// Normalize a COC player tag so #ABCD and ABCD compare equal.
const normalizeTag = (tag) => (tag || '').replace(/^#/, '').toUpperCase()

// ── Provider ────────────────────────────────────────────────────

export function ChatProvider({ children }) {
  const { members: clanMembers } = useClan()
  const [messages, setMessages] = useState({ channels: [], dms: [] })
  const [threads, setThreads]   = useState([])
  const [members, setMembers]   = useState([])
  const [channels, setChannels] = useState([])
  const me = CURRENT_USER

  // Seed the chat member list with the live COC clan roster (from
  // ClanContext) so deep-link DMs can resolve the in-game name (IGN)
  // instead of falling back to a generic placeholder.
  // Tag normalization lets us match `#ABCD1234` (URL form) against
  // the canonical `ABCD1234` value stored on each clan member.
  useEffect(() => {
    if (!clanMembers?.length) return
    setMembers((prev) => {
      const byTag = new Map(prev.map((m) => [normalizeTag(m.tag), m]))
      for (const m of clanMembers) {
        const tag = m.tag ? `#${normalizeTag(m.tag)}` : ''
        const existing = byTag.get(normalizeTag(tag))
        if (existing) {
          // Refresh name/role from the latest roster but keep online status
          byTag.set(normalizeTag(tag), { ...existing, name: m.name, role: m.role })
        } else {
          byTag.set(normalizeTag(tag), {
            id: tag || m.name,
            name: m.name,
            tag,
            role: m.role || 'member',
            online: false
          })
        }
      }
      return Array.from(byTag.values())
    })
  }, [clanMembers])

  // ── Helpers ────────────────────────────────────────────────

  const formatTime = useCallback((date = new Date()) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }, [])

  const today = useCallback((date = new Date()) => {
    const d = new Date(date)
    if (d.toDateString() === new Date().toDateString()) return formatTime(d)
    if (d.toDateString() === new Date(Date.now() - 86400000).toDateString()) return 'Yesterday'
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }, [formatTime])

  // ── Channel messages ──────────────────────────────────────

  const sendChannelMessage = useCallback((channelId, text) => {
    if (!text.trim()) return null
    const msg = {
      id: Date.now(),
      channelId,
      author: me.name,
      authorId: me.id,
      text: text.trim(),
      time: formatTime()
    }
    setMessages((prev) => ({
      ...prev,
      channels: [...prev.channels, msg]
    }))
    // Don't toast for our own messages
    return msg
  }, [me, formatTime])

  const receiveChannelMessage = useCallback((channelId, author, text) => {
    const msg = {
      id: Date.now() + Math.random(),
      channelId,
      author,
      authorId: `u-${author}`,
      text,
      time: formatTime()
    }
    setMessages((prev) => ({
      ...prev,
      channels: [...prev.channels, msg]
    }))
    publishChatMessage({ ...msg, kind: 'channel', channelName: channels.find(c => c.id === channelId)?.name })
    return msg
  }, [channels, formatTime])

  // ── Direct messages ───────────────────────────────────────

  // Conversation key is always sorted so u2<->me and me<->u2 hit the same array
  const dmKey = (a, b) => [a, b].sort().join('::')

  const sendDM = useCallback((toId, text) => {
    if (!text.trim()) return null
    const msg = {
      id: Date.now(),
      fromId: me.id,
      toId,
      author: me.name,
      text: text.trim(),
      time: formatTime()
    }
    setMessages((prev) => ({
      ...prev,
      dms: [...prev.dms, msg]
    }))
    // Update thread preview
    setThreads((prev) => {
      const existing = prev.find(t => t.userId === toId)
      const updated = { id: toId, userId: toId, lastMessage: text, lastTime: 'now', unread: 0 }
      if (existing) return prev.map(t => t.userId === toId ? updated : t)
      return [updated, ...prev]
    })
    return msg
  }, [me, formatTime])

  const receiveDM = useCallback((fromId, text) => {
    const sender = members.find(m => m.id === fromId)
    if (!sender) return null
    const msg = {
      id: Date.now() + Math.random(),
      fromId,
      toId: me.id,
      author: sender.name,
      text: text.trim(),
      time: formatTime()
    }
    setMessages((prev) => ({
      ...prev,
      dms: [...prev.dms, msg]
    }))
    setThreads((prev) => {
      const existing = prev.find(t => t.userId === fromId)
      const updated = {
        id: fromId,
        userId: fromId,
        lastMessage: text,
        lastTime: 'now',
        unread: (existing?.unread || 0) + 1
      }
      if (existing) return prev.map(t => t.userId === fromId ? updated : t)
      return [updated, ...prev]
    })
    publishChatMessage({ ...msg, kind: 'dm', avatar: sender.name[0] })
    return msg
  }, [me, members, formatTime])

  // ── Selectors ─────────────────────────────────────────────

  const getChannelMessages = useCallback((channelId) => {
    return messages.channels.filter(m => m.channelId === channelId)
  }, [messages.channels])

  const getDMMessages = useCallback((otherUserId) => {
    return messages.dms.filter(m =>
      (m.fromId === me.id && m.toId === otherUserId) ||
      (m.fromId === otherUserId && m.toId === me.id)
    )
  }, [messages.dms, me])

  const markThreadRead = useCallback((userId) => {
    setThreads(prev => prev.map(t => t.userId === userId ? { ...t, unread: 0 } : t))
  }, [])

  // ── Open or create a DM thread with the given COC player tag ─────
  // `playerTag` is the in-game tag (e.g. "#2G9Y..."), not a DB user id.
  // Returns the thread object so the caller can navigate to it.
  const openDMWith = useCallback((member) => {
    if (!member) return null
    // Use COC tag as the DM thread id (also acts as the URL-safe key)
    const threadId = member.tag
    setThreads((prev) => {
      const exists = prev.find(t => t.userId === threadId)
      if (exists) return prev
      const fresh = {
        id: threadId,
        userId: threadId,
        name: member.name,
        tag: member.tag,
        role: member.role,
        lastMessage: '',
        lastTime: 'now',
        unread: 0
      }
      return [fresh, ...prev]
    })
    setMembers((prev) => {
      if (prev.find(m => m.tag === member.tag)) return prev
      return [
        ...prev,
        {
          id: member.tag,
          name: member.name,
          tag: member.tag,
          role: member.role || 'member',
          online: false
        }
      ]
    })
    return { userId: threadId }
  }, [])

  const value = {
    me,
    channels,
    members,
    threads,
    sendChannelMessage,
    sendDM,
    receiveChannelMessage,
    receiveDM,
    getChannelMessages,
    getDMMessages,
    markThreadRead,
    openDMWith,
    today
  }

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

export const useChat = () => {
  const ctx = useContext(ChatContext)
  if (!ctx) throw new Error('useChat must be used within ChatProvider')
  return ctx
}
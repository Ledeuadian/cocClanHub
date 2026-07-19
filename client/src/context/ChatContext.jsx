/**
 * Chat data store + DM support
 *
 * Live chat backed by:
 *   - Supabase (Postgres) as the persistent source of truth.
 *     chat_messages and direct_messages tables; Realtime for instant
 *     delivery to other connected clients.
 *   - Socket.IO as a low-latency mirror while the backend is up.
 *     When a user sends a message we emit it via Socket.IO so other
 *     clients see it instantly, and persist to Supabase so it
 *     survives a reload.
 *
 * If neither backend is reachable the chat still works locally (in-memory)
 * so the UI is never broken — it just won't deliver cross-device.
 *
 * The Messenger-style toast (sender avatar + body + Reply → /chat) is
 * fired from receiveChannelMessage / receiveDM via publishChatMessage.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef
} from 'react'
import { publishChatMessage } from './ToastContext.jsx'
import { useClan } from './ClanContext.jsx'
import { useAuth } from './AuthContext.jsx'
import {
  supabase,
  isSupabaseConfigured,
} from '../lib/supabase.js'
import socketService from '../services/socket.js'

const ChatContext = createContext(null)

// Normalize a COC player tag so #ABCD and ABCD compare equal.
const normalizeTag = (tag) => (tag || '').replace(/^#/, '').toUpperCase()

// Default channels seeded when the `channels` table is empty.
const DEFAULT_CHANNELS = [
  { id: 'general',    name: 'general',    type: 'text', description: 'Clan-wide chatter' },
  { id: 'leadership', name: 'leadership', type: 'text', description: 'Leaders and elders only' },
  { id: 'wars',       name: 'wars',       type: 'text', description: 'War strategy + call-outs' },
  { id: 'cwl',        name: 'cwl',        type: 'text', description: 'CWL coordination' }
]

// ── Provider ────────────────────────────────────────────────────

export function ChatProvider({ children }) {
  const { members: clanMembers } = useClan()
  const { user, profile } = useAuth()
  const [messages, setMessages] = useState({ channels: [], dms: [] })
  const [threads, setThreads]   = useState([])
  const [members, setMembers]   = useState([])
  const [channels, setChannels] = useState(DEFAULT_CHANNELS)
  const [chatStatus, setChatStatus] = useState('connecting') // 'connecting' | 'live' | 'offline'

  // The local "me" — derived from the auth profile when available.
  const me = {
    id: user?.id || 'me',
    name: profile?.display_name || user?.email?.split('@')[0] || 'You',
    tag: profile?.coc_player_tag ? `#${normalizeTag(profile.coc_player_tag)}` : '',
    role: profile?.platform_role || 'member'
  }

  // Tracks which inbound message IDs we've already processed so the same
  // row echoed by both Supabase and Socket.IO doesn't get rendered twice.
  const seenIdsRef = useRef(new Set())
  const markSeen = (id) => { if (id) seenIdsRef.current.add(String(id)) }

  // ── 1. Seed chat members from the live clan roster ──────────────
  useEffect(() => {
    if (!clanMembers?.length) return
    setMembers((prev) => {
      const byTag = new Map(prev.map((m) => [normalizeTag(m.tag), m]))
      for (const m of clanMembers) {
        const tag = m.tag ? `#${normalizeTag(m.tag)}` : ''
        const existing = byTag.get(normalizeTag(tag))
        if (existing) {
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

  // ── 2. Load channels from Supabase (fall back to defaults) ──────
  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setChannels(DEFAULT_CHANNELS)
      setChatStatus('offline')
      return
    }
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase
        .from('channels')
        .select('*')
        .order('position', { ascending: true })
      if (cancelled) return
      if (error || !data || data.length === 0) {
        // Seed default channels so users have something to chat in.
        await supabase.from('channels').upsert(
          DEFAULT_CHANNELS.map((c, i) => ({ ...c, position: i })),
          { onConflict: 'id' }
        )
        setChannels(DEFAULT_CHANNELS)
      } else {
        setChannels(data)
      }
    })()
    return () => { cancelled = true }
  }, [])

  // ── 3. Live subscriptions: Supabase Realtime + Socket.IO ─────────
  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setChatStatus('offline')
      return
    }

    // Try to bring the socket online too (it gracefully no-ops if backend is down)
    try {
      socketService.connectSocket()
    } catch { /* ignore */ }

    const off = socketService.subscribeToSupabaseChat({
      onChannelMessage: handleIncomingChannelMessage,
      onDM: handleIncomingDM
    })

    // Subscribe to presence too (if a handler is set)
    const offPresence = socketService.onPresence((p) => {
      // Lightweight presence fan-out — could be expanded later.
      // eslint-disable-next-line no-console
      console.debug('[chat] presence', p)
    })

    setChatStatus('live')

    return () => {
      off()
      offPresence()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── 4. Helpers ──────────────────────────────────────────────────
  // NOTE: formatTime / today must be declared BEFORE the effects that
  // reference them (3c / 3d below) — `const` declarations live in the
  // temporal dead zone until their initializer runs, which means a
  // useEffect callback that closes over them earlier in the file would
  // throw `Cannot access 'formatTime' before initialization` at mount.
  const formatTime = useCallback((date = new Date()) => {
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }, [])

  const today = useCallback((date = new Date()) => {
    const d = new Date(date)
    if (d.toDateString() === new Date().toDateString()) return formatTime(d)
    if (d.toDateString() === new Date(Date.now() - 86400000).toDateString()) return 'Yesterday'
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }, [formatTime])

  // ── 3b. Tell the Socket.IO server who we are (so it can route DMs to us) ──
  // Re-runs whenever our tag changes (login / profile update).
  useEffect(() => {
    if (!me.tag) return
    try { socketService.connectSocket() } catch { /* ignore */ }
    socketService.identify({
      tag: me.tag,
      displayName: me.name
    })
  }, [me.tag, me.name])

  // ── 3c. Load historical channel messages for each known channel ──
  useEffect(() => {
    if (!isSupabaseConfigured() || channels.length === 0) return
    let cancelled = false
    ;(async () => {
      for (const ch of channels) {
        const rows = await socketService.loadChannelMessages(ch.id, 50)
        if (cancelled || !rows?.length) continue
        setMessages((prev) => {
          // Merge only rows we haven't seen yet (de-dupes with optimistic local adds)
          const known = new Set(prev.channels.map((m) => m.id))
          const toAdd = rows
            .filter((r) => !known.has(r.id))
            .map((r) => ({
              id: r.id,
              channelId: r.channel_id,
              author: r.author_id ? 'Member' : 'Member',
              authorId: r.author_id,
              text: r.text,
              time: formatTime(r.created_at),
              created_at: r.created_at
            }))
          if (toAdd.length === 0) return prev
          return { ...prev, channels: [...prev.channels, ...toAdd] }
        })
      }
    })()
    return () => { cancelled = true }
  }, [channels, formatTime])

  // ── 3d. Load historical DMs whenever the roster / our tag changes ──
  useEffect(() => {
    if (!isSupabaseConfigured() || !me.tag || members.length === 0) return
    let cancelled = false
    ;(async () => {
      const myTag = normalizeTag(me.tag)
      // Only load DMs for members we already have a thread with
      const tagsToLoad = Array.from(new Set([
        ...threads.map((t) => normalizeTag(t.userId)),
        ...members.map((m) => normalizeTag(m.tag))
      ])).filter((t) => t && t !== myTag)

      for (const otherTag of tagsToLoad) {
        const rows = await socketService.loadDMs({ myTag, otherTag, limit: 50 })
        if (cancelled || !rows?.length) continue
        setMessages((prev) => {
          const known = new Set(prev.dms.map((m) => m.id))
          const toAdd = rows
            .filter((r) => !known.has(r.id))
            .map((r) => ({
              id: r.id,
              fromId: `#${r.sender_tag}`,
              toId: `#${r.recipient_tag}`,
              author: r.sender_name || `#${r.sender_tag}`,
              text: r.text,
              time: formatTime(r.created_at),
              created_at: r.created_at
            }))
          if (toAdd.length === 0) return prev
          return { ...prev, dms: [...prev.dms, ...toAdd] }
        })
      }
    })()
    return () => { cancelled = true }
  }, [me.tag, members, threads, formatTime])

  // ── 5. Inbound handlers (Supabase + Socket.IO → state) ─────────

  const handleIncomingChannelMessage = useCallback((msg) => {
    // De-dupe echoes (Supabase Realtime + Socket.IO both fire for the same row)
    const key = msg.id || `${msg.channelId}:${msg.userId}:${msg.created_at}:${msg.text}`
    if (seenIdsRef.current.has(String(key))) return
    markSeen(key)
    // The realtime stream also includes our own sends; if the userId
    // matches, skip the toast and rely on the optimistic local add.
    if (msg.userId && me.id && String(msg.userId) === String(me.id)) return

    receiveChannelMessage(msg.channelId, msg.displayName || 'Member', msg.text, { id: msg.id })
  }, [me.id])

  const handleIncomingDM = useCallback((msg) => {
    // Skip when payload is malformed
    if (!msg) return

    const key = msg.id || `${msg.senderTag}:${msg.recipientTag}:${msg.created_at}:${msg.text}`
    if (seenIdsRef.current.has(String(key))) return
    markSeen(key)

    // Skip our own sends (compare canonical tag forms)
    if (msg.senderTag && me.tag && normalizeTag(msg.senderTag) === normalizeTag(me.tag)) return

    // Add the sender to the chat members list if they aren't there yet
    const senderTag = msg.senderTag ? `#${normalizeTag(msg.senderTag)}` : ''
    if (senderTag) {
      setMembers((prev) => {
        if (prev.find((m) => normalizeTag(m.tag) === normalizeTag(senderTag))) return prev
        return [
          ...prev,
          {
            id: senderTag,
            name: msg.senderName || senderTag,
            tag: senderTag,
            role: 'member',
            online: false
          }
        ]
      })
    }

    receiveDM(senderTag, msg.text, { id: msg.id })
  }, [me.tag])

  // ── 6. Outbound: send channel message ──────────────────────────
  const sendChannelMessage = useCallback(async (channelId, text) => {
    if (!text?.trim()) return null

    // Optimistic local add
    const localMsg = {
      id: `local-${Date.now()}`,
      channelId,
      author: me.name,
      authorId: me.id,
      text: text.trim(),
      time: formatTime()
    }
    setMessages((prev) => ({
      ...prev,
      channels: [...prev.channels, localMsg]
    }))

    // Emit to the server. The server persists to Supabase and broadcasts
    // the canonical row back to all channel members (including this
    // client via the message:new echo + the ack). We use the ack to
    // replace the local placeholder id with the real row id so future
    // echoes de-dupe correctly.
    const ack = await socketService.emitChannelMessageWithAck(
      channelId,
      text,
      { userId: me.id, displayName: me.name }
    )
    const canonicalId = ack?.ok ? ack.id : null
    const created_at = ack?.ok ? ack.created_at : null

    if (canonicalId) {
      markSeen(canonicalId)
      setMessages((prev) => ({
        ...prev,
        channels: prev.channels.map((m) =>
          m.id === localMsg.id
            ? { ...m, id: canonicalId, created_at }
            : m
        )
      }))
    }
    return localMsg
  }, [me.id, me.name, formatTime])

  // ── 7. Outbound: send DM ──────────────────────────────────────
  const sendDM = useCallback(async (toId, text) => {
    if (!text?.trim()) return null
    const recipientTag = toId.startsWith('#') ? normalizeTag(toId) : normalizeTag(toId)
    const myTag = normalizeTag(me.tag)

    // Optimistic local add
    const localMsg = {
      id: `local-${Date.now()}`,
      fromId: me.id,
      toId: `#${recipientTag}`,
      author: me.name,
      text: text.trim(),
      time: formatTime()
    }
    setMessages((prev) => ({
      ...prev,
      dms: [...prev.dms, localMsg]
    }))

    // Update thread preview
    setThreads((prev) => {
      const existing = prev.find((t) => t.userId === `#${recipientTag}`)
      const updated = {
        id: `#${recipientTag}`,
        userId: `#${recipientTag}`,
        name: existing?.name || `#${recipientTag}`,
        tag: `#${recipientTag}`,
        role: existing?.role || 'member',
        lastMessage: text.trim(),
        lastTime: 'now',
        unread: 0
      }
      if (existing) return prev.map((t) => (t.userId === `#${recipientTag}` ? updated : t))
      return [updated, ...prev]
    })

    // Emit to the server. The server persists + routes to recipient sockets.
    const ack = myTag
      ? await socketService.emitDMWithAck(recipientTag, {
          text,
          senderTag: myTag,
          senderName: me.name
        })
      : null

    const canonicalId = ack?.ok ? ack.id : null
    const created_at = ack?.ok ? ack.created_at : null
    if (canonicalId) {
      markSeen(canonicalId)
      setMessages((prev) => ({
        ...prev,
        dms: prev.dms.map((m) => (m.id === localMsg.id ? { ...m, id: canonicalId, created_at } : m))
      }))
    }
    return localMsg
  }, [me.id, me.name, me.tag, formatTime])

  // ── 8. Receive functions (also called by Socket.IO) ───────────
  const receiveChannelMessage = useCallback((channelId, author, text, opts = {}) => {
    const msg = {
      id: opts.id || `r-${Date.now()}-${Math.random()}`,
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
    const channelName = channels.find((c) => c.id === channelId)?.name
    publishChatMessage({
      ...msg,
      kind: 'channel',
      channelName,
      avatar: author?.[0] || '?'
    })
    return msg
  }, [channels, formatTime])

  const receiveDM = useCallback((fromId, text, opts = {}) => {
    // fromId is the sender's tag (e.g. "#2G9Y...")
    const sender = members.find((m) => normalizeTag(m.tag) === normalizeTag(fromId))
    const senderName = sender?.name || fromId
    const msg = {
      id: opts.id || `r-${Date.now()}-${Math.random()}`,
      fromId,
      toId: me.id,
      author: senderName,
      text: text.trim(),
      time: formatTime()
    }
    setMessages((prev) => ({
      ...prev,
      dms: [...prev.dms, msg]
    }))
    setThreads((prev) => {
      const existing = prev.find((t) => t.userId === fromId)
      const updated = {
        id: fromId,
        userId: fromId,
        name: senderName,
        tag: fromId,
        role: sender?.role || 'member',
        lastMessage: text,
        lastTime: 'now',
        unread: (existing?.unread || 0) + 1
      }
      if (existing) return prev.map((t) => (t.userId === fromId ? updated : t))
      return [updated, ...prev]
    })
    publishChatMessage({
      ...msg,
      kind: 'dm',
      avatar: senderName[0] || '?'
    })
    return msg
  }, [me.id, members, formatTime])

  // ── 9. Selectors ─────────────────────────────────────────────
  const getChannelMessages = useCallback((channelId) => {
    return messages.channels.filter((m) => m.channelId === channelId)
  }, [messages.channels])

  const getDMMessages = useCallback((otherUserId) => {
    const otherTag = otherUserId.startsWith('#') ? normalizeTag(otherUserId) : otherUserId
    return messages.dms.filter((m) => {
      const from = (m.fromId || '').startsWith('#') ? normalizeTag(m.fromId) : m.fromId
      const to   = (m.toId   || '').startsWith('#') ? normalizeTag(m.toId)   : m.toId
      return (from === me.id && to === otherTag) ||
             (from === otherTag && to === me.id)
    })
  }, [messages.dms, me.id])

  const markThreadRead = useCallback((userId) => {
    setThreads((prev) => prev.map((t) => (t.userId === userId ? { ...t, unread: 0 } : t)))
  }, [])

  // ── 10. Open or create a DM thread with the given COC tag ──────
  const openDMWith = useCallback((member) => {
    if (!member) return null
    const threadId = member.tag
    setThreads((prev) => {
      const exists = prev.find((t) => t.userId === threadId)
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
      if (prev.find((m) => m.tag === member.tag)) return prev
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
    messages,
    sendChannelMessage,
    sendDM,
    receiveChannelMessage,
    receiveDM,
    getChannelMessages,
    getDMMessages,
    markThreadRead,
    openDMWith,
    today,
    status: chatStatus
  }

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

export const useChat = () => {
  const ctx = useContext(ChatContext)
  if (!ctx) throw new Error('useChat must be used within ChatProvider')
  return ctx
}
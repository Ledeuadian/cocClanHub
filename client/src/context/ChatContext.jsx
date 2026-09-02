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
  const [refreshTick, setRefreshTick] = useState(0) // drives periodic chat refresh (DMs + channels)

  // The local "me" — derived from the auth profile when available.
  const me = {
    id: user?.id || 'me',
    name: profile?.display_name || user?.email?.split('@')[0] || 'You',
    tag: profile?.coc_player_tag ? `#${normalizeTag(profile.coc_player_tag)}` : '',
    role: profile?.platform_role || 'member'
  }

  // ── Refs for always-fresh message handlers ───────────────────────
  // The subscription effect (section 3) runs only ONCE at mount, so it
  // captures the initial closures of handleIncomingDM /
  // handleIncomingChannelMessage. At mount time `me.tag` is '' and
  // `me.id` is 'me' (profile hasn't loaded yet). The stale closure
  // causes the self-echo dedup check to be skipped, so the sender
  // processes their own DM as if they were the recipient (duplicate
  // chat box + notification). These refs are updated every render and
  // the subscription calls through them, ensuring the latest handler
  // — with the correct me.tag / me.id — is always invoked.
  const dmHandlerRef = useRef(null)
  const channelHandlerRef = useRef(null)

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

    // Call through refs so we always invoke the LATEST handler
    // (with the correct me.tag / me.id), not the stale closure from
    // mount time when profile hadn't loaded yet.
    const off = socketService.subscribeToSupabaseChat({
      onChannelMessage: (msg) => channelHandlerRef.current?.(msg),
      onDM: (msg) => dmHandlerRef.current?.(msg)
    })

    // Subscribe to presence too (if a handler is set)
    const offPresence = socketService.onPresence((p) => {
      // ── Presence: mark members online/offline ──
      // The server broadcasts 'presence:update' with either
      //   { type: 'user-online',  tag, displayName }
      //   { type: 'user-offline', tag }
      // when any user's socket connects/disconnects. Previously this
      // handler only logged — so everyone always showed "Offline".
      if (!p || !p.tag) return
      if (p.type === 'user-online') {
        const tag = `#${normalizeTag(p.tag)}`
        setMembers((prev) => {
          const idx = prev.findIndex((m) => normalizeTag(m.tag) === normalizeTag(tag))
          if (idx === -1) {
            return [...prev, { id: tag, name: p.displayName || tag, tag, role: 'member', online: true }]
          }
          if (prev[idx].online && prev[idx].name === (p.displayName || prev[idx].name)) return prev
          const next = [...prev]
          next[idx] = { ...next[idx], online: true, name: p.displayName || next[idx].name }
          return next
        })
      } else if (p.type === 'user-offline') {
        setMembers((prev) => {
          const idx = prev.findIndex((m) => normalizeTag(m.tag) === normalizeTag(p.tag))
          if (idx === -1 || !prev[idx].online) return prev
          const next = [...prev]
          next[idx] = { ...next[idx], online: false }
          return next
        })
      }
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
              // Join returns author: { display_name, coc_player_name }
              author: r.author?.display_name || r.author?.coc_player_name || 'Member',
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
  }, [channels, formatTime, refreshTick])

  // ── 3d. Load DMs whenever our tag changes, and periodically refresh ──
  // This is the source of truth for both the message list AND the thread
  // list (Direct Messages sidebar). Previously this required members to
  // load first, so an empty clan roster meant an empty DM list — even
  // when real DMs existed in the DB. Now we query by myTag directly.
  useEffect(() => {
    if (!isSupabaseConfigured() || !me.tag) return
    let cancelled = false
    ;(async () => {
      const myTag = normalizeTag(me.tag)

      // 1. Pull ALL recent DMs involving us — this lets us rebuild the
      //    thread list without needing the clan roster.
      const all = await socketService.loadMyDMs(myTag, 100)
      if (cancelled || !all?.length) return

      // Merge new message rows into messages.dms (de-duped by row id).
      // loadMyDMs returns newest-first — sort oldest-first so the thread
      // renders chronologically (newest at the BOTTOM, like Messenger).
      setMessages((prev) => {
        const known = new Set(prev.dms.map((m) => m.id))
        const toAdd = all
          .filter((r) => !known.has(r.id))
          .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
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

      // 2. Rebuild the thread list from the most recent DM per partner.
      //    Map partnerTag → latest row. Preserve existing thread metadata
      //    (display name, unread count) where possible.
      const latestByPartner = new Map()
      for (const r of all) {
        const partnerTag = r.sender_tag === myTag ? r.recipient_tag : r.sender_tag
        if (!partnerTag) continue
        const key = `#${partnerTag}`
        const prev = latestByPartner.get(key)
        if (!prev || new Date(r.created_at) > new Date(prev.created_at)) {
          latestByPartner.set(key, r)
        }
      }

      setThreads((prev) => {
        const byTag = new Map(prev.map((t) => [normalizeTag(t.userId), t]))
        for (const [partnerKey, row] of latestByPartner) {
          const existing = byTag.get(normalizeTag(partnerKey))
          const updated = {
            id: partnerKey,
            userId: partnerKey,
            name: existing?.name || row.sender_name || partnerKey,
            tag: partnerKey,
            role: existing?.role || 'member',
            lastMessage: row.text,
            lastTime: formatTime(row.created_at),
            unread: existing?.unread || 0
          }
          byTag.set(normalizeTag(partnerKey), updated)
        }
        // Keep only threads we have evidence for (history OR in-memory)
        return Array.from(byTag.values())
      })
    })()
    return () => { cancelled = true }
  }, [me.tag, refreshTick, formatTime])

  // ── 3e. Periodic chat refresh — catches missed realtime events ──
  // Supabase Realtime + Socket.IO can both drop events on mobile networks,
  // cold background tabs, or WebView suspensions. Polling the DB every 15s
  // gives us a deterministic fallback so live messages still appear even
  // if realtime never fired. Applies to BOTH channels and DMs.
  useEffect(() => {
    if (!isSupabaseConfigured() || !me.tag) return
    const id = setInterval(() => setRefreshTick((n) => n + 1), 15000)
    return () => clearInterval(id)
  }, [me.tag])

  // ── 3f. Presence polling via HTTP — deterministic fallback ──
  // Socket.IO presence broadcasts can be missed on mobile (WebView
  // suspensions, dropped sockets). Polling the backend's /api/presence
  // endpoint gives a reliable view of who's online right now.
  //
  // NOTE: declared BEFORE the effects that reference it — a `const`
  // declared below its usage site lives in the temporal dead zone at
  // render time and crashes the whole React tree (blank page, only
  // background visible).
  const pollPresence = useCallback(async () => {
    try {
      const base = import.meta.env.VITE_API_URL || '/api'
      const res = await fetch(`${base}/presence`, { credentials: 'include' })
      if (!res.ok) return
      const data = await res.json()
      const onlineSet = new Set((data?.online || []).map((t) => String(t).replace(/^#/, '').toUpperCase()))
      setMembers((prev) => {
        let changed = false
        const next = prev.map((m) => {
          const isOn = onlineSet.has(normalizeTag(m.tag))
          if (isOn !== m.online) {
            changed = true
            return { ...m, online: isOn }
          }
          return m
        })
        // Add any online tag we haven't seen yet (someone whose socket
        // is up but who isn't in our roster — e.g. DMs from outside clan).
        for (const tag of onlineSet) {
          const key = `#${tag}`
          if (!prev.find((m) => normalizeTag(m.tag) === tag)) {
            next.push({ id: key, name: key, tag: key, role: 'member', online: true })
            changed = true
          }
        }
        return changed ? next : prev
      })
    } catch {
      // network error — silently ignore; next poll will retry
    }
  }, [])

  // ── 3g. Refresh chat + presence when the app regains focus ──
  // Mobile WebViews suspend timers AND websockets when backgrounded. When
  // the user returns to the app, the realtime transports are often dead and
  // the poll timer hasn't fired yet — so the chat box looks "frozen" on old
  // messages. Re-fetch on focus/visibility so the newest messages appear
  // immediately when the user looks at the app.
  useEffect(() => {
    if (!isSupabaseConfigured() || !me.tag) return
    const onWake = () => {
      if (document.visibilityState === 'visible') {
        setRefreshTick((n) => n + 1)
        pollPresence() // also refresh online indicators on wake
      }
    }
    window.addEventListener('focus', onWake)
    document.addEventListener('visibilitychange', onWake)
    return () => {
      window.removeEventListener('focus', onWake)
      document.removeEventListener('visibilitychange', onWake)
    }
  }, [me.tag, pollPresence])

  useEffect(() => {
    pollPresence()
    const id = setInterval(pollPresence, 15000)
    return () => clearInterval(id)
  }, [pollPresence])

  // ── 5. Inbound handlers (Supabase + Socket.IO → state) ─────────

  const handleIncomingChannelMessage = useCallback((msg) => {
    // De-dupe echoes (Supabase Realtime + Socket.IO both fire for the same row)
    const key = msg.id || `${msg.channelId}:${msg.userId}:${msg.created_at}:${msg.text}`
    if (seenIdsRef.current.has(String(key))) return
    markSeen(key)
    // The realtime stream also includes our own sends; if the userId
    // matches, skip the toast and rely on the optimistic local add.
    if (msg.userId && me.id && String(msg.userId) === String(me.id)) return

    // Resolve the sender's name: prefer the payload displayName (Socket.IO
    // path carries it), fall back to the roster by author id, else 'Member'.
    const fallbackName = msg.displayName && msg.displayName !== 'Member'
      ? msg.displayName
      : (members.find((m) => m.id === msg.userId)?.name) || 'Member'

    receiveChannelMessage(msg.channelId, fallbackName, msg.text, { id: msg.id })
  }, [me.id, members])

  const handleIncomingDM = useCallback((msg) => {
    // Skip when payload is malformed
    if (!msg) return

    const key = msg.id || `${msg.senderTag}:${msg.recipientTag}:${msg.created_at}:${msg.text}`
    if (seenIdsRef.current.has(String(key))) return
    markSeen(key)

    // Skip our own sends (compare canonical tag forms)
    if (msg.senderTag && me.tag && normalizeTag(msg.senderTag) === normalizeTag(me.tag)) return

    // Server attaches the sender's auth user id — the most reliable way to
    // recognize our own echo even while the profile/tag is still loading.
    if (msg.senderUserId && me.id && String(msg.senderUserId) === String(me.id)) return

    // Belt-and-suspenders: if we are the RECIPIENT of this DM, we
    // still need to show it. Only drop the message when we KNOW we
    // are not the intended recipient (me.tag is loaded AND doesn't
    // match). If me.tag is still loading, don't reject — the
    // senderUserId guard above already filtered out our own sends.
    if (me.tag && msg.recipientTag && normalizeTag(msg.recipientTag) !== normalizeTag(me.tag)) {
      // We are not the intended recipient — this is a broadcast echo
      // (e.g. our own send echoing back). Skip it.
      return
    }

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

  // Keep refs in sync with the latest handlers every render.
  // The subscription effect (section 3) runs only once at mount,
  // but it calls through these refs so it always gets the fresh
  // closure with the correct me.tag / me.id.
  dmHandlerRef.current = handleIncomingDM
  channelHandlerRef.current = handleIncomingChannelMessage

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
    let canonicalId = ack?.ok ? ack.id : null
    let created_at = ack?.ok ? ack.created_at : null

    // ── Fallback: persist directly to Supabase if the socket didn't save it ──
    // This ensures messages survive a refresh even when Socket.IO is down
    // (auth rejection, backend unreachable, etc.). Without this, messages
    // live only in React state and vanish on page reload.
    if (!canonicalId) {
      try {
        const row = await socketService.persistChannelMessage({
          channelId,
          text,
          userId: me.id
        })
        if (row) {
          canonicalId = row.id
          created_at = row.created_at
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[chat] channel message persist fallback failed', e)
      }
    }

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

    // Optimistic local add — fromId/toId use COC tags (NOT me.id) so that
    // getDMMessages() matches these against DB-loaded rows, which also use
    // tags. This keeps sent messages visible after a refresh.
    const localMsg = {
      id: `local-${Date.now()}`,
      fromId: `#${myTag}`,
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

    let canonicalId = ack?.ok ? ack.id : null
    let created_at = ack?.ok ? ack.created_at : null

    // ── Fallback: persist directly to Supabase if the socket didn't save it ──
    // Same rationale as sendChannelMessage — ensures DMs survive refresh
    // even when Socket.IO is unavailable.
    if (!canonicalId && myTag) {
      try {
        const row = await socketService.persistDM({
          senderTag: myTag,
          recipientTag,
          senderName: me.name,
          text
        })
        if (row) {
          canonicalId = row.id
          created_at = row.created_at
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[chat] DM persist fallback failed', e)
      }
    }

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
      toId: me.tag || me.id, // prefer tag so it matches in getDMMessages
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
    const myTag = normalizeTag(me.tag)
    return messages.dms.filter((m) => {
      // Normalize both tag-based ids ("#ABCD" → "ABCD") and legacy
      // auth-uuid ids so optimistic + DB-loaded rows both match.
      const from = (m.fromId || '').startsWith('#') ? normalizeTag(m.fromId) : m.fromId
      const to   = (m.toId   || '').startsWith('#') ? normalizeTag(m.toId)   : m.toId
      return (from === myTag && to === otherTag) ||
             (from === otherTag && to === myTag)
    })
  }, [messages.dms, me.tag])

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

  // ── 10b. Force-refresh chat from the DB (used when opening a thread) ──
  const refreshDMs = useCallback(() => {
    setRefreshTick((n) => n + 1)
  }, [])

  const refreshPresence = useCallback(() => {
    pollPresence()
  }, [pollPresence])

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
    refreshDMs,
    refreshPresence,
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
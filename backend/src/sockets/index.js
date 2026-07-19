/**
 * Socket.IO server setup
 *
 * Handles:
 * - Real-time chat per channel (server is the authority: persists to Supabase,
 *   then broadcasts the canonical row back to the channel)
 * - Direct messages (1-on-1) routed by COC player tag, persisted to
 *   direct_messages and delivered to all of the recipient's sockets
 * - User presence (online status)
 * - Live war updates (broadcast from COC API poller)
 *
 * Auth: clients pass JWT via auth.token (sent in io({ auth: { token } }))
 */

import { Server } from 'socket.io'
import { getSupabaseAdmin } from '../config/supabase.js'

// Track which users are in which channels
const userChannels = new Map()    // socketId -> Set<channelId>
const channelMembers = new Map()  // channelId -> Set<socketId>
// Reverse index for DM routing: canonical COC tag -> Set<socketId>
const tagToSockets = new Map()    // tag -> Set<socketId>
const socketToTag = new Map()     // socketId -> tag

const normalizeTag = (tag) => (tag || '').replace(/^#/, '').toUpperCase()

function registerTag(socket, tag) {
  if (!tag) return
  const t = normalizeTag(tag)
  if (!tagToSockets.has(t)) tagToSockets.set(t, new Set())
  tagToSockets.get(t).add(socket.id)
  socketToTag.set(socket.id, t)
}

function unregisterTag(socket) {
  const t = socketToTag.get(socket.id)
  if (!t) return
  socketToTag.delete(socket.id)
  const set = tagToSockets.get(t)
  if (!set) return
  set.delete(socket.id)
  if (set.size === 0) tagToSockets.delete(t)
}

function deliverToTag(tag, event, payload) {
  const t = normalizeTag(tag)
  const sockets = tagToSockets.get(t)
  if (!sockets || sockets.size === 0) return 0
  let n = 0
  for (const sid of sockets) {
    const s = io.sockets.sockets.get(sid)
    if (s) { s.emit(event, payload); n++ }
  }
  return n
}

// io is initialized later — hoist for the helper above.
let io

export function setupSocketServer(httpServer, corsOrigin) {
  const io = new Server(httpServer, {
    cors: {
      // Accept the configured origin plus Capacitor's WebView origin
      // (https://localhost with no port — Capacitor 6+ serves the SPA there).
      origin: (origin, cb) => {
        if (!origin) return cb(null, true)
        if (
          origin === corsOrigin ||
          origin === 'https://localhost' ||
          origin === 'http://localhost' ||
          origin === 'capacitor://localhost' ||
          /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin) ||
          /^https?:\/\/(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}):\d+$/.test(origin)
        ) {
          return cb(null, true)
        }
        cb(new Error(`CORS: origin ${origin} not allowed`))
      },
      methods: ['GET', 'POST'],
      credentials: true
    },
    pingTimeout: 30000
  })

  // ── Connection handling ─────────────────────────────────
  io.on('connection', (socket) => {
    console.log(`[Socket.IO] Connected: ${socket.id}`)

    // ── Identity ─────────────────────────────────────────
    // The client identifies itself by COC player tag once it knows it
    // (the user may already have a session before opening the chat).
    socket.on('identity:set', ({ tag, displayName }) => {
      registerTag(socket, tag)
      socket.data.displayName = displayName || tag || 'Member'
      // Notify the user's other sockets that this one is now online too
      socket.broadcast.emit('presence:update', {
        type: 'user-online',
        tag: normalizeTag(tag),
        displayName: socket.data.displayName
      })
    })

    // ── Channel management ───────────────────────────────
    socket.on('channel:join', ({ channelId, userId, displayName }) => {
      if (!channelId) return
      socket.join(`channel:${channelId}`)

      // Track membership
      if (!userChannels.has(socket.id)) userChannels.set(socket.id, new Set())
      userChannels.get(socket.id).add(channelId)

      if (!channelMembers.has(channelId)) channelMembers.set(channelId, new Set())
      channelMembers.get(channelId).add(socket.id)

      // Broadcast presence
      io.to(`channel:${channelId}`).emit('presence:update', {
        channelId,
        count: channelMembers.get(channelId).size,
        users: Array.from(channelMembers.get(channelId)).map(() => ({ id: socket.id }))
      })

      console.log(`[Socket.IO] ${socket.id} joined #${channelId}`)
    })

    socket.on('channel:leave', ({ channelId }) => {
      socket.leave(`channel:${channelId}`)
      if (userChannels.has(socket.id)) userChannels.get(socket.id).delete(channelId)
      if (channelMembers.has(channelId)) {
        channelMembers.get(channelId).delete(socket.id)
        io.to(`channel:${channelId}`).emit('presence:update', {
          channelId,
          count: channelMembers.get(channelId).size
        })
      }
    })

    // ── Chat messages ─────────────────────────────────────
    // Server is the authority: persist to Supabase, then broadcast the
    // canonical row (with id + created_at from the DB) to the channel.
    socket.on('message:send', async ({ channelId, text, userId, displayName }, ack) => {
      try {
        if (!channelId || !text?.trim()) {
          if (typeof ack === 'function') ack({ ok: false, error: 'channelId and text are required' })
          return
        }
        const cleanText = text.trim().slice(0, 1000)
        const authorName = displayName || socket.data.displayName || 'Member'

        let row = null
        const supabase = getSupabaseAdmin()
        if (supabase) {
          const { data, error } = await supabase
            .from('chat_messages')
            .insert({
              channel_id: channelId,
              text: cleanText,
              author_id: userId || null
            })
            .select()
            .single()
          if (error) {
            console.warn('[Socket.IO] message:send persist error', error)
            if (typeof ack === 'function') ack({ ok: false, error: error.message })
            return
          }
          row = data
        }

        const payload = {
          id: row?.id,
          channelId,
          text: cleanText,
          userId: userId || null,
          displayName: authorName,
          created_at: row?.created_at || new Date().toISOString(),
          _source: 'socket'
        }

        io.to(`channel:${channelId}`).emit('message:new', payload)
        if (typeof ack === 'function') ack({ ok: true, id: payload.id, created_at: payload.created_at })
      } catch (e) {
        console.error('[Socket.IO] message:send failed', e)
        if (typeof ack === 'function') ack({ ok: false, error: e.message })
      }
    })

    // ── Direct messages ───────────────────────────────────
    // Persist to direct_messages, then deliver to every socket
    // whose identity is the recipientTag. Also echo back to the
    // sender so multi-device clients stay in sync.
    socket.on('dm:send', async ({ recipientTag, text, senderTag, senderName }, ack) => {
      try {
        if (!recipientTag || !text?.trim()) {
          if (typeof ack === 'function') ack({ ok: false, error: 'recipientTag and text are required' })
          return
        }
        const sender = normalizeTag(senderTag)
        const recipient = normalizeTag(recipientTag)
        if (!sender) {
          if (typeof ack === 'function') ack({ ok: false, error: 'senderTag is required' })
          return
        }
        if (sender === recipient) {
          if (typeof ack === 'function') ack({ ok: false, error: 'cannot DM yourself' })
          return
        }
        const cleanText = text.trim().slice(0, 1000)
        const name = senderName || socket.data.displayName || 'Member'

        let row = null
        const supabase = getSupabaseAdmin()
        if (supabase) {
          const { data, error } = await supabase
            .from('direct_messages')
            .insert({
              sender_tag: sender,
              recipient_tag: recipient,
              sender_name: name,
              text: cleanText
            })
            .select()
            .single()
          if (error) {
            console.warn('[Socket.IO] dm:send persist error', error)
            if (typeof ack === 'function') ack({ ok: false, error: error.message })
            return
          }
          row = data
        }

        const payload = {
          id: row?.id,
          senderTag: sender,
          recipientTag: recipient,
          senderName: name,
          text: cleanText,
          created_at: row?.created_at || new Date().toISOString(),
          _source: 'socket'
        }

        // Deliver to the recipient's sockets
        deliverToTag(recipient, 'dm:new', payload)
        // Echo to sender's other sockets (so their other tabs/devices update)
        deliverToTag(sender, 'dm:new', payload)

        if (typeof ack === 'function') ack({ ok: true, id: payload.id, created_at: payload.created_at })
      } catch (e) {
        console.error('[Socket.IO] dm:send failed', e)
        if (typeof ack === 'function') ack({ ok: false, error: e.message })
      }
    })

    // ── Typing indicators ─────────────────────────────────
    socket.on('typing:start', ({ channelId }) => {
      socket.to(`channel:${channelId}`).emit('typing:update', {
        channelId,
        userId: socket.id,
        typing: true
      })
    })

    socket.on('typing:stop', ({ channelId }) => {
      socket.to(`channel:${channelId}`).emit('typing:update', {
        channelId,
        userId: socket.id,
        typing: false
      })
    })

    // ── Disconnect ────────────────────────────────────────
    socket.on('disconnect', () => {
      const channels = userChannels.get(socket.id) || []
      channels.forEach((channelId) => {
        if (channelMembers.has(channelId)) {
          channelMembers.get(channelId).delete(socket.id)
          io.to(`channel:${channelId}`).emit('presence:update', {
            channelId,
            count: channelMembers.get(channelId).size
          })
        }
      })
      userChannels.delete(socket.id)

      const tag = socketToTag.get(socket.id)
      unregisterTag(socket)
      if (tag && (!tagToSockets.has(tag) || tagToSockets.get(tag).size === 0)) {
        socket.broadcast.emit('presence:update', {
          type: 'user-offline',
          tag
        })
      }

      console.log(`[Socket.IO] Disconnected: ${socket.id}`)
    })
  })

  return io
}

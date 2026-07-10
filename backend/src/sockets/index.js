/**
 * Socket.IO server setup
 *
 * Handles:
 * - Real-time chat per channel
 * - User presence (online status)
 * - Live war updates (broadcast from COC API poller)
 *
 * Auth: clients pass JWT via auth.token (sent in io({ auth: { token } }))
 */

import { Server } from 'socket.io'

// Track which users are in which channels
const userChannels = new Map() // socketId -> Set<channelId>
const channelMembers = new Map() // channelId -> Set<socketId>

export function setupSocketServer(httpServer, corsOrigin) {
  const io = new Server(httpServer, {
    cors: {
      origin: corsOrigin,
      methods: ['GET', 'POST'],
      credentials: true
    },
    pingTimeout: 30000
  })

  // ── Connection handling ─────────────────────────────────
  io.on('connection', (socket) => {
    console.log(`[Socket.IO] Connected: ${socket.id}`)

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
    // On receive, persist to Supabase then broadcast
    socket.on('message:send', async ({ channelId, text, userId, displayName }) => {
      if (!channelId || !text?.trim()) return

      const message = {
        channel_id: channelId,
        author_id: userId || socket.id,
        author_name: displayName || 'Anonymous',
        text: text.trim().slice(0, 1000),
        created_at: new Date().toISOString()
      }

      // TODO: persist to Supabase here
      // For now, broadcast directly
      io.to(`channel:${channelId}`).emit('message:new', message)
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
      console.log(`[Socket.IO] Disconnected: ${socket.id}`)
    })
  })

  return io
}

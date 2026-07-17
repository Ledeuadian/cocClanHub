/**
 * Socket.IO client + Supabase Realtime bridge for chat.
 *
 * Strategy:
 *   - Supabase Realtime is the primary source of truth for chat messages.
 *     It persists to Postgres, so when the user reconnects or refreshes,
 *     the messages are durable.
 *   - Socket.IO is a low-latency mirror used while the backend is
 *     reachable. When the user sends a message we ALSO emit it via
 *     Socket.IO so other connected clients receive it instantly without
 *     waiting for the Supabase realtime echo.
 *
 * Events handled here:
 *   - 'message:new' (channel)   → forward to onChannelMessage callback
 *   - 'dm:new'      (1-on-1)    → forward to onDM callback
 *   - 'presence:update'         → forward to onPresence callback
 *
 * If the backend isn't running, all calls become no-ops — Supabase
 * Realtime still works as the slow but durable path.
 */

import { io } from 'socket.io-client'
import { supabase, isSupabaseConfigured } from '../lib/supabase.js'

// Empty string = same origin (uses Vite proxy in dev, same domain in production)
// Otherwise use the configured VITE_SOCKET_URL
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || ''

let socket = null
let connected = false

// External subscribers — each is a Set<callback>
const channelSubs = new Set()
const dmSubs = new Set()
const presenceSubs = new Set()

export function getSocket() {
  if (socket) return socket

  socket = io(SOCKET_URL, {
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: 3,
    reconnectionDelay: 1000,
    transports: ['websocket', 'polling']
  })

  socket.on('connect', () => {
    connected = true
    // eslint-disable-next-line no-console
    console.log('[Socket.IO] Connected')
  })

  socket.on('disconnect', () => {
    connected = false
  })

  socket.on('connect_error', () => {
    connected = false
    // Backend not running — silent fail (Supabase will still work)
  })

  // ── Socket.IO event fan-out ──────────────────────────────────

  socket.on('message:new', (msg) => {
    channelSubs.forEach((fn) => {
      try { fn(msg) } catch (e) { console.error('[socket] channelSubs', e) }
    })
  })

  socket.on('dm:new', (msg) => {
    dmSubs.forEach((fn) => {
      try { fn(msg) } catch (e) { console.error('[socket] dmSubs', e) }
    })
  })

  socket.on('presence:update', (payload) => {
    presenceSubs.forEach((fn) => {
      try { fn(payload) } catch (e) { console.error('[socket] presenceSubs', e) }
    })
  })

  return socket
}

export function connectSocket() {
  const sock = getSocket()
  if (!sock.connected) sock.connect()
}

export function disconnectSocket() {
  if (socket && connected) socket.disconnect()
}

// ── Channel chat ─────────────────────────────────────────────────

export function joinChannel(channelId, userMeta = {}) {
  if (socket && connected) socket.emit('channel:join', { channelId, ...userMeta })
}

export function leaveChannel(channelId) {
  if (socket && connected) socket.emit('channel:leave', { channelId })
}

/**
 * Emit a channel message via Socket.IO. Returns true if the socket
 * path was used. Caller should also call persistChannelMessage().
 */
export function emitChannelMessage(channelId, text, userMeta = {}) {
  if (socket && connected) {
    socket.emit('message:send', { channelId, text, ...userMeta })
    return true
  }
  return false
}

export function startTyping(channelId) {
  if (socket && connected) socket.emit('typing:start', { channelId })
}

export function stopTyping(channelId) {
  if (socket && connected) socket.emit('typing:stop', { channelId })
}

export function onChannelMessage(callback) {
  channelSubs.add(callback)
  return () => channelSubs.delete(callback)
}

// ── Direct messages ──────────────────────────────────────────────

export function emitDM(recipientTag, payload) {
  if (socket && connected) {
    socket.emit('dm:send', { recipientTag, ...payload })
    return true
  }
  return false
}

export function onDM(callback) {
  dmSubs.add(callback)
  return () => dmSubs.delete(callback)
}

// ── Presence ─────────────────────────────────────────────────────

export function onPresence(callback) {
  presenceSubs.add(callback)
  return () => presenceSubs.delete(callback)
}

export function isConnected() {
  return connected
}

// ── Supabase Realtime bridge ─────────────────────────────────────
//
// Subscribes to INSERTs on chat_messages + direct_messages and
// routes them through the same subscriber sets as Socket.IO events.
// This way the ChatContext can subscribe once and get messages from
// either transport without distinguishing.

let _supabaseChannel = null
let _subCount = 0

/**
 * Start listening to Supabase Realtime for chat_messages + direct_messages.
 * Returns an unsubscribe function. Safe to call multiple times — the
 * underlying channel is reference-counted and auto-cleanup'd.
 *
 * Call this once from ChatContext.
 */
export function subscribeToSupabaseChat({ onChannelMessage: onCh, onDM: onDirectMessage } = {}) {
  if (!isSupabaseConfigured()) return () => {}

  // Wire local subscriber sets
  if (onCh) channelSubs.add(onCh)
  if (onDirectMessage) dmSubs.add(onDirectMessage)

  _subCount += 1

  if (!_supabaseChannel) {
    _supabaseChannel = supabase
      .channel('public:chat_all')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        (payload) => {
          const row = payload.new
          const msg = {
            channelId: row.channel_id,
            text: row.text,
            userId: row.author_id,
            displayName: 'Member',
            created_at: row.created_at,
            _source: 'supabase'
          }
          channelSubs.forEach((fn) => {
            try { fn(msg) } catch (e) { console.error('[supabase] chat', e) }
          })
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'direct_messages' },
        (payload) => {
          const row = payload.new
          const msg = {
            senderTag: row.sender_tag,
            recipientTag: row.recipient_tag,
            senderName: row.sender_name,
            text: row.text,
            created_at: row.created_at,
            id: row.id,
            _source: 'supabase'
          }
          dmSubs.forEach((fn) => {
            try { fn(msg) } catch (e) { console.error('[supabase] dm', e) }
          })
        }
      )
      .subscribe()
  }

  return () => {
    _subCount = Math.max(0, _subCount - 1)
    if (onCh) channelSubs.delete(onCh)
    if (onDirectMessage) dmSubs.delete(onDirectMessage)
    if (_subCount === 0 && _supabaseChannel) {
      supabase.removeChannel(_supabaseChannel)
      _supabaseChannel = null
    }
  }
}

// ── Supabase persistence helpers ─────────────────────────────────

/**
 * Persist a channel message to Supabase.
 * Returns the inserted row or null if Supabase is not configured.
 */
export async function persistChannelMessage({ channelId, text, userId }) {
  if (!isSupabaseConfigured()) return null
  const { data, error } = await supabase
    .from('chat_messages')
    .insert({ channel_id: channelId, text: text.trim().slice(0, 1000), author_id: userId || null })
    .select()
    .single()
  if (error) { console.warn('[supabase] persistChannelMessage', error); return null }
  return data
}

/**
 * Persist a DM to Supabase.
 * Returns the inserted row or null if Supabase is not configured.
 */
export async function persistDM({ senderTag, recipientTag, senderName, text }) {
  if (!isSupabaseConfigured()) return null
  const { data, error } = await supabase
    .from('direct_messages')
    .insert({
      sender_tag: senderTag,
      recipient_tag: recipientTag,
      sender_name: senderName,
      text: text.trim().slice(0, 1000)
    })
    .select()
    .single()
  if (error) { console.warn('[supabase] persistDM', error); return null }
  return data
}

/**
 * Load historical DMs for a conversation between two tags.
 * Returns an array of rows ordered oldest → newest.
 */
export async function loadDMs({ myTag, otherTag, limit = 50 }) {
  if (!isSupabaseConfigured()) return []
  const { data, error } = await supabase
    .from('direct_messages')
    .select('*')
    .or(
      `and(sender_tag.eq.${myTag},recipient_tag.eq.${otherTag}),` +
      `and(sender_tag.eq.${otherTag},recipient_tag.eq.${myTag})`
    )
    .order('created_at', { ascending: true })
    .limit(limit)
  if (error) { console.warn('[supabase] loadDMs', error); return [] }
  return data || []
}

/**
 * Load historical channel messages.
 */
export async function loadChannelMessages(channelId, limit = 50) {
  if (!isSupabaseConfigured()) return []
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('channel_id', channelId)
    .order('created_at', { ascending: true })
    .limit(limit)
  if (error) { console.warn('[supabase] loadChannelMessages', error); return [] }
  return data || []
}

export default {
  getSocket,
  connectSocket,
  disconnectSocket,
  joinChannel,
  leaveChannel,
  emitChannelMessage,
  emitDM,
  startTyping,
  stopTyping,
  onChannelMessage,
  onDM,
  onPresence,
  isConnected,
  subscribeToSupabaseChat,
  persistChannelMessage,
  persistDM,
  loadDMs,
  loadChannelMessages
}

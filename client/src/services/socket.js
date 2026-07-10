/**
 * Socket.IO client
 *
 * Connects to the backend Socket.IO server for real-time chat and updates.
 * Will gracefully no-op if the backend is not running.
 */

import { io } from 'socket.io-client'

// Empty string = same origin (uses Vite proxy in dev, same domain in production)
// Otherwise use the configured VITE_SOCKET_URL
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || ''

let socket = null
let connected = false

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
    console.log('[Socket.IO] Connected')
  })

  socket.on('disconnect', () => {
    connected = false
    console.log('[Socket.IO] Disconnected')
  })

  socket.on('connect_error', (err) => {
    connected = false
    // Backend not running yet — silent fail
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

export function joinChannel(channelId) {
  if (socket && connected) socket.emit('channel:join', { channelId })
}

export function leaveChannel(channelId) {
  if (socket && connected) socket.emit('channel:leave', { channelId })
}

export function sendMessage(channelId, text) {
  if (socket && connected) {
    socket.emit('message:send', { channelId, text })
    return true
  }
  return false
}

export function onMessage(callback) {
  const sock = getSocket()
  sock.on('message:new', callback)
}

export function isConnected() {
  return connected
}

export default {
  getSocket,
  connectSocket,
  disconnectSocket,
  joinChannel,
  leaveChannel,
  sendMessage,
  onMessage,
  isConnected
}

/**
 * COC Clan Hub — Backend Server
 * Express + Socket.IO + Supabase + COC API proxy
 */

import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import { createServer } from 'http'
import { networkInterfaces } from 'os'

import { config } from './config/index.js'
import { defaultLimiter } from './middleware/rateLimit.js'
import { errorMiddleware } from './middleware/errorMiddleware.js'
import { setupSocketServer } from './sockets/index.js'

// Routes
import cocRoutes from './routes/coc.js'
import apiRoutes from './routes/api.js'
import adminRoutes from './routes/admin.js'
import cocAuthRoutes from './routes/cocAuth.js'

// ── App init ─────────────────────────────────────────────────
const app = express()
app.set('trust proxy', 1)

// ── CORS — allow localhost + any LAN IP (so phones on same WiFi can connect)
//   In production, set CLIENT_URL=https://yourdomain.com
app.use(cors({
  origin: (origin, callback) => {
    // Allow no-origin (curl, Postman, same-origin requests)
    if (!origin) return callback(null, true)
    // Allow configured production URL
    if (origin === config.clientUrl) return callback(null, true)
    // Allow any localhost / 127.0.0.1 dev port
    if (/^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) {
      return callback(null, true)
    }
    // Allow any private LAN IP (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
    if (/^https?:\/\/(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}):\d+$/.test(origin)) {
      return callback(null, true)
    }
    // Allow bare localhost (no port) — Capacitor's Android WebView sends
    // `Origin: https://localhost` (Capacitor 6+) or `http://localhost` (≤5)
    // when the app is loaded from the bundled assets, with no port suffix.
    if (origin === 'https://localhost' || origin === 'http://localhost') {
      return callback(null, true)
    }
    // Allow Capacitor scheme on the loopback IP variant (Capacitor 7+ on iOS)
    if (origin === 'capacitor://localhost') {
      return callback(null, true)
    }
    callback(new Error(`CORS: origin ${origin} not allowed`))
  },
  credentials: true
}))

app.use(express.json({ limit: '1mb' }))
app.use(morgan(config.nodeEnv === 'development' ? 'dev' : 'combined'))

// Rate limit all routes
app.use(defaultLimiter)

// ── Health check ─────────────────────────────────────────────
app.get('/', (_req, res) => {
  res.json({
    name: 'COC Clan Hub API',
    version: '0.1.0',
    supabase: config.isSupabaseConfigured() ? 'connected' : 'not configured',
    coc: config.isCocConfigured() ? 'configured' : 'not configured',
    docs: '/api/health'
  })
})

// ── Routes ───────────────────────────────────────────────────
app.use('/api', apiRoutes)
app.use('/api/coc', cocRoutes)
app.use('/api/coc-auth', cocAuthRoutes)
app.use('/api/admin', adminRoutes)

// ── 404 handler ──────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ message: `Not found: ${req.method} ${req.path}` })
})

// ── Error handler ────────────────────────────────────────────
app.use(errorMiddleware)

// ── Start server ─────────────────────────────────────────────
const httpServer = createServer(app)
setupSocketServer(httpServer, config.clientUrl)

httpServer.listen(config.port, '0.0.0.0', () => {
  const nets = networkInterfaces()
  const addresses = []
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        addresses.push(net.address)
      }
    }
  }

  const lanInfo = addresses.length > 0
    ? addresses.map(a => '   http://' + a + ':' + config.port).join('\n')
    : '   (no LAN IP detected — make sure you are on WiFi)'

  console.log([
    '',
    '╔═══════════════════════════════════════════════╗',
    '║   🏰  COC Clan Hub API Server                 ║',
    '║   Port: ' + String(config.port).padEnd(38) + '║',
    '║   Env:  ' + config.nodeEnv.padEnd(38) + '║',
    '║   Supabase: ' + (config.isSupabaseConfigured() ? 'connected' : 'not configured').padEnd(34) + '║',
    '║   COC API:   ' + (config.isCocConfigured() ? 'configured' : 'not configured').padEnd(34) + '║',
    '╚═══════════════════════════════════════════════╝',
    '',
    '📱 Access from your phone (same WiFi):',
    lanInfo,
    ''
  ].join('\n'))
})

export default app
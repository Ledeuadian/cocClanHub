import rateLimit from 'express-rate-limit'

// Rate limit for COC API proxy (be respectful)
export const cocApiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 30,             // 30 requests/min
  message: { message: 'Too many COC API requests, slow down chief!' }
})

// Stricter limit for auth endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 20,
  message: { message: 'Too many auth attempts, try again later' }
})

// Default for all routes
export const defaultLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { message: 'Too many requests' }
})
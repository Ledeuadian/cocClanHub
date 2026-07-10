/**
 * Generic error wrapper for async route handlers.
 */
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next)

/**
 * Central error handler middleware.
 */
export function errorMiddleware(err, req, res, _next) {
  const status = err.status || 500
  const message = err.message || 'Internal server error'

  if (status === 500) {
    console.error(`[ERROR] ${req.method} ${req.path}:`, err)
  }

  res.status(status).json({
    message,
    ...(process.env.NODE_ENV === 'development' && status === 500
      ? { stack: err.stack }
      : {})
  })
}
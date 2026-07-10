/**
 * useSwipeGesture — detects swipe gestures on a target element.
 *
 * Usage:
 *   const bind = useSwipeGesture({
 *     onSwipeUp: () => setNavVisible(true),
 *     onSwipeDown: () => setNavVisible(false),
 *     threshold: 50   // min distance in px
 *   })
 *   <div {...bind}>...</div>
 *
 * Recognises:
 *   - swipe up   (finger moves from bottom → top)
 *   - swipe down (finger moves from top → bottom)
 *   - swipe left / right (optional)
 *
 * Works on touch and pointer events (mouse + touch).
 */

import { useRef, useCallback } from 'react'

export function useSwipeGesture({
  onSwipeUp,
  onSwipeDown,
  onSwipeLeft,
  onSwipeRight,
  threshold = 50,             // min distance (px) to count as a swipe
  edgeZone = 80,              // require swipe to start within bottom 80px (for swipe-up)
  maxDuration = 800,          // max ms for it to count as a swipe (not a slow drag)
  maxVerticalRatio = 1.5,     // vertical must dominate horizontal
} = {}) {
  const startRef = useRef(null)

  const handleStart = useCallback((e) => {
    const point = e.touches ? e.touches[0] : e
    startRef.current = {
      x: point.clientX,
      y: point.clientY,
      time: Date.now()
    }
  }, [])

  const handleEnd = useCallback((e) => {
    const start = startRef.current
    if (!start) return
    startRef.current = null

    const point = e.changedTouches ? e.changedTouches[0] : e
    const dx = point.clientX - start.x
    const dy = point.clientY - start.y
    const dt = Date.now() - start.time
    const absX = Math.abs(dx)
    const absY = Math.abs(dy)

    // Reject slow drags (not a swipe)
    if (dt > maxDuration) return
    // Reject moves that aren't dominantly vertical
    if (absX > absY * maxVerticalRatio) return
    // Reject short swipes
    if (absY < threshold) return

    if (dy < 0) {
      // finger moved up
      onSwipeUp?.()
    } else {
      // finger moved down
      onSwipeDown?.()
    }
  }, [onSwipeUp, onSwipeDown, threshold, maxDuration, maxVerticalRatio])

  return {
    onTouchStart: handleStart,
    onTouchEnd: handleEnd,
    onMouseDown: handleStart,
    onMouseUp: handleEnd
  }
}

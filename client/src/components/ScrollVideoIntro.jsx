/**
 * <ScrollVideoIntro>
 *
 * A GSAP-driven, scroll-scrubbed video intro shown fullscreen before the
 * dashboard content. The component renders a fixed overlay that *itself*
 * scrolls internally, so it works regardless of the page's own overflow.
 *
 * Flow:
 *   1. A fixed `<div>` fills the viewport with a black background.
 *   2. Inside that is a tall scrollable "stage" whose height =
 *      videoDuration × pxPerSecond.
 *   3. The video is pinned inside that stage (via CSS sticky) and its
 *      `currentTime` is driven by the stage's scroll progress using
 *      a native `scroll` listener — no ScrollTrigger.pin conflicts.
 *   4. When the stage is scrolled to the end the intro is dismissed.
 *
 * Behaviors:
 *   - Body scroll is locked for the duration.
 *   - `prefers-reduced-motion` users skip the intro entirely.
 *   - Once dismissed, the intro is hidden until the next *cold start*.
 *     "Cold start" = either the user has never seen the intro, or the
 *     last activity in this storage is older than COLD_START_THRESHOLD_MS.
 */
import { useEffect, useRef, useState } from 'react'

const VIDEO_SRC = '/videos/intro.mp4'
const MIN_SCROLL_HEIGHT = 1500
const PX_PER_SECOND = 350              // lower = less seek work per pixel → smoother
const PROGRESS_TO_DISMISS = 0.98       // ≥98 % scrolled → intro ends
const SCROLL_STOP_DEBOUNCE_MS = 150    // pause the video after this much idle
const SEEK_THRESHOLD_S = 0.04          // ignore sub-frame seek deltas (avoid decoder thrash)

// localStorage keys
const LS_LAST_SEEN = 'coc-intro-last-seen'
const LS_HEARTBEAT = 'coc-intro-heartbeat'
const COLD_START_THRESHOLD_MS = 60 * 1000

function shouldShowIntro() {
  if (typeof window === 'undefined') return false
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false

  const now = Date.now()
  const lastSeen = Number(localStorage.getItem(LS_LAST_SEEN) || 0)

  // Never seen the intro -> always show.
  if (!lastSeen) return true

  // Otherwise only show if the last heartbeat is stale (page was inactive).
  const lastBeat = Number(localStorage.getItem(LS_HEARTBEAT) || 0)
  return !lastBeat || now - lastBeat >= COLD_START_THRESHOLD_MS
}

export default function ScrollVideoIntro() {
  const viewportRef = useRef(null)  // fixed shell – the scroll viewport
  const videoRef    = useRef(null)
  const [active, setActive]      = useState(false)
  const [ready, setReady]        = useState(false)
  const [hintVisible, setHint]   = useState(true)
  const [muted, setMuted]        = useState(true) // start muted, user can opt in
  const [spacerHeight, setSpacerHeight] = useState(MIN_SCROLL_HEIGHT)

  // ── Decide whether to show on mount ────────────────────────────────
  useEffect(() => {
    if (shouldShowIntro()) setActive(true)
  }, [])

  // ── Heartbeat: track page liveness so we can detect cold starts ────
  // While the page is visible, bump the heartbeat every 15s. When the
  // page is hidden, the heartbeat stops aging. On the next mount, if the
  // gap > threshold we treat it as a cold start and replay the intro.
  useEffect(() => {
    const TICK_MS = 15 * 1000
    const beat = () => {
      try { localStorage.setItem(LS_HEARTBEAT, String(Date.now())) } catch {}
    }
    const onVis = () => {
      if (document.visibilityState === 'visible') beat()
    }
    beat()                                              // initial beat
    document.addEventListener('visibilitychange', onVis)
    const id = setInterval(beat, TICK_MS)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  // ── Lock page scroll while the intro is up ─────────────────────────
  useEffect(() => {
    if (!active) return
    const origBody = document.body.style.overflow
    const origHtml = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = origBody
      document.documentElement.style.overflow = origHtml
    }
  }, [active])

  // ── Scroll → video-scrub engine ──────────────────────────────────
  // While the user scrolls: play video + sync currentTime to scroll position.
  // When scroll stops for > 150ms: pause the video.
  // Scroll to ≥98%: dismiss intro.
  useEffect(() => {
    if (!active) return
    const viewport = viewportRef.current
    const video    = videoRef.current
    if (!viewport || !video) return

    let stopTimer = null
    let done = false
    // Track whether we already attempted unmuted playback (the first
    // scroll event is a user gesture, so it unlocks audio).
    let audioUnlocked = false
    // rAF handle for the seek engine — hoisted so the cleanup closure can cancel it.
    let rafId = null

    const finish = () => {
      if (done) return
      done = true
      try { video.pause(); video.muted = true } catch {}
      try { localStorage.setItem(LS_LAST_SEEN, String(Date.now())) } catch {}
      setActive(false)
    }

    const onLoaded = () => {
      if (!Number.isFinite(video.duration) || video.duration <= 0) {
        finish(); return
      }
      const dur = video.duration
      // Set spacer height so scroll range = video duration in time
      const height = Math.max(MIN_SCROLL_HEIGHT, Math.round(dur * PX_PER_SECOND))
      setSpacerHeight(height)

      // Keep the video paused — we drive time entirely via scroll.
      // Calling play()/pause() during scrub forces the decoder to restart
      // on every seek, which is the main cause of stutter on mobile.
      try { video.pause(); video.currentTime = 0 } catch {}

      // ── rAF-coalesced seek engine ─────────────────────────────
      // Multiple scroll events fire between frames. We coalesce them
      // into a single seek per animation frame so the decoder is
      // asked to seek at most once every ~16 ms.
      let lastSeekTime = -Infinity    // last committed seek time

      const commitSeek = () => {
        rafId = null
        if (done) return

        const max = viewport.scrollHeight - viewport.clientHeight
        if (max <= 0) return

        const progress = Math.min(1, viewport.scrollTop / max)
        const targetTime = dur * progress

        // Hide hint after first meaningful scroll
        if (progress > 0.01) setHint(false)

        // Dismiss at ≥98% scrolled
        if (progress >= PROGRESS_TO_DISMISS) {
          clearTimeout(stopTimer)
          finish()
          return
        }

        // Only seek if the delta is large enough to matter.
        // This avoids hammering the decoder with sub-frame seeks that
        // aren't even visible on screen.
        if (Math.abs(targetTime - lastSeekTime) >= SEEK_THRESHOLD_S) {
          try { video.currentTime = targetTime } catch {}
          lastSeekTime = targetTime

          // After a seek, kick a single play() to let the browser decode
          // the new frame. The video will pause again the next time the
          // user stops scrolling. This is the standard "scrub" pattern
          // used by scroll-driven video libraries.
          if (video.paused) {
            try {
              video.muted = false
              setMuted(false)
              video.play().catch(() => {})
            } catch {}
          }
        }
      }

      const onScroll = () => {
        if (done) return

        // Unlock audio on first user interaction (scroll counts as gesture)
        if (!audioUnlocked) {
          audioUnlocked = true
          try {
            video.muted = false
            setMuted(false)
          } catch {}
        }

        // Coalesce — only request a new frame if one isn't pending
        if (!rafId) rafId = requestAnimationFrame(commitSeek)

        // Reset the "stop scrolling" debounce timer
        clearTimeout(stopTimer)
        stopTimer = setTimeout(() => {
          // Idle — pause to free the decoder
          if (!done && !video.paused) {
            try { video.pause() } catch {}
          }
        }, SCROLL_STOP_DEBOUNCE_MS)
      }

      viewport.addEventListener('scroll', onScroll, { passive: true })
      viewport.__onScroll = onScroll
    }

    const onErr = () => finish()

    if (video.readyState >= 1) onLoaded()
    else video.addEventListener('loadedmetadata', onLoaded, { once: true })
    video.addEventListener('error', onErr, { once: true })

    return () => {
      clearTimeout(stopTimer)
      if (rafId) { cancelAnimationFrame(rafId); rafId = null }
      video.removeEventListener('loadedmetadata', onLoaded)
      video.removeEventListener('error', onErr)
      if (viewport.__onScroll) {
        viewport.removeEventListener('scroll', viewport.__onScroll)
        delete viewport.__onScroll
      }
    }
  }, [active])

  // ── Mute/unmute toggle (used by the pill button) ─────────────────
  const toggleMute = () => {
    const video = videoRef.current
    if (!video) return
    const next = !muted
    try {
      video.muted = next
      setMuted(next)
    } catch { setMuted(next) }
  }

  if (!active) return null

  return (
    /* ── Outer fixed shell (black backdrop, never scrolls) ──────── */
    <div
      className="fixed inset-0 z-[100] bg-black"
      style={{ width: '100vw', height: '100vh' }}
      role="region"
      aria-label="Intro video"
    >
      {/* ── Scroll viewport (fills shell, own scrollbar hidden) ── */}
      <div
        ref={viewportRef}
        className="scroll-video-intro w-full h-full overflow-y-scroll overflow-x-hidden"
        style={{
          /* Keep the scrollbar functional but invisible – mouse wheel
             still scrolls, and the stage pointer-events stay active. */
          scrollbarWidth: 'none',                       // Firefox
          msOverflowStyle: 'none',                      // IE/Edge
        }}
      >
        {/*
          ── Spacer ───────────────────────────────────────────────
          Creates the scrollable range. Its height = videoDuration
          × PX_PER_SECOND (set via state once metadata loads).
          The video sits inside a sticky child that stays pinned
          to the top of the viewport while the spacer scrolls.
        */}
        <div style={{ height: spacerHeight ? `${spacerHeight}px` : '200vh', position: 'relative' }}>
          {/* ── Sticky video panel ──────────────────────────────── */}
          <div
            className="sticky top-0 left-0 w-full flex items-center justify-center"
            style={{ height: '100vh' }}
          >
            <video
              ref={videoRef}
              src={VIDEO_SRC}
              playsInline
              preload="auto"
              onCanPlay={() => setReady(true)}
              style={{
                display: 'block',
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />

            {/* Loading state */}
            {!ready && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 text-white/70">
                <svg className="w-8 h-8 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                <span className="text-xs tracking-wide">Loading intro…</span>
              </div>
            )}

            {/* Scroll-to-skip hint */}
            {hintVisible && ready && (
              <div className="pointer-events-none absolute bottom-16 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/80">
                <span className="text-xs uppercase tracking-[0.3em] select-none">
                  Scroll to play
                </span>
                <span className="block w-px h-10 bg-white/60 animate-pulse" />
              </div>
            )}

            {/* Mute / unmute pill */}
            {ready && (
              <button
                onClick={toggleMute}
                className="absolute top-4 right-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur text-white text-xs font-medium border border-white/20 transition-colors"
                aria-label={muted ? 'Unmute intro audio' : 'Mute intro audio'}
                title={muted ? 'Tap to enable audio' : 'Tap to mute'}
              >
                {muted ? (
                  <>
                    <VolumeXIcon />
                    <span>Sound off</span>
                  </>
                ) : (
                  <>
                    <VolumeIcon />
                    <span>Sound on</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Tiny inline SVG icons (avoids pulling lucide into the bundle) ──

function VolumeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  )
}

function VolumeXIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <line x1="23" y1="9" x2="17" y2="15" />
      <line x1="17" y1="9" x2="23" y2="15" />
    </svg>
  )
}

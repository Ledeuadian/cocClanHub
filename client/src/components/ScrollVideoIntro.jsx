/**
 * <ScrollVideoIntro>
 *
 * Autoplay fullscreen intro video shown once per cold start.
 *
 * Flow:
 *   1. A fixed `<div>` fills the viewport with the video playing natively.
 *   2. The video autoplays (muted, with audio unmuted on first user tap of
 *      the sound pill — required by iOS / Android autoplay policies).
 *   3. The video ends → intro is dismissed.
 *   4. The user can skip at any time via the "Skip" button or by tapping
 *      the sound pill once.
 *
 * Previous revisions tried scroll-driven scrubbing. That pattern forced
 * a seek/play call every animation frame, which caused constant decoder
 * restarts on mobile and was perceived as stutter. Native autoplay of the
 * same MP4 plays smoothly in the Capacitor WebView and in any browser.
 *
 * Behaviors:
 *   - Body scroll is locked for the duration.
 *   - `prefers-reduced-motion` users skip the intro entirely.
 *   - Once dismissed, the intro is hidden until the next cold start
 *     (no activity for COLD_START_THRESHOLD_MS).
 */
import { useEffect, useRef, useState } from 'react'

const VIDEO_SRC = '/videos/intro.mp4'
const AUTOPLAY_RETRY_MS = 600    // retry play() this often if blocked

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

  // Otherwise only show if the page was inactive for the cold-start window.
  const lastBeat = Number(localStorage.getItem(LS_HEARTBEAT) || 0)
  return !lastBeat || now - lastBeat >= COLD_START_THRESHOLD_MS
}

export default function ScrollVideoIntro() {
  const videoRef      = useRef(null)
  const [active, setActive]      = useState(false)
  const [ready, setReady]        = useState(false)
  const [muted, setMuted]        = useState(true) // start muted, user can opt in
  const [showHint, setShowHint]  = useState(true)

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

  // ── Autoplay + end-of-video dismiss ────────────────────────────────
  useEffect(() => {
    if (!active) return
    const video = videoRef.current
    if (!video) return

    let retried = false
    let retryTimer = null

    const tryPlay = async () => {
      try {
        // Always start muted — most reliable across iOS/Android WebView.
        // User can opt into sound via the pill button (a tap IS a gesture).
        video.muted = true
        await video.play()
      } catch {
        // Some WebViews reject autoplay on first cold start. Retry once
        // after a short delay; if it still fails, fall through and rely
        // on the user tapping the screen or the Skip button.
        if (!retried) {
          retried = true
          retryTimer = setTimeout(tryPlay, AUTOPLAY_RETRY_MS)
        }
      }
    }

    tryPlay()

    return () => {
      if (retryTimer) clearTimeout(retryTimer)
    }
  }, [active])

  const finish = () => {
    try { videoRef.current?.pause() } catch {}
    try { localStorage.setItem(LS_LAST_SEEN, String(Date.now())) } catch {}
    setActive(false)
  }

  const onVideoEnded = () => {
    setShowHint(false)
    finish()
  }

  // ── Mute / unmute toggle ──────────────────────────────────────────
  const toggleMute = () => {
    const video = videoRef.current
    if (!video) return
    const next = !muted
    try {
      video.muted = next
      setMuted(next)
      // First user interaction — safe to attempt playback with sound.
      if (!video.paused) video.play().catch(() => {})
    } catch {}
    // After any interaction, hide the hint.
    setShowHint(false)
  }

  // ── Skip ──────────────────────────────────────────────────────────
  const skip = () => {
    setShowHint(false)
    finish()
  }

  if (!active) return null

  return (
    /* ── Outer fixed shell (black backdrop) ──────────────────── */
    <div
      className="fixed inset-0 z-[100] bg-black"
      style={{ width: '100vw', height: '100vh' }}
      role="region"
      aria-label="Intro video"
    >
      {/* ── Video fills the screen ──────────────────────────────── */}
      <video
        ref={videoRef}
        src={VIDEO_SRC}
        autoPlay
        playsInline
        preload="auto"
        muted
        onCanPlay={() => setReady(true)}
        onEnded={onVideoEnded}
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

      {/* Tap-to-enable-sound hint, fades after first interaction */}
      {ready && showHint && (
        <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2 text-white/80 transition-opacity duration-500">
          <span className="text-xs uppercase tracking-[0.3em] select-none">
            Tap sound to enable audio
          </span>
        </div>
      )}

      {/* Skip button (top-right) — always visible, one tap to dismiss */}
      {ready && (
        <button
          onClick={skip}
          className="absolute top-4 right-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur text-white text-xs font-medium border border-white/20 transition-colors uppercase tracking-[0.2em]"
          aria-label="Skip intro video"
          title="Skip intro"
        >
          Skip
        </button>
      )}

      {/* Sound pill (bottom-right) — taps unlock audio */}
      {ready && (
        <button
          onClick={toggleMute}
          className="absolute bottom-6 right-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur text-white text-xs font-medium border border-white/20 transition-colors"
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

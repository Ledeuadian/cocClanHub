/**
 * <DashboardSection>
 *
 * A FULL-VIEWPORT scroll-driven preview section.
 *
 * Each section occupies 100vh on both mobile and desktop and is
 * "pinned" by GSAP ScrollTrigger while the user scrolls past it:
 *   - The section locks in place.
 *   - The character + card animate in.
 *   - Once everything has revealed, the pin releases and the next
 *     section scrolls into view.
 *
 * This produces the "full-page, one section at a time" feel used by
 * Apple product pages and many modern landing pages.
 *
 * Props:
 *   characterKey   string   Key in CHARACTERS (e.g. 'barbarian')
 *   title          string   Section heading (e.g. 'Members')
 *   to             string   Router path (e.g. '/members')
 *   icon           React    Lucide icon component
 *   accentOverride string   Optional accent colour override
 *   children       React    The preview content (stat chips, mini cards, etc.)
 *   index          number   Position — alternates character left/right
 *   loading        boolean  Show skeleton loader
 */
import { useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { getGsap } from '../lib/gsap.js'
import { getCharacter } from '../assets/characters/index.js'

export default function DashboardSection({
  characterKey,
  title,
  to,
  icon: Icon,
  accentOverride,
  children,
  index = 0,
  loading = false,
}) {
  const char = getCharacter(characterKey)
  const accent = accentOverride || char.accent
  const sectionRef = useRef(null)
  const cardRef    = useRef(null)
  const charRef    = useRef(null)
  const titleRef   = useRef(null)
  const [imgFailed, setImgFailed] = useState(false)

  // Character sits on the left for even sections, right for odd sections.
  const charOnLeft = index % 2 === 0

  useLayoutEffect(() => {
    const section = sectionRef.current
    if (!section || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const { gsap, ScrollTrigger } = getGsap()
    const card     = cardRef.current
    const charEl   = charRef.current
    const titleEl  = titleRef.current

    const ctx = gsap.context(() => {
      // ── PIN the section in place while it reveals ────────────────
      // End after 80% of one viewport of scroll, so the user advances
      // ~80vh before the pin releases and the next section slides in.
      // `pinSpacing: true` (the default) inserts a spacer equal to the
      // pinned distance after the section, so the next section starts
      // below it instead of overlapping. Without this the sections stack
      // on top of each other because each is 100vh.
      const pinTrigger = ScrollTrigger.create({
        trigger: section,
        start: 'top top',
        end: '+=80%',
        pin: true,
        pinSpacing: true,
        anticipatePin: 1,
      })

      // ── Title slides in from top ─────────────────────────────────
      if (titleEl) {
        gsap.fromTo(
          titleEl,
          { autoAlpha: 0, y: -40 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.7,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: section,
              start: 'top 70%',
              once: true,
            },
          }
        )
      }

      // ── Character: scale + float in ──────────────────────────────
      if (charEl) {
        gsap.fromTo(
          charEl,
          { autoAlpha: 0, scale: 0.6, y: 60, rotate: charOnLeft ? -8 : 8 },
          {
            autoAlpha: 1,
            scale: 1,
            y: 0,
            rotate: 0,
            duration: 1,
            ease: 'back.out(1.5)',
            scrollTrigger: {
              trigger: section,
              start: 'top 65%',
              once: true,
            },
          }
        )
      }

      // ── Card slides in from the opposite side ────────────────────
      if (card) {
        gsap.fromTo(
          card,
          { autoAlpha: 0, x: charOnLeft ? 80 : -80, y: 20 },
          {
            autoAlpha: 1,
            x: 0,
            y: 0,
            duration: 0.85,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: section,
              start: 'top 60%',
              once: true,
            },
          }
        )
      }

      // ── Stat chips stagger in ────────────────────────────────────
      const chips = card?.querySelectorAll('[data-stat-chip]')
      if (chips && chips.length) {
        gsap.fromTo(
          chips,
          { autoAlpha: 0, y: 24, scale: 0.9 },
          {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            duration: 0.45,
            stagger: 0.08,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: section,
              start: 'top 55%',
              once: true,
            },
          }
        )
      }
    }, section)

    return () => {
      ctx.revert()
      ScrollTrigger.refresh()
    }
  }, [charOnLeft])

  return (
    <section
      ref={sectionRef}
      className="relative w-full overflow-hidden flex items-center justify-center"
      data-scroll-3d="off"
      style={{
        minHeight: '100vh',
        height: '100vh',
        background: `
          radial-gradient(circle at ${charOnLeft ? '20%' : '80%'} 50%, ${accent}1F 0%, transparent 55%),
          linear-gradient(180deg, ${accent}0A 0%, transparent 100%)
        `,
      }}
    >
      {/* ── Top accent bar ─────────────────────────────────────────── */}
      <div
        className="absolute top-0 left-0 right-0 h-[3px] z-10"
        style={{ background: `linear-gradient(90deg, ${accent} 0%, transparent 100%)` }}
      />

      {/* ── Layout grid (alternating sides, centered) ──────────────── */}
      <div
        className={`
          grid items-center gap-6 md:gap-12 w-full
          max-w-6xl px-4 sm:px-6
          grid-cols-1
          ${charOnLeft ? 'md:grid-cols-2' : 'md:grid-cols-2'}
        `}
        style={{ order: charOnLeft ? 0 : 0 }}
      >
        {/* ── Character (left on even, right on odd — on desktop) ──── */}
        <div
          className={`
            flex flex-col items-center justify-center pointer-events-none select-none
            ${charOnLeft ? 'md:order-1' : 'md:order-2'}
          `}
        >
          <div
            ref={charRef}
            className="flex flex-col items-center"
            style={{ filter: 'drop-shadow(0 16px 36px rgba(0,0,0,.4))' }}
          >
            {imgFailed || !char.src ? (
              <div
                className="w-44 h-44 md:w-56 md:h-56 rounded-3xl flex items-center justify-center text-6xl md:text-7xl"
                style={{
                  background: `${accent}22`,
                  border: `3px solid ${accent}55`,
                  boxShadow: `0 0 60px ${accent}33`,
                }}
              >
                {char.emoji}
              </div>
            ) : (
              <img
                src={char.src}
                alt={char.name}
                className="w-44 h-44 md:w-56 md:h-56 object-contain"
                draggable={false}
                onError={() => setImgFailed(true)}
              />
            )}
            <span
              className="mt-3 text-xs md:text-sm font-semibold uppercase tracking-[0.25em]"
              style={{ color: accent }}
            >
              {char.name}
            </span>
            {char.tagline && (
              <span className="mt-1 text-[11px] text-clan-muted italic">
                {char.tagline}
              </span>
            )}
          </div>
        </div>

        {/* ── Card with stats ──────────────────────────────────────── */}
        <div
          ref={cardRef}
          className={`
            ${charOnLeft ? 'md:order-2' : 'md:order-1'}
          `}
        >
          <div className="card relative z-10">
            <div ref={titleRef} className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                {Icon && <Icon className="w-5 h-5" style={{ color: accent }} />}
                <h2 className="section-title !mb-0 !text-base md:!text-lg">{title}</h2>
              </div>
              {to && (
                <Link
                  to={to}
                  className="text-xs font-medium flex items-center gap-1 transition-colors hover:underline"
                  style={{ color: accent }}
                >
                  View All <ArrowRight className="w-3 h-3" />
                </Link>
              )}
            </div>

            {loading ? (
              <div className="space-y-2">
                <div className="h-5 rounded bg-clan-surface animate-pulse w-3/4" />
                <div className="h-5 rounded bg-clan-surface animate-pulse w-1/2" />
                <div className="h-5 rounded bg-clan-surface animate-pulse w-2/3" />
              </div>
            ) : (
              children
            )}
          </div>
        </div>
      </div>

      {/* ── Scroll hint (only on the first few sections) ──────────── */}
      {index < 2 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-none">
          <div className="flex flex-col items-center gap-1 text-white/40">
            <span className="text-[10px] uppercase tracking-[0.3em]">Scroll</span>
            <div className="w-5 h-9 rounded-full border border-white/30 flex items-start justify-center p-1">
              <div
                className="w-1 h-2 rounded-full animate-bounce"
                style={{ background: accent }}
              />
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

/**
 * <StatChip>
 *
 * A small stat preview chip rendered inside a <DashboardSection>
 * (and inside the hero header). `data-stat-chip` lets GSAP stagger
 * the entrance when this chip is inside a <DashboardSection>.
 *
 * Two modes:
 *   - <StatChip label="Members" value="48" />
 *   - <StatChip icon={Users} value="48" />
 */
export function StatChip({ label, icon: Icon, value, color = 'text-clan-text', accent }) {
  return (
    <div
      data-stat-chip
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-clan-surface border border-clan-border text-sm"
    >
      {Icon && <Icon className="w-4 h-4" style={accent ? { color: accent } : undefined} />}
      {label && <span className="text-clan-muted text-xs">{label}</span>}
      <span className={`font-semibold ${color}`} style={accent ? { color: accent } : undefined}>
        {value}
      </span>
    </div>
  )
}

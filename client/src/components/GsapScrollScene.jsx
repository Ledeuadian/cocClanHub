/**
 * <GsapScrollScene>
 *
 * Route-aware global scene. It discovers cards and other marked elements
 * on every page and gives each one its own ScrollTrigger-powered 3D
 * entrance. This means all existing and future pages receive the effect
 * without needing animation code in each page component.
 *
 * Add `data-scroll-3d` to any element to opt it in explicitly.
 * Add `data-scroll-3d="off"` to a card to exclude it.
 */
import { useLayoutEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { getGsap } from '../lib/gsap.js'

export default function GsapScrollScene({ children }) {
  const rootRef = useRef(null)
  const location = useLocation()

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const { gsap, ScrollTrigger } = getGsap()
    let ctx
    let frame

    // Let React commit the new route before discovering its DOM nodes.
    frame = requestAnimationFrame(() => {
      const elements = Array.from(
        root.querySelectorAll('.card, [data-scroll-3d]')
      ).filter((el) => {
        // Excluded by explicit data attribute
        if (el.dataset.scroll3d === 'off') return false
        // Excluded because it lives inside a <DashboardSection> which
        // already manages its own GSAP entrance — double-animating the
        // card would fight the section's own scrollTrigger.
        if (el.closest('[data-scroll-3d="off"]')) return false
        // Skip if already managed by a local <ScrollSection>.
        if (el.closest('.will-change-transform')) return false
        return true
      })

      ctx = gsap.context(() => {
        elements.forEach((element, index) => {
          // Skip if already managed by a local <ScrollSection>.
          if (element.closest('.will-change-transform')) return

          gsap.fromTo(
            element,
            {
              autoAlpha: 0,
              y: 44,
              rotateX: -18,
              rotateY: index % 2 === 0 ? -4 : 4,
              scale: 0.96,
              transformOrigin: 'center bottom',
            },
            {
              autoAlpha: 1,
              y: 0,
              rotateX: 0,
              rotateY: 0,
              scale: 1,
              duration: 0.85,
              ease: 'power3.out',
              scrollTrigger: {
                trigger: element,
                start: 'top 88%',
                once: true,
              },
            }
          )
        })
      }, root)

      ScrollTrigger.refresh()
    })

    return () => {
      cancelAnimationFrame(frame)
      ctx?.revert()
    }
  }, [location.pathname])

  return (
    <main
      ref={rootRef}
      className="gsap-scroll-scene flex-1 overflow-y-auto"
    >
      {children}
    </main>
  )
}

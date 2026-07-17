/**
 * useGsapScroll3D
 *
 * Generic hook that animates a container's direct children with a 3D
 * rotation + fade-in as the user scrolls. Cleans up the ScrollTrigger
 * on unmount. Falls back to immediate render when the user has
 * prefers-reduced-motion enabled.
 *
 * Usage:
 *   const ref = useGsapScroll3D({ stagger: 0.12, rotateX: 60 })
 *   <div ref={ref}>...</div>
 *
 * Or scoped to a selector inside the container:
 *   const ref = useGsapScroll3D({ selector: '.card' })
 */
import { useLayoutEffect, useRef } from 'react'
import { getGsap } from '../lib/gsap.js'

export default function useGsapScroll3D(options = {}) {
  const {
    selector,           // CSS selector inside the container; default = direct children
    stagger = 0.08,
    rotateX = -45,
    rotateY = 0,
    y = 60,
    scale = 0.92,
    duration = 0.9,
    ease = 'power3.out',
    start = 'top 85%',
    once = true,
    perspective = 1200,
    applyPerspective = true,
  } = options

  const ref = useRef(null)

  useLayoutEffect(() => {
    if (!ref.current) return

    // Respect user motion preference
    if (typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return
    }

    const { gsap, ScrollTrigger } = getGsap()
    const root = ref.current
    const targets = selector
      ? root.querySelectorAll(selector)
      : root.children

    if (!targets.length) return

    if (applyPerspective) {
      root.style.perspective = `${perspective}px`
    }

    const ctx = gsap.context(() => {
      gsap.from(targets, {
        opacity: 0,
        y,
        rotateX,
        rotateY,
        scale,
        duration,
        ease,
        stagger,
        scrollTrigger: {
          trigger: root,
          start,
          toggleActions: once ? 'play none none none' : 'play reverse play reverse',
        },
      })
    }, root)

    return () => {
      ctx.revert()
      ScrollTrigger.refresh()
    }
  }, [selector, stagger, rotateX, rotateY, y, scale, duration, ease, start, once, perspective, applyPerspective])

  return ref
}

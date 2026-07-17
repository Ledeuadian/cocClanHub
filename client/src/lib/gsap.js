/**
 * Centralised GSAP + ScrollTrigger setup.
 *
 * Importing this module (rather than `gsap` directly) guarantees that
 * the ScrollTrigger plugin is registered exactly once, regardless of
 * how many files import it.
 */
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

let registered = false

export function getGsap() {
  if (!registered) {
    gsap.registerPlugin(ScrollTrigger)
    registered = true
  }
  return { gsap, ScrollTrigger }
}

export { gsap, ScrollTrigger }

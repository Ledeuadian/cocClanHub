/**
 * <Card3D>
 *
 * A card that tilts toward the cursor on hover (slight rotateX/Y) and
 * lifts on enter. Pure CSS — no scroll triggers — so it works on every
 * surface (mobile too). Use it to enhance individual cards inside a
 * <ScrollSection>.
 */
import { useRef } from 'react'
import { cn } from '../lib/utils.js'

export default function Card3D({ className, children, intensity = 8, ...rest }) {
  const ref = useRef(null)

  const onMove = (e) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const px = (e.clientX - rect.left) / rect.width  - 0.5
    const py = (e.clientY - rect.top)  / rect.height - 0.5
    el.style.transform =
      `perspective(900px) rotateY(${px * intensity * 2}deg) rotateX(${-py * intensity * 2}deg) translateZ(0)`
  }

  const onLeave = () => {
    if (ref.current) ref.current.style.transform = ''
  }

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={cn(
        'transition-transform duration-200 ease-out will-change-transform',
        className
      )}
      {...rest}
    >
      {children}
    </div>
  )
}

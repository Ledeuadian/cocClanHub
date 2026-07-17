/**
 * <ScrollSection>
 *
 * Wraps a section of the page and animates its direct children with a
 * GSAP-powered 3D scroll-in effect. Pass `selector` to target specific
 * children instead. Drop-in replacement for a plain <div> wrapper.
 */
import useGsapScroll3D from '../hooks/useGsapScroll3D.js'
import { cn } from '../lib/utils.js'

export default function ScrollSection({
  as: Tag = 'section',
  className,
  children,
  ...opts
}) {
  const ref = useGsapScroll3D(opts)
  return (
    <Tag ref={ref} className={cn('will-change-transform', className)}>
      {children}
    </Tag>
  )
}

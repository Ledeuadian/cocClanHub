import { cn } from '../../lib/utils.js'

const sizes = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-lg',
  xl: 'w-20 h-20 text-2xl'
}

export default function Avatar({ src, alt, fallback, size = 'md', className }) {
  return (
    <div className={cn('rounded-full overflow-hidden flex items-center justify-center shrink-0 bg-gradient-to-br from-clan-accent to-clan-elixir text-clan-darker font-bold', sizes[size], className)}>
      {src ? (
        <img src={src} alt={alt} className="w-full h-full object-cover" />
      ) : (
        <span>{fallback || alt?.[0]?.toUpperCase() || '?'}</span>
      )}
    </div>
  )
}
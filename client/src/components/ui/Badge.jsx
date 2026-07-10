import { cn } from '../../lib/utils.js'

export default function Badge({ children, variant = 'default', className }) {
  const variants = {
    default: 'bg-clan-card text-clan-text border border-clan-border',
    success: 'bg-green-900/40 text-green-300 border border-green-700',
    danger: 'bg-red-900/40 text-red-300 border border-red-700',
    warning: 'bg-amber-900/40 text-amber-300 border border-amber-700',
    info: 'bg-blue-900/40 text-blue-300 border border-blue-700',
    elixir: 'bg-purple-900/40 text-purple-300 border border-purple-700'
  }

  return (
    <span className={cn('badge', variants[variant] || variants.default, className)}>
      {children}
    </span>
  )
}
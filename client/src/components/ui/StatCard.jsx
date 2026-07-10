import { cn } from '../../lib/utils.js'

export default function StatCard({ icon: Icon, label, value, sublabel, color = 'text-clan-accent', className }) {
  return (
    <div className={cn('card flex flex-col gap-1', className)}>
      <div className="flex items-center justify-between">
        {label && <span className="text-xs text-clan-muted">{label}</span>}
        {Icon && <Icon className={cn('w-4 h-4', color)} />}
      </div>
      <span className={cn('text-2xl font-bold', color)}>{value}</span>
      {sublabel && <span className="text-xs text-clan-muted">{sublabel}</span>}
    </div>
  )
}
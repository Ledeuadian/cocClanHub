import { cn, ROLE_BADGES } from '../../lib/utils.js'

export default function RoleBadge({ role, className }) {
  const label = {
    leader: 'Leader',
    coLeader: 'Co-Leader',
    elder: 'Elder',
    member: 'Member'
  }[role] || role

  return (
    <span className={cn('badge', ROLE_BADGES[role] || ROLE_BADGES.member, className)}>
      {label}
    </span>
  )
}
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export function formatNumber(n) {
  if (n == null) return '0'
  return new Intl.NumberFormat('en-US').format(n)
}

export function formatTag(tag) {
  if (!tag) return ''
  return tag.startsWith('#') ? tag : `#${tag}`
}

export function timeAgo(date) {
  if (!date) return ''
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  const intervals = {
    year: 31536000,
    month: 2592000,
    week: 604800,
    day: 86400,
    hour: 3600,
    minute: 60
  }
  for (const [unit, value] of Object.entries(intervals)) {
    const count = Math.floor(seconds / value)
    if (count >= 1) return `${count}${unit[0]}${count === 1 ? '' : ''} ago`
  }
  return 'just now'
}

export const ROLE_COLORS = {
  leader: 'text-clan-danger',
  coLeader: 'text-clan-accent',
  elder: 'text-clan-elixir',
  member: 'text-clan-text'
}

export const ROLE_BADGES = {
  leader: 'bg-red-900/40 text-red-300 border border-red-700',
  coLeader: 'bg-amber-900/40 text-amber-300 border border-amber-700',
  elder: 'bg-purple-900/40 text-purple-300 border border-purple-700',
  member: 'bg-slate-800 text-slate-300 border border-slate-700'
}
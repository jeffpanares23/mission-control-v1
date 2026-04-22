import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: (string | boolean | undefined | null)[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

export function formatRelative(date: string | Date): string {
  const now = new Date()
  const d = new Date(date)
  const diffMs = d.getTime() - now.getTime()
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  if (diffDays === -1) return 'Yesterday'
  if (diffDays > 1) return `In ${diffDays} days`
  return `${Math.abs(diffDays)} days ago`
}

export function priorityColor(priority: string): string {
  switch (priority) {
    case 'urgent': return 'priority-urgent'
    case 'high': return 'priority-high'
    case 'medium': return 'priority-medium'
    case 'low': return 'priority-low'
    default: return 'priority-medium'
  }
}

export function statusColor(status: string): string {
  switch (status) {
    case 'done':        return 'badge-success'
    case 'in_progress': return 'badge-info'
    case 'review':      return 'badge-warning'
    case 'scheduled':   return 'badge-info'
    case 'waiting':     return 'badge-purple'
    case 'todo':        return 'badge-neutral'
    case 'backlog':     return 'badge-neutral'
    case 'cancelled':   return 'badge-error'
    default:            return 'badge-neutral'
  }
}

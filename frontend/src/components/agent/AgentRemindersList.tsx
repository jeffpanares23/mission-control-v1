// Agent Reminders List — shows agent_reminders with text, remind_at, status
import { useState } from 'react'
import { Clock, Bell, BellOff, CheckCircle2 } from 'lucide-react'
import type { AgentReminder } from '@/types'
import { formatRelative } from '@/lib/utils'

const STATUS_ICON: Record<string, React.ReactNode> = {
  pending:   <Bell className="w-[10px] h-[10px]" style={{ color: '#f59e0b' }} />,
  sent:      <CheckCircle2 className="w-[10px] h-[10px]" style={{ color: '#10b981' }} />,
  cancelled: <BellOff className="w-[10px] h-[10px]" style={{ color: '#6b7280' }} />,
}

const STATUS_COLOR: Record<string, string> = {
  pending:   '#f59e0b',
  sent:      '#10b981',
  cancelled:  '#6b7280',
}

interface Props {
  reminders: AgentReminder[]
  loading: boolean
}

export function AgentRemindersList({ reminders, loading }: Props) {
  const [filter, setFilter] = useState<'all' | 'pending' | 'sent' | 'cancelled'>('all')

  const filtered = reminders.filter(r => {
    if (filter === 'all') return true
    return r.status === filter
  })

  if (loading) {
    return (
      <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{
            height: '56px', borderRadius: '8px',
            background: 'rgba(255,255,255,0.03)', border: '1px solid var(--color-border)',
            animation: 'pulse 2s infinite',
          }} />
        ))}
      </div>
    )
  }

  const pendingCount = reminders.filter(r => r.status === 'pending').length

  return (
    <div style={{ padding: '10px' }}>
      {/* Summary */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        <Bell className="w-[12px] h-[12px]" style={{ color: 'var(--color-accent)' }} />
        <span style={{ fontSize: '11px', color: 'var(--color-text-3)' }}>
          {pendingCount} pending
        </span>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '8px', flexWrap: 'wrap' }}>
        {(['all', 'pending', 'sent', 'cancelled'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              flex: 1, minWidth: '40px', padding: '4px 2px',
              fontSize: '10px', fontWeight: 600,
              background: filter === f ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${filter === f ? 'rgba(245,158,11,0.4)' : 'var(--color-border)'}`,
              borderRadius: '6px', cursor: 'pointer',
              color: filter === f ? '#f59e0b' : 'var(--color-text-3)',
              textTransform: 'capitalize',
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Reminder list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {filtered.map(reminder => {
          const isPast = reminder.status === 'pending' && new Date(reminder.remind_at) < new Date()
          return (
            <div
              key={reminder.id}
              style={{
                padding: '8px 10px',
                background: 'rgba(255,255,255,0.03)',
                border: `1px solid ${isPast ? 'rgba(239,68,68,0.3)' : 'var(--color-border)'}`,
                borderRadius: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                {/* Status icon */}
                <div style={{ flexShrink: 0, marginTop: '2px' }}>
                  {STATUS_ICON[reminder.status]}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Text */}
                  <p style={{ fontSize: '11px', fontWeight: 500, color: 'var(--color-text)', lineHeight: 1.4, marginBottom: '4px' }}>
                    {reminder.text}
                  </p>

                  {/* Remind at */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <Clock className="w-[9px] h-[9px]" style={{ color: isPast ? '#ef4444' : 'var(--color-text-3)' }} />
                    <span style={{ fontSize: '10px', color: isPast ? '#ef4444' : 'var(--color-text-3)' }}>
                      {formatRelative(reminder.remind_at)}
                    </span>
                    <span style={{
                      fontSize: '9px',
                      color: STATUS_COLOR[reminder.status],
                      background: `${STATUS_COLOR[reminder.status]}18`,
                      borderRadius: '4px', padding: '0 4px', marginLeft: '4px',
                      textTransform: 'capitalize',
                    }}>
                      {reminder.status}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )
        })}

        {filtered.length === 0 && (
          <p style={{ textAlign: 'center', padding: '20px', fontSize: '12px', color: 'var(--color-text-3)' }}>
            No reminders to display
          </p>
        )}
      </div>
    </div>
  )
}

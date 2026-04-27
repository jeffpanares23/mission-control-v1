// Agent Tasks List — shows agent_tasks with title, status, priority, due_date
import { useState } from 'react'
import { Calendar, AlertTriangle } from 'lucide-react'
import type { AgentTask } from '@/types'
import { formatRelative } from '@/lib/utils'

const PRIORITY_COLOR: Record<string, string> = {
  urgent: '#ef4444',
  high:   '#f97316',
  medium: '#eab308',
  low:    '#3b82f6',
}

const STATUS_BADGE: Record<string, string> = {
  backlog:      'badge-gray',
  scheduled:    'badge-gray',
  in_progress:  'badge-blue',
  waiting:      'badge-yellow',
  review:       'badge-yellow',
  done:         'badge-green',
  cancelled:    'badge-red',
}

interface Props {
  tasks: AgentTask[]
  loading: boolean
}

export function AgentTasksList({ tasks, loading }: Props) {
  const [filter, setFilter] = useState<'all' | 'pending' | 'done'>('all')

  const filtered = tasks.filter(t => {
    if (filter === 'pending') return t.status !== 'done' && t.status !== 'cancelled'
    if (filter === 'done') return t.status === 'done' || t.status === 'cancelled'
    return true
  })

  if (loading) {
    return (
      <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{
            height: '52px', borderRadius: '8px',
            background: 'rgba(255,255,255,0.03)', border: '1px solid var(--color-border)',
            animation: 'pulse 2s infinite',
          }} />
        ))}
      </div>
    )
  }

  const pendingCount = tasks.filter(t => t.status !== 'done' && t.status !== 'cancelled').length
  const doneCount = tasks.filter(t => t.status === 'done' || t.status === 'cancelled').length

  return (
    <div style={{ padding: '10px' }}>
      {/* Summary */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', flexWrap: 'wrap' }}>
        <TaskStatPill label="Pending" value={pendingCount} color="#f59e0b" />
        <TaskStatPill label="Done" value={doneCount} color="#10b981" />
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
        {(['all', 'pending', 'done'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              flex: 1, padding: '4px',
              fontSize: '10px', fontWeight: 600,
              background: filter === f ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${filter === f ? 'rgba(59,130,246,0.4)' : 'var(--color-border)'}`,
              borderRadius: '6px', cursor: 'pointer',
              color: filter === f ? '#60a5fa' : 'var(--color-text-3)',
              textTransform: 'capitalize',
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Task list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {filtered.map(task => {
          const isOverdue = !!task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done'
          return (
            <div
              key={task.id}
              style={{
                padding: '8px 10px',
                background: 'rgba(255,255,255,0.03)',
                border: `1px solid ${isOverdue ? 'rgba(239,68,68,0.3)' : 'var(--color-border)'}`,
                borderRadius: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                {/* Priority dot */}
                <div style={{
                  width: '6px', height: '6px', borderRadius: '50%',
                  background: PRIORITY_COLOR[task.priority] ?? '#3b82f6',
                  flexShrink: 0, marginTop: '4px',
                }} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Status + priority */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                    <span className={`badge ${STATUS_BADGE[task.status] ?? 'badge-gray'}`} style={{ fontSize: '9px' }}>
                      {task.status.replace('_', ' ')}
                    </span>
                    <span style={{ fontSize: '9px', color: 'var(--color-text-3)', textTransform: 'capitalize' }}>
                      {task.priority}
                    </span>
                    {isOverdue && (
                      <AlertTriangle className="w-[10px] h-[10px]" style={{ color: '#ef4444', marginLeft: 'auto' }} />
                    )}
                  </div>

                  {/* Title */}
                  <p style={{ fontSize: '11px', fontWeight: 500, color: 'var(--color-text)', lineHeight: 1.4 }}>
                    {task.title}
                  </p>

                  {/* Due date */}
                  {task.due_date && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginTop: '4px' }}>
                      <Calendar className="w-[9px] h-[9px]" style={{ color: isOverdue ? '#ef4444' : 'var(--color-text-3)' }} />
                      <span style={{ fontSize: '10px', color: isOverdue ? '#ef4444' : 'var(--color-text-3)' }}>
                        {formatRelative(task.due_date)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}

        {filtered.length === 0 && (
          <p style={{ textAlign: 'center', padding: '20px', fontSize: '12px', color: 'var(--color-text-3)' }}>
            No tasks to display
          </p>
        )}
      </div>
    </div>
  )
}

function TaskStatPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '5px',
      padding: '4px 8px',
      background: `${color}15`, border: `1px solid ${color}30`,
      borderRadius: '6px',
    }}>
      <span style={{ fontSize: '12px', fontWeight: 700, color }}>{value}</span>
      <span style={{ fontSize: '10px', color: 'var(--color-text-3)' }}>{label}</span>
    </div>
  )
}

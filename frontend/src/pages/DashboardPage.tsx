import { useState, useEffect } from 'react'
import { Plus, Calendar, AlertTriangle, ArrowRight, GripVertical } from 'lucide-react'
import { cn, formatRelative } from '@/lib/utils'
import { api } from '@/lib/api'
import type { Task, TaskStatus } from '@/types'

const COLUMNS: { id: string; title: string; status: TaskStatus }[] = [
  { id: 'backlog',      title: 'Backlog',      status: 'backlog' },
  { id: 'todo',         title: 'To Do',         status: 'todo' },
  { id: 'in_progress',  title: 'In Progress',   status: 'in_progress' },
  { id: 'review',       title: 'Review',        status: 'review' },
  { id: 'done',         title: 'Done',          status: 'done' },
]

const PRIORITY_COLOR: Record<string, string> = {
  urgent: '#ef4444',
  high:   '#f97316',
  medium: '#eab308',
  low:    '#3b82f6',
}

const STATUS_BADGE: Record<string, string> = {
  backlog:      'badge-gray',
  todo:         'badge-gray',
  in_progress:  'badge-blue',
  review:       'badge-yellow',
  done:         'badge-green',
  cancelled:    'badge-red',
}

export function DashboardPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [view, setView] = useState<'kanban' | 'list'>('kanban')
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<{
    total_tasks: number; done_tasks: number;
    overdue_tasks: number; high_priority_tasks: number; completion_rate: number;
  } | null>(null)

  useEffect(() => {
    Promise.all([
      api.dashboard.get().catch(() => null),
      api.tasks.list().catch(() => null),
    ]).then(([dashRes, tasksRes]) => {
      if (dashRes?.data) setStats(dashRes.data.stats)
      if (tasksRes?.data) setTasks(tasksRes.data)
      setLoading(false)
    })
  }, [])

  const byColumn = COLUMNS.reduce((acc, col) => {
    acc[col.id] = tasks.filter(t => t.column_status === col.id || t.status === col.status)
    return acc
  }, {} as Record<string, Task[]>)

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid var(--color-border)', flexShrink: 0,
      }}>
        <div>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-text)' }}>
            Command Center
          </h2>
          <p style={{ fontSize: '11px', color: 'var(--color-text-3)', marginTop: '2px' }}>
            {tasks.length} tasks · {stats ? `${stats.completion_rate}% complete` : '—'}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* View toggle */}
          <div className="tab-toggle">
            <button onClick={() => setView('kanban')} className={view === 'kanban' ? 'active' : ''}>Board</button>
            <button onClick={() => setView('list')} className={view === 'list' ? 'active' : ''}>List</button>
          </div>

          {/* New task */}
          <button className="btn btn-primary">
            <Plus className="w-[13px] h-[13px]" />
            New Task
          </button>
        </div>
      </div>

      {/* Board */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px' }}>
            <p style={{ color: 'var(--color-text-3)', fontSize: '13px', animation: 'pulse 2s infinite' }}>
              Loading Mission Control...
            </p>
          </div>
        ) : view === 'kanban' ? (
          <div style={{ display: 'flex', gap: '12px', minHeight: '100%', width: 'max-content', minWidth: '100%' }}>
            {COLUMNS.map(col => (
              <KanbanColumn
                key={col.id}
                id={col.id}
                title={col.title}
                tasks={byColumn[col.id] ?? []}
              />
            ))}
          </div>
        ) : (
          <TaskListView tasks={tasks} />
        )}
      </div>
    </div>
  )
}

function KanbanColumn({ id, title, tasks }: { id: string; title: string; tasks: Task[] }) {
  return (
    <div className={cn('kanban-col', id)}>
      <div className="kanban-col-header">
        <span className="kanban-col-title">{title}</span>
        <span className="kanban-col-count">{tasks.length}</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {tasks.map(task => (
          <TaskCard key={task.id} task={task} />
        ))}

        {tasks.length === 0 && (
          <div style={{
            padding: '16px', textAlign: 'center', borderRadius: '10px',
            border: '1px dashed var(--color-border)',
          }}>
            <p style={{ fontSize: '11px', color: 'var(--color-text-3)' }}>No tasks</p>
          </div>
        )}
      </div>
    </div>
  )
}

function TaskCard({ task }: { task: Task }) {
  const isOverdue = !!task.due_date
    && new Date(task.due_date) < new Date()
    && task.status !== 'done'

  return (
    <div className="task-card" style={{ position: 'relative' }}>
      {/* Priority strip */}
      <div style={{
        position: 'absolute', left: 0, top: '12px', bottom: '12px',
        width: '3px', borderRadius: '2px',
        background: PRIORITY_COLOR[task.priority] ?? '#3b82f6',
      }} />

      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', paddingLeft: '10px' }}>
        <span className={cn('badge', STATUS_BADGE[task.status])} style={{ fontSize: '10px' }}>
          {task.status.replace('_', ' ')}
        </span>
        {isOverdue && <AlertTriangle className="w-[12px] h-[12px]" style={{ color: 'var(--color-error)' }} />}
      </div>

      {/* Title */}
      <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text)', marginBottom: '10px', paddingLeft: '10px', lineHeight: 1.4 }}>
        {task.title}
      </p>

      {/* Bottom meta */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {task.due_date && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--color-text-3)' }}>
              <Calendar className="w-[11px] h-[11px]" />
              <span style={{ fontSize: '11px', color: isOverdue ? 'var(--color-error)' : 'var(--color-text-3)' }}>
                {formatRelative(task.due_date)}
              </span>
            </div>
          )}
        </div>
        {task.tags.length > 0 && (
          <div style={{ display: 'flex', gap: '4px' }}>
            {task.tags.slice(0, 1).map(tag => (
              <span key={tag} className="badge badge-gray" style={{ fontSize: '10px' }}>{tag}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function TaskListView({ tasks }: { tasks: Task[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {/* Header row */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 100px 100px 120px 40px',
        padding: '0 12px', gap: '12px',
        fontSize: '10px', fontWeight: 600, letterSpacing: '0.07em',
        textTransform: 'uppercase', color: 'var(--color-text-3)',
        marginBottom: '4px',
      }}>
        <span>Task</span>
        <span>Status</span>
        <span>Priority</span>
        <span>Due</span>
        <span />
      </div>

      {tasks.map(task => {
        const isOverdue = !!task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done'
        return (
          <div
            key={task.id}
            className="card"
            style={{ padding: '10px 12px', display: 'grid', gridTemplateColumns: '1fr 100px 100px 120px 40px', gap: '12px', alignItems: 'center' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
              <GripVertical className="w-[13px] h-[13px]" style={{ color: 'var(--color-text-3)', flexShrink: 0 }} />
              <div style={{
                width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
                background: PRIORITY_COLOR[task.priority] ?? '#3b82f6',
              }} />
              <span style={{ fontSize: '13px', color: 'var(--color-text)' }} className="truncate">
                {task.title}
              </span>
            </div>
            <span className={cn('badge', STATUS_BADGE[task.status])} style={{ fontSize: '10px', justifySelf: 'start' }}>
              {task.status.replace('_', ' ')}
            </span>
            <span style={{ fontSize: '12px', color: PRIORITY_COLOR[task.priority], fontWeight: 500, textTransform: 'capitalize' }}>
              {task.priority}
            </span>
            <span style={{ fontSize: '11px', color: isOverdue ? 'var(--color-error)' : 'var(--color-text-3)' }}>
              {task.due_date ? formatRelative(task.due_date) : '—'}
            </span>
            <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-3)', display: 'flex', justifyContent: 'flex-end' }}>
              <ArrowRight className="w-[13px] h-[13px]" />
            </button>
          </div>
        )
      })}
    </div>
  )
}

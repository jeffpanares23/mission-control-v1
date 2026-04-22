// ============================================================
// TasksPage — AI Agent Operations Task Board
// Phase 4: Full operational view with channel/agent/trigger
// ============================================================
import { useState, useEffect, useCallback } from 'react'
import {
  Plus, Filter, Loader, LayoutGrid, List, X, ChevronDown,
  Bot, Hash, Clock, AlertTriangle, CheckCircle2, Calendar,
  Zap, RefreshCw, Trash2, Edit2, GripVertical,
} from 'lucide-react'
import { cn, formatRelative, formatDate } from '@/lib/utils'
import { api } from '@/lib/api'
import type {
  Task, TaskStatus, TaskPriority, TaskTriggerSource,
} from '@/types'

// ─── Kanban columns (Board view) ───────────────────────────
const BOARD_COLUMNS: { id: string; title: string; status: TaskStatus; color: string }[] = [
  { id: 'backlog',     title: 'Backlog',     status: 'backlog',     color: '#6b7280' },
  { id: 'scheduled',   title: 'Scheduled',   status: 'scheduled',   color: '#3b82f6' },
  { id: 'in_progress', title: 'In Progress',  status: 'in_progress', color: '#f59e0b' },
  { id: 'waiting',     title: 'Waiting',     status: 'waiting',     color: '#a855f7' },
  { id: 'review',      title: 'Review',       status: 'review',      color: '#ec4899' },
  { id: 'done',        title: 'Done',         status: 'done',        color: '#10b981' },
]

// ─── List view columns ──────────────────────────────────────
const LIST_COLUMNS = ['Task', 'Status', 'Priority', 'Trigger', 'Channel / Agent', 'Due / Updated']

// ─── Trigger source config ──────────────────────────────────
const TRIGGER_CONFIG: Record<TaskTriggerSource, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  manual:  { label: 'Manual',  icon: <Edit2       className="w-[9px] h-[9px]" />, color: '#9ca3af', bg: 'rgba(156,163,175,0.15)' },
  cron:    { label: 'Cron',    icon: <Clock       className="w-[9px] h-[9px]" />, color: '#60a5fa', bg: 'rgba(96,165,250,0.15)'  },
  channel: { label: 'Channel', icon: <Hash        className="w-[9px] h-[9px]" />, color: '#a78bfa', bg: 'rgba(167,139,250,0.15)' },
  system:  { label: 'System',  icon: <Zap        className="w-[9px] h-[9px]" />, color: '#f97316', bg: 'rgba(249,115,22,0.15)'  },
}

// ─── Priority config ───────────────────────────────────────
const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string; dot: string }> = {
  low:    { label: 'Low',    color: '#3b82f6', dot: '#3b82f6' },
  medium: { label: 'Medium', color: '#eab308', dot: '#eab308' },
  high:   { label: 'High',   color: '#f97316', dot: '#f97316' },
  urgent: { label: 'Urgent', color: '#ef4444', dot: '#ef4444' },
}

// ─── Status config ──────────────────────────────────────────
const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; badge: string }> = {
  backlog:     { label: 'Backlog',     color: '#6b7280', badge: 'badge-gray'   },
  scheduled:   { label: 'Scheduled',   color: '#3b82f6', badge: 'badge-info'   },
  in_progress: { label: 'In Progress',color: '#f59e0b', badge: 'badge-warning' },
  waiting:     { label: 'Waiting',     color: '#a855f7', badge: 'badge-purple' },
  review:      { label: 'Review',      color: '#ec4899', badge: 'badge-pink'   },
  done:        { label: 'Done',         color: '#10b981', badge: 'badge-success'},
  cancelled:   { label: 'Cancelled',   color: '#ef4444', badge: 'badge-error'   },
}

// ─── Channel icons ──────────────────────────────────────────
const CHANNEL_ICON: Record<string, string> = {
  telegram: '✈', discord: '🎮', whatsapp: '💬', email: '📧', web: '🌐',
}

// ─── Task form shape ────────────────────────────────────────
interface TaskForm {
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  due_date: string
  channel_id: string
  agent_id: string
  trigger_source: TaskTriggerSource
  tags: string
}

const DEFAULT_FORM: TaskForm = {
  title: '', description: '', status: 'backlog', priority: 'medium',
  due_date: '', channel_id: '', agent_id: '', trigger_source: 'manual', tags: '',
}

// ─────────────────────────────────────────────────────────────
// TasksPage
// ─────────────────────────────────────────────────────────────
export function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<'board' | 'list'>('board')

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [triggerFilter, setTriggerFilter] = useState<string>('all')

  // Modal
  const [showModal, setShowModal] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [form, setForm] = useState<TaskForm>(DEFAULT_FORM)
  const [saving, setSaving] = useState(false)

  // Delete confirm
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const loadTasks = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.tasks.list()
      setTasks(data ?? [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load tasks')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadTasks() }, [loadTasks])

  // Filter helpers
  const filteredTasks = tasks.filter(t => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false
    if (triggerFilter !== 'all' && t.trigger_source !== triggerFilter) return false
    return true
  })

  const tasksByColumn = BOARD_COLUMNS.reduce((acc, col) => {
    acc[col.id] = filteredTasks.filter(t => t.column_status === col.id || t.status === col.status)
    return acc
  }, {} as Record<string, Task[]>)

  // ── Open create modal ──────────────────────────────────────
  const openCreate = () => {
    setEditingTask(null)
    setForm(DEFAULT_FORM)
    setShowModal(true)
  }

  // ── Open edit modal ────────────────────────────────────────
  const openEdit = (task: Task) => {
    setEditingTask(task)
    setForm({
      title: task.title ?? '',
      description: task.description ?? '',
      status: task.status,
      priority: task.priority,
      due_date: task.due_date ? task.due_date.slice(0, 16) : '',
      channel_id: task.channel_id ?? '',
      agent_id: task.agent_id ?? '',
      trigger_source: task.trigger_source ?? 'manual',
      tags: (task.tags ?? []).join(', '),
    })
    setShowModal(true)
  }

  // ── Save (create or update) ────────────────────────────────
  const handleSave = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    const payload: Partial<Task> = {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      status: form.status,
      priority: form.priority,
      due_date: form.due_date ? new Date(form.due_date).toISOString() : undefined,
      channel_id: form.channel_id || undefined,
      agent_id: form.agent_id || undefined,
      trigger_source: form.trigger_source,
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      column_status: form.status,
    }
    try {
      if (editingTask) {
        const updated = await api.tasks.update(editingTask.id, payload)
        setTasks(prev => prev.map(t => t.id === editingTask.id ? { ...t, ...updated } : t))
      } else {
        const created = await api.tasks.create(payload)
        setTasks(prev => [created, ...prev])
      }
      setShowModal(false)
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  // ── Quick status change ────────────────────────────────────
  const handleStatusChange = async (taskId: string, status: TaskStatus) => {
    try {
      const updated = await api.tasks.update(taskId, { status, column_status: status })
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updated, status, column_status: status } : t))
    } catch { /* silent */ }
  }

  // ── Delete ────────────────────────────────────────────────
  const handleDelete = async (taskId: string) => {
    try {
      await api.tasks.delete(taskId)
      setTasks(prev => prev.filter(t => t.id !== taskId))
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setDeletingId(null)
    }
  }

  // ── Move task between columns (board) ─────────────────────
  const handleMove = async (taskId: string, newStatus: TaskStatus) => {
    const col = BOARD_COLUMNS.find(c => c.status === newStatus)
    try {
      const updated = await api.tasks.update(taskId, {
        status: newStatus,
        column_status: col?.id ?? newStatus,
      })
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updated, status: newStatus, column_status: col?.id ?? newStatus } : t))
    } catch { /* silent */ }
  }

  return (
    <div className="h-full flex flex-col">

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="px-5 py-3 flex items-center justify-between border-b border-surface-border flex-shrink-0">
        <div>
          <h2 className="text-base font-bold text-text-primary">Task Operations</h2>
          <p className="text-xs text-text-muted mt-0.5">
            {loading ? '...' : `${filteredTasks.length} / ${tasks.length} tasks`}
            {error && <span className="text-error ml-2">· {error}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="tab-toggle">
            <button onClick={() => setView('board')} className={cn(view === 'board' && 'active')}>
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setView('list')} className={cn(view === 'list' && 'active')}>
              <List className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Filter dropdowns */}
          <FilterDropdown label="Status" value={statusFilter}
            options={[['all','All'],...BOARD_COLUMNS.map(c=>[c.status,c.title])]}
            onChange={setStatusFilter} />
          <FilterDropdown label="Priority" value={priorityFilter}
            options={[['all','All'],['urgent','Urgent'],['high','High'],['medium','Medium'],['low','Low']]}
            onChange={setPriorityFilter} />
          <FilterDropdown label="Trigger" value={triggerFilter}
            options={[['all','All'],['manual','Manual'],['cron','Cron'],['channel','Channel'],['system','System']]}
            onChange={setTriggerFilter} />

          <button className="btn btn-primary text-xs" onClick={openCreate}>
            <Plus className="w-3.5 h-3.5" /> New Task
          </button>
        </div>
      </div>

      {/* ── Board / List ───────────────────────────────────── */}
      <div className="flex-1 overflow-hidden">
        {loading ? (
          <LoadingState />
        ) : error && tasks.length === 0 ? (
          <ErrorState message={error} onRetry={loadTasks} />
        ) : tasks.length === 0 ? (
          <EmptyState onCreate={openCreate} />
        ) : view === 'board' ? (
          <BoardView
            tasksByColumn={tasksByColumn}
            onEdit={openEdit}
            onDelete={(id) => setDeletingId(id)}
            onStatusChange={handleStatusChange}
            onMove={handleMove}
            deletingId={deletingId}
          />
        ) : (
          <ListView
            tasks={filteredTasks}
            onEdit={openEdit}
            onDelete={(id) => setDeletingId(id)}
            onStatusChange={handleStatusChange}
          />
        )}
      </div>

      {/* ── Task Create/Edit Modal ─────────────────────────── */}
      {showModal && (
        <TaskModal
          form={form}
          setForm={setForm}
          editing={!!editingTask}
          saving={saving}
          onSave={handleSave}
          onClose={() => setShowModal(false)}
        />
      )}

      {/* ── Delete Confirm ──────────────────────────────────── */}
      {deletingId && (
        <DeleteConfirm
          onConfirm={() => handleDelete(deletingId)}
          onCancel={() => setDeletingId(null)}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Filter Dropdown
// ─────────────────────────────────────────────────────────────
function FilterDropdown({
  label, value, options, onChange,
}: {
  label: string; value: string
  options: [string, string][]
  onChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const selectedLabel = options.find(([k]) => k === value)?.[1] ?? label

  return (
    <div className="relative">
      <button
        className={cn('btn btn-ghost text-xs gap-1', open && 'ring-1 ring-accent')}
        onClick={() => setOpen(o => !o)}
      >
        {label}: <span className="text-text-primary">{selectedLabel}</span>
        <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-1 z-50 min-w-[120px]
            bg-surface-raised border border-surface-border rounded-lg shadow-xl overflow-hidden"
        >
          {options.map(([k, v]) => (
            <button
              key={k}
              className={cn(
                'w-full text-left px-3 py-2 text-xs hover:bg-surface-hover transition-colors',
                k === value ? 'text-accent font-semibold' : 'text-text-secondary'
              )}
              onClick={() => { onChange(k); setOpen(false) }}
            >
              {v}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Board View
// ─────────────────────────────────────────────────────────────
function BoardView({
  tasksByColumn, onEdit, onDelete, onStatusChange, onMove, deletingId,
}: {
  tasksByColumn: Record<string, Task[]>
  onEdit: (t: Task) => void; onDelete: (id: string) => void
  onStatusChange: (id: string, s: TaskStatus) => void; onMove: (id: string, s: TaskStatus) => void
  deletingId: string | null
}) {
  return (
    <div className="flex gap-4 p-5 h-full overflow-x-auto">
      {BOARD_COLUMNS.map(col => (
        <div key={col.id} className="flex flex-col min-w-[200px] w-[200px] flex-shrink-0">
          {/* Column header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ background: col.color }} />
              <span className="text-xs font-semibold text-text-primary">{col.title}</span>
            </div>
            <span className="text-xs font-bold text-text-muted">
              {tasksByColumn[col.id]?.length ?? 0}
            </span>
          </div>

          {/* Column body */}
          <div className="flex-1 flex flex-col gap-2 overflow-y-auto">
            {(tasksByColumn[col.id] ?? []).map(task => (
              <BoardTaskCard
                key={task.id}
                task={task}
                onEdit={() => onEdit(task)}
                onDelete={() => onDelete(task.id)}
                onStatusChange={(s) => onStatusChange(task.id, s)}
                onMove={(s) => onMove(task.id, s)}
                isDeleting={deletingId === task.id}
              />
            ))}

            {tasksByColumn[col.id]?.length === 0 && (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-xs text-text-muted text-center py-6 px-3
                  border border-dashed border-surface-border rounded-lg">
                  Drop tasks here
                </p>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function BoardTaskCard({
  task, onEdit, onDelete, onStatusChange, onMove, isDeleting,
}: {
  task: Task; onEdit: () => void; onDelete: () => void
  onStatusChange: (s: TaskStatus) => void; onMove: (s: TaskStatus) => void
  isDeleting: boolean
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const isOverdue = !!task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done'
  const pCfg = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.medium
  const sCfg = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.backlog
  const tCfg = task.trigger_source ? TRIGGER_CONFIG[task.trigger_source] : null

  return (
    <div
      draggable
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={() => setDragOver(false)}
      className={cn(
        'task-card group relative cursor-grab active:cursor-grabbing',
        dragOver && 'ring-2 ring-accent',
        isDeleting && 'opacity-40 pointer-events-none',
      )}
    >
      {/* Priority stripe */}
      <div className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full"
        style={{ background: pCfg.dot }} />

      {/* Header row */}
      <div className="flex items-center justify-between mb-2 pl-3">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: pCfg.dot }} />
          <span className={cn('badge text-[10px]', sCfg.badge)}>{sCfg.label}</span>
        </div>
        {isOverdue && <AlertTriangle className="w-3.5 h-3.5 text-error" />}

        {/* Card menu */}
        <div className="relative opacity-0 group-hover:opacity-100 transition-opacity">
          <button className="p-1 rounded hover:bg-surface-hover"
            onClick={(e) => { e.stopPropagation(); setMenuOpen(o => !o) }}>
            <ChevronDown className="w-3 h-3 text-text-muted" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 z-50 w-36
              bg-surface-raised border border-surface-border rounded-lg shadow-xl overflow-hidden">
              {BOARD_COLUMNS.filter(c => c.status !== task.status).map(c => (
                <button key={c.id}
                  className="w-full text-left px-3 py-1.5 text-xs text-text-secondary
                    hover:bg-surface-hover flex items-center gap-2"
                  onClick={() => { onMove(c.status); setMenuOpen(false) }}>
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: c.color }} />
                  Move to {c.title}
                </button>
              ))}
              <div className="border-t border-surface-border" />
              <button className="w-full text-left px-3 py-1.5 text-xs text-text-secondary
                hover:bg-surface-hover flex items-center gap-2"
                onClick={() => { onEdit(); setMenuOpen(false) }}>
                <Edit2 className="w-3 h-3" /> Edit
              </button>
              <button className="w-full text-left px-3 py-1.5 text-xs text-error
                hover:bg-surface-hover flex items-center gap-2"
                onClick={() => { onDelete(); setMenuOpen(false) }}>
                <Trash2 className="w-3 h-3" /> Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Title */}
      <p className="text-xs font-medium text-text-primary mb-2 pl-3 line-clamp-2 leading-relaxed">
        {task.title}
      </p>

      {/* Meta row */}
      <div className="flex items-center gap-2 flex-wrap pl-3">
        {/* Trigger badge */}
        {tCfg && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
            style={{ color: tCfg.color, background: tCfg.bg }}>
            {tCfg.icon}{tCfg.label}
          </span>
        )}

        {/* Channel */}
        {task.channel_name && (
          <span className="inline-flex items-center gap-0.5 text-[10px] text-text-muted">
            {CHANNEL_ICON[task.channel_id?.replace('ch_', '') ?? ''] ?? '📡'}
            <span className="truncate max-w-[60px]">{task.channel_name}</span>
          </span>
        )}

        {/* Agent */}
        {task.agent_name && (
          <span className="inline-flex items-center gap-0.5 text-[10px] text-text-muted">
            <Bot className="w-3 h-3" />
            <span className="truncate max-w-[60px]">{task.agent_name}</span>
          </span>
        )}
      </div>

      {/* Due date */}
      {task.due_date && (
        <div className="flex items-center gap-1 mt-1.5 pl-3">
          <Calendar className="w-3 h-3" style={{ color: isOverdue ? 'var(--color-error)' : 'var(--color-text-3)' }} />
          <span className="text-[10px]" style={{ color: isOverdue ? 'var(--color-error)' : 'var(--color-text-3)' }}>
            {formatRelative(task.due_date)}
          </span>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// List View
// ─────────────────────────────────────────────────────────────
function ListView({
  tasks, onEdit, onDelete, onStatusChange,
}: {
  tasks: Task[]; onEdit: (t: Task) => void; onDelete: (id: string) => void
  onStatusChange: (id: string, s: TaskStatus) => void
}) {
  return (
    <div className="h-full overflow-auto p-5">
      {/* Column headers */}
      <div className="grid gap-3 px-3 mb-2"
        style={{ gridTemplateColumns: '2fr 110px 90px 100px 140px 120px 52px' }}>
        {LIST_COLUMNS.map(col => (
          <span key={col} className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
            {col}
          </span>
        ))}
        <span />
      </div>

      {/* Rows */}
      <div className="flex flex-col gap-1.5">
        {tasks.map(task => (
          <ListTaskRow
            key={task.id}
            task={task}
            onEdit={() => onEdit(task)}
            onDelete={() => onDelete(task.id)}
            onStatusChange={(s) => onStatusChange(task.id, s)}
          />
        ))}
      </div>
    </div>
  )
}

function ListTaskRow({
  task, onEdit, onDelete, onStatusChange,
}: {
  task: Task; onEdit: () => void; onDelete: () => void
  onStatusChange: (s: TaskStatus) => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const isOverdue = !!task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done'
  const pCfg = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.medium
  const sCfg = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.backlog
  const tCfg = task.trigger_source ? TRIGGER_CONFIG[task.trigger_source] : null

  return (
    <div className="card grid gap-3 items-center px-3 py-2.5 group"
      style={{ gridTemplateColumns: '2fr 110px 90px 100px 140px 120px 52px' }}>

      {/* Task name + priority dot */}
      <div className="flex items-center gap-2 min-w-0">
        <GripVertical className="w-3.5 h-3.5 text-text-muted flex-shrink-0 cursor-grab" />
        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: pCfg.dot }} />
        <span className="text-xs text-text-primary truncate">{task.title}</span>
      </div>

      {/* Status */}
      <div>
        <select
          value={task.status}
          onChange={e => onStatusChange(e.target.value as TaskStatus)}
          className={cn('badge text-[10px] cursor-pointer bg-transparent border-0', sCfg.badge)}
          style={{ color: sCfg.color }}
        >
          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {/* Priority */}
      <span className="text-[11px] font-medium" style={{ color: pCfg.color }}>
        {pCfg.label}
      </span>

      {/* Trigger */}
      <div>
        {tCfg ? (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
            style={{ color: tCfg.color, background: tCfg.bg }}>
            {tCfg.icon}{tCfg.label}
          </span>
        ) : (
          <span className="text-[10px] text-text-muted">—</span>
        )}
      </div>

      {/* Channel / Agent */}
      <div className="flex items-center gap-2 min-w-0">
        {task.channel_name ? (
          <span className="text-[10px] text-text-muted truncate">
            {CHANNEL_ICON[task.channel_id?.replace('ch_', '') ?? ''] ?? '📡'}{' '}
            {task.channel_name}
          </span>
        ) : task.agent_name ? (
          <span className="inline-flex items-center gap-0.5 text-[10px] text-text-muted">
            <Bot className="w-3 h-3" />{task.agent_name}
          </span>
        ) : (
          <span className="text-[10px] text-text-muted">—</span>
        )}
      </div>

      {/* Due / Updated */}
      <div className="flex items-center gap-1">
        {task.due_date ? (
          <>
            <Calendar className="w-3 h-3" style={{ color: isOverdue ? 'var(--color-error)' : 'var(--color-text-3)' }} />
            <span className="text-[10px]" style={{ color: isOverdue ? 'var(--color-error)' : 'var(--color-text-3)' }}>
              {formatRelative(task.due_date)}
            </span>
          </>
        ) : (
          <span className="text-[10px] text-text-muted">
            {formatDate(task.updated_at ?? task.created_at)}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button className="p-1 rounded hover:bg-surface-hover" onClick={onEdit}>
          <Edit2 className="w-3.5 h-3.5 text-text-muted" />
        </button>
        <button className="p-1 rounded hover:bg-surface-hover" onClick={onDelete}>
          <Trash2 className="w-3.5 h-3.5 text-error" />
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Loading / Empty / Error states
// ─────────────────────────────────────────────────────────────
function LoadingState() {
  return (
    <div className="flex items-center justify-center h-full gap-3">
      <Loader className="w-5 h-5 animate-spin text-accent" />
      <span className="text-sm text-text-muted">Loading task operations...</span>
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <AlertTriangle className="w-8 h-8 text-error" />
      <p className="text-sm text-text-muted">{message}</p>
      <button className="btn btn-ghost text-xs gap-1" onClick={onRetry}>
        <RefreshCw className="w-3.5 h-3.5" /> Retry
      </button>
    </div>
  )
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-6">
      <div className="w-14 h-14 rounded-full bg-surface-raised flex items-center justify-center">
        <CheckCircle2 className="w-7 h-7 text-text-muted" />
      </div>
      <div>
        <p className="text-sm font-semibold text-text-primary mb-1">No tasks yet</p>
        <p className="text-xs text-text-muted max-w-xs">
          Create your first operational task to start tracking AI agent workflows.
        </p>
      </div>
      <button className="btn btn-primary text-xs gap-1.5" onClick={onCreate}>
        <Plus className="w-3.5 h-3.5" /> Create First Task
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Delete Confirm Dialog
// ─────────────────────────────────────────────────────────────
function DeleteConfirm({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-surface-raised border border-surface-border rounded-xl shadow-2xl p-6 w-80">
        <h3 className="text-sm font-bold text-text-primary mb-2">Delete Task?</h3>
        <p className="text-xs text-text-muted mb-5">This action cannot be undone.</p>
        <div className="flex gap-2">
          <button className="btn btn-ghost text-xs flex-1" onClick={onCancel}>Cancel</button>
          <button className="btn btn-error text-xs flex-1" onClick={onConfirm}>Delete</button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Task Create/Edit Modal
// ─────────────────────────────────────────────────────────────
function TaskModal({
  form, setForm, editing, saving, onSave, onClose,
}: {
  form: TaskForm; setForm: (f: TaskForm) => void
  editing: boolean; saving: boolean; onSave: () => void; onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-surface-raised border border-surface-border rounded-xl shadow-2xl
        w-full max-w-md mx-4 flex flex-col max-h-[85vh] overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border flex-shrink-0">
          <h3 className="text-sm font-bold text-text-primary">
            {editing ? 'Edit Task' : 'New Operational Task'}
          </h3>
          <button className="p-1 rounded hover:bg-surface-hover" onClick={onClose}>
            <X className="w-4 h-4 text-text-muted" />
          </button>
        </div>

        {/* Form body */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">Title *</label>
            <input
              type="text"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder="Task title..."
              className="input w-full text-xs"
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">Description</label>
            <textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Optional description..."
              className="input w-full text-xs resize-none"
              rows={2}
            />
          </div>

          {/* Status + Priority row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">Status</label>
              <select
                value={form.status}
                onChange={e => setForm({ ...form, status: e.target.value as TaskStatus })}
                className="input w-full text-xs"
              >
                {BOARD_COLUMNS.map(c => (
                  <option key={c.status} value={c.status}>{c.title}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">Priority</label>
              <select
                value={form.priority}
                onChange={e => setForm({ ...form, priority: e.target.value as TaskPriority })}
                className="input w-full text-xs"
              >
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>

          {/* Trigger source */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">Trigger Source</label>
            <div className="grid grid-cols-4 gap-2">
              {(Object.entries(TRIGGER_CONFIG) as [TaskTriggerSource, typeof TRIGGER_CONFIG[TaskTriggerSource]][]).map(([key, cfg]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setForm({ ...form, trigger_source: key })}
                  className={cn(
                    'flex flex-col items-center gap-1 py-2 px-1 rounded-lg border text-[10px] font-medium transition-all',
                    form.trigger_source === key
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-surface-border text-text-muted hover:border-surface-border hover:bg-surface-hover'
                  )}
                >
                  <span style={{ color: cfg.color }}>{cfg.icon}</span>
                  {cfg.label}
                </button>
              ))}
            </div>
          </div>

          {/* Channel ID (text input for now — could be dropdown) */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">Channel ID</label>
            <input
              type="text"
              value={form.channel_id}
              onChange={e => setForm({ ...form, channel_id: e.target.value })}
              placeholder="UUID of linked channel (optional)"
              className="input w-full text-xs"
            />
          </div>

          {/* Agent ID */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">Agent ID</label>
            <input
              type="text"
              value={form.agent_id}
              onChange={e => setForm({ ...form, agent_id: e.target.value })}
              placeholder="UUID of assigned agent (optional)"
              className="input w-full text-xs"
            />
          </div>

          {/* Due date */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">Due Date</label>
            <input
              type="datetime-local"
              value={form.due_date}
              onChange={e => setForm({ ...form, due_date: e.target.value })}
              className="input w-full text-xs"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">Tags</label>
            <input
              type="text"
              value={form.tags}
              onChange={e => setForm({ ...form, tags: e.target.value })}
              placeholder="Comma-separated tags..."
              className="input w-full text-xs"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-surface-border flex-shrink-0">
          <button className="btn btn-ghost text-xs" onClick={onClose} disabled={saving}>Cancel</button>
          <button
            className="btn btn-primary text-xs gap-1"
            onClick={onSave}
            disabled={saving || !form.title.trim()}
          >
            {saving ? <Loader className="w-3.5 h-3.5 animate-spin" /> : null}
            {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Task'}
          </button>
        </div>
      </div>
    </div>
  )
}

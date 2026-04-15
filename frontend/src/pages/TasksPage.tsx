// TasksPage — Kanban board for focused task management
import { useState, useEffect } from 'react'
import { Plus, Filter, Loader } from 'lucide-react'
import { cn, priorityColor, statusColor } from '@/lib/utils'
import { api } from '@/lib/api'
import type { Task, TaskStatus } from '@/types'

const KANBAN_COLUMNS: { id: string; title: string; status: TaskStatus }[] = [
  { id: 'backlog',      title: 'Backlog',      status: 'backlog' },
  { id: 'todo',         title: 'To Do',         status: 'todo' },
  { id: 'in_progress',  title: 'In Progress',  status: 'in_progress' },
  { id: 'review',       title: 'Review',        status: 'review' },
  { id: 'done',         title: 'Done',          status: 'done' },
]

export function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.tasks.list()
      .then(res => setTasks(res.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const tasksByColumn = KANBAN_COLUMNS.reduce((acc, col) => {
    acc[col.id] = tasks.filter(t => t.column_status === col.id || t.status === col.status)
    return acc
  }, {} as Record<string, Task[]>)

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 flex items-center justify-between border-b border-surface-border">
        <div>
          <h2 className="text-lg font-bold text-text-primary">Tasks</h2>
          <p className="text-xs text-text-muted">{tasks.length} tasks across all stages</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn btn-ghost text-xs"><Filter className="w-3.5 h-3.5" /> Filter</button>
          <button className="btn btn-primary text-xs"><Plus className="w-3.5 h-3.5" /> New Task</button>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full gap-3 text-text-muted">
            <Loader className="w-5 h-5 animate-spin" />
            <span className="text-sm">Loading tasks...</span>
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-text-muted">
            <p className="text-sm">No tasks yet</p>
            <button className="btn btn-primary text-xs"><Plus className="w-3.5 h-3.5" /> Create your first task</button>
          </div>
        ) : (
          <div className="flex gap-4 p-6 h-full min-w-max">
            {KANBAN_COLUMNS.map(col => (
              <div key={col.id} className="kanban-column">
                <div className="kanban-column-header">
                  <span className="kanban-column-title">{col.title}</span>
                  <span className="kanban-column-count">{tasksByColumn[col.id]?.length ?? 0}</span>
                </div>
                <div className="flex flex-col gap-2">
                  {(tasksByColumn[col.id] ?? []).map(task => (
                    <div key={task.id} className="task-card">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                          <span className={cn('priority-dot', priorityColor(task.priority))} />
                          <span className={cn('badge text-xs', statusColor(task.status))}>{task.status}</span>
                        </div>
                      </div>
                      <p className="text-sm font-medium text-text-primary mb-2">{task.title}</p>
                      {task.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {task.tags.slice(0, 2).map(tag => <span key={tag} className="badge badge-neutral text-xs">{tag}</span>)}
                        </div>
                      )}
                    </div>
                  ))}
                  {tasksByColumn[col.id]?.length === 0 && (
                    <p className="text-xs text-text-muted text-center py-4">Empty</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

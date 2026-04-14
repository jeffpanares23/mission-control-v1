// TasksPage — Kanban board for focused task management
// The full Kanban is already in DashboardPage; this is the dedicated Tasks workspace
import { useState, useEffect } from 'react'
import { Plus, Filter } from 'lucide-react'
import { cn, priorityColor, statusColor } from '@/lib/utils'
import { api } from '@/lib/api'
import type { Task, TaskStatus } from '@/types'

const KANBAN_COLUMNS: { id: string; title: string; status: TaskStatus }[] = [
  { id: 'backlog',     title: 'Backlog',     status: 'backlog' },
  { id: 'todo',        title: 'To Do',        status: 'todo' },
  { id: 'in_progress', title: 'In Progress',  status: 'in_progress' },
  { id: 'review',      title: 'Review',       status: 'review' },
  { id: 'done',        title: 'Done',          status: 'done' },
]

export function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])

  useEffect(() => {
    api.tasks.list()
      .then(res => setTasks(res.data))
      .catch(() => {})
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
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

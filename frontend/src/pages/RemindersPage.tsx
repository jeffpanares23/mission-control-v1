import { useState, useEffect } from 'react'
import { Plus, Bell } from 'lucide-react'
import { formatRelative } from '@/lib/utils'
import { api } from '@/lib/api'
import type { Reminder } from '@/types'

export function RemindersPage() {
  const [items, setItems] = useState<Reminder[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.reminders.list()
      .then(res => setItems(res))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const active = items.filter(r => r.is_active)

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 flex items-center justify-between border-b border-surface-border">
        <div>
          <h2 className="text-lg font-bold text-text-primary">Reminders</h2>
          <p className="text-xs text-text-muted">{active.length} active reminders</p>
        </div>
        <button className="btn btn-primary text-xs"><Plus className="w-3.5 h-3.5" /> New Reminder</button>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <p className="text-text-muted text-sm text-center py-12 animate-pulse">Loading...</p>
        ) : active.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-text-muted gap-2">
            <Bell className="w-8 h-8 opacity-30" />
            <p className="text-sm">No active reminders</p>
          </div>
        ) : (
          <div className="space-y-2">
            {active.map(r => (
              <div key={r.id} className="glass-card p-4 flex items-center gap-4">
                <div className="w-9 h-9 rounded-full bg-accent/15 flex items-center justify-center flex-shrink-0">
                  <Bell className="w-4 h-4 text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-text-primary">{r.title}</h4>
                  {r.description && <p className="text-xs text-text-muted truncate">{r.description}</p>}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs font-medium text-accent">{formatRelative(r.due_date)}</p>
                  <p className="text-xs text-text-muted capitalize">{r.recurrence}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

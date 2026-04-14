import { useState, useEffect } from 'react'
import { Plus, CalendarDays } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { api } from '@/lib/api'
import type { Schedule } from '@/types'

export function SchedulesPage() {
  const [items, setItems] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.schedules.list()
      .then(res => setItems(res.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 flex items-center justify-between border-b border-surface-border">
        <div>
          <h2 className="text-lg font-bold text-text-primary">Schedules</h2>
          <p className="text-xs text-text-muted">{items.length} scheduled events</p>
        </div>
        <button className="btn btn-primary text-xs"><Plus className="w-3.5 h-3.5" /> New Event</button>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <p className="text-text-muted text-sm text-center py-12 animate-pulse">Loading...</p>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-text-muted gap-2">
            <CalendarDays className="w-8 h-8 opacity-30" />
            <p className="text-sm">No scheduled events</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map(event => (
              <div key={event.id} className="glass-card p-4 flex items-center gap-4">
                <div className="w-1 h-12 rounded-full" style={{ backgroundColor: event.color }} />
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-text-primary">{event.title}</h4>
                  {event.description && <p className="text-xs text-text-muted">{event.description}</p>}
                </div>
                <div className="text-right text-xs text-text-secondary flex-shrink-0">
                  <p>{formatDate(event.start_time)}</p>
                  {event.end_time && <p className="text-text-muted">→ {formatDate(event.end_time)}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

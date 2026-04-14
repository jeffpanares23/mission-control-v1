import { useState, useEffect } from 'react'
import { Plus, CalendarDays, Gift } from 'lucide-react'
import { formatRelative } from '@/lib/utils'
import { api } from '@/lib/api'
import type { Anniversary } from '@/types'

export function AnniversariesPage() {
  const [items, setItems] = useState<Anniversary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.anniversaries.list()
      .then(res => setItems(res.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const upcoming = items.filter(a => new Date(a.anniversary_date) >= new Date())
  const past = items.filter(a => new Date(a.anniversary_date) < new Date())

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 flex items-center justify-between border-b border-surface-border">
        <div>
          <h2 className="text-lg font-bold text-text-primary">Anniversaries</h2>
          <p className="text-xs text-text-muted">{items.length} tracked anniversaries</p>
        </div>
        <button className="btn btn-primary text-xs"><Plus className="w-3.5 h-3.5" /> Add Anniversary</button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {loading ? (
          <p className="text-text-muted text-sm text-center py-12 animate-pulse">Loading...</p>
        ) : (
          <>
            {upcoming.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Upcoming</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {upcoming.map(a => <AnniversaryCard key={a.id} item={a} />)}
                </div>
              </div>
            )}
            {past.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Past</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {past.map(a => <AnniversaryCard key={a.id} item={a} />)}
                </div>
              </div>
            )}
            {items.length === 0 && (
              <div className="flex flex-col items-center justify-center h-48 text-text-muted gap-2">
                <Gift className="w-8 h-8 opacity-30" />
                <p className="text-sm">No anniversaries yet</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function AnniversaryCard({ item }: { item: Anniversary }) {
  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 rounded-full bg-accent/15 flex items-center justify-center">
          <CalendarDays className="w-4 h-4 text-accent" />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-text-primary">{item.title}</h4>
          <span className="text-xs text-text-muted capitalize">{item.anniversary_type.replace('_', ' ')}</span>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-secondary">{item.anniversary_date}</span>
        <span className="text-xs font-medium text-accent">{formatRelative(item.anniversary_date + 'T00:00:00')}</span>
      </div>
      {item.notes && <p className="text-xs text-text-muted mt-2">{item.notes}</p>}
    </div>
  )
}

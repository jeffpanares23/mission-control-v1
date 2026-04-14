import { BarChart3 } from 'lucide-react'

export function AnalyticsPage() {
  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 border-b border-surface-border">
        <h2 className="text-lg font-bold text-text-primary">Analytics</h2>
        <p className="text-xs text-text-muted">Performance metrics and trends</p>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Tasks Completed', value: '24', delta: '+12%', positive: true },
            { label: 'Avg Completion Time', value: '2.4 days', delta: '-8%', positive: true },
            { label: 'Active Accounts', value: '8', delta: '+2', positive: true },
          ].map(stat => (
            <div key={stat.label} className="glass-card p-5">
              <p className="text-xs text-text-muted mb-1">{stat.label}</p>
              <p className="text-2xl font-bold text-text-primary">{stat.value}</p>
              <p className={`text-xs font-medium mt-1 ${stat.positive ? 'text-status-done' : 'text-status-error'}`}>{stat.delta}</p>
            </div>
          ))}
        </div>
        <div className="glass-card p-6 flex flex-col items-center justify-center h-64 text-text-muted">
          <BarChart3 className="w-10 h-10 opacity-20 mb-3" />
          <p className="text-sm">Analytics charts coming soon</p>
          <p className="text-xs mt-1">Connect Supabase and Laravel to enable data</p>
        </div>
      </div>
    </div>
  )
}

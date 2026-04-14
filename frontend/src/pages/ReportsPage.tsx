import { FileText } from 'lucide-react'

export function ReportsPage() {
  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 flex items-center justify-between border-b border-surface-border">
        <h2 className="text-lg font-bold text-text-primary">Reports</h2>
        <button className="btn btn-primary text-xs">Generate Report</button>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { title: 'Weekly Summary', type: 'weekly_summary', desc: 'Tasks completed and upcoming for the week' },
            { title: 'Task Completion', type: 'task_completion', desc: 'Completion rates by priority and account' },
            { title: 'Account Health', type: 'account_health', desc: 'Overview of all account statuses' },
            { title: 'AI Activity', type: 'ai_activity', desc: 'Hermes agent performance and dispatch stats' },
          ].map(report => (
            <div key={report.type} className="glass-card p-5 cursor-pointer hover:border-accent/30 transition-colors">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-lg bg-accent/15 flex items-center justify-center">
                  <FileText className="w-4 h-4 text-accent" />
                </div>
                <h3 className="text-sm font-semibold text-text-primary">{report.title}</h3>
              </div>
              <p className="text-xs text-text-muted">{report.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

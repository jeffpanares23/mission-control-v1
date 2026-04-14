import { useEffect, useState } from 'react'
import { Search, Bell, Bot, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import type { AIAgentStatus } from '@/types'

const agentStatusLabel: Record<AIAgentStatus, string> = {
  idle: 'Idle',
  thinking: 'Thinking',
  acting: 'Acting',
  error: 'Error',
  offline: 'Offline',
}

interface TopBarProps {
  stats?: {
    total_tasks?: number
    done_tasks?: number
    overdue_tasks?: number
    high_priority_tasks?: number
    completion_rate?: number
  }
}

export function TopBar({ stats }: TopBarProps) {
  const [agentStatus, setAgentStatus] = useState<AIAgentStatus>('idle')
  const [agentName] = useState('Hermes')
  const [searchVal, setSearchVal] = useState('')

  useEffect(() => {
    api.ai.status()
      .then(r => setAgentStatus(r.data.status as AIAgentStatus))
      .catch(() => setAgentStatus('offline'))
  }, [])

  return (
    <header className="topbar">
      {/* Search */}
      <div className="search-bar">
        <Search className="w-[14px] h-[14px]" />
        <input
          type="text"
          placeholder="Search tasks, accounts, insights..."
          value={searchVal}
          onChange={e => setSearchVal(e.target.value)}
        />
      </div>

      {/* Center — quick stats */}
      <div className="flex items-center gap-2" style={{ flex: 1 }}>
        <div className="flex items-center gap-1.5" style={{ color: 'var(--color-text-3)' }}>
          <div className={cn('ai-dot', agentStatus)} />
          <span className="text-[11px] font-medium" style={{ color: 'var(--color-text-2)' }}>
            {agentName}
          </span>
          <span className="text-[11px]">·</span>
          <span className="text-[11px]">{agentStatusLabel[agentStatus]}</span>
        </div>

        <div style={{ width: '1px', height: '20px', background: 'var(--color-border)', margin: '0 4px' }} />

        {stats && (
          <div className="flex items-center gap-2">
            <StatPill value={stats.total_tasks ?? 0} label="tasks" color="var(--color-text)" />
            <StatPill value={stats.done_tasks ?? 0} label="done" color="var(--color-success)" />
            {(stats.overdue_tasks ?? 0) > 0 && (
              <StatPill value={stats.overdue_tasks!} label="overdue" color="var(--color-error)" />
            )}
            {(stats.high_priority_tasks ?? 0) > 0 && (
              <StatPill value={stats.high_priority_tasks!} label="high" color="var(--color-accent)" />
            )}
          </div>
        )}
      </div>

      {/* Right — actions */}
      <div className="flex items-center gap-1.5">
        <button className="btn-icon" title="New Task">
          <Plus className="w-[15px] h-[15px]" />
        </button>
        <button className="btn-icon" title="Notifications">
          <Bell className="w-[15px] h-[15px]" />
          <span style={{
            position: 'absolute', top: '10px', right: '10px',
            width: '6px', height: '6px', borderRadius: '50%',
            background: 'var(--color-accent)',
          }} />
        </button>
        <button className="btn-icon" title="AI Agent">
          <Bot className="w-[15px] h-[15px]" />
        </button>
        <div style={{ width: '1px', height: '20px', background: 'var(--color-border)', margin: '0 4px' }} />
        <div className="avatar" style={{ width: '28px', height: '28px', background: 'var(--color-accent-dim)', color: 'var(--color-accent)', fontSize: '10px' }}>
          JD
        </div>
      </div>
    </header>
  )
}

function StatPill({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="stat-pill">
      <span className="num" style={{ color }}>{value}</span>
      <span style={{ color: 'var(--color-text-3)', fontSize: '11px' }}>{label}</span>
    </div>
  )
}

// Agent Cron Jobs List — shows agent_cron_jobs with name, schedule, status, next_run
import { useState } from 'react'
import { CheckCircle2, XCircle, ChevronRight } from 'lucide-react'
import type { AgentCronJob } from '@/types'
import { formatRelative } from '@/lib/utils'
import { cn } from '@/lib/utils'

const STATUS_COLOR: Record<string, string> = {
  active:  '#10b981',
  paused:  '#f59e0b',
  error:   '#ef4444',
  idle:    '#6b7280',
}

const RESULT_ICON: Record<string, React.ReactNode> = {
  success: <CheckCircle2 className="w-[10px] h-[10px]" style={{ color: '#10b981' }} />,
  failed:  <XCircle className="w-[10px] h-[10px]" style={{ color: '#ef4444' }} />,
}

interface Props {
  jobs: AgentCronJob[]
  loading: boolean
}

export function AgentCronJobsList({ jobs, loading }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'active' | 'paused' | 'error' | 'idle'>('all')

  const filtered = jobs.filter(j => {
    if (filter === 'all') return true
    return j.status === filter
  })

  if (loading) {
    return (
      <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{
            height: '52px', borderRadius: '8px',
            background: 'rgba(255,255,255,0.03)', border: '1px solid var(--color-border)',
            animation: 'pulse 2s infinite',
          }} />
        ))}
      </div>
    )
  }

  const activeCount = jobs.filter(j => j.status === 'active').length
  const errorCount = jobs.filter(j => j.status === 'error').length
  const pausedCount = jobs.filter(j => j.status === 'paused').length

  return (
    <div style={{ padding: '10px' }}>
      {/* Summary */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: '6px', marginBottom: '10px',
      }}>
        <CronStatPill label="Active" value={activeCount} color="#10b981" />
        <CronStatPill label="Paused" value={pausedCount} color="#f59e0b" />
        <CronStatPill label="Error" value={errorCount} color="#ef4444" />
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '8px', flexWrap: 'wrap' }}>
        {(['all', 'active', 'paused', 'error', 'idle'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              flex: 1, minWidth: '40px', padding: '4px 2px',
              fontSize: '10px', fontWeight: 600,
              background: filter === f ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${filter === f ? 'rgba(59,130,246,0.4)' : 'var(--color-border)'}`,
              borderRadius: '6px', cursor: 'pointer',
              color: filter === f ? '#60a5fa' : 'var(--color-text-3)',
              textTransform: 'capitalize',
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Job list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {filtered.map(job => (
          <div
            key={job.id}
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: `1px solid ${job.status === 'error' ? 'rgba(239,68,68,0.35)' : 'var(--color-border)'}`,
              borderRadius: '8px', overflow: 'hidden',
            }}
          >
            {/* Row */}
            <div
              style={{ padding: '8px 10px', display: 'flex', alignItems: 'center', gap: '7px', cursor: 'pointer' }}
              onClick={() => setExpanded(expanded === job.id ? null : job.id)}
            >
              <div style={{
                width: '6px', height: '6px', borderRadius: '50%',
                background: STATUS_COLOR[job.status] ?? '#6b7280',
                flexShrink: 0,
              }} />

              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text)' }} className="truncate">
                  {job.name}
                </p>
                <p style={{ fontSize: '10px', color: 'var(--color-text-3)' }}>
                  {job.schedule}
                </p>
              </div>

              {job.last_result && RESULT_ICON[job.last_result]}
              <ChevronRight
                className={cn('w-[11px] h-[11px] transition-transform', expanded === job.id && 'rotate-90')}
                style={{ color: 'var(--color-text-3)', flexShrink: 0 }}
              />
            </div>

            {/* Expanded details */}
            {expanded === job.id && (
              <div style={{
                borderTop: '1px solid var(--color-border)',
                padding: '8px 10px',
                background: 'rgba(0,0,0,0.15)',
                display: 'flex', flexDirection: 'column', gap: '4px',
              }}>
                {job.last_run && (
                  <CronMetaRow label="Last run" value={formatRelative(job.last_run)} />
                )}
                {job.next_run && (
                  <CronMetaRow label="Next run" value={formatRelative(job.next_run)} />
                )}
                <CronMetaRow label="Status" value={job.status} />
              </div>
            )}
          </div>
        ))}

        {filtered.length === 0 && (
          <p style={{ textAlign: 'center', padding: '20px', fontSize: '12px', color: 'var(--color-text-3)' }}>
            No cron jobs match this filter
          </p>
        )}
      </div>
    </div>
  )
}

function CronStatPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      textAlign: 'center', padding: '6px 4px',
      background: `${color}15`, border: `1px solid ${color}30`,
      borderRadius: '8px',
    }}>
      <div style={{ fontSize: '14px', fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: '9px', color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
    </div>
  )
}

function CronMetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: '10px', color: 'var(--color-text-3)' }}>{label}</span>
      <span style={{ fontSize: '10px', color: 'var(--color-text)' }}>{value}</span>
    </div>
  )
}

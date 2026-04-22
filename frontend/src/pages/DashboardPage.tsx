import { useState, useEffect } from 'react'
import {
  Plus, Calendar, AlertTriangle, ArrowRight, GripVertical,
  Radio, Clock, Zap, CheckCircle2, XCircle, Pause, Play,
  BookOpen, FileText, ChevronRight, RefreshCw,
  Bot, List, LayoutGrid, Loader, Edit2, Hash,
} from 'lucide-react'
import { cn, formatRelative } from '@/lib/utils'
import { api } from '@/lib/api'
import type {
  Task, TaskStatus, ChannelWithAgents, CronJob,
  KnowledgeFile, AgentOpsDashboardSummary,
} from '@/types'

// ══════════════════════════════════════════════════════════════
// CONSTANTS
// ══════════════════════════════════════════════════════════════

const TASK_COLUMNS: { id: string; title: string; status: TaskStatus }[] = [
  { id: 'backlog',     title: 'Backlog',      status: 'backlog' },
  { id: 'scheduled',   title: 'Scheduled',    status: 'scheduled' },
  { id: 'in_progress', title: 'In Progress',  status: 'in_progress' },
  { id: 'review',      title: 'Review',        status: 'review' },
  { id: 'done',        title: 'Done',          status: 'done' },
]

const TASK_STATUS_BADGE: Record<string, string> = {
  backlog:      'badge-gray',
  todo:         'badge-gray',
  in_progress:  'badge-blue',
  review:       'badge-yellow',
  done:         'badge-green',
  cancelled:    'badge-red',
}

const PRIORITY_COLOR: Record<string, string> = {
  urgent: '#ef4444',
  high:   '#f97316',
  medium: '#eab308',
  low:    '#3b82f6',
}

const CHANNEL_ICON: Record<string, string> = {
  telegram: '✈',
  discord:  '🎮',
  whatsapp: '💬',
  email:    '📧',
  web:      '🌐',
}

const TRIGGER_CONFIG_DASH: Record<string, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  manual:  { label: 'Manual',  icon: <Edit2       className="w-[9px] h-[9px]" />, color: '#9ca3af', bg: 'rgba(156,163,175,0.15)' },
  cron:    { label: 'Cron',    icon: <Clock       className="w-[9px] h-[9px]" />, color: '#60a5fa', bg: 'rgba(96,165,250,0.15)'  },
  channel: { label: 'Channel', icon: <Hash        className="w-[9px] h-[9px]" />, color: '#a78bfa', bg: 'rgba(167,139,250,0.15)' },
  system:  { label: 'System',  icon: <Zap        className="w-[9px] h-[9px]" />, color: '#f97316', bg: 'rgba(249,115,22,0.15)'  },
}

// ══════════════════════════════════════════════════════════════
// MAIN DASHBOARD PAGE
// ══════════════════════════════════════════════════════════════

export function DashboardPage() {
  const [opsData, setOpsData] = useState<AgentOpsDashboardSummary | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [view, setView] = useState<'kanban' | 'list'>('kanban')
  const [loading, setLoading] = useState(true)
  const [rightTab, setRightTab] = useState<'cron' | 'files'>('cron')

  useEffect(() => {
    Promise.all([
      api.agentOps.dashboard().catch(() => null),
      api.tasks.list().catch(() => null),
    ]).then(([opsRes, tasksRes]) => {
      if (opsRes) setOpsData(opsRes)
      if (tasksRes) setTasks(tasksRes)
      setLoading(false)
    })
  }, [])

  const metrics = opsData?.metrics ?? null
  const channels = opsData?.channels ?? []

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <DashboardHeader view={view} setView={setView} metrics={metrics} loading={loading} />

      {/* Body — 3-column layout */}
      <div style={{
        flex: 1, overflow: 'hidden', display: 'grid',
        gridTemplateColumns: '280px 1fr 300px',
        gap: 0, borderTop: '1px solid var(--color-border)',
      }}>
        {/* LEFT — Channels Board */}
        <ChannelsBoard channels={channels} loading={loading} />

        {/* Divider */}
        <div style={{ borderRight: '1px solid var(--color-border)', overflow: 'hidden' }}>
          <KanbanBoard tasks={tasks} view={view} loading={loading} />
        </div>

        {/* RIGHT — Cron Monitor + Knowledge Files */}
        <div style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <RightOpsPanel
            rightTab={rightTab}
            setRightTab={setRightTab}
          />
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// DASHBOARD HEADER
// ══════════════════════════════════════════════════════════════

function DashboardHeader({
  view, setView, metrics, loading,
}: {
  view: 'kanban' | 'list'; setView: (v: 'kanban' | 'list') => void
  metrics: AgentOpsDashboardSummary['metrics'] | null; loading: boolean
}) {
  const m = metrics
  return (
    <div style={{
      padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      borderBottom: '1px solid var(--color-border)', flexShrink: 0, gap: '12px',
    }}>
      {/* Left: title + mini metrics */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: 0 }}>
        <div>
          <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text)' }}>
            Agent Operations
          </h2>
          <p style={{ fontSize: '11px', color: 'var(--color-text-3)', marginTop: '1px' }}>
            {m ? `${m.active_channels} active channels · ${m.active_agents} agents` : 'Loading...'}
          </p>
        </div>

        {/* Inline mini metric pills */}
        {!loading && m && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <MiniPill icon="📡" label="Channels" value={m.active_channels} color="#3b82f6" />
            <MiniPill icon="🤖" label="Agents" value={m.active_agents} color="#10b981" />
            <MiniPill icon="📋" label="Pending" value={m.pending_tasks} color="#f59e0b" />
            <MiniPill icon="🔴" label="Alerts" value={m.alerts_count} color="#ef4444" />
          </div>
        )}
      </div>

      {/* Right: view toggle + new task */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        <div className="tab-toggle">
          <button onClick={() => setView('kanban')} className={view === 'kanban' ? 'active' : ''}>
            <LayoutGrid className="w-[12px] h-[12px]" />
          </button>
          <button onClick={() => setView('list')} className={view === 'list' ? 'active' : ''}>
            <List className="w-[12px] h-[12px]" />
          </button>
        </div>
        <button className="btn btn-primary">
          <Plus className="w-[12px] h-[12px]" />
          New Task
        </button>
      </div>
    </div>
  )
}

function MiniPill({ icon, label, value, color }: { icon: string; label: string; value: number; color: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '5px',
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid var(--color-border)',
      borderRadius: '20px', padding: '3px 10px',
    }}>
      <span style={{ fontSize: '12px' }}>{icon}</span>
      <span style={{ fontSize: '12px', fontWeight: 600, color }}>{value}</span>
      <span style={{ fontSize: '10px', color: 'var(--color-text-3)' }}>{label}</span>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// CHANNELS BOARD (Left Column)
// ══════════════════════════════════════════════════════════════

function ChannelsBoard({ channels, loading }: { channels: ChannelWithAgents[]; loading: boolean }) {
  const [expanded, setExpanded] = useState<string | null>(null)

  if (loading) {
    return <ChannelsSkeleton />
  }

  return (
    <div style={{ overflow: 'auto', padding: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <Radio className="w-[13px] h-[13px]" style={{ color: 'var(--color-accent)' }} />
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text)' }}>Channels</span>
        <span style={{ fontSize: '10px', color: 'var(--color-text-3)', marginLeft: 'auto' }}>
          {channels.length} total
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {channels.map(ch => {
          const isExpanded = expanded === ch.id
          const primaryAgent = ch.assigned_agents.find(a => a.is_primary)

          return (
            <div
              key={ch.id}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: `1px solid ${ch.is_active ? 'var(--color-border)' : 'rgba(239,68,68,0.3)'}`,
                borderRadius: '10px', overflow: 'hidden',
                transition: 'all 0.2s',
              }}
            >
              {/* Channel summary row */}
              <div
                style={{
                  padding: '10px 12px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '8px',
                }}
                onClick={() => setExpanded(isExpanded ? null : ch.id)}
              >
                {/* Status dot */}
                <div style={{
                  width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0,
                  background: ch.is_active
                    ? (primaryAgent ? '#10b981' : '#f59e0b')
                    : '#ef4444',
                }} />

                {/* Channel icon + name */}
                <span style={{ fontSize: '14px' }}>{CHANNEL_ICON[ch.channel] ?? '📡'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {ch.channel_name ?? ch.channel}
                  </p>
                  <p style={{ fontSize: '10px', color: 'var(--color-text-3)' }}>
                    {ch.channel} · {ch.pending_task_count} pending
                  </p>
                </div>

                {/* Agent badge */}
                {primaryAgent && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '3px',
                    background: 'rgba(16,185,129,0.15)',
                    border: '1px solid rgba(16,185,129,0.3)',
                    borderRadius: '12px', padding: '2px 7px',
                  }}>
                    <Bot className="w-[9px] h-[9px]" style={{ color: '#10b981' }} />
                    <span style={{ fontSize: '9px', color: '#10b981', fontWeight: 600 }}>
                      {primaryAgent.agent_name}
                    </span>
                  </div>
                )}

                <ChevronRight className={cn(
                  'w-[12px] h-[12px]', 'transition-transform', isExpanded && 'rotate-90',
                )} style={{ color: 'var(--color-text-3)', flexShrink: 0 }} />
              </div>

              {/* Expanded: agent list + actions */}
              {isExpanded && (
                <div style={{
                  borderTop: '1px solid var(--color-border)',
                  padding: '10px 12px',
                  background: 'rgba(0,0,0,0.15)',
                }}>
                  {/* Agents */}
                  {ch.assigned_agents.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
                      {ch.assigned_agents.map(agent => (
                        <div key={agent.id} style={{
                          display: 'flex', alignItems: 'center', gap: '6px',
                          padding: '6px 8px',
                          background: 'rgba(255,255,255,0.03)',
                          borderRadius: '6px',
                        }}>
                          <AgentStatusDot status={agent.agent_status} />
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text)' }}>
                                {agent.agent_name}
                              </span>
                              {agent.is_primary && (
                                <span style={{
                                  fontSize: '9px', background: 'rgba(59,130,246,0.2)',
                                  color: '#60a5fa', borderRadius: '4px', padding: '0 4px',
                                }}>primary</span>
                              )}
                            </div>
                            <span style={{ fontSize: '10px', color: 'var(--color-text-3)' }}>
                              {agent.tasks_count} tasks
                            </span>
                          </div>
                          <span style={{ fontSize: '10px', color: 'var(--color-text-3)' }}>
                            {agent.agent_status}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{
                      padding: '8px', textAlign: 'center', marginBottom: '10px',
                      background: 'rgba(245,158,11,0.1)',
                      border: '1px solid rgba(245,158,11,0.2)',
                      borderRadius: '6px',
                    }}>
                      <p style={{ fontSize: '11px', color: '#f59e0b' }}>No agent assigned</p>
                    </div>
                  )}

                  {/* Channel meta */}
                  {ch.last_activity_at && (
                    <p style={{ fontSize: '10px', color: 'var(--color-text-3)', marginBottom: '8px' }}>
                      Last activity: {formatRelative(ch.last_activity_at)}
                    </p>
                  )}

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {primaryAgent ? (
                      <>
                        <ChanActionBtn
                          icon={<Pause className="w-[10px] h-[10px]" />}
                          label="Pause"
                          onClick={async () => { await api.agentOps.channels.pauseAgent(ch.id).catch(() => {}) }}
                          color="#f59e0b"
                        />
                        <ChanActionBtn
                          icon={<RefreshCw className="w-[10px] h-[10px]" />}
                          label="Reconnect"
                          onClick={async () => { await api.agentOps.channels.reconnect(ch.id).catch(() => {}) }}
                          color="#3b82f6"
                        />
                      </>
                    ) : (
                      <ChanActionBtn
                        icon={<Play className="w-[10px] h-[10px]" />}
                        label="Assign Agent"
                        onClick={async () => { await Promise.resolve() }}
                        color="#10b981"
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ChanActionBtn({
  icon, label, onClick, color,
}: {
  icon: React.ReactNode; label: string; onClick: () => Promise<void>; color: string
}) {
  const [loading, setLoading] = useState(false)
  const handleClick = async () => {
    setLoading(true)
    try { await onClick() } catch { /* noop */ }
    setLoading(false)
  }
  return (
    <button
      onClick={handleClick}
      disabled={loading}
      style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
        padding: '5px 8px',
        background: `${color}18`, border: `1px solid ${color}40`,
        borderRadius: '6px', cursor: loading ? 'not-allowed' : 'pointer',
        transition: 'all 0.15s',
      }}
    >
      {loading ? (
        <RefreshCw className="w-[10px] h-[10px] animate-spin" style={{ color }} />
      ) : (
        <span style={{ color }}>{icon}</span>
      )}
      <span style={{ fontSize: '10px', fontWeight: 600, color }}>{label}</span>
    </button>
  )
}

function AgentStatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    idle: '#10b981', thinking: '#f59e0b', acting: '#3b82f6',
    error: '#ef4444', offline: '#6b7280',
  }
  return (
    <div style={{
      width: '7px', height: '7px', borderRadius: '50%',
      background: colors[status] ?? '#6b7280',
      boxShadow: status !== 'offline' ? `0 0 4px ${colors[status]}60` : 'none',
      flexShrink: 0,
    }} />
  )
}

function ChannelsSkeleton() {
  return (
    <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {[1, 2, 3].map(i => (
        <div key={i} style={{
          height: '60px', borderRadius: '10px',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid var(--color-border)',
          animation: 'pulse 2s infinite',
        }} />
      ))}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// KANBAN BOARD (Middle Column)
// ══════════════════════════════════════════════════════════════

function KanbanBoard({ tasks, view, loading }: { tasks: Task[]; view: 'kanban' | 'list'; loading: boolean }) {
  const byColumn = TASK_COLUMNS.reduce((acc, col) => {
    acc[col.id] = tasks.filter(t => t.column_status === col.id || t.status === col.status)
    return acc
  }, {} as Record<string, Task[]>)

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <p style={{ color: 'var(--color-text-3)', fontSize: '13px', animation: 'pulse 2s infinite' }}>
          Loading Command Center...
        </p>
      </div>
    )
  }

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: '12px' }}>
      {view === 'kanban' ? (
        <div style={{ display: 'flex', gap: '10px', minHeight: '100%', width: 'max-content', minWidth: '100%' }}>
          {TASK_COLUMNS.map(col => (
            <KanbanColumn
              key={col.id}
              id={col.id}
              title={col.title}
              tasks={byColumn[col.id] ?? []}
            />
          ))}
        </div>
      ) : (
        <TaskListView tasks={tasks} />
      )}
    </div>
  )
}

function KanbanColumn({ id, title, tasks }: { id: string; title: string; tasks: Task[] }) {
  return (
    <div className={cn('kanban-col', id)} style={{ minWidth: '180px', width: '180px' }}>
      <div className="kanban-col-header">
        <span className="kanban-col-title">{title}</span>
        <span className="kanban-col-count">{tasks.length}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
        {tasks.map(task => <TaskCard key={task.id} task={task} />)}
        {tasks.length === 0 && (
          <div style={{ padding: '12px', textAlign: 'center', borderRadius: '8px', border: '1px dashed var(--color-border)' }}>
            <p style={{ fontSize: '11px', color: 'var(--color-text-3)' }}>No tasks</p>
          </div>
        )}
      </div>
    </div>
  )
}

function TaskCard({ task }: { task: Task }) {
  const isOverdue = !!task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done'
  const tCfg = task.trigger_source ? TRIGGER_CONFIG_DASH[task.trigger_source] : null
  return (
    <div className="task-card" style={{ position: 'relative' }}>
      <div style={{
        position: 'absolute', left: 0, top: '10px', bottom: '10px',
        width: '3px', borderRadius: '2px',
        background: PRIORITY_COLOR[task.priority] ?? '#3b82f6',
      }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', paddingLeft: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span className={cn('badge', TASK_STATUS_BADGE[task.status])} style={{ fontSize: '9px' }}>
            {task.status.replace('_', ' ')}
          </span>
          {tCfg && (
            <span className="inline-flex items-center gap-1 px-1 py-0.5 rounded text-[9px] font-medium"
              style={{ color: tCfg.color, background: tCfg.bg }}>
              {tCfg.icon}{tCfg.label}
            </span>
          )}
        </div>
        {isOverdue && <AlertTriangle className="w-[11px] h-[11px]" style={{ color: 'var(--color-error)' }} />}
      </div>
      <p style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text)', marginBottom: '8px', paddingLeft: '10px', lineHeight: 1.4 }}>
        {task.title}
      </p>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {task.due_date && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px', color: 'var(--color-text-3)' }}>
              <Calendar className="w-[10px] h-[10px]" />
              <span style={{ fontSize: '10px', color: isOverdue ? 'var(--color-error)' : 'var(--color-text-3)' }}>
                {formatRelative(task.due_date)}
              </span>
            </div>
          )}
          {task.channel_name && (
            <span style={{ fontSize: '10px', color: 'var(--color-text-3)' }}>
              {CHANNEL_ICON[task.channel_id?.replace('ch_', '') ?? ''] ?? ''} {task.channel_name}
            </span>
          )}
          {task.agent_name && (
            <span style={{ fontSize: '10px', color: '#60a5fa' }}>
              <Bot className="w-[10px] h-[10px] inline" /> {task.agent_name}
            </span>
          )}
        </div>
        {task.tags.length > 0 && (
          <span className="badge badge-gray" style={{ fontSize: '9px' }}>{task.tags[0]}</span>
        )}
      </div>
    </div>
  )
}

function TaskListView({ tasks }: { tasks: Task[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 90px 90px 110px 40px',
        padding: '0 12px', gap: '10px',
        fontSize: '10px', fontWeight: 600, letterSpacing: '0.06em',
        textTransform: 'uppercase', color: 'var(--color-text-3)', marginBottom: '4px',
      }}>
        <span>Task</span><span>Status</span><span>Priority</span><span>Due</span><span />
      </div>
      {tasks.map(task => {
        const isOverdue = !!task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done'
        return (
          <div key={task.id} className="card" style={{
            padding: '9px 12px',
            display: 'grid', gridTemplateColumns: '1fr 90px 90px 110px 40px',
            gap: '10px', alignItems: 'center',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
              <GripVertical className="w-[12px] h-[12px]" style={{ color: 'var(--color-text-3)', flexShrink: 0 }} />
              <div style={{
                width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
                background: PRIORITY_COLOR[task.priority] ?? '#3b82f6',
              }} />
              <span style={{ fontSize: '12px', color: 'var(--color-text)' }} className="truncate">
                {task.title}
              </span>
            </div>
            <span className={cn('badge', TASK_STATUS_BADGE[task.status])} style={{ fontSize: '10px', justifySelf: 'start' }}>
              {task.status.replace('_', ' ')}
            </span>
            <span style={{ fontSize: '11px', color: PRIORITY_COLOR[task.priority], fontWeight: 500, textTransform: 'capitalize' }}>
              {task.priority}
            </span>
            <span style={{ fontSize: '11px', color: isOverdue ? 'var(--color-error)' : 'var(--color-text-3)' }}>
              {task.due_date ? formatRelative(task.due_date) : '—'}
            </span>
            <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-3)', display: 'flex', justifyContent: 'flex-end' }}>
              <ArrowRight className="w-[12px] h-[12px]" />
            </button>
          </div>
        )
      })}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// RIGHT OPS PANEL — Cron Monitor + Knowledge Files
// ══════════════════════════════════════════════════════════════

function RightOpsPanel({
  rightTab, setRightTab,
}: {
  rightTab: 'cron' | 'files'
  setRightTab: (t: 'cron' | 'files') => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Tab bar */}
      <div style={{
        display: 'flex', borderBottom: '1px solid var(--color-border)',
        flexShrink: 0, padding: '0 4px',
      }}>
        <TabBtn active={rightTab === 'cron'} onClick={() => setRightTab('cron')} icon={<Clock className="w-[11px] h-[11px]" />} label="Cron Monitor" />
        <TabBtn active={rightTab === 'files'} onClick={() => setRightTab('files')} icon={<BookOpen className="w-[11px] h-[11px]" />} label="Knowledge" />
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {rightTab === 'cron'
          ? <CronMonitor />
          : <KnowledgePanel />
        }
      </div>
    </div>
  )
}

function TabBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
        padding: '8px 4px',
        background: 'none', border: 'none', cursor: 'pointer',
        borderBottom: active ? '2px solid var(--color-accent)' : '2px solid transparent',
        transition: 'all 0.15s',
      }}
    >
      <span style={{ color: active ? 'var(--color-accent)' : 'var(--color-text-3)' }}>{icon}</span>
      <span style={{
        fontSize: '11px', fontWeight: active ? 600 : 400,
        color: active ? 'var(--color-accent)' : 'var(--color-text-3)',
      }}>{label}</span>
    </button>
  )
}

// ══════════════════════════════════════════════════════════════
// CRON MONITOR
// ══════════════════════════════════════════════════════════════

function CronMonitor() {
  const [jobs, setJobs] = useState<CronJob[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | 'failed' | 'running' | 'paused' | 'idle'>('all')
  const [channelFilter, setChannelFilter] = useState<string>('all')
  const [runningIds, setRunningIds] = useState<Set<string>>(new Set())
  const [pausingIds, setPausingIds] = useState<Set<string>>(new Set())
  const [resumingIds, setResumingIds] = useState<Set<string>>(new Set())

  // Load cron jobs on mount
  useEffect(() => {
    api.agentOps.cronJobs.list().then(data => {
      setJobs(data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  // Derive unique channels for filter dropdown
  const channels = Array.from(
    new Map(
      jobs
        .filter(j => j.channel_id && j.channel_name)
        .map(j => [j.channel_id!, j.channel_name!])
    ).entries()
  ).map(([id, name]) => ({ id, name }))

  const filtered = jobs.filter(j => {
    if (statusFilter === 'failed') return j.status === 'failed' || j.last_run_result === 'failed'
    if (statusFilter !== 'all') return j.status === statusFilter
    if (channelFilter !== 'all') return j.channel_id === channelFilter
    return true
  })

  const activeCount  = jobs.filter(j => j.status === 'active').length
  const runningCount = jobs.filter(j => j.status === 'running').length
  const failedCount  = jobs.filter(j => j.status === 'failed').length
  const pausedCount  = jobs.filter(j => j.status === 'paused').length

  const handleRun = (jobId: string) => {
    setRunningIds(prev => new Set(prev).add(jobId))
    api.agentOps.cronJobs.run(jobId)
      .then(() => {
        setJobs(prev => prev.map(j =>
          j.id === jobId ? { ...j, status: 'running', last_run_at: new Date().toISOString() } : j
        ))
      })
      .catch(() => {})
      .finally(() => setRunningIds(prev => { const s = new Set(prev); s.delete(jobId); return s }))
  }

  const handlePause = (jobId: string) => {
    setPausingIds(prev => new Set(prev).add(jobId))
    api.agentOps.cronJobs.pause(jobId)
      .then(() => setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: 'paused' } : j)))
      .catch(() => {})
      .finally(() => setPausingIds(prev => { const s = new Set(prev); s.delete(jobId); return s }))
  }

  const handleResume = (jobId: string) => {
    setResumingIds(prev => new Set(prev).add(jobId))
    api.agentOps.cronJobs.resume(jobId)
      .then(() => setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: 'active' } : j)))
      .catch(() => {})
      .finally(() => setResumingIds(prev => { const s = new Set(prev); s.delete(jobId); return s }))
  }

  if (loading) return <CronSkeleton />

  return (
    <div style={{ padding: '10px' }}>
      {/* Summary row — 4-column */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr 1fr',
        gap: '6px', marginBottom: '10px',
      }}>
        <CronStatPill label="Active"  value={activeCount}  color="#10b981" />
        <CronStatPill label="Running" value={runningCount} color="#3b82f6" />
        <CronStatPill label="Failed"  value={failedCount}  color="#ef4444" />
        <CronStatPill label="Paused"  value={pausedCount}  color="#f59e0b" />
      </div>

      {/* Channel filter dropdown */}
      {channels.length > 0 && (
        <div style={{ marginBottom: '8px' }}>
          <select
            value={channelFilter}
            onChange={e => setChannelFilter(e.target.value)}
            style={{
              width: '100%', padding: '5px 8px', fontSize: '11px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid var(--color-border)',
              borderRadius: '6px', color: 'var(--color-text)',
              cursor: 'pointer',
            }}
          >
            <option value="all">All Channels</option>
            {channels.map(ch => (
              <option key={ch.id} value={ch.id}>{ch.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Status filter tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '8px', flexWrap: 'wrap' }}>
        {(['all', 'failed', 'running', 'paused', 'idle'] as const).map(f => (
          <button
            key={f}
            onClick={() => setStatusFilter(f)}
            style={{
              flex: 1, minWidth: '40px', padding: '4px 2px',
              fontSize: '10px', fontWeight: 600,
              background: statusFilter === f ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${statusFilter === f ? 'rgba(59,130,246,0.4)' : 'var(--color-border)'}`,
              borderRadius: '6px', cursor: 'pointer',
              color: statusFilter === f ? '#60a5fa' : 'var(--color-text-3)',
              textTransform: 'capitalize',
              whiteSpace: 'nowrap',
            }}
          >{f}</button>
        ))}
      </div>

      {/* Job list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {filtered.map(job => (
          <CronJobRow
            key={job.id}
            job={job}
            expanded={expanded === job.id}
            onToggle={() => setExpanded(expanded === job.id ? null : job.id)}
            onPause={() => handlePause(job.id)}
            onResume={() => handleResume(job.id)}
            onRun={() => handleRun(job.id)}
            isRunning={runningIds.has(job.id)}
            isPausing={pausingIds.has(job.id)}
            isResuming={resumingIds.has(job.id)}
          />
        ))}
        {filtered.length === 0 && (
          <p style={{ textAlign: 'center', padding: '20px', fontSize: '12px', color: 'var(--color-text-3)' }}>
            No jobs match the selected filters
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
      <div style={{ fontSize: '16px', fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: '9px', color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
    </div>
  )
}

function CronJobRow({
  job, expanded, onToggle, onPause, onResume, onRun,
  isRunning, isPausing, isResuming,
}: {
  job: CronJob; expanded: boolean; onToggle: () => void
  onPause: () => void; onResume: () => void; onRun: () => void
  isRunning?: boolean; isPausing?: boolean; isResuming?: boolean
}) {
  const statusColor: Record<string, string> = {
    active: '#10b981', running: '#3b82f6', paused: '#f59e0b', failed: '#ef4444', idle: '#6b7280',
  }
  const resultIcon: Record<string, React.ReactNode> = {
    success: <CheckCircle2 className="w-[10px] h-[10px]" style={{ color: '#10b981' }} />,
    failed: <XCircle className="w-[10px] h-[10px]" style={{ color: '#ef4444' }} />,
    partial: <AlertTriangle className="w-[10px] h-[10px]" style={{ color: '#f59e0b' }} />,
  }

  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: `1px solid ${job.status === 'failed' ? 'rgba(239,68,68,0.35)' : 'var(--color-border)'}`,
      borderRadius: '8px', overflow: 'hidden',
    }}>
      <div style={{ padding: '8px 10px', display: 'flex', alignItems: 'center', gap: '7px', cursor: 'pointer' }} onClick={onToggle}>
        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: statusColor[job.status] ?? '#6b7280', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text)' }} className="truncate">
            {job.name}
          </p>
          <p style={{ fontSize: '10px', color: 'var(--color-text-3)' }}>
            {job.schedule ?? job.cron_expression}
            {job.channel_name && (
              <span style={{ marginLeft: '5px', color: '#60a5fa' }}>
                · {job.channel_name}
              </span>
            )}
          </p>
        </div>
        {job.last_run_result && resultIcon[job.last_run_result]}
        <ChevronRight className={cn('w-[11px] h-[11px] transition-transform', expanded && 'rotate-90')} style={{ color: 'var(--color-text-3)', flexShrink: 0 }} />
      </div>

      {expanded && (
        <div style={{ borderTop: '1px solid var(--color-border)', padding: '8px 10px', background: 'rgba(0,0,0,0.15)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' }}>
            {/* Channel + Agent meta */}
            {job.channel_name && (
              <CronMetaRow
                label="Channel"
                value={<span style={{ color: '#60a5fa', fontSize: '10px' }}>{job.channel_name}</span>}
              />
            )}
            {job.agent_name && (
              <CronMetaRow
                label="Agent"
                value={<span style={{ fontSize: '10px' }}>{job.agent_name}</span>}
              />
            )}
            {job.last_run_at && (
              <CronMetaRow
                label="Last run"
                value={`${formatRelative(job.last_run_at)}${job.last_run_duration_ms ? ` · ${job.last_run_duration_ms}ms` : ''}`}
              />
            )}
            {job.next_run_at && (
              <CronMetaRow label="Next run" value={formatRelative(job.next_run_at)} />
            )}
            <CronMetaRow label="Trigger" value={job.trigger_type} />
            <CronMetaRow label="Runs" value={job.run_count.toLocaleString()} />
            {job.last_run_error && (
              <div style={{
                padding: '5px 7px', background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.25)', borderRadius: '5px', marginTop: '2px',
              }}>
                <p style={{ fontSize: '10px', color: '#ef4444' }}>{job.last_run_error}</p>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '5px' }}>
            {job.status === 'active' && (
              <CronActionBtn
                icon={<Pause className="w-[9px] h-[9px]" />}
                label={isPausing ? 'Pausing…' : 'Pause'}
                onClick={onPause}
                color="#f59e0b"
                loading={isPausing}
              />
            )}
            {job.status === 'paused' && (
              <CronActionBtn
                icon={<Play className="w-[9px] h-[9px]" />}
                label={isResuming ? 'Resuming…' : 'Resume'}
                onClick={onResume}
                color="#10b981"
                loading={isResuming}
              />
            )}
            {job.status === 'idle' && (
              <CronActionBtn
                icon={<Play className="w-[9px] h-[9px]" />}
                label={isResuming ? 'Resuming…' : 'Activate'}
                onClick={onResume}
                color="#10b981"
                loading={isResuming}
              />
            )}
            <CronActionBtn
              icon={<Zap className="w-[9px] h-[9px]" />}
              label={isRunning ? 'Running…' : 'Run Now'}
              onClick={onRun}
              color="#3b82f6"
              loading={isRunning}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function CronMetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: '10px', color: 'var(--color-text-3)' }}>{label}</span>
      <span style={{ fontSize: '10px', color: 'var(--color-text)' }}>{value}</span>
    </div>
  )
}

function CronActionBtn({ icon, label, onClick, color, loading }: { icon: React.ReactNode; label: string; onClick: () => void; color: string; loading?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
        padding: '4px 6px',
        background: `${color}15`, border: `1px solid ${color}35`,
        borderRadius: '5px', cursor: loading ? 'not-allowed' : 'pointer',
        opacity: loading ? 0.65 : 1,
      }}
    >
      {loading
        ? <Loader className="w-[9px] h-[9px] animate-spin" style={{ color }} />
        : <span style={{ color }}>{icon}</span>
      }
      <span style={{ fontSize: '10px', fontWeight: 600, color }}>{label}</span>
    </button>
  )
}

function CronSkeleton() {
  return (
    <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '6px', marginBottom: '10px' }}>
        {[1, 2, 3, 4].map(i => <div key={i} style={{ height: '44px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--color-border)', animation: 'pulse 2s infinite' }} />)}
      </div>
      {[1, 2, 3].map(i => <div key={i} style={{ height: '52px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--color-border)', animation: 'pulse 2s infinite' }} />)}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// KNOWLEDGE PANEL
// ══════════════════════════════════════════════════════════════

function KnowledgePanel() {
  const [files, setFiles] = useState<KnowledgeFile[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'active' | 'archived'>('all')

  useEffect(() => {
    api.agentOps.knowledgeFiles.list().then(data => {
      setFiles(data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const filtered = files.filter(f => {
    if (filter === 'all') return true
    return f.status === filter
  })

  if (loading) return <KnowledgeSkeleton />

  const enabled = files.filter(f => f.is_enabled).length

  return (
    <div style={{ padding: '10px' }}>
      {/* Summary */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        <BookOpen className="w-[12px] h-[12px]" style={{ color: 'var(--color-accent)' }} />
        <span style={{ fontSize: '11px', color: 'var(--color-text-3)' }}>
          {enabled}/{files.length} files active
        </span>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
        {(['all', 'active', 'archived'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            flex: 1, padding: '4px', fontSize: '10px', fontWeight: 600,
            background: filter === f ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${filter === f ? 'rgba(16,185,129,0.35)' : 'var(--color-border)'}`,
            borderRadius: '6px', cursor: 'pointer', color: filter === f ? '#10b981' : 'var(--color-text-3)',
            textTransform: 'capitalize',
          }}>{f}</button>
        ))}
      </div>

      {/* File list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {filtered.map(file => (
          <KnowledgeFileRow
            key={file.id}
            file={file}
            onToggle={(enabled) => {
              api.agentOps.knowledgeFiles.toggle(file.id, enabled).then(() =>
                setFiles(prev => prev.map(f => f.id === file.id ? { ...f, is_enabled: enabled, status: enabled ? 'active' : 'disabled' } : f))
              ).catch(() => {})
            }}
          />
        ))}
        {filtered.length === 0 && (
          <p style={{ textAlign: 'center', padding: '20px', fontSize: '12px', color: 'var(--color-text-3)' }}>
            No files match this filter
          </p>
        )}
      </div>
    </div>
  )
}

function KnowledgeFileRow({ file, onToggle }: { file: KnowledgeFile; onToggle: (enabled: boolean) => void }) {
  const sizeKb = file.file_size_bytes ? Math.round(file.file_size_bytes / 1024) : null

  return (
    <div style={{
      padding: '8px 10px',
      background: 'rgba(255,255,255,0.03)',
      border: `1px solid ${file.is_enabled ? 'var(--color-border)' : 'rgba(245,158,11,0.3)'}`,
      borderRadius: '8px',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '6px' }}>
        <FileText className="w-[13px] h-[13px]" style={{ color: file.is_enabled ? 'var(--color-accent)' : 'var(--color-text-3)', flexShrink: 0, marginTop: '1px' }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: '11px', fontWeight: 600, color: file.is_enabled ? 'var(--color-text)' : 'var(--color-text-3)' }} className="truncate">
            {file.title ?? file.filename}
          </p>
          <p style={{ fontSize: '10px', color: 'var(--color-text-3)' }} className="truncate">
            {file.filename}
          </p>
        </div>
        {/* Toggle */}
        <button
          onClick={() => onToggle(!file.is_enabled)}
          style={{
            width: '28px', height: '16px', borderRadius: '8px',
            background: file.is_enabled ? '#10b981' : 'rgba(255,255,255,0.1)',
            border: `1px solid ${file.is_enabled ? '#10b981' : 'var(--color-border)'}`,
            position: 'relative', cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0,
          }}
        >
          <div style={{
            width: '12px', height: '12px', borderRadius: '50%',
            background: 'white',
            position: 'absolute', top: '1px',
            left: file.is_enabled ? '13px' : '1px',
            transition: 'left 0.2s',
          }} />
        </button>
      </div>

      {/* Tags + meta */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
        {file.tags.slice(0, 3).map(tag => (
          <span key={tag} className="badge badge-gray" style={{ fontSize: '9px' }}>{tag}</span>
        ))}
        {sizeKb && (
          <span style={{ fontSize: '9px', color: 'var(--color-text-3)', marginLeft: 'auto' }}>
            {sizeKb}KB
          </span>
        )}
        {file.instruction_weight && (
          <span style={{ fontSize: '9px', color: 'var(--color-accent)' }}>
            {(file.instruction_weight * 100).toFixed(0)}% weight
          </span>
        )}
      </div>
    </div>
  )
}

function KnowledgeSkeleton() {
  return (
    <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {[1, 2, 3, 4].map(i => (
        <div key={i} style={{ height: '64px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--color-border)', animation: 'pulse 2s infinite' }} />
      ))}
    </div>
  )
}

// ============================================================
// Channel Operations — Mission Control V1
// Full channel management dashboard: status, agents, cron jobs
// ============================================================

import { useState, useEffect, useCallback } from 'react'
import {
  Radio, RefreshCw, Pause, Play, Clock, Bot, ChevronRight,
  Loader, AlertCircle, WifiOff, List,
  LayoutGrid, CheckCircle2, XCircle,
  Zap, X, FileText,
} from 'lucide-react'
import { api } from '@/lib/api'
import { formatRelative } from '@/lib/utils'
import type {
  ChannelWithAgents,
  AgentChannelAssignment,
  CronJob,
  ChannelType,
} from '@/types'

// ─── Constants ───────────────────────────────────────────────

const CHANNEL_ICON: Record<string, string> = {
  telegram: '✈',
  discord:  '🎮',
  whatsapp: '💬',
  email:    '📧',
  web:      '🌐',
}

const AGENT_STATUS_COLOR: Record<string, string> = {
  idle:    '#10b981',
  thinking: '#f59e0b',
  acting:  '#3b82f6',
  error:   '#ef4444',
  offline: '#6b7280',
}

const AGENT_STATUS_LABEL: Record<string, string> = {
  idle:    'Idle',
  thinking: 'Thinking',
  acting:  'Acting',
  error:   'Error',
  offline: 'Offline',
}

// ─── Helpers ────────────────────────────────────────────────

function getConnectionStatus(ch: ChannelWithAgents): 'online' | 'idle' | 'offline' {
  if (!ch.is_active) return 'offline'
  const primary = ch.assigned_agents.find(a => a.is_primary)
  if (!primary) return 'offline'
  if (primary.agent_status === 'idle') return 'idle'
  if (primary.agent_status === 'offline') return 'offline'
  return 'online'
}

function getConnectionColor(status: ReturnType<typeof getConnectionStatus>): string {
  return { online: '#10b981', idle: '#f59e0b', offline: '#ef4444' }[status]
}

function getTelegramMeta(meta: Record<string, unknown>): { botUsername?: string; chatCount?: number } {
  return {
    botUsername: meta.bot_username as string | undefined,
    chatCount: meta.chat_count as number | undefined,
  }
}

// ─── Sub-components ─────────────────────────────────────────

/** Summary stat pill */
function StatPill({ icon, label, value, color }: { icon: string; label: string; value: number | string; color?: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '7px',
      padding: '6px 12px',
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid var(--color-border)',
      borderRadius: '10px',
    }}>
      <span style={{ fontSize: '14px' }}>{icon}</span>
      <div>
        <p style={{ fontSize: '13px', fontWeight: 700, color: color ?? 'var(--color-text)', lineHeight: 1 }}>{value}</p>
        <p style={{ fontSize: '10px', color: 'var(--color-text-3)', marginTop: '1px' }}>{label}</p>
      </div>
    </div>
  )
}

/** Agent status dot */
function AgentDot({ status }: { status: string }) {
  const color = AGENT_STATUS_COLOR[status] ?? '#6b7280'
  return (
    <div style={{
      width: '7px', height: '7px', borderRadius: '50%',
      background: color,
      boxShadow: status !== 'offline' ? `0 0 5px ${color}70` : 'none',
      flexShrink: 0,
    }} />
  )
}

/** Individual agent row inside detail panel */
function AgentRow({
  agent,
  onPauseAgent,
  onResumeAgent,
  loadingId,
}: {
  agent: AgentChannelAssignment
  onPauseAgent: (agentId: string) => void
  onResumeAgent: (agentId: string) => void
  loadingId: string | null
}) {
  const isLoading = loadingId === agent.id
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '10px',
      padding: '9px 12px',
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid var(--color-border)',
      borderRadius: '8px',
    }}>
      <AgentDot status={agent.agent_status} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text)' }}>{agent.agent_name}</p>
          {agent.is_primary && (
            <span style={{
              fontSize: '9px', padding: '1px 5px',
              background: 'rgba(59,130,246,0.15)',
              border: '1px solid rgba(59,130,246,0.35)',
              borderRadius: '4px', color: '#60a5fa', fontWeight: 600,
            }}>primary</span>
          )}
        </div>
        <p style={{ fontSize: '10px', color: 'var(--color-text-3)', marginTop: '1px' }}>
          {agent.tasks_count} tasks
        </p>
      </div>
      <span style={{
        fontSize: '10px', fontWeight: 600,
        color: AGENT_STATUS_COLOR[agent.agent_status] ?? '#6b7280',
        textTransform: 'capitalize',
      }}>
        {AGENT_STATUS_LABEL[agent.agent_status] ?? agent.agent_status}
      </span>
      {isLoading ? (
        <Loader className="w-[12px] h-[12px] animate-spin" style={{ color: 'var(--color-text-3)' }} />
      ) : (
        <div style={{ display: 'flex', gap: '4px' }}>
          {agent.is_active ? (
            <button
              onClick={() => onPauseAgent(agent.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '3px',
                padding: '3px 8px',
                background: 'rgba(245,158,11,0.12)',
                border: '1px solid rgba(245,158,11,0.35)',
                borderRadius: '6px', cursor: 'pointer',
              }}
            >
              <Pause className="w-[9px] h-[9px]" style={{ color: '#f59e0b' }} />
              <span style={{ fontSize: '10px', fontWeight: 600, color: '#f59e0b' }}>Pause</span>
            </button>
          ) : (
            <button
              onClick={() => onResumeAgent(agent.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '3px',
                padding: '3px 8px',
                background: 'rgba(16,185,129,0.12)',
                border: '1px solid rgba(16,185,129,0.35)',
                borderRadius: '6px', cursor: 'pointer',
              }}
            >
              <Play className="w-[9px] h-[9px]" style={{ color: '#10b981' }} />
              <span style={{ fontSize: '10px', fontWeight: 600, color: '#10b981' }}>Resume</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/** Cron job row inside channel detail panel */
function CronJobRow({
  job,
  onTrigger,
  triggeringId,
}: {
  job: CronJob
  onTrigger: (cronJobId: string) => void
  triggeringId: string | null
}) {
  const isTriggering = triggeringId === job.id
  const statusColors: Record<string, string> = {
    active:  '#10b981',
    paused:  '#f59e0b',
    running: '#3b82f6',
    failed:  '#ef4444',
    idle:    '#6b7280',
  }
  const color = statusColors[job.status] ?? '#6b7280'

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '10px',
      padding: '8px 12px',
      background: 'rgba(255,255,255,0.03)',
      border: `1px solid ${job.status === 'failed' ? 'rgba(239,68,68,0.35)' : 'var(--color-border)'}`,
      borderRadius: '8px',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text)' }} className="truncate">
          {job.name}
        </p>
        <p style={{ fontSize: '10px', color: 'var(--color-text-3)', marginTop: '1px' }}>
          {job.schedule ?? job.cron_expression ?? 'manual'}
        </p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        {job.last_run_result && (
          job.last_run_result === 'success'
            ? <CheckCircle2 className="w-[10px] h-[10px]" style={{ color: '#10b981' }} />
            : <XCircle className="w-[10px] h-[10px]" style={{ color: '#ef4444' }} />
        )}
        <span style={{
          fontSize: '10px', fontWeight: 600, color,
          textTransform: 'capitalize',
        }}>
          {job.status}
        </span>
      </div>
      <button
        onClick={() => onTrigger(job.id)}
        disabled={isTriggering}
        style={{
          display: 'flex', alignItems: 'center', gap: '3px',
          padding: '3px 8px',
          background: isTriggering ? 'rgba(59,130,246,0.08)' : 'rgba(59,130,246,0.12)',
          border: `1px solid ${isTriggering ? 'rgba(59,130,246,0.25)' : 'rgba(59,130,246,0.35)'}`,
          borderRadius: '6px', cursor: isTriggering ? 'not-allowed' : 'pointer',
          opacity: isTriggering ? 0.6 : 1,
        }}
      >
        {isTriggering
          ? <Loader className="w-[9px] h-[9px] animate-spin" style={{ color: '#60a5fa' }} />
          : <Zap className="w-[9px] h-[9px]" style={{ color: '#60a5fa' }} />
        }
        <span style={{ fontSize: '10px', fontWeight: 600, color: '#60a5fa' }}>
          {isTriggering ? 'Running...' : 'Run Now'}
        </span>
      </button>
    </div>
  )
}

/** Right-side channel detail panel */
function ChannelDetailPanel({
  channel,
  cronJobs,
  loadingCronJobs,
  triggeringCronId,
  actionLoadingId,
  onClose,
  onPauseAgent,
  onResumeAgent,
  onReconnect,
  onTriggerCron,
  onStartPolling,
  onStopPolling,
}: {
  channel: ChannelWithAgents
  cronJobs: CronJob[]
  loadingCronJobs: boolean
  triggeringCronId: string | null
  actionLoadingId: string | null
  onClose: () => void
  onPauseAgent: (channelId: string, agentId: string) => void
  onResumeAgent: (channelId: string, agentId: string) => void
  onReconnect: (channelId: string) => void
  onTriggerCron: (channelId: string, cronJobId: string) => void
  onStartPolling: (channelId: string) => void
  onStopPolling: (channelId: string) => void
}) {
  const { botUsername, chatCount } = getTelegramMeta(channel.channel_meta)
  const status = getConnectionStatus(channel)
  const statusColor = getConnectionColor(status)
  const primaryAgent = channel.assigned_agents.find(a => a.is_primary)
  const polling = channel.polling
  const isTelegram = channel.channel === 'telegram'
  const pollingStatusColors: Record<string, string> = {
    stopped: '#6b7280',
    running: '#10b981',
    error: '#ef4444',
  }

  return (
    <div style={{
      width: '340px', flexShrink: 0,
      borderLeft: '1px solid var(--color-border)',
      display: 'flex', flexDirection: 'column',
      height: '100%', overflow: 'hidden',
      background: 'var(--color-surface-1)',
    }}>
      {/* Panel header */}
      <div style={{
        padding: '14px 16px',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex', alignItems: 'center', gap: '10px',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: '20px' }}>{CHANNEL_ICON[channel.channel] ?? '📡'}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text)' }} className="truncate">
            {channel.channel_name ?? channel.channel}
          </p>
          <p style={{ fontSize: '10px', color: 'var(--color-text-3)', textTransform: 'capitalize' }}>
            {channel.channel}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: statusColor }} />
          <span style={{ fontSize: '10px', fontWeight: 600, color: statusColor, textTransform: 'capitalize' }}>
            {status}
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--color-text-3)', padding: '4px',
            display: 'flex', alignItems: 'center',
          }}
        >
          <X className="w-[14px] h-[14px]" />
        </button>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* ── Channel info ── */}
        <section>
          <SectionTitle>Channel Info</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
            <MetaRow label="Type" value={<span style={{ textTransform: 'capitalize' }}>{channel.channel}</span>} />
            <MetaRow label="Status" value={
              <span style={{ color: statusColor, fontWeight: 600, fontSize: '11px', textTransform: 'capitalize' }}>{status}</span>
            } />
            {botUsername && <MetaRow label="Bot" value={<span style={{ color: '#60a5fa', fontSize: '11px' }}>@{botUsername}</span>} />}
            {chatCount != null && <MetaRow label="Chats" value={<span style={{ fontSize: '11px' }}>{chatCount.toLocaleString()}</span>} />}
            {channel.last_ping_at && (
              <MetaRow label="Last ping" value={<span style={{ fontSize: '11px' }}>{formatRelative(channel.last_ping_at)}</span>} />
            )}
            {channel.created_at && (
              <MetaRow label="Connected" value={<span style={{ fontSize: '11px' }}>{formatRelative(channel.created_at)}</span>} />
            )}
            <MetaRow label="Pending tasks" value={<span style={{ fontSize: '11px', color: channel.pending_task_count > 0 ? '#f59e0b' : undefined }}>{channel.pending_task_count}</span>} />
          </div>
        </section>

        {/* ── Quick Actions ── */}
        <section>
          <SectionTitle>Quick Actions</SectionTitle>
          <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
            <ActionBtn
              icon={<RefreshCw className="w-[11px] h-[11px]" />}
              label="Reconnect"
              color="#3b82f6"
              loading={actionLoadingId === 'reconnect'}
              onClick={() => onReconnect(channel.id)}
            />
            {primaryAgent?.is_active ? (
              <ActionBtn
                icon={<Pause className="w-[11px] h-[11px]" />}
                label="Pause Agent"
                color="#f59e0b"
                loading={actionLoadingId === 'pause'}
                onClick={() => primaryAgent && onPauseAgent(channel.id, primaryAgent.id)}
              />
            ) : (
              <ActionBtn
                icon={<Play className="w-[11px] h-[11px]" />}
                label="Resume Agent"
                color="#10b981"
                loading={actionLoadingId === 'resume'}
                onClick={() => primaryAgent && onResumeAgent(channel.id, primaryAgent.id)}
              />
            )}
          </div>
        </section>

        {/* ── Telegram Polling (Telegram only) ── */}
        {isTelegram && (
          <section>
            <SectionTitle>
              <span>Telegram Polling</span>
              {polling && (
                <span style={{
                  fontSize: '10px', padding: '1px 6px',
                  background: `${pollingStatusColors[polling.status] ?? '#6b7280'}18`,
                  border: `1px solid ${pollingStatusColors[polling.status] ?? '#6b7280'}45`,
                  borderRadius: '10px',
                  color: pollingStatusColors[polling.status] ?? '#6b7280',
                  fontWeight: 600,
                }}>{polling.status}</span>
              )}
            </SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
              {polling && (
                <>
                  {polling.started_at && (
                    <MetaRow label="Started" value={<span style={{ fontSize: '11px' }}>{formatRelative(polling.started_at)}</span>} />
                  )}
                  {polling.last_update_id != null && (
                    <MetaRow label="Last update ID" value={<span style={{ fontSize: '11px' }}>{polling.last_update_id.toLocaleString()}</span>} />
                  )}
                  {polling.updates_pending > 0 && (
                    <MetaRow label="Pending" value={<span style={{ fontSize: '11px', color: '#f59e0b' }}>{polling.updates_pending}</span>} />
                  )}
                  {polling.error_message && (
                    <div style={{
                      padding: '8px 10px',
                      background: 'rgba(239,68,68,0.1)',
                      border: '1px solid rgba(239,68,68,0.3)',
                      borderRadius: '8px',
                      fontSize: '11px',
                      color: '#ef4444',
                    }}>
                      <AlertCircle className="w-[10px] h-[10px] inline mr-1" />
                      {polling.error_message}
                    </div>
                  )}
                </>
              )}
              <div style={{ display: 'flex', gap: '6px' }}>
                {(!polling || polling.status === 'stopped' || polling.status === 'error') ? (
                  <ActionBtn
                    icon={<Play className="w-[11px] h-[11px]" />}
                    label="Start Polling"
                    color="#10b981"
                    loading={actionLoadingId === 'startPolling'}
                    onClick={() => onStartPolling(channel.id)}
                  />
                ) : (
                  <ActionBtn
                    icon={<Pause className="w-[11px] h-[11px]" />}
                    label="Stop Polling"
                    color="#f59e0b"
                    loading={actionLoadingId === 'stopPolling'}
                    onClick={() => onStopPolling(channel.id)}
                  />
                )}
              </div>
            </div>
          </section>
        )}

        {/* ── Assigned Agents ── */}
        <section>
          <SectionTitle>
            <span>Assigned Agents</span>
            <span style={{
              fontSize: '10px', padding: '1px 6px',
              background: 'rgba(59,130,246,0.12)',
              border: '1px solid rgba(59,130,246,0.25)',
              borderRadius: '10px', color: '#60a5fa', fontWeight: 600,
            }}>{channel.assigned_agents.length}</span>
          </SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '8px' }}>
            {channel.assigned_agents.length === 0 ? (
              <EmptyStateSmall message="No agents assigned to this channel" />
            ) : (
              channel.assigned_agents.map(agent => (
                <AgentRow
                  key={agent.id}
                  agent={agent}
                  onPauseAgent={(agentId) => onPauseAgent(channel.id, agentId)}
                  onResumeAgent={(agentId) => onResumeAgent(channel.id, agentId)}
                  loadingId={actionLoadingId === `pause-${agent.id}` ? agent.id : actionLoadingId === `resume-${agent.id}` ? agent.id : null}
                />
              ))
            )}
          </div>
        </section>

        {/* ── Cron Jobs ── */}
        <section>
          <SectionTitle>
            <span>Cron Jobs</span>
            <span style={{
              fontSize: '10px', padding: '1px 6px',
              background: 'rgba(16,185,129,0.12)',
              border: '1px solid rgba(16,185,129,0.25)',
              borderRadius: '10px', color: '#10b981', fontWeight: 600,
            }}>{cronJobs.length}</span>
          </SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '8px' }}>
            {loadingCronJobs ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '16px' }}>
                <Loader className="w-[14px] h-[14px] animate-spin" style={{ color: 'var(--color-text-3)' }} />
              </div>
            ) : cronJobs.length === 0 ? (
              <EmptyStateSmall message="No cron jobs for this channel" />
            ) : (
              cronJobs.map(job => (
                <CronJobRow
                  key={job.id}
                  job={job}
                  onTrigger={(cronJobId) => onTriggerCron(channel.id, cronJobId)}
                  triggeringId={triggeringCronId}
                />
              ))
            )}
          </div>
        </section>

      </div>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <h3 style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
        {children}
      </h3>
    </div>
  )
}

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0' }}>
      <span style={{ fontSize: '11px', color: 'var(--color-text-3)' }}>{label}</span>
      {value}
    </div>
  )
}

function ActionBtn({
  icon, label, color, loading, onClick,
}: {
  icon: React.ReactNode; label: string; color: string; loading: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
        padding: '6px 8px',
        background: `${color}15`, border: `1px solid ${color}40`,
        borderRadius: '8px', cursor: loading ? 'not-allowed' : 'pointer',
        opacity: loading ? 0.6 : 1,
      }}
    >
      {loading
        ? <Loader className="w-[11px] h-[11px] animate-spin" style={{ color }} />
        : <span style={{ color }}>{icon}</span>
      }
      <span style={{ fontSize: '11px', fontWeight: 600, color }}>{label}</span>
    </button>
  )
}

function EmptyStateSmall({ message }: { message: string }) {
  return (
    <div style={{
      padding: '12px', textAlign: 'center',
      background: 'rgba(255,255,255,0.02)',
      border: '1px dashed var(--color-border)',
      borderRadius: '8px',
    }}>
      <p style={{ fontSize: '11px', color: 'var(--color-text-3)' }}>{message}</p>
    </div>
  )
}

/** Channel card for grid/list view */
function ChannelCard({
  channel,
  selected,
  actionLoadingId,
  onSelect,
  onPauseAgent,
  onResumeAgent,
  onReconnect,
}: {
  channel: ChannelWithAgents
  selected: boolean
  actionLoadingId: string | null
  onSelect: () => void
  onPauseAgent: (channelId: string) => void
  onResumeAgent: (channelId: string) => void
  onReconnect: (channelId: string) => void
}) {
  const status = getConnectionStatus(channel)
  const statusColor = getConnectionColor(status)
  const primaryAgent = channel.assigned_agents.find(a => a.is_primary)

  return (
    <div
      onClick={onSelect}
      style={{
        background: selected
          ? 'rgba(59,130,246,0.06)'
          : 'rgba(255,255,255,0.03)',
        border: `1px solid ${selected ? 'rgba(59,130,246,0.5)' : 'var(--color-border)'}`,
        borderRadius: '12px', padding: '14px',
        cursor: 'pointer',
        transition: 'all 0.15s',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Status accent bar */}
      <div style={{
        position: 'absolute', left: 0, top: '12px', bottom: '12px',
        width: '3px', borderRadius: '2px',
        background: statusColor,
      }} />

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', paddingLeft: '10px' }}>
        <span style={{ fontSize: '22px', lineHeight: 1 }}>{CHANNEL_ICON[channel.channel] ?? '📡'}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text)' }} className="truncate">
            {channel.channel_name ?? channel.channel}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '2px' }}>
            <span style={{
              fontSize: '10px', padding: '1px 6px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid var(--color-border)',
              borderRadius: '4px', color: 'var(--color-text-3)',
              textTransform: 'capitalize',
            }}>{channel.channel}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              <div style={{
                width: '6px', height: '6px', borderRadius: '50%',
                background: statusColor,
              }} />
              <span style={{ fontSize: '10px', color: statusColor, fontWeight: 600, textTransform: 'capitalize' }}>
                {status}
              </span>
            </div>
          </div>
        </div>
        <ChevronRight className="w-[13px] h-[13px]" style={{ color: 'var(--color-text-3)', flexShrink: 0, marginTop: '3px' }} />
      </div>

      {/* Agent + stats row */}
      <div style={{ paddingLeft: '32px', marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
        {primaryAgent ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Bot className="w-[10px] h-[10px]" style={{ color: AGENT_STATUS_COLOR[primaryAgent.agent_status] ?? '#6b7280' }} />
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text)' }}>{primaryAgent.agent_name}</span>
            {channel.assigned_agents.length > 1 && (
              <span style={{ fontSize: '10px', color: 'var(--color-text-3)' }}>
                +{channel.assigned_agents.length - 1} more
              </span>
            )}
          </div>
        ) : (
          <span style={{ fontSize: '11px', color: 'var(--color-text-3)', fontStyle: 'italic' }}>No agent assigned</span>
        )}

        {/* Stats row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {channel.pending_task_count > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              <FileText className="w-[10px] h-[10px]" style={{ color: '#f59e0b' }} />
              <span style={{ fontSize: '10px', color: '#f59e0b', fontWeight: 600 }}>
                {channel.pending_task_count} pending
              </span>
            </div>
          )}
          {channel.last_activity_at && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              <Clock className="w-[10px] h-[10px]" style={{ color: 'var(--color-text-3)' }} />
              <span style={{ fontSize: '10px', color: 'var(--color-text-3)' }}>
                {formatRelative(channel.last_activity_at)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ paddingLeft: '32px', marginTop: '10px', display: 'flex', gap: '5px' }}
        onClick={e => e.stopPropagation()}
      >
        {primaryAgent?.is_active ? (
          <CardActionBtn
            icon={<Pause className="w-[9px] h-[9px]" />}
            label="Pause"
            color="#f59e0b"
            loading={actionLoadingId === 'pause'}
            onClick={() => onPauseAgent(channel.id)}
          />
        ) : (
          <CardActionBtn
            icon={<Play className="w-[9px] h-[9px]" />}
            label="Resume"
            color="#10b981"
            loading={actionLoadingId === 'resume'}
            onClick={() => onResumeAgent(channel.id)}
          />
        )}
        <CardActionBtn
          icon={<RefreshCw className="w-[9px] h-[9px]" />}
          label="Reconnect"
          color="#3b82f6"
          loading={actionLoadingId === 'reconnect'}
          onClick={() => onReconnect(channel.id)}
        />
      </div>
    </div>
  )
}

function CardActionBtn({
  icon, label, color, loading, onClick,
}: {
  icon: React.ReactNode; label: string; color: string; loading: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px',
        padding: '4px 6px',
        background: `${color}12`, border: `1px solid ${color}30`,
        borderRadius: '6px', cursor: loading ? 'not-allowed' : 'pointer',
        opacity: loading ? 0.6 : 1,
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

// ─── Filter bar ──────────────────────────────────────────────

type FilterType = 'all' | ChannelType
type FilterStatus = 'all' | 'active' | 'paused' | 'disconnected'

function FilterBar({
  filterType, setFilterType,
  filterStatus, setFilterStatus,
  viewMode, setViewMode,
}: {
  filterType: FilterType; setFilterType: (v: FilterType) => void
  filterStatus: FilterStatus; setFilterStatus: (v: FilterStatus) => void
  viewMode: 'grid' | 'list'; setViewMode: (v: 'grid' | 'list') => void
}) {
  const typeOptions: { value: FilterType; label: string }[] = [
    { value: 'all', label: 'All Types' },
    { value: 'telegram', label: '✈ Telegram' },
    { value: 'discord', label: '🎮 Discord' },
    { value: 'whatsapp', label: '💬 WhatsApp' },
  ]
  const statusOptions: { value: FilterStatus; label: string; color?: string }[] = [
    { value: 'all', label: 'All Status' },
    { value: 'active', label: 'Active', color: '#10b981' },
    { value: 'paused', label: 'Paused', color: '#f59e0b' },
    { value: 'disconnected', label: 'Offline', color: '#ef4444' },
  ]

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '8px',
      padding: '8px 0',
      borderBottom: '1px solid var(--color-border)',
      flexWrap: 'wrap',
    }}>
      {/* Type filters */}
      <div style={{ display: 'flex', gap: '4px' }}>
        {typeOptions.map(opt => (
          <button
            key={opt.value}
            onClick={() => setFilterType(opt.value)}
            style={{
              padding: '4px 10px',
              fontSize: '11px', fontWeight: 600,
              background: filterType === opt.value ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${filterType === opt.value ? 'rgba(59,130,246,0.45)' : 'var(--color-border)'}`,
              borderRadius: '6px', cursor: 'pointer',
              color: filterType === opt.value ? '#60a5fa' : 'var(--color-text-3)',
              transition: 'all 0.15s',
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div style={{ width: '1px', height: '20px', background: 'var(--color-border)' }} />

      {/* Status filters */}
      <div style={{ display: 'flex', gap: '4px' }}>
        {statusOptions.map(opt => (
          <button
            key={opt.value}
            onClick={() => setFilterStatus(opt.value)}
            style={{
              padding: '4px 10px',
              fontSize: '11px', fontWeight: 600,
              background: filterStatus === opt.value
                ? opt.color ? `${opt.color}18` : 'rgba(59,130,246,0.15)'
                : 'rgba(255,255,255,0.04)',
              border: `1px solid ${filterStatus === opt.value && opt.color ? `${opt.color}45` : 'var(--color-border)'}`,
              borderRadius: '6px', cursor: 'pointer',
              color: filterStatus === opt.value && opt.color ? opt.color : 'var(--color-text-3)',
              transition: 'all 0.15s',
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }}>
        <button
          onClick={() => setViewMode('grid')}
          style={{
            padding: '5px 7px',
            background: viewMode === 'grid' ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${viewMode === 'grid' ? 'rgba(59,130,246,0.45)' : 'var(--color-border)'}`,
            borderRadius: '6px', cursor: 'pointer',
            color: viewMode === 'grid' ? '#60a5fa' : 'var(--color-text-3)',
          }}
        >
          <LayoutGrid className="w-[13px] h-[13px]" />
        </button>
        <button
          onClick={() => setViewMode('list')}
          style={{
            padding: '5px 7px',
            background: viewMode === 'list' ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${viewMode === 'list' ? 'rgba(59,130,246,0.45)' : 'var(--color-border)'}`,
            borderRadius: '6px', cursor: 'pointer',
            color: viewMode === 'list' ? '#60a5fa' : 'var(--color-text-3)',
          }}
        >
          <List className="w-[13px] h-[13px]" />
        </button>
      </div>
    </div>
  )
}

// ─── Skeleton loader ────────────────────────────────────────

function ChannelSkeleton() {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid var(--color-border)',
      borderRadius: '12px', padding: '14px',
      display: 'flex', flexDirection: 'column', gap: '10px',
      animation: 'pulse 2s infinite',
    }}>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(255,255,255,0.06)' }} />
        <div style={{ flex: 1 }}>
          <div style={{ height: '12px', width: '60%', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', marginBottom: '5px' }} />
          <div style={{ height: '9px', width: '35%', borderRadius: '4px', background: 'rgba(255,255,255,0.04)' }} />
        </div>
      </div>
      <div style={{ height: '9px', width: '45%', borderRadius: '4px', background: 'rgba(255,255,255,0.05)' }} />
      <div style={{ display: 'flex', gap: '5px' }}>
        <div style={{ height: '24px', flex: 1, borderRadius: '6px', background: 'rgba(255,255,255,0.05)' }} />
        <div style={{ height: '24px', flex: 1, borderRadius: '6px', background: 'rgba(255,255,255,0.05)' }} />
      </div>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────

export function ChannelsPage() {
  const [channels, setChannels] = useState<ChannelWithAgents[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null)
  const [filterType, setFilterType] = useState<FilterType>('all')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  // keyed by channelId
  const [channelCronJobs, setChannelCronJobs] = useState<Record<string, CronJob[]>>({})
  const [loadingCronJobId, setLoadingCronJobId] = useState<string | null>(null)
  const [triggeringCronId, setTriggeringCronId] = useState<string | null>(null)

  // Load channels on mount
  useEffect(() => {
    api.agentOps.channels.list()
      .then(data => { setChannels(data); setError('') })
      .catch(() => setError('Failed to load channels. Please try again.'))
      .finally(() => setLoading(false))
  }, [])

  // When a channel is selected, load its cron jobs
  useEffect(() => {
    if (!selectedChannelId) return
    if (channelCronJobs[selectedChannelId]) return // already loaded

    setLoadingCronJobId(selectedChannelId)
    api.agentOps.cronJobs.list({ channel_id: selectedChannelId })
      .then(jobs => setChannelCronJobs(prev => ({ ...prev, [selectedChannelId]: jobs })))
      .catch(() => setChannelCronJobs(prev => ({ ...prev, [selectedChannelId]: [] })))
      .finally(() => setLoadingCronJobId(null))
  }, [selectedChannelId])

  // ── Derived ──────────────────────────────────────────────
  const filteredChannels = channels.filter(ch => {
    if (filterType !== 'all' && ch.channel !== filterType) return false
    if (filterStatus !== 'all') {
      const status = getConnectionStatus(ch)
      if (filterStatus === 'active' && status !== 'online' && status !== 'idle') return false
      if (filterStatus === 'paused' && status !== 'idle') return false
      if (filterStatus === 'disconnected' && status !== 'offline') return false
    }
    return true
  })

  const selectedChannel = channels.find(c => c.id === selectedChannelId) ?? null
  const totalActive = channels.filter(c => getConnectionStatus(c) !== 'offline').length
  const totalAgents = channels.reduce((sum, c) => sum + c.assigned_agents.filter(a => a.is_active).length, 0)
  const totalPending = channels.reduce((sum, c) => sum + c.pending_task_count, 0)

  // ── Actions ──────────────────────────────────────────────
  const handlePauseAgent = useCallback(async (channelId: string) => {
    setActionLoadingId('pause')
    try {
      await api.agentOps.channels.pauseAgent(channelId)
      setChannels(prev => prev.map(ch => {
        if (ch.id !== channelId) return ch
        return {
          ...ch,
          assigned_agents: ch.assigned_agents.map(a =>
            a.is_primary ? { ...a, is_active: false, agent_status: 'idle' as const } : a
          ),
        }
      }))
    } catch { /* silent */ }
    finally { setActionLoadingId(null) }
  }, [])

  const handleResumeAgent = useCallback(async (channelId: string) => {
    setActionLoadingId('resume')
    try {
      await api.agentOps.channels.resumeAgent(channelId)
      setChannels(prev => prev.map(ch => {
        if (ch.id !== channelId) return ch
        return {
          ...ch,
          assigned_agents: ch.assigned_agents.map(a =>
            a.is_primary ? { ...a, is_active: true, agent_status: 'idle' as const } : a
          ),
        }
      }))
    } catch { /* silent */ }
    finally { setActionLoadingId(null) }
  }, [])

  const handleReconnect = useCallback(async (channelId: string) => {
    setActionLoadingId('reconnect')
    try {
      await api.agentOps.channels.reconnect(channelId)
      // Update last ping optimistically
      setChannels(prev => prev.map(ch =>
        ch.id === channelId ? { ...ch, is_active: true } : ch
      ))
    } catch { /* silent */ }
    finally { setActionLoadingId(null) }
  }, [])

  const handleTriggerCron = useCallback(async (channelId: string, cronJobId: string) => {
    setTriggeringCronId(cronJobId)
    try {
      await api.agentOps.channels.triggerCron(channelId, cronJobId)
      // Update last_run_at optimistically
      setChannelCronJobs(prev => {
        const jobs = prev[channelId] ?? []
        return {
          ...prev,
          [channelId]: jobs.map(j =>
            j.id === cronJobId
              ? { ...j, last_run_at: new Date().toISOString(), status: 'running' as const }
              : j
          ),
        }
      })
    } catch { /* silent */ }
    finally { setTriggeringCronId(null) }
  }, [])

  const handleStartPolling = useCallback(async (channelId: string) => {
    setActionLoadingId('startPolling')
    try {
      await api.ai.startPolling(channelId)
      setChannels(prev => prev.map(ch =>
        ch.id === channelId
          ? { ...ch, polling: { status: 'running', started_at: new Date().toISOString(), updates_pending: 0 } }
          : ch
      ))
    } catch { /* silent */ }
    finally { setActionLoadingId(null) }
  }, [])

  const handleStopPolling = useCallback(async (channelId: string) => {
    setActionLoadingId('stopPolling')
    try {
      await api.ai.stopPolling(channelId)
      setChannels(prev => prev.map(ch =>
        ch.id === channelId
          ? { ...ch, polling: { status: 'stopped', updates_pending: 0 } }
          : ch
      ))
    } catch { /* silent */ }
    finally { setActionLoadingId(null) }
  }, [])

  const handleClosePanel = () => setSelectedChannelId(null)

  // ── Render ───────────────────────────────────────────────
  return (
    <div style={{ height: '100%', display: 'flex', overflow: 'hidden' }}>
      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {/* Page header */}
        <div style={{
          padding: '14px 20px', flexShrink: 0,
          borderBottom: '1px solid var(--color-border)',
          display: 'flex', flexDirection: 'column', gap: '12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Radio className="w-[16px] h-[16px]" style={{ color: 'var(--color-accent)' }} />
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text)' }}>Channel Operations</h2>
              <p style={{ fontSize: '11px', color: 'var(--color-text-3)', marginTop: '1px' }}>
                Manage connected channels, agents, and automations
              </p>
            </div>
          </div>

          {/* Summary stats */}
          {!loading && !error && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <StatPill icon="📡" label="Total" value={channels.length} />
              <StatPill icon="🟢" label="Active" value={totalActive} color="#10b981" />
              <StatPill icon="🤖" label="Agents Online" value={totalAgents} color="#3b82f6" />
              <StatPill icon="📋" label="Pending Tasks" value={totalPending} color="#f59e0b" />
            </div>
          )}
        </div>

        {/* Filter bar */}
        {!loading && !error && (
          <div style={{ padding: '0 20px', flexShrink: 0 }}>
            <FilterBar
              filterType={filterType} setFilterType={setFilterType}
              filterStatus={filterStatus} setFilterStatus={setFilterStatus}
              viewMode={viewMode} setViewMode={setViewMode}
            />
          </div>
        )}

        {/* Channel list */}
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
          {loading ? (
            <div style={{
              display: 'grid',
              gridTemplateColumns: viewMode === 'grid'
                ? 'repeat(auto-fill, minmax(280px, 1fr))'
                : '1fr',
              gap: '12px',
            }}>
              {[1, 2, 3, 4].map(i => <ChannelSkeleton key={i} />)}
            </div>
          ) : error ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', height: '200px', gap: '10px',
            }}>
              <AlertCircle className="w-[20px] h-[20px]" style={{ color: 'var(--color-error)' }} />
              <p style={{ fontSize: '13px', color: 'var(--color-text-3)' }}>{error}</p>
              <button
                className="btn btn-primary text-xs"
                onClick={() => { setLoading(true); setError(''); api.agentOps.channels.list().then(d => { setChannels(d); setLoading(false) }).catch(() => { setError('Failed'); setLoading(false) }) }}
              >
                Retry
              </button>
            </div>
          ) : filteredChannels.length === 0 ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', height: '200px', gap: '8px',
            }}>
              <WifiOff className="w-[24px] h-[24px]" style={{ color: 'var(--color-text-3)' }} />
              <p style={{ fontSize: '13px', color: 'var(--color-text-3)' }}>
                {channels.length === 0 ? 'No channels connected yet' : 'No channels match the selected filters'}
              </p>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: viewMode === 'grid'
                ? 'repeat(auto-fill, minmax(280px, 1fr))'
                : '1fr',
              gap: '12px',
            }}>
              {filteredChannels.map(ch => (
                <ChannelCard
                  key={ch.id}
                  channel={ch}
                  selected={selectedChannelId === ch.id}
                  actionLoadingId={selectedChannelId === ch.id ? actionLoadingId : null}
                  onSelect={() => setSelectedChannelId(prev => prev === ch.id ? null : ch.id)}
                  onPauseAgent={handlePauseAgent}
                  onResumeAgent={handleResumeAgent}
                  onReconnect={handleReconnect}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detail panel */}
      {selectedChannel && (
        <ChannelDetailPanel
          channel={selectedChannel}
          cronJobs={channelCronJobs[selectedChannel.id] ?? []}
          loadingCronJobs={loadingCronJobId === selectedChannel.id}
          triggeringCronId={triggeringCronId}
          actionLoadingId={actionLoadingId}
          onClose={handleClosePanel}
          onPauseAgent={(chId, _agentId) => handlePauseAgent(chId)}
          onResumeAgent={(chId, _agentId) => handleResumeAgent(chId)}
          onReconnect={handleReconnect}
          onTriggerCron={handleTriggerCron}
          onStartPolling={handleStartPolling}
          onStopPolling={handleStopPolling}
        />
      )}
    </div>
  )
}

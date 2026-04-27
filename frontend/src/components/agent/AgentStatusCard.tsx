// Agent Status Card — shows Hermes gateway status, uptime, heartbeat, Supabase connection
import { RefreshCw, CheckCircle2, XCircle, Loader } from 'lucide-react'
import type { AgentStatus, GatewayStatus } from '@/types'
import { formatRelative } from '@/lib/utils'

const GATEWAY_STATUS_COLOR: Record<GatewayStatus, string> = {
  running:        '#10b981',
  paused:         '#f59e0b',
  error:          '#ef4444',
  needs_attention:'#f97316',
}

const GATEWAY_STATUS_LABEL: Record<GatewayStatus, string> = {
  running:        'Running',
  paused:         'Paused',
  error:          'Error',
  needs_attention:'Needs Attention',
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${h}h ${m}m`
}

interface Props {
  agentStatus: AgentStatus | null
  loading: boolean
  onSyncNow: () => Promise<void>
  syncing: boolean
}

export function AgentStatusCard({ agentStatus, loading, onSyncNow, syncing }: Props) {
  if (loading) {
    return (
      <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
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

  const s = agentStatus?.hermes_gateway
  const supabase = agentStatus?.supabase
  const syncState = agentStatus?.sync_state

  const gatewayStatus: GatewayStatus = s?.status ?? 'error'

  return (
    <div style={{ padding: '12px' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{
            width: '8px', height: '8px', borderRadius: '50%',
            background: GATEWAY_STATUS_COLOR[gatewayStatus],
            boxShadow: `0 0 6px ${GATEWAY_STATUS_COLOR[gatewayStatus]}60`,
          }} />
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text)' }}>
            Hermes Gateway
          </span>
        </div>
        <span style={{
          fontSize: '10px', fontWeight: 600,
          color: GATEWAY_STATUS_COLOR[gatewayStatus],
          background: `${GATEWAY_STATUS_COLOR[gatewayStatus]}18`,
          border: `1px solid ${GATEWAY_STATUS_COLOR[gatewayStatus]}35`,
          borderRadius: '12px', padding: '2px 8px',
        }}>
          {GATEWAY_STATUS_LABEL[gatewayStatus]}
        </span>
      </div>

      {/* Metrics row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
        {/* Uptime */}
        <div style={{
          padding: '8px 10px',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid var(--color-border)',
          borderRadius: '8px',
        }}>
          <p style={{ fontSize: '9px', color: 'var(--color-text-3)', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Uptime</p>
          <p style={{ fontSize: '14px', fontWeight: 700, color: '#10b981' }}>
            {s ? formatUptime(s.uptime_seconds) : '—'}
          </p>
        </div>

        {/* Last Heartbeat */}
        <div style={{
          padding: '8px 10px',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid var(--color-border)',
          borderRadius: '8px',
        }}>
          <p style={{ fontSize: '9px', color: 'var(--color-text-3)', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Heartbeat</p>
          <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text)' }}>
            {s?.last_heartbeat ? formatRelative(s.last_heartbeat) : '—'}
          </p>
        </div>
      </div>

      {/* Supabase status */}
      <div style={{
        padding: '8px 10px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid var(--color-border)',
        borderRadius: '8px',
        marginBottom: '10px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
          {supabase?.connected
            ? <CheckCircle2 className="w-[11px] h-[11px]" style={{ color: '#10b981' }} />
            : <XCircle className="w-[11px] h-[11px]" style={{ color: '#ef4444' }} />
          }
          <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--color-text)' }}>Supabase</span>
          <span style={{ fontSize: '9px', color: 'var(--color-text-3)', marginLeft: 'auto' }}>
            {supabase?.connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        {supabase?.latency_ms !== undefined && (
          <p style={{ fontSize: '10px', color: 'var(--color-text-3)' }}>
            Latency: {supabase.latency_ms}ms
          </p>
        )}
      </div>

      {/* Sync status */}
      <div style={{
        padding: '8px 10px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid var(--color-border)',
        borderRadius: '8px',
        marginBottom: '10px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
          <RefreshCw className="w-[11px] h-[11px]" style={{ color: 'var(--color-accent)' }} />
          <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--color-text)' }}>Sync State</span>
        </div>
        <p style={{ fontSize: '10px', color: 'var(--color-text-3)', marginBottom: '2px' }}>
          {syncState?.last_sync_at
            ? `Last synced: ${formatRelative(syncState.last_sync_at)}`
            : 'Never synced'}
        </p>
        {syncState?.pending_changes !== undefined && syncState.pending_changes > 0 && (
          <p style={{ fontSize: '10px', color: '#f59e0b' }}>
            {syncState.pending_changes} pending change{syncState.pending_changes !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Sync Now button */}
      <button
        onClick={onSyncNow}
        disabled={syncing}
        className="btn btn-primary"
        style={{ width: '100%', justifyContent: 'center', gap: '6px' }}
      >
        {syncing
          ? <Loader className="w-[12px] h-[12px] animate-spin" />
          : <RefreshCw className="w-[12px] h-[12px]" />
        }
        {syncing ? 'Syncing…' : 'Sync Now'}
      </button>

      {/* Version */}
      {s?.version && (
        <p style={{ fontSize: '9px', color: 'var(--color-text-3)', textAlign: 'center', marginTop: '8px' }}>
          v{s.version}
        </p>
      )}
    </div>
  )
}

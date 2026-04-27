// Services Status — shows current_services with name and connection status
import { useState } from 'react'
import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'
import type { CurrentService } from '@/types'

const STATUS_ICON: Record<string, React.ReactNode> = {
  connected:    <CheckCircle2 className="w-[11px] h-[11px]" style={{ color: '#10b981' }} />,
  disconnected: <XCircle className="w-[11px] h-[11px]" style={{ color: '#ef4444' }} />,
  degraded:     <AlertTriangle className="w-[11px] h-[11px]" style={{ color: '#f59e0b' }} />,
}

const STATUS_COLOR: Record<string, string> = {
  connected:    '#10b981',
  disconnected: '#ef4444',
  degraded:     '#f59e0b',
}

interface Props {
  services: CurrentService[]
  loading: boolean
}

export function ServicesStatus({ services, loading }: Props) {
  const [filter, setFilter] = useState<'all' | 'connected' | 'disconnected' | 'degraded'>('all')

  const filtered = services.filter(s => {
    if (filter === 'all') return true
    return s.status === filter
  })

  if (loading) {
    return (
      <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{
            height: '48px', borderRadius: '8px',
            background: 'rgba(255,255,255,0.03)', border: '1px solid var(--color-border)',
            animation: 'pulse 2s infinite',
          }} />
        ))}
      </div>
    )
  }

  const connectedCount = services.filter(s => s.status === 'connected').length
  const degradedCount = services.filter(s => s.status === 'degraded').length
  const disconnectedCount = services.filter(s => s.status === 'disconnected').length

  return (
    <div style={{ padding: '10px' }}>
      {/* Summary */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', flexWrap: 'wrap' }}>
        {connectedCount > 0 && (
          <ServiceStatPill label="Connected" value={connectedCount} color="#10b981" />
        )}
        {degradedCount > 0 && (
          <ServiceStatPill label="Degraded" value={degradedCount} color="#f59e0b" />
        )}
        {disconnectedCount > 0 && (
          <ServiceStatPill label="Disconnected" value={disconnectedCount} color="#ef4444" />
        )}
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '8px', flexWrap: 'wrap' }}>
        {(['all', 'connected', 'degraded', 'disconnected'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              flex: 1, minWidth: '40px', padding: '4px 2px',
              fontSize: '10px', fontWeight: 600,
              background: filter === f ? `${STATUS_COLOR[f] ?? '#60a5fa'}20` : 'rgba(255,255,255,0.03)',
              border: `1px solid ${filter === f ? `${STATUS_COLOR[f] ?? '#60a5fa'}40` : 'var(--color-border)'}`,
              borderRadius: '6px', cursor: 'pointer',
              color: filter === f ? (STATUS_COLOR[f] ?? '#60a5fa') : 'var(--color-text-3)',
              textTransform: 'capitalize',
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Service list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {filtered.map(service => (
          <div
            key={service.name}
            style={{
              padding: '8px 10px',
              background: 'rgba(255,255,255,0.03)',
              border: `1px solid ${service.status === 'connected' ? 'var(--color-border)' : `${STATUS_COLOR[service.status]}30`}`,
              borderRadius: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {/* Status icon */}
              <div style={{ flexShrink: 0 }}>
                {STATUS_ICON[service.status]}
              </div>

              {/* Name */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text)' }}>
                  {service.name}
                </p>
                {service.message && (
                  <p style={{ fontSize: '10px', color: 'var(--color-text-3)' }} className="truncate">
                    {service.message}
                  </p>
                )}
              </div>

              {/* Status badge */}
              <span style={{
                fontSize: '9px', fontWeight: 600,
                color: STATUS_COLOR[service.status],
                background: `${STATUS_COLOR[service.status]}15`,
                border: `1px solid ${STATUS_COLOR[service.status]}30`,
                borderRadius: '10px', padding: '2px 7px',
                textTransform: 'capitalize', flexShrink: 0,
              }}>
                {service.status}
              </span>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <p style={{ textAlign: 'center', padding: '20px', fontSize: '12px', color: 'var(--color-text-3)' }}>
            No services to display
          </p>
        )}
      </div>
    </div>
  )
}

function ServiceStatPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '5px',
      padding: '4px 8px',
      background: `${color}15`, border: `1px solid ${color}30`,
      borderRadius: '6px',
    }}>
      <span style={{ fontSize: '12px', fontWeight: 700, color }}>{value}</span>
      <span style={{ fontSize: '10px', color: 'var(--color-text-3)' }}>{label}</span>
    </div>
  )
}

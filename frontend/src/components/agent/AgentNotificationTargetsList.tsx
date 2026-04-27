// Agent Notification Targets List — shows agent_notification_targets with platform, target_name, is_active
import { useState } from 'react'
import { Bell, BellOff, CheckCircle2 } from 'lucide-react'
import type { AgentNotificationTarget } from '@/types'

const CHANNEL_ICON: Record<string, string> = {
  telegram: '✈',
  discord:  '🎮',
  whatsapp: '💬',
  email:    '📧',
  web:      '🌐',
}

interface Props {
  targets: AgentNotificationTarget[]
  loading: boolean
}

export function AgentNotificationTargetsList({ targets, loading }: Props) {
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all')

  const filtered = targets.filter(t => {
    if (filter === 'active') return t.is_active
    if (filter === 'inactive') return !t.is_active
    return true
  })

  if (loading) {
    return (
      <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{
            height: '52px', borderRadius: '8px',
            background: 'rgba(255,255,255,0.03)', border: '1px solid var(--color-border)',
            animation: 'pulse 2s infinite',
          }} />
        ))}
      </div>
    )
  }

  const activeCount = targets.filter(t => t.is_active).length

  return (
    <div style={{ padding: '10px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
        <Bell className="w-[12px] h-[12px]" style={{ color: 'var(--color-accent)' }} />
        <span style={{ fontSize: '11px', color: 'var(--color-text-3)' }}>
          {activeCount}/{targets.length} active
        </span>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
        {(['all', 'active', 'inactive'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              flex: 1, padding: '4px',
              fontSize: '10px', fontWeight: 600,
              background: filter === f ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${filter === f ? 'rgba(16,185,129,0.4)' : 'var(--color-border)'}`,
              borderRadius: '6px', cursor: 'pointer',
              color: filter === f ? '#10b981' : 'var(--color-text-3)',
              textTransform: 'capitalize',
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Targets list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {filtered.map(target => (
          <div
            key={target.id}
            style={{
              padding: '8px 10px',
              background: 'rgba(255,255,255,0.03)',
              border: `1px solid ${target.is_active ? 'var(--color-border)' : 'rgba(245,158,11,0.25)'}`,
              borderRadius: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {/* Platform icon */}
              <span style={{ fontSize: '16px', flexShrink: 0 }}>
                {CHANNEL_ICON[target.platform] ?? '📡'}
              </span>

              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text)' }} className="truncate">
                  {target.target_name}
                </p>
                <p style={{ fontSize: '10px', color: 'var(--color-text-3)', textTransform: 'capitalize' }}>
                  {target.platform}
                </p>
              </div>

              {/* Active indicator */}
              {target.is_active
                ? <CheckCircle2 className="w-[12px] h-[12px]" style={{ color: '#10b981', flexShrink: 0 }} />
                : <BellOff className="w-[12px] h-[12px]" style={{ color: '#f59e0b', flexShrink: 0 }} />
              }
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <p style={{ textAlign: 'center', padding: '20px', fontSize: '12px', color: 'var(--color-text-3)' }}>
            No notification targets
          </p>
        )}
      </div>
    </div>
  )
}

import { X, AlertTriangle, Lightbulb, TrendingUp, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Insight } from '@/types'

const typeConfig: Record<string, { icon: typeof AlertTriangle; color: string; bg: string }> = {
  task_overdue:     { icon: AlertTriangle, color: 'var(--color-error)',  bg: 'rgba(239,68,68,0.1)' },
  upcoming_anniversary: { icon: Sparkles,   color: 'var(--color-accent)', bg: 'var(--color-accent-dim)' },
  schedule_conflict:{ icon: AlertTriangle, color: 'var(--color-warning)',bg: 'rgba(234,179,8,0.1)' },
  ai_suggestion:    { icon: Lightbulb,    color: 'var(--color-accent)', bg: 'var(--color-accent-dim)' },
  productivity_tip: { icon: TrendingUp,   color: 'var(--color-info)',   bg: 'rgba(59,130,246,0.1)' },
  channel_alert:    { icon: AlertTriangle, color: 'var(--color-error)', bg: 'rgba(239,68,68,0.1)' },
}

interface RightPanelProps {
  insights: Insight[]
  onDismiss?: (id: string) => void
  onMarkRead?: (id: string) => void
}

export function RightPanel({ insights, onDismiss, onMarkRead }: RightPanelProps) {
  const unread = insights.filter(i => !i.is_read)

  return (
    <aside className="right-panel">
      {/* Header */}
      <div style={{
        padding: '14px 16px',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles className="w-[14px] h-[14px]" style={{ color: 'var(--color-accent)' }} />
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>AI Insights</span>
        </div>
        {unread.length > 0 && (
          <span className="badge badge-orange" style={{ fontSize: '10px' }}>{unread.length} new</span>
        )}
      </div>

      {/* Insight list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {insights.length === 0 && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', height: '200px', gap: '10px', color: 'var(--color-text-3)',
          }}>
            <Lightbulb className="w-7 h-7" style={{ opacity: 0.3 }} />
            <p style={{ fontSize: '13px' }}>No insights yet</p>
            <p style={{ fontSize: '11px', textAlign: 'center', padding: '0 24px', lineHeight: 1.5 }}>
              AI-generated tips appear here
            </p>
          </div>
        )}

        {insights.map(insight => {
          const cfg = typeConfig[insight.insight_type] ?? typeConfig.ai_suggestion
          const Icon = cfg.icon
          return (
            <div
              key={insight.id}
              className={cn('insight-item', !insight.is_read && 'unread')}
              onClick={() => onMarkRead?.(insight.id)}
            >
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <div style={{
                  width: '28px', height: '28px', borderRadius: '8px',
                  background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, marginTop: '1px',
                }}>
                  <Icon className="w-[13px] h-[13px]" style={{ color: cfg.color }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    fontSize: '12px', fontWeight: 600, color: 'var(--color-text)',
                    marginBottom: '3px', ...(insight.is_read ? {} : {}),
                  }}>
                    {insight.title}
                  </p>
                  <p style={{
                    fontSize: '11px', color: 'var(--color-text-2)',
                    lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box',
                    WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                  }}>
                    {insight.message}
                  </p>
                  {insight.action_url && (
                    <a href={insight.action_url} style={{ fontSize: '11px', color: 'var(--color-accent)', marginTop: '4px', display: 'inline-block' }}>
                      Take action →
                    </a>
                  )}
                </div>
                <button
                  onClick={e => { e.stopPropagation(); onDismiss?.(insight.id) }}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--color-text-3)', padding: '2px', borderRadius: '4px',
                    display: 'flex', alignItems: 'center',
                  }}
                  className="btn-icon"
                >
                  <X className="w-[12px] h-[12px]" />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div style={{
        padding: '10px 14px', borderTop: '1px solid var(--color-border)', flexShrink: 0,
      }}>
        <button
          className="btn btn-ghost"
          style={{ width: '100%', justifyContent: 'flex-start', fontSize: '12px', padding: '6px 10px' }}
        >
          <Lightbulb className="w-[13px] h-[13px]" />
          View all insights
        </button>
      </div>
    </aside>
  )
}

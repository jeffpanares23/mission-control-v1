// Agent Scripts List — shows agent_scripts with name, category, last_used
import { useState } from 'react'
import { FileCode, Clock } from 'lucide-react'
import type { AgentScript } from '@/types'
import { formatRelative } from '@/lib/utils'

interface Props {
  scripts: AgentScript[]
  loading: boolean
}

export function AgentScriptsList({ scripts, loading }: Props) {
  const [filter, setFilter] = useState<string>('all')

  // Get unique categories
  const categories = Array.from(new Set(scripts.map(s => s.category).filter(Boolean)))

  const filtered = filter === 'all'
    ? scripts
    : scripts.filter(s => s.category === filter)

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

  return (
    <div style={{ padding: '10px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
        <FileCode className="w-[12px] h-[12px]" style={{ color: 'var(--color-accent)' }} />
        <span style={{ fontSize: '11px', color: 'var(--color-text-3)' }}>
          {scripts.length} script{scripts.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Category filter */}
      {categories.length > 0 && (
        <div style={{ display: 'flex', gap: '4px', marginBottom: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setFilter('all')}
            style={{
              padding: '3px 8px',
              fontSize: '10px', fontWeight: 600,
              background: filter === 'all' ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${filter === 'all' ? 'rgba(59,130,246,0.4)' : 'var(--color-border)'}`,
              borderRadius: '6px', cursor: 'pointer',
              color: filter === 'all' ? '#60a5fa' : 'var(--color-text-3)',
            }}
          >
            All
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              style={{
                padding: '3px 8px',
                fontSize: '10px', fontWeight: 600,
                background: filter === cat ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${filter === cat ? 'rgba(59,130,246,0.4)' : 'var(--color-border)'}`,
                borderRadius: '6px', cursor: 'pointer',
                color: filter === cat ? '#60a5fa' : 'var(--color-text-3)',
                textTransform: 'capitalize',
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Script list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {filtered.map(script => (
          <div
            key={script.id}
            style={{
              padding: '8px 10px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
              {/* Script icon */}
              <FileCode className="w-[13px] h-[13px]" style={{ color: 'var(--color-accent)', flexShrink: 0, marginTop: '1px' }} />

              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Name + category */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text)' }}>
                    {script.name}
                  </p>
                  {script.category && (
                    <span style={{
                      fontSize: '9px',
                      background: 'rgba(167,139,250,0.15)',
                      border: '1px solid rgba(167,139,250,0.3)',
                      borderRadius: '4px', padding: '0 4px',
                      color: '#a78bfa',
                      textTransform: 'capitalize',
                    }}>
                      {script.category}
                    </span>
                  )}
                </div>

                {/* Last used */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <Clock className="w-[9px] h-[9px]" style={{ color: 'var(--color-text-3)' }} />
                  <span style={{ fontSize: '10px', color: 'var(--color-text-3)' }}>
                    {script.last_used ? `Used ${formatRelative(script.last_used)}` : 'Never used'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <p style={{ textAlign: 'center', padding: '20px', fontSize: '12px', color: 'var(--color-text-3)' }}>
            No scripts to display
          </p>
        )}
      </div>
    </div>
  )
}

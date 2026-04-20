import { useState, useEffect } from 'react'
import { Plus, Loader, CheckCircle, XCircle } from 'lucide-react'
import { api } from '@/lib/api'
import type { ChannelConnection } from '@/types'

const CHANNEL_DEFS = [
  {
    id: 'telegram',
    name: 'Telegram',
    desc: 'Connect your Telegram bot for instant updates and commands',
    icon: '📱',
    color: '#0088cc',
    fields: [{ key: 'bot_token', label: 'Bot Token', placeholder: '123456:ABC-DEF...', type: 'password' }],
  },
  {
    id: 'discord',
    name: 'Discord',
    desc: 'Receive notifications and control Mission Control via Discord',
    icon: '🎮',
    color: '#5865f2',
    fields: [{ key: 'bot_token', label: 'Bot Token', placeholder: 'Bot token from Discord Developer Portal', type: 'password' }],
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    desc: 'Send reminders and alerts via WhatsApp Business',
    icon: '💬',
    color: '#25d366',
    fields: [
      { key: 'account_sid', label: 'Account SID', placeholder: 'AC...', type: 'text' },
      { key: 'auth_token', label: 'Auth Token', placeholder: 'Auth token', type: 'password' },
    ],
  },
]

export function ChannelsPage() {
  const [connections, setConnections] = useState<ChannelConnection[]>([])
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState<string | null>(null)
  const [showForm, setShowForm] = useState<string | null>(null)
  const [formData, setFormData] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')

  useEffect(() => {
    api.channels.list()
      .then(res => setConnections(res))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const getConnection = (channelId: string) =>
    connections.find(c => c.channel === channelId && c.is_active)

  const handleConnect = async (channelId: string) => {
    setFormError('')
    const def = CHANNEL_DEFS.find(d => d.id === channelId)
    if (!def) return

    // Validate required fields
    const missing = def.fields.find(f => !formData[f.key]?.trim())
    if (missing) {
      setFormError(`Please fill in ${missing.label}`)
      return
    }

    setConnecting(channelId)
    try {
      if (channelId === 'telegram') {
        const { bot_username } = await api.channels.connectTelegram(formData.bot_token)
        setConnections(prev => {
          const idx = prev.findIndex(c => c.channel === channelId)
          if (idx >= 0) {
            const updated = [...prev]
            updated[idx] = { ...updated[idx], is_active: true, channel_name: bot_username }
            return updated
          }
          return [...prev, {
            id: `temp-${channelId}`,
            channel: channelId as 'telegram',
            is_active: true,
            channel_name: bot_username,
            channel_meta: {},
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }]
        })
      } else if (channelId === 'discord') {
        await api.channels.connectDiscord(formData.bot_token)
        setConnections(prev => [...prev, {
          id: `temp-${channelId}`,
          channel: channelId as 'discord',
          is_active: true,
          channel_meta: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }])
      } else if (channelId === 'whatsapp') {
        await api.channels.connectWhatsApp(formData.account_sid, formData.auth_token)
        setConnections(prev => [...prev, {
          id: `temp-${channelId}`,
          channel: channelId as 'whatsapp',
          is_active: true,
          channel_meta: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }])
      }
      setShowForm(null)
      setFormData({})
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Connection failed')
    } finally {
      setConnecting(null)
    }
  }

  const handleDisconnect = async (conn: ChannelConnection) => {
    try {
      await api.channels.disconnect(conn.channel)
      setConnections(prev => prev.filter(c => c.id !== conn.id))
    } catch {
      // silent
    }
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader className="w-6 h-6 animate-spin text-text-muted" />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 border-b border-surface-border">
        <h2 className="text-lg font-bold text-text-primary">Channel Connections</h2>
        <p className="text-xs text-text-muted">Connect messaging platforms to Mission Control</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {CHANNEL_DEFS.map(ch => {
            const conn = getConnection(ch.id)
            const isFormOpen = showForm === ch.id

            return (
              <div key={ch.id} className="glass-card p-5 hover:border-accent/30 transition-colors">
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                    style={{ backgroundColor: ch.color + '20' }}
                  >
                    {ch.icon}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-text-primary">{ch.name}</h3>
                    {conn ? (
                      <span className="badge badge-green text-xs mt-1">
                        <CheckCircle className="w-[10px] h-[10px] mr-1" />
                        Connected
                      </span>
                    ) : (
                      <span className="badge badge-neutral text-xs mt-1">
                        <XCircle className="w-[10px] h-[10px] mr-1" />
                        Disconnected
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-xs text-text-muted mb-4">{ch.desc}</p>

                {conn ? (
                  <div className="space-y-2">
                    {conn.channel_name && (
                      <p className="text-xs text-text-muted">Bot: {conn.channel_name}</p>
                    )}
                    <div className="flex gap-2">
                      <button className="btn btn-ghost flex-1 text-xs">Settings</button>
                      <button
                        className="btn btn-ghost text-xs text-error"
                        onClick={() => handleDisconnect(conn)}
                      >
                        Disconnect
                      </button>
                    </div>
                  </div>
                ) : isFormOpen ? (
                  <div className="space-y-3">
                    {ch.fields.map(f => (
                      <div key={f.key}>
                        <label className="text-xs text-text-muted mb-1 block">{f.label}</label>
                        <input
                          type={f.type}
                          placeholder={f.placeholder}
                          value={formData[f.key] ?? ''}
                          onChange={e => setFormData(prev => ({ ...prev, [f.key]: e.target.value }))}
                          className="input w-full text-xs"
                        />
                      </div>
                    ))}
                    {formError && (
                      <p className="text-xs text-error">{formError}</p>
                    )}
                    <div className="flex gap-2">
                      <button
                        className="btn btn-primary flex-1 text-xs"
                        disabled={connecting === ch.id}
                        onClick={() => handleConnect(ch.id)}
                      >
                        {connecting === ch.id ? 'Connecting...' : 'Connect'}
                      </button>
                      <button
                        className="btn btn-ghost text-xs"
                        onClick={() => { setShowForm(null); setFormData({}); setFormError('') }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    className="btn btn-primary w-full text-xs"
                    onClick={() => setShowForm(ch.id)}
                  >
                    <Plus className="w-[12px] h-[12px]" />
                    Connect {ch.name}
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {/* Existing connections list */}
        {connections.filter(c => !c.is_active).length > 0 && (
          <div className="mt-8">
            <h3 className="text-sm font-semibold text-text-primary mb-3">Inactive Connections</h3>
            <div className="space-y-2">
              {connections.filter(c => !c.is_active).map(conn => (
                <div key={conn.id} className="glass-card p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">
                      {CHANNEL_DEFS.find(d => d.id === conn.channel)?.icon ?? '📡'}
                    </span>
                    <div>
                      <p className="text-xs font-medium text-text-primary capitalize">{conn.channel}</p>
                      <p className="text-xs text-text-muted">Disconnected</p>
                    </div>
                  </div>
                  <button
                    className="btn btn-ghost text-xs text-error"
                    onClick={() => handleDisconnect(conn)}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

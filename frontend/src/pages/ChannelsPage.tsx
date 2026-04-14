const channels = [
  {
    id: 'telegram',
    name: 'Telegram',
    desc: 'Connect your Telegram bot for instant updates and commands',
    icon: '📱',
    color: '#0088cc',
  },
  {
    id: 'discord',
    name: 'Discord',
    desc: 'Receive notifications and control Mission Control via Discord',
    icon: '🎮',
    color: '#5865f2',
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    desc: 'Send reminders and alerts via WhatsApp Business',
    icon: '💬',
    color: '#25d366',
  },
]

export function ChannelsPage() {
  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 border-b border-surface-border">
        <h2 className="text-lg font-bold text-text-primary">Channel Connections</h2>
        <p className="text-xs text-text-muted">Connect messaging platforms to Mission Control</p>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {channels.map(ch => (
            <div key={ch.id} className="glass-card p-5 hover:border-accent/30 transition-colors">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{ backgroundColor: ch.color + '20' }}>
                  {ch.icon}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-text-primary">{ch.name}</h3>
                  <span className="badge badge-neutral text-xs mt-1">Disconnected</span>
                </div>
              </div>
              <p className="text-xs text-text-muted mb-4">{ch.desc}</p>
              <button className="btn btn-primary w-full text-xs">Connect {ch.name}</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

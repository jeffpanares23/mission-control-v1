import { Settings, Bell, Palette, Cpu } from 'lucide-react'

const sections = [
  {
    id: 'appearance',
    label: 'Appearance',
    icon: Palette,
    desc: 'Theme, accent color, glassmorphism',
    fields: [
      { key: 'theme.mode', label: 'Theme', type: 'select', options: ['dark', 'light'] },
      { key: 'theme.accent_color', label: 'Accent Color', type: 'color' },
      { key: 'theme.glass_opacity', label: 'Glass Opacity', type: 'range' },
    ],
  },
  {
    id: 'notifications',
    label: 'Notifications',
    icon: Bell,
    desc: 'Channel notification preferences',
    fields: [
      { key: 'notifications.telegram', label: 'Telegram', type: 'toggle' },
      { key: 'notifications.discord', label: 'Discord', type: 'toggle' },
      { key: 'notifications.whatsapp', label: 'WhatsApp', type: 'toggle' },
    ],
  },
  {
    id: 'workspace',
    label: 'Workspace',
    icon: Settings,
    desc: 'Default view, layout, right panel',
    fields: [
      { key: 'workspace.default_view', label: 'Default View', type: 'select', options: ['kanban', 'list'] },
      { key: 'workspace.right_panel', label: 'Right Panel', type: 'select', options: ['insights', 'activity', 'ai', 'none'] },
    ],
  },
  {
    id: 'ai_agent',
    label: 'AI Agent',
    icon: Cpu,
    desc: 'Model, personality, suggestions',
    fields: [
      { key: 'ai_agent.model', label: 'Model', type: 'text' },
      { key: 'ai_agent.personality', label: 'Personality', type: 'select', options: ['helpful', 'concise', 'detailed'] },
      { key: 'ai_agent.suggestions_enabled', label: 'AI Suggestions', type: 'toggle' },
    ],
  },
]

export function SettingsPage() {
  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 border-b border-surface-border">
        <h2 className="text-lg font-bold text-text-primary">Settings</h2>
        <p className="text-xs text-text-muted">Configure Mission Control to your liking</p>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl space-y-4">
          {sections.map(section => {
            const Icon = section.icon
            return (
              <div key={section.id} className="glass-card p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-lg bg-accent/15 flex items-center justify-center">
                    <Icon className="w-4 h-4 text-accent" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary">{section.label}</h3>
                    <p className="text-xs text-text-muted">{section.desc}</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {section.fields.map(field => (
                    <div key={field.key} className="flex items-center justify-between">
                      <label className="text-sm text-text-secondary">{field.label}</label>
                      {field.type === 'toggle' ? (
                        <div className="w-10 h-5 rounded-full bg-surface-overlay relative cursor-pointer transition-colors">
                          <div className="w-4 h-4 rounded-full bg-text-muted absolute top-0.5 left-0.5 transition-all" />
                        </div>
                      ) : field.type === 'color' ? (
                        <input type="color" defaultValue="#f97316" className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent" />
                      ) : field.type === 'select' ? (
                        <select className="input w-40 text-xs py-1">
                          {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                      ) : (
                        <input type="text" className="input w-40 text-xs py-1" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

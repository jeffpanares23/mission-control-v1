import { useState } from 'react'
import { Bot, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import type { AIAgent } from '@/types'

export function AIPage() {
  const [agent, setAgent] = useState<AIAgent | null>(null)
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api.ai.status()
      .then(res => setAgent(res as unknown as AIAgent))
      .catch(() => {})
  }, [])

  const handleSend = async () => {
    if (!input.trim() || loading) return
    const userMsg = { role: 'user', content: input }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await api.ai.chat(input)
      setMessages(prev => [...prev, { role: 'assistant', content: res.reply }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 flex items-center gap-3 border-b border-surface-border">
        <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
          <Bot className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-text-primary">{agent?.name ?? 'Hermes'} AI Agent</h2>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={cn('agent-dot', agent?.status ?? 'offline')} />
            <span className="text-xs text-text-muted capitalize">{agent?.status ?? 'offline'}</span>
          </div>
        </div>
        {agent && (
          <div className="ml-auto grid grid-cols-3 gap-4 text-center">
            {[
              { label: 'Tasks', value: agent.stats.tasks_dispatched },
              { label: 'Insights', value: agent.stats.insights_generated },
              { label: 'Chats', value: agent.stats.conversations_handled },
            ].map(s => (
              <div key={s.label}>
                <p className="text-sm font-bold text-text-primary">{s.value}</p>
                <p className="text-xs text-text-muted">{s.label}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-text-muted gap-3">
            <Bot className="w-12 h-12 opacity-20" />
            <p className="text-sm">Chat with {agent?.name ?? 'Hermes'}</p>
            <p className="text-xs text-center px-8">Ask questions, dispatch tasks, or get insights</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={cn('flex gap-3', msg.role === 'user' ? 'justify-end' : '')}>
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-accent" />
              </div>
            )}
            <div className={cn('glass-card px-4 py-3 max-w-lg', msg.role === 'user' ? 'bg-accent/10 border-accent/20' : '')}>
              <p className="text-sm text-text-primary">{msg.content}</p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
              <Bot className="w-4 h-4 text-accent" />
            </div>
            <div className="glass-card px-4 py-3">
              <p className="text-sm text-text-muted animate-pulse">Thinking...</p>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="px-6 py-4 border-t border-surface-border">
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Message Hermes..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            className="input flex-1"
          />
          <button onClick={handleSend} disabled={loading || !input.trim()} className="btn btn-primary">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

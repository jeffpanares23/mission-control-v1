import { useState, useEffect } from 'react'
import { Bot, Send, Play, Square, Loader } from 'lucide-react'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import type { AIAgent } from '@/types'

export function AIPage() {
  const [agent, setAgent] = useState<AIAgent | null>(null)
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [runtimeLoading, setRuntimeLoading] = useState(false)

  useEffect(() => {
    api.ai.status()
      .then(res => setAgent(res as unknown as AIAgent))
      .catch(() => {})
  }, [])

  const runtime = agent?.runtime
  const runtimeStatusColors: Record<string, string> = {
    stopped: '#6b7280',
    running: '#10b981',
    paused: '#f59e0b',
    error: '#ef4444',
  }

  const handleStartRuntime = async () => {
    setRuntimeLoading(true)
    try {
      await api.ai.startRuntime()
      setAgent(prev => prev ? { ...prev, runtime: { status: 'running', started_at: new Date().toISOString(), tasks_in_progress: 0, tasks_completed: 0, errors_count: 0 } } : prev)
    } catch { /* silent */ }
    finally { setRuntimeLoading(false) }
  }

  const handleStopRuntime = async () => {
    setRuntimeLoading(true)
    try {
      await api.ai.stopRuntime()
      setAgent(prev => prev ? { ...prev, runtime: { status: 'stopped', tasks_in_progress: 0, tasks_completed: 0, errors_count: 0 } } : prev)
    } catch { /* silent */ }
    finally { setRuntimeLoading(false) }
  }

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
        {/* Runtime controls */}
        <div className="ml-4 flex items-center gap-2">
          {runtime && (
            <div className="flex items-center gap-2 mr-2">
              <div style={{
                width: '8px', height: '8px', borderRadius: '50%',
                background: runtimeStatusColors[runtime.status] ?? '#6b7280',
                boxShadow: runtime.status === 'running' ? `0 0 6px ${runtimeStatusColors[runtime.status]}70` : 'none',
              }} />
              <span className="text-xs text-text-muted capitalize">{runtime.status}</span>
              {runtime.status === 'running' && runtime.uptime_seconds != null && (
                <span className="text-xs text-text-muted">
                  {Math.floor(runtime.uptime_seconds / 60)}m {runtime.uptime_seconds % 60}s
                </span>
              )}
            </div>
          )}
          {!runtime || runtime.status === 'stopped' || runtime.status === 'error' ? (
            <button
              onClick={handleStartRuntime}
              disabled={runtimeLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
            >
              {runtimeLoading ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              Start
            </button>
          ) : (
            <button
              onClick={handleStopRuntime}
              disabled={runtimeLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold hover:bg-red-500/20 transition-colors disabled:opacity-50"
            >
              {runtimeLoading ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Square className="w-3.5 h-3.5" />}
              Stop
            </button>
          )}
        </div>
      </div>

      {/* Runtime metrics bar */}
      {runtime && runtime.status === 'running' && (
        <div className="flex items-center gap-4 px-6 py-2 border-b border-surface-border bg-surface-secondary/30">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-text-muted">In Progress</span>
            <span className="text-xs font-bold text-accent">{runtime.tasks_in_progress}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-text-muted">Completed</span>
            <span className="text-xs font-bold text-emerald-400">{runtime.tasks_completed}</span>
          </div>
          {runtime.errors_count > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-text-muted">Errors</span>
              <span className="text-xs font-bold text-red-400">{runtime.errors_count}</span>
            </div>
          )}
          {runtime.last_error && (
            <span className="text-xs text-red-400/70 truncate max-w-[200px]" title={runtime.last_error}>
              {runtime.last_error}
            </span>
          )}
        </div>
      )}

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

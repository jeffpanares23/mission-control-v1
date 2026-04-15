// ============================================================
// MISSION CONTROL V1 — API CLIENT
// Direct Supabase REST (bypasses Laravel backend)
// ============================================================

import { supabase } from './supabase'
import type {
  Account, Task, TaskStatus, Anniversary,
  Reminder, Schedule, Insight, AIAgent,
  ChannelConnection, DashboardSummary,
} from '@/types'

const SB = 'https://lmymqyrtcuvercqxnvfi.supabase.co/rest/v1'

// ─── Auth helper ───────────────────────────────────────────
async function sbHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  const sessionToken = data.session?.access_token
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string
  return {
    'Content-Type': 'application/json',
    'apikey': anonKey,
    'Authorization': sessionToken ? `Bearer ${sessionToken}` : `Bearer ${anonKey}`,
    'Prefer': 'return=representation',
  }
}

async function sbGet<T>(table: string, params: Record<string, string> = {}): Promise<T[]> {
  const qs = new URLSearchParams(params).toString()
  const url = `${SB}/${table}${qs ? '?' + qs : ''}`
  const res = await fetch(url, { headers: await sbHeaders() })
  if (!res.ok) return []
  return res.json()
}

async function sbPost(table: string, data: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(`${SB}/${table}`, {
    method: 'POST',
    headers: await sbHeaders(),
    body: JSON.stringify(data),
  })
  return res.json()
}

async function sbPatch(table: string, filters: Record<string, string>, data: Record<string, unknown>): Promise<unknown> {
  const qs = new URLSearchParams(filters).toString()
  const res = await fetch(`${SB}/${table}?${qs}`, {
    method: 'PATCH',
    headers: await sbHeaders(),
    body: JSON.stringify(data),
  })
  return res.json()
}

async function sbDelete(table: string, filters: Record<string, string>): Promise<unknown> {
  const qs = new URLSearchParams(filters).toString()
  const res = await fetch(`${SB}/${table}?${qs}`, {
    method: 'DELETE',
    headers: await sbHeaders(),
  })
  return res.json()
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function wrap(data: any, fallback: unknown = []): { data: any } {
  return { data: Array.isArray(data) ? data : fallback }
}

// ─── Dashboard (client-side aggregation) ──────────────────
async function dashboardGet(): Promise<{ data: DashboardSummary }> {
  const [tasks, accounts, insights, schedules] = await Promise.all([
    sbGet<Task>('tasks', { order: 'created_at.desc', limit: '100' }),
    sbGet<Account>('accounts'),
    sbGet<Insight>('insights', { is_dismissed: 'eq.false', order: 'created_at.desc', limit: '10' }),
    sbGet<Schedule>('schedules', { order: 'start_time.asc', limit: '5' }),
  ])

  const totalTasks = tasks.length
  const doneTasks = tasks.filter(t => t.status === 'done').length
  const overdueTasks = tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done').length
  const highPriority = tasks.filter(t => t.priority === 'urgent' || t.priority === 'high').length
  const completionRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0

  return {
    data: {
      stats: { total_tasks: totalTasks, done_tasks: doneTasks, overdue_tasks: overdueTasks, high_priority_tasks: highPriority, total_accounts: accounts.length, completion_rate: completionRate },
      recent_tasks: tasks.slice(0, 5),
      upcoming_schedules: schedules,
      insights,
    },
  }
}

// ─── API object (same interface as original Laravel-backed api) ────
export const api = {

  // ─── Dashboard ────────────────────────────────────────────
  dashboard: {
    get: dashboardGet,
    activity: (limit = 50) => sbGet('activity_log', { order: 'created_at.desc', limit: String(limit) }).then(d => wrap(d)),
  },

  // ─── Accounts ─────────────────────────────────────────────
  accounts: {
    list: () => sbGet<Account>('accounts').then(d => wrap(d)),
    get: (id: string) => sbGet<Account>('accounts', { id: `eq.${id}` }).then(d => wrap(d[0])),
    create: (data: Partial<Account>) => sbPost('accounts', data).then(d => wrap(d)),
    update: (id: string, data: Partial<Account>) => sbPatch('accounts', { id: `eq.${id}` }, data).then(d => wrap(d)),
    delete: (id: string) => sbDelete('accounts', { id: `eq.${id}` }).then(d => wrap(d)),
  },

  // ─── Tasks ────────────────────────────────────────────────
  tasks: {
    list: (params?: Record<string, string>) => {
      const p = { order: 'position.asc', limit: '100', ...params }
      return sbGet<Task>('tasks', p).then(d => wrap(d))
    },
    get: (id: string) => sbGet<Task>('tasks', { id: `eq.${id}` }).then(d => wrap(d[0])),
    create: (data: Partial<Task>) => sbPost('tasks', data).then(d => wrap(d)),
    update: (id: string, data: Partial<Task>) => sbPatch('tasks', { id: `eq.${id}` }, data).then(d => wrap(d)),
    delete: (id: string) => sbDelete('tasks', { id: `eq.${id}` }).then(d => wrap(d)),
    move: (id: string, column_status: string, position: number) =>
      sbPatch('tasks', { id: `eq.${id}` }, { column_status, position }).then(d => wrap(d)),
    status: (id: string, status: TaskStatus) =>
      sbPatch('tasks', { id: `eq.${id}` }, {
        status,
        completed_at: status === 'done' ? new Date().toISOString() : null,
      }).then(d => wrap(d)),
  },

  // ─── Anniversaries ────────────────────────────────────────
  anniversaries: {
    list: () => sbGet<Anniversary>('anniversaries', { order: 'anniversary_date.asc' }).then(d => wrap(d)),
    get: (id: string) => sbGet<Anniversary>('anniversaries', { id: `eq.${id}` }).then(d => wrap(d[0])),
    create: (data: Partial<Anniversary>) => sbPost('anniversaries', data).then(d => wrap(d)),
    update: (id: string, data: Partial<Anniversary>) => sbPatch('anniversaries', { id: `eq.${id}` }, data).then(d => wrap(d)),
    delete: (id: string) => sbDelete('anniversaries', { id: `eq.${id}` }).then(d => wrap(d)),
  },

  // ─── Reminders ────────────────────────────────────────────
  reminders: {
    list: () => sbGet<Reminder>('reminders', { order: 'due_date.asc' }).then(d => wrap(d)),
    create: (data: Partial<Reminder>) => sbPost('reminders', data).then(d => wrap(d)),
    update: (id: string, data: Partial<Reminder>) => sbPatch('reminders', { id: `eq.${id}` }, data).then(d => wrap(d)),
    delete: (id: string) => sbDelete('reminders', { id: `eq.${id}` }).then(d => wrap(d)),
  },

  // ─── Schedules ────────────────────────────────────────────
  schedules: {
    list: () => sbGet<Schedule>('schedules', { order: 'start_time.asc' }).then(d => wrap(d)),
    create: (data: Partial<Schedule>) => sbPost('schedules', data).then(d => wrap(d)),
    update: (id: string, data: Partial<Schedule>) => sbPatch('schedules', { id: `eq.${id}` }, data).then(d => wrap(d)),
    delete: (id: string) => sbDelete('schedules', { id: `eq.${id}` }).then(d => wrap(d)),
  },

  // ─── Insights ────────────────────────────────────────────
  insights: {
    list: () => sbGet<Insight>('insights', { order: 'created_at.desc' }).then(d => wrap(d)),
    markRead: (id: string) => sbPatch('insights', { id: `eq.${id}` }, { is_read: true }).then(d => wrap(d)),
    dismiss: (id: string) => sbPatch('insights', { id: `eq.${id}` }, { is_dismissed: true }).then(d => wrap(d)),
  },

  // ─── AI Agent (Laravel-backed — returns offline until deployed) ─
  ai: {
    status: () => Promise.resolve({ data: { id: 'hermes', name: 'Hermes', status: 'offline', model: '', is_active: false, stats: { tasks_dispatched: 0, insights_generated: 0, conversations_handled: 0 }, metadata: {} } as AIAgent }),
    chat: (_message: string) => Promise.resolve({ data: { reply: 'AI Agent backend not yet deployed. Laravel backend needed for AI features.', agent_status: 'offline' } }),
    dispatch: (_taskId: string, _instruction: string) => Promise.resolve({ data: null }),
  },

  // ─── Settings (client-side only for now) ─────────────────
  settings: {
    get: () => Promise.resolve({ data: {} }),
    update: (_key: string, _value: unknown) => Promise.resolve({ data: null }),
  },

  // ─── Channels ──────────────────────────────────────────────
  channels: {
    list: () => sbGet<ChannelConnection>('channel_connections').then(d => wrap(d)),
    connectTelegram: (bot_token: string) =>
      sbPost('channel_connections', { channel: 'telegram', bot_token, is_active: true }).then(d => wrap(d)),
    connectDiscord: (bot_token: string) =>
      sbPost('channel_connections', { channel: 'discord', bot_token, is_active: true }).then(d => wrap(d)),
    connectWhatsApp: (account_sid: string, auth_token: string) =>
      sbPost('channel_connections', {
        channel: 'whatsapp',
        channel_meta: { account_sid, auth_token },
        is_active: true,
      }).then(d => wrap(d)),
    delete: (id: string) => sbDelete('channel_connections', { id: `eq.${id}` }).then(d => wrap(d)),
  },

  // ─── Agent Statuses ────────────────────────────────────────
  agent: {
    list: () => sbGet('agent_statuses', { order: 'created_at.desc' }).then(d => wrap(d)),
    upsert: (data: Record<string, unknown>) => sbPost('agent_statuses', data).then(d => wrap(d)),
    update: (id: string, data: Record<string, unknown>) =>
      sbPatch('agent_statuses', { id: `eq.${id}` }, data).then(d => wrap(d)),
    heartbeat: async (agentName: string, status: string) => {
      const existing = await sbGet<{ id: string }>('agent_statuses', { agent_name: `eq.${agentName}` })
      if (existing.length > 0) {
        return sbPatch('agent_statuses', { id: `eq.${existing[0].id}` }, { status, last_seen_at: new Date().toISOString() }).then(d => wrap(d))
      }
      return sbPost('agent_statuses', { agent_name: agentName, status, last_seen_at: new Date().toISOString() }).then(d => wrap(d))
    },
  },

  // ─── Cron Logs ─────────────────────────────────────────────
  cron: {
    list: (limit = 50) => sbGet('cron_logs', { order: 'created_at.desc', limit: String(limit) }).then(d => wrap(d)),
    create: (data: Record<string, unknown>) => sbPost('cron_logs', data).then(d => wrap(d)),
    update: (id: string, data: Record<string, unknown>) =>
      sbPatch('cron_logs', { id: `eq.${id}` }, data).then(d => wrap(d)),
    logStart: async (agentName: string, jobName: string) => {
      return sbPost('cron_logs', {
        agent_name: agentName,
        job_name: jobName,
        status: 'running',
        started_at: new Date().toISOString(),
      }).then(d => wrap(d))
    },
    logFinish: async (id: string, status: 'success' | 'failed', message?: string) => {
      const finishedAt = new Date().toISOString()
      return sbPatch('cron_logs', { id: `eq.${id}` }, {
        status,
        finished_at: finishedAt,
        message,
      }).then(d => wrap(d))
    },
  },
}

// ─── Realtime subscriptions ─────────────────────────────────
export type RealtimeChannel = ReturnType<typeof supabase.channel>

export function subscribeToTasks(callback: (task: Task, action: 'INSERT' | 'UPDATE' | 'DELETE') => void) {
  return supabase
    .channel('tasks-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (payload) => {
      callback(payload.new as Task, payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE')
    })
    .subscribe()
}

export function subscribeToSchedules(callback: (schedule: Schedule, action: 'INSERT' | 'UPDATE' | 'DELETE') => void) {
  return supabase
    .channel('schedules-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'schedules' }, (payload) => {
      callback(payload.new as Schedule, payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE')
    })
    .subscribe()
}

export function subscribeToReminders(callback: (reminder: Reminder, action: 'INSERT' | 'UPDATE' | 'DELETE') => void) {
  return supabase
    .channel('reminders-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'reminders' }, (payload) => {
      callback(payload.new as Reminder, payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE')
    })
    .subscribe()
}

export function subscribeToInsights(callback: (insight: Insight, action: 'INSERT' | 'UPDATE' | 'DELETE') => void) {
  return supabase
    .channel('insights-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'insights' }, (payload) => {
      callback(payload.new as Insight, payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE')
    })
    .subscribe()
}

export function subscribeToAgentStatus(callback: (status: Record<string, unknown>, action: 'INSERT' | 'UPDATE') => void) {
  return supabase
    .channel('agent-status-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'agent_statuses' }, (payload) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      callback(payload.new as any, payload.eventType as 'INSERT' | 'UPDATE')
    })
    .subscribe()
}

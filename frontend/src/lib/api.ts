// ============================================================
// MISSION CONTROL V1 — API CLIENT (Laravel Backend)
// All calls go through Laravel which validates the JWT and
// routes data queries to the authenticated user's agent DB
// ============================================================

import type {
  Account, Task, TaskStatus, Anniversary,
  Reminder, Schedule, Insight,
  ChannelConnection, DashboardSummary,
  ChannelWithAgents, CronJob, KnowledgeFile,
  AgentOpsDashboardSummary,
} from '@/types'

// ─── Auth types (Laravel JWT auth) ───────────────────────────
export interface AuthUser {
  id: string
  email: string
  full_name: string
  role: 'super_admin' | 'agent'
  is_active: boolean
  agent_id?: string
  agent_slug?: string
  agent_name?: string
}

export interface AuthAgent {
  id: string
  slug: string
  name: string
  supabase_url: string
  is_active: boolean
}

const LARAVEL_BASE = import.meta.env.VITE_API_BASE_URL
  ? `${import.meta.env.VITE_API_BASE_URL}/api/v1`
  : '/api/v1'

// ─── Token helper ───────────────────────────────────────────
function getToken(): string | null {
  try {
    const stored = localStorage.getItem('mc_session')
    if (stored) return JSON.parse(stored).access_token
  } catch { /* ignore */ }
  return null
}

async function request(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<Response> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  return fetch(`${LARAVEL_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
}

async function get<T>(path: string): Promise<T> {
  const res = await request('GET', path)
  const json = await res.json()
  if (!res.ok) throw new Error(json.message || `HTTP ${res.status}`)
  // BaseApiController::ok() wraps responses in { success, message, data }
  if (json && json.success === true && 'data' in json) {
    return json.data as T
  }
  return json as T
}

async function post<T = unknown>(path: string, data?: unknown): Promise<T> {
  const res = await request('POST', path, data)
  const json = await res.json()
  if (!res.ok) throw new Error(json.message || `HTTP ${res.status}`)
  // BaseApiController::ok() wraps responses in { success, message, data }
  // Unwrap so callers get the actual payload directly
  if (json && json.success === true && 'data' in json) {
    return json.data as T
  }
  return json as T
}

async function put<T = unknown>(path: string, data?: unknown): Promise<T> {
  const res = await request('PUT', path, data)
  const json = await res.json()
  if (!res.ok) throw new Error(json.message || `HTTP ${res.status}`)
  if (json && json.success === true && 'data' in json) return json.data as T
  return json as T
}

async function patch<T = unknown>(path: string, data?: unknown): Promise<T> {
  const res = await request('PATCH', path, data)
  const json = await res.json()
  if (!res.ok) throw new Error(json.message || `HTTP ${res.status}`)
  if (json && json.success === true && 'data' in json) return json.data as T
  return json as T
}

async function del<T = unknown>(path: string): Promise<T> {
  const res = await request('DELETE', path)
  const json = await res.json()
  if (!res.ok) throw new Error(json.message || `HTTP ${res.status}`)
  if (json && json.success === true && 'data' in json) return json.data as T
  return json as T
}

// ─── API object ───────────────────────────────────────────────
export const api = {

  // ─── Auth ──────────────────────────────────────────────────
  auth: {
    login: (email: string, password: string) =>
      post<{ access_token: string; token_type: string; expires_in: number; user: AuthUser; agent: AuthAgent | null }>(
        '/auth/login', { email, password }
      ),
    register: (email: string, password: string, fullName: string) =>
      post<{ id: string; email: string; full_name: string; role: string }>(
        '/auth/register', { email, password, full_name: fullName }
      ),
    me: () =>
      get<{ user: AuthUser; agent: AuthAgent | null }>('/auth/me'),
    logout: () => post('/auth/logout'),
    agents: () =>
      get<Array<{ agent_id: string; slug: string; name: string; is_active: boolean; can_admin: boolean }>>('/auth/agents'),
    switchAgent: (agentId: string) =>
      post<{ user: AuthUser; agent: AuthAgent | null }>('/auth/switch-agent', { agent_id: agentId }),
    /**
     * POST /api/v1/auth/telegram
     * Body: { initData } — raw Telegram WebApp initData string
     *
     * Validates initData on the backend (HMAC-SHA256 against bot token),
     * finds or creates the user by telegram_user_id, and returns a JWT.
     */
    telegram: (initData: string) =>
      post<{ access_token: string; token_type: string; expires_in: number; user: AuthUser }>(
        '/auth/telegram', { initData }
      ),
  },

  // ─── Admin (super_admin only) ───────────────────────────────
  admin: {
    users: {
      list: () => get<Array<{ id: string; user_id: string; email: string; full_name: string; role: string; is_active: boolean }>>('/users'),
      create: (data: { email: string; password: string; full_name: string; role: string }) =>
        post('/users', data),
      update: (id: string, data: { full_name?: string; role?: string; is_active?: boolean }) =>
        put(`/users/${id}`, data),
      deactivate: (id: string) =>
        del(`/users/${id}`),
    },
  },

  // ─── Dashboard ─────────────────────────────────────────────
  dashboard: {
    get: () => get<DashboardSummary>('/dashboard'),
    activity: (limit = 50) =>
      get<Array<Record<string, unknown>>>(`/activity?limit=${limit}`),
  },

  // ─── Accounts ───────────────────────────────────────────────
  accounts: {
    list: () => get<Account[]>('/accounts'),
    get: (id: string) => get<Account>(`/accounts/${id}`),
    create: (data: Partial<Account>) => post<Account>('/accounts', data),
    update: (id: string, data: Partial<Account>) => put<Account>(`/accounts/${id}`, data),
    delete: (id: string) => del(`/accounts/${id}`),
  },

  // ─── Tasks ─────────────────────────────────────────────────
  tasks: {
    list: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : ''
      return get<Task[]>(`/tasks${qs}`)
    },
    get: (id: string) => get<Task>(`/tasks/${id}`),
    create: (data: Partial<Task>) => post<Task>('/tasks', data),
    update: (id: string, data: Partial<Task>) => put<Task>(`/tasks/${id}`, data),
    delete: (id: string) => del(`/tasks/${id}`),
    move: (id: string, column_status: string, position: number) =>
      put<Task>(`/tasks/${id}`, { column_status, position }),
    status: (id: string, status: TaskStatus) =>
      put<Task>(`/tasks/${id}/status`, { status }),
  },

  // ─── Anniversaries ─────────────────────────────────────────
  anniversaries: {
    list: () => get<Anniversary[]>('/anniversaries'),
    get: (id: string) => get<Anniversary>(`/anniversaries/${id}`),
    create: (data: Partial<Anniversary>) => post<Anniversary>('/anniversaries', data),
    update: (id: string, data: Partial<Anniversary>) => put<Anniversary>(`/anniversaries/${id}`, data),
    delete: (id: string) => del(`/anniversaries/${id}`),
  },

  // ─── Reminders ─────────────────────────────────────────────
  reminders: {
    list: () => get<Reminder[]>('/reminders'),
    create: (data: Partial<Reminder>) => post<Reminder>('/reminders', data),
    update: (id: string, data: Partial<Reminder>) => put<Reminder>(`/reminders/${id}`, data),
    delete: (id: string) => del(`/reminders/${id}`),
  },

  // ─── Schedules ─────────────────────────────────────────────
  schedules: {
    list: () => get<Schedule[]>('/schedules'),
    create: (data: Partial<Schedule>) => post<Schedule>('/schedules', data),
    update: (id: string, data: Partial<Schedule>) => put<Schedule>(`/schedules/${id}`, data),
    delete: (id: string) => del(`/schedules/${id}`),
  },

  // ─── Insights ──────────────────────────────────────────────
  insights: {
    list: () => get<Insight[]>('/insights'),
    markRead: (id: string) => post(`/insights/${id}/read`),
    dismiss: (id: string) => post(`/insights/${id}/dismiss`),
  },

  // ─── AI Agent ───────────────────────────────────────────────
  ai: {
    status: () => get<{ id: string; name: string; status: string; model: string; stats: Record<string, number>; runtime?: import('@/types').RuntimeState }>('/ai/status'),
    chat: (message: string) => post<{ reply: string; agent_status: string }>('/ai/chat', { message }),
    dispatch: (task_id: string, instruction: string) =>
      post<{ dispatched: boolean; task_id: string }>('/ai/dispatch', { task_id, instruction }),
    // Agent runtime control
    startRuntime: () => post('/ai/runtime/start'),
    stopRuntime: () => post('/ai/runtime/stop'),
    // Telegram polling control (for telegram channels)
    startPolling: (channelId: string) =>
      post(`/ai/channels/${channelId}/start-polling`),
    stopPolling: (channelId: string) =>
      post(`/ai/channels/${channelId}/stop-polling`),
  },

  // ─── Reports ────────────────────────────────────────────────
  reports: {
    list: () => get('/reports'),
    get: (id: string) => get(`/reports/${id}`),
    create: (data: Record<string, unknown>) => post('/reports', data),
    update: (id: string, data: Record<string, unknown>) => put(`/reports/${id}`, data),
    delete: (id: string) => del(`/reports/${id}`),
    generate: (id: string) => post(`/reports/${id}/generate`),
  },

  // ─── Settings ───────────────────────────────────────────────
  settings: {
    get: () => get<Record<string, string>>('/settings'),
    update: (key: string, value: unknown) => put(`/settings/${key}`, { value }),
  },

  // ─── Channels ───────────────────────────────────────────────
  channels: {
    list: () => get<ChannelConnection[]>('/channels'),
    connectTelegram: (bot_token: string) =>
      post<{ bot_username: string }>('/channels/telegram/connect', { bot_token }),
    connectDiscord: (bot_token: string) =>
      post('/channels/discord/connect', { bot_token }),
    connectWhatsApp: (account_sid: string, auth_token: string) =>
      post('/channels/whatsapp/connect', { account_sid, auth_token }),
    disconnect: (channel: string) => del(`/channels/${channel}`),
  },

  // ─── Agent Statuses ─────────────────────────────────────────
  agent: {
    list: () => get('/agent-statuses'),
    heartbeat: (agentName: string, status: string) =>
      post('/agent-statuses/heartbeat', { agent_name: agentName, status }),
  },

  // ─── Agent Operations Dashboard ──────────────────────────────
  agentOps: {
    dashboard: () => get<AgentOpsDashboardSummary>('/agent-ops/dashboard'),

    // Channels
    channels: {
      list: () => get<ChannelWithAgents[]>('/agent-ops/channels'),
      details: (id: string) => get<ChannelWithAgents>(`/agent-ops/channels/${id}`),
      pauseAgent: (channelId: string) =>
        post(`/agent-ops/channels/${channelId}/pause-agent`),
      resumeAgent: (channelId: string) =>
        post(`/agent-ops/channels/${channelId}/resume-agent`),
      reconnect: (channelId: string) =>
        post(`/agent-ops/channels/${channelId}/reconnect`),
      triggerCron: (channelId: string, cronJobId: string) =>
        post(`/agent-ops/channels/${channelId}/trigger-cron`, { cron_job_id: cronJobId }),
    },

    // Cron Jobs
    cronJobs: {
      list: (params?: { status?: string; channel_id?: string }) => {
        const qs = params ? '?' + new URLSearchParams(params).toString() : ''
        return get<CronJob[]>(`/agent-ops/cron-jobs${qs}`)
      },
      run: (id: string) =>
        post(`/agent-ops/cron-jobs/${id}/run`),
      pause: (id: string) =>
        post(`/agent-ops/cron-jobs/${id}/pause`),
      resume: (id: string) =>
        post(`/agent-ops/cron-jobs/${id}/resume`),
    },

    // Knowledge Files
    knowledgeFiles: {
      list: (params?: {
        channel_id?: string
        agent_id?: string
        status?: string
        file_type?: string
        tag?: string
      }) => {
        const qs = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : ''
        return get<KnowledgeFile[]>(`/agent-ops/knowledge-files${qs}`)
      },
      get: (id: string) =>
        get<KnowledgeFile>(`/agent-ops/knowledge-files/${id}`),
      update: (id: string, data: {
        is_enabled?: boolean
        status?: string
        channel_id?: string | null
        agent_id?: string | null
        instruction_weight?: number
        tags?: string[]
      }) => patch<KnowledgeFile>(`/agent-ops/knowledge-files/${id}`, data),
      toggle: (id: string, enabled: boolean) =>
        patch<KnowledgeFile>(`/agent-ops/knowledge-files/${id}`, { is_enabled: enabled }),
    },
  },

  // ─── Cron Logs ──────────────────────────────────────────────
  cron: {
    list: (limit = 50) => get(`/cron-logs?limit=${limit}`),
    logStart: (agentName: string, jobName: string) =>
      post('/cron-logs', { agent_name: agentName, job_name: jobName, status: 'running', started_at: new Date().toISOString() }),
    logFinish: (id: string, status: 'success' | 'failed', message?: string) =>
      put(`/cron-logs/${id}`, { status, finished_at: new Date().toISOString(), message }),
  },
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function subscribeToTasks(_callback: (task: Task, action: any) => void) {
  // Realtime via Supabase — not used when going through Laravel backend
  return { unsubscribe: () => {} } as any
}
export function subscribeToSchedules(_callback: (s: Schedule, action: any) => void) {
  return { unsubscribe: () => {} } as any
}
export function subscribeToReminders(_callback: (r: Reminder, action: any) => void) {
  return { unsubscribe: () => {} } as any
}
export function subscribeToInsights(_callback: (i: Insight, action: any) => void) {
  return { unsubscribe: () => {} } as any
}
export function subscribeToAgentStatus(_callback: (s: Record<string, unknown>, action: any) => void) {
  return { unsubscribe: () => {} } as any
}

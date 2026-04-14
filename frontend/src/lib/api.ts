// ============================================================
// MISSION CONTROL V1 — API CLIENT
// Laravel backend + Supabase
// ============================================================

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = localStorage.getItem('mc_token')

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string>),
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.message || `HTTP ${res.status}`)
  }

  return res.json()
}

export const api = {
  // ─── Dashboard ────────────────────────────────────────────────
  dashboard: {
    get: () => request<{ data: import('@/types').DashboardSummary }>('/v1/dashboard'),
    activity: (limit = 50) => request<{ data: unknown[] }>(`/v1/activity?limit=${limit}`),
  },

  // ─── Accounts ──────────────────────────────────────────────
  accounts: {
    list: () => request<{ data: import('@/types').Account[] }>('/v1/accounts'),
    get: (id: string) => request<{ data: import('@/types').Account }>(`/v1/accounts/${id}`),
    create: (data: Partial<import('@/types').Account>) =>
      request<{ data: unknown }>('/v1/accounts', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<import('@/types').Account>) =>
      request<{ data: unknown }>(`/v1/accounts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
      request<{ data: null }>(`/v1/accounts/${id}`, { method: 'DELETE' }),
  },

  // ─── Tasks ─────────────────────────────────────────────────
  tasks: {
    list: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : ''
      return request<{ data: import('@/types').Task[] }>(`/v1/tasks${qs}`)
    },
    get: (id: string) => request<{ data: import('@/types').Task }>(`/v1/tasks/${id}`),
    create: (data: Partial<import('@/types').Task>) =>
      request<{ data: unknown }>('/v1/tasks', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<import('@/types').Task>) =>
      request<{ data: unknown }>(`/v1/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) =>
      request<{ data: null }>(`/v1/tasks/${id}`, { method: 'DELETE' }),
    move: (id: string, column_status: string, position: number) =>
      request<{ data: unknown }>(`/v1/tasks/${id}/move`, {
        method: 'PATCH', body: JSON.stringify({ column_status, position }),
      }),
    status: (id: string, status: import('@/types').TaskStatus) =>
      request<{ data: unknown }>(`/v1/tasks/${id}/status`, {
        method: 'PATCH', body: JSON.stringify({ status }),
      }),
  },

  // ─── Anniversaries ─────────────────────────────────────────
  anniversaries: {
    list: () => request<{ data: import('@/types').Anniversary[] }>('/v1/anniversaries'),
    get: (id: string) => request<{ data: import('@/types').Anniversary }>(`/v1/anniversaries/${id}`),
    create: (data: Partial<import('@/types').Anniversary>) =>
      request('/v1/anniversaries', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<import('@/types').Anniversary>) =>
      request(`/v1/anniversaries/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => request(`/v1/anniversaries/${id}`, { method: 'DELETE' }),
  },

  // ─── Reminders ──────────────────────────────────────────────
  reminders: {
    list: () => request<{ data: import('@/types').Reminder[] }>('/v1/reminders'),
    create: (data: Partial<import('@/types').Reminder>) =>
      request('/v1/reminders', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<import('@/types').Reminder>) =>
      request(`/v1/reminders/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => request(`/v1/reminders/${id}`, { method: 'DELETE' }),
  },

  // ─── Schedules ─────────────────────────────────────────────
  schedules: {
    list: () => request<{ data: import('@/types').Schedule[] }>('/v1/schedules'),
    create: (data: Partial<import('@/types').Schedule>) =>
      request('/v1/schedules', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<import('@/types').Schedule>) =>
      request(`/v1/schedules/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => request(`/v1/schedules/${id}`, { method: 'DELETE' }),
  },

  // ─── Insights ───────────────────────────────────────────────
  insights: {
    list: () => request<{ data: import('@/types').Insight[] }>('/v1/insights'),
    markRead: (id: string) => request(`/v1/insights/${id}/read`, { method: 'PATCH' }),
    dismiss: (id: string) => request(`/v1/insights/${id}/dismiss`, { method: 'PATCH' }),
  },

  // ─── AI Agent ─────────────────────────────────────────────
  ai: {
    status: () => request<{ data: import('@/types').AIAgent }>('/v1/ai/status'),
    chat: (message: string) =>
      request<{ data: { reply: string; agent_status: string } }>('/v1/ai/chat', {
        method: 'POST', body: JSON.stringify({ message }),
      }),
    dispatch: (taskId: string, instruction: string) =>
      request('/v1/ai/dispatch', {
        method: 'POST', body: JSON.stringify({ task_id: taskId, instruction }),
      }),
  },

  // ─── Settings ──────────────────────────────────────────────
  settings: {
    get: () => request<{ data: Record<string, unknown> }>('/v1/settings'),
    update: (key: string, value: unknown) =>
      request(`/v1/settings/${key}`, { method: 'PUT', body: JSON.stringify({ value }) }),
  },

  // ─── Channels ──────────────────────────────────────────────
  channels: {
    list: () => request<{ data: import('@/types').ChannelConnection[] }>('/v1/channels'),
    connectTelegram: (bot_token: string) =>
      request('/v1/channels/telegram/connect', { method: 'POST', body: JSON.stringify({ bot_token }) }),
    connectDiscord: (bot_token: string) =>
      request('/v1/channels/discord/connect', { method: 'POST', body: JSON.stringify({ bot_token }) }),
    disconnect: (channel: string) =>
      request(`/v1/channels/${channel}`, { method: 'DELETE' }),
  },
}

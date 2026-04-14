// ============================================================
// MISSION CONTROL V1 — SHARED TYPES
// ============================================================

export type ChannelType = 'telegram' | 'discord' | 'whatsapp' | 'email' | 'web';
export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type ReminderRecurrence = 'once' | 'daily' | 'weekly' | 'monthly' | 'yearly';
export type InsightType = 'task_overdue' | 'upcoming_anniversary' | 'schedule_conflict' | 'ai_suggestion' | 'productivity_tip' | 'channel_alert';
export type AIAgentStatus = 'idle' | 'thinking' | 'acting' | 'error' | 'offline';

// ─── Account ────────────────────────────────────────────────
export interface Account {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  website?: string;
  avatar_url?: string;
  notes?: string;
  tags: string[];
  channel: ChannelType;
  channel_id?: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ─── Task ────────────────────────────────────────────────────
export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date?: string;
  completed_at?: string;
  account_id?: string;
  assigned_to?: string;
  tags: string[];
  position: number;
  column_status: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ─── Kanban Column ──────────────────────────────────────────
export interface KanbanColumn {
  id: string;
  title: string;
  status: TaskStatus;
  tasks: Task[];
}

// ─── Anniversary ────────────────────────────────────────────
export interface Anniversary {
  id: string;
  account_id?: string;
  title: string;
  anniversary_date: string;
  anniversary_type: string;
  notes?: string;
  remind_days_before: number;
  is_recurring: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ─── Reminder ───────────────────────────────────────────────
export interface Reminder {
  id: string;
  title: string;
  description?: string;
  due_date: string;
  recurrence: ReminderRecurrence;
  recurrence_interval: number;
  is_active: boolean;
  task_id?: string;
  account_id?: string;
  channel_to_notify: ChannelType;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ─── Schedule ───────────────────────────────────────────────
export interface Schedule {
  id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time?: string;
  is_all_day: boolean;
  recurrence_rule?: string;
  account_id?: string;
  task_id?: string;
  color: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ─── Insight ────────────────────────────────────────────────
export interface Insight {
  id: string;
  insight_type: InsightType;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  is_read: boolean;
  is_dismissed: boolean;
  action_url?: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ─── AI Agent ────────────────────────────────────────────────
export interface AIAgent {
  id: string;
  name: string;
  status: AIAgentStatus;
  model: string;
  system_prompt?: string;
  is_active: boolean;
  current_task_id?: string;
  stats: {
    tasks_dispatched: number;
    insights_generated: number;
    conversations_handled: number;
  };
  metadata: Record<string, unknown>;
}

export interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

// ─── Channel Connection ──────────────────────────────────────
export interface ChannelConnection {
  id: string;
  channel: ChannelType;
  bot_token?: string;
  webhook_url?: string;
  is_active: boolean;
  channel_name?: string;
  channel_meta: Record<string, unknown>;
  last_ping_at?: string;
  created_at: string;
  updated_at: string;
}

// ─── Dashboard Stats ─────────────────────────────────────────
export interface DashboardStats {
  total_tasks: number;
  done_tasks: number;
  overdue_tasks: number;
  high_priority_tasks: number;
  total_accounts: number;
  completion_rate: number;
}

// ─── Dashboard Summary ──────────────────────────────────────
export interface DashboardSummary {
  stats: DashboardStats;
  recent_tasks: Task[];
  upcoming_schedules: Schedule[];
  insights: Insight[];
}

// ─── Settings ────────────────────────────────────────────────
export interface ThemeSettings {
  mode: 'dark' | 'light';
  accent_color: string;
  glass_opacity: number;
  sidebar_collapsed: boolean;
}

export interface NotificationSettings {
  telegram: boolean;
  discord: boolean;
  whatsapp: boolean;
  email: boolean;
}

export interface WorkspaceSettings {
  layout: 'command_center' | 'focused' | 'minimal';
  right_panel: 'insights' | 'activity' | 'ai' | 'none';
  default_view: 'kanban' | 'list';
}

export interface AppSettings {
  theme: ThemeSettings;
  notifications: NotificationSettings;
  workspace: WorkspaceSettings;
}

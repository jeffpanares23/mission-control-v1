// ============================================================
// MISSION CONTROL V1 — SHARED TYPES
// ============================================================

export type ChannelType = 'telegram' | 'discord' | 'whatsapp' | 'email' | 'web';
export type TaskStatus = 'backlog' | 'scheduled' | 'in_progress' | 'waiting' | 'review' | 'done' | 'cancelled';
export type TaskTriggerSource = 'manual' | 'cron' | 'channel' | 'system';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type ReminderRecurrence = 'once' | 'daily' | 'weekly' | 'monthly' | 'yearly';
export type InsightType = 'task_overdue' | 'upcoming_anniversary' | 'schedule_conflict' | 'ai_suggestion' | 'productivity_tip' | 'channel_alert';
export type AIAgentStatus = 'idle' | 'thinking' | 'acting' | 'error' | 'offline';

// ─── Telegram Polling ─────────────────────────────────────────
export type TelegramPollingStatus = 'stopped' | 'running' | 'error';

export interface TelegramPollingState {
  status: TelegramPollingStatus;
  started_at?: string;
  error_message?: string;
  updates_pending: number;
  last_update_id?: number;
}

// ─── Agent Runtime ─────────────────────────────────────────────
export type RuntimeStatus = 'stopped' | 'running' | 'paused' | 'error';

export interface RuntimeState {
  status: RuntimeStatus;
  started_at?: string;
  stopped_at?: string;
  uptime_seconds?: number;
  tasks_in_progress: number;
  tasks_completed: number;
  errors_count: number;
  last_error?: string;
}

// ─── Account ───────────────────────────────────────────────
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

// ─── Task ───────────────────────────────────────────────────
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
  // Agent ops extensions
  channel_id?: string;
  channel_name?: string;
  agent_id?: string;
  agent_name?: string;
  trigger_source?: TaskTriggerSource;
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

// ─── Reminder ──────────────────────────────────────────────
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

// ─── Schedule ──────────────────────────────────────────────
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

// ─── Insight ───────────────────────────────────────────────
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
  runtime?: RuntimeState;
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
  // Telegram polling state (telegram channels only)
  polling?: TelegramPollingState;
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

// ══════════════════════════════════════════════════════════════
// AGENT OPERATIONS DASHBOARD — TYPES
// ══════════════════════════════════════════════════════════════

// ─── Managed Agent ─────────────────────────────────────────
export interface ManagedAgent {
  id: string;
  name: string;
  slug: string;
  status: AIAgentStatus;
  model: string;
  channel_count: number;
  active_channel_count: number;
  task_count: number;
  active_task_count: number;
  is_active: boolean;
  supabase_url?: string;
  supabase_key_masked?: string;
  created_at: string;
  updated_at: string;
}

// ─── Agent ↔ Channel Assignment ────────────────────────────
export interface AgentChannelAssignment {
  id: string;
  agent_id: string;
  agent_name: string;
  agent_status: AIAgentStatus;
  channel_id: string;
  channel_name: string;
  channel_type: ChannelType;
  is_primary: boolean;
  is_active: boolean;
  assigned_at: string;
  tasks_count: number;
}

// ─── Channel with Agent Info (extended) ────────────────────
export interface ChannelWithAgents extends ChannelConnection {
  assigned_agents: AgentChannelAssignment[];
  pending_task_count: number;
  last_activity_at?: string;
  cron_jobs_count: number;
}

// ─── Cron Job ─────────────────────────────────────────────
export type CronJobStatus = 'active' | 'paused' | 'running' | 'failed' | 'idle';
export type CronTriggerType = 'schedule' | 'manual' | 'event';

export interface CronJob {
  id: string;
  name: string;
  description?: string;
  cron_expression?: string;
  schedule?: string;
  trigger_type: CronTriggerType;
  channel_id?: string;
  channel_name?: string;
  agent_id?: string;
  agent_name?: string;
  is_active: boolean;
  status: CronJobStatus;
  last_run_at?: string;
  last_run_duration_ms?: number;
  last_run_result?: 'success' | 'failed' | 'partial';
  last_run_error?: string;
  next_run_at?: string;
  run_count: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ─── Knowledge / Markdown File ─────────────────────────────
export type KnowledgeFileStatus = 'active' | 'archived' | 'disabled';
export type KnowledgeFileType   = 'markdown' | 'text' | 'json' | 'yaml';

export interface KnowledgeFile {
  id: string;
  filename: string;
  title?: string;
  path: string;
  file_size_bytes?: number;
  file_type: KnowledgeFileType;
  tags: string[];
  channel_id?: string | null;
  channel_name?: string;
  agent_id?: string | null;
  agent_name?: string;
  is_enabled: boolean;
  status: KnowledgeFileStatus;
  instruction_weight?: number;
  last_modified_at?: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  // Populated when fetching a single file for preview
  content?: string;
}

// ─── Operational Insight ───────────────────────────────────
export type OperationalInsightSeverity = 'info' | 'warning' | 'critical';

export type OperationalInsightType =
  | 'failed_cron'
  | 'disconnected_channel'
  | 'unassigned_channel'
  | 'stale_knowledge_file'
  | 'overloaded_agent'
  | 'blocked_task'
  | 'agent_offline'
  | 'high_error_rate';

// OperationalInsight is structurally compatible with Insight —
// used for the agent-ops operational alerts panel.
export interface OperationalInsight {
  id: string;
  insight_type: OperationalInsightType;
  title: string;
  message: string;
  severity: OperationalInsightSeverity;
  is_read: boolean;
  is_dismissed: boolean;
  action_url?: string;
  metadata: Record<string, unknown>;
  created_at: string;
  // Extra fields (not in core Insight but populated by agent-ops)
  entity_type?: 'channel' | 'agent' | 'cron' | 'task' | 'file';
  entity_id?: string;
  entity_name?: string;
}

// ─── Agent Ops Metrics ─────────────────────────────────────
export interface AgentOpsMetrics {
  total_channels: number;
  active_channels: number;
  inactive_channels: number;
  total_agents: number;
  active_agents: number;
  total_cron_jobs: number;
  running_cron_jobs: number;
  failed_cron_jobs: number;
  paused_cron_jobs: number;
  pending_tasks: number;
  in_progress_tasks: number;
  done_tasks: number;
  blocked_tasks: number;
  knowledge_files: number;
  active_knowledge_files: number;
  alerts_count: number;
}

// ─── Agent Status Sync ────────────────────────────────────────
export interface AgentStatusSyncPayload {
  agent_id: string
  tasks: Task[]
  cron_jobs: CronJob[]
  reminders: Reminder[]
  scripts: ScriptPayload[]
  notification_targets: NotificationTargetPayload[]
  services: ServiceStatusPayload[]
}

export interface ScriptPayload {
  id: string
  name: string
  description?: string
  script_content?: string
  file_path?: string
  is_enabled: boolean
  last_run_at?: string
  run_count: number
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface NotificationTargetPayload {
  id: string
  channel: ChannelType
  target_value: string
  label?: string
  is_enabled: boolean
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface ServiceStatusPayload {
  id: string
  name: string
  status: 'running' | 'stopped' | 'error' | 'starting' | 'stopping'
  pid?: number
  memory_mb?: number
  cpu_percent?: number
  last_start_at?: string
  last_stop_at?: string
  restart_count: number
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface AgentStatusSyncResponse {
  synced_at: string
  counts: {
    tasks: number
    cron_jobs: number
    reminders: number
    scripts: number
    notification_targets: number
    services: number
  }
  errors: string[]
}

// ─── Agent Ops Dashboard Summary ────────────────────────────
export interface AgentOpsDashboardSummary {
  metrics: AgentOpsMetrics;
  channels: ChannelWithAgents[];
  recent_tasks: Task[];
  active_insights: OperationalInsight[];
}

// ══════════════════════════════════════════════════════════════
// AGENT STATUS & SYNC — TYPES
// ══════════════════════════════════════════════════════════════

export type GatewayStatus = 'running' | 'paused' | 'error' | 'needs_attention';

export interface AgentStatus {
  gateway_status: GatewayStatus;
  hermes_gateway: {
    status: GatewayStatus;
    last_heartbeat: string;
    uptime_seconds: number;
    version?: string;
  };
  supabase: {
    connected: boolean;
    last_check: string;
    latency_ms?: number;
  };
  sync_state: {
    last_sync_at: string | null;
    is_syncing: boolean;
    pending_changes: number;
  };
  current_services: CurrentService[];
}

export interface CurrentService {
  name: string;
  status: 'connected' | 'disconnected' | 'degraded';
  message?: string;
}

export interface AgentCronJob {
  id: string;
  name: string;
  schedule: string;
  status: 'active' | 'paused' | 'error' | 'idle';
  next_run: string | null;
  last_run: string | null;
  last_result?: 'success' | 'failed' | null;
}

export interface AgentTask {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
}

export interface AgentReminder {
  id: string;
  text: string;
  remind_at: string;
  status: 'pending' | 'sent' | 'cancelled';
}

export interface AgentScript {
  id: string;
  name: string;
  category: string;
  last_used: string | null;
}

export interface AgentNotificationTarget {
  id: string;
  platform: ChannelType;
  target_name: string;
  is_active: boolean;
}

-- ============================================================
-- MISSION CONTROL V1 — SUPABASE SCHEMA
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ─── Agent Statuses ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_statuses (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_name  TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'offline',  -- idle, thinking, acting, error, offline
  last_seen_at TIMESTAMPTZ,
  source      TEXT,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE agent_statuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all reads" ON agent_statuses FOR SELECT USING (true);
CREATE POLICY "Allow all inserts" ON agent_statuses FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all updates" ON agent_statuses FOR UPDATE USING (true);
CREATE POLICY "Allow all deletes" ON agent_statuses FOR DELETE USING (true);

-- ─── Cron Logs ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cron_logs (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_name   TEXT,
  job_name     TEXT NOT NULL,
  status       TEXT NOT NULL,  -- running, success, failed
  started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at  TIMESTAMPTZ,
  duration_ms  INTEGER,
  message      TEXT,
  metadata     JSONB DEFAULT '{}',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE cron_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all reads" ON cron_logs FOR SELECT USING (true);
CREATE POLICY "Allow all inserts" ON cron_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all updates" ON cron_logs FOR UPDATE USING (true);
CREATE POLICY "Allow all deletes" ON cron_logs FOR DELETE USING (true);

-- ─── Verify existing tables have RLS ────────────────────────
-- Run the following for each existing table if not already set:
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE anniversaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_connections ENABLE ROW LEVEL SECURITY;

-- Public read/write policies (dev mode)
CREATE POLICY "tasks_all" ON tasks FOR SELECT USING (true);
CREATE POLICY "tasks_all" ON tasks FOR INSERT WITH CHECK (true);
CREATE POLICY "tasks_all" ON tasks FOR UPDATE USING (true);
CREATE POLICY "tasks_all" ON tasks FOR DELETE USING (true);

CREATE POLICY "accounts_all" ON accounts FOR SELECT USING (true);
CREATE POLICY "accounts_all" ON accounts FOR INSERT WITH CHECK (true);
CREATE POLICY "accounts_all" ON accounts FOR UPDATE USING (true);
CREATE POLICY "accounts_all" ON accounts FOR DELETE USING (true);

CREATE POLICY "anniversaries_all" ON anniversaries FOR SELECT USING (true);
CREATE POLICY "anniversaries_all" ON anniversaries FOR INSERT WITH CHECK (true);
CREATE POLICY "anniversaries_all" ON anniversaries FOR UPDATE USING (true);
CREATE POLICY "anniversaries_all" ON anniversaries FOR DELETE USING (true);

CREATE POLICY "reminders_all" ON reminders FOR SELECT USING (true);
CREATE POLICY "reminders_all" ON reminders FOR INSERT WITH CHECK (true);
CREATE POLICY "reminders_all" ON reminders FOR UPDATE USING (true);
CREATE POLICY "reminders_all" ON reminders FOR DELETE USING (true);

CREATE POLICY "schedules_all" ON schedules FOR SELECT USING (true);
CREATE POLICY "schedules_all" ON schedules FOR INSERT WITH CHECK (true);
CREATE POLICY "schedules_all" ON schedules FOR UPDATE USING (true);
CREATE POLICY "schedules_all" ON schedules FOR DELETE USING (true);

CREATE POLICY "insights_all" ON insights FOR SELECT USING (true);
CREATE POLICY "insights_all" ON insights FOR INSERT WITH CHECK (true);
CREATE POLICY "insights_all" ON insights FOR UPDATE USING (true);
CREATE POLICY "insights_all" ON insights FOR DELETE USING (true);

CREATE POLICY "channel_connections_all" ON channel_connections FOR SELECT USING (true);
CREATE POLICY "channel_connections_all" ON channel_connections FOR INSERT WITH CHECK (true);
CREATE POLICY "channel_connections_all" ON channel_connections FOR UPDATE USING (true);
CREATE POLICY "channel_connections_all" ON channel_connections FOR DELETE USING (true);

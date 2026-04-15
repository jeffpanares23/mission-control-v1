-- ============================================================
-- MISSION CONTROL V1 — MIGRATION 003
-- Auth + RBAC: profiles table, updated RLS, super_admin bypass
-- ============================================================

BEGIN;

-- ─── 1. PROFILES TABLE ───────────────────────────────────────
-- Stores extended user info linked to auth.users
-- role: 'super_admin' | 'agent'
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'agent' CHECK (role IN ('super_admin', 'agent')),
    is_active BOOLEAN DEFAULT TRUE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── 2. HELPER: is_super_admin(user_id) ──────────────────────
-- Used in RLS policies for super_admin bypass
CREATE OR REPLACE FUNCTION is_super_admin(uid UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM profiles
        WHERE user_id = uid
        AND role = 'super_admin'
        AND is_active = TRUE
    );
$$ LANGUAGE sql STABLE;

-- ─── 3. UPDATED RLS POLICIES ─────────────────────────────────
-- All policies now check is_super_admin() for read access bypass

-- ACCOUNTS
DROP POLICY IF EXISTS accounts_select ON accounts;
DROP POLICY IF EXISTS accounts_insert ON accounts;
DROP POLICY IF EXISTS accounts_update ON accounts;
DROP POLICY IF EXISTS accounts_delete ON accounts;

CREATE POLICY "accounts_select" ON accounts FOR SELECT
    USING (auth.uid() = user_id OR is_super_admin(auth.uid()));
CREATE POLICY "accounts_insert" ON accounts FOR INSERT
    WITH CHECK (auth.uid() = user_id);
CREATE POLICY "accounts_update" ON accounts FOR UPDATE
    USING (auth.uid() = user_id OR is_super_admin(auth.uid()));
CREATE POLICY "accounts_delete" ON accounts FOR DELETE
    USING (auth.uid() = user_id OR is_super_admin(auth.uid()));

-- TASKS
DROP POLICY IF EXISTS tasks_select ON tasks;
DROP POLICY IF EXISTS tasks_insert ON tasks;
DROP POLICY IF EXISTS tasks_update ON tasks;
DROP POLICY IF EXISTS tasks_delete ON tasks;

CREATE POLICY "tasks_select" ON tasks FOR SELECT
    USING (
        auth.uid() = user_id
        OR auth.uid() = assigned_to
        OR is_super_admin(auth.uid())
    );
CREATE POLICY "tasks_insert" ON tasks FOR INSERT
    WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tasks_update" ON tasks FOR UPDATE
    USING (
        auth.uid() = user_id
        OR auth.uid() = assigned_to
        OR is_super_admin(auth.uid())
    );
CREATE POLICY "tasks_delete" ON tasks FOR DELETE
    USING (auth.uid() = user_id OR is_super_admin(auth.uid()));

-- ANNIVERSARIES
DROP POLICY IF EXISTS anniversaries_select ON anniversaries;
DROP POLICY IF EXISTS anniversaries_insert ON anniversaries;
DROP POLICY IF EXISTS anniversaries_update ON anniversaries;
DROP POLICY IF EXISTS anniversaries_delete ON anniversaries;

CREATE POLICY "anniversaries_select" ON anniversaries FOR SELECT
    USING (auth.uid() = user_id OR is_super_admin(auth.uid()));
CREATE POLICY "anniversaries_insert" ON anniversaries FOR INSERT
    WITH CHECK (auth.uid() = user_id);
CREATE POLICY "anniversaries_update" ON anniversaries FOR UPDATE
    USING (auth.uid() = user_id OR is_super_admin(auth.uid()));
CREATE POLICY "anniversaries_delete" ON anniversaries FOR DELETE
    USING (auth.uid() = user_id OR is_super_admin(auth.uid()));

-- REMINDERS
DROP POLICY IF EXISTS reminders_select ON reminders;
DROP POLICY IF EXISTS reminders_insert ON reminders;
DROP POLICY IF EXISTS reminders_update ON reminders;
DROP POLICY IF EXISTS reminders_delete ON reminders;

CREATE POLICY "reminders_select" ON reminders FOR SELECT
    USING (auth.uid() = user_id OR is_super_admin(auth.uid()));
CREATE POLICY "reminders_insert" ON reminders FOR INSERT
    WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reminders_update" ON reminders FOR UPDATE
    USING (auth.uid() = user_id OR is_super_admin(auth.uid()));
CREATE POLICY "reminders_delete" ON reminders FOR DELETE
    USING (auth.uid() = user_id OR is_super_admin(auth.uid()));

-- SCHEDULES
DROP POLICY IF EXISTS schedules_select ON schedules;
DROP POLICY IF EXISTS schedules_insert ON schedules;
DROP POLICY IF EXISTS schedules_update ON schedules;
DROP POLICY IF EXISTS schedules_delete ON schedules;

CREATE POLICY "schedules_select" ON schedules FOR SELECT
    USING (auth.uid() = user_id OR is_super_admin(auth.uid()));
CREATE POLICY "schedules_insert" ON schedules FOR INSERT
    WITH CHECK (auth.uid() = user_id);
CREATE POLICY "schedules_update" ON schedules FOR UPDATE
    USING (auth.uid() = user_id OR is_super_admin(auth.uid()));
CREATE POLICY "schedules_delete" ON schedules FOR DELETE
    USING (auth.uid() = user_id OR is_super_admin(auth.uid()));

-- ACTIVITY LOG
DROP POLICY IF EXISTS activity_log_select ON activity_log;
DROP POLICY IF EXISTS activity_log_insert ON activity_log;

CREATE POLICY "activity_log_select" ON activity_log FOR SELECT
    USING (auth.uid() = user_id OR is_super_admin(auth.uid()));
CREATE POLICY "activity_log_insert" ON activity_log FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- REPORTS
DROP POLICY IF EXISTS reports_select ON reports;
DROP POLICY IF EXISTS reports_insert ON reports;
DROP POLICY IF EXISTS reports_update ON reports;
DROP POLICY IF EXISTS reports_delete ON reports;

CREATE POLICY "reports_select" ON reports FOR SELECT
    USING (auth.uid() = user_id OR is_super_admin(auth.uid()));
CREATE POLICY "reports_insert" ON reports FOR INSERT
    WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reports_update" ON reports FOR UPDATE
    USING (auth.uid() = user_id OR is_super_admin(auth.uid()));
CREATE POLICY "reports_delete" ON reports FOR DELETE
    USING (auth.uid() = user_id OR is_super_admin(auth.uid()));

-- INSIGHTS
DROP POLICY IF EXISTS insights_select ON insights;
DROP POLICY IF EXISTS insights_update ON insights;

CREATE POLICY "insights_select" ON insights FOR SELECT
    USING (auth.uid() = user_id OR is_super_admin(auth.uid()));
CREATE POLICY "insights_update" ON insights FOR UPDATE
    USING (auth.uid() = user_id OR is_super_admin(auth.uid()));

-- CHANNEL CONNECTIONS
DROP POLICY IF EXISTS channel_connections_select ON channel_connections;
DROP POLICY IF EXISTS channel_connections_insert ON channel_connections;
DROP POLICY IF EXISTS channel_connections_update ON channel_connections;
DROP POLICY IF EXISTS channel_connections_delete ON channel_connections;

CREATE POLICY "channel_connections_select" ON channel_connections FOR SELECT
    USING (auth.uid() = user_id OR is_super_admin(auth.uid()));
CREATE POLICY "channel_connections_insert" ON channel_connections FOR INSERT
    WITH CHECK (auth.uid() = user_id);
CREATE POLICY "channel_connections_update" ON channel_connections FOR UPDATE
    USING (auth.uid() = user_id OR is_super_admin(auth.uid()));
CREATE POLICY "channel_connections_delete" ON channel_connections FOR DELETE
    USING (auth.uid() = user_id OR is_super_admin(auth.uid()));

-- AI AGENTS
DROP POLICY IF EXISTS ai_agents_select ON ai_agents;
DROP POLICY IF EXISTS ai_agents_insert ON ai_agents;
DROP POLICY IF EXISTS ai_agents_update ON ai_agents;

CREATE POLICY "ai_agents_select" ON ai_agents FOR SELECT
    USING (auth.uid() = user_id OR is_super_admin(auth.uid()));
CREATE POLICY "ai_agents_insert" ON ai_agents FOR INSERT
    WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ai_agents_update" ON ai_agents FOR UPDATE
    USING (auth.uid() = user_id OR is_super_admin(auth.uid()));

-- AI CONVERSATIONS
DROP POLICY IF EXISTS ai_conversations_select ON ai_conversations;
DROP POLICY IF EXISTS ai_conversations_insert ON ai_conversations;
DROP POLICY IF EXISTS ai_conversations_update ON ai_conversations;

CREATE POLICY "ai_conversations_select" ON ai_conversations FOR SELECT
    USING (auth.uid() = user_id OR is_super_admin(auth.uid()));
CREATE POLICY "ai_conversations_insert" ON ai_conversations FOR INSERT
    WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ai_conversations_update" ON ai_conversations FOR UPDATE
    USING (auth.uid() = user_id OR is_super_admin(auth.uid()));

-- SETTINGS
DROP POLICY IF EXISTS settings_select ON settings;
DROP POLICY IF EXISTS settings_insert ON settings;
DROP POLICY IF EXISTS settings_update ON settings;

CREATE POLICY "settings_select" ON settings FOR SELECT
    USING (auth.uid() = user_id OR is_super_admin(auth.uid()));
CREATE POLICY "settings_insert" ON settings FOR INSERT
    WITH CHECK (auth.uid() = user_id);
CREATE POLICY "settings_update" ON settings FOR UPDATE
    USING (auth.uid() = user_id OR is_super_admin(auth.uid()));

-- AGENT STATUSES (no user_id — public read, authenticated write)
ALTER TABLE agent_statuses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS agent_statuses_select ON agent_statuses;
DROP POLICY IF EXISTS agent_statuses_insert ON agent_statuses;
DROP POLICY IF EXISTS agent_statuses_update ON agent_statuses;

CREATE POLICY "agent_statuses_select" ON agent_statuses FOR SELECT
    USING (TRUE);
CREATE POLICY "agent_statuses_insert" ON agent_statuses FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "agent_statuses_update" ON agent_statuses FOR UPDATE
    USING (auth.uid() IS NOT NULL);

-- CRON LOGS (no user_id — admin only via service role key)
ALTER TABLE cron_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cron_logs_select ON cron_logs;
DROP POLICY IF EXISTS cron_logs_insert ON cron_logs;
DROP POLICY IF EXISTS cron_logs_update ON cron_logs;

CREATE POLICY "cron_logs_select" ON cron_logs FOR SELECT
    USING (is_super_admin(auth.uid()));
CREATE POLICY "cron_logs_insert" ON cron_logs FOR INSERT
    WITH CHECK (is_super_admin(auth.uid()));
CREATE POLICY "cron_logs_update" ON cron_logs FOR UPDATE
    USING (is_super_admin(auth.uid()));

COMMIT;

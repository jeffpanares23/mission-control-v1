-- ============================================================
-- MISSION CONTROL V1 — MIGRATION 002
-- Row Level Security Policies
-- ============================================================

BEGIN;

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE anniversaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- ACCOUNTS
CREATE POLICY "accounts_select" ON accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "accounts_insert" ON accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "accounts_update" ON accounts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "accounts_delete" ON accounts FOR DELETE USING (auth.uid() = user_id);

-- TASKS
CREATE POLICY "tasks_select" ON tasks FOR SELECT USING (auth.uid() = user_id OR auth.uid() = assigned_to);
CREATE POLICY "tasks_insert" ON tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tasks_update" ON tasks FOR UPDATE USING (auth.uid() = user_id OR auth.uid() = assigned_to);
CREATE POLICY "tasks_delete" ON tasks FOR DELETE USING (auth.uid() = user_id);

-- ANNIVERSARIES
CREATE POLICY "anniversaries_select" ON anniversaries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "anniversaries_insert" ON anniversaries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "anniversaries_update" ON anniversaries FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "anniversaries_delete" ON anniversaries FOR DELETE USING (auth.uid() = user_id);

-- REMINDERS
CREATE POLICY "reminders_select" ON reminders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "reminders_insert" ON reminders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reminders_update" ON reminders FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "reminders_delete" ON reminders FOR DELETE USING (auth.uid() = user_id);

-- SCHEDULES
CREATE POLICY "schedules_select" ON schedules FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "schedules_insert" ON schedules FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "schedules_update" ON schedules FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "schedules_delete" ON schedules FOR DELETE USING (auth.uid() = user_id);

-- ACTIVITY LOG
CREATE POLICY "activity_log_select" ON activity_log FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "activity_log_insert" ON activity_log FOR INSERT WITH CHECK (auth.uid() = user_id);

-- REPORTS
CREATE POLICY "reports_select" ON reports FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "reports_insert" ON reports FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reports_update" ON reports FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "reports_delete" ON reports FOR DELETE USING (auth.uid() = user_id);

-- INSIGHTS
CREATE POLICY "insights_select" ON insights FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insights_update" ON insights FOR UPDATE USING (auth.uid() = user_id);

-- CHANNEL CONNECTIONS
CREATE POLICY "channel_connections_select" ON channel_connections FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "channel_connections_insert" ON channel_connections FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "channel_connections_update" ON channel_connections FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "channel_connections_delete" ON channel_connections FOR DELETE USING (auth.uid() = user_id);

-- AI AGENTS
CREATE POLICY "ai_agents_select" ON ai_agents FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ai_agents_insert" ON ai_agents FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ai_agents_update" ON ai_agents FOR UPDATE USING (auth.uid() = user_id);

-- AI CONVERSATIONS
CREATE POLICY "ai_conversations_select" ON ai_conversations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ai_conversations_insert" ON ai_conversations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ai_conversations_update" ON ai_conversations FOR UPDATE USING (auth.uid() = user_id);

-- SETTINGS
CREATE POLICY "settings_select" ON settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "settings_insert" ON settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "settings_update" ON settings FOR UPDATE USING (auth.uid() = user_id);

COMMIT;

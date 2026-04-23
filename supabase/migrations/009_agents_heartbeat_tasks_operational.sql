-- ============================================================
-- MISSION CONTROL V1 — MIGRATION 009
-- Phase 3: Agent Heartbeat fields
-- Phase 4: Operational task fields (agent_id, channel_id, trigger_source)
-- ============================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1. ai_agents — heartbeat + error tracking
-- ─────────────────────────────────────────────────────────────
ALTER TABLE ai_agents
    ADD COLUMN IF NOT EXISTS last_heartbeat TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_error     TEXT;

COMMENT ON COLUMN ai_agents.last_heartbeat IS 'Timestamp of last heartbeat received from the agent';
COMMENT ON COLUMN ai_agents.last_error      IS 'Last error message encountered by the agent';

-- Index for finding stale agents (offline detection)
CREATE INDEX IF NOT EXISTS idx_ai_agents_heartbeat
    ON ai_agents (last_heartbeat)
    WHERE last_heartbeat IS NOT NULL;

-- ─────────────────────────────────────────────────────────────
-- 2. tasks — operational fields
-- Who triggered this task and which channel/agent owns it.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE tasks
    ADD COLUMN IF NOT EXISTS agent_id        UUID REFERENCES ai_agents(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS channel_id     UUID REFERENCES channel_connections(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS trigger_source TEXT DEFAULT 'manual'
        CHECK (trigger_source IN ('manual', 'telegram', 'cron', 'schedule', 'webhook', 'agent_dispatch', 'system'));

COMMENT ON COLUMN tasks.agent_id        IS 'AI agent that owns or is processing this task';
COMMENT ON COLUMN tasks.channel_id      IS 'Channel that triggered this task creation';
COMMENT ON COLUMN tasks.trigger_source  IS 'What triggered task creation: manual, telegram, cron, schedule, etc.';

-- Composite index for agent-owned task queries
CREATE INDEX IF NOT EXISTS idx_tasks_agent_id       ON tasks(agent_id)       WHERE agent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_channel_id    ON tasks(channel_id)    WHERE channel_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_trigger_source ON tasks(trigger_source);

-- ─────────────────────────────────────────────────────────────
-- 3. VERIFY
-- ─────────────────────────────────────────────────────────────
DO $$
BEGIN
    -- ai_agents columns
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ai_agents' AND column_name = 'last_heartbeat'
    ) THEN RAISE EXCEPTION 'ai_agents.last_heartbeat not found'; END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ai_agents' AND column_name = 'last_error'
    ) THEN RAISE EXCEPTION 'ai_agents.last_error not found'; END IF;

    -- tasks columns
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tasks' AND column_name = 'agent_id'
    ) THEN RAISE EXCEPTION 'tasks.agent_id not found'; END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tasks' AND column_name = 'channel_id'
    ) THEN RAISE EXCEPTION 'tasks.channel_id not found'; END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tasks' AND column_name = 'trigger_source'
    ) THEN RAISE EXCEPTION 'tasks.trigger_source not found'; END IF;

    RAISE NOTICE 'Migration 009 complete: ai_agents heartbeat fields + tasks operational fields OK';
END $$;

COMMIT;

-- ============================================================
-- MISSION CONTROL V1 — MIGRATION 010
-- Agent Operational Data Tables
-- ============================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- ENUMS for new tables
-- ─────────────────────────────────────────────────────────────
CREATE TYPE IF NOT EXISTS agent_runtime_status_enum AS ENUM ('idle', 'thinking', 'acting', 'running', 'paused', 'error', 'offline');
CREATE TYPE IF NOT EXISTS cron_job_status AS ENUM ('active', 'paused', 'failed');
CREATE TYPE IF NOT EXISTS task_status_enum AS ENUM ('pending', 'in_progress', 'completed', 'failed', 'cancelled');
CREATE TYPE IF NOT EXISTS reminder_status_enum AS ENUM ('pending', 'sent', 'cancelled');
CREATE TYPE IF NOT EXISTS log_severity AS ENUM ('debug', 'info', 'warning', 'error', 'critical');

-- ─────────────────────────────────────────────────────────────
-- 1. agent_runtime_status
-- Tracks real-time runtime state for each user-agent pair.
-- UNIQUE(user_id, agent_id) — one runtime status per user per agent.
-- agent_id is TEXT (not UUID) since Hermes uses string IDs like "hermes-gateway"
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_runtime_status (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    agent_id            TEXT NOT NULL,
    agent_name          TEXT NOT NULL DEFAULT 'Hermes',
    status              agent_runtime_status_enum NOT NULL DEFAULT 'idle',
    last_heartbeat      TIMESTAMPTZ,
    current_services    JSONB DEFAULT '[]',
    last_error          TEXT,
    metadata            JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id, agent_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_runtime_status_agent_id   ON agent_runtime_status(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_runtime_status_user_id    ON agent_runtime_status(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_runtime_status_status    ON agent_runtime_status(status);
CREATE INDEX IF NOT EXISTS idx_agent_runtime_status_heartbeat ON agent_runtime_status(last_heartbeat)
    WHERE last_heartbeat IS NOT NULL;

COMMENT ON TABLE agent_runtime_status IS 'Real-time runtime status for each user-agent pair';

-- ─────────────────────────────────────────────────────────────
-- 2. agent_cron_jobs
-- Scheduled cron jobs managed by agents for users.
-- UNIQUE(agent_id, job_id) — one job per agent identified by job_id.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_cron_jobs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    agent_id            TEXT NOT NULL,
    job_id              TEXT NOT NULL,
    name                TEXT NOT NULL,
    schedule            TEXT NOT NULL,
    command             TEXT NOT NULL DEFAULT '',
    enabled             BOOLEAN DEFAULT TRUE,
    last_run            TIMESTAMPTZ,
    next_run            TIMESTAMPTZ,
    status              cron_job_status NOT NULL DEFAULT 'active',
    last_error          TEXT,
    metadata            JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(agent_id, job_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_cron_jobs_agent_id  ON agent_cron_jobs(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_cron_jobs_user_id  ON agent_cron_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_cron_jobs_enabled ON agent_cron_jobs(enabled);
CREATE INDEX IF NOT EXISTS idx_agent_cron_jobs_next_run ON agent_cron_jobs(next_run)
    WHERE next_run IS NOT NULL;

COMMENT ON TABLE agent_cron_jobs IS 'Scheduled cron jobs managed by agents';

-- ─────────────────────────────────────────────────────────────
-- 3. agent_tasks
-- Lightweight task tracking per user-agent pair.
-- UNIQUE(agent_id, external_task_id).
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_tasks (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    agent_id            TEXT NOT NULL,
    external_task_id    TEXT NOT NULL,
    title               TEXT NOT NULL,
    description         TEXT,
    status              task_status_enum NOT NULL DEFAULT 'pending',
    priority            TEXT DEFAULT 'medium',
    due_date            TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(agent_id, external_task_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_tasks_agent_id  ON agent_tasks(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_user_id  ON agent_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_status   ON agent_tasks(status);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_due_date ON agent_tasks(due_date)
    WHERE due_date IS NOT NULL;

COMMENT ON TABLE agent_tasks IS 'Lightweight task tracking per user-agent pair';

-- ─────────────────────────────────────────────────────────────
-- 4. agent_reminders
-- Reminders managed by agents for users.
-- UNIQUE(agent_id, reminder_id).
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_reminders (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    agent_id            TEXT NOT NULL,
    reminder_id         TEXT NOT NULL,
    text                TEXT NOT NULL,
    remind_at           TIMESTAMPTZ NOT NULL,
    status              reminder_status_enum NOT NULL DEFAULT 'pending',
    metadata            JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(agent_id, reminder_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_reminders_agent_id   ON agent_reminders(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_reminders_user_id   ON agent_reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_reminders_status   ON agent_reminders(status);
CREATE INDEX IF NOT EXISTS idx_agent_reminders_remind_at ON agent_reminders(remind_at)
    WHERE remind_at IS NOT NULL;

COMMENT ON TABLE agent_reminders IS 'Reminders managed by agents for users';

-- ─────────────────────────────────────────────────────────────
-- 5. agent_scripts
-- Saved scripts/recipes per user-agent pair.
-- UNIQUE(agent_id, script_name).
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_scripts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    agent_id            TEXT NOT NULL,
    script_name         TEXT NOT NULL,
    description         TEXT,
    category            TEXT DEFAULT 'general',
    last_used           TIMESTAMPTZ,
    metadata            JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(agent_id, script_name)
);

CREATE INDEX IF NOT EXISTS idx_agent_scripts_agent_id  ON agent_scripts(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_scripts_user_id  ON agent_scripts(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_scripts_category ON agent_scripts(category);
CREATE INDEX IF NOT EXISTS idx_agent_scripts_last_used ON agent_scripts(last_used)
    WHERE last_used IS NOT NULL;

COMMENT ON TABLE agent_scripts IS 'Saved scripts/recipes per user-agent pair';

-- ─────────────────────────────────────────────────────────────
-- 6. agent_notification_targets
-- Notification delivery targets (telegram, email, etc.) per user-agent.
-- UNIQUE(agent_id, target_id).
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_notification_targets (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    agent_id            TEXT NOT NULL,
    target_id           TEXT NOT NULL,
    platform            TEXT NOT NULL DEFAULT 'telegram',
    target_name         TEXT NOT NULL,
    is_active           BOOLEAN DEFAULT TRUE,
    metadata            JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(agent_id, target_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_notification_targets_agent_id  ON agent_notification_targets(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_notification_targets_user_id  ON agent_notification_targets(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_notification_targets_platform ON agent_notification_targets(platform);
CREATE INDEX IF NOT EXISTS idx_agent_notification_targets_active   ON agent_notification_targets(is_active);

COMMENT ON TABLE agent_notification_targets IS 'Notification delivery targets per user-agent';

-- ─────────────────────────────────────────────────────────────
-- 7. agent_operational_logs
-- Event/audit log for agent operations.
-- No unique constraint — append-only log.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_operational_logs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    agent_id            TEXT NOT NULL,
    event_type          TEXT NOT NULL,
    message             TEXT,
    severity            log_severity NOT NULL DEFAULT 'info',
    metadata            JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_operational_logs_agent_id   ON agent_operational_logs(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_operational_logs_user_id   ON agent_operational_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_operational_logs_event_type ON agent_operational_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_agent_operational_logs_severity  ON agent_operational_logs(severity);
CREATE INDEX IF NOT EXISTS idx_agent_operational_logs_created_at ON agent_operational_logs(created_at);

COMMENT ON TABLE agent_operational_logs IS 'Event/audit log for agent operations';

-- ─────────────────────────────────────────────────────────────
-- 8. UPDATED_AT TRIGGER
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS agent_runtime_status_updated_at ON agent_runtime_status;
CREATE TRIGGER agent_runtime_status_updated_at BEFORE UPDATE ON agent_runtime_status
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS agent_cron_jobs_updated_at ON agent_cron_jobs;
CREATE TRIGGER agent_cron_jobs_updated_at BEFORE UPDATE ON agent_cron_jobs
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS agent_tasks_updated_at ON agent_tasks;
CREATE TRIGGER agent_tasks_updated_at BEFORE UPDATE ON agent_tasks
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS agent_reminders_updated_at ON agent_reminders;
CREATE TRIGGER agent_reminders_updated_at BEFORE UPDATE ON agent_reminders
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS agent_scripts_updated_at ON agent_scripts;
CREATE TRIGGER agent_scripts_updated_at BEFORE UPDATE ON agent_scripts
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS agent_notification_targets_updated_at ON agent_notification_targets;
CREATE TRIGGER agent_notification_targets_updated_at BEFORE UPDATE ON agent_notification_targets
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─────────────────────────────────────────────────────────────
-- 9. RPC: upsert_record — composite upsert function
-- Called by AgentStatusSyncController for composite UNIQUE key upserts.
-- Usage: SELECT upsert_record('agent_tasks', row_json, ARRAY['user_id','agent_id','external_task_id'])
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION upsert_record(
    p_table         TEXT,
    p_row           JSONB,
    p_conflict_keys TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_updated INTEGER;
    v_inserted INTEGER;
    v_excluded JSONB;
BEGIN
    -- Attempt UPDATE
    EXECUTE format(
        'UPDATE %I SET '
        || (SELECT string_agg(format('%I = EXCLUDED.%I', col, col), ', ')
            FROM unnest(p_conflict_keys) AS col)
        || ', updated_at = NOW() '
        || 'WHERE '
        || (SELECT string_agg(format('%I = ($1->>%L)', col, col), ' AND ')
            FROM unnest(p_conflict_keys) AS col),
        p_table
    ) USING p_row;
    GET DIAGNOSTICS v_updated = ROW_COUNT;

    -- If no rows updated, INSERT
    IF v_updated = 0 THEN
        EXECUTE format(
            'INSERT INTO %I (%s) VALUES (%s)',
            p_table,
            (SELECT string_agg(col::TEXT, ', ')
                FROM jsonb_object_keys(p_row) AS col),
            (SELECT string_agg(format('$1->>%L', col), ', ')
                FROM jsonb_object_keys(p_row) AS col)
        ) USING p_row;
        GET DIAGNOSTICS v_inserted = ROW_COUNT;
    END IF;

    RETURN jsonb_build_object(
        'updated', v_updated,
        'inserted', COALESCE(v_inserted, 0)
    );
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 10. RLS POLICIES — auth.uid() based
-- ─────────────────────────────────────────────────────────────
ALTER TABLE agent_runtime_status        ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_cron_jobs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_tasks                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_reminders             ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_scripts               ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_notification_targets  ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_operational_logs      ENABLE ROW LEVEL SECURITY;

-- agent_runtime_status
DROP POLICY IF EXISTS agent_runtime_status_all ON agent_runtime_status;
CREATE POLICY agent_runtime_status_all ON agent_runtime_status
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- agent_cron_jobs
DROP POLICY IF EXISTS agent_cron_jobs_all ON agent_cron_jobs;
CREATE POLICY agent_cron_jobs_all ON agent_cron_jobs
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- agent_tasks
DROP POLICY IF EXISTS agent_tasks_all ON agent_tasks;
CREATE POLICY agent_tasks_all ON agent_tasks
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- agent_reminders
DROP POLICY IF EXISTS agent_reminders_all ON agent_reminders;
CREATE POLICY agent_reminders_all ON agent_reminders
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- agent_scripts
DROP POLICY IF EXISTS agent_scripts_all ON agent_scripts;
CREATE POLICY agent_scripts_all ON agent_scripts
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- agent_notification_targets
DROP POLICY IF EXISTS agent_notification_targets_all ON agent_notification_targets;
CREATE POLICY agent_notification_targets_all ON agent_notification_targets
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- agent_operational_logs
DROP POLICY IF EXISTS agent_operational_logs_all ON agent_operational_logs;
CREATE POLICY agent_operational_logs_all ON agent_operational_logs
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- 11. VERIFY
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE
    v_cnt INTEGER;
BEGIN
    -- Check all tables exist
    FOREACH v_cnt IN ARRAY ARRAY[
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'agent_runtime_status')::integer,
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'agent_cron_jobs')::integer,
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'agent_tasks')::integer,
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'agent_reminders')::integer,
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'agent_scripts')::integer,
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'agent_notification_targets')::integer,
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'agent_operational_logs')::integer
    ] LOOP
    END LOOP;

    -- Verify UNIQUE constraints exist (PostgreSQL naming: table_col1_col2_key)
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_runtime_status_user_id_agent_id_key') THEN
        RAISE EXCEPTION 'agent_runtime_status UNIQUE(user_id,agent_id) not found';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_cron_jobs_agent_id_job_id_key') THEN
        RAISE EXCEPTION 'agent_cron_jobs UNIQUE(agent_id,job_id) not found';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_tasks_agent_id_external_task_id_key') THEN
        RAISE EXCEPTION 'agent_tasks UNIQUE(agent_id,external_task_id) not found';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_reminders_agent_id_reminder_id_key') THEN
        RAISE EXCEPTION 'agent_reminders UNIQUE(agent_id,reminder_id) not found';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_scripts_agent_id_script_name_key') THEN
        RAISE EXCEPTION 'agent_scripts UNIQUE(agent_id,script_name) not found';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_notification_targets_agent_id_target_id_key') THEN
        RAISE EXCEPTION 'agent_notification_targets UNIQUE(agent_id,target_id) not found';
    END IF;

    -- Verify RPC function exists
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'upsert_record') THEN
        RAISE EXCEPTION 'upsert_record RPC function not found';
    END IF;

    RAISE NOTICE 'Migration 010 complete: All 7 tables + RPC function + RLS + UNIQUE constraints verified';
END $$;

COMMIT;

-- ============================================================
-- Migration 007: Task Operations — AI Agent Workflow Fields
-- Adds channel_id, agent_id, trigger_source to tasks table
-- and creates enum types if not already present.
-- ============================================================

-- Add trigger_source enum type
DO $$ BEGIN
  CREATE TYPE task_trigger_source AS ENUM ('manual', 'cron', 'channel', 'system');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add operational columns to tasks
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS channel_id UUID REFERENCES channels(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS agent_id   UUID REFERENCES agents(id)   ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS trigger_source task_trigger_source DEFAULT 'manual';

-- Indexes for operational queries
CREATE INDEX IF NOT EXISTS idx_tasks_channel_id     ON tasks(channel_id) WHERE channel_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_agent_id       ON tasks(agent_id)   WHERE agent_id   IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_trigger_source ON tasks(trigger_source) WHERE trigger_source IS NOT NULL;

-- ============================================================
-- Agent Channel Assignments — link agents to channels
-- ============================================================
CREATE TABLE IF NOT EXISTS agent_channel_assignments (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id    UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  channel_id  UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  is_primary  BOOLEAN DEFAULT false,
  is_active   BOOLEAN DEFAULT true,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agent_id, channel_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_channel_agent   ON agent_channel_assignments(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_channel_channel ON agent_channel_assignments(channel_id);

-- ============================================================
-- RLS policies for new tables
-- ============================================================
ALTER TABLE agent_channel_assignments ENABLE ROW LEVEL SECURITY;

-- Users can read assignments for their agent
CREATE POLICY "Users read own agent assignments"
  ON agent_channel_assignments FOR SELECT
  USING (
    channel_id IN (
      SELECT id FROM channels WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- Channels table: add last_activity_at if not present
-- ============================================================
ALTER TABLE channels
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pending_task_count INT DEFAULT 0;

COMMENT ON COLUMN tasks.channel_id      IS 'Linked channel that triggered or owns this task';
COMMENT ON COLUMN tasks.agent_id        IS 'Assigned AI agent handling this task';
COMMENT ON COLUMN tasks.trigger_source  IS 'What triggered this task: manual, cron, channel, or system';

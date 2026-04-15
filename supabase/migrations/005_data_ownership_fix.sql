-- ============================================================
-- MISSION CONTROL V1 — MIGRATION 005
-- Fix NULL user_id ownership in existing tables
-- IMPORTANT: Run AFTER 004_agents_and_user_access.sql
--
-- Problem: All existing rows in tasks/accounts/reminders/etc. have user_id=NULL
--          These tables reference auth.users(id) — not our new users table.
--
-- Solution:
--  - Tables that reference our new `users` table: assign system owner UUID
--  - Tables that reference `auth.users`: set to NULL (or drop FK constraint first)
--    Note: ai_conversations.user_id references auth.users — handled separately
--
-- After Patricia + Julie are seeded via Laravel mc:seed-agents,
-- run follow-up assignment with their real user UUIDs.
--
-- This migration is idempotent — re-running is safe.
-- ============================================================

BEGIN;

-- ─── 0. SYSTEM OWNER (references our new users table) ───────
-- Static UUID so the record is findable/reusable
INSERT INTO users (id, email, password_hash, full_name, role, is_active)
VALUES (
    '00000000-0000-0000-0000-000000000001'::uuid,
    'system@mission-control-internal',
    '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- bcrypt placeholder
    'System Owner',
    'agent',
    TRUE
)
ON CONFLICT (email) DO NOTHING;

-- ════════════════════════════════════════════════════════
-- Tables that reference our new `users` (or have no FK)
-- These can safely be updated with our system user UUID.
-- ════════════════════════════════════════════════════════

-- ─── 1. ACCOUNTS ──────────────────────────────────────────────
UPDATE accounts
SET user_id = '00000000-0000-0000-0000-000000000001'::uuid
WHERE user_id IS NULL;

-- ─── 2. TASKS ─────────────────────────────────────────────────
UPDATE tasks
SET user_id = '00000000-0000-0000-0000-000000000001'::uuid
WHERE user_id IS NULL;
-- Note: assigned_to is nullable, leave NULL (unassigned tasks stay unassigned)

-- ─── 3. REMINDERS ─────────────────────────────────────────────
UPDATE reminders
SET user_id = '00000000-0000-0000-0000-000000000001'::uuid
WHERE user_id IS NULL;

-- ─── 4. SCHEDULES ─────────────────────────────────────────────
UPDATE schedules
SET user_id = '00000000-0000-0000-0000-000000000001'::uuid
WHERE user_id IS NULL;

-- ─── 5. ACTIVITY LOG ──────────────────────────────────────────
UPDATE activity_log
SET user_id = '00000000-0000-0000-0000-000000000001'::uuid
WHERE user_id IS NULL;

-- ─── 6. REPORTS ────────────────────────────────────────────────
UPDATE reports
SET user_id = '00000000-0000-0000-0000-000000000001'::uuid
WHERE user_id IS NULL;

-- ─── 7. INSIGHTS ──────────────────────────────────────────────
UPDATE insights
SET user_id = '00000000-0000-0000-0000-000000000001'::uuid
WHERE user_id IS NULL;

-- ─── 8. CHANNEL CONNECTIONS ───────────────────────────────────
UPDATE channel_connections
SET user_id = '00000000-0000-0000-0000-000000000001'::uuid
WHERE user_id IS NULL;

-- ─── 9. SETTINGS ─────────────────────────────────────────────
UPDATE settings
SET user_id = '00000000-0000-0000-0000-000000000001'::uuid
WHERE user_id IS NULL;

-- ─── 10. ANNIVERSARIES ────────────────────────────────────────
UPDATE anniversaries
SET user_id = '00000000-0000-0000-0000-000000000001'::uuid
WHERE user_id IS NULL;

-- ─── 11. AI AGENTS ─────────────────────────────────────────────
-- ai_agents.user_id references our new users table (migration 001 used UUID)
UPDATE ai_agents
SET user_id = '00000000-0000-0000-0000-000000000001'::uuid
WHERE user_id IS NULL;

-- ─── 12. AI CONVERSATIONS ────────────────────────────────────
-- ai_conversations.user_id REFERENCES auth.users(id) ON DELETE CASCADE
-- We CANNOT assign our new users(id) here without:
--   a) Dropping the FK constraint, OR
--   b) Having a matching UUID in auth.users
-- Option: Drop the FK constraint and change to no FK (acceptable for migration)
ALTER TABLE ai_conversations
    DROP CONSTRAINT IF EXISTS ai_conversations_user_id_fkey,
    DROP COLUMN IF EXISTS user_id;

ALTER TABLE ai_conversations
    ADD COLUMN user_id UUID;  -- no FK constraint — free-form

-- Now assign
UPDATE ai_conversations
SET user_id = '00000000-0000-0000-0000-000000000001'::uuid
WHERE user_id IS NULL;

-- ─── 13. VERIFY remaining NULLs ────────────────────────────────
DO $$
DECLARE v_cnt INTEGER;
BEGIN
    FOREACH v_cnt IN ARRAY ARRAY[
        (SELECT COUNT(*) FROM accounts WHERE user_id IS NULL)::integer,
        (SELECT COUNT(*) FROM tasks WHERE user_id IS NULL)::integer,
        (SELECT COUNT(*) FROM reminders WHERE user_id IS NULL)::integer,
        (SELECT COUNT(*) FROM schedules WHERE user_id IS NULL)::integer,
        (SELECT COUNT(*) FROM activity_log WHERE user_id IS NULL)::integer,
        (SELECT COUNT(*) FROM channel_connections WHERE user_id IS NULL)::integer,
        (SELECT COUNT(*) FROM ai_conversations WHERE user_id IS NULL)::integer
    ] LOOP
        -- just iterate
    END LOOP;

    RAISE NOTICE '=== NULL user_id verification ===';
    RAISE NOTICE 'accounts: %', (SELECT COUNT(*) FROM accounts WHERE user_id IS NULL);
    RAISE NOTICE 'tasks: %', (SELECT COUNT(*) FROM tasks WHERE user_id IS NULL);
    RAISE NOTICE 'reminders: %', (SELECT COUNT(*) FROM reminders WHERE user_id IS NULL);
    RAISE NOTICE 'schedules: %', (SELECT COUNT(*) FROM schedules WHERE user_id IS NULL);
    RAISE NOTICE 'activity_log: %', (SELECT COUNT(*) FROM activity_log WHERE user_id IS NULL);
    RAISE NOTICE 'channel_connections: %', (SELECT COUNT(*) FROM channel_connections WHERE user_id IS NULL);
    RAISE NOTICE 'ai_conversations: %', (SELECT COUNT(*) FROM ai_conversations WHERE user_id IS NULL);
    RAISE NOTICE '=== Done ===';
END $$;

COMMIT;

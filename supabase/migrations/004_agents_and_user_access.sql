-- ============================================================
-- MISSION CONTROL V1 — MIGRATION 004
-- Agents + User-Agent Access + Central Users + Sessions
-- Replaces profiles-based auth with flat user store
-- Run AFTER: 001_initial_schema.sql, 002_rls_policies.sql
-- SKIP: 003_auth_and_rbac.sql (superseded by this migration)
-- ============================================================

BEGIN;

-- ─── 1. CENTRAL USERS TABLE ─────────────────────────────────
-- Own user store (bypasses Supabase Auth dependency for app-level auth)
CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           TEXT UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,
    full_name       TEXT NOT NULL DEFAULT '',
    role            TEXT NOT NULL DEFAULT 'agent'
                    CHECK (role IN ('super_admin', 'agent')),
    is_active       BOOLEAN DEFAULT TRUE,
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

-- ─── 2. AGENTS TABLE ────────────────────────────────────────
-- Each row = one external Supabase project (one AI agent's DB)
CREATE TABLE IF NOT EXISTS agents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug            TEXT UNIQUE NOT NULL,          -- 'patricia', 'ashley'
    name            TEXT NOT NULL,                  -- display name
    supabase_url    TEXT NOT NULL,
    supabase_key    TEXT NOT NULL,                  -- service role key for this agent's DB
    anon_key        TEXT NOT NULL,                  -- anon key for agent's DB
    db_password     TEXT,                           -- postgres password for this agent's DB
    is_active       BOOLEAN DEFAULT TRUE,
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agents_slug ON agents(slug);
CREATE INDEX IF NOT EXISTS idx_agents_is_active ON agents(is_active);

-- ─── 3. USER_AGENT_ACCESS ───────────────────────────────────
-- Many-to-many: users ↔ agents. is_active=true = current session scope.
CREATE TABLE IF NOT EXISTS user_agent_access (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    agent_id    UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    is_active   BOOLEAN DEFAULT FALSE,   -- which agent is currently scoped for this user
    can_admin   BOOLEAN DEFAULT FALSE,   -- user can manage this agent's settings
    created_at  TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id, agent_id)
);

CREATE INDEX IF NOT EXISTS idx_uaa_user_id ON user_agent_access(user_id);
CREATE INDEX IF NOT EXISTS idx_uaa_agent_id ON user_agent_access(agent_id);

-- ─── 4. USER SESSIONS TABLE ─────────────────────────────────
-- Tracks issued JWTs for session validation + expiry
CREATE TABLE IF NOT EXISTS user_sessions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  TEXT UNIQUE NOT NULL,   -- SHA-256 of the issued JWT
    ip_address  TEXT,
    user_agent  TEXT,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_usessions_token_hash ON user_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_usessions_expires_at ON user_sessions(expires_at);

-- ─── 5. HELPER FUNCTIONS ────────────────────────────────────

-- Get the active agent config for a user
CREATE OR REPLACE FUNCTION get_active_agent(p_user_id UUID)
RETURNS agents AS $$
    SELECT a.*
    FROM agents a
    JOIN user_agent_access uaa ON uaa.agent_id = a.id
    WHERE uaa.user_id = p_user_id
      AND uaa.is_active = TRUE
      AND a.is_active = TRUE
    LIMIT 1;
$$ LANGUAGE sql STABLE;

-- List all agents a user has access to
CREATE OR REPLACE FUNCTION get_user_agents(p_user_id UUID)
RETURNS TABLE(
    agent_id   UUID,
    slug       TEXT,
    name       TEXT,
    is_active  BOOLEAN,
    can_admin  BOOLEAN
) AS $$
    SELECT a.id, a.slug, a.name, uaa.is_active, uaa.can_admin
    FROM agents a
    JOIN user_agent_access uaa ON uaa.agent_id = a.id
    WHERE uaa.user_id = p_user_id AND a.is_active = TRUE
    ORDER BY uaa.is_active DESC, a.name ASC;
$$ LANGUAGE sql STABLE;

-- ─── 6. UPDATED_AT TRIGGER ──────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_updated_at ON users;
CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS agents_updated_at ON agents;
CREATE TRIGGER agents_updated_at BEFORE UPDATE ON agents
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── 7. RLS ON NEW TABLES ───────────────────────────────────
-- Central users/agents tables: service role only (Laravel uses service role key)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_agent_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- All policies: service role key bypasses RLS entirely
-- No user-facing RLS needed on central auth tables
DROP POLICY IF EXISTS users_all ON users;
CREATE POLICY users_all ON users FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS agents_all ON agents;
CREATE POLICY agents_all ON agents FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS user_agent_access_all ON user_agent_access;
CREATE POLICY user_agent_access_all ON user_agent_access FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS user_sessions_all ON user_sessions;
CREATE POLICY user_sessions_all ON user_sessions FOR ALL USING (true) WITH CHECK (true);

-- ─── 8. MIGRATION 003 CLEANUP ────────────────────────────────
-- Migration 003 created the `profiles` table which is now superseded.
-- Drop it to avoid confusion. Laravel uses `users` table instead.
-- If 003 was never run this is a no-op.
DROP TABLE IF EXISTS profiles CASCADE;

COMMIT;

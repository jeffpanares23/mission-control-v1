-- ============================================================
-- MISSION CONTROL V1 — MIGRATION 008
-- Telegram Long Polling Infrastructure
--
-- Adds tables and columns to support Telegram bot long-polling
-- as an alternative to webhook-based updates.
--
-- Tables created:
--   - telegram_bot_configs       — per-channel Telegram bot settings
--   - telegram_polling_sessions  — active polling session state per connection
--
-- Columns added to existing tables:
--   - channel_connections.polling_enabled
--   - channel_connections.polling_offset
--   - channel_connections.last_polled_at
--
-- Prerequisites: 005_data_ownership_fix.sql (or any prior migration)
-- Idempotent — re-running is safe.
-- ============================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1. TELEGRAM BOT CONFIGS
-- Stores per-channel Telegram bot settings not covered by the
-- generic channel_connections record.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS telegram_bot_configs (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_connection_id UUID  NOT NULL REFERENCES channel_connections(id)
                                            ON DELETE CASCADE,

    -- Polling behaviour
    polling_enabled         BOOLEAN NOT NULL DEFAULT FALSE,
    polling_offset          BIGINT  NOT NULL DEFAULT 0,      -- last processed update_id + 1
    polling_timeout_secs    INTEGER NOT NULL DEFAULT 55,     -- long polling timeout (Telegram max 50s)
    polling_allowed_updates JSONB   NOT NULL DEFAULT '["message","edited_message","callback_query"]',

    -- Session management
    session_status         TEXT    NOT NULL DEFAULT 'idle',  -- idle | running | paused | error
    session_error          TEXT,                               -- last error message
    consecutive_errors     INTEGER NOT NULL DEFAULT 0,
    max_consecutive_errors INTEGER NOT NULL DEFAULT 10,

    -- Last-activity tracking
    last_poll_started_at   TIMESTAMPTZ,
    last_poll_completed_at  TIMESTAMPTZ,
    last_update_id         BIGINT,
    updates_processed      BIGINT  NOT NULL DEFAULT 0,
    updates_failed         BIGINT  NOT NULL DEFAULT 0,

    -- Rate-limiting helpers
    messages_per_second     NUMERIC(5,2) NOT NULL DEFAULT 0,
    total_api_calls        BIGINT  NOT NULL DEFAULT 0,

    -- Metadata
    metadata               JSONB   NOT NULL DEFAULT '{}',
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- One bot config per channel connection
    UNIQUE (channel_connection_id)
);

-- Index for fast lookups by session status
CREATE INDEX IF NOT EXISTS idx_telegram_bot_configs_session_status
    ON telegram_bot_configs (session_status);

-- Index for polling offset tracking
CREATE INDEX IF NOT EXISTS idx_telegram_bot_configs_polling_offset
    ON telegram_bot_configs (polling_offset);

-- ─────────────────────────────────────────────────────────────
-- 2. TELEGRAM POLLING SESSIONS
-- Active per-process polling session state.
-- One row per running poller; supports multi-worker designs.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS telegram_polling_sessions (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_bot_config_id UUID     NOT NULL REFERENCES telegram_bot_configs(id)
                                           ON DELETE CASCADE,

    -- Worker identity (hostname + PID for debugging)
    worker_id           TEXT        NOT NULL,  -- e.g. hostname:pid
    worker_started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    worker heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Polling state
    offset              BIGINT      NOT NULL DEFAULT 0,
    is_active           BOOLEAN     NOT NULL DEFAULT TRUE,

    -- Session result of last poll cycle
    last_poll_at        TIMESTAMPTZ,
    last_poll_duration_ms INTEGER,
    last_poll_updates_count INTEGER,
    last_poll_error     TEXT,

    -- Graceful shutdown support
    shutdown_requested  BOOLEAN     NOT NULL DEFAULT FALSE,
    shutdown_at         TIMESTAMPTZ,

    -- Counters
    total_cycles        BIGINT      NOT NULL DEFAULT 0,
    total_updates       BIGINT      NOT NULL DEFAULT 0,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Only one active session per bot config per worker
    UNIQUE (telegram_bot_config_id, worker_id)
);

-- Index for heartbeat queries (find stale sessions)
CREATE INDEX IF NOT EXISTS idx_telegram_polling_sessions_heartbeat
    ON telegram_polling_sessions (worker_heartbeat_at);

-- Index for active session lookups
CREATE INDEX IF NOT EXISTS idx_telegram_polling_sessions_active
    ON telegram_polling_sessions (is_active) WHERE is_active = TRUE;

-- ─────────────────────────────────────────────────────────────
-- 3. CHANNEL_CONNECTIONS — polling columns
-- ─────────────────────────────────────────────────────────────
ALTER TABLE channel_connections
    ADD COLUMN IF NOT EXISTS polling_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS polling_offset   BIGINT  NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_polled_at   TIMESTAMPTZ;

COMMENT ON COLUMN channel_connections.polling_enabled IS 'Set true to start long-polling for this Telegram connection';
COMMENT ON COLUMN channel_connections.polling_offset   IS 'Next update_id to fetch (last processed + 1)';
COMMENT ON COLUMN channel_connections.last_polled_at   IS 'Timestamp of most recent successful poll completion';

-- ─────────────────────────────────────────────────────────────
-- 4. AUTO-UPDATE updated_at on telegram_bot_configs
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_telegram_bot_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_telegram_bot_configs_updated_at ON telegram_bot_configs;
CREATE TRIGGER trigger_telegram_bot_configs_updated_at
    BEFORE UPDATE ON telegram_bot_configs
    FOR EACH ROW EXECUTE FUNCTION update_telegram_bot_configs_updated_at();

-- ─────────────────────────────────────────────────────────────
-- 5. AUTO-UPDATE updated_at on telegram_polling_sessions
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_telegram_polling_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_telegram_polling_sessions_updated_at ON telegram_polling_sessions;
CREATE TRIGGER trigger_telegram_polling_sessions_updated_at
    BEFORE UPDATE ON telegram_polling_sessions
    FOR EACH ROW EXECUTE FUNCTION update_telegram_polling_sessions_updated_at();

-- ─────────────────────────────────────────────────────────────
-- 6. VERIFY
-- ─────────────────────────────────────────────────────────────
DO $$
BEGIN
    RAISE NOTICE '=== Migration 008 verification ===';

    -- Tables exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'telegram_bot_configs'
    ) THEN RAISE EXCEPTION 'telegram_bot_configs not found';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'telegram_polling_sessions'
    ) THEN RAISE EXCEPTION 'telegram_polling_sessions not found';
    END IF;

    -- Columns added
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'channel_connections' AND column_name = 'polling_enabled'
    ) THEN RAISE EXCEPTION 'channel_connections.polling_enabled not found';
    END IF;

    RAISE NOTICE 'telegram_bot_configs columns: %',
        (SELECT COUNT(*) FROM information_schema.columns
         WHERE table_name = 'telegram_bot_configs');

    RAISE NOTICE 'telegram_polling_sessions columns: %',
        (SELECT COUNT(*) FROM information_schema.columns
         WHERE table_name = 'telegram_polling_sessions');

    RAISE NOTICE 'channel_connections new columns: polling_enabled=%, polling_offset=%, last_polled_at=%',
        (SELECT COUNT(*) FROM information_schema.columns
         WHERE table_name = 'channel_connections' AND column_name = 'polling_enabled'),
        (SELECT COUNT(*) FROM information_schema.columns
         WHERE table_name = 'channel_connections' AND column_name = 'polling_offset'),
        (SELECT COUNT(*) FROM information_schema.columns
         WHERE table_name = 'channel_connections' AND column_name = 'last_polled_at');

    RAISE NOTICE '=== Migration 008 complete ===';
END $$;

COMMIT;
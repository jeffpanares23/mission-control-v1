-- ============================================================
-- MISSION CONTROL V1 — MIGRATION 006
-- Telegram OAuth: add telegram_user_id to users table
-- ============================================================

BEGIN;

-- Add telegram_user_id column for Telegram OAuth linking
ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_user_id BIGINT UNIQUE;

-- Index for fast lookup during Telegram login
CREATE INDEX IF NOT EXISTS idx_users_telegram_user_id ON users(telegram_user_id);

COMMIT;

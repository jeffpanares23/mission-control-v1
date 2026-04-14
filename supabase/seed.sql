-- ============================================================
-- MISSION CONTROL V1 — SEED DATA
-- For development only
-- ============================================================

BEGIN;

DO $$
DECLARE
    dev_user_id UUID := '00000000-0000-0000-0000-000000000001';
    dev_agent_id UUID := '00000000-0000-0000-0000-000000000002';
    acct1 UUID := uuid_generate_v4();
    acct2 UUID := uuid_generate_v4();
    acct3 UUID := uuid_generate_v4();
BEGIN

    -- AI AGENT
    INSERT INTO ai_agents (id, user_id, name, status, model, is_active, stats)
    VALUES (dev_agent_id, dev_user_id, 'Hermes', 'idle', 'mini-max-m2.7', TRUE,
        '{"tasks_dispatched": 12, "insights_generated": 34, "conversations_handled": 56}');

    -- ACCOUNTS
    INSERT INTO accounts (id, user_id, name, email, company, channel, tags) VALUES
    (acct1, dev_user_id, 'Acme Corp', 'contact@acme.com', 'Acme Corporation', 'telegram', ARRAY['enterprise', 'priority']),
    (acct2, dev_user_id, 'Globex Inc', 'info@globex.io', 'Globex Inc', 'discord', ARRAY['startup']),
    (acct3, dev_user_id, 'Initech', 'support@initech.com', 'Initech LLC', 'whatsapp', ARRAY['smb']);

    -- TASKS (spread across all Kanban columns)
    INSERT INTO tasks (user_id, title, description, status, priority, due_date, tags, column_status) VALUES
    (dev_user_id, 'Design new dashboard', 'Create wireframes and mockups for Mission Control V2', 'in_progress', 'high', NOW() + INTERVAL '3 days', ARRAY['design', 'frontend'], 'in_progress'),
    (dev_user_id, 'Set up Supabase auth', 'Configure Telegram and Discord OAuth via Supabase', 'todo', 'urgent', NOW() + INTERVAL '1 day', ARRAY['backend', 'auth'], 'todo'),
    (dev_user_id, 'Review Q4 analytics', 'Compile and review Q4 performance metrics', 'review', 'medium', NOW() + INTERVAL '5 days', ARRAY['analytics'], 'review'),
    (dev_user_id, 'Fix Kanban drag bug', 'Cards jump when dragged between columns in Safari', 'todo', 'high', NOW() - INTERVAL '1 day', ARRAY['bug', 'frontend'], 'todo'),
    (dev_user_id, 'Deploy staging build', 'Push latest build to staging for client review', 'done', 'medium', NOW(), ARRAY['devops'], 'done'),
    (dev_user_id, 'Write API documentation', 'Document all Supabase edge functions and REST endpoints', 'backlog', 'low', NOW() + INTERVAL '14 days', ARRAY['docs', 'backend'], 'backlog'),
    (dev_user_id, 'WhatsApp channel setup', 'Integrate WhatsApp Business API with Mission Control', 'in_progress', 'medium', NOW() + INTERVAL '7 days', ARRAY['backend', 'channels'], 'in_progress'),
    (dev_user_id, 'Performance audit', 'Run Lighthouse audit and fix top 5 performance issues', 'todo', 'medium', NOW() + INTERVAL '10 days', ARRAY['frontend', 'performance'], 'todo');

    -- ANNIVERSARIES
    INSERT INTO anniversaries (user_id, title, anniversary_date, anniversary_type) VALUES
    (dev_user_id, 'John''s Birthday', CURRENT_DATE + INTERVAL '10 days', 'birthday'),
    (dev_user_id, 'Acme Corp Partnership', '2020-03-15', 'partnership'),
    (dev_user_id, 'Company Founded', '2018-07-01', 'company_founded');

    -- REMINDERS
    INSERT INTO reminders (user_id, title, due_date, recurrence, is_active) VALUES
    (dev_user_id, 'Weekly standup', NOW() + INTERVAL '1 day', 'weekly', TRUE),
    (dev_user_id, 'Submit invoice', NOW() + INTERVAL '7 days', 'monthly', TRUE),
    (dev_user_id, 'Review PRs', NOW() + INTERVAL '2 hours', 'daily', TRUE);

    -- SCHEDULES
    INSERT INTO schedules (user_id, title, start_time, end_time, color) VALUES
    (dev_user_id, 'Design Sprint', NOW() + INTERVAL '1 day', NOW() + INTERVAL '3 days', '#f97316'),
    (dev_user_id, 'Client Call', NOW() + INTERVAL '2 days' + INTERVAL '4 hours', NOW() + INTERVAL '2 days' + INTERVAL '5 hours', '#3b82f6'),
    (dev_user_id, 'Team Sync', NOW() + INTERVAL '5 days' + INTERVAL '9 hours', NOW() + INTERVAL '5 days' + INTERVAL '10 hours', '#22c55e');

    -- INSIGHTS
    INSERT INTO insights (user_id, insight_type, title, message, severity) VALUES
    (dev_user_id, 'task_overdue', 'Task is overdue', 'Fix Kanban drag bug was due yesterday', 'warning'),
    (dev_user_id, 'upcoming_anniversary', 'Anniversary coming up', 'John''s Birthday is in 10 days', 'info'),
    (dev_user_id, 'ai_suggestion', 'AI Suggestion', 'You have 3 high-priority tasks due this week. Consider delegating one.', 'info'),
    (dev_user_id, 'productivity_tip', 'Productivity Tip', 'Your peak productivity hours are 9–11 AM. Schedule deep work then.', 'info');

    -- ACTIVITY LOG
    INSERT INTO activity_log (user_id, action_type, entity_type) VALUES
    (dev_user_id, 'task_created', 'task'),
    (dev_user_id, 'task_completed', 'task'),
    (dev_user_id, 'account_added', 'account'),
    (dev_user_id, 'insight_dismissed', 'insight');

    -- DEFAULT SETTINGS
    INSERT INTO settings (user_id, key, value) VALUES
    (dev_user_id, 'theme', '{"mode": "dark", "accent_color": "#f97316", "glass_opacity": 0.08, "sidebar_collapsed": false}'),
    (dev_user_id, 'notifications', '{"telegram": true, "discord": false, "whatsapp": false}'),
    (dev_user_id, 'workspace', '{"layout": "command_center", "right_panel": "insights", "default_view": "kanban"}'),
    (dev_user_id, 'ai_agent', '{"model": "mini-max-m2.7", "personality": "helpful", "suggestions_enabled": true}');

END $$;

COMMIT;

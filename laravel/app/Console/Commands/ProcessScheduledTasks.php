<?php

namespace App\Console\Commands;

use App\Services\SupabaseService;
use Illuminate\Console\Command;

/**
 * ProcessScheduledTasks
 *
 * Converts overdue reminders, due anniversaries, and past schedules
 * into tasks so they appear on the dashboard task board.
 *
 * Usage:
 *   php artisan schedule:process          — process all due items
 *   php artisan schedule:process --dry-run — preview what would be created
 *
 * Scheduled: runs every 5 minutes via Laravel scheduler.
 */
class ProcessScheduledTasks extends Command
{
    protected $signature = 'schedule:process {--dry-run : Preview actions without creating tasks}';

    protected $description = 'Convert due reminders, anniversaries, and past schedules into tasks';

    public function __construct(
        private SupabaseService $db,
    ) {
        parent::__construct();
    }

    public function handle(): int
    {
        $dryRun = $this->option('dry-run');
        if ($dryRun) {
            $this->info('DRY RUN — no tasks will be created');
        }

        $now = now()->toISOString();
        $today = now()->toDateString();

        $tasksCreated = 0;

        // ── 1. Process overdue reminders ──────────────────────────────
        $tasksCreated += $this->processOverdueReminders($dryRun, $now);

        // ── 2. Process due anniversaries (upcoming within 7 days) ────
        $tasksCreated += $this->processAnniversaries($dryRun, $today);

        // ── 3. Process past schedules that haven't been actioned ─────
        $tasksCreated += $this->processPastSchedules($dryRun, $now);

        $this->info("Done. Tasks created: {$tasksCreated}");
        return Command::SUCCESS;
    }

    /**
     * Reminders: due_date in the past + is_active = true + no linked done task.
     */
    private function processOverdueReminders(bool $dryRun, string $now): int
    {
        $reminders = $this->db->get('reminders', [
            'due_date'   => "lt.{$now}",
            'is_active'  => 'eq.true',
            'order'      => 'due_date.asc',
            'limit'      => 50,
        ]);

        if (($reminders['error'] ?? false) || empty($reminders)) {
            return 0;
        }

        $count = 0;
        foreach ($reminders as $reminder) {
            $title = $reminder['title'] ?? 'Reminder';
            $desc  = $reminder['description'] ?? '';

            if ($dryRun) {
                $this->line("[DRY RUN] Would create task from reminder: {$title} (due: {$reminder['due_date']})");
                $count++;
                continue;
            }

            $taskId = $this->ensureTaskFromReminder($reminder);
            if ($taskId) {
                $this->info("Created task from reminder: {$title}");
                $count++;
            }
        }

        return $count;
    }

    /**
     * Anniversaries: anniversary_date is today or within remind_days_before.
     */
    private function processAnniversaries(bool $dryRun, string $today): int
    {
        // Find all accounts, then check anniversaries
        $accounts = $this->db->get('accounts', ['limit' => 100]);
        if (($accounts['error'] ?? false) || empty($accounts)) {
            return 0;
        }

        $count = 0;
        foreach ($accounts as $account) {
            $userId = $account['user_id'] ?? null;
            if (!$userId) { continue; }

            $anniversaries = $this->db->get('anniversaries', [
                'account_id'  => "eq.{$account['id']}",
                'is_recurring' => 'eq.true',
                'order'       => 'anniversary_date.asc',
            ]);

            if (($anniversaries['error'] ?? false) || empty($anniversaries)) {
                continue;
            }

            foreach ($anniversaries as $anniv) {
                $remindDays = $anniv['remind_days_before'] ?? 7;
                $targetDate = now()->addDays($remindDays)->toDateString();

                if ($anniv['anniversary_date'] !== $today && $anniv['anniversary_date'] !== $targetDate) {
                    continue;
                }

                $title = $anniv['title'] ?? 'Anniversary';
                $desc  = ($anniv['notes'] ?? '')
                    ? "Note: {$anniv['notes']}"
                    : "{$account['name']}'s {$title}";

                if ($dryRun) {
                    $this->line("[DRY RUN] Would create task from anniversary: {$title} ({$desc})");
                    $count++;
                    continue;
                }

                $taskId = $this->ensureTaskFromAnniversary($userId, $title, $desc, $anniv['id']);
                if ($taskId) {
                    $this->info("Created task from anniversary: {$title}");
                    $count++;
                }
            }
        }

        return $count;
    }

    /**
     * Schedules: start_time has passed (past) and no task is linked or linked task is done.
     */
    private function processPastSchedules(bool $dryRun, string $now): int
    {
        $schedules = $this->db->get('schedules', [
            'start_time' => "lt.{$now}",
            'order'      => 'start_time.asc',
            'limit'      => 50,
        ]);

        if (($schedules['error'] ?? false) || empty($schedules)) {
            return 0;
        }

        $count = 0;
        foreach ($schedules as $schedule) {
            $title = $schedule['title'] ?? 'Scheduled item';
            $desc  = $schedule['description'] ?? '';

            // If already linked to an incomplete task, skip
            if (!empty($schedule['task_id'])) {
                $existingTask = $this->db->get('tasks', ['id' => "eq.{$schedule['task_id']}"]);
                if (
                    !($existingTask['error'] ?? false)
                    && !empty($existingTask[0])
                    && ($existingTask[0]['status'] ?? '') !== 'done'
                ) {
                    continue;
                }
            }

            if ($dryRun) {
                $this->line("[DRY RUN] Would create task from schedule: {$title} (started: {$schedule['start_time']})");
                $count++;
                continue;
            }

            $taskId = $this->ensureTaskFromSchedule($schedule);
            if ($taskId) {
                $this->info("Created task from schedule: {$title}");
                $count++;
            }
        }

        return $count;
    }

    // ─── Task creation helpers ────────────────────────────────────

    private function ensureTaskFromReminder(array $reminder): ?string
    {
        // Check if we already created a task for this reminder recently (within 24h)
        $existing = $this->db->get('tasks', [
            'metadata' => "cs.{{\"reminder_id\",\"{$reminder['id']}\"}}}",
        ]);

        if (!($existing['error'] ?? false) && !empty($existing)) {
            return null; // already have a task for this reminder
        }

        $result = $this->db->insert('tasks', [
            'title'          => $reminder['title'] ?? 'Reminder',
            'description'    => $reminder['description'] ?? null,
            'due_date'       => $reminder['due_date'] ?? null,
            'status'         => 'todo',
            'priority'       => 'high', // overdue reminders are high priority
            'user_id'        => $reminder['user_id'],
            'account_id'     => $reminder['account_id'] ?? null,
            'trigger_source' => 'schedule',
            'metadata'       => [
                'reminder_id'    => $reminder['id'],
                'recurrence'     => $reminder['recurrence'] ?? 'once',
            ],
        ]);

        if ($result['error'] ?? false) {
            $this->warn("  Failed to create task for reminder {$reminder['id']}: {$result['error']}");
            return null;
        }

        // Link the reminder to the task
        $taskId = is_array($result[0] ?? null) ? ($result[0]['id'] ?? null) : ($result['id'] ?? null);
        if ($taskId) {
            $this->db->update('reminders', ['id' => $reminder['id']], ['task_id' => $taskId]);
        }

        return $taskId;
    }

    private function ensureTaskFromAnniversary(string $userId, string $title, string $desc, string $annivId): ?string
    {
        // Don't recreate if one already exists for today
        $today = now()->toDateString();
        $existing = $this->db->get('tasks', [
            'user_id'   => "eq.{$userId}",
            'due_date'  => "eq.{$today}",
            'title'     => "eq.{$title}",
        ]);

        if (!($existing['error'] ?? false) && !empty($existing)) {
            return null;
        }

        $result = $this->db->insert('tasks', [
            'title'          => $title,
            'description'    => $desc,
            'due_date'       => now()->endOfDay()->toISOString(),
            'status'         => 'todo',
            'priority'       => 'medium',
            'user_id'        => $userId,
            'trigger_source' => 'schedule',
            'metadata'       => ['anniversary_id' => $annivId],
        ]);

        if ($result['error'] ?? false) {
            $this->warn("  Failed to create task for anniversary {$annivId}: {$result['error']}");
            return null;
        }

        return is_array($result[0] ?? null) ? ($result[0]['id'] ?? null) : ($result['id'] ?? null);
    }

    private function ensureTaskFromSchedule(array $schedule): ?string
    {
        $result = $this->db->insert('tasks', [
            'title'          => $schedule['title'] ?? 'Scheduled item',
            'description'    => $schedule['description'] ?? null,
            'due_date'       => $schedule['end_time'] ?? $schedule['start_time'],
            'status'         => 'todo',
            'priority'       => 'medium',
            'user_id'        => $schedule['user_id'],
            'account_id'     => $schedule['account_id'] ?? null,
            'trigger_source' => 'schedule',
            'metadata'       => ['schedule_id' => $schedule['id']],
        ]);

        if ($result['error'] ?? false) {
            $this->warn("  Failed to create task for schedule {$schedule['id']}: {$result['error']}");
            return null;
        }

        $taskId = is_array($result[0] ?? null) ? ($result[0]['id'] ?? null) : ($result['id'] ?? null);
        if ($taskId && !empty($schedule['id'])) {
            $this->db->update('schedules', ['id' => $schedule['id']], ['task_id' => $taskId]);
        }

        return $taskId;
    }
}

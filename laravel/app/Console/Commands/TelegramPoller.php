<?php

namespace App\Console\Commands;

use App\Services\SupabaseService;
use App\Services\TelegramPollingService;
use Illuminate\Console\Command;

/**
 * TelegramPoller
 *
 * Scheduled polling command for Telegram bot channels.
 * Runs every minute via Laravel scheduler.
 *
 * Usage:
 *   php artisan telegram:poll           — poll all enabled channels once
 *   php artisan telegram:poll --fresh   — force fresh session (ignores active sessions)
 *
 * This command:
 * 1. Finds all Telegram channel_connections where polling_enabled = true
 * 2. For each channel, executes one poll cycle via TelegramPollingService
 * 3. Saves incoming updates to the task log (activity_log + raw_updates)
 * 4. Acknowledges processed updates (advances polling_offset)
 * 5. Updates channel_connections: polling_offset, last_polled_at
 */
class TelegramPoller extends Command
{
    protected $signature = 'telegram:poll {--fresh : Force fresh session, ignore existing active sessions}';

    protected $description = 'Poll all Telegram channels with polling_enabled=true (run every minute via scheduler)';

    public function __construct(
        private SupabaseService $db,
    ) {
        parent::__construct();
    }

    public function handle(): int
    {
        $this->info('Telegram polling job started');

        // Find all Telegram channels with polling enabled
        $channels = $this->db->get('channel_connections', [
            'channel' => 'eq.telegram',
            'polling_enabled' => 'eq.true',
            'is_active' => 'eq.true',
        ]);

        if (($channels['error'] ?? false) || empty($channels)) {
            $this->warn('No active Telegram channels with polling enabled found.');
            return Command::SUCCESS;
        }

        $this->info(sprintf('Found %d Telegram channel(s) to poll', count($channels)));

        $processedTotal = 0;
        $errorsTotal = 0;

        foreach ($channels as $channel) {
            $channelId = $channel['id'] ?? null;
            $botToken = $channel['bot_token'] ?? null;

            if (!$channelId || !$botToken) {
                $this->error("Channel {$channelId}: missing bot_token, skipping.");
                $errorsTotal++;
                continue;
            }

            $this->line("Polling channel: {$channelId}");

            try {
                $result = $this->pollChannel($channel, $botToken);
                $processedTotal += $result['processed'];
                if ($result['errors'] > 0) {
                    $errorsTotal += $result['errors'];
                }
            } catch (\Throwable $e) {
                $this->error("Channel {$channelId}: {$e->getMessage()}");
                $this->logError($channelId, $e->getMessage());
                $errorsTotal++;
            }
        }

        $this->info(sprintf(
            'Polling complete. Processed: %d updates, Errors: %d',
            $processedTotal,
            $errorsTotal
        ));

        return $errorsTotal > 0 ? Command::FAILURE : Command::SUCCESS;
    }

    /**
     * Execute one poll cycle for a single channel.
     */
    private function pollChannel(array $channel, string $botToken): array
    {
        $channelId = $channel['id'];
        $workerId = 'scheduler:' . gethostname() . ':' . getmypid();

        $service = new TelegramPollingService($this->db, $botToken, $channelId);

        // Start (or heartbeat) a polling session
        $startResult = $service->startPolling($workerId);
        if (!$startResult['went_ok']) {
            $this->warn("  Could not start session: {$startResult['message']}");
            return ['processed' => 0, 'errors' => 1];
        }

        // Execute one poll cycle
        $pollResult = $service->pollOnce($workerId);

        if (!$pollResult['went_ok'] && !($pollResult['is_idle'] ?? false)) {
            $this->warn("  Poll failed: {$pollResult['error']}");
            $this->logError($channelId, $pollResult['error'] ?? 'Poll failed');
            return ['processed' => 0, 'errors' => 1];
        }

        $updates = $pollResult['updates'] ?? [];
        $updatesCount = count($updates);

        if ($updatesCount > 0) {
            $this->info("  Received {$updatesCount} update(s)");
            $this->processUpdates($channelId, $updates, $botToken);
        } else {
            $this->line('  No new updates');
        }

        // Acknowledge the updates (advance offset)
        if (!empty($updates)) {
            $service->acknowledgeUpdates($workerId, $updates);
            $this->line("  Acknowledged {$updatesCount} update(s)");
        }

        // Update channel_connections with last_polled_at
        $this->db->update('channel_connections',
            ['id' => $channelId],
            ['last_polled_at' => now()->toISOString()]
        );

        return ['processed' => $updatesCount, 'errors' => 0];
    }

    /**
     * Process incoming Telegram updates — save to activity_log and raw_updates.
     * Also converts /task commands into tasks.
     */
    private function processUpdates(string $channelId, array $updates, string $botToken): void
    {
        $userId = $this->getChannelUser($channelId);
        if (!$userId) {
            $this->warn("  Could not determine user_id for channel {$channelId}, skipping activity log");
            return;
        }

        foreach ($updates as $update) {
            $updateId = $update['update_id'] ?? null;
            $message = $update['message'] ?? $update['edited_message'] ?? $update['callback_query'] ?? null;

            if (!$message) {
                continue;
            }

            // Extract text content
            $text = $message['text'] ?? $message['data'] ?? null; // callback_query.data

            // Determine sender
            $from = $message['from'] ?? [];
            $fromId = $from['id'] ?? null;
            $fromName = trim(($from['first_name'] ?? '') . ' ' . ($from['last_name'] ?? ''));

            // Chat info
            $chat = $message['chat'] ?? [];
            $chatId = $chat['id'] ?? null;

            // Check for /task command — parse and create a task
            $this->parseAndCreateTask($userId, $channelId, $text, $update);

            // Save to activity_log (primary log for dashboard)
            $this->db->insert('activity_log', [
                'user_id' => $userId,
                'channel' => 'telegram',
                'channel_id' => $channelId,
                'event_type' => $update['callback_query'] ? 'callback_query' : 'message',
                'message' => $text,
                'trigger_source' => 'telegram',
                'metadata' => [
                    'update_id' => $updateId,
                    'from_id' => $fromId,
                    'from_name' => $fromName,
                    'chat_id' => $chatId,
                    'raw_update' => $update,
                ],
            ]);
        }
    }

    /**
     * Parse a Telegram message for /task commands and create a task.
     *
     * Formats:
     *   /task <title>                           — simple task
     *   /task <title> --priority <high|urgent>  — with priority
     *   /task <title> --due <YYYY-MM-DD>        — with due date
     *   /task <title> --desc <description>      — with description
     */
    private function parseAndCreateTask(string $userId, string $channelId, ?string $text, array $update): void
    {
        if (!$text || !str_starts_with(trim($text), '/task')) {
            return;
        }

        $parsed = $this->parseTaskCommand($text);
        if (!$parsed['title']) {
            return;
        }

        $payload = [
            'title'          => $parsed['title'],
            'description'    => $parsed['description'] ?? null,
            'priority'       => $parsed['priority'] ?? 'medium',
            'due_date'       => $parsed['due_date'] ?? null,
            'user_id'        => $userId,
            'status'         => 'todo',
            'channel_id'     => $channelId,
            'trigger_source' => 'telegram',
            'position'       => 0,
        ];

        $result = $this->db->insert('tasks', $payload);

        if ($result['error'] ?? false) {
            $this->warn("  Failed to create task from /task command: {$result['error']}");
            return;
        }

        $taskId = is_array($result[0] ?? null) ? ($result[0]['id'] ?? null) : ($result['id'] ?? null);
        $this->info("  Created task from /task command: {$parsed['title']}" . ($taskId ? " (id: {$taskId})" : ''));
    }

    /**
     * Parse a /task command string into structured fields.
     */
    private function parseTaskCommand(string $text): array
    {
        $result = ['title' => null, 'priority' => null, 'due_date' => null, 'description' => null];

        // Strip the /task prefix
        $body = ltrim(preg_replace('#^/task\s*#i', '', $text));

        // Extract --due <YYYY-MM-DD> (must appear before other --flags)
        if (preg_match('/--due\s+(\d{4}-\d{2}-\d{2})/', $body, $m)) {
            $result['due_date'] = $m[1] . 'T00:00:00+00:00';
            $body = trim(preg_replace('/--due\s+\d{4}-\d{2}-\d{2}/', '', $body));
        }

        // Extract --priority <value>
        if (preg_match('/--priority\s+(urgent|high|medium|low)/i', $body, $m)) {
            $result['priority'] = strtolower($m[1]);
            $body = trim(preg_replace('/--priority\s+(urgent|high|medium|low)/i', '', $body));
        }

        // Extract --desc <text> (everything after --desc until another --flag or end)
        if (preg_match('/--desc\s+(.+?)(?=\s+--|\s*$)/i', $body, $m)) {
            $result['description'] = trim($m[1]);
            $body = trim(preg_replace('/--desc\s+.+?(?=\s+--|\s*$)/i', '', $body));
        }

        $result['title'] = trim($body);
        return $result;
    }

    /**
     * Look up the user_id for a channel connection.
     */
    private function getChannelUser(string $channelId): ?string
    {
        $result = $this->db->get('channel_connections', ['id' => "eq.{$channelId}"]);
        if (!empty($result) && is_array($result[0] ?? null)) {
            return $result[0]['user_id'] ?? null;
        }
        return null;
    }

    /**
     * Log a polling error to the channel connection.
     */
    private function logError(string $channelId, string $errorMsg): void
    {
        $this->db->update('channel_connections',
            ['id' => $channelId],
            ['channel_meta' => ['last_error' => $errorMsg, 'error_at' => now()->toISOString()]]
        );
    }
}

<?php

namespace App\Services;

use GuzzleHttp\Client;
use GuzzleHttp\Exception\GuzzleException;

/**
 * TelegramPollingService
 *
 * Implements Telegram Bot API long-polling ("getUpdates") loop.
 * Manages session state, offset tracking, graceful shutdown,
 * error backoff, and per-channel config in Supabase.
 *
 * Thread-safety note: Each polling worker should run its own instance
 * of this service. The shared state lives in Supabase rows, not in
 * instance properties.
 */
class TelegramPollingService
{
    private Client $http;
    private string $baseUrl;

    public function __construct(
        private SupabaseService $db,
        private string $botToken,
        private string $channelConnectionId,
    ) {
        $this->http = new Client([
            'timeout' => 60,
            'connect_timeout' => 10,
        ]);
        $this->baseUrl = "https://api.telegram.org/bot{$this->botToken}";
    }

    // ══════════════════════════════════════════════════════════════
    // PUBLIC API — called by the controller / scheduler
    // ══════════════════════════════════════════════════════════════

    /**
     * Start (or resume) a long-polling session for this channel.
     *
     * @param string $workerId  Unique identifier for this worker process
     * @return array{went_ok: bool, message: string, session_id?: string}
     */
    public function startPolling(string $workerId): array
    {
        // Load or create bot config row
        $config = $this->loadOrCreateBotConfig();
        if ($config['error'] ?? false) {
            return ['went_ok' => false, 'message' => 'Failed to load bot config: ' . $config['error']];
        }

        if (!($config['polling_enabled'] ?? false)) {
            // Enable polling on the channel connection
            $this->db->update('channel_connections',
                ['id' => $this->channelConnectionId],
                ['polling_enabled' => true]
            );
            $this->db->update('telegram_bot_configs',
                ['channel_connection_id' => $this->channelConnectionId],
                ['polling_enabled' => true, 'session_status' => 'running']
            );
        }

        // Register (or heartbeat) polling session row
        $session = $this->registerSession($workerId, $config['id']);

        return [
            'went_ok' => true,
            'message' => 'Polling session started.',
            'session_id' => $session['id'] ?? null,
        ];
    }

    /**
     * Stop a long-polling session and mark the worker as inactive.
     *
     * @param string $workerId
     * @return array{went_ok: bool, message: string}
     */
    public function stopPolling(string $workerId): array
    {
        $session = $this->findSessionByWorker($workerId);
        if (!$session) {
            return ['went_ok' => false, 'message' => 'No active session found for worker.'];
        }

        // Heartbeat shutdown signal
        $this->db->update('telegram_polling_sessions',
            ['id' => $session['id']],
            [
                'is_active' => false,
                'shutdown_requested' => true,
                'shutdown_at' => now()->toISOString(),
            ]
        );

        // Update bot config to idle
        $this->db->update('telegram_bot_configs',
            ['channel_connection_id' => $this->channelConnectionId],
            ['session_status' => 'idle']
        );

        // Disable polling on channel
        $this->db->update('channel_connections',
            ['id' => $this->channelConnectionId],
            ['polling_enabled' => false]
        );

        return ['went_ok' => true, 'message' => 'Polling session stopped.'];
    }

    /**
     * Fetch one batch of updates from Telegram and return them for processing.
     * This is the core poll step — call this in a loop from your worker.
     *
     * @param string $workerId
     * @return array{went_ok: bool, updates: array, error?: string, is_idle?: bool}
     */
    public function pollOnce(string $workerId): array
    {
        $config = $this->loadBotConfig();
        if ($config['error'] ?? false) {
            return ['went_ok' => false, 'updates' => [], 'error' => $config['error']];
        }

        $session = $this->findSessionByWorker($workerId);
        if (!$session) {
            return ['went_ok' => false, 'updates' => [], 'error' => 'No session registered for worker.'];
        }

        // Check shutdown flag
        if ($session['shutdown_requested'] ?? false) {
            $this->markSessionInactive($session['id']);
            return ['went_ok' => false, 'updates' => [], 'is_idle' => true, 'error' => 'Shutdown requested'];
        }

        $offset = $config['polling_offset'] ?? 0;
        $timeout = $config['polling_timeout_secs'] ?? 55;
        $allowedUpdates = $config['polling_allowed_updates'] ?? ['message', 'edited_message', 'callback_query'];

        // Mark poll start
        $this->db->update('telegram_bot_configs',
            ['channel_connection_id' => $this->channelConnectionId],
            ['last_poll_started_at' => now()->toISOString()]
        );

        // Call Telegram getUpdates
        $telegramResponse = $this->callGetUpdates($offset, $timeout, $allowedUpdates);

        if ($telegramResponse['error'] ?? false) {
            $this->recordPollError($config, $telegramResponse['error']);
            return [
                'went_ok' => false,
                'updates' => [],
                'error' => $telegramResponse['error'],
            ];
        }

        $updates = $telegramResponse['updates'] ?? [];
        $lastId = $this->getLastUpdateId($updates);

        // Record success
        $this->recordPollSuccess($config, $session, count($updates), $lastId, $telegramResponse['duration_ms'] ?? 0);

        return [
            'went_ok' => true,
            'updates' => $updates,
        ];
    }

    /**
     * Acknowledge (mark as processed) a batch of updates by advancing the offset.
     * Call this after you have successfully handled the updates.
     *
     * @param string $workerId
     * @param array $updates
     */
    public function acknowledgeUpdates(string $workerId, array $updates): void
    {
        if (empty($updates)) { return; }

        $lastId = $this->getLastUpdateId($updates);
        $nextOffset = $lastId + 1;

        $this->db->update('telegram_bot_configs',
            ['channel_connection_id' => $this->channelConnectionId],
            [
                'polling_offset' => $nextOffset,
                'last_update_id' => $lastId,
                'updates_processed' => $this->db->get('telegram_bot_configs',
                    ['channel_connection_id' => "eq.{$this->channelConnectionId}"],
                )[0]['updates_processed'] ?? 0 + count($updates),
            ]
        );

        $this->db->update('channel_connections',
            ['id' => $this->channelConnectionId],
            [
                'polling_offset' => $nextOffset,
                'last_polled_at' => now()->toISOString(),
            ]
        );
    }

    /**
     * Get the current polling status for this channel.
     *
     * @return array{polling_enabled: bool, session_status: string, polling_offset: int,
     *               updates_processed: int, updates_failed: int, last_error: ?string,
     *               consecutive_errors: int, last_poll_started_at: ?string, last_poll_completed_at: ?string}
     */
    public function getStatus(): array
    {
        $config = $this->loadBotConfig();
        if ($config['error'] ?? false) {
            return ['polling_enabled' => false, 'session_status' => 'error', 'error' => $config['error']];
        }

        return [
            'polling_enabled' => $config['polling_enabled'] ?? false,
            'session_status' => $config['session_status'] ?? 'unknown',
            'polling_offset' => $config['polling_offset'] ?? 0,
            'updates_processed' => $config['updates_processed'] ?? 0,
            'updates_failed' => $config['updates_failed'] ?? 0,
            'last_error' => $config['session_error'] ?? null,
            'consecutive_errors' => $config['consecutive_errors'] ?? 0,
            'polling_timeout_secs' => $config['polling_timeout_secs'] ?? 55,
            'last_poll_started_at' => $config['last_poll_started_at'] ?? null,
            'last_poll_completed_at' => $config['last_poll_completed_at'] ?? null,
            'last_update_id' => $config['last_update_id'] ?? null,
        ];
    }

    /**
     * Update polling configuration for this channel.
     *
     * @param array{polling_timeout_secs?: int, polling_allowed_updates?: array, max_consecutive_errors?: int} $settings
     * @return array{went_ok: bool, message: string}
     */
    public function updateSettings(array $settings): array
    {
        $config = $this->loadBotConfig();
        if ($config['error'] ?? false) {
            return ['went_ok' => false, 'message' => $config['error']];
        }

        $patch = [];

        if (isset($settings['polling_timeout_secs'])) {
            $patch['polling_timeout_secs'] = (int) $settings['polling_timeout_secs'];
        }
        if (isset($settings['polling_allowed_updates'])) {
            $patch['polling_allowed_updates'] = $settings['polling_allowed_updates'];
        }
        if (isset($settings['max_consecutive_errors'])) {
            $patch['max_consecutive_errors'] = (int) $settings['max_consecutive_errors'];
        }

        if (empty($patch)) {
            return ['went_ok' => true, 'message' => 'No settings to update.'];
        }

        $this->db->update('telegram_bot_configs',
            ['channel_connection_id' => $this->channelConnectionId],
            $patch
        );

        return ['went_ok' => true, 'message' => 'Settings updated.'];
    }

    // ══════════════════════════════════════════════════════════════
    // PRIVATE HELPERS
    // ══════════════════════════════════════════════════════════════

    private function loadOrCreateBotConfig(): array
    {
        $existing = $this->loadBotConfig();
        if (!($existing['error'] ?? false) && ($existing['id'] ?? null)) {
            return $existing;
        }

        $inserted = $this->db->insert('telegram_bot_configs', [
            'channel_connection_id' => $this->channelConnectionId,
            'polling_enabled' => false,
            'session_status' => 'idle',
            'polling_offset' => 0,
        ]);

        if ($inserted['error'] ?? false) {
            // Try loading again in case of race
            $retry = $this->loadBotConfig();
            if (!($retry['error'] ?? false)) { return $retry; }
            return $inserted;
        }

        return $this->loadBotConfig();
    }

    private function loadBotConfig(): array
    {
        $result = $this->db->get('telegram_bot_configs', [
            'channel_connection_id' => "eq.{$this->channelConnectionId}",
        ]);

        if ($result['error'] ?? false) {
            return ['error' => $result['error']];
        }

        if (empty($result) || !is_array($result)) {
            return ['error' => 'Bot config not found for channel connection.'];
        }

        return is_array($result[0] ?? null) ? $result[0] : $result;
    }

    private function registerSession(string $workerId, string $configId): array
    {
        $workerHost = gethostname();

        // Upsert session row
        $existing = $this->db->get('telegram_polling_sessions', [
            'telegram_bot_config_id' => "eq.{$configId}",
            'worker_id' => "eq.{$workerHost}:{$workerId}",
        ]);

        if (!empty($existing) && is_array($existing[0] ?? null)) {
            // Heartbeat
            $session = $this->db->update('telegram_polling_sessions',
                ['id' => $existing[0]['id']],
                [
                    'is_active' => true,
                    'worker_heartbeat_at' => now()->toISOString(),
                    'shutdown_requested' => false,
                    'shutdown_at' => null,
                ]
            );
            return is_array($session) ? ($session[0] ?? $session) : $session;
        }

        $inserted = $this->db->insert('telegram_polling_sessions', [
            'telegram_bot_config_id' => $configId,
            'worker_id' => "{$workerHost}:{$workerId}",
            'is_active' => true,
            'session_status' => 'running',
        ]);

        return is_array($inserted) ? ($inserted[0] ?? $inserted) : $inserted;
    }

    private function findSessionByWorker(string $workerId): ?array
    {
        $workerHost = gethostname();
        $result = $this->db->get('telegram_polling_sessions', [
            'worker_id' => "eq.{$workerHost}:{$workerId}",
            'is_active' => 'eq.true',
        ]);

        if (empty($result) || !is_array($result)) {
            return null;
        }

        return is_array($result[0] ?? null) ? $result[0] : null;
    }

    private function markSessionInactive(string $sessionId): void
    {
        $this->db->update('telegram_polling_sessions',
            ['id' => $sessionId],
            ['is_active' => false]
        );
    }

    private function callGetUpdates(int $offset, int $timeout, array $allowedUpdates): array
    {
        $start = microtime(true);

        try {
            $response = $this->http->get("{$this->baseUrl}/getUpdates", [
                'query' => array_filter([
                    'offset' => $offset > 0 ? $offset : null,
                    'timeout' => $timeout,
                    'allowed_updates' => json_encode($allowedUpdates),
                ]),
            ]);

            $durationMs = (int) ((microtime(true) - $start) * 1000);
            $body = json_decode($response->getBody()->getContents(), true) ?? [];

            if (!($body['ok'] ?? false)) {
                return [
                    'error' => $body['description'] ?? 'Telegram returned ok=false',
                    'duration_ms' => $durationMs,
                ];
            }

            return [
                'updates' => $body['result'] ?? [],
                'duration_ms' => $durationMs,
            ];
        } catch (GuzzleException $e) {
            return [
                'error' => $e->getMessage(),
                'duration_ms' => (int) ((microtime(true) - $start) * 1000),
            ];
        }
    }

    private function recordPollError(array $config, string $errorMsg): void
    {
        $newErrors = ($config['consecutive_errors'] ?? 0) + 1;
        $sessionStatus = $newErrors >= ($config['max_consecutive_errors'] ?? 10) ? 'error' : 'running';

        $this->db->update('telegram_bot_configs',
            ['channel_connection_id' => $this->channelConnectionId],
            [
                'session_error' => $errorMsg,
                'consecutive_errors' => $newErrors,
                'session_status' => $sessionStatus,
                'updates_failed' => ($config['updates_failed'] ?? 0) + 1,
            ]
        );
    }

    private function recordPollSuccess(array $config, array $session, int $count, ?int $lastId, int $durationMs): void
    {
        $this->db->update('telegram_bot_configs',
            ['channel_connection_id' => $this->channelConnectionId],
            [
                'session_status' => 'running',
                'session_error' => null,
                'consecutive_errors' => 0,
                'last_poll_completed_at' => now()->toISOString(),
                'last_update_id' => $lastId,
            ]
        );

        if ($session['id'] ?? null) {
            $this->db->update('telegram_polling_sessions',
                ['id' => $session['id']],
                [
                    'last_poll_at' => now()->toISOString(),
                    'last_poll_duration_ms' => $durationMs,
                    'last_poll_updates_count' => $count,
                    'total_cycles' => ($session['total_cycles'] ?? 0) + 1,
                    'total_updates' => ($session['total_updates'] ?? 0) + $count,
                    'worker_heartbeat_at' => now()->toISOString(),
                ]
            );
        }
    }

    private function getLastUpdateId(array $updates): ?int
    {
        if (empty($updates)) { return null; }
        $last = end($updates);
        return isset($last['update_id']) ? (int) $last['update_id'] : null;
    }
}
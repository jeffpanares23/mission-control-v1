<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use App\Services\SupabaseService;
use App\Services\TelegramPollingService;

/**
 * TelegramPollingController
 *
 * REST API for managing Telegram long-polling sessions.
 * All routes are prefixed /api/v1/telegram-polling/*
 *
 * Endpoints:
 *   GET     /status/{channelConnectionId}  — polling status for a channel
 *   POST    /start/{channelConnectionId}  — start polling session
 *   POST    /stop/{channelConnectionId}   — stop polling session
 *   POST    /poll/{channelConnectionId}   — execute one poll cycle (manual trigger)
 *   POST    /acknowledge/{channelConnectionId} — acknowledge processed updates
 *   PATCH   /settings/{channelConnectionId}   — update polling settings
 */
class TelegramPollingController extends Controller
{
    public function __construct(
        private SupabaseService $db,
    ) {}

    // ══════════════════════════════════════════════════════════════
    // HELPERS
    // ══════════════════════════════════════════════════════════════

    private function ok(mixed $data, string $message = 'OK', int $code = 200): \Illuminate\Http\JsonResponse
    {
        return response()->json([
            'success' => true,
            'message' => $message,
            'data' => $data,
        ], $code);
    }

    private function error(string $message, int $code = 422): \Illuminate\Http\JsonResponse
    {
        return response()->json([
            'success' => false,
            'message' => $message,
        ], $code);
    }

    /**
     * Build a TelegramPollingService from a channel connection ID.
     */
    private function makeService(string $channelConnectionId): array
    {
        $conn = $this->db->get('channel_connections', [
            'id' => "eq.{$channelConnectionId}",
            'channel' => 'eq.telegram',
        ]);

        if (empty($conn) || !is_array($conn[0] ?? null)) {
            return ['error' => 'Telegram channel connection not found.', 'service' => null];
        }

        $conn = $conn[0];

        if (empty($conn['bot_token'])) {
            return ['error' => 'No bot_token on this channel connection.', 'service' => null];
        }

        $service = new TelegramPollingService(
            $this->db,
            $conn['bot_token'],
            $channelConnectionId
        );

        return ['service' => $service, 'connection' => $conn];
    }

    /**
     * Resolve worker_id from request header or generate one.
     */
    private function resolveWorkerId(Request $request): string
    {
        return $request->header('X-Worker-Id')
            ?? gethostname() . ':' . getmypid();
    }

    // ══════════════════════════════════════════════════════════════
    // STATUS
    // GET /api/v1/telegram-polling/status/{channelConnectionId}
    // ══════════════════════════════════════════════════════════════

    public function status(string $channelConnectionId): \Illuminate\Http\JsonResponse
    {
        $result = $this->makeService($channelConnectionId);
        if ($result['error'] ?? false) {
            return $this->error($result['error'], 404);
        }

        $status = $result['service']->getStatus();
        return $this->ok($status);
    }

    // ══════════════════════════════════════════════════════════════
    // START
    // POST /api/v1/telegram-polling/start/{channelConnectionId}
    // ══════════════════════════════════════════════════════════════

    public function start(Request $request, string $channelConnectionId): \Illuminate\Http\JsonResponse
    {
        $result = $this->makeService($channelConnectionId);
        if ($result['error'] ?? false) {
            return $this->error($result['error'], 404);
        }

        $workerId = $this->resolveWorkerId($request);
        $outcome = $result['service']->startPolling($workerId);

        if (!$outcome['went_ok']) {
            return $this->error($outcome['message']);
        }

        return $this->ok([
            'worker_id' => $workerId,
            'session_id' => $outcome['session_id'] ?? null,
            'channel_connection_id' => $channelConnectionId,
        ], 'Polling session started.', 201);
    }

    // ══════════════════════════════════════════════════════════════
    // STOP
    // POST /api/v1/telegram-polling/stop/{channelConnectionId}
    // ══════════════════════════════════════════════════════════════

    public function stop(Request $request, string $channelConnectionId): \Illuminate\Http\JsonResponse
    {
        $result = $this->makeService($channelConnectionId);
        if ($result['error'] ?? false) {
            return $this->error($result['error'], 404);
        }

        $workerId = $this->resolveWorkerId($request);
        $outcome = $result['service']->stopPolling($workerId);

        if (!$outcome['went_ok']) {
            return $this->error($outcome['message'], 404);
        }

        return $this->ok([
            'worker_id' => $workerId,
            'channel_connection_id' => $channelConnectionId,
        ], 'Polling session stopped.');
    }

    // ══════════════════════════════════════════════════════════════
    // POLL ONCE (manual single poll cycle)
    // POST /api/v1/telegram-polling/poll/{channelConnectionId}
    //
    // Request body (optional):
    //   updates: array  — pass updates here to have them auto-acknowledged
    // ══════════════════════════════════════════════════════════════

    public function poll(Request $request, string $channelConnectionId): \Illuminate\Http\JsonResponse
    {
        $result = $this->makeService($channelConnectionId);
        if ($result['error'] ?? false) {
            return $this->error($result['error'], 404);
        }

        $workerId = $this->resolveWorkerId($request);
        $outcome = $result['service']->pollOnce($workerId);

        if (!$outcome['went_ok'] && !($outcome['is_idle'] ?? false)) {
            return $this->error($outcome['error'] ?? 'Poll failed.');
        }

        // Auto-acknowledge if updates were passed in body
        $passedUpdates = $request->input('updates', []);
        if (!empty($passedUpdates)) {
            $result['service']->acknowledgeUpdates($workerId, $passedUpdates);
        } elseif (!empty($outcome['updates'])) {
            // Otherwise auto-acknowledge the updates we just fetched
            $result['service']->acknowledgeUpdates($workerId, $outcome['updates']);
        }

        return $this->ok([
            'worker_id' => $workerId,
            'channel_connection_id' => $channelConnectionId,
            'updates_count' => count($outcome['updates'] ?? []),
            'updates' => $outcome['updates'] ?? [],
            'is_idle' => $outcome['is_idle'] ?? false,
            'polled_at' => now()->toISOString(),
        ], 'Poll cycle complete.');
    }

    // ══════════════════════════════════════════════════════════════
    // ACKNOWLEDGE
    // POST /api/v1/telegram-polling/acknowledge/{channelConnectionId}
    //
    // Request body:
    //   updates: array  — required; the batch of updates to mark as processed
    // ══════════════════════════════════════════════════════════════

    public function acknowledge(Request $request, string $channelConnectionId): \Illuminate\Http\JsonResponse
    {
        $request->validate([
            'updates' => 'required|array',
        ]);

        $result = $this->makeService($channelConnectionId);
        if ($result['error'] ?? false) {
            return $this->error($result['error'], 404);
        }

        $workerId = $this->resolveWorkerId($request);
        $updates = $request->input('updates', []);

        $result['service']->acknowledgeUpdates($workerId, $updates);

        $lastId = null;
        if (!empty($updates)) {
            $last = end($updates);
            $lastId = $last['update_id'] ?? null;
        }

        return $this->ok([
            'worker_id' => $workerId,
            'channel_connection_id' => $channelConnectionId,
            'acknowledged_count' => count($updates),
            'next_offset' => $lastId !== null ? $lastId + 1 : null,
        ], 'Updates acknowledged.');
    }

    // ══════════════════════════════════════════════════════════════
    // SETTINGS
    // PATCH /api/v1/telegram-polling/settings/{channelConnectionId}
    //
    // Request body (all optional):
    //   polling_timeout_secs:       int     — long-poll timeout (1-60)
    //   polling_allowed_updates:   array   — update types to receive
    //   max_consecutive_errors:    int     — error budget before marking error state
    // ══════════════════════════════════════════════════════════════

    public function updateSettings(Request $request, string $channelConnectionId): \Illuminate\Http\JsonResponse
    {
        $result = $this->makeService($channelConnectionId);
        if ($result['error'] ?? false) {
            return $this->error($result['error'], 404);
        }

        $settings = $request->only([
            'polling_timeout_secs',
            'polling_allowed_updates',
            'max_consecutive_errors',
        ]);

        if (isset($settings['polling_timeout_secs'])) {
            $settings['polling_timeout_secs'] = (int) $settings['polling_timeout_secs'];
        }
        if (isset($settings['max_consecutive_errors'])) {
            $settings['max_consecutive_errors'] = (int) $settings['max_consecutive_errors'];
        }

        $outcome = $result['service']->updateSettings($settings);

        if (!$outcome['went_ok']) {
            return $this->error($outcome['message']);
        }

        // Fetch and return updated status
        $status = $result['service']->getStatus();
        return $this->ok($status, 'Polling settings updated.');
    }

    // ══════════════════════════════════════════════════════════════
    // LIST SESSIONS
    // GET /api/v1/telegram-polling/sessions/{channelConnectionId}
    //
    // Returns all polling sessions (active + historical) for this channel.
    // ══════════════════════════════════════════════════════════════

    public function listSessions(string $channelConnectionId): \Illuminate\Http\JsonResponse
    {
        $result = $this->makeService($channelConnectionId);
        if ($result['error'] ?? false) {
            return $this->error($result['error'], 404);
        }

        // Get bot config
        $configRows = $this->db->get('telegram_bot_configs', [
            'channel_connection_id' => "eq.{$channelConnectionId}",
        ]);

        if (empty($configRows) || !is_array($configRows[0] ?? null)) {
            return $this->error('Bot config not found.', 404);
        }

        $configId = $configRows[0]['id'];

        // Get sessions
        $sessions = $this->db->get('telegram_polling_sessions', [
            'telegram_bot_config_id' => "eq.{$configId}",
            'order' => 'created_at.desc',
        ]);

        return $this->ok([
            'config' => $configRows[0],
            'sessions' => is_array($sessions) ? $sessions : [],
        ]);
    }
}
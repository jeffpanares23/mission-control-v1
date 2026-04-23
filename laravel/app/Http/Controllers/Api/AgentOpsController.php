<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use App\Services\SupabaseService;
use App\Services\TelegramPollingService;

/**
 * AgentOpsController
 *
 * Powers the AI Agent Operations Dashboard — channel management,
 * cron job monitoring, knowledge file overview, and operational insights.
 * All responses are wrapped in BaseApiController::ok() via the parent
 * controller trait, producing { success: true, message: "...", data: {...} }.
 */
class AgentOpsController extends Controller
{
    public function __construct(
        private SupabaseService $db,
    ) {}

    // ══════════════════════════════════════════════════════════════
    // HELPER — return ok() wrapped data (mimics BaseApiController::ok)
    // ══════════════════════════════════════════════════════════════
    private function ok(mixed $data, string $message = 'OK', int $code = 200): \Illuminate\Http\JsonResponse
    {
        return response()->json([
            'success' => true,
            'message' => $message,
            'data' => $data,
        ], $code);
    }

    private function error(string $message, int $code = 400): \Illuminate\Http\JsonResponse
    {
        return response()->json([
            'success' => false,
            'message' => $message,
        ], $code);
    }

    // ══════════════════════════════════════════════════════════════
    // AGENT OPS DASHBOARD SUMMARY
    // GET /api/v1/agent-ops/dashboard
    // ══════════════════════════════════════════════════════════════
    public function dashboard(Request $request): \Illuminate\Http\JsonResponse
    {
        $user = $request->attributes->get('user');

        return $this->ok([
            'metrics' => $this->mockMetrics(),
            'channels' => $this->mockChannels(),
            'recent_tasks' => $this->mockTasks(),
            'active_insights' => $this->mockInsights(),
        ]);
    }

    // ══════════════════════════════════════════════════════════════
    // CHANNEL OPERATIONS
    // ══════════════════════════════════════════════════════════════

    /**
     * GET /api/v1/agent-ops/channels
     */
    public function channels(Request $request): \Illuminate\Http\JsonResponse
    {
        return $this->ok($this->mockChannels());
    }

    /**
     * GET /api/v1/agent-ops/channels/{id}
     */
    public function channelDetail(Request $request, string $id): \Illuminate\Http\JsonResponse
    {
        $channels = $this->mockChannels();
        $channel = collect($channels)->firstWhere('id', $id);

        if (!$channel) {
            return response()->json([
                'success' => false,
                'message' => 'Channel not found.',
            ], 404);
        }

        return $this->ok($channel);
    }

    /**
     * POST /api/v1/agent-ops/channels/{id}/pause-agent
     */
    public function pauseChannelAgent(Request $request, string $id): \Illuminate\Http\JsonResponse
    {
        $channel = $this->resolveChannel($id);
        if ($channel instanceof \Illuminate\Http\JsonResponse) {
            return $channel;
        }

        if (($channel['channel'] ?? '') !== 'telegram') {
            return $this->error('Only Telegram channels support agent pause/resume via polling.', 422);
        }

        $result = $this->telegramPollingAction($id, 'stop');
        if ($result instanceof \Illuminate\Http\JsonResponse) {
            return $result;
        }

        // Mark the agent as idle on this channel
        $this->db->update('ai_agents',
            ['id' => $channel['agent_id'] ?? null],
            ['status' => 'idle', 'current_task_id' => null]
        );

        return $this->ok([
            'channel_id' => $id,
            'agent_action' => 'paused',
            'paused_at' => now()->toISOString(),
        ], 'Agent paused on channel.');
    }

    /**
     * POST /api/v1/agent-ops/channels/{id}/resume-agent
     */
    public function resumeChannelAgent(Request $request, string $id): \Illuminate\Http\JsonResponse
    {
        $channel = $this->resolveChannel($id);
        if ($channel instanceof \Illuminate\Http\JsonResponse) {
            return $channel;
        }

        if (($channel['channel'] ?? '') !== 'telegram') {
            return $this->error('Only Telegram channels support agent pause/resume via polling.', 422);
        }

        $result = $this->telegramPollingAction($id, 'start');
        if ($result instanceof \Illuminate\Http\JsonResponse) {
            return $result;
        }

        return $this->ok([
            'channel_id' => $id,
            'agent_action' => 'resumed',
            'resumed_at' => now()->toISOString(),
        ], 'Agent resumed on channel.');
    }

    /**
     * POST /api/v1/agent-ops/channels/{id}/reconnect
     * Stop polling then start polling (full reconnection cycle).
     */
    public function reconnectChannel(Request $request, string $id): \Illuminate\Http\JsonResponse
    {
        $channel = $this->resolveChannel($id);
        if ($channel instanceof \Illuminate\Http\JsonResponse) {
            return $channel;
        }

        if (($channel['channel'] ?? '') !== 'telegram') {
            return $this->error('Only Telegram channels support reconnection via polling.', 422);
        }

        // Stop first
        $this->telegramPollingAction($id, 'stop');

        // Then start fresh
        $result = $this->telegramPollingAction($id, 'start');
        if ($result instanceof \Illuminate\Http\JsonResponse) {
            return $result;
        }

        return $this->ok([
            'channel_id' => $id,
            'reconnect_started_at' => now()->toISOString(),
            'message' => 'Channel reconnected successfully.',
        ], 'Channel reconnection initiated.');
    }

    /**
     * POST /api/v1/agent-ops/channels/{id}/trigger-cron
     * Manually trigger the scheduled tasks processor for this channel.
     */
    public function triggerChannelCron(Request $request, string $id): \Illuminate\Http\JsonResponse
    {
        $channel = $this->resolveChannel($id);
        if ($channel instanceof \Illuminate\Http\JsonResponse) {
            return $channel;
        }

        // Run the schedule:process command
        \Illuminate\Support\Facades\Artisan::call('schedule:process', [], $output = new \Symfony\Component\Console\Output\BufferedOutput());

        return $this->ok([
            'channel_id' => $id,
            'triggered_at' => now()->toISOString(),
            'command' => 'schedule:process',
            'output' => trim($output->fetch()),
        ], 'Scheduled tasks processor triggered.');
    }

    // ══════════════════════════════════════════════════════════════
    // AGENT TASK ASSIGNMENT
    // POST /api/v1/agent-ops/tasks/{taskId}/assign
    // ══════════════════════════════════════════════════════════════

    /**
     * POST /api/v1/agent-ops/tasks/{taskId}/assign
     * Assign an AI agent to a task.
     */
    public function assignAgentToTask(Request $request, string $taskId): \Illuminate\Http\JsonResponse
    {
        $request->validate([
            'agent_id' => 'required|uuid',
        ]);

        $agentId = $request->input('agent_id');
        $user = $request->attributes->get('user');
        $userId = $user['id'] ?? null;

        // Verify agent belongs to this user
        $agents = $this->db->get('ai_agents', [
            'id' => "eq.{$agentId}",
            'user_id' => "eq.{$userId}",
        ]);
        if (empty($agents) || !is_array($agents[0] ?? null)) {
            return $this->error('Agent not found.', 404);
        }

        // Verify task belongs to this user
        $tasks = $this->db->get('tasks', [
            'id' => "eq.{$taskId}",
            'user_id' => "eq.{$userId}",
        ]);
        if (empty($tasks) || !is_array($tasks[0] ?? null)) {
            return $this->error('Task not found.', 404);
        }

        // Assign agent to task
        $this->db->update('tasks', ['id' => $taskId], [
            'agent_id' => $agentId,
            'trigger_source' => 'agent_dispatch',
        ]);

        // Update agent status
        $this->db->update('ai_agents', ['id' => $agentId], [
            'status' => 'acting',
            'current_task_id' => $taskId,
        ]);

        // Log activity
        $this->db->insert('activity_log', [
            'user_id' => $userId,
            'action_type' => 'task_assigned',
            'entity_type' => 'task',
            'entity_id' => $taskId,
            'metadata' => ['agent_id' => $agentId],
        ]);

        return $this->ok([
            'task_id' => $taskId,
            'agent_id' => $agentId,
            'assigned_at' => now()->toISOString(),
        ], 'Agent assigned to task.');
    }

    // ══════════════════════════════════════════════════════════════
    // PRIVATE HELPERS
    // ══════════════════════════════════════════════════════════════

    private function resolveChannel(string $channelId): array|\Illuminate\Http\JsonResponse
    {
        $channel = $this->db->get('channel_connections', ['id' => "eq.{$channelId}"]);
        if (empty($channel) || !is_array($channel[0] ?? null)) {
            return $this->error('Channel not found.', 404);
        }
        return $channel[0];
    }

    private function telegramPollingAction(string $channelConnectionId, string $action): \Illuminate\Http\JsonResponse|array
    {
        $channel = $this->db->get('channel_connections', ['id' => "eq.{$channelConnectionId}"]);
        if (empty($channel) || !is_array($channel[0] ?? null)) {
            return $this->error('Channel not found.', 404);
        }
        $conn = $channel[0];

        if (empty($conn['bot_token'])) {
            return $this->error('No bot_token on this channel connection.', 422);
        }

        $workerId = 'ops-panel:' . gethostname() . ':' . getmypid();
        $service = new TelegramPollingService($this->db, $conn['bot_token'], $channelConnectionId);

        if ($action === 'start') {
            $result = $service->startPolling($workerId);
        } else {
            $result = $service->stopPolling($workerId);
        }

        if (!$result['went_ok']) {
            return $this->error($result['message'], 422);
        }

        return $result;
    }

    // ══════════════════════════════════════════════════════════════
    // CRON JOBS
    // ══════════════════════════════════════════════════════════════

    /**
     * GET /api/v1/agent-ops/cron-jobs
     * Query params: status, channel_id
     */
    public function cronJobs(Request $request): \Illuminate\Http\JsonResponse
    {
        $status = $request->query('status');
        $channelId = $request->query('channel_id');

        $jobs = $this->mockCronJobs();

        if ($status) {
            $jobs = array_values(array_filter($jobs, fn($j) => $j['status'] === $status));
        }

        if ($channelId) {
            $jobs = array_values(array_filter($jobs, fn($j) => ($j['channel_id'] ?? '') === $channelId));
        }

        return $this->ok($jobs);
    }

    /**
     * POST /api/v1/agent-ops/cron-jobs/{id}/run
     */
    public function runCronJob(Request $request, string $id): \Illuminate\Http\JsonResponse
    {
        return $this->ok([
            'cron_job_id' => $id,
            'run_id' => 'run_' . uniqid(),
            'triggered_at' => now()->toISOString(),
            'estimated_duration_ms' => 3000,
        ], 'Cron job triggered manually.');
    }

    /**
     * POST /api/v1/agent-ops/cron-jobs/{id}/pause
     */
    public function pauseCronJob(Request $request, string $id): \Illuminate\Http\JsonResponse
    {
        return $this->ok([
            'cron_job_id' => $id,
            'status' => 'paused',
            'paused_at' => now()->toISOString(),
        ], 'Cron job paused.');
    }

    /**
     * POST /api/v1/agent-ops/cron-jobs/{id}/resume
     */
    public function resumeCronJob(Request $request, string $id): \Illuminate\Http\JsonResponse
    {
        return $this->ok([
            'cron_job_id' => $id,
            'status' => 'active',
            'resumed_at' => now()->toISOString(),
        ], 'Cron job resumed.');
    }

    // ══════════════════════════════════════════════════════════════
    // KNOWLEDGE FILES
    // ══════════════════════════════════════════════════════════════

    /**
     * GET /api/v1/agent-ops/knowledge-files
     * Query params: channel_id, status, agent_id, file_type, tags
     */
    public function knowledgeFiles(Request $request): \Illuminate\Http\JsonResponse
    {
        $channelId = $request->query('channel_id');
        $agentId   = $request->query('agent_id');
        $status    = $request->query('status');
        $fileType  = $request->query('file_type');
        $tag       = $request->query('tag');

        $files = $this->mockKnowledgeFiles();

        if ($channelId) {
            $files = array_values(array_filter($files, fn($f) => ($f['channel_id'] ?? '') === $channelId));
        }

        if ($agentId) {
            $files = array_values(array_filter($files, fn($f) => ($f['agent_id'] ?? '') === $agentId));
        }

        if ($status) {
            $files = array_values(array_filter($files, fn($f) => $f['status'] === $status));
        }

        if ($fileType) {
            $files = array_values(array_filter($files, fn($f) => $f['file_type'] === $fileType));
        }

        if ($tag) {
            $files = array_values(array_filter($files, fn($f) => in_array($tag, $f['tags'] ?? [])));
        }

        return $this->ok($files);
    }

    /**
     * GET /api/v1/agent-ops/knowledge-files/{id}
     * Returns a single file with content for preview.
     */
    public function getKnowledgeFile(string $id): \Illuminate\Http\JsonResponse
    {
        $files = $this->mockKnowledgeFiles();
        $file = null;
        foreach ($files as $f) {
            if ($f['id'] === $id) { $file = $f; break; }
        }

        if (!$file) {
            return response()->json(['success' => false, 'message' => 'File not found', 'data' => null], 404);
        }

        // Attach mock markdown content for preview
        $file['content'] = $this->mockKnowledgeFileContent($file);

        return $this->ok($file);
    }

    /**
     * PATCH /api/v1/agent-ops/knowledge-files/{id}
     * Body: {
     *   is_enabled?: bool,
     *   status?: 'active' | 'archived' | 'disabled',
     *   channel_id?: string,
     *   agent_id?: string,
     *   instruction_weight?: float,
     *   tags?: string[]
     * }
     */
    public function updateKnowledgeFile(Request $request, string $id): \Illuminate\Http\JsonResponse
    {
        $files = $this->mockKnowledgeFiles();
        $file = null;
        foreach ($files as $f) {
            if ($f['id'] === $id) { $file = $f; break; }
        }

        if (!$file) {
            return response()->json(['success' => false, 'message' => 'File not found', 'data' => null], 404);
        }

        // Apply updates
        if ($request->has('is_enabled')) {
            $file['is_enabled'] = (bool) $request->input('is_enabled');
            $file['status'] = $file['is_enabled'] ? 'active' : 'disabled';
        }

        if ($request->has('status')) {
            $newStatus = $request->input('status');
            if (in_array($newStatus, ['active', 'archived', 'disabled'])) {
                $file['status'] = $newStatus;
                $file['is_enabled'] = $newStatus !== 'disabled';
            }
        }

        if ($request->has('channel_id')) {
            $file['channel_id'] = $request->input('channel_id') ?: null;
        }

        if ($request->has('agent_id')) {
            $file['agent_id'] = $request->input('agent_id') ?: null;
        }

        if ($request->has('instruction_weight')) {
            $file['instruction_weight'] = (float) $request->input('instruction_weight');
        }

        if ($request->has('tags')) {
            $file['tags'] = $request->input('tags', []);
        }

        $file['updated_at'] = now()->toISOString();

        return $this->ok($file, 'Knowledge file updated.');
    }

    // ══════════════════════════════════════════════════════════════
    // TELEGRAM POLLING
    // ══════════════════════════════════════════════════════════════

    /**
     * GET /api/v1/agent-ops/polling
     * Returns aggregated Telegram polling overview from real DB data
     * alongside mock session/agent breakdown.
     */
    public function pollingOverview(Request $request): \Illuminate\Http\JsonResponse
    {
        $user = $request->attributes->get('user');
        $userId = $user['id'] ?? null;

        if (!$userId) {
            return $this->ok($this->mockPollingData(), 'Polling overview (mock)');
        }

        // Attempt real data load; fall back to mock on failure
        try {
            $telegramChannels = $this->fetchTelegramPollingData($userId);
            if (!empty($telegramChannels)) {
                return $this->ok($telegramChannels, 'Polling overview');
            }
        } catch (\Throwable $e) {
            // Fall through to mock
        }

        return $this->ok($this->mockPollingData(), 'Polling overview (mock)');
    }

    /**
     * GET /api/v1/agent-ops/polling/{channelConnectionId}
     * Per-channel polling detail.
     */
    public function pollingDetail(Request $request, string $channelConnectionId): \Illuminate\Http\JsonResponse
    {
        $user = $request->attributes->get('user');

        $config = $this->db($request)->get('telegram_bot_configs', [
            'channel_connection_id' => "eq.{$channelConnectionId}",
        ]);

        $sessions = [];
        if (!empty($config) && is_array($config[0] ?? null)) {
            $sessions = $this->db($request)->get('telegram_polling_sessions', [
                'telegram_bot_config_id' => "eq.{$config[0]['id']}",
                'order' => 'created_at.desc',
            ]);
        }

        $channel = $this->db($request)->get('channel_connections', [
            'id' => "eq.{$channelConnectionId}",
        ]);

        $data = [
            'channel' => $channel[0] ?? null,
            'bot_config' => $config[0] ?? null,
            'sessions' => is_array($sessions) ? $sessions : [],
        ];

        return $this->ok($data, 'Polling detail');
    }

    // ══════════════════════════════════════════════════════════════
    // MOCK DATA HELPERS
    // ══════════════════════════════════════════════════════════════

    private function db(Request $request): \App\Services\SupabaseService
    {
        return app(\App\Services\SupabaseService::class);
    }

    private function fetchTelegramPollingData(string $userId): array
    {
        $channels = $this->db(request())->get('channel_connections', [
            'user_id' => "eq.{$userId}",
            'channel' => 'eq.telegram',
            'is_active' => 'eq.true',
        ]);

        if (empty($channels) || !is_array($channels)) {
            return [];
        }

        return array_map(function ($ch) {
            $configRows = $this->db(request())->get('telegram_bot_configs', [
                'channel_connection_id' => "eq.{$ch['id']}",
            ]);

            $config = $configRows[0] ?? null;
            $sessions = [];

            if ($config) {
                $sessionRows = $this->db(request())->get('telegram_polling_sessions', [
                    'telegram_bot_config_id' => "eq.{$config['id']}",
                    'order' => 'created_at.desc',
                ]);
                $sessions = is_array($sessionRows) ? $sessionRows : [];
            }

            return [
                'channel_connection_id' => $ch['id'],
                'channel_name' => $ch['channel_name'] ?? $ch['channel'],
                'bot_username' => $ch['channel_meta']['bot_username'] ?? null,
                'polling_enabled' => $config['polling_enabled'] ?? false,
                'session_status' => $config['session_status'] ?? 'unknown',
                'polling_offset' => $config['polling_offset'] ?? 0,
                'last_update_id' => $config['last_update_id'] ?? null,
                'updates_processed' => $config['updates_processed'] ?? 0,
                'updates_failed' => $config['updates_failed'] ?? 0,
                'consecutive_errors' => $config['consecutive_errors'] ?? 0,
                'session_error' => $config['session_error'] ?? null,
                'last_poll_started_at' => $config['last_poll_started_at'] ?? null,
                'last_poll_completed_at' => $config['last_poll_completed_at'] ?? null,
                'last_polled_at' => $ch['last_polled_at'] ?? null,
                'sessions_count' => count($sessions),
                'active_sessions' => array_values(array_filter($sessions, fn($s) => $s['is_active'] ?? false)),
            ];
        }, $channels);
    }

private function mockPollingData(): array
    {
        return [
            'total_telegram_channels' => 3,
            'active_polling_channels' => 2,
            'total_active_sessions' => 2,
            'total_updates_processed' => 1847,
            'total_updates_failed' => 12,
            'channels' => [
                [
                    'channel_connection_id' => 'ch_telegram_main',
                    'channel_name' => 'OpenClaw Main',
                    'bot_username' => '@OpenClawBot',
                    'polling_enabled' => true,
                    'session_status' => 'running',
                    'polling_offset' => 42871,
                    'last_update_id' => 42870,
                    'updates_processed' => 1240,
                    'updates_failed' => 3,
                    'consecutive_errors' => 0,
                    'session_error' => null,
                    'last_poll_started_at' => now()->subSeconds(30)->toISOString(),
                    'last_poll_completed_at' => now()->subSeconds(12)->toISOString(),
                    'last_polled_at' => now()->subSeconds(12)->toISOString(),
                    'sessions_count' => 1,
                    'active_sessions' => [
                        [
                            'worker_id' => gethostname() . ':12345',
                            'is_active' => true,
                            'total_cycles' => 412,
                            'total_updates' => 1240,
                            'last_poll_at' => now()->subSeconds(12)->toISOString(),
                            'last_poll_duration_ms' => 340,
                            'worker_heartbeat_at' => now()->subSeconds(5)->toISOString(),
                        ],
                    ],
                ],
                [
                    'channel_connection_id' => 'ch_telegram_alerts',
                    'channel_name' => 'Alerts Bot',
                    'bot_username' => '@AlertsClawBot',
                    'polling_enabled' => true,
                    'session_status' => 'running',
                    'polling_offset' => 9914,
                    'last_update_id' => 9913,
                    'updates_processed' => 607,
                    'updates_failed' => 9,
                    'consecutive_errors' => 0,
                    'session_error' => null,
                    'last_poll_started_at' => now()->subSeconds(45)->toISOString(),
                    'last_poll_completed_at' => now()->subSeconds(20)->toISOString(),
                    'last_polled_at' => now()->subSeconds(20)->toISOString(),
                    'sessions_count' => 1,
                    'active_sessions' => [
                        [
                            'worker_id' => gethostname() . ':67890',
                            'is_active' => true,
                            'total_cycles' => 188,
                            'total_updates' => 607,
                            'last_poll_at' => now()->subSeconds(20)->toISOString(),
                            'last_poll_duration_ms' => 180,
                            'worker_heartbeat_at' => now()->subSeconds(8)->toISOString(),
                        ],
                    ],
                ],
                [
                    'channel_connection_id' => 'ch_telegram_offline',
                    'channel_name' => 'Legacy Bot',
                    'bot_username' => '@LegacyClawBot',
                    'polling_enabled' => false,
                    'session_status' => 'idle',
                    'polling_offset' => 0,
                    'last_update_id' => null,
                    'updates_processed' => 0,
                    'updates_failed' => 0,
                    'consecutive_errors' => 5,
                    'session_error' => 'Connection refused: bot token revoked',
                    'last_poll_started_at' => now()->subDays(3)->toISOString(),
                    'last_poll_completed_at' => now()->subDays(3)->toISOString(),
                    'last_polled_at' => now()->subDays(3)->toISOString(),
                    'sessions_count' => 1,
                    'active_sessions' => [],
                ],
            ],
        ];
    }

    private function mockMetrics(): array
    {
        return [
            'total_channels' => 4,
            'active_channels' => 2,
            'inactive_channels' => 1,
            'total_agents' => 3,
            'active_agents' => 2,
            'total_cron_jobs' => 6,
            'running_cron_jobs' => 1,
            'failed_cron_jobs' => 1,
            'paused_cron_jobs' => 2,
            'pending_tasks' => 12,
            'in_progress_tasks' => 5,
            'done_tasks' => 34,
            'blocked_tasks' => 2,
            'knowledge_files' => 8,
            'active_knowledge_files' => 6,
            'alerts_count' => 5,
            'polling_enabled_channels' => 2,
            'polling_sessions_active' => 2,
            'polling_updates_processed_today' => 1847,
        ];
    }

    private function mockChannels(): array
    {
        return [
            [
                'id' => 'ch_telegram_main',
                'channel' => 'telegram',
                'is_active' => true,
                'channel_name' => 'OpenClaw Main',
                'channel_meta' => ['bot_username' => '@OpenClawBot', 'chat_count' => 1247],
                'last_ping_at' => now()->subMinutes(2)->toISOString(),
                'created_at' => now()->subDays(30)->toISOString(),
                'updated_at' => now()->subMinutes(2)->toISOString(),
                'assigned_agents' => [
                    [
                        'id' => 'aa_001',
                        'agent_id' => 'agent_01',
                        'agent_name' => 'Hermes Prime',
                        'agent_status' => 'idle',
                        'channel_id' => 'ch_telegram_main',
                        'channel_name' => 'OpenClaw Main',
                        'channel_type' => 'telegram',
                        'is_primary' => true,
                        'is_active' => true,
                        'assigned_at' => now()->subDays(20)->toISOString(),
                        'tasks_count' => 18,
                    ],
                    [
                        'id' => 'aa_002',
                        'agent_id' => 'agent_02',
                        'agent_name' => 'Sentinel',
                        'agent_status' => 'thinking',
                        'channel_id' => 'ch_telegram_main',
                        'channel_name' => 'OpenClaw Main',
                        'channel_type' => 'telegram',
                        'is_primary' => false,
                        'is_active' => true,
                        'assigned_at' => now()->subDays(10)->toISOString(),
                        'tasks_count' => 7,
                    ],
                ],
                'pending_task_count' => 5,
                'last_activity_at' => now()->subMinutes(3)->toISOString(),
                'cron_jobs_count' => 3,
            ],
            [
                'id' => 'ch_telegram_alerts',
                'channel' => 'telegram',
                'is_active' => true,
                'channel_name' => 'Alerts Bot',
                'channel_meta' => ['bot_username' => '@AlertsClawBot', 'chat_count' => 89],
                'last_ping_at' => now()->subHours(1)->toISOString(),
                'created_at' => now()->subDays(15)->toISOString(),
                'updated_at' => now()->subHours(1)->toISOString(),
                'assigned_agents' => [
                    [
                        'id' => 'aa_003',
                        'agent_id' => 'agent_03',
                        'agent_name' => 'AlertDog',
                        'agent_status' => 'idle',
                        'channel_id' => 'ch_telegram_alerts',
                        'channel_name' => 'Alerts Bot',
                        'channel_type' => 'telegram',
                        'is_primary' => true,
                        'is_active' => true,
                        'assigned_at' => now()->subDays(12)->toISOString(),
                        'tasks_count' => 31,
                    ],
                ],
                'pending_task_count' => 2,
                'last_activity_at' => now()->subHours(1)->toISOString(),
                'cron_jobs_count' => 2,
            ],
            [
                'id' => 'ch_discord_ops',
                'channel' => 'discord',
                'is_active' => true,
                'channel_name' => 'Discord Operations',
                'channel_meta' => ['guild_name' => 'Mission Control', 'member_count' => 340],
                'last_ping_at' => now()->subMinutes(10)->toISOString(),
                'created_at' => now()->subDays(7)->toISOString(),
                'updated_at' => now()->subMinutes(10)->toISOString(),
                'assigned_agents' => [
                    [
                        'id' => 'aa_004',
                        'agent_id' => 'agent_01',
                        'agent_name' => 'Hermes Prime',
                        'agent_status' => 'acting',
                        'channel_id' => 'ch_discord_ops',
                        'channel_name' => 'Discord Operations',
                        'channel_type' => 'discord',
                        'is_primary' => true,
                        'is_active' => true,
                        'assigned_at' => now()->subDays(5)->toISOString(),
                        'tasks_count' => 12,
                    ],
                ],
                'pending_task_count' => 8,
                'last_activity_at' => now()->subMinutes(10)->toISOString(),
                'cron_jobs_count' => 1,
            ],
            [
                'id' => 'ch_telegram_offline',
                'channel' => 'telegram',
                'is_active' => false,
                'channel_name' => 'Legacy Bot',
                'channel_meta' => ['bot_username' => '@LegacyClawBot', 'chat_count' => 12],
                'last_ping_at' => now()->subDays(3)->toISOString(),
                'created_at' => now()->subDays(60)->toISOString(),
                'updated_at' => now()->subDays(3)->toISOString(),
                'assigned_agents' => [],
                'pending_task_count' => 0,
                'last_activity_at' => now()->subDays(3)->toISOString(),
                'cron_jobs_count' => 0,
            ],
        ];
    }

    private function mockCronJobs(): array
    {
        return [
            [
                'id' => 'cj_001',
                'name' => 'Health Check Pulse',
                'description' => 'Checks all channel connections every 5 minutes',
                'cron_expression' => '*/5 * * * *',
                'schedule' => 'Every 5 minutes',
                'trigger_type' => 'schedule',
                'channel_id' => 'ch_telegram_main',
                'channel_name' => 'OpenClaw Main',
                'agent_id' => 'agent_01',
                'agent_name' => 'Hermes Prime',
                'is_active' => true,
                'status' => 'active',
                'last_run_at' => now()->subMinutes(5)->toISOString(),
                'last_run_duration_ms' => 234,
                'last_run_result' => 'success',
                'next_run_at' => now()->addMinutes(5)->toISOString(),
                'run_count' => 8432,
                'metadata' => [],
                'created_at' => now()->subDays(30)->toISOString(),
                'updated_at' => now()->subMinutes(5)->toISOString(),
            ],
            [
                'id' => 'cj_002',
                'name' => 'Alert Digest',
                'description' => 'Sends daily alert summary to alerts channel',
                'cron_expression' => '0 9 * * *',
                'schedule' => 'Daily at 9:00 AM',
                'trigger_type' => 'schedule',
                'channel_id' => 'ch_telegram_alerts',
                'channel_name' => 'Alerts Bot',
                'agent_id' => 'agent_03',
                'agent_name' => 'AlertDog',
                'is_active' => true,
                'status' => 'running',
                'last_run_at' => now()->subHours(2)->toISOString(),
                'last_run_duration_ms' => 1847,
                'last_run_result' => 'success',
                'next_run_at' => now()->addHours(7)->toISOString(),
                'run_count' => 128,
                'metadata' => [],
                'created_at' => now()->subDays(15)->toISOString(),
                'updated_at' => now()->subHours(2)->toISOString(),
            ],
            [
                'id' => 'cj_003',
                'name' => 'Task Sync',
                'description' => 'Syncs tasks between Supabase and Discord',
                'cron_expression' => '*/10 * * * *',
                'schedule' => 'Every 10 minutes',
                'trigger_type' => 'schedule',
                'channel_id' => 'ch_discord_ops',
                'channel_name' => 'Discord Operations',
                'agent_id' => 'agent_01',
                'agent_name' => 'Hermes Prime',
                'is_active' => true,
                'status' => 'active',
                'last_run_at' => now()->subMinutes(10)->toISOString(),
                'last_run_duration_ms' => 890,
                'last_run_result' => 'success',
                'next_run_at' => now()->addMinutes(10)->toISOString(),
                'run_count' => 3021,
                'metadata' => [],
                'created_at' => now()->subDays(7)->toISOString(),
                'updated_at' => now()->subMinutes(10)->toISOString(),
            ],
            [
                'id' => 'cj_004',
                'name' => 'Knowledge Refresh',
                'description' => 'Refreshes agent knowledge base from CMS',
                'cron_expression' => '0 */4 * * *',
                'schedule' => 'Every 4 hours',
                'trigger_type' => 'schedule',
                'channel_id' => 'ch_telegram_main',
                'channel_name' => 'OpenClaw Main',
                'agent_id' => 'agent_02',
                'agent_name' => 'Sentinel',
                'is_active' => false,
                'status' => 'paused',
                'last_run_at' => now()->subHours(6)->toISOString(),
                'last_run_duration_ms' => 3420,
                'last_run_result' => 'failed',
                'last_run_error' => 'CMS timeout: upstream server not responding',
                'next_run_at' => null,
                'run_count' => 186,
                'metadata' => [],
                'created_at' => now()->subDays(20)->toISOString(),
                'updated_at' => now()->subHours(6)->toISOString(),
            ],
            [
                'id' => 'cj_005',
                'name' => 'Weekly Report',
                'description' => 'Generates and sends weekly operations report',
                'cron_expression' => '0 8 * * 1',
                'schedule' => 'Every Monday at 8 AM',
                'trigger_type' => 'schedule',
                'channel_id' => 'ch_telegram_main',
                'channel_name' => 'OpenClaw Main',
                'agent_id' => 'agent_01',
                'agent_name' => 'Hermes Prime',
                'is_active' => false,
                'status' => 'paused',
                'last_run_at' => now()->subDays(4)->toISOString(),
                'last_run_duration_ms' => 8900,
                'last_run_result' => 'success',
                'next_run_at' => null,
                'run_count' => 18,
                'metadata' => [],
                'created_at' => now()->subDays(30)->toISOString(),
                'updated_at' => now()->subDays(4)->toISOString(),
            ],
            [
                'id' => 'cj_006',
                'name' => 'Conversation Cleanup',
                'description' => 'Archives old conversation sessions',
                'cron_expression' => '0 2 * * *',
                'schedule' => 'Daily at 2 AM',
                'trigger_type' => 'schedule',
                'channel_id' => null,
                'channel_name' => null,
                'agent_id' => 'agent_01',
                'agent_name' => 'Hermes Prime',
                'is_active' => true,
                'status' => 'idle',
                'last_run_at' => now()->subHours(2)->toISOString(),
                'last_run_duration_ms' => 120,
                'last_run_result' => 'success',
                'next_run_at' => now()->addHours(14)->toISOString(),
                'run_count' => 445,
                'metadata' => [],
                'created_at' => now()->subDays(30)->toISOString(),
                'updated_at' => now()->subHours(2)->toISOString(),
            ],
        ];
    }

    private function mockTasks(): array
    {
        return [
            [
                'id' => 'task_001',
                'title' => 'Fix Telegram webhook endpoint',
                'description' => 'Webhook returning 500 on media messages',
                'status' => 'in_progress',
                'priority' => 'high',
                'due_date' => now()->addHours(4)->toISOString(),
                'channel_id' => 'ch_telegram_main',
                'channel_name' => 'OpenClaw Main',
                'agent_id' => 'agent_01',
                'agent_name' => 'Hermes Prime',
                'trigger_source' => 'manual',
                'tags' => ['bug', 'telegram'],
                'position' => 1,
                'column_status' => 'in_progress',
                'metadata' => [],
                'created_at' => now()->subHours(3)->toISOString(),
                'updated_at' => now()->subMinutes(30)->toISOString(),
            ],
            [
                'id' => 'task_002',
                'title' => 'Add Discord rate limit handling',
                'description' => 'Implement exponential backoff for Discord API calls',
                'status' => 'todo',
                'priority' => 'medium',
                'due_date' => now()->addDays(2)->toISOString(),
                'channel_id' => 'ch_discord_ops',
                'channel_name' => 'Discord Operations',
                'agent_id' => 'agent_02',
                'agent_name' => 'Sentinel',
                'trigger_source' => 'cron',
                'tags' => ['enhancement', 'discord'],
                'position' => 2,
                'column_status' => 'todo',
                'metadata' => [],
                'created_at' => now()->subDays(1)->toISOString(),
                'updated_at' => now()->subHours(6)->toISOString(),
            ],
            [
                'id' => 'task_003',
                'title' => 'Update agent system prompt',
                'description' => 'Revise Hermes Prime instructions for new product launch',
                'status' => 'review',
                'priority' => 'high',
                'due_date' => now()->addHours(2)->toISOString(),
                'channel_id' => 'ch_telegram_main',
                'channel_name' => 'OpenClaw Main',
                'agent_id' => 'agent_01',
                'agent_name' => 'Hermes Prime',
                'trigger_source' => 'manual',
                'tags' => ['config', 'agent'],
                'position' => 3,
                'column_status' => 'review',
                'metadata' => [],
                'created_at' => now()->subDays(2)->toISOString(),
                'updated_at' => now()->subHours(1)->toISOString(),
            ],
            [
                'id' => 'task_004',
                'title' => 'Deploy knowledge base refresh cron',
                'description' => 'Set up the CMS-linked knowledge refresh job in production',
                'status' => 'backlog',
                'priority' => 'low',
                'channel_id' => 'ch_telegram_main',
                'channel_name' => 'OpenClaw Main',
                'agent_id' => 'agent_02',
                'agent_name' => 'Sentinel',
                'trigger_source' => 'channel',
                'tags' => ['deployment', 'knowledge'],
                'position' => 1,
                'column_status' => 'backlog',
                'metadata' => [],
                'created_at' => now()->subDays(1)->toISOString(),
                'updated_at' => now()->subDays(1)->toISOString(),
            ],
            [
                'id' => 'task_005',
                'title' => 'Alert threshold tuning',
                'description' => 'Adjust alert sensitivity for production monitoring',
                'status' => 'done',
                'priority' => 'medium',
                'completed_at' => now()->subHours(8)->toISOString(),
                'channel_id' => 'ch_telegram_alerts',
                'channel_name' => 'Alerts Bot',
                'agent_id' => 'agent_03',
                'agent_name' => 'AlertDog',
                'trigger_source' => 'system',
                'tags' => ['monitoring'],
                'position' => 4,
                'column_status' => 'done',
                'metadata' => [],
                'created_at' => now()->subDays(3)->toISOString(),
                'updated_at' => now()->subHours(8)->toISOString(),
            ],
            [
                'id' => 'task_006',
                'title' => 'Telegram bot token rotation',
                'description' => 'Rotate @OpenClawBot token — current one expires soon',
                'status' => 'blocked',
                'priority' => 'urgent',
                'due_date' => now()->addHours(1)->toISOString(),
                'channel_id' => 'ch_telegram_offline',
                'channel_name' => 'Legacy Bot',
                'agent_id' => null,
                'agent_name' => null,
                'trigger_source' => 'manual',
                'tags' => ['security'],
                'position' => 5,
                'column_status' => 'blocked',
                'metadata' => [],
                'created_at' => now()->subHours(12)->toISOString(),
                'updated_at' => now()->subHours(2)->toISOString(),
            ],
        ];
    }

    private function mockInsights(): array
    {
        return [
            [
                'id' => 'ins_001',
                'insight_type' => 'failed_cron',
                'title' => 'Knowledge Refresh failed',
                'message' => 'Last run failed due to CMS timeout. 186 successful runs before this failure.',
                'severity' => 'warning',
                'entity_type' => 'cron',
                'entity_id' => 'cj_004',
                'entity_name' => 'Knowledge Refresh',
                'is_read' => false,
                'is_dismissed' => false,
                'action_url' => '/cron-jobs',
                'metadata' => [],
                'created_at' => now()->subHours(6)->toISOString(),
            ],
            [
                'id' => 'ins_002',
                'insight_type' => 'disconnected_channel',
                'title' => 'Legacy Bot disconnected',
                'message' => 'The Legacy Bot channel has been inactive for 3 days. Last ping: 3 days ago.',
                'severity' => 'critical',
                'entity_type' => 'channel',
                'entity_id' => 'ch_telegram_offline',
                'entity_name' => 'Legacy Bot',
                'is_read' => false,
                'is_dismissed' => false,
                'action_url' => '/channels',
                'metadata' => [],
                'created_at' => now()->subDays(3)->toISOString(),
            ],
            [
                'id' => 'ins_003',
                'insight_type' => 'unassigned_channel',
                'title' => 'No agent on Alerts Bot',
                'message' => 'The Alerts Bot has no primary agent assigned. Tasks are still being created but not processed.',
                'severity' => 'warning',
                'entity_type' => 'channel',
                'entity_id' => 'ch_telegram_alerts',
                'entity_name' => 'Alerts Bot',
                'is_read' => false,
                'is_dismissed' => false,
                'action_url' => '/channels',
                'metadata' => [],
                'created_at' => now()->subHours(1)->toISOString(),
            ],
            [
                'id' => 'ins_004',
                'insight_type' => 'blocked_task',
                'title' => 'Token rotation task blocked',
                'message' => 'Telegram bot token rotation has been pending for 12 hours with no progress.',
                'severity' => 'critical',
                'entity_type' => 'task',
                'entity_id' => 'task_006',
                'entity_name' => 'Telegram bot token rotation',
                'is_read' => false,
                'is_dismissed' => false,
                'action_url' => '/tasks',
                'metadata' => [],
                'created_at' => now()->subHours(2)->toISOString(),
            ],
            [
                'id' => 'ins_005',
                'insight_type' => 'stale_knowledge_file',
                'title' => 'product-v2-launch.md outdated',
                'message' => 'Product launch instructions file has not been updated in 14 days. Consider refreshing for accuracy.',
                'severity' => 'info',
                'entity_type' => 'file',
                'entity_id' => 'kf_003',
                'entity_name' => 'product-v2-launch.md',
                'is_read' => true,
                'is_dismissed' => false,
                'action_url' => '/files',
                'metadata' => [],
                'created_at' => now()->subDays(2)->toISOString(),
            ],
        ];
    }

    private function mockKnowledgeFiles(): array
    {
        return [
            [
                'id' => 'kf_001',
                'filename' => 'agent-instructions.md',
                'title' => 'Agent Core Instructions',
                'path' => '/knowledge/agent-instructions.md',
                'file_size_bytes' => 12480,
                'file_type' => 'markdown',
                'tags' => ['agent', 'instructions', 'core'],
                'channel_id' => 'ch_telegram_main',
                'channel_name' => 'OpenClaw Main',
                'agent_id' => 'agent_01',
                'agent_name' => 'Hermes Prime',
                'is_enabled' => true,
                'status' => 'active',
                'instruction_weight' => 0.9,
                'last_modified_at' => now()->subHours(6)->toISOString(),
                'metadata' => [],
                'created_at' => now()->subDays(30)->toISOString(),
                'updated_at' => now()->subHours(6)->toISOString(),
            ],
            [
                'id' => 'kf_002',
                'filename' => 'discord-guidelines.md',
                'title' => 'Discord Operations Guidelines',
                'path' => '/knowledge/discord-guidelines.md',
                'file_size_bytes' => 8320,
                'file_type' => 'markdown',
                'tags' => ['discord', 'guidelines'],
                'channel_id' => 'ch_discord_ops',
                'channel_name' => 'Discord Operations',
                'agent_id' => 'agent_01',
                'agent_name' => 'Hermes Prime',
                'is_enabled' => true,
                'status' => 'active',
                'instruction_weight' => 0.7,
                'last_modified_at' => now()->subDays(2)->toISOString(),
                'metadata' => [],
                'created_at' => now()->subDays(15)->toISOString(),
                'updated_at' => now()->subDays(2)->toISOString(),
            ],
            [
                'id' => 'kf_003',
                'filename' => 'product-v2-launch.md',
                'title' => 'Product V2 Launch Playbook',
                'path' => '/knowledge/product-v2-launch.md',
                'file_size_bytes' => 22100,
                'file_type' => 'markdown',
                'tags' => ['product', 'launch', 'marketing'],
                'channel_id' => 'ch_telegram_main',
                'channel_name' => 'OpenClaw Main',
                'agent_id' => 'agent_02',
                'agent_name' => 'Sentinel',
                'is_enabled' => true,
                'status' => 'active',
                'instruction_weight' => 0.5,
                'last_modified_at' => now()->subDays(14)->toISOString(),
                'metadata' => [],
                'created_at' => now()->subDays(20)->toISOString(),
                'updated_at' => now()->subDays(14)->toISOString(),
            ],
            [
                'id' => 'kf_004',
                'filename' => 'alert-rules.md',
                'title' => 'Alert Detection Rules',
                'path' => '/knowledge/alert-rules.md',
                'file_size_bytes' => 5600,
                'file_type' => 'markdown',
                'tags' => ['alerts', 'monitoring', 'rules'],
                'channel_id' => 'ch_telegram_alerts',
                'channel_name' => 'Alerts Bot',
                'agent_id' => 'agent_03',
                'agent_name' => 'AlertDog',
                'is_enabled' => true,
                'status' => 'active',
                'instruction_weight' => 0.8,
                'last_modified_at' => now()->subDays(1)->toISOString(),
                'metadata' => [],
                'created_at' => now()->subDays(12)->toISOString(),
                'updated_at' => now()->subDays(1)->toISOString(),
            ],
            [
                'id' => 'kf_005',
                'filename' => 'onboarding-guide-old.md',
                'title' => 'Legacy Onboarding Guide',
                'path' => '/knowledge/legacy/onboarding-guide-old.md',
                'file_size_bytes' => 19800,
                'file_type' => 'markdown',
                'tags' => ['onboarding', 'legacy'],
                'channel_id' => 'ch_telegram_offline',
                'channel_name' => 'Legacy Bot',
                'agent_id' => null,
                'agent_name' => null,
                'is_enabled' => false,
                'status' => 'archived',
                'instruction_weight' => 0.2,
                'last_modified_at' => now()->subDays(60)->toISOString(),
                'metadata' => [],
                'created_at' => now()->subDays(60)->toISOString(),
                'updated_at' => now()->subDays(30)->toISOString(),
            ],
            [
                'id' => 'kf_006',
                'filename' => 'rate-limit-rules.json',
                'title' => 'API Rate Limit Rules',
                'path' => '/knowledge/rate-limit-rules.json',
                'file_size_bytes' => 3400,
                'file_type' => 'json',
                'tags' => ['config', 'rate-limits'],
                'channel_id' => null,
                'channel_name' => null,
                'agent_id' => 'agent_01',
                'agent_name' => 'Hermes Prime',
                'is_enabled' => true,
                'status' => 'active',
                'instruction_weight' => 0.6,
                'last_modified_at' => now()->subDays(5)->toISOString(),
                'metadata' => [],
                'created_at' => now()->subDays(20)->toISOString(),
                'updated_at' => now()->subDays(5)->toISOString(),
            ],
        ];
    }
}

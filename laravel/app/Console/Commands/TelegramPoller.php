<?php

namespace App\Console\Commands;

use App\Services\AgentDatabaseService;
use App\Services\SupabaseService;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\GuzzleException;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

/**
 * TelegramPoller
 *
 * Long-polls Telegram for each active bot connection and converts
 * "/task <title>" messages into Mission Control tasks.
 *
 * Usage:
 *   php artisan telegram:poll
 *   php artisan telegram:poll --once   # single poll cycle (no loop)
 *
 * This command is idempotent — it uses polling_offset to avoid
 * processing the same update twice.
 */
class TelegramPoller extends Command
{
    protected $signature = 'telegram:poll
                            {--once : Run a single poll cycle instead of looping}
                            {--sleep=5 : Seconds to wait between poll cycles (when not --once)}';

    protected $description = 'Long-poll Telegram bots and create tasks for /task commands';

    private Client $http;

    public function __construct(
        private SupabaseService $supabase,
        private AgentDatabaseService $agentDbFactory
    ) {
        parent::__construct();
        $this->http = new Client(['timeout' => 60]);
    }

    public function handle(): int
    {
        $this->info('Starting Telegram poll cycle...');

        // ─── Load all active polling connections ──────────────────────
        $connections = $this->loadConnections();

        if (count($connections) === 0) {
            $this->warn('No active Telegram connections with polling enabled.');
            return Command::SUCCESS;
        }

        $this->info(sprintf('Found %d active connection(s).', count($connections)));

        // ─── Poll each connection ────────────────────────────────────
        $totalCreated = 0;
        foreach ($connections as $conn) {
            $created = $this->pollConnection($conn);
            $totalCreated += $created;
        }

        $this->info(sprintf('Poll cycle complete. %d task(s) created.', $totalCreated));

        return Command::SUCCESS;
    }

    // ─── Private helpers ────────────────────────────────────────────────

    /**
     * Load active Telegram channel connections with polling enabled.
     * Uses the service role key so we bypass RLS.
     */
    private function loadConnections(): array
    {
        $serviceKey = config('supabase.service_role_key');

        $result = $this->supabase->get(
            'channel_connections',
            [
                'select'   => '*',
                'channel'  => 'eq.telegram',
                'is_active'=> 'eq.true',
                'polling_enabled' => 'eq.true',
            ],
            $serviceKey
        );

        if (isset($result['error'])) {
            Log::error('TelegramPoller: failed to load connections', [
                'error' => $result['error'],
            ]);
            $this->error('Failed to load channel connections: ' . ($result['error']['message'] ?? $result['error']));
            return [];
        }

        return is_array($result) ? $result : [];
    }

    /**
     * Poll a single Telegram connection for updates.
     */
    private function pollConnection(array $conn): int
    {
        $connId    = $conn['id'] ?? 'unknown';
        $botToken  = $conn['bot_token'] ?? null;
        $offset    = intval($conn['polling_offset'] ?? 0);
        $userId    = $conn['user_id'] ?? null;

        if (empty($botToken)) {
            $this->warn("Connection {$connId}: no bot_token in credentials, skipping.");
            Log::warning("TelegramPoller: no bot_token", ['conn_id' => $connId]);
            return 0;
        }

        $this->line("Polling connection {$connId} (offset={$offset})...");

        // ─── Call getUpdates ────────────────────────────────────────
        $updates = $this->fetchUpdates($botToken, $offset);

        if ($updates === null) {
            // API failure — log and skip offset update
            return 0;
        }

        if (empty($updates)) {
            $this->info("Connection {$connId}: no new updates.");
            $this->updatePollingOffset($connId, $offset);
            return 0;
        }

        $this->info(sprintf(
            "Connection %s: %d update(s) received.",
            $connId,
            count($updates)
        ));

        // ─── Process each update ─────────────────────────────────────
        $tasksCreated = 0;
        $lastUpdateId = $offset;

        foreach ($updates as $update) {
            $updateId = $update['update_id'] ?? null;
            $message  = $update['message'] ?? null;

            if (!$updateId) {
                Log::debug('TelegramPoller: skipping update without update_id', $update);
                continue;
            }

            if (!$message) {
                Log::debug('TelegramPoller: skipping update without message', ['update_id' => $updateId]);
                continue;
            }

            $text = trim($message['text'] ?? '');
            if (empty($text)) {
                Log::debug('TelegramPoller: skipping update with empty text', ['update_id' => $updateId]);
                continue;
            }

            // Only handle /task commands
            if (!str_starts_with($text, '/task')) {
                Log::debug('TelegramPoller: ignoring non-/task message', [
                    'update_id' => $updateId,
                    'text'      => $text,
                ]);
                $lastUpdateId = $updateId;
                continue;
            }

            // Parse title (everything after "/task ")
            $title = preg_replace('#^/task\s*#i', '', $text);
            $title = trim($title);

            if (empty($title)) {
                $this->warn("Connection {$connId}: /task received with no title, skipping.");
                Log::warning('TelegramPoller: /task with empty title', [
                    'conn_id'   => $connId,
                    'update_id' => $updateId,
                    'chat_id'   => $message['chat']['id'] ?? null,
                ]);
                $lastUpdateId = $updateId;
                continue;
            }

            // ─── Create the task ────────────────────────────────────
            $taskCreated = $this->createTaskFromTelegramMessage(
                conn:    $conn,
                title:   $title,
                message: $message,
                updateId: $updateId
            );

            if ($taskCreated) {
                $tasksCreated++;
                $this->info(sprintf(
                    "  ✓ Task created: \"%s\" (chat=%s, update=%s)",
                    $title,
                    $message['chat']['id'] ?? '?',
                    $updateId
                ));
            }

            $lastUpdateId = $updateId;
        }

        // ─── Advance offset and update last_polled_at ─────────────────
        $this->updatePollingOffset($connId, $lastUpdateId + 1);

        return $tasksCreated;
    }

    /**
     * Call Telegram getUpdates API.
     * Returns null on error, empty array if no updates.
     *
     * @param string $botToken
     * @param int    $offset   Current polling offset (update_id to start from)
     * @return array|null
     */
    private function fetchUpdates(string $botToken, int $offset): ?array
    {
        $url = "https://api.telegram.org/bot{$botToken}/getUpdates";

        $params = [
            'timeout' => 55,           // long-poll timeout ( Telegram max 50s )
            'offset'  => $offset,
            'allowed_updates' => '["message","edited_message","callback_query"]',
        ];

        try {
            $response = $this->http->get($url, ['query' => $params]);
            $body = json_decode($response->getBody()->getContents(), true);

            if (!($body['ok'] ?? false)) {
                $description = $body['description'] ?? 'unknown';
                Log::error('TelegramPoller: getUpdates returned not OK', [
                    'bot_token' => substr($botToken, 0, 10) . '...',
                    'description' => $description,
                ]);
                $this->error("getUpdates error: {$description}");
                return null;
            }

            return $body['result'] ?? [];

        } catch (GuzzleException $e) {
            Log::error('TelegramPoller: getUpdates HTTP error', [
                'error' => $e->getMessage(),
                'bot_token' => substr($botToken, 0, 10) . '...',
            ]);
            $this->error('getUpdates HTTP error: ' . $e->getMessage());
            return null;
        }
    }

    /**
     * Create a task in the user's agent database.
     *
     * Flow:
     *   1. Resolve active agent for the connection's user_id
     *   2. Configure AgentDatabaseService for that agent
     *   3. Insert task into agent's tasks table
     */
    private function createTaskFromTelegramMessage(
        array $conn,
        string $title,
        array $message,
        int $updateId
    ): bool {
        $userId  = $conn['user_id']  ?? null;
        $connId  = $conn['id']       ?? null;
        $chatId  = $message['chat']['id'] ?? null;
        $chatTitle = $message['chat']['title'] ?? $message['chat']['username'] ?? "Chat {$chatId}";
        $fromName  = trim(($message['from']['first_name'] ?? '') . ' ' . ($message['from']['last_name'] ?? ''));

        if (!$userId) {
            Log::error('TelegramPoller: cannot create task — no user_id on connection', [
                'conn_id'   => $connId,
                'update_id' => $updateId,
            ]);
            return false;
        }

        // ─── Step 1: resolve active agent for this user ───────────
        $agentConfig = $this->resolveActiveAgent($userId);
        if (!$agentConfig) {
            Log::error('TelegramPoller: no active agent for user, cannot create task', [
                'conn_id' => $connId,
                'user_id' => $userId,
                'update_id' => $updateId,
            ]);
            $this->error("No active agent for user {$userId}, cannot create task.");
            return false;
        }

        // ─── Step 2: configure AgentDatabaseService ─────────────────
        $agentDb = clone $this->agentDbFactory;
        $agentDb->setActiveAgent($agentConfig);

        if (!$agentDb->hasAgent()) {
            $this->error("Failed to configure agent DB for agent {$agentConfig['id']}");
            return false;
        }

        // ─── Step 3: insert task ────────────────────────────────────
        // title is the text after /task
        // trigger_source = 'telegram'
        // channel_id = channel_connections.id (the Telegram connection)
        // user_id = the user who owns the connection
        // status = 'backlog'
        // description = original message text (for audit trail)
        $taskPayload = [
            'title'          => mb_substr($title, 0, 500),       // truncate to prevent DB errors
            'description'   => sprintf(
                "From Telegram %s%s\n\nOriginal: %s",
                $chatTitle,
                $fromName ? " ({$fromName})" : '',
                $message['text'] ?? ''
            ),
            'status'         => 'backlog',
            'trigger_source' => 'telegram',
            'channel_id'     => $connId,
            'user_id'        => $userId,
            'position'       => 0,
        ];

        // Optionally set agent_id if the agent DB has an ai_agents record for this agent
        if (!empty($agentConfig['id'])) {
            $taskPayload['agent_id'] = $agentConfig['id'];
        }

        $result = $agentDb->insert('tasks', $taskPayload);

        if (isset($result['error'])) {
            Log::error('TelegramPoller: failed to insert task', [
                'conn_id'    => $connId,
                'user_id'    => $userId,
                'agent_id'   => $agentConfig['id'] ?? null,
                'title'      => $title,
                'error'      => $result['error'],
            ]);
            $this->error("Failed to create task: " . ($result['error']['message'] ?? $result['error']));
            return false;
        }

        Log::info('TelegramPoller: task created', [
            'task_id'     => is_array($result) ? ($result[0]['id'] ?? $result['id'] ?? '?') : '?',
            'conn_id'     => $connId,
            'user_id'     => $userId,
            'agent_id'    => $agentConfig['id'] ?? null,
            'title'       => $title,
            'update_id'   => $updateId,
        ]);

        return true;
    }

    /**
     * Resolve the active agent configuration for a given user.
     * Returns the agent config array (from the central agents table) or null.
     */
    private function resolveActiveAgent(string $userId): ?array
    {
        $serviceKey = config('supabase.service_role_key');

        // Step A: get the active agent_id from user_agent_access
        $access = $this->supabase->get(
            'user_agent_access',
            [
                'select'    => 'agent_id',
                'user_id'   => "eq.{$userId}",
                'is_active' => 'eq.true',
                'limit'     => 1,
            ],
            $serviceKey
        );

        if (!is_array($access) || count($access) === 0) {
            Log::debug('TelegramPoller: no active agent access for user', ['user_id' => $userId]);
            return null;
        }

        $agentId = $access[0]['agent_id'] ?? null;
        if (!$agentId) {
            return null;
        }

        // Step B: fetch the agent config (contains supabase_url, supabase_key, anon_key)
        $agents = $this->supabase->get(
            'agents',
            [
                'select'   => '*',
                'id'       => "eq.{$agentId}",
                'is_active'=> 'eq.true',
                'limit'    => 1,
            ],
            $serviceKey
        );

        if (!is_array($agents) || count($agents) === 0) {
            Log::warning('TelegramPoller: agent not found or inactive', ['agent_id' => $agentId]);
            return null;
        }

        $agent = $agents[0];

        // Validate required credentials
        if (empty($agent['supabase_url']) || empty($agent['supabase_key'])) {
            Log::error('TelegramPoller: agent missing Supabase credentials', [
                'agent_id' => $agentId,
                'has_url'  => !empty($agent['supabase_url']),
                'has_key'  => !empty($agent['supabase_key']),
            ]);
            return null;
        }

        return $agent;
    }

    /**
     * Update polling_offset and last_polled_at on the channel_connection.
     */
    private function updatePollingOffset(string $connId, int $offset): void
    {
        $serviceKey = config('supabase.service_role_key');

        $result = $this->supabase->update(
            'channel_connections',
            ['id' => "eq.{$connId}"],
            [
                'polling_offset'  => $offset,
                'last_polled_at'  => now()->toDateTimeString(),
            ],
            $serviceKey
        );

        if (isset($result['error'])) {
            Log::error('TelegramPoller: failed to update polling offset', [
                'conn_id' => $connId,
                'offset'  => $offset,
                'error'   => $result['error'],
            ]);
        }
    }
}

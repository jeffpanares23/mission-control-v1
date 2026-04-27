<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use App\Services\SupabaseService;

/**
 * AgentDataController
 *
 * Serves all agent operational data to the Mission Control frontend:
 *   GET /api/v1/agents/status       → runtime status + services
 *   GET /api/v1/agents/cron-jobs    → agent_cron_jobs
 *   GET /api/v1/agents/tasks        → agent_tasks
 *   GET /api/v1/agents/reminders    → agent_reminders
 *   GET /api/v1/agents/scripts     → agent_scripts
 *   GET /api/v1/agents/notification-targets → agent_notification_targets
 *   GET /api/v1/agents/services    → current_services from agent_runtime_status
 *
 * Each endpoint reads from the agent_ prefixed tables that are populated
 * by the POST /api/v1/agents/status-sync endpoint.
 *
 * Auth: Bearer JWT via 'agent.auth' middleware (set on the route group).
 */
class AgentDataController extends Controller
{
    public function __construct(
        private SupabaseService $db,
    ) {}

    // ──────────────────────────────────────────────────────────────
    // GET /api/v1/agents/status
    // Returns runtime status + current_services for the user's primary agent.
    // Query param: ?agent_id=uuid (optional — uses user's primary agent if omitted)
    // ──────────────────────────────────────────────────────────────
    public function status(Request $request): \Illuminate\Http\JsonResponse
    {
        $user    = $request->attributes->get('user');
        $userId  = $user['id'] ?? null;
        $agentId = $request->query('agent_id');

        // Resolve agent: explicit agent_id param OR the user's primary agent
        if ($agentId) {
            $agents = $this->db->get('ai_agents', [
                'id'     => "eq.{$agentId}",
                'user_id' => "eq.{$userId}",
            ]);
        } else {
            // Fall back to the first agent belonging to this user
            $agents = $this->db->get('ai_agents', [
                'user_id' => "eq.{$userId}",
            ]);
        }

        if (empty($agents) || !is_array($agents[0] ?? null)) {
            return response()->json([
                'success' => false,
                'message' => 'Agent not found.',
            ], 404);
        }

        $agent = $agents[0];
        $resolvedAgentId = $agent['id'];

        // Load runtime status from agent_runtime_status
        $runtimeRows = $this->db->get('agent_runtime_status', [
            'agent_id' => "eq.{$resolvedAgentId}",
            'user_id'  => "eq.{$userId}",
        ]);
        $runtime = $runtimeRows[0] ?? null;

        // Derive gateway_status from runtime status
        $agentStatus = $agent['status'] ?? 'offline';
        $lastHeartbeat = $agent['last_heartbeat'] ?? null;

        // Determine gateway status based on last heartbeat age
        $gatewayStatus = 'needs_attention';
        if ($runtime) {
            $status = $runtime['status'] ?? 'idle';
            if ($status === 'idle' || $status === 'thinking' || $status === 'acting') {
                $gatewayStatus = 'running';
            } elseif ($status === 'error') {
                $gatewayStatus = 'error';
            } else {
                $gatewayStatus = 'paused';
            }
        } elseif ($lastHeartbeat) {
            $minutesSince = (time() - strtotime($lastHeartbeat)) / 60;
            if ($minutesSince < 5) {
                $gatewayStatus = 'running';
            } elseif ($minutesSince < 30) {
                $gatewayStatus = 'needs_attention';
            } else {
                $gatewayStatus = 'error';
            }
        }

        // Uptime from ai_agents.created_at (best approximation)
        $uptimeSeconds = 0;
        if (!empty($agent['created_at'])) {
            $uptimeSeconds = time() - strtotime($agent['created_at']);
        }

        // Supabase connectivity check — try a lightweight query
        $supabaseConnected = true;
        $latencyMs = null;
        try {
            $start = microtime(true);
            $this->db->get('users', ['id' => "eq.{$userId}"], limit: 1);
            $latencyMs = (int) ((microtime(true) - $start) * 1000);
        } catch (\Throwable) {
            $supabaseConnected = false;
        }

        // current_services from runtime_status
        $currentServices = [];
        if ($runtime && !empty($runtime['current_services'])) {
            $currentServices = is_array($runtime['current_services'])
                ? $runtime['current_services']
                : json_decode($runtime['current_services'], true) ?? [];
        }

        // last_sync_at derived from most recent updated_at among synced tables
        $lastSyncAt = $runtime['updated_at'] ?? $runtime['created_at'] ?? null;

        return response()->json([
            'success' => true,
            'data' => [
                'gateway_status' => $gatewayStatus,
                'hermes_gateway' => [
                    'status'         => $gatewayStatus,
                    'last_heartbeat' => $lastHeartbeat,
                    'uptime_seconds' => $uptimeSeconds,
                    'version'        => '1.0.0',
                ],
                'supabase' => [
                    'connected'  => $supabaseConnected,
                    'last_check' => now()->toISOString(),
                    'latency_ms' => $latencyMs,
                ],
                'sync_state' => [
                    'last_sync_at'   => $lastSyncAt,
                    'is_syncing'    => false,
                    'pending_changes' => 0,
                ],
                'current_services' => $currentServices,
            ],
        ]);
    }

    // ──────────────────────────────────────────────────────────────
    // GET /api/v1/agents/cron-jobs
    // ──────────────────────────────────────────────────────────────
    public function cronJobs(Request $request): \Illuminate\Http\JsonResponse
    {
        $user   = $request->attributes->get('user');
        $userId = $user['id'] ?? null;
        $agentId = $request->query('agent_id');

        $filters = ['user_id' => "eq.{$userId}"];
        if ($agentId) {
            $filters['agent_id'] = "eq.{$agentId}";
        }

        $rows = $this->db->get('agent_cron_jobs', $filters);

        if (is_array($rows) && isset($rows['error'])) {
            return response()->json(['success' => false, 'message' => $rows['error']], 500);
        }

        $data = collect($rows)->map(fn($r) => [
            'id'        => $r['id'],
            'name'      => $r['name'] ?? $r['job_id'] ?? '',
            'schedule'  => $r['schedule'] ?? $r['command'] ?? '',
            'status'    => $r['status'] ?? 'idle',
            'next_run'  => $r['next_run'] ?? null,
            'last_run'  => $r['last_run'] ?? null,
            'last_result' => $r['last_error'] ? 'failed' : ($r['last_run'] ? 'success' : null),
        ])->all();

        return response()->json(['success' => true, 'data' => $data]);
    }

    // ──────────────────────────────────────────────────────────────
    // GET /api/v1/agents/tasks
    // ──────────────────────────────────────────────────────────────
    public function tasks(Request $request): \Illuminate\Http\JsonResponse
    {
        $user   = $request->attributes->get('user');
        $userId = $user['id'] ?? null;
        $agentId = $request->query('agent_id');

        $filters = ['user_id' => "eq.{$userId}"];
        if ($agentId) {
            $filters['agent_id'] = "eq.{$agentId}";
        }

        $rows = $this->db->get('agent_tasks', $filters);

        if (is_array($rows) && isset($rows['error'])) {
            return response()->json(['success' => false, 'message' => $rows['error']], 500);
        }

        $data = collect($rows)->map(fn($r) => [
            'id'       => $r['id'],
            'title'    => $r['title'] ?? '',
            'status'   => $r['status'] ?? 'pending',
            'priority' => $r['priority'] ?? 'medium',
            'due_date' => $r['due_date'] ?? null,
        ])->all();

        return response()->json(['success' => true, 'data' => $data]);
    }

    // ──────────────────────────────────────────────────────────────
    // GET /api/v1/agents/reminders
    // ──────────────────────────────────────────────────────────────
    public function reminders(Request $request): \Illuminate\Http\JsonResponse
    {
        $user   = $request->attributes->get('user');
        $userId = $user['id'] ?? null;
        $agentId = $request->query('agent_id');

        $filters = ['user_id' => "eq.{$userId}"];
        if ($agentId) {
            $filters['agent_id'] = "eq.{$agentId}";
        }

        $rows = $this->db->get('agent_reminders', $filters);

        if (is_array($rows) && isset($rows['error'])) {
            return response()->json(['success' => false, 'message' => $rows['error']], 500);
        }

        $data = collect($rows)->map(fn($r) => [
            'id'       => $r['id'],
            'text'     => $r['text'] ?? '',
            'remind_at' => $r['remind_at'] ?? null,
            'status'   => $r['status'] ?? 'pending',
        ])->all();

        return response()->json(['success' => true, 'data' => $data]);
    }

    // ──────────────────────────────────────────────────────────────
    // GET /api/v1/agents/scripts
    // ──────────────────────────────────────────────────────────────
    public function scripts(Request $request): \Illuminate\Http\JsonResponse
    {
        $user   = $request->attributes->get('user');
        $userId = $user['id'] ?? null;
        $agentId = $request->query('agent_id');

        $filters = ['user_id' => "eq.{$userId}"];
        if ($agentId) {
            $filters['agent_id'] = "eq.{$agentId}";
        }

        $rows = $this->db->get('agent_scripts', $filters);

        if (is_array($rows) && isset($rows['error'])) {
            return response()->json(['success' => false, 'message' => $rows['error']], 500);
        }

        $data = collect($rows)->map(fn($r) => [
            'id'        => $r['id'],
            'name'      => $r['script_name'] ?? $r['name'] ?? '',
            'category'  => $r['category'] ?? 'general',
            'last_used' => $r['last_used'] ?? null,
        ])->all();

        return response()->json(['success' => true, 'data' => $data]);
    }

    // ──────────────────────────────────────────────────────────────
    // GET /api/v1/agents/notification-targets
    // ──────────────────────────────────────────────────────────────
    public function notificationTargets(Request $request): \Illuminate\Http\JsonResponse
    {
        $user   = $request->attributes->get('user');
        $userId = $user['id'] ?? null;
        $agentId = $request->query('agent_id');

        $filters = ['user_id' => "eq.{$userId}"];
        if ($agentId) {
            $filters['agent_id'] = "eq.{$agentId}";
        }

        $rows = $this->db->get('agent_notification_targets', $filters);

        if (is_array($rows) && isset($rows['error'])) {
            return response()->json(['success' => false, 'message' => $rows['error']], 500);
        }

        $data = collect($rows)->map(fn($r) => [
            'id'         => $r['id'],
            'platform'   => $r['platform'] ?? 'telegram',
            'target_name' => $r['target_name'] ?? '',
            'is_active' => $r['is_active'] ?? true,
        ])->all();

        return response()->json(['success' => true, 'data' => $data]);
    }

    // ──────────────────────────────────────────────────────────────
    // GET /api/v1/agents/services
    // Returns current_services from agent_runtime_status
    // ──────────────────────────────────────────────────────────────
    public function services(Request $request): \Illuminate\Http\JsonResponse
    {
        $user    = $request->attributes->get('user');
        $userId  = $user['id'] ?? null;
        $agentId = $request->query('agent_id');

        if ($agentId) {
            $agents = $this->db->get('ai_agents', [
                'id' => "eq.{$agentId}",
                'user_id' => "eq.{$userId}",
            ]);
        } else {
            $agents = $this->db->get('ai_agents', ['user_id' => "eq.{$userId}"]);
        }

        if (empty($agents) || !is_array($agents[0] ?? null)) {
            return response()->json(['success' => true, 'data' => []]);
        }

        $agent   = $agents[0];
        $runtime = $this->db->get('agent_runtime_status', [
            'agent_id' => "eq.{$agent['id']}",
            'user_id'  => "eq.{$userId}",
        ]);

        $runtimeRow = $runtime[0] ?? null;
        $currentServices = [];

        if ($runtimeRow && !empty($runtimeRow['current_services'])) {
            $currentServices = is_string($runtimeRow['current_services'])
                ? json_decode($runtimeRow['current_services'], true) ?? []
                : ($runtimeRow['current_services'] ?? []);
        }

        $data = collect($currentServices)->map(fn($s) => [
            'name'    => $s['name'] ?? '',
            'status'  => $s['status'] ?? 'disconnected',
            'message' => $s['message'] ?? null,
        ])->all();

        return response()->json(['success' => true, 'data' => $data]);
    }
}

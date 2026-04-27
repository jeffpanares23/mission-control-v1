<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use App\Services\SupabaseService;
use Illuminate\Support\Facades\Log;

/**
 * AgentStatusSyncController
 *
 * POST /api/v1/agents/status-sync
 *
 * Accepts a full operational-state snapshot from a Hermes agent and
 * upserts all relevant records into Supabase:
 *   - agent_runtime_status  (overall status + current_services)
 *   - agent_tasks
 *   - agent_cron_jobs
 *   - agent_reminders
 *   - agent_scripts
 *   - agent_notification_targets
 *   - agent_operational_logs
 *
 * Auth: Bearer JWT.
 *
 * Body structure:
 * {
 *   agent_id: string,
 *   agent_name: string,
 *   status: string,
 *   last_heartbeat: string (ISO),
 *   current_services: array,
 *   last_error: string|null,
 *   metadata: object,
 *   tasks: [{ id, title, description, status, priority, due_date }],
 *   cron_jobs: [{ id, name, schedule, command, enabled, last_run, next_run, status, last_error }],
 *   reminders: [{ id, text, remind_at, status }],
 *   scripts: [{ id, description, category, last_used }],
 *   notification_targets: [{ id, platform, name, is_active }],
 * }
 *
 * Response: { success: true, message: "...", data: { synced_at, counts, errors } }
 */
class AgentStatusSyncController extends Controller
{
    public function __construct(
        private SupabaseService $db,
    ) {}

    /**
     * POST /api/v1/agents/status-sync
     */
    public function sync(Request $request): \Illuminate\Http\JsonResponse
    {
        $request->validate([
            'agent_id'               => 'required|string',
            'tasks'                  => 'present|array',
            'cron_jobs'              => 'present|array',
            'reminders'              => 'present|array',
            'scripts'                => 'present|array',
            'notification_targets'    => 'present|array',
            'services'               => 'present|array',
        ]);

        $agentId = $request->input('agent_id');

        $user = $request->attributes->get('user');
        $userId = $user['id'] ?? null;

        if (!$userId) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized.',
            ], 401);
        }

        $counts = [
            'tasks'                  => 0,
            'cron_jobs'              => 0,
            'reminders'              => 0,
            'scripts'                => 0,
            'notification_targets'    => 0,
            'services'               => 0,
        ];
        $errors = [];

        // ── 1. Upsert agent_runtime_status ───────────────────────────────
        $runtimePayload = [
            'user_id'          => $userId,
            'agent_id'         => $agentId,
            'agent_name'       => $request->input('agent_name', 'Hermes'),
            'status'           => $request->input('status', 'running'),
            'last_heartbeat'   => $request->input('last_heartbeat', now()->toISOString()),
            'current_services' => $request->input('current_services', []),
            'last_error'       => $request->input('last_error'),
            'metadata'         => $request->input('metadata', []),
        ];

        $runtimeOk = $this->upsertComposite(
            'agent_runtime_status',
            $runtimePayload,
            ['user_id', 'agent_id']
        );
        if (!$runtimeOk) {
            Log::warning('AgentStatusSync: runtime_status upsert failed', [
                'agent_id' => $agentId,
                'user_id'  => $userId,
            ]);
        }
        $counts['services'] = count($request->input('current_services', []));

        // ── 2. Upsert tasks ──────────────────────────────────────────────
        // Table: agent_tasks | unique on: user_id, agent_id, external_task_id
        // Primary key: id (uuid). Upsert key used below.
        foreach ($request->input('tasks', []) as $task) {
            $extId = $task['id'] ?? null;
            if (!$extId) continue;
            $row = [
                'user_id'          => $userId,
                'agent_id'         => $agentId,
                'external_task_id' => $extId,
                'title'            => $task['title'] ?? $extId,
                'description'      => $task['description'] ?? null,
                'status'           => $task['status'] ?? 'pending',
                'priority'         => $task['priority'] ?? 'medium',
                'due_date'         => $task['due_date'] ?? null,
            ];
            if ($this->upsertComposite('agent_tasks', $row, ['user_id', 'agent_id', 'external_task_id'])) {
                $counts['tasks']++;
            } else {
                $errors[] = "tasks:{$extId}";
            }
        }

        // ── 3. Upsert cron_jobs ───────────────────────────────────────────
        // Table: agent_cron_jobs | unique on: user_id, agent_id, job_id
        foreach ($request->input('cron_jobs', []) as $job) {
            $jobId = $job['id'] ?? null;
            if (!$jobId) continue;
            $row = [
                'user_id'   => $userId,
                'agent_id'  => $agentId,
                'job_id'    => $jobId,
                'name'      => $job['name'] ?? $jobId,
                'schedule'  => $job['schedule'] ?? '',
                'command'   => $job['command'] ?? '',
                'enabled'   => $job['enabled'] ?? true,
                'last_run'  => $job['last_run'] ?? null,
                'next_run'  => $job['next_run'] ?? null,
                'status'    => $job['status'] ?? 'active',
                'last_error'=> $job['last_error'] ?? null,
            ];
            if ($this->upsertComposite('agent_cron_jobs', $row, ['user_id', 'agent_id', 'job_id'])) {
                $counts['cron_jobs']++;
            } else {
                $errors[] = "cron_jobs:{$jobId}";
            }
        }

        // ── 4. Upsert reminders ──────────────────────────────────────────
        // Table: agent_reminders | unique on: user_id, agent_id, reminder_id
        foreach ($request->input('reminders', []) as $reminder) {
            $remId = $reminder['id'] ?? null;
            if (!$remId) continue;
            $row = [
                'user_id'     => $userId,
                'agent_id'    => $agentId,
                'reminder_id' => $remId,
                'text'        => $reminder['text'] ?? $remId,
                'remind_at'   => $reminder['remind_at'] ?? null,
                'status'      => $reminder['status'] ?? 'pending',
            ];
            if ($this->upsertComposite('agent_reminders', $row, ['user_id', 'agent_id', 'reminder_id'])) {
                $counts['reminders']++;
            } else {
                $errors[] = "reminders:{$remId}";
            }
        }

        // ── 5. Upsert scripts ─────────────────────────────────────────────
        // Table: agent_scripts | unique on: user_id, agent_id, script_name
        foreach ($request->input('scripts', []) as $script) {
            $scriptName = $script['id'] ?? null;
            if (!$scriptName) continue;
            $row = [
                'user_id'     => $userId,
                'agent_id'    => $agentId,
                'script_name' => $scriptName,
                'description' => $script['description'] ?? null,
                'category'    => $script['category'] ?? 'general',
                'last_used'   => $script['last_used'] ?? null,
            ];
            if ($this->upsertComposite('agent_scripts', $row, ['user_id', 'agent_id', 'script_name'])) {
                $counts['scripts']++;
            } else {
                $errors[] = "scripts:{$scriptName}";
            }
        }

        // ── 6. Upsert notification_targets ────────────────────────────────
        // Table: agent_notification_targets | unique on: user_id, agent_id, target_id
        foreach ($request->input('notification_targets', []) as $target) {
            $targetId = $target['id'] ?? null;
            if (!$targetId) continue;
            $row = [
                'user_id'     => $userId,
                'agent_id'    => $agentId,
                'target_id'   => $targetId,
                'platform'    => $target['platform'] ?? 'telegram',
                'target_name' => $target['name'] ?? $targetId,
                'is_active'   => $target['is_active'] ?? true,
            ];
            if ($this->upsertComposite('agent_notification_targets', $row, ['user_id', 'agent_id', 'target_id'])) {
                $counts['notification_targets']++;
            } else {
                $errors[] = "notification_targets:{$targetId}";
            }
        }

        // ── 7. Log sync event ────────────────────────────────────────────
        $total = array_sum($counts);
        $this->logEvent($userId, $agentId, 'sync_complete', [
            'synced_items' => $counts,
            'errors'      => $errors,
        ]);

        $message = $total === 0
            ? 'No records to sync.'
            : "Synced {$total} records.";

        return response()->json([
            'success' => true,
            'message' => $message,
            'data'    => [
                'synced_at' => now()->toISOString(),
                'counts'    => $counts,
                'errors'    => $errors,
            ],
        ]);
    }

    /**
     * Upsert a row using ON CONFLICT DO UPDATE via Supabase RPC function.
     *
     * Since Supabase REST API doesn't support composite upsert keys natively,
     * we call the upsert function via rpc() which allows specifying the
     * conflict target columns.
     *
     * @param string $table       Supabase table name
     * @param array  $row         Row data (must contain all $conflictKeys)
     * @param array  $conflictKeys Columns defining the upsert uniqueness constraint
     * @return bool               True on success, false on error
     */
    private function upsertComposite(string $table, array $row, array $conflictKeys): bool
    {
        foreach ($conflictKeys as $key) {
            if (!isset($row[$key])) return false;
        }

        try {
            $row['updated_at'] = now()->toISOString();

            $result = $this->db->rpc('upsert_record', [
                'p_table'         => $table,
                'p_row'           => $row,
                'p_conflict_keys' => $conflictKeys,
            ]);

            if (is_array($result) && ($result['error'] ?? false)) {
                Log::warning('AgentStatusSync rpc upsert failed', [
                    'table'   => $table,
                    'keys'    => $conflictKeys,
                    'error'   => $result['error'],
                ]);
                return false;
            }
            return true;
        } catch (\Throwable $e) {
            // Fallback: try direct REST upsert without composite key
            // This works for tables where id is the only unique constraint
            return $this->upsertSimple($table, $row, $conflictKeys[0] ?? 'id');
        }
    }

    /**
     * Simple upsert using POST with Prefer: resolution=merge-duplicates.
     * Uses the first conflict key as the upsert target.
     * Requires table to have the conflict key as its primary key OR
     * have a UNIQUE constraint on that column alone.
     */
    private function upsertSimple(string $table, array $row, string $pkField): bool
    {
        if (empty($row[$pkField])) return false;

        try {
            $row['updated_at'] = now()->toISOString();

            $client = new \GuzzleHttp\Client([
                'base_uri' => config('supabase.url'),
                'timeout'  => 30,
            ]);

            $response = $client->post("/rest/v1/{$table}", [
                'headers' => [
                    'apikey'        => config('supabase.anon_key'),
                    'Authorization' => 'Bearer ' . config('supabase.anon_key'),
                    'Content-Type'  => 'application/json',
                    'Prefer'        => 'resolution=merge-duplicates',
                ],
                'json' => $row,
            ]);

            $statusCode = $response->getStatusCode();
            return in_array($statusCode, [200, 201]);
        } catch (\Throwable $e) {
            Log::warning('AgentStatusSync simple upsert failed', [
                'table' => $table,
                'pk'    => $row[$pkField] ?? '?',
                'error' => $e->getMessage(),
            ]);
            return false;
        }
    }

    /**
     * Log an operational event to agent_operational_logs.
     */
    private function logEvent(string $userId, string $agentId, string $eventType, array $metadata = []): void
    {
        try {
            $this->db->insert('agent_operational_logs', [
                'user_id'    => $userId,
                'agent_id'   => $agentId,
                'event_type' => $eventType,
                'severity'   => 'info',
                'metadata'   => $metadata,
            ]);
        } catch (\Throwable $e) {
            Log::warning('Failed to log operational event', [
                'event_type' => $eventType,
                'error'      => $e->getMessage(),
            ]);
        }
    }
}

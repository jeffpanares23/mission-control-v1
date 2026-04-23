<?php

namespace App\Http\Controllers\Api;

use App\Services\SupabaseService;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

/**
 * AgentHeartbeatController
 *
 * Handles heartbeat pings from Hermes agents.
 * Agents call POST /api/v1/agents/heartbeat every 10–30 seconds
 * to report their current status.
 *
 * POST /api/v1/agents/heartbeat
 * Body: { agent_id, status, current_task_id?, error? }
 */
class AgentHeartbeatController extends Controller
{
    public function __construct(
        private SupabaseService $db,
    ) {}

    /**
     * POST /api/v1/agents/heartbeat
     */
    public function beat(Request $request): \Illuminate\Http\JsonResponse
    {
        $request->validate([
            'agent_id'       => 'required|uuid',
            'status'          => 'required|string|in:idle,thinking,acting,error,offline',
            'current_task_id' => 'nullable|uuid',
            'error'           => 'nullable|string|max:1000',
        ]);

        $agentId = $request->input('agent_id');
        $status  = $request->input('status');
        $taskId  = $request->input('current_task_id');
        $error   = $request->input('error');

        // Verify agent belongs to the authenticated user
        $agent = $this->db->get('ai_agents', ['id' => "eq.{$agentId}"]);
        if (empty($agent) || !is_array($agent[0] ?? null)) {
            return response()->json([
                'success' => false,
                'message' => 'Agent not found.',
            ], 404);
        }

        $patch = [
            'status'         => $status,
            'last_heartbeat' => now()->toISOString(),
            'last_error'     => $status === 'error' ? $error : null,
        ];

        if ($taskId !== null) {
            $patch['current_task_id'] = $taskId;
        } elseif ($status === 'idle') {
            // Clear current task when going idle
            $patch['current_task_id'] = null;
        }

        $result = $this->db->update('ai_agents', ['id' => $agentId], $patch);

        if ($result['error'] ?? false) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to update heartbeat: ' . ($result['error'] ?? 'unknown'),
            ], 422);
        }

        return response()->json([
            'success' => true,
            'message' => 'Heartbeat received.',
            'data'    => [
                'agent_id'       => $agentId,
                'status'         => $status,
                'last_heartbeat' => $patch['last_heartbeat'],
            ],
        ]);
    }

    /**
     * GET /api/v1/agents/{id}/status
     * Returns current agent status including last heartbeat.
     */
    public function status(string $id): \Illuminate\Http\JsonResponse
    {
        $agent = $this->db->get('ai_agents', ['id' => "eq.{$id}"]);
        if (empty($agent) || !is_array($agent[0] ?? null)) {
            return response()->json([
                'success' => false,
                'message' => 'Agent not found.',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data'    => $agent[0],
        ]);
    }
}

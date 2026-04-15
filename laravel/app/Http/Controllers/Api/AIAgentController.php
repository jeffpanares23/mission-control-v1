<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\Request;

class AIAgentController extends BaseApiController
{
    /**
     * GET /api/v1/ai/status
     * Returns Hermes AI agent current status.
     */
    public function status(Request $request)
    {
        $userId = $this->userId($request);
        $agents = $this->db($request)->get('ai_agents', [
            'user_id'   => "eq.{$userId}",
            'is_active' => 'eq.true',
        ]);

        if (!empty($agents['error']) || count($agents) === 0) {
            return $this->error('No active AI agent found', 404);
        }

        $agent = $agents[0];
        return $this->ok([
            'id'              => $agent['id'],
            'name'            => $agent['name'],
            'status'          => $agent['status'],
            'model'           => $agent['model'],
            'stats'           => $agent['stats'],
            'current_task_id'  => $agent['current_task_id'],
        ]);
    }

    /**
     * POST /api/v1/ai/chat
     * Send a message to Hermes and get a response.
     */
    public function chat(Request $request)
    {
        $request->validate(['message' => 'required|string|max:4000']);
        $userId  = $this->userId($request);
        $message = $request->input('message');

        // Get active agent
        $agents = $this->db($request)->get('ai_agents', [
            'user_id'   => "eq.{$userId}",
            'is_active' => 'eq.true',
        ]);
        if (empty($agents) || !empty($agents['error'])) {
            return $this->error('No active AI agent', 404);
        }
        $agent = $agents[0];

        // Append user message to conversation
        $messages = $agent['messages'] ?? [];
        $messages[] = ['role' => 'user', 'content' => $message, 'timestamp' => now()->toISOString()];

        // Update agent status to thinking
        $this->db($request)->update('ai_agents', ['id' => $agent['id']], ['status' => 'thinking']);

        // TODO: Call actual AI model (MiniMax, OpenAI, etc.) here
        // For now, return a placeholder response
        $reply = "Hermes received your message: \"{$message}\". AI inference integration coming soon.";

        $messages[] = ['role' => 'assistant', 'content' => $reply, 'timestamp' => now()->toISOString()];

        // Save messages and reset status
        $this->db($request)->update('ai_agents', ['id' => $agent['id']], [
            'status'   => 'idle',
            'messages' => $messages,
        ]);

        // Update stats
        $stats = $agent['stats'] ?? ['tasks_dispatched' => 0, 'insights_generated' => 0, 'conversations_handled' => 0];
        $stats['conversations_handled'] = ($stats['conversations_handled'] ?? 0) + 1;
        $this->db($request)->update('ai_agents', ['id' => $agent['id']], ['stats' => $stats]);

        return $this->ok(['reply' => $reply, 'agent_status' => 'idle']);
    }

    /**
     * POST /api/v1/ai/dispatch
     * Dispatch a task to Hermes AI to execute.
     */
    public function dispatch(Request $request)
    {
        $request->validate(['task_id' => 'required|uuid', 'instruction' => 'required|string']);
        $userId      = $this->userId($request);
        $taskId      = $request->input('task_id');
        $instruction = $request->input('instruction');

        // Get active agent
        $agents = $this->db($request)->get('ai_agents', [
            'user_id'   => "eq.{$userId}",
            'is_active' => 'eq.true',
        ]);
        if (empty($agents) || !empty($agents['error'])) {
            return $this->error('No active AI agent', 404);
        }
        $agent = $agents[0];

        // Assign task to agent
        $this->db($request)->update('ai_agents', ['id' => $agent['id']], [
            'status'          => 'acting',
            'current_task_id' => $taskId,
        ]);

        // Log activity
        $this->db($request)->insert('activity_log', [
            'user_id'    => $userId,
            'action_type' => 'ai_dispatch',
            'entity_type' => 'task',
            'entity_id'  => $taskId,
            'metadata'   => ['instruction' => $instruction],
        ]);

        // Update agent stats
        $stats = $agent['stats'] ?? [];
        $stats['tasks_dispatched'] = ($stats['tasks_dispatched'] ?? 0) + 1;
        $this->db($request)->update('ai_agents', ['id' => $agent['id']], ['stats' => $stats]);

        return $this->ok([
            'dispatched'   => true,
            'task_id'      => $taskId,
            'agent_status' => 'acting',
        ], 'Task dispatched to Hermes');
    }
}

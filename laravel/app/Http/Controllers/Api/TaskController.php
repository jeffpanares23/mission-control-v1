<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\Request;

class TaskController extends BaseApiController
{
    /**
     * Operational task fields — channel_id, agent_id, trigger_source
     * are stored in the agent DB (agents table has the user's supabase credentials).
     * We always use $this->db() which resolves to the authenticated user's agent DB.
     */

    public function index(Request $request)
    {
        $userId = $this->userId($request);
        $view   = $request->input('view', 'kanban');

        $params = ['user_id' => "eq.{$userId}", 'order' => 'position.asc'];
        if ($request->has('status'))    $params['status']          = 'eq.' . $request->input('status');
        if ($request->has('priority'))   $params['priority']         = 'eq.' . $request->input('priority');
        if ($request->has('channel_id')) $params['channel_id']      = 'eq.' . $request->input('channel_id');
        if ($request->has('agent_id'))   $params['agent_id']         = 'eq.' . $request->input('agent_id');
        if ($request->has('trigger_source')) $params['trigger_source'] = 'eq.' . $request->input('trigger_source');

        // Hydrate channel + agent names for each task
        $result = $this->db($request)->get('tasks', $params);

        if ($result['error']) {
            return $this->ok([], 'No tasks found');
        }

        $tasks = $this->hydrateTaskRelations($request, $result);

        return $this->ok($tasks);
    }

    public function store(Request $request)
    {
        $userId  = $this->userId($request);
        $payload = array_merge($request->only([
            'title', 'description', 'status', 'priority', 'due_date',
            'account_id', 'assigned_to', 'tags', 'column_status', 'metadata',
            'channel_id', 'agent_id', 'trigger_source',
        ]), [
            'user_id'  => $userId,
            'position' => $request->input('position', 0),
        ]);

        $result = $this->db($request)->insert('tasks', $payload);
        return $result['error']
            ? $this->error('Failed to create task: ' . ($result['error'] ?? 'unknown'), 422)
            : $this->ok($result, 'Task created', 201);
    }

    public function show(Request $request, string $id)
    {
        $data  = $this->db($request)->get('tasks', ['id' => "eq.{$id}"]);
        $items = $data['error'] ? [] : $data;
        if (!count($items)) return $this->error('Not found', 404);

        $task = $this->hydrateTask($request, $items[0]);
        return $this->ok($task);
    }

    public function update(Request $request, string $id)
    {
        $payload = $request->only([
            'title', 'description', 'status', 'priority', 'due_date',
            'account_id', 'assigned_to', 'tags', 'position', 'column_status', 'metadata',
            'channel_id', 'agent_id', 'trigger_source',
        ]);

        $result = $this->db($request)->update('tasks', ['id' => $id], $payload);

        if ($request->input('status') === 'done') {
            $this->db($request)->update('tasks', ['id' => $id], [
                'completed_at' => now()->toDateTimeString(),
            ]);
        }

        return $result['error']
            ? $this->error('Update failed: ' . ($result['error'] ?? 'unknown'), 422)
            : $this->ok($result, 'Task updated');
    }

    public function destroy(Request $request, string $id)
    {
        $result = $this->db($request)->delete('tasks', ['id' => $id]);
        return $result['error']
            ? $this->error('Delete failed: ' . ($result['error'] ?? 'unknown'), 422)
            : $this->ok(null, 'Task deleted');
    }

    /**
     * PATCH /api/v1/tasks/{id}/move
     * Move task within Kanban (reorder within column or move to new column).
     */
    public function move(Request $request, string $id)
    {
        $payload = $request->only(['column_status', 'position']);
        $result  = $this->db($request)->update('tasks', ['id' => $id], $payload);
        return $result['error']
            ? $this->error('Move failed: ' . ($result['error'] ?? 'unknown'), 422)
            : $this->ok($result, 'Task moved');
    }

    /**
     * PATCH /api/v1/tasks/{id}/status
     * Change task status (Kanban column change or list status change).
     */
    public function status(Request $request, string $id)
    {
        $payload = $request->only(['status', 'column_status']);
        if ($request->input('status') === 'done') {
            $payload['completed_at'] = now()->toDateTimeString();
        }
        $result = $this->db($request)->update('tasks', ['id' => $id], $payload);
        return $result['error']
            ? $this->error('Status update failed: ' . ($result['error'] ?? 'unknown'), 422)
            : $this->ok($result, 'Status updated');
    }

    /**
     * Hydrate an array of tasks with channel and agent names.
     */
    protected function hydrateTaskRelations(Request $request, array $tasks): array
    {
        return array_map(fn($t) => $this->hydrateTask($request, $t), $tasks);
    }

    /**
     * Enrich a single task with channel_name and agent_name from their tables.
     */
    protected function hydrateTask(Request $request, array $task): array
    {
        if (!empty($task['channel_id'])) {
            $ch = $this->db($request)->get('channels', ['id' => "eq.{$task['channel_id']}"]);
            $channelList = $ch['error'] ? [] : $ch;
            if (count($channelList)) {
                $task['channel_name'] = $channelList[0]['channel_name']
                    ?? $channelList[0]['name']
                    ?? $channelList[0]['channel']
                    ?? 'Channel';
            }
        }

        if (!empty($task['agent_id'])) {
            $ag = $this->db($request)->get('agents', ['id' => "eq.{$task['agent_id']}"]);
            $agentList = $ag['error'] ? [] : $ag;
            if (count($agentList)) {
                $task['agent_name'] = $agentList[0]['name'] ?? 'Agent';
            }
        }

        return $task;
    }
}

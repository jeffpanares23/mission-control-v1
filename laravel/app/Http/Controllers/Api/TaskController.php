<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\Request;

class TaskController extends BaseApiController
{
    public function index(Request $request)
    {
        $userId = $this->userId($request);
        $view   = $request->input('view', 'kanban');

        $params = ['user_id' => "eq.{$userId}", 'order' => 'position.asc'];
        if ($request->has('status'))   $params['status']   = 'eq.' . $request->input('status');
        if ($request->has('priority')) $params['priority'] = 'eq.' . $request->input('priority');

        $result = $this->db($request)->get('tasks', $params);
        return $this->ok($result['error'] ? [] : $result);
    }

    public function store(Request $request)
    {
        $userId  = $this->userId($request);
        $payload = array_merge($request->only([
            'title','description','status','priority','due_date','account_id',
            'assigned_to','tags','column_status','metadata'
        ]), [
            'user_id'  => $userId,
            'position' => $request->input('position', 0),
        ]);
        $result = $this->db($request)->insert('tasks', $payload);
        return $result['error']
            ? $this->error('Failed to create task', 422)
            : $this->ok($result, 'Task created', 201);
    }

    public function show(Request $request, string $id)
    {
        $data  = $this->db($request)->get('tasks', ['id' => "eq.{$id}"]);
        $items = $data['error'] ? [] : $data;
        return count($items) ? $this->ok($items[0]) : $this->error('Not found', 404);
    }

    public function update(Request $request, string $id)
    {
        $payload = $request->only([
            'title','description','status','priority','due_date','account_id',
            'assigned_to','tags','position','column_status','metadata'
        ]);
        $result = $this->db($request)->update('tasks', ['id' => $id], $payload);

        if ($request->input('status') === 'done' && !empty($payload['completed_at'] === false)) {
            $this->db($request)->update('tasks', ['id' => $id], ['completed_at' => now()->toDateTimeString()]);
        }

        return $result['error'] ? $this->error('Update failed', 422) : $this->ok($result);
    }

    public function destroy(Request $request, string $id)
    {
        $result = $this->db($request)->delete('tasks', ['id' => $id]);
        return $result['error'] ? $this->error('Delete failed', 422) : $this->ok(null, 'Task deleted');
    }

    /**
     * PATCH /api/v1/tasks/{id}/move
     * Move task within Kanban (reorder within column or move to new column).
     */
    public function move(Request $request, string $id)
    {
        $payload = $request->only(['column_status', 'position']);
        $result  = $this->db($request)->update('tasks', ['id' => $id], $payload);
        return $result['error'] ? $this->error('Move failed', 422) : $this->ok($result, 'Task moved');
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
        return $result['error'] ? $this->error('Status update failed', 422) : $this->ok($result, 'Status updated');
    }
}

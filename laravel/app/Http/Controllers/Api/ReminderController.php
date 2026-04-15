<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\Request;

class ReminderController extends BaseApiController
{
    public function index(Request $request)
    {
        $userId = $this->userId($request);
        $result = $this->db($request)->get('reminders', [
            'user_id' => "eq.{$userId}",
            'order'   => 'due_date.asc',
            'is_active' => 'eq.true',
        ]);
        return $this->ok($result['error'] ? [] : $result);
    }

    public function store(Request $request)
    {
        $userId  = $this->userId($request);
        $payload = array_merge($request->only([
            'title','description','due_date','recurrence','recurrence_interval',
            'task_id','account_id','channel_to_notify','metadata'
        ]), ['user_id' => $userId, 'is_active' => true]);
        $result = $this->db($request)->insert('reminders', $payload);
        return $result['error'] ? $this->error('Failed to create reminder', 422) : $this->ok($result, 'Created', 201);
    }

    public function show(Request $request, string $id)
    {
        $data  = $this->db($request)->get('reminders', ['id' => "eq.{$id}"]);
        $items = $data['error'] ? [] : $data;
        return count($items) ? $this->ok($items[0]) : $this->error('Not found', 404);
    }

    public function update(Request $request, string $id)
    {
        $result = $this->db($request)->update('reminders', ['id' => $id], $request->only([
            'title','description','due_date','recurrence','recurrence_interval','is_active','channel_to_notify','metadata'
        ]));
        return $result['error'] ? $this->error('Update failed', 422) : $this->ok($result);
    }

    public function destroy(Request $request, string $id)
    {
        $result = $this->db($request)->delete('reminders', ['id' => $id]);
        return $result['error'] ? $this->error('Delete failed', 422) : $this->ok(null, 'Deleted');
    }
}

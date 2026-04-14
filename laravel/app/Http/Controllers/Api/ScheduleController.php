<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\Request;

class ScheduleController extends BaseApiController
{
    public function index(Request $request)
    {
        $userId = $this->userId($request);
        $result = $this->supabase->get('schedules', [
            'user_id' => "eq.{$userId}",
            'order' => 'start_time.asc',
        ]);
        return $this->ok($result['error'] ? [] : $result);
    }

    public function store(Request $request)
    {
        $userId = $this->userId($request);
        $payload = array_merge($request->only([
            'title','description','start_time','end_time','is_all_day',
            'recurrence_rule','account_id','task_id','color','metadata'
        ]), ['user_id' => $userId]);
        $result = $this->supabase->insert('schedules', $payload);
        return $result['error'] ? $this->error('Failed to create schedule', 422) : $this->ok($result, 'Created', 201);
    }

    public function show(Request $request, string $id)
    {
        $data = $this->supabase->get('schedules', ['id' => "eq.{$id}"]);
        $items = $data['error'] ? [] : $data;
        return count($items) ? $this->ok($items[0]) : $this->error('Not found', 404);
    }

    public function update(Request $request, string $id)
    {
        $result = $this->supabase->update('schedules', ['id' => $id], $request->only([
            'title','description','start_time','end_time','is_all_day','recurrence_rule',
            'account_id','task_id','color','metadata'
        ]));
        return $result['error'] ? $this->error('Update failed', 422) : $this->ok($result);
    }

    public function destroy(Request $request, string $id)
    {
        $result = $this->supabase->delete('schedules', ['id' => $id]);
        return $result['error'] ? $this->error('Delete failed', 422) : $this->ok(null, 'Deleted');
    }
}

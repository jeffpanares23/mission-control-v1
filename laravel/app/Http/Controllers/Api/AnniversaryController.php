<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\Request;

class AnniversaryController extends BaseApiController
{
    public function index(Request $request)
    {
        $userId = $this->userId($request);
        $result = $this->db($request)->get('anniversaries', ['user_id' => "eq.{$userId}", 'order' => 'anniversary_date.asc']);
        return $this->ok($result['error'] ? [] : $result);
    }

    public function store(Request $request)
    {
        $userId  = $this->userId($request);
        $payload = array_merge($request->only([
            'title','anniversary_date','anniversary_type','notes','remind_days_before','is_recurring','account_id','metadata'
        ]), ['user_id' => $userId]);
        $result = $this->db($request)->insert('anniversaries', $payload);
        return $result['error'] ? $this->error('Failed to create anniversary', 422) : $this->ok($result, 'Created', 201);
    }

    public function show(Request $request, string $id)
    {
        $data  = $this->db($request)->get('anniversaries', ['id' => "eq.{$id}"]);
        $items = $data['error'] ? [] : $data;
        return count($items) ? $this->ok($items[0]) : $this->error('Not found', 404);
    }

    public function update(Request $request, string $id)
    {
        $result = $this->db($request)->update('anniversaries', ['id' => $id], $request->only([
            'title','anniversary_date','anniversary_type','notes','remind_days_before','is_recurring','account_id','metadata'
        ]));
        return $result['error'] ? $this->error('Update failed', 422) : $this->ok($result);
    }

    public function destroy(Request $request, string $id)
    {
        $result = $this->db($request)->delete('anniversaries', ['id' => $id]);
        return $result['error'] ? $this->error('Delete failed', 422) : $this->ok(null, 'Deleted');
    }
}

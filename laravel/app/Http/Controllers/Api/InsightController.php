<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\Request;

class InsightController extends BaseApiController
{
    public function index(Request $request)
    {
        $userId = $this->userId($request);
        $result = $this->db($request)->get('insights', [
            'user_id'     => "eq.{$userId}",
            'is_dismissed' => 'eq.false',
            'order'       => 'created_at.desc',
        ]);
        return $this->ok($result['error'] ? [] : $result);
    }

    public function markRead(Request $request, string $id)
    {
        $result = $this->db($request)->update('insights', ['id' => $id], ['is_read' => true]);
        return $result['error'] ? $this->error('Failed', 422) : $this->ok($result, 'Marked read');
    }

    public function dismiss(Request $request, string $id)
    {
        $result = $this->db($request)->update('insights', ['id' => $id], ['is_dismissed' => true]);
        return $result['error'] ? $this->error('Failed', 422) : $this->ok($result, 'Dismissed');
    }
}

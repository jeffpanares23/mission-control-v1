<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\Request;

class ReportController extends BaseApiController
{
    public function index(Request $request)
    {
        $userId = $this->userId($request);
        $result = $this->supabase->get('reports', ['user_id' => "eq.{$userId}", 'order' => 'created_at.desc']);
        return $this->ok($result['error'] ? [] : $result);
    }

    public function store(Request $request)
    {
        $userId = $this->userId($request);
        $payload = array_merge($request->only([
            'title','report_type','date_from','date_to','is_scheduled','schedule_cron','content'
        ]), ['user_id' => $userId]);
        $result = $this->supabase->insert('reports', $payload);
        return $result['error'] ? $this->error('Failed to create report', 422) : $this->ok($result, 'Created', 201);
    }

    public function show(Request $request, string $id)
    {
        $data = $this->supabase->get('reports', ['id' => "eq.{$id}"]);
        $items = $data['error'] ? [] : $data;
        return count($items) ? $this->ok($items[0]) : $this->error('Not found', 404);
    }

    public function update(Request $request, string $id)
    {
        $result = $this->supabase->update('reports', ['id' => $id], $request->only([
            'title','report_type','date_from','date_to','is_scheduled','schedule_cron','content'
        ]));
        return $result['error'] ? $this->error('Update failed', 422) : $this->ok($result);
    }

    public function destroy(Request $request, string $id)
    {
        $result = $this->supabase->delete('reports', ['id' => $id]);
        return $result['error'] ? $this->error('Delete failed', 422) : $this->ok(null, 'Deleted');
    }

    /**
     * POST /api/v1/reports/{id}/generate
     * Generate or regenerate a report's content.
     */
    public function generate(Request $request, string $id)
    {
        // Placeholder: in production, this would compute analytics,
        // pull task data, etc., and store the result in content JSONB.
        $payload = [
            'last_generated_at' => now()->toDateTimeString(),
            'content' => [
                'generated_at' => now()->toDateTimeString(),
                'summary' => 'Report content placeholder — implement analytics logic here.',
            ],
        ];
        $result = $this->supabase->update('reports', ['id' => $id], $payload);
        return $result['error'] ? $this->error('Generation failed', 422) : $this->ok($result, 'Report generated');
    }
}

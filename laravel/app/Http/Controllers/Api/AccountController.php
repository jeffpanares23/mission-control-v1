<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\Request;

class AccountController extends BaseApiController
{
    public function index(Request $request)
    {
        $userId = $this->userId($request);
        $data = $this->supabase->get('accounts', ['user_id' => "eq.{$userId}", 'order' => 'name.asc']);
        return $this->ok($data['error'] ? [] : $data);
    }

    public function store(Request $request)
    {
        $userId = $this->userId($request);
        $payload = array_merge($request->only(['name','email','phone','company','website','avatar_url','notes','tags','channel','channel_id','metadata']), [
            'user_id' => $userId,
        ]);
        $result = $this->supabase->insert('accounts', $payload);
        return $result['error']
            ? $this->error('Failed to create account', 422)
            : $this->ok($result, 'Account created', 201);
    }

    public function show(Request $request, string $id)
    {
        $data = $this->supabase->get('accounts', ['id' => "eq.{$id}"]);
        $items = $data['error'] ? [] : $data;
        return count($items) ? $this->ok($items[0]) : $this->error('Not found', 404);
    }

    public function update(Request $request, string $id)
    {
        $payload = $request->only(['name','email','phone','company','website','avatar_url','notes','tags','channel','channel_id','metadata']);
        $result = $this->supabase->update('accounts', ['id' => $id], $payload);
        return $result['error'] ? $this->error('Update failed', 422) : $this->ok($result);
    }

    public function destroy(Request $request, string $id)
    {
        $result = $this->supabase->delete('accounts', ['id' => $id]);
        return $result['error'] ? $this->error('Delete failed', 422) : $this->ok(null, 'Account deleted');
    }
}

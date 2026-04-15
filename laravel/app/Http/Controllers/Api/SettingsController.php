<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\Request;

class SettingsController extends BaseApiController
{
    /**
     * GET /api/v1/settings
     * Returns all settings key-value pairs for the user.
     */
    public function index(Request $request)
    {
        $userId = $this->userId($request);
        $result = $this->db($request)->get('settings', ['user_id' => "eq.{$userId}"]);

        if (!empty($result['error'])) {
            return $this->error('Failed to load settings', 422);
        }

        // Flatten key-value pairs into a simple associative array
        $settings = [];
        foreach ($result as $row) {
            $settings[$row['key']] = $row['value'];
        }

        return $this->ok($settings);
    }

    /**
     * PUT /api/v1/settings/{key}
     * Upsert a single setting.
     */
    public function update(Request $request, string $key)
    {
        $request->validate(['value' => 'required']);
        $userId = $this->userId($request);

        // Try update first
        $existing = $this->db($request)->get('settings', [
            'user_id' => "eq.{$userId}",
            'key'     => "eq.{$key}",
        ]);

        if (!empty($existing) && is_array($existing) && count($existing) > 0) {
            $result = $this->db($request)->update('settings',
                ['user_id' => $userId, 'key' => $key],
                ['value' => $request->input('value')]
            );
        } else {
            $result = $this->db($request)->insert('settings', [
                'user_id' => $userId,
                'key'     => $key,
                'value'   => $request->input('value'),
            ]);
        }

        return $result['error'] ?? false
            ? $this->error('Update failed', 422)
            : $this->ok(['key' => $key, 'value' => $request->input('value')], 'Setting saved');
    }
}

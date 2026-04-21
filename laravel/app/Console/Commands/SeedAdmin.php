<?php

namespace App\Console\Commands;

use App\Services\SupabaseService;
use Illuminate\Console\Command;

/**
 * SeedAdmin
 *
 * Creates a default super_admin user for Mission Control.
 * Idempotent — updates if user already exists.
 *
 * Creates: admin@missioncontrol.com / admin123
 *
 * Usage:
 *   php artisan mc:seed-admin
 */
class SeedAdmin extends Command
{
    protected $signature = 'mc:seed-admin';

    protected $description = 'Seed default super_admin user (admin@missioncontrol.com / admin123)';

    private string $serviceRoleKey;
    private SupabaseService $supabase;

    public function handle(SupabaseService $supabase): int
    {
        $this->supabase = $supabase;
        $this->serviceRoleKey = config('supabase.service_role_key');

        if (!$this->serviceRoleKey || $this->serviceRoleKey === 'your-service-role-key') {
            $this->error('SUPABASE_SERVICE_ROLE_KEY is not set in .env');
            return 1;
        }

        $this->info('Seeding admin user...');

        // 1. Ensure Patricia agent exists (needed for user→agent link)
        $agentId = $this->ensurePatriciaAgent();

        // 2. Create admin user
        $user = $this->upsertAdminUser();

        // 3. Link admin to Patricia agent (required for login)
        if ($user['id'] && $agentId) {
            $this->linkUserToAgent($user['id'], $agentId);
        }

        $this->info('Done. Admin user ready:');
        $this->table(
            ['Email', 'Password', 'Role'],
            [['admin@missioncontrol.com', 'admin123', 'super_admin']]
        );

        return 0;
    }

    private function ensurePatriciaAgent(): ?string
    {
        $existing = $this->supabase->get(
            'agents',
            ['select' => 'id', 'slug' => 'eq.patricia', 'limit' => 1],
            $this->serviceRoleKey
        );

        if (is_array($existing) && count($existing) > 0) {
            $this->line("  ✓ Patricia agent already exists [{$existing[0]['id']}]");
            return $existing[0]['id'];
        }

        $result = $this->supabase->insert('agents', [
            'slug'         => 'patricia',
            'name'         => 'Patricia',
            'supabase_url' => 'https://patricia.supabase.co', // Replace with real URL
            'supabase_key' => 'PATRICIA_SERVICE_ROLE_KEY',      // Replace with real key
            'anon_key'     => 'PATRICIA_ANON_KEY',              // Replace with real key
            'is_active'    => true,
        ], $this->serviceRoleKey);

        if (isset($result['error'])) {
            $this->warn('  ⚠ Could not create Patricia agent: ' . json_encode($result['error']));
            return null;
        }

        $id = is_array($result) ? ($result[0]['id'] ?? $result['id'] ?? null) : null;
        $this->line("  ✓ Patricia agent created [{$id}]");
        return $id;
    }

    private function upsertAdminUser(): array
    {
        $email = 'admin@missioncontrol.com';
        $password = 'admin123';
        $passwordHash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);

        $existing = $this->supabase->get(
            'users',
            ['select' => 'id,email,full_name,role,is_active', 'email' => "eq.{$email}", 'limit' => 1],
            $this->serviceRoleKey
        );

        if (is_array($existing) && count($existing) > 0) {
            // Update existing user
            $this->supabase->update(
                'users',
                ['email' => "eq.{$email}"],
                [
                    'password_hash' => $passwordHash,
                    'full_name'     => 'Admin',
                    'role'          => 'super_admin',
                    'is_active'     => true,
                ],
                $this->serviceRoleKey
            );
            $this->line("  ✓ Admin user updated [{$existing[0]['id']}]");
            return [
                'id'       => $existing[0]['id'],
                'email'    => $email,
                'full_name'=> 'Admin',
                'role'     => 'super_admin',
            ];
        }

        // Insert new user
        $result = $this->supabase->insert(
            'users',
            [
                'email'         => $email,
                'password_hash' => $passwordHash,
                'full_name'     => 'Admin',
                'role'          => 'super_admin',
                'is_active'     => true,
            ],
            $this->serviceRoleKey
        );

        if (isset($result['error'])) {
            $this->error("  ✗ Failed to create admin user: " . json_encode($result['error']));
            return ['id' => null, 'email' => $email, 'full_name' => 'Admin', 'role' => 'super_admin'];
        }

        $userId = is_array($result) ? ($result[0]['id'] ?? $result['id'] ?? null) : null;
        $this->line("  ✓ Admin user created [{$userId}]");

        return [
            'id'       => $userId,
            'email'    => $email,
            'full_name'=> 'Admin',
            'role'     => 'super_admin',
        ];
    }

    private function linkUserToAgent(string $userId, string $agentId): void
    {
        $existing = $this->supabase->get(
            'user_agent_access',
            [
                'select'  => 'id',
                'user_id'  => "eq.{$userId}",
                'agent_id' => "eq.{$agentId}",
                'limit'   => 1,
            ],
            $this->serviceRoleKey
        );

        if (is_array($existing) && count($existing) > 0) {
            // Re-activate existing link
            $this->supabase->update(
                'user_agent_access',
                ['user_id' => "eq.{$userId}", 'agent_id' => "eq.{$agentId}"],
                ['is_active' => true],
                $this->serviceRoleKey
            );
            $this->line("  ~ Admin → Patricia agent link re-activated");
        } else {
            $this->supabase->insert(
                'user_agent_access',
                [
                    'user_id'   => $userId,
                    'agent_id'  => $agentId,
                    'is_active' => true,
                    'can_admin' => true,
                ],
                $this->serviceRoleKey
            );
            $this->line("  ✓ Admin → Patricia agent link created");
        }
    }
}

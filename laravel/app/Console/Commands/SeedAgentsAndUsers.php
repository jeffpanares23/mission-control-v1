<?php

namespace App\Console\Commands;

use App\Services\SupabaseService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;

/**
 * SeedAgentsAndUsers
 *
 * Creates Patricia + Julie users, Ashley + Patricia agent records,
 * and the user→agent access links in the central Supabase DB.
 *
 * Usage:
 *   php artisan mc:seed-agents
 *
 * This is idempotent — uses ON CONFLICT DO NOTHING / UPDATE.
 */
class SeedAgentsAndUsers extends Command
{
    protected $signature = 'mc:seed-agents
                            {--patricia-email= : Override Patricia email}
                            {--patricia-pass= : Override Patricia password}
                            {--julie-email= : Override Julie email}
                            {--julie-pass= : Override Julie password}';

    protected $description = 'Seed Mission Control with Patricia, Julie, Ashley agent, and Patricia agent';

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

        $this->info('Seeding Mission Control agents and users...');

        // ─── 1. Agents ─────────────────────────────────────────────
        $this->seedAgents();

        // ─── 2. Users ─────────────────────────────────────────────
        $patricia = $this->seedPatricia();
        $julie    = $this->seedJulie();

        // ─── 3. User → Agent access links ─────────────────────────
        $this->seedUserAgentAccess($patricia['id'], $julie['id']);

        $this->info('Seed complete.');
        $this->table(
            ['User', 'Email', 'Agent', 'Agent DB'],
            [
                [$patricia['full_name'], $patricia['email'], 'Patricia', $this->option('patricia-email') ?? 'patricia@missioncontrol.ai'],
                [$julie['full_name'],    $julie['email'],    'Ashley',   $this->option('julie-email')    ?? 'julie@missioncontrol.ai'],
            ]
        );

        return 0;
    }

    private function seedAgents(): void
    {
        $agents = [
            [
                'slug'         => 'patricia',
                'name'         => 'Patricia',
                'supabase_url' => 'https://patricia.supabase.co',      // REPLACE with real Patricia Supabase URL
                'supabase_key' => 'PATRICIA_SERVICE_ROLE_KEY',          // REPLACE with real key
                'anon_key'     => 'PATRICIA_ANON_KEY',                  // REPLACE with real anon key
                'is_active'    => true,
            ],
            [
                'slug'         => 'ashley',
                'name'         => 'Ashley',
                'supabase_url' => 'https://ashley.supabase.co',        // REPLACE with real Ashley Supabase URL
                'supabase_key' => 'ASHLEY_SERVICE_ROLE_KEY',            // REPLACE with real key
                'anon_key'     => 'ASHLEY_ANON_KEY',                    // REPLACE with real anon key
                'is_active'    => true,
            ],
        ];

        foreach ($agents as $agent) {
            $this->directUpsertAgent($agent);
        }
    }

    private function directUpsertAgent(array $agent): void
    {
        // Check if exists
        $existing = $this->supabase->get(
            'agents',
            ['select' => 'id', 'slug' => "eq.{$agent['slug']}", 'limit' => 1],
            $this->serviceRoleKey
        );

        if (is_array($existing) && count($existing) > 0) {
            // Update
            $this->supabase->update(
                'agents',
                ['slug' => "eq.{$agent['slug']}"],
                [
                    'name'         => $agent['name'],
                    'supabase_url' => $agent['supabase_url'],
                    'supabase_key' => $agent['supabase_key'],
                    'anon_key'     => $agent['anon_key'],
                    'is_active'    => $agent['is_active'],
                ],
                $this->serviceRoleKey
            );
        } else {
            // Insert
            $this->supabase->insert('agents', $agent, $this->serviceRoleKey);
        }
        $this->line("  ✓ Agent [upserted]: {$agent['name']}");
    }

    private function seedPatricia(): array
    {
        $email = $this->option('patricia-email') ?: 'patricia@missioncontrol.ai';
        $password = $this->option('patricia-pass') ?: 'Patricia123!';

        return $this->upsertUser($email, $password, 'Patricia', 'agent');
    }

    private function seedJulie(): array
    {
        $email = $this->option('julie-email') ?: 'julie@missioncontrol.ai';
        $password = $this->option('julie-pass') ?: 'Julie123!';

        return $this->upsertUser($email, $password, 'Julie', 'agent');
    }

    private function upsertUser(string $email, string $password, string $fullName, string $role): array
    {
        $passwordHash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);

        // Check if exists
        $existing = $this->supabase->get(
            'users',
            ['select' => 'id,email,full_name,role,is_active', 'email' => "eq.{$email}", 'limit' => 1],
            $this->serviceRoleKey
        );

        if (is_array($existing) && count($existing) > 0) {
            // Update
            $this->supabase->update(
                'users',
                ['email' => "eq.{$email}"],
                ['password_hash' => $passwordHash, 'full_name' => $fullName, 'role' => $role, 'is_active' => true],
                $this->serviceRoleKey
            );
            $this->line("  ✓ User updated: {$fullName} ({$email})");
            return [
                'id' => $existing[0]['id'],
                'email' => $email,
                'full_name' => $fullName,
                'role' => $role,
            ];
        }

        // Insert
        $result = $this->supabase->insert(
            'users',
            [
                'email' => $email,
                'password_hash' => $passwordHash,
                'full_name' => $fullName,
                'role' => $role,
                'is_active' => true,
            ],
            $this->serviceRoleKey
        );

        if (isset($result['error'])) {
            $this->error("  ✗ Failed to create user {$fullName}: " . json_encode($result['error']));
            return ['id' => null, 'email' => $email, 'full_name' => $fullName, 'role' => $role];
        }

        $userId = is_array($result) ? ($result[0]['id'] ?? $result['id'] ?? null) : null;
        $this->line("  ✓ User created: {$fullName} ({$email})");

        return [
            'id' => $userId,
            'email' => $email,
            'full_name' => $fullName,
            'role' => $role,
        ];
    }

    private function seedUserAgentAccess(string $patriciaId, string $julieId): void
    {
        // Get agent IDs
        $patriciaAgent = $this->supabase->get(
            'agents',
            ['select' => 'id', 'slug' => 'eq.patricia', 'limit' => 1],
            $this->serviceRoleKey
        );
        $ashleyAgent = $this->supabase->get(
            'agents',
            ['select' => 'id', 'slug' => 'eq.ashley', 'limit' => 1],
            $this->serviceRoleKey
        );

        $patriciaAgentId = $patriciaAgent[0]['id'] ?? null;
        $ashleyAgentId    = $ashleyAgent[0]['id'] ?? null;

        if (!$patriciaAgentId || !$ashleyAgentId) {
            $this->warn('  ⚠ Could not find agents — skipping user_agent_access linking');
            return;
        }

        // Patricia → Patricia agent (her own DB)
        $this->linkUserToAgent($patriciaId, $patriciaAgentId, true);

        // Julie → Ashley agent (Julie maps to Ashley's DB)
        $this->linkUserToAgent($julieId, $ashleyAgentId, true);

        // Also give Patricia access to Ashley agent (so super_admin can switch)
        $this->linkUserToAgent($patriciaId, $ashleyAgentId, false);
    }

    private function linkUserToAgent(string $userId, string $agentId, bool $isActive): void
    {
        $existing = $this->supabase->get(
            'user_agent_access',
            [
                'select' => 'id',
                'user_id' => "eq.{$userId}",
                'agent_id' => "eq.{$agentId}",
                'limit' => 1,
            ],
            $this->serviceRoleKey
        );

        if (is_array($existing) && count($existing) > 0) {
            // Update is_active flag
            $this->supabase->update(
                'user_agent_access',
                ['user_id' => "eq.{$userId}", 'agent_id' => "eq.{$agentId}"],
                ['is_active' => $isActive],
                $this->serviceRoleKey
            );
            $this->line("  ~ Updated access: {$userId} → {$agentId} (active: " . ($isActive ? 'yes' : 'no') . ')');
        } else {
            $this->supabase->insert(
                'user_agent_access',
                [
                    'user_id' => $userId,
                    'agent_id' => $agentId,
                    'is_active' => $isActive,
                ],
                $this->serviceRoleKey
            );
            $this->line("  ✓ Linked: {$userId} → {$agentId} (active: " . ($isActive ? 'yes' : 'no') . ')');
        }
    }
}

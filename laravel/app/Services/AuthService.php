<?php

namespace App\Services;

use GuzzleHttp\Client;
use GuzzleHttp\Exception\GuzzleException;

/**
 * AuthService
 *
 * Centralised authentication for Mission Control.
 * Manages users, password hashing, JWT issuance/validation,
 * and session tracking against the central Supabase DB.
 *
 * Auth flow:
 *   1. Login  → verify email/password against central DB → issue JWT
 *   2. Logout → revoke JWT in user_sessions
 *   3. Validate token → check signature + expiry + session record
 *   4. Register → create user + assign default agent
 */
class AuthService
{
    private string $supabaseUrl;
    private string $serviceRoleKey;
    private string $jwtSecret;
    private Client $http;

    public function __construct(
        private SupabaseService $supabase
    ) {
        $this->supabaseUrl    = config('supabase.url');
        $this->serviceRoleKey = config('supabase.service_role_key');
        // HMAC secret for signing JWTs — set in .env as AUTH_JWT_SECRET
        $this->jwtSecret      = config('supabase.jwt_secret', env('AUTH_JWT_SECRET', 'mission-control-dev-secret'));
        $this->http           = new Client(['timeout' => 30]);
    }

    // ══════════════════════════════════════════════════════════════
    // PUBLIC API
    // ══════════════════════════════════════════════════════════════

    /**
     * POST /api/v1/auth/login
     *
     * Verifies credentials and returns a signed JWT + user context.
     * Returns: ['access_token', 'token_type' => 'Bearer', 'expires_in', 'user']
     */
    public function login(string $email, string $password): array
    {
        // 1. Fetch user from central users table
        $users = $this->supabase->get(
            'users',
            ['select' => '*', 'email' => "eq.{$email}", 'limit' => 1],
            $this->serviceRoleKey
        );

        if (!is_array($users) || count($users) === 0) {
            return ['error' => 'Invalid email or password.'];
        }

        $user = $users[0];

        if (!($user['is_active'] ?? true)) {
            return ['error' => 'Account is deactivated.'];
        }

        // 2. Verify password
        if (!password_verify($password, $user['password_hash'] ?? '')) {
            return ['error' => 'Invalid email or password.'];
        }

        // 3. Get user's active agent
        $agent = $this->getActiveAgent($user['id']);
        if (!$agent) {
            return ['error' => 'No agent access configured for this account. Contact super_admin.'];
        }

        // 4. Issue JWT
        $token = $this->issueToken($user, $agent);

        // 5. Store session
        $this->storeSession($user['id'], $token);

        // 6. Return safe user object (strip password_hash)
        return [
            'access_token' => $token,
            'token_type'   => 'Bearer',
            'expires_in'   => 86400, // 24 hours
            'user'         => $this->sanitisedUser($user, $agent),
        ];
    }

    /**
     * POST /api/v1/auth/logout
     *
     * Revokes the current session token.
     */
    public function logout(string $token): array
    {
        $hash = $this->hashToken($token);
        return $this->supabase->delete(
            'user_sessions',
            ['token_hash' => "eq.{$hash}"],
            $this->serviceRoleKey
        );
    }

    /**
     * POST /api/v1/auth/register
     *
     * Creates a new user with a default agent assignment.
     * Body: { email, password, full_name, agent_id? }
     */
    public function register(array $data): array
    {
        $email    = $data['email']    ?? null;
        $password = $data['password'] ?? null;
        $fullName = $data['full_name'] ?? null;
        $agentId  = $data['agent_id']  ?? null;

        if (!$email || !$password || !$fullName) {
            return ['error' => 'email, password, and full_name are required.'];
        }

        // Check uniqueness
        $existing = $this->supabase->get(
            'users',
            ['select' => 'id', 'email' => "eq.{$email}", 'limit' => 1],
            $this->serviceRoleKey
        );
        if (is_array($existing) && count($existing) > 0) {
            return ['error' => 'Email already registered.'];
        }

        // Hash password
        $passwordHash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);

        // Create user
        $user = $this->supabase->insert(
            'users',
            [
                'email'        => $email,
                'password_hash' => $passwordHash,
                'full_name'    => $fullName,
                'role'         => 'agent',
                'is_active'    => true,
            ],
            $this->serviceRoleKey
        );

        if (isset($user['error'])) {
            return ['error' => 'Failed to create user: ' . ($user['error']['message'] ?? $user['error'])];
        }

        $userId = is_array($user) ? ($user[0]['id'] ?? $user['id']) : null;
        if (!$userId) {
            // Try to extract from response
            $userId = $user['id'] ?? null;
        }

        // Assign default agent (Patricia's if not specified)
        if (!$agentId) {
            $agents = $this->supabase->get('agents', ['select' => 'id', 'slug' => 'eq.patricia', 'limit' => 1], $this->serviceRoleKey);
            $agentId = $agents[0]['id'] ?? null;
        }

        if ($agentId) {
            $this->supabase->insert(
                'user_agent_access',
                [
                    'user_id'   => $userId,
                    'agent_id'  => $agentId,
                    'is_active' => true,
                ],
                $this->serviceRoleKey
            );
        }

        return [
            'id'        => $userId,
            'email'     => $email,
            'full_name' => $fullName,
            'role'      => 'agent',
        ];
    }

    /**
     * Validate a Bearer token and return user + agent context.
     * Returns null if invalid, revoked, or expired.
     */
    public function validateToken(string $token): ?array
    {
        // 1. Verify JWT signature
        $payload = $this->decodeToken($token);
        if (!$payload) return null;

        // 2. Check expiry
        if (($payload['exp'] ?? 0) < time()) return null;

        // 3. Check session exists and is not revoked
        $hash = $this->hashToken($token);
        $sessions = $this->supabase->get(
            'user_sessions',
            [
                'select'  => '*',
                'token_hash' => "eq.{$hash}",
                'expires_at' => 'gt.now()',
                'limit'   => 1,
            ],
            $this->serviceRoleKey
        );

        if (!is_array($sessions) || count($sessions) === 0) {
            return null; // session revoked or expired
        }

        // 4. Fetch user
        $users = $this->supabase->get(
            'users',
            ['select' => '*', 'id' => 'eq.' . ($payload['uid'] ?? ''), 'limit' => 1],
            $this->serviceRoleKey
        );

        if (!is_array($users) || count($users) === 0) return null;
        $user = $users[0];

        if (!($user['is_active'] ?? true)) return null;

        // 5. Fetch agent
        $agentId = $payload['agent_id'] ?? null;
        $agent   = null;
        if ($agentId) {
            $agents = $this->supabase->get(
                'agents',
                ['select' => '*', 'id' => "eq.{$agentId}", 'is_active' => 'eq.true', 'limit' => 1],
                $this->serviceRoleKey
            );
            $agent = is_array($agents) && count($agents) > 0 ? $agents[0] : null;
        }

        return [
            'user'  => $this->sanitisedUser($user, $agent),
            'agent' => $agent,
        ];
    }

    /**
     * Get all agents accessible by a user.
     * Falls back to direct query if RPC is unavailable.
     */
    public function getUserAgents(string $userId): array
    {
        // Try RPC first
        try {
            $result = $this->supabase->rpc(
                'get_user_agents',
                ['p_user_id' => $userId],
                $this->serviceRoleKey
            );
            if (is_array($result) && !isset($result['error'])) {
                return $result;
            }
        } catch (\Throwable $e) {
            // RPC unavailable — fall through to direct query
        }

        // Fallback: direct join query
        $access = $this->supabase->get(
            'user_agent_access',
            [
                'select' => 'agent_id,is_active,can_admin',
                'user_id' => "eq.{$userId}",
            ],
            $this->serviceRoleKey
        );
        if (!is_array($access) || count($access) === 0) return [];

        $agentIds = array_column($access, 'agent_id');
        if (count($agentIds) === 0) return [];

        $agents = $this->supabase->get(
            'agents',
            [
                'select' => 'id,slug,name,is_active',
                'id' => 'in.(' . implode(',', $agentIds) . ')',
            ],
            $this->serviceRoleKey
        );
        if (!is_array($agents)) return [];

        $accessMap = array_column($access, null, 'agent_id');
        return array_map(fn($a) => [
            'agent_id'  => $a['id'],
            'slug'      => $a['slug'],
            'name'      => $a['name'],
            'is_active' => $accessMap[$a['id']]['is_active'] ?? false,
            'can_admin' => $accessMap[$a['id']]['can_admin'] ?? false,
        ], $agents);
    }

    /**
     * POST /api/v1/auth/telegram
     *
     * Validates Telegram initData and returns a signed JWT.
     * If the telegram_user_id is not yet linked, creates a new account.
     *
     * Telegram initData format (URL-encoded):
     *   query_id=xxx&user={"id":123,...}&auth_date=1234567890&hash=abc...
     *
     * Validation:
     *   1. Parse initData URL params
     *   2. Build data_check_string = sorted key=value\n pairs (excluding hash)
     *   3. HMAC-SHA256(data_check_string, bot_token) == hash
     *   4. Check auth_date is within 24 hours
     *   5. Find or create user by telegram_user_id
     *
     * Returns: ['access_token', 'token_type' => 'Bearer', 'expires_in', 'user']
     *          or ['error' => string]
     */
    public function loginWithTelegram(string $initData): array
    {
        // 1. Parse initData
        parse_str($initData, $params);
        if (!isset($params['hash'])) {
            return ['error' => 'Invalid Telegram initData: missing hash.'];
        }

        $hash = $params['hash'];
        unset($params['hash']);

        // 2. Build data_check_string (sorted key=value, newline-separated)
        ksort($params);
        $dataCheckParts = [];
        foreach ($params as $key => $value) {
            $dataCheckParts[] = "{$key}={$value}";
        }
        $dataCheckString = implode("\n", $dataCheckParts);

        // 3. Validate HMAC-SHA256 hash
        $botToken = config('supabase.telegram_bot_token', env('TELEGRAM_BOT_TOKEN', ''));
        if (empty($botToken)) {
            return ['error' => 'Telegram bot token not configured.'];
        }

        $expectedHash = hash_hmac('sha256', $dataCheckString, $botToken);
        if (!hash_equals($expectedHash, $hash)) {
            return ['error' => 'Telegram authentication failed: invalid hash.'];
        }

        // 4. Check auth_date is within 24 hours
        $authDate = intval($params['auth_date'] ?? 0);
        if ($authDate <= 0 || (time() - $authDate) > 86400) {
            return ['error' => 'Telegram authentication failed: initData expired or invalid auth_date.'];
        }

        // 5. Parse user JSON
        $userJson = $params['user'] ?? null;
        if (!$userJson) {
            return ['error' => 'Invalid Telegram initData: missing user data.'];
        }

        $tgUser = json_decode($userJson, true);
        if (!is_array($tgUser) || empty($tgUser['id'])) {
            return ['error' => 'Invalid Telegram user data.'];
        }

        $telegramUserId = strval($tgUser['id']);
        $telegramUsername = $tgUser['username'] ?? null;
        $firstName = $tgUser['first_name'] ?? '';
        $lastName = $tgUser['last_name'] ?? '';
        $fullName = trim("{$firstName} {$lastName}") ?: $telegramUsername ?? 'Telegram User';

        // 6. Find or create user by telegram_user_id
        $existing = $this->supabase->get(
            'users',
            ['select' => '*', 'telegram_user_id' => "eq.{$telegramUserId}", 'limit' => 1],
            $this->serviceRoleKey
        );

        $user = null;
        if (is_array($existing) && count($existing) > 0) {
            $user = $existing[0];
        } else {
            // Create new account
            $result = $this->createTelegramUser($telegramUserId, $telegramUsername, $fullName);
            if (isset($result['error'])) {
                return $result;
            }
            $user = $result;
        }

        if (!$user || !($user['is_active'] ?? true)) {
            return ['error' => 'Account is deactivated.'];
        }

        // 7. Get active agent
        $agent = $this->getActiveAgent($user['id']);
        if (!$agent) {
            return ['error' => 'No agent access configured for this account. Contact super_admin.'];
        }

        // 8. Issue JWT
        $token = $this->issueToken($user, $agent);

        // 9. Store session
        $this->storeSession($user['id'], $token);

        return [
            'access_token' => $token,
            'token_type'   => 'Bearer',
            'expires_in'   => 86400,
            'user'         => $this->sanitisedUser($user, $agent),
        ];
    }

    /**
     * Create a new user account linked to a Telegram account.
     */
    private function createTelegramUser(string $telegramUserId, ?string $username, string $fullName): array
    {
        // Generate a placeholder password — user will never log in with it
        $passwordHash = password_hash(bin2hex(random_bytes(16)), PASSWORD_BCRYPT, ['cost' => 12]);

        // Generate email from telegram handle if available
        $email = $username
            ? "{$username}@telegram.mc"
            : "telegram_{$telegramUserId}@telegram.mc";

        // Check if email already exists (edge case: user registered with email first)
        $existing = $this->supabase->get(
            'users',
            ['select' => 'id', 'email' => "eq.{$email}", 'limit' => 1],
            $this->serviceRoleKey
        );
        if (is_array($existing) && count($existing) > 0) {
            // Link telegram to existing account
            $this->supabase->update(
                'users',
                ['email' => "eq.{$email}"],
                ['telegram_user_id' => intval($telegramUserId)],
                $this->serviceRoleKey
            );
            // Re-fetch
            $existing = $this->supabase->get(
                'users',
                ['select' => '*', 'telegram_user_id' => "eq.{$telegramUserId}", 'limit' => 1],
                $this->serviceRoleKey
            );
            return $existing[0] ?? ['error' => 'Failed to link Telegram account.'];
        }

        // Create new user
        $inserted = $this->supabase->insert(
            'users',
            [
                'email'             => $email,
                'password_hash'     => $passwordHash,
                'full_name'         => $fullName,
                'role'              => 'agent',
                'is_active'         => true,
                'telegram_user_id'  => intval($telegramUserId),
            ],
            $this->serviceRoleKey
        );

        if (isset($inserted['error'])) {
            return ['error' => 'Failed to create Telegram user: ' . ($inserted['error']['message'] ?? $inserted['error'])];
        }

        // Extract new user id
        $newUser = is_array($inserted) ? ($inserted[0] ?? $inserted) : $inserted;
        $userId = $newUser['id'] ?? null;
        if (!$userId) {
            return ['error' => 'Failed to retrieve new user ID after creation.'];
        }

        // Assign default agent (Patricia's if not specified)
        $agents = $this->supabase->get(
            'agents',
            ['select' => 'id', 'slug' => 'eq.patricia', 'limit' => 1],
            $this->serviceRoleKey
        );
        $agentId = is_array($agents) && count($agents) > 0 ? $agents[0]['id'] ?? null : null;

        if ($agentId) {
            $this->supabase->insert(
                'user_agent_access',
                [
                    'user_id'   => $userId,
                    'agent_id'  => $agentId,
                    'is_active' => true,
                ],
                $this->serviceRoleKey
            );
        }

        // Re-fetch full user
        $fresh = $this->supabase->get(
            'users',
            ['select' => '*', 'id' => "eq.{$userId}", 'limit' => 1],
            $this->serviceRoleKey
        );

        return is_array($fresh) && count($fresh) > 0 ? $fresh[0] : ['error' => 'Failed to fetch newly created user.'];
    }

    /**
     * Switch a user's active agent scope.
     */
    public function setActiveAgent(string $userId, string $agentId): array
    {
        // Deactivate all current access for this user
        $this->supabase->update(
            'user_agent_access',
            ['user_id' => "eq.{$userId}"],
            ['is_active' => false],
            $this->serviceRoleKey
        );

        // Activate the target agent
        return $this->supabase->update(
            'user_agent_access',
            ['user_id' => "eq.{$userId}", 'agent_id' => "eq.{$agentId}"],
            ['is_active' => true],
            $this->serviceRoleKey
        );
    }

    // ══════════════════════════════════════════════════════════════
    // PRIVATE HELPERS
    // ══════════════════════════════════════════════════════════════

    private function issueToken(array $user, array $agent): string
    {
        $header  = $this->base64UrlEncode(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
        $payload = $this->base64UrlEncode(json_encode([
            'uid'      => $user['id'],
            'email'    => $user['email'],
            'role'     => $user['role'],
            'agent_id' => $agent['id'] ?? null,
            'iat'      => time(),
            'exp'      => time() + 86400, // 24 hours
        ]));
        $signature = $this->base64UrlEncode(
            hash_hmac('sha256', "{$header}.{$payload}", $this->jwtSecret, true)
        );
        return "{$header}.{$payload}.{$signature}";
    }

    private function decodeToken(string $token): ?array
    {
        $parts = explode('.', $token);
        if (count($parts) !== 3) return null;

        [$header, $payload, $signature] = $parts;

        $expectedSig = $this->base64UrlEncode(
            hash_hmac('sha256', "{$header}.{$payload}", $this->jwtSecret, true)
        );

        if (!hash_equals($expectedSig, $signature)) return null;

        $decoded = json_decode($this->base64UrlDecode($payload), true);
        return is_array($decoded) ? $decoded : null;
    }

    private function storeSession(string $userId, string $token): void
    {
        $this->supabase->insert(
            'user_sessions',
            [
                'user_id'    => $userId,
                'token_hash' => $this->hashToken($token),
                'expires_at' => date('Y-m-d\TH:i:s\Z', time() + 86400),
            ],
            $this->serviceRoleKey
        );
    }

    private function getActiveAgent(string $userId): ?array
    {
        $result = $this->supabase->rpc(
            'get_active_agent',
            ['p_user_id' => $userId],
            $this->serviceRoleKey
        );
        if (!is_array($result) || (isset($result['error']) && $result['error'])) {
            // Fallback: try direct query
            $access = $this->supabase->get(
                'user_agent_access',
                [
                    'select' => 'agent_id,is_active',
                    'user_id' => "eq.{$userId}",
                    'is_active' => 'eq.true',
                    'limit' => 1,
                ],
                $this->serviceRoleKey
            );
            if (!is_array($access) || count($access) === 0) return null;
            $agents = $this->supabase->get(
                'agents',
                ['select' => '*', 'id' => "eq.{$access[0]['agent_id']}", 'is_active' => 'eq.true', 'limit' => 1],
                $this->serviceRoleKey
            );
            return is_array($agents) && count($agents) > 0 ? $agents[0] : null;
        }
        return is_array($result) && count($result) > 0 ? $result[0] : null;
    }

    private function sanitisedUser(array $user, ?array $agent): array
    {
        return [
            'id'           => $user['id'],
            'email'        => $user['email'],
            'full_name'    => $user['full_name'],
            'role'         => $user['role'],
            'is_active'    => $user['is_active'] ?? true,
            'agent_id'     => $agent['id'] ?? null,
            'agent_slug'   => $agent['slug'] ?? null,
            'agent_name'   => $agent['name'] ?? null,
        ];
    }

    private function hashToken(string $token): string
    {
        return hash('sha256', $token);
    }

    private function base64UrlEncode(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    private function base64UrlDecode(string $data): string
    {
        return base64_decode(strtr($data, '-_', '+/'));
    }
}

<?php

namespace App\Http\Controllers\Api;

use App\Services\AuthService;
use App\Services\SupabaseService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuthController extends BaseApiController
{
    protected AuthService $auth;

    public function __construct(AuthService $auth, SupabaseService $supabase)
    {
        $this->auth = $auth;
        $this->supabase = $supabase;
    }

    // ══════════════════════════════════════════════════════════════
    // PUBLIC ROUTES (no auth required)
    // ══════════════════════════════════════════════════════════════

    /**
     * POST /api/v1/auth/login
     * Body: { email, password }
     */
    public function login(Request $request): JsonResponse
    {
        $email    = $request->input('email');
        $password = $request->input('password');

        if (!$email || !$password) {
            return $this->error('email and password are required.', 422);
        }

        $result = $this->auth->login($email, $password);

        if (isset($result['error'])) {
            return $this->error($result['error'], 401);
        }

        return $this->ok($result, 'Login successful');
    }

    /**
     * POST /api/v1/auth/register
     * Body: { email, password, full_name, agent_id? }
     */
    public function register(Request $request): JsonResponse
    {
        $result = $this->auth->register($request->only(['email', 'password', 'full_name', 'agent_id']));

        if (isset($result['error'])) {
            return $this->error($result['error'], 422);
        }

        return $this->ok($result, 'Registration successful', 201);
    }

    /**
     * POST /api/v1/auth/telegram
     * Body: { initData } — raw Telegram Login Widget initData string
     *
     * Validates Telegram HMAC signature, finds or creates the user,
     * and returns a JWT — same shape as email/password login.
     */
    public function loginWithTelegram(Request $request): JsonResponse
    {
        $initData = $request->input('initData');

        if (!$initData || !is_string($initData)) {
            return $this->error('initData is required.', 422);
        }

        $result = $this->auth->loginWithTelegram($initData);

        if (isset($result['error'])) {
            return $this->error($result['error'], 401);
        }

        return $this->ok($result, 'Login successful');
    }

    // ══════════════════════════════════════════════════════════════
    // PROTECTED ROUTES (auth required)
    // ══════════════════════════════════════════════════════════════

    /**
     * POST /api/v1/auth/logout
     * Header: Authorization: Bearer <token>
     */
    public function logout(Request $request): JsonResponse
    {
        $token = $this->extractBearerToken($request);
        if (!$token) {
            return $this->error('No token provided.', 401);
        }

        $this->auth->logout($token);
        return $this->ok(null, 'Logged out successfully');
    }

    /**
     * GET /api/v1/auth/me
     * Returns the authenticated user's context (user + active agent).
     */
    public function me(Request $request): JsonResponse
    {
        $user = $request->attributes->get('user');
        $agent = $request->attributes->get('agent');

        if (!$user) {
            return $this->error('Unauthenticated.', 401);
        }

        return $this->ok([
            'user'  => $user,
            'agent' => $agent,
        ]);
    }

    /**
     * GET /api/v1/auth/agents
     * List all agents accessible to the authenticated user.
     */
    public function agents(Request $request): JsonResponse
    {
        $user = $request->attributes->get('user');
        if (!$user) return $this->error('Unauthenticated.', 401);

        $agents = $this->auth->getUserAgents($user['id']);
        return $this->ok($agents);
    }

    /**
     * POST /api/v1/auth/switch-agent
     * Body: { agent_id }
     * Switch the user's active agent scope.
     */
    public function switchAgent(Request $request): JsonResponse
    {
        $user    = $request->attributes->get('user');
        $agentId = $request->input('agent_id');

        if (!$user)  return $this->error('Unauthenticated.', 401);
        if (!$agentId) return $this->error('agent_id is required.', 422);

        $result = $this->auth->setActiveAgent($user['id'], $agentId);
        if (isset($result['error'])) {
            return $this->error($result['error'], 422);
        }

        // Re-fetch user context with new agent
        $token = $this->extractBearerToken($request);
        $valid = $this->auth->validateToken($token);

        return $this->ok([
            'user'  => $valid['user']  ?? null,
            'agent' => $valid['agent'] ?? null,
        ], 'Agent switched successfully');
    }

    // ══════════════════════════════════════════════════════════════
    // PRIVATE
    // ══════════════════════════════════════════════════════════════

    private function extractBearerToken(Request $request): ?string
    {
        $header = $request->header('Authorization', '');
        if (str_starts_with($header, 'Bearer ')) {
            $token = trim(substr($header, 7));
            return $token ?: null;
        }
        return null;
    }
}

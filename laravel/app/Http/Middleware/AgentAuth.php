<?php

namespace App\Http\Middleware;

use App\Services\AgentDatabaseService;
use App\Services\AuthService;
use App\Services\SupabaseService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * AgentAuth Middleware
 *
 * Validates the Bearer JWT token and injects into $request->attributes:
 *   - 'user'  => sanitised user object
 *   - 'agent' => active agent config array
 *   - 'agentDb' => AgentDatabaseService instance configured for this user's agent
 *
 * Usage in routes:
 *   Route::middleware('agent.auth')->group(function () { ... });
 */
class AgentAuth
{
    public function __construct(
        private AuthService $auth,
        private SupabaseService $supabase,
        private AgentDatabaseService $agentDb
    ) {}

    public function handle(Request $request, Closure $next): Response
    {
        $token = $this->extractBearerToken($request);

        if (!$token) {
            return response()->json(['error' => 'Authentication required.', 'code' => 'UNAUTHENTICATED'], 401);
        }

        // Validate token and get user + agent context
        $context = $this->auth->validateToken($token);

        if (!$context) {
            return response()->json(['error' => 'Invalid or expired token.', 'code' => 'INVALID_TOKEN'], 401);
        }

        ['user' => $user, 'agent' => $agent] = $context;

        // Inject user into request attributes
        $request->attributes->set('user', $user);
        $request->attributes->set('agent', $agent);

        // Configure AgentDatabaseService for this request's agent
        if ($agent) {
            $this->agentDb->setActiveAgent($agent);
        } else {
            $this->agentDb->clearActiveAgent();
        }
        $request->attributes->set('agentDb', $this->agentDb);

        return $next($request);
    }

    /**
     * Optional guard for super_admin only.
     * Usage: ->middleware(['agent.auth', 'agent.super_admin'])
     */
    public function handleSuperAdmin(Request $request, Closure $next): Response
    {
        $user = $request->attributes->get('user');

        if (($user['role'] ?? null) !== 'super_admin') {
            return response()->json([
                'error' => 'Super admin access required.',
                'code'  => 'FORBIDDEN',
            ], 403);
        }

        return $next($request);
    }

    private function extractBearerToken(Request $request): ?string
    {
        $header = $request->header('Authorization', '');
        if (str_starts_with($header, 'Bearer ')) {
            return trim(substr($header, 7)) ?: null;
        }
        return null;
    }
}

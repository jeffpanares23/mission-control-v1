<?php

namespace App\Http\Middleware;

use App\Services\JwtService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * ValidateSupabaseToken — Middleware that validates the Supabase JWT
 * Bearer token on protected API routes and injects user context.
 *
 * Sets $request->user_context with:
 *   id, email, role, full_name, is_active, profile_id
 *
 * If no Bearer token or invalid → 401 JSON response.
 */
class ValidateSupabaseToken
{
    private JwtService $jwt;

    public function __construct(JwtService $jwt)
    {
        $this->jwt = $jwt;
    }

    public function handle(Request $request, Closure $next): Response
    {
        $header = $request->header('Authorization', '');

        if (!str_starts_with($header, 'Bearer ')) {
            return response()->json([
                'success' => false,
                'message' => 'Missing or invalid Authorization header.',
            ], 401);
        }

        $token = trim(substr($header, 7));

        if (empty($token)) {
            return response()->json([
                'success' => false,
                'message' => 'Empty bearer token.',
            ], 401);
        }

        $user = $this->jwt->resolveUser($token);

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid or expired token.',
            ], 401);
        }

        if (!$user['is_active']) {
            return response()->json([
                'success' => false,
                'message' => 'Account is deactivated. Contact your administrator.',
            ], 403);
        }

        // Inject validated user context into the request
        $request->attributes->set('user_context', $user);

        return $next($request);
    }
}

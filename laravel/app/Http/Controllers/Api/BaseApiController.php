<?php

namespace App\Http\Controllers\Api;

use App\Services\AgentDatabaseService;
use App\Services\SupabaseService;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

class BaseApiController extends Controller
{
    public function __construct(
        protected SupabaseService $supabase
    ) {}

    /**
     * Return a success JSON response.
     */
    protected function ok(mixed $data = null, string $message = 'OK', int $code = 200): \Illuminate\Http\JsonResponse
    {
        return response()->json([
            'success' => true,
            'message' => $message,
            'data' => $data,
        ], $code);
    }

    /**
     * Return an error JSON response.
     */
    protected function error(string $message = 'Error', int $code = 400): \Illuminate\Http\JsonResponse
    {
        return response()->json([
            'success' => false,
            'message' => $message,
        ], $code);
    }

    /**
     * Get the authenticated user's ID from AgentAuth middleware.
     * The middleware sets 'user' => ['id', 'email', 'role', ...] in $request->attributes.
     */
    protected function userId(Request $request): string
    {
        $user = $request->attributes->get('user');
        return $user['id'] ?? throw new \RuntimeException(
            'User not set. Ensure agent.auth middleware is applied.'
        );
    }

    /**
     * Get the full user context array from AgentAuth middleware.
     */
    protected function userContext(Request $request): ?array
    {
        return $request->attributes->get('user');
    }

    /**
     * Get the active AgentDatabaseService for this request.
     * Routes all agent-scoped data queries to the correct agent Supabase project.
     */
    protected function db(Request $request): AgentDatabaseService
    {
        $agentDb = $request->attributes->get('agentDb');
        if (!$agentDb instanceof AgentDatabaseService) {
            throw new \RuntimeException(
                'AgentDatabaseService not available. Ensure agent.auth middleware is applied.'
            );
        }
        return $agentDb;
    }
}

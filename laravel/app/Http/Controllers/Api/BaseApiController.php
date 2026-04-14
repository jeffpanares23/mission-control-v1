<?php

namespace App\Http\Controllers\Api;

use App\Services\SupabaseService;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

class BaseApiController extends Controller
{
    protected SupabaseService $supabase;

    public function __construct(SupabaseService $supabase)
    {
        $this->supabase = $supabase;
    }

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
     * Get authenticated user ID from Sanctum token.
     */
    protected function userId(Request $request): string
    {
        return $request->user()->id;
    }
}

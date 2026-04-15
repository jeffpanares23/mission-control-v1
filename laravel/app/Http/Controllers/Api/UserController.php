<?php

namespace App\Http\Controllers\Api;

use App\Services\SupabaseService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\GuzzleException;

/**
 * UserController — Super admin user management (central DB).
 *
 * All routes require: role = 'super_admin'
 * All routes use the central Supabase DB (not agent-scoped).
 *
 * GET    /api/v1/users       — List all users
 * POST   /api/v1/users       — Create a new user
 * GET    /api/v1/users/{id}  — Get a single user
 * PATCH  /api/v1/users/{id}  — Update user (role, name, is_active)
 * DELETE /api/v1/users/{id}  — Deactivate a user (soft delete)
 */
class UserController extends BaseApiController
{
    private string $serviceRoleKey;
    private Client $http;

    public function __construct(SupabaseService $supabase)
    {
        parent::__construct($supabase);
        $this->serviceRoleKey = config('supabase.service_role_key');
        $this->http           = new Client(['timeout' => 30]);
    }

    /**
     * Ensure the requesting user is a super_admin.
     */
    private function requireSuperAdmin(Request $request): ?JsonResponse
    {
        $user = $request->attributes->get('user');
        if (!$user || ($user['role'] ?? null) !== 'super_admin') {
            return $this->error('Forbidden. Super admin access required.', 403);
        }
        return null;
    }

    /**
     * GET /api/v1/users
     * List all users from the central DB.
     */
    public function index(Request $request): JsonResponse
    {
        if ($err = $this->requireSuperAdmin($request)) return $err;

        $users = $this->supabase->get(
            'users',
            ['select' => 'id,email,full_name,role,is_active,created_at', 'order' => 'created_at.desc'],
            $this->serviceRoleKey
        );

        if (!is_array($users) || isset($users['error'])) {
            return $this->ok([]);
        }

        return $this->ok($users);
    }

    /**
     * POST /api/v1/users
     * Create a new user in the central DB.
     * Body: { email, password, full_name, role }
     */
    public function store(Request $request): JsonResponse
    {
        if ($err = $this->requireSuperAdmin($request)) return $err;

        $email    = $request->input('email');
        $password = $request->input('password');
        $fullName = $request->input('full_name');
        $role     = $request->input('role', 'agent');

        if (!$email || !$password || !$fullName) {
            return $this->error('email, password, and full_name are required.', 422);
        }

        if (!in_array($role, ['super_admin', 'agent'], true)) {
            return $this->error('role must be "super_admin" or "agent".', 422);
        }

        // Check uniqueness
        $existing = $this->supabase->get(
            'users',
            ['select' => 'id', 'email' => "eq.{$email}", 'limit' => 1],
            $this->serviceRoleKey
        );
        if (is_array($existing) && count($existing) > 0) {
            return $this->error('Email already registered.', 422);
        }

        $result = $this->supabase->insert(
            'users',
            [
                'email'         => $email,
                'password_hash' => password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]),
                'full_name'    => $fullName,
                'role'         => $role,
                'is_active'    => true,
            ],
            $this->serviceRoleKey
        );

        if (isset($result['error'])) {
            return $this->error('Failed to create user: ' . ($result['error']['message'] ?? $result['error']), 422);
        }

        $userId = is_array($result) ? ($result[0]['id'] ?? $result['id'] ?? null) : null;

        return $this->ok([
            'id'        => $userId,
            'email'     => $email,
            'full_name' => $fullName,
            'role'      => $role,
            'is_active' => true,
        ], 'User created successfully', 201);
    }

    /**
     * GET /api/v1/users/{id}
     * Get a single user by ID.
     */
    public function show(Request $request, string $id): JsonResponse
    {
        if ($err = $this->requireSuperAdmin($request)) return $err;

        $users = $this->supabase->get(
            'users',
            ['id' => "eq.{$id}", 'select' => 'id,email,full_name,role,is_active,created_at', 'limit' => 1],
            $this->serviceRoleKey
        );

        if (!is_array($users) || count($users) === 0) {
            return $this->error('User not found.', 404);
        }

        return $this->ok($users[0]);
    }

    /**
     * PATCH /api/v1/users/{id}
     * Update a user's role, full_name, or is_active.
     */
    public function update(Request $request, string $id): JsonResponse
    {
        if ($err = $this->requireSuperAdmin($request)) return $err;

        $role     = $request->input('role');
        $fullName = $request->input('full_name');
        $isActive = $request->input('is_active');

        $updates = [];
        if ($fullName !== null) $updates['full_name'] = $fullName;
        if ($role !== null) {
            if (!in_array($role, ['super_admin', 'agent'], true)) {
                return $this->error('role must be "super_admin" or "agent".', 422);
            }
            $updates['role'] = $role;
        }
        if ($isActive !== null) $updates['is_active'] = (bool) $isActive;

        if (empty($updates)) {
            return $this->error('No valid fields to update.', 422);
        }

        $result = $this->supabase->update(
            'users',
            ['id' => "eq.{$id}"],
            $updates,
            $this->serviceRoleKey
        );

        if (isset($result['error'])) {
            return $this->error('Update failed.', 422);
        }

        // Fetch updated user
        $users = $this->supabase->get(
            'users',
            ['id' => "eq.{$id}", 'select' => 'id,email,full_name,role,is_active,created_at', 'limit' => 1],
            $this->serviceRoleKey
        );

        return $this->ok($users[0] ?? null, 'User updated successfully');
    }

    /**
     * DELETE /api/v1/users/{id}
     * Soft-delete: set is_active=false.
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        if ($err = $this->requireSuperAdmin($request)) return $err;

        // Prevent self-deactivation
        $current = $request->attributes->get('user');
        if (($current['id'] ?? null) === $id) {
            return $this->error('Cannot deactivate your own account.', 422);
        }

        $result = $this->supabase->update(
            'users',
            ['id' => "eq.{$id}"],
            ['is_active' => false],
            $this->serviceRoleKey
        );

        if (isset($result['error'])) {
            return $this->error('Deactivation failed.', 422);
        }

        return $this->ok(null, 'User deactivated successfully');
    }
}

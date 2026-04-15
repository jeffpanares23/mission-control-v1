<?php

namespace App\Services;

use GuzzleHttp\Client;
use GuzzleHttp\Exception\GuzzleException;

/**
 * JwtService — Validates Supabase JWTs and retrieves user metadata.
 *
 * Supabase issues JWTs signed with a secret known only to the server.
 * To validate a Bearer token we hit the Supabase GoTrue `/verify` endpoint.
 * We also retrieve the user's profile (role) from our profiles table.
 */
class JwtService
{
    private string $supabaseUrl;
    private string $anonKey;
    private string $serviceRoleKey;
    private Client $http;

    public function __construct()
    {
        $this->supabaseUrl    = config('supabase.url');
        $this->anonKey        = config('supabase.anon_key');
        $this->serviceRoleKey = config('supabase.service_role_key');
        $this->http           = new Client(['timeout' => 10]);
    }

    /**
     * Validate a Supabase Bearer token and return the decoded claims.
     * Returns null if invalid or expired.
     */
    public function validateToken(string $token): ?array
    {
        try {
            $response = $this->http->post(
                "{$this->supabaseUrl}/auth/v1/token/verify",
                [
                    'headers' => [
                        'apikey'       => $this->serviceRoleKey,
                        'Authorization' => "Bearer {$this->serviceRoleKey}",
                        'Content-Type'  => 'application/json',
                    ],
                    'json' => [
                        'token'     => $token,
                        'type'      => 'access',
                    ],
                ]
            );

            $data = json_decode($response->getBody()->getContents(), true);

            // Supabase returns: { id, email, aud, role, ... }
            if (isset($data['id'])) {
                return [
                    'id'         => $data['id'],
                    'email'      => $data['email'] ?? null,
                    'role'       => $data['role'] ?? 'authenticated',
                    'aud'        => $data['aud'] ?? null,
                    'expires_at' => $data['expires_at'] ?? null,
                    'app_meta'   => $data['app_metadata'] ?? [],
                    'user_meta'  => $data['user_metadata'] ?? [],
                ];
            }

            return null;
        } catch (GuzzleException $e) {
            // Token invalid or expired
            return null;
        }
    }

    /**
     * Get the user's profile (role) from the profiles table.
     * Uses the service role key so we bypass RLS.
     */
    public function getProfile(string $userId): ?array
    {
        try {
            $response = $this->http->get(
                "{$this->supabaseUrl}/rest/v1/profiles",
                [
                    'headers' => [
                        'apikey'        => $this->serviceRoleKey,
                        'Authorization'  => "Bearer {$this->serviceRoleKey}",
                        'Content-Type'   => 'application/json',
                        'Prefer'         => 'return=representation',
                    ],
                    'query' => [
                        'user_id' => "eq.{$userId}",
                        'select'   => '*,id,user_id,full_name,role,is_active',
                        'limit'   => '1',
                    ],
                ]
            );

            $profiles = json_decode($response->getBody()->getContents(), true);
            return $profiles[0] ?? null;
        } catch (GuzzleException $e) {
            return null;
        }
    }

    /**
     * Combine token validation + profile lookup.
     * Returns a full user context object or null.
     */
    public function resolveUser(string $token): ?array
    {
        $claims = $this->validateToken($token);
        if (!$claims) {
            return null;
        }

        $profile = $this->getProfile($claims['id']);

        return [
            'id'         => $claims['id'],
            'email'      => $claims['email'],
            'role'       => $profile['role'] ?? 'agent',
            'full_name'  => $profile['full_name'] ?? $claims['email'],
            'is_active'  => $profile['is_active'] ?? true,
            'profile_id' => $profile['id'] ?? null,
        ];
    }
}

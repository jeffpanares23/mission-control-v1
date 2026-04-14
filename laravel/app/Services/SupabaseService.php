<?php

namespace App\Services;

use GuzzleHttp\Client;
use GuzzleHttp\Exception\GuzzleException;

class SupabaseService
{
    private string $url;
    private string $anonKey;
    private string $serviceRoleKey;
    private Client $client;

    public function __construct()
    {
        $this->url = config('supabase.url');
        $this->anonKey = config('supabase.anon_key');
        $this->serviceRoleKey = config('supabase.service_role_key');
        $this->client = new Client([
            'base_uri' => $this->url,
            'timeout' => 30,
        ]);
    }

    /**
     * Build headers for authenticated requests.
     */
    private function authHeaders(string $bearerToken = null): array
    {
        $token = $bearerToken ?? $this->anonKey;
        return [
            'apikey' => $this->anonKey,
            'Authorization' => "Bearer {$token}",
            'Content-Type' => 'application/json',
            'Prefer' => 'return=representation',
        ];
    }

    /**
     * GET a resource from Supabase.
     */
    public function get(string $table, array $params = [], string $bearerToken = null): array
    {
        try {
            $response = $this->client->get("/rest/v1/{$table}", [
                'headers' => $this->authHeaders($bearerToken),
                'query' => $params,
            ]);
            return json_decode($response->getBody()->getContents(), true) ?? [];
        } catch (GuzzleException $e) {
            return ['error' => $e->getMessage()];
        }
    }

    /**
     * POST (insert) a new record.
     */
    public function insert(string $table, array $data, string $bearerToken = null): array
    {
        try {
            $response = $this->client->post("/rest/v1/{$table}", [
                'headers' => $this->authHeaders($bearerToken),
                'json' => $data,
            ]);
            return json_decode($response->getBody()->getContents(), true) ?? [];
        } catch (GuzzleException $e) {
            return ['error' => $e->getMessage()];
        }
    }

    /**
     * PATCH (update) a record.
     */
    public function update(string $table, array $filters, array $data, string $bearerToken = null): array
    {
        try {
            $query = http_build_query($filters);
            $response = $this->client->patch("/rest/v1/{$table}?{$query}", [
                'headers' => $this->authHeaders($bearerToken),
                'json' => $data,
            ]);
            return json_decode($response->getBody()->getContents(), true) ?? [];
        } catch (GuzzleException $e) {
            return ['error' => $e->getMessage()];
        }
    }

    /**
     * DELETE a record.
     */
    public function delete(string $table, array $filters, string $bearerToken = null): array
    {
        try {
            $query = http_build_query($filters);
            $response = $this->client->delete("/rest/v1/{$table}?{$query}", [
                'headers' => $this->authHeaders($bearerToken),
            ]);
            return json_decode($response->getBody()->getContents(), true) ?? [];
        } catch (GuzzleException $e) {
            return ['error' => $e->getMessage()];
        }
    }

    /**
     * RPC (call a Supabase Edge Function).
     */
    public function rpc(string $fnName, array $params = [], string $bearerToken = null): array
    {
        try {
            $response = $this->client->post("/rest/v1/rpc/{$fnName}", [
                'headers' => $this->authHeaders($bearerToken),
                'json' => $params,
            ]);
            return json_decode($response->getBody()->getContents(), true) ?? [];
        } catch (GuzzleException $e) {
            return ['error' => $e->getMessage()];
        }
    }

    /**
     * Subscribe to Realtime channel (returns channel name for client-side subscription).
     */
    public function realtimeChannel(string $table): string
    {
        return "realtime:{$table}";
    }
}

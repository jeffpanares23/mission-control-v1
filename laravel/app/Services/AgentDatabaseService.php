<?php

namespace App\Services;

use GuzzleHttp\Client;
use GuzzleHttp\Exception\GuzzleException;

/**
 * AgentDatabaseService
 *
 * Dynamically routes Supabase REST API calls to the correct agent DB
 * based on the authenticated user's active agent scope.
 *
 * Usage:
 *   $agentDb = new AgentDatabaseService($centralSupabase);
 *   $agentDb->setActiveAgent($agentConfig);  // from user_agent_access
 *   $tasks = $agentDb->get('tasks', ['select' => '*']);
 */
class AgentDatabaseService
{
    private ?string $agentUrl    = null;
    private ?string $agentKey    = null;
    private ?string $agentAnon   = null;
    private ?Client $client      = null;

    public function __construct(
        private SupabaseService $centralDb
    ) {}

    /**
     * Configure this instance to point at a specific agent's Supabase project.
     * $agentConfig comes from the central DB — agents table row.
     */
    public function setActiveAgent(array $agentConfig): void
    {
        $this->agentUrl  = $agentConfig['supabase_url'];
        $this->agentKey  = $agentConfig['supabase_key'];
        $this->agentAnon = $agentConfig['anon_key'];

        $this->client = new Client([
            'base_uri' => rtrim($this->agentUrl, '/') . '/rest/v1/',
            'timeout'  => 30,
        ]);
    }

    /**
     * Clear active agent (reset state).
     */
    public function clearActiveAgent(): void
    {
        $this->agentUrl  = null;
        $this->agentKey  = null;
        $this->agentAnon = null;
        $this->client    = null;
    }

    /**
     * Returns true if an agent is currently configured.
     */
    public function hasAgent(): bool
    {
        return $this->client !== null;
    }

    /**
     * Get the configured agent's URL (for reference).
     */
    public function getAgentUrl(): ?string
    {
        return $this->agentUrl;
    }

    // ─── REST methods (forwarded to the agent's Supabase) ────────

    public function get(string $table, array $params = [], string $bearerToken = null): array
    {
        if ($err = $this->ensureAgent()) return $err;
        try {
            $response = $this->client->get($table, [
                'headers' => $this->authHeaders($bearerToken),
                'query'   => $params,
            ]);
            return json_decode($response->getBody()->getContents(), true) ?? [];
        } catch (GuzzleException $e) {
            return ['error' => $e->getMessage(), 'table' => $table];
        }
    }

    public function insert(string $table, array $data, string $bearerToken = null): array
    {
        if ($err = $this->ensureAgent()) return $err;
        try {
            $response = $this->client->post($table, [
                'headers' => $this->authHeaders($bearerToken),
                'json'    => $data,
            ]);
            return json_decode($response->getBody()->getContents(), true) ?? [];
        } catch (GuzzleException $e) {
            return ['error' => $e->getMessage(), 'table' => $table];
        }
    }

    public function update(string $table, array $filters, array $data, string $bearerToken = null): array
    {
        if ($err = $this->ensureAgent()) return $err;
        try {
            $query = http_build_query($filters);
            $response = $this->client->patch("{$table}?{$query}", [
                'headers' => $this->authHeaders($bearerToken),
                'json'    => $data,
            ]);
            return json_decode($response->getBody()->getContents(), true) ?? [];
        } catch (GuzzleException $e) {
            return ['error' => $e->getMessage(), 'table' => $table];
        }
    }

    public function delete(string $table, array $filters, string $bearerToken = null): array
    {
        if ($err = $this->ensureAgent()) return $err;
        try {
            $query = http_build_query($filters);
            $response = $this->client->delete("{$table}?{$query}", [
                'headers' => $this->authHeaders($bearerToken),
            ]);
            return json_decode($response->getBody()->getContents(), true) ?? [];
        } catch (GuzzleException $e) {
            return ['error' => $e->getMessage(), 'table' => $table];
        }
    }

    /**
     * RPC call on the agent's Supabase (edge functions).
     */
    public function rpc(string $fnName, array $params = [], string $bearerToken = null): array
    {
        if ($err = $this->ensureAgent()) return $err;
        try {
            $response = $this->client->post("rpc/{$fnName}", [
                'headers' => $this->authHeaders($bearerToken),
                'json'    => $params,
            ]);
            return json_decode($response->getBody()->getContents(), true) ?? [];
        } catch (GuzzleException $e) {
            return ['error' => $e->getMessage(), 'fn' => $fnName];
        }
    }

    // ─── Central DB accessors (pass through to $centralDb) ──────

    public function centralGet(string $table, array $params = [], string $bearerToken = null): array
    {
        return $this->centralDb->get($table, $params, $bearerToken);
    }

    public function centralInsert(string $table, array $data, string $bearerToken = null): array
    {
        return $this->centralDb->insert($table, $data, $bearerToken);
    }

    public function centralUpdate(string $table, array $filters, array $data, string $bearerToken = null): array
    {
        return $this->centralDb->update($table, $filters, $data, $bearerToken);
    }

    public function centralDelete(string $table, array $filters, string $bearerToken = null): array
    {
        return $this->centralDb->delete($table, $filters, $bearerToken);
    }

    // ─── Private helpers ────────────────────────────────────────

    private function authHeaders(string $bearerToken = null): array
    {
        // Prefer caller's token; fall back to agent's service role key
        $token = $bearerToken ?? $this->agentKey;
        return [
            'apikey'        => $this->agentAnon,
            'Authorization' => "Bearer {$token}",
            'Content-Type'  => 'application/json',
            'Prefer'        => 'return=representation',
        ];
    }

    private function ensureAgent(): ?array
    {
        if ($this->client === null) {
            return [
                'error' => 'No active agent configured for this user. '
                    . 'Ensure the user has an active agent assigned in user_agent_access.',
                'code' => 'NO_ACTIVE_AGENT',
            ];
        }
        return null;
    }
}

<?php

namespace App\Models;

/**
 * AgentRuntimeStatus
 *
 * Represents the agent_runtime_status table in Supabase.
 * Used for tracking real-time runtime state for each user-agent pair.
 *
 * @property string $id
 * @property string $user_id
 * @property string $agent_id
 * @property string $agent_name
 * @property string $status         idle|thinking|acting|error|offline
 * @property string|null $last_heartbeat
 * @property array $current_services  JSONB array of active services
 * @property string|null $last_error
 * @property array $metadata
 * @property string $created_at
 * @property string $updated_at
 */
class AgentRuntimeStatus
{
    public string $id;
    public string $user_id;
    public string $agent_id;
    public string $agent_name;
    public string $status;
    public ?string $last_heartbeat;
    public array $current_services;
    public ?string $last_error;
    public array $metadata;
    public string $created_at;
    public string $updated_at;

    public function __construct(array $data = [])
    {
        $this->id                = $data['id'] ?? '';
        $this->user_id           = $data['user_id'] ?? '';
        $this->agent_id          = $data['agent_id'] ?? '';
        $this->agent_name        = $data['agent_name'] ?? 'Hermes';
        $this->status            = $data['status'] ?? 'idle';
        $this->last_heartbeat     = $data['last_heartbeat'] ?? null;
        $this->current_services  = $data['current_services'] ?? [];
        $this->last_error        = $data['last_error'] ?? null;
        $this->metadata          = $data['metadata'] ?? [];
        $this->created_at        = $data['created_at'] ?? now()->toIso8601String();
        $this->updated_at        = $data['updated_at'] ?? now()->toIso8601String();
    }

    /**
     * Convert to array for Supabase REST API insertion/update.
     */
    public function toArray(): array
    {
        return [
            'id'               => $this->id,
            'user_id'          => $this->user_id,
            'agent_id'         => $this->agent_id,
            'agent_name'       => $this->agent_name,
            'status'           => $this->status,
            'last_heartbeat'   => $this->last_heartbeat,
            'current_services' => $this->current_services,
            'last_error'       => $this->last_error,
            'metadata'         => $this->metadata,
        ];
    }

    /**
     * Map a raw Supabase response row to an instance.
     */
    public static function fromRow(array $row): self
    {
        return new self($row);
    }

    /**
     * Map a collection of rows to instances.
     *
     * @param array $rows
     * @return self[]
     */
    public static function collection(array $rows): array
    {
        return array_map(fn(array $row) => self::fromRow($row), $rows);
    }

    /**
     * Check if the agent is considered offline (no heartbeat in $minutes).
     */
    public function isStale(int $minutes = 5): bool
    {
        if ($this->last_heartbeat === null) {
            return true;
        }

        $lastBeat = \Carbon\Carbon::parse($this->last_heartbeat);
        return $lastBeat->addMinutes($minutes)->isPast();
    }

    /**
     * Check if the agent is currently active (not offline or error).
     */
    public function isActive(): bool
    {
        return in_array($this->status, ['idle', 'thinking', 'acting'], true);
    }

    /**
     * Update the heartbeat timestamp and clear last error.
     */
    public function touch(): void
    {
        $this->last_heartbeat = now()->toIso8601String();
        $this->last_error = null;
        $this->updated_at = now()->toIso8601String();
    }

    /**
     * Record a new error and set status to 'error'.
     */
    public function recordError(string $error): void
    {
        $this->last_error = $error;
        $this->status = 'error';
        $this->updated_at = now()->toIso8601String();
    }

    public const STATUS_IDLE    = 'idle';
    public const STATUS_THINKING = 'thinking';
    public const STATUS_ACTING  = 'acting';
    public const STATUS_ERROR   = 'error';
    public const STATUS_OFFLINE = 'offline';

    public const VALID_STATUSES = [
        self::STATUS_IDLE,
        self::STATUS_THINKING,
        self::STATUS_ACTING,
        self::STATUS_ERROR,
        self::STATUS_OFFLINE,
    ];
}
<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class ChannelController extends BaseApiController
{
    /**
     * GET /api/v1/channels
     */
    public function index(Request $request)
    {
        $userId = $this->userId($request);
        $result = $this->db($request)->get('channel_connections', ['user_id' => "eq.{$userId}"]);
        return $this->ok($result['error'] ? [] : $result);
    }

    /**
     * POST /api/v1/channels/telegram/connect
     */
    public function connectTelegram(Request $request)
    {
        $request->validate(['bot_token' => 'required|string']);
        $userId = $this->userId($request);

        // Verify bot token with Telegram API
        $response = Http::get("https://api.telegram.org/bot{$request->bot_token}/getMe");
        if (!$response->successful()) {
            return $this->error('Invalid Telegram bot token', 422);
        }
        $botInfo = $response->json();

        // Upsert channel connection (uses agent's service role key to bypass RLS)
        $this->db($request)->insert('channel_connections', [
            'user_id' => $userId,
            'channel' => 'telegram',
            'bot_token' => $request->bot_token,
            'channel_name' => $botInfo['result']['username'] ?? 'Telegram Bot',
            'is_active' => true,
        ]);

        return $this->ok(['bot_username' => $botInfo['result']['username']], 'Telegram bot connected');
    }

    /**
     * POST /api/v1/webhooks/telegram
     * Public webhook — Telegram sends updates here.
     */
    public function telegramWebhook(Request $request)
    {
        // Handle Telegram update — forward to Hermes AI agent
        $update = $request->all();
        // TODO: Dispatch to Hermes AI for processing
        return response()->json(['ok' => true]);
    }

    /**
     * POST /api/v1/channels/discord/connect
     */
    public function connectDiscord(Request $request)
    {
        $request->validate(['bot_token' => 'required|string']);
        $userId = $this->userId($request);

        // Verify bot token with Discord API
        $response = Http::withToken($request->bot_token)->get('https://discord.com/api/v10/users/@me');
        if (!$response->successful()) {
            return $this->error('Invalid Discord bot token', 422);
        }

        $this->db($request)->insert('channel_connections', [
            'user_id' => $userId,
            'channel' => 'discord',
            'bot_token' => $request->bot_token,
            'is_active' => true,
        ]);

        return $this->ok(null, 'Discord bot connected');
    }

    /**
     * POST /api/v1/webhooks/discord
     * Public webhook — Discord sends events here.
     */
    public function discordWebhook(Request $request)
    {
        // Handle Discord interaction/event — dispatch to Hermes AI
        // TODO: Implement Discord event handling
        return response()->json(['ok' => true]);
    }

    /**
     * POST /api/v1/channels/whatsapp/connect
     */
    public function connectWhatsApp(Request $request)
    {
        $request->validate(['account_sid' => 'required|string', 'auth_token' => 'required|string']);
        $userId = $this->userId($request);

        $this->db($request)->insert('channel_connections', [
            'user_id' => $userId,
            'channel' => 'whatsapp',
            'channel_meta' => [
                'account_sid' => $request->account_sid,
                'auth_token' => $request->auth_token,
            ],
            'is_active' => true,
        ]);

        return $this->ok(null, 'WhatsApp connected');
    }

    /**
     * DELETE /api/v1/channels/{channel}
     */
    public function disconnect(Request $request, string $channel)
    {
        $userId = $this->userId($request);
        $result = $this->db($request)->update('channel_connections',
            ['user_id' => $userId, 'channel' => $channel],
            ['is_active' => false]
        );
        return $result['error'] ? $this->error('Disconnect failed', 422) : $this->ok(null, 'Channel disconnected');
    }
}

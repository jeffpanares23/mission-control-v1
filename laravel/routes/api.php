<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AccountController;
use App\Http\Controllers\Api\TaskController;
use App\Http\Controllers\Api\AnniversaryController;
use App\Http\Controllers\Api\ReminderController;
use App\Http\Controllers\Api\ScheduleController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\InsightController;
use App\Http\Controllers\Api\ChannelController;
use App\Http\Controllers\Api\AIAgentController;
use App\Http\Controllers\Api\SettingsController;
use App\Http\Controllers\Api\DashboardController;

/*
|--------------------------------------------------------------------------
| API Routes — Mission Control V1
|--------------------------------------------------------------------------
*/

Route::prefix('v1')->group(function () {

    // ─── Public (webhook entry points) ────────────────────────────
    Route::post('webhooks/telegram', [ChannelController::class, 'telegramWebhook']);
    Route::post('webhooks/discord',  [ChannelController::class, 'discordWebhook']);

    // ─── Authenticated routes ( Sanctum / token ) ──────────────────
    Route::middleware('auth:sanctum')->group(function () {

        // Dashboard summary
        Route::get('dashboard', [DashboardController::class, 'index']);

        // ─── Accounts ──────────────────────────────────────────────
        Route::apiResource('accounts', AccountController::class);

        // ─── Tasks ─────────────────────────────────────────────────
        Route::apiResource('tasks', TaskController::class);
        Route::patch('tasks/{id}/move',   [TaskController::class, 'move']);
        Route::patch('tasks/{id}/status', [TaskController::class, 'status']);

        // ─── Anniversaries ──────────────────────────────────────────
        Route::apiResource('anniversaries', AnniversaryController::class);

        // ─── Reminders ──────────────────────────────────────────────
        Route::apiResource('reminders', ReminderController::class);

        // ─── Schedules ─────────────────────────────────────────────
        Route::apiResource('schedules', ScheduleController::class);

        // ─── Reports ───────────────────────────────────────────────
        Route::apiResource('reports', ReportController::class);
        Route::post('reports/{id}/generate', [ReportController::class, 'generate']);

        // ─── Insights ──────────────────────────────────────────────
        Route::get('insights',          [InsightController::class, 'index']);
        Route::patch('insights/{id}/read',    [InsightController::class, 'markRead']);
        Route::patch('insights/{id}/dismiss', [InsightController::class, 'dismiss']);

        // ─── Channels ──────────────────────────────────────────────
        Route::get('channels',                  [ChannelController::class, 'index']);
        Route::post('channels/telegram/connect',  [ChannelController::class, 'connectTelegram']);
        Route::post('channels/discord/connect',   [ChannelController::class, 'connectDiscord']);
        Route::post('channels/whatsapp/connect',  [ChannelController::class, 'connectWhatsApp']);
        Route::delete('channels/{channel}',       [ChannelController::class, 'disconnect']);

        // ─── AI Agent ──────────────────────────────────────────────
        Route::get('ai/status',    [AIAgentController::class, 'status']);
        Route::post('ai/chat',     [AIAgentController::class, 'chat']);
        Route::post('ai/dispatch', [AIAgentController::class, 'dispatch']);

        // ─── Settings ───────────────────────────────────────────────
        Route::get('settings',              [SettingsController::class, 'index']);
        Route::put('settings/{key}',        [SettingsController::class, 'update']);

        // ─── Activity Log ──────────────────────────────────────────
        Route::get('activity', [DashboardController::class, 'activity']);
    });
});

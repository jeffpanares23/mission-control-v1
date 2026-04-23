<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

/*
|--------------------------------------------------------------------------
| Scheduled Tasks — Mission Control V1
|--------------------------------------------------------------------------
*/

// Telegram polling — runs every minute via long-poll getUpdates
Schedule::command('telegram:poll')
    ->everyMinute()
    ->withoutOverlapping()
    ->runInBackground()
    ->appendOutputTo(storage_path('logs/telegram-polls.log'));

// Scheduled tasks — convert due reminders/anniversaries/schedules into tasks
Schedule::command('schedule:process')
    ->everyFiveMinutes()
    ->withoutOverlapping()
    ->appendOutputTo(storage_path('logs/schedule-process.log'));

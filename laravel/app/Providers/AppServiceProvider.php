<?php

namespace App\Providers;

use App\Services\AgentDatabaseService;
use App\Services\AuthService;
use App\Services\SupabaseService;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // SupabaseService — shared singleton (stateless REST client)
        $this->app->singleton(SupabaseService::class, function ($app) {
            return new SupabaseService();
        });

        // AuthService — shared singleton (stateless, reads central DB)
        $this->app->singleton(AuthService::class, function ($app) {
            return new AuthService($app->make(SupabaseService::class));
        });

        // AgentDatabaseService — SCOPED per request (holds active agent config)
        $this->app->scoped(AgentDatabaseService::class, function ($app) {
            return new AgentDatabaseService($app->make(SupabaseService::class));
        });
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        //
    }
}

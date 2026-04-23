<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        // Register middleware aliases
        $middleware->alias([
            'supabase.auth'    => \App\Http\Middleware\ValidateSupabaseToken::class,
            'agent.auth'       => \App\Http\Middleware\AgentAuth::class,
            'agent.super_admin' => \App\Http\Middleware\AgentAuth::class.'@handleSuperAdmin',
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        // Force JSON responses for all API routes — prevents HTML/Blade error pages
        $exceptions->render(function (\Throwable $e, $request) {
            if ($request->is('api/*') || $request->is('api')) {
                $status = 500;
                $message = 'Internal server error';

                if ($e instanceof \Illuminate\Validation\ValidationException) {
                    $status = 422;
                    $message = $e->getMessage();
                } elseif ($e instanceof \Illuminate\Auth\AuthenticationException) {
                    $status = 401;
                    $message = 'Unauthenticated';
                } elseif ($e instanceof \Symfony\Component\HttpKernel\Exception\NotFoundHttpException) {
                    $status = 404;
                    $message = 'Resource not found';
                } elseif ($e instanceof \Symfony\Component\HttpKernel\Exception\MethodNotAllowedHttpException) {
                    $status = 405;
                    $message = 'Method not allowed';
                } elseif ($e instanceof \Illuminate\Database\Eloquent\ModelNotFoundException) {
                    $status = 404;
                    $message = 'Model not found';
                } elseif ($e instanceof \RuntimeException) {
                    $status = 400;
                    $message = $e->getMessage();
                }

                // Don't leak stack traces in production
                $data = [
                    'success' => false,
                    'message' => $message,
                ];

                if (config('app.debug')) {
                    $data['exception'] = get_class($e);
                    $data['trace'] = $e->getTraceAsString();
                }

                return response()->json($data, $status);
            }

            // Let web routes handle errors normally (they can show Whoops/debug pages)
            return null;
        });
    })->create();

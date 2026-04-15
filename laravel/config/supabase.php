<?php

return [
    'url' => env('SUPABASE_URL'),
    'anon_key' => env('SUPABASE_ANON_KEY'),
    'service_role_key' => env('SUPABASE_SERVICE_ROLE_KEY'),
    'db_password' => env('SUPABASE_DB_PASSWORD'),
    'jwt_secret' => env('AUTH_JWT_SECRET'),

    // Supabase headers sent with every request
    'headers' => [
        'apikey' => env('SUPABASE_ANON_KEY'),
        'Authorization' => 'Bearer ' . env('SUPABASE_ANON_KEY'),
        'Content-Type' => 'application/json',
        'Prefer' => 'return=representation',
    ],
];

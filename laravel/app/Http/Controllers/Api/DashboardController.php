<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\Request;

class DashboardController extends BaseApiController
{
    /**
     * GET /api/v1/dashboard
     * Returns summary stats, recent activity, and AI insights.
     */
    public function index(Request $request)
    {
        $userId = $this->userId($request);

        $tasks    = $this->db($request)->get('tasks',      ['user_id' => "eq.{$userId}", 'order' => 'created_at.desc', 'limit' => 100]);
        $accounts = $this->db($request)->get('accounts',   ['user_id' => "eq.{$userId}"]);
        $insights = $this->db($request)->get('insights',   ['user_id' => "eq.{$userId}", 'is_dismissed' => 'eq.false', 'order' => 'created_at.desc', 'limit' => 10]);
        $upcoming = $this->db($request)->get('schedules',   ['user_id' => "eq.{$userId}", 'start_time' => 'gte.now()', 'order' => 'start_time.asc', 'limit' => 5]);

        $tasksData    = $tasks['error'] ? [] : $tasks;
        $accountsData = $accounts['error'] ? [] : $accounts;

        // Compute summary stats
        $totalTasks    = count($tasksData);
        $doneTasks     = count(array_filter($tasksData, fn($t) => ($t['status'] ?? '') === 'done'));
        $overdueTasks  = count(array_filter($tasksData, fn($t) => ($t['due_date'] ?? '') !== '' && strtotime($t['due_date']) < time() && ($t['status'] ?? '') !== 'done'));
        $highPriority  = count(array_filter($tasksData, fn($t) => ($t['priority'] ?? '') === 'urgent' || ($t['priority'] ?? '') === 'high'));
        $totalAccounts = count($accountsData);

        return $this->ok([
            'stats' => [
                'total_tasks'          => $totalTasks,
                'done_tasks'           => $doneTasks,
                'overdue_tasks'        => $overdueTasks,
                'high_priority_tasks'  => $highPriority,
                'total_accounts'       => $totalAccounts,
                'completion_rate'      => $totalTasks > 0 ? round(($doneTasks / $totalTasks) * 100, 1) : 0,
            ],
            'recent_tasks'       => array_slice($tasksData, 0, 5),
            'upcoming_schedules' => $upcoming['error'] ? [] : $upcoming,
            'insights'           => $insights['error'] ? [] : $insights,
        ]);
    }

    /**
     * GET /api/v1/activity
     */
    public function activity(Request $request)
    {
        $userId = $this->userId($request);
        $limit  = $request->input('limit', 50);

        $log = $this->db($request)->get('activity_log', [
            'user_id' => "eq.{$userId}",
            'order'   => 'created_at.desc',
            'limit'   => $limit,
        ]);

        return $this->ok($log['error'] ? [] : $log);
    }
}

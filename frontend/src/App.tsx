import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { DashboardPage } from '@/pages/DashboardPage'
import { AccountsPage } from '@/pages/AccountsPage'
import { TasksPage } from '@/pages/TasksPage'
import { AnniversariesPage } from '@/pages/AnniversariesPage'
import { RemindersPage } from '@/pages/RemindersPage'
import { SchedulesPage } from '@/pages/SchedulesPage'
import { AnalyticsPage } from '@/pages/AnalyticsPage'
import { ReportsPage } from '@/pages/ReportsPage'
import { AIPage } from '@/pages/AIPage'
import { ChannelsPage } from '@/pages/ChannelsPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { supabase } from '@/lib/supabase'

function AuthInitializer({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Anonymous auth — creates a Supabase session for RLS
    supabase.auth.signInAnonymously()
      .then(({ error }) => {
        if (error) console.warn('Supabase anon auth failed:', error.message)
        setReady(true)
      })
  }, [])

  if (!ready) return null
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthInitializer>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/accounts" element={<AccountsPage />} />
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/anniversaries" element={<AnniversariesPage />} />
            <Route path="/reminders" element={<RemindersPage />} />
            <Route path="/schedules" element={<SchedulesPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/ai" element={<AIPage />} />
            <Route path="/channels" element={<ChannelsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </AuthInitializer>
    </BrowserRouter>
  )
}

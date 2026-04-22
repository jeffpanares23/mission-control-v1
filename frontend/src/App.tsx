import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { AppShell } from './components/layout/AppShell'
import LoginPage from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { AccountsPage } from './pages/AccountsPage'
import { TasksPage } from './pages/TasksPage'
import { KnowledgePage } from './pages/KnowledgePage'
import { AnniversariesPage } from './pages/AnniversariesPage'
import { RemindersPage } from './pages/RemindersPage'
import { SchedulesPage } from './pages/SchedulesPage'
import { AnalyticsPage } from './pages/AnalyticsPage'
import { ReportsPage } from './pages/ReportsPage'
import { AIPage } from './pages/AIPage'
import { ChannelsPage } from './pages/ChannelsPage'
import { SettingsPage } from './pages/SettingsPage'
import { AdminUsersPage } from './pages/AdminUsersPage'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected — all app routes */}
          <Route
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/accounts" element={<AccountsPage />} />
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/knowledge" element={<KnowledgePage />} />
            <Route path="/anniversaries" element={<AnniversariesPage />} />
            <Route path="/reminders" element={<RemindersPage />} />
            <Route path="/schedules" element={<SchedulesPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/ai" element={<AIPage />} />
            <Route path="/channels" element={<ChannelsPage />} />
            <Route path="/settings" element={<SettingsPage />} />

            {/* Super admin only */}
            <Route
              path="/admin/users"
              element={
                <ProtectedRoute adminOnly>
                  <AdminUsersPage />
                </ProtectedRoute>
              }
            />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App

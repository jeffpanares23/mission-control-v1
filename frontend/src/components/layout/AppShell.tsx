import { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { RightPanel } from './RightPanel'
import { api, subscribeToTasks, subscribeToSchedules, subscribeToInsights } from '@/lib/api'
import type { DashboardSummary, Insight } from '@/types'

export function AppShell() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [insights, setInsights] = useState<Insight[]>([])

  // ─── Initial data load ──────────────────────────────────────
  useEffect(() => {
    api.dashboard.get()
      .then(res => {
        setSummary(res.data)
        setInsights(res.data.insights ?? [])
      })
      .catch(() => { /* demo mode — UI stays graceful */ })
  }, [])

  // ─── Realtime: task changes ─────────────────────────────────
  useEffect(() => {
    const sub = subscribeToTasks(() => {
      // Refresh dashboard stats on any task change
      api.dashboard.get().then(res => setSummary(res.data)).catch(() => {})
    })
    return () => { sub.unsubscribe() }
  }, [])

  // ─── Realtime: schedule changes ─────────────────────────────
  useEffect(() => {
    const sub = subscribeToSchedules(() => {
      // Child pages manage their own schedule state; just refresh dashboard
      api.dashboard.get().then(res => setSummary(res.data)).catch(() => {})
    })
    return () => { sub.unsubscribe() }
  }, [])

  // ─── Realtime: insight changes ──────────────────────────────
  useEffect(() => {
    const sub = subscribeToInsights((insight, action) => {
      setInsights(prev => {
        if (action === 'INSERT') return [insight, ...prev]
        if (action === 'UPDATE') return prev.map(i => i.id === insight.id ? insight : i)
        if (action === 'DELETE') return prev.filter(i => i.id !== insight.id)
        return prev
      })
    })
    return () => { sub.unsubscribe() }
  }, [])

  // ─── Insight actions ────────────────────────────────────────
  const dismissInsight = (id: string) => {
    setInsights(prev => prev.map(i => i.id === id ? { ...i, is_dismissed: true } : i))
    api.insights.dismiss(id).catch(() => {})
  }

  const markReadInsight = (id: string) => {
    setInsights(prev => prev.map(i => i.id === id ? { ...i, is_read: true } : i))
    api.insights.markRead(id).catch(() => {})
  }

  return (
    <div style={{
      display: 'flex', height: '100vh', width: '100vw',
      background: 'var(--color-bg)', overflow: 'hidden',
    }}>
      {/* Left Sidebar */}
      <Sidebar />

      {/* Center + Right */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        {/* Top Bar */}
        <TopBar stats={summary?.stats} />

        {/* Main content area */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Page content */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <Outlet />
          </div>

          {/* Right Insight Panel */}
          <RightPanel
            insights={insights.filter(i => !i.is_dismissed)}
            onDismiss={dismissInsight}
            onMarkRead={markReadInsight}
          />
        </div>
      </div>
    </div>
  )
}

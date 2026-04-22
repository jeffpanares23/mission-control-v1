import { NavLink, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import {
  LayoutDashboard,
  Users,
  CheckSquare,
  CalendarDays,
  Bell,
  BarChart2,
  Settings,
  Bot,
  Plug,
  Zap,
  BookOpen,
  Shield,
  LogOut,
} from 'lucide-react'

const mainNav = [
  { to: '/',         label: 'Dashboard',    icon: LayoutDashboard },
  { to: '/accounts', label: 'Accounts',      icon: Users },
  { to: '/tasks',    label: 'Tasks',         icon: CheckSquare },
  { to: '/anniversaries', label: 'Anniversaries', icon: CalendarDays },
  { to: '/reminders',    label: 'Reminders',  icon: Bell },
  { to: '/schedules',    label: 'Schedules',  icon: CalendarDays },
]

const insightsNav = [
  { to: '/analytics', label: 'Analytics', icon: BarChart2 },
  { to: '/reports',   label: 'Reports',   icon: BookOpen },
]

const systemNav = [
  { to: '/ai',        label: 'AI Agent',  icon: Bot },
  { to: '/knowledge', label: 'Knowledge',  icon: BookOpen },
  { to: '/channels',  label: 'Channels',   icon: Plug },
  { to: '/settings',   label: 'Settings',   icon: Settings },
]

interface SidebarProps {
  collapsed?: boolean
}

export function Sidebar({ collapsed = false }: SidebarProps) {
  const location = useLocation()
  const { user, isSuperAdmin, logout } = useAuth()

  const userName = user?.full_name || user?.email?.split('@')[0] || 'User'
  const userInitials = userName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)

  const renderItem = (item: typeof mainNav[0]) => {
    const Icon = item.icon
    const isActive = item.to === '/'
      ? location.pathname === '/'
      : location.pathname.startsWith(item.to)

    return (
      <NavLink
        key={item.to}
        to={item.to}
        className={cn('sidebar-item', isActive && 'active', collapsed && 'justify-center px-0')}
        title={collapsed ? item.label : undefined}
      >
        <Icon className="w-[17px] h-[17px] flex-shrink-0" />
        {!collapsed && <span>{item.label}</span>}
      </NavLink>
    )
  }

  return (
    <aside className={cn('sidebar', collapsed && 'collapsed')}>
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <Zap className="w-4 h-4 text-[var(--color-accent)]" />
        </div>
        {!collapsed && (
          <div className="animate-in" style={{ overflow: 'hidden' }}>
            <p className="text-[13px] font-bold leading-tight" style={{ color: 'var(--color-text)' }}>
              Mission Control
            </p>
            <p className="text-[10px]" style={{ color: 'var(--color-text-3)' }}>AI Command Center</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {!collapsed && <p className="sidebar-section-label">Workspace</p>}
        {mainNav.map(renderItem)}

        {!collapsed && <p className="sidebar-section-label">Insights</p>}
        {insightsNav.map(renderItem)}

        {!collapsed && <p className="sidebar-section-label">System</p>}
        {systemNav.map(renderItem)}
      </nav>

      {/* Admin link for super_admin */}
      {isSuperAdmin && (
        <>
          {!collapsed && <p className="sidebar-section-label">Admin</p>}
          <NavLink
            to="/admin/users"
            className={cn('sidebar-item', location.pathname.startsWith('/admin') && 'active', collapsed && 'justify-center px-0')}
            title={collapsed ? 'User Management' : undefined}
          >
            <Shield className="w-[17px] h-[17px] flex-shrink-0" />
            {!collapsed && <span>User Management</span>}
          </NavLink>
        </>
      )}

      {/* Footer */}
      {!collapsed && (
        <div style={{ padding: '14px 12px', borderTop: '1px solid var(--color-border)' }}>
          <div className="card p-3 flex items-center gap-3">
            <div className="avatar w-8 h-8 flex items-center justify-center" style={{ background: 'var(--color-accent-dim)', color: 'var(--color-accent)', fontSize: '11px', fontWeight: 700 }}>
              {userInitials}
            </div>
            <div style={{ overflow: 'hidden', flex: 1 }}>
              <p className="text-[12px] font-semibold leading-tight truncate" style={{ color: 'var(--color-text)' }}>{userName}</p>
              <p className="text-[10px] capitalize" style={{ color: 'var(--color-text-3)' }}>{user?.role?.replace('_', ' ') || 'agent'}</p>
            </div>
            <button
              onClick={logout}
              title="Sign out"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--color-text-3)',
                padding: '4px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-error)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-3)')}
            >
              <LogOut className="w-[14px] h-[14px]" />
            </button>
          </div>
        </div>
      )}
    </aside>
  )
}

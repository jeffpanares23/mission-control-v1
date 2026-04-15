import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/lib/api'

// Laravel returns flat profile objects enriched with email from auth.users
interface UserRow {
  id: string
  user_id: string
  email: string
  full_name: string
  role: string
  is_active: boolean
}

export function AdminUsersPage() {
  const { isSuperAdmin } = useAuth()
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ email: '', password: '', full_name: '', role: 'agent' })
  const [saving, setSaving] = useState(false)

  async function loadUsers() {
    setLoading(true)
    setError('')
    try {
      const data = await api.admin.users.list() as unknown as UserRow[]
      setUsers(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadUsers() }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await api.admin.users.create(form)
      setShowModal(false)
      setForm({ email: '', password: '', full_name: '', role: 'agent' })
      loadUsers()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create user')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleRole(user: UserRow) {
      const newRole = user.role === 'super_admin' ? 'agent' : 'super_admin'
    try {
      await api.admin.users.update(user.id, { role: newRole })
      loadUsers()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to update role')
    }
  }

  async function handleToggleActive(user: UserRow) {
    try {
      await api.admin.users.update(user.id, { is_active: !user.is_active })
      loadUsers()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to update user')
    }
  }

  if (!isSuperAdmin) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-2)' }}>
        Access denied. Super admin only.
      </div>
    )
  }

  return (
    <div style={{ padding: '1.5rem', maxWidth: '900px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '0.25rem' }}>
            User Management
          </h1>
          <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-2)' }}>
            Manage agent accounts and permissions
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          style={{
            padding: '0.5rem 1rem',
            background: 'var(--color-accent)',
            border: 'none',
            borderRadius: '8px',
            color: '#fff',
            fontSize: '0.8125rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          + Add Agent
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: '0.75rem 1rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', color: 'var(--color-error)', fontSize: '0.8125rem', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {/* Table */}
      <div className="card" style={{ border: '1px solid var(--color-border)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Name</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Role</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-3)' }}>
                  Loading...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-3)' }}>
                  No users found
                </td>
              </tr>
            ) : users.map(user => (
              <tr key={user.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td style={{ padding: '0.875rem 1rem', fontSize: '0.875rem', color: 'var(--color-text)' }}>
                  {user.full_name || '—'}
                </td>
                <td style={{ padding: '0.875rem 1rem', fontSize: '0.875rem', color: 'var(--color-text-2)' }}>
                  {user.email || '—'}
                </td>
                <td style={{ padding: '0.875rem 1rem' }}>
                  <span style={{
                    display: 'inline-block',
                    padding: '0.2rem 0.5rem',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    background: user.role === 'super_admin' ? 'rgba(249,115,22,0.15)' : 'rgba(59,130,246,0.15)',
                    color: user.role === 'super_admin' ? 'var(--color-accent)' : 'var(--color-info)',
                  }}>
                    {user.role?.replace('_', ' ') || 'agent'}
                  </span>
                </td>
                <td style={{ padding: '0.875rem 1rem' }}>
                  <span style={{
                    display: 'inline-block',
                    padding: '0.2rem 0.5rem',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    background: user.is_active ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                    color: user.is_active ? 'var(--color-success)' : 'var(--color-error)',
                  }}>
                    {user.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td style={{ padding: '0.875rem 1rem', textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => handleToggleRole(user)}
                      style={{
                        padding: '0.3rem 0.625rem',
                        background: 'var(--color-surface-3)',
                        border: '1px solid var(--color-border)',
                        borderRadius: '6px',
                        color: 'var(--color-text-2)',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                      }}
                    >
                      {user.role === 'super_admin' ? '↓ Agent' : '↑ Admin'}
                    </button>
                    <button
                      onClick={() => handleToggleActive(user)}
                      style={{
                        padding: '0.3rem 0.625rem',
                        background: 'var(--color-surface-3)',
                        border: '1px solid var(--color-border)',
                        borderRadius: '6px',
                        color: user.is_active ? 'var(--color-error)' : 'var(--color-success)',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                      }}
                    >
                      {user.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create User Modal */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem',
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '420px', border: '1px solid var(--color-border)', padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1.25rem', color: 'var(--color-text)' }}>
              Add New Agent
            </h2>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--color-text-2)', marginBottom: '0.375rem' }}>Full Name</label>
                <input
                  type="text"
                  value={form.full_name}
                  onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                  required
                  placeholder="Patricia"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--color-text-2)', marginBottom: '0.375rem' }}>Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  required
                  placeholder="patricia@missioncontrol.ai"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--color-text-2)', marginBottom: '0.375rem' }}>Password</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  required
                  placeholder="••••••••"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--color-text-2)', marginBottom: '0.375rem' }}>Role</label>
                <select
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                  style={{ ...inputStyle, cursor: 'pointer' }}
                >
                  <option value="agent">Agent</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>

              {error && (
                <div style={{ padding: '0.5rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', color: 'var(--color-error)', fontSize: '0.8125rem' }}>
                  {error}
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setError('') }}
                  style={{
                    padding: '0.5rem 1rem',
                    background: 'var(--color-surface-3)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '8px',
                    color: 'var(--color-text-2)',
                    fontSize: '0.8125rem',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    padding: '0.5rem 1rem',
                    background: 'var(--color-accent)',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    cursor: saving ? 'not-allowed' : 'pointer',
                    opacity: saving ? 0.6 : 1,
                  }}
                >
                  {saving ? 'Creating...' : 'Create Agent'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.5rem 0.75rem',
  background: 'var(--color-surface-2)',
  border: '1px solid var(--color-border-bright)',
  borderRadius: '8px',
  color: 'var(--color-text)',
  fontSize: '0.875rem',
  outline: 'none',
}

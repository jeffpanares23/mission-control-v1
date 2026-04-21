import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import type { AuthUser, AuthAgent } from '@/lib/api'

interface AuthContextType {
  user: AuthUser | null
  agent: AuthAgent | null
  isLoading: boolean
  isAuthenticated: boolean
  isSuperAdmin: boolean
  agents: AuthAgent[]
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  switchAgent: (agentId: string) => Promise<void>
  refreshMe: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [agent, setAgent] = useState<AuthAgent | null>(null)
  const [agents, setAgents] = useState<AuthAgent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  // Restore session from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('mc_session')
    if (!stored) {
      setIsLoading(false)
      return
    }

    try {
      const session = JSON.parse(stored)
      // Validate: new format has access_token and flat user object
      if (session?.access_token && session?.user?.id) {
        setUser(session.user)
        setAgent(session.agent ?? null)
        setIsAuthenticated(true)
      } else if (session?.user?.id) {
        // Old format — clear and require re-login
        localStorage.removeItem('mc_session')
      }
    } catch {
      localStorage.removeItem('mc_session')
    }
    setIsLoading(false)
  }, [])

  // Load full user context from /auth/me (validates token, gets agent info)
  const refreshMe = useCallback(async () => {
    try {
      const data = await api.auth.me()
      // Defensive: guard against malformed response
      if (!data?.user?.id) throw new Error('Invalid user context from /auth/me')
      const freshUser: AuthUser = {
        id: data.user.id,
        email: data.user.email,
        full_name: data.user.full_name,
        role: data.user.role,
        is_active: data.user.is_active,
        agent_id: data.user.agent_id,
        agent_slug: data.user.agent_slug,
        agent_name: data.user.agent_name,
      }
      const freshAgent: AuthAgent | null = data.agent ? {
        id: data.agent.id,
        slug: data.agent.slug,
        name: data.agent.name,
        supabase_url: data.agent.supabase_url,
        is_active: data.agent.is_active,
      } : null

      setUser(freshUser)
      setAgent(freshAgent)

      // Update stored session
      const stored = localStorage.getItem('mc_session')
      if (stored) {
        const session = JSON.parse(stored)
        localStorage.setItem('mc_session', JSON.stringify({
          ...session,
          user: freshUser,
          agent: freshAgent,
        }))
      }
    } catch {
      // Token invalid/expired — clear session
      localStorage.removeItem('mc_session')
      setUser(null)
      setAgent(null)
      setIsAuthenticated(false)
    }
  }, [])

  // Load accessible agents list
  useEffect(() => {
    api.auth.agents()
      .then(agentsData => {
        // Map backend agent shape to AuthAgent type
        const mapped = agentsData.map(a => ({
          id: a.agent_id,
          slug: a.slug,
          name: a.name,
          supabase_url: '', // not exposed by backend; set on switch
          is_active: a.is_active,
        }))
        setAgents(mapped)
      })
      .catch(() => setAgents([]))
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.auth.login(email, password)

    // The response: { access_token, token_type, expires_in, user, agent }
    if (!res?.user?.id) throw new Error('Invalid login response: missing user')

    const newUser: AuthUser = {
      id: res.user.id,
      email: res.user.email,
      full_name: res.user.full_name,
      role: res.user.role,
      is_active: res.user.is_active,
      agent_id: res.user.agent_id,
      agent_slug: res.user.agent_slug,
      agent_name: res.user.agent_name,
    }

    // Use the agent from login response directly (avoids extra /auth/me call)
    const newAgent: AuthAgent | null = res.agent ? {
      id: res.agent.id,
      slug: res.agent.slug,
      name: res.agent.name,
      supabase_url: res.agent.supabase_url,
      is_active: res.agent.is_active,
    } : null

    // Fetch accessible agents list (non-critical)
    try {
      const agentsData = await api.auth.agents()
      const mapped = agentsData.map(a => ({
        id: a.agent_id,
        slug: a.slug,
        name: a.name,
        supabase_url: '',
        is_active: a.is_active,
      }))
      setAgents(mapped)
    } catch {
      // non-critical if agents list fetch fails
    }

    localStorage.setItem('mc_session', JSON.stringify({
      access_token: res.access_token,
      user: newUser,
      agent: newAgent,
    }))

    setUser(newUser)
    setAgent(newAgent)
    setIsAuthenticated(true)
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.auth.logout()
    } catch {
      // ignore — always clear local state
    }
    localStorage.removeItem('mc_session')
    setUser(null)
    setAgent(null)
    setAgents([])
    setIsAuthenticated(false)
  }, [])

  const switchAgent = useCallback(async (agentId: string) => {
    const data = await api.auth.switchAgent(agentId)
    const newUser: AuthUser = {
      id: data.user.id,
      email: data.user.email,
      full_name: data.user.full_name,
      role: data.user.role,
      is_active: data.user.is_active,
      agent_id: data.user.agent_id,
      agent_slug: data.user.agent_slug,
      agent_name: data.user.agent_name,
    }
    const newAgent: AuthAgent | null = data.agent ? {
      id: data.agent.id,
      slug: data.agent.slug,
      name: data.agent.name,
      supabase_url: data.agent.supabase_url,
      is_active: data.agent.is_active,
    } : null

    // Update stored session
    const stored = localStorage.getItem('mc_session')
    if (stored) {
      const session = JSON.parse(stored)
      localStorage.setItem('mc_session', JSON.stringify({ ...session, user: newUser, agent: newAgent }))
    }

    setUser(newUser)
    setAgent(newAgent)
  }, [])

  const isSuperAdmin = user?.role === 'super_admin'

  return (
    <AuthContext.Provider value={{
      user,
      agent,
      isLoading,
      isAuthenticated,
      isSuperAdmin,
      agents,
      login,
      logout,
      switchAgent,
      refreshMe,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

// Central auth types — re-exported from lib/api for compatibility
export type { AuthUser, AuthAgent } from '@/lib/api'

export interface LoginCredentials {
  email: string
  password: string
}

export interface AuthState {
  user: AuthUser | null
  isLoading: boolean
  isAuthenticated: boolean
}

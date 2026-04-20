import { useState, useEffect, useRef, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

// Telegram bot username — set via VITE_TELEGRAM_BOT_USERNAME env var
const TELEGRAM_BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT_USERNAME as string | undefined

declare global {
  interface Window {
    Telegram?: {
      Login?: {
        auth: (config: { bot_username: string; request_access?: string }, callback: (data: TelegramAuthData | false) => void) => void
      }
    }
  }
}

interface TelegramAuthData {
  id: number
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
  auth_date: number
  hash: string
}

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [tgLoading, setTgLoading] = useState(false)
  const [tgError, setTgError] = useState('')
  const tgButtonRef = useRef<HTMLDivElement>(null)
  const tgInitialized = useRef(false)

  // Load Telegram Login Widget script once
  useEffect(() => {
    if (!TELEGRAM_BOT_USERNAME) return
    if (document.getElementById('telegram-login-widget-script')) {
      initTelegramButton()
      return
    }

    const script = document.createElement('script')
    script.id = 'telegram-login-widget-script'
    script.src = 'https://telegram.org/js/telegram-widget.js?19'
    script.async = true
    script.onload = () => initTelegramButton()
    document.head.appendChild(script)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function initTelegramButton() {
    if (tgInitialized.current || !tgButtonRef.current) return
    if (!window.Telegram?.Login) return
    tgInitialized.current = true

    tgButtonRef.current.innerHTML = ''

    try {
      window.Telegram.Login.auth(
        { bot_username: TELEGRAM_BOT_USERNAME, request_access: 'write' },
        handleTelegramAuth
      )
    } catch {
      tgButtonRef.current.innerHTML = ''
    }
  }

  async function handleTelegramAuth(data: TelegramAuthData | false) {
    if (!data) {
      setTgError('Telegram login was cancelled or failed.')
      setTgLoading(false)
      return
    }

    setTgLoading(true)
    setTgError('')

    try {
      // Reconstruct the raw initData string from the widget's parsed data.
      // The widget has already validated the hash client-side using the bot_token,
      // but we still need to send the raw string to our backend so it can
      // re-validate using HMAC-SHA256(bot_token) to prevent spoofing.
      // The raw initData format Telegram sends: sorted key=value pairs, newline-separated.
      const parts: string[] = []
      parts.push(`id=${data.id}`)
      parts.push(`first_name=${data.first_name}`)
      if (data.last_name) parts.push(`last_name=${data.last_name}`)
      if (data.username) parts.push(`username=${data.username}`)
      if (data.photo_url) parts.push(`photo_url=${data.photo_url}`)
      parts.push(`auth_date=${data.auth_date}`)
      parts.push(`hash=${data.hash}`)
      const initData = parts.join('\n')

      // POST to our Laravel backend — validates HMAC, finds/creates user, returns JWT
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL || ''}/api/v1/auth/telegram`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ initData }),
        }
      )

      const json = await res.json()

      if (!res.ok || !json.data?.access_token) {
        throw new Error(json.error?.message || 'Telegram authentication failed.')
      }

      const { access_token, user } = json.data

      // Persist session (matching the shape AuthContext expects)
      localStorage.setItem('mc_session', JSON.stringify({
        access_token,
        user,
        agent: null,
      }))

      // Hard reload so AuthContext reinitializes from localStorage
      window.location.href = '/dashboard'
    } catch (err: unknown) {
      setTgError(err instanceof Error ? err.message : 'Telegram login failed.')
    } finally {
      setTgLoading(false)
    }
  }

  async function handleEmailSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/dashboard')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed. Check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--color-bg)',
      backgroundImage: 'radial-gradient(ellipse at 50% 0%, rgba(249,115,22,0.08) 0%, transparent 60%)',
      padding: '1rem',
    }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>

        {/* Logo / Title */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            background: 'var(--color-accent-dim)',
            border: '1px solid var(--color-accent-glow)',
            marginBottom: '1rem',
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 6v6l4 2"/>
            </svg>
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '0.25rem' }}>
            Mission Control
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-2)' }}>
            AI Agent Command Center
          </p>
        </div>

        {/* Login Card */}
        <div className="card" style={{
          padding: '2rem',
          border: '1px solid var(--color-border)',
        }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1.5rem', color: 'var(--color-text)' }}>
            Sign in to your account
          </h2>

          {/* Telegram Login Button */}
          {TELEGRAM_BOT_USERNAME ? (
            <div style={{ marginBottom: '1.5rem' }}>
              {/* Widget container — Telegram.Login.auth renders an iframe inside this div */}
              <div
                ref={tgButtonRef}
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  minHeight: '44px',
                }}
              />

              {/* Loading state shown while Telegram auth is in progress */}
              {tgLoading && (
                <div style={{
                  marginTop: '0.75rem',
                  textAlign: 'center',
                  fontSize: '0.8125rem',
                  color: 'var(--color-text-2)',
                }}>
                  Connecting to Telegram...
                </div>
              )}

              {/* Telegram-specific error */}
              {tgError && (
                <div style={{
                  marginTop: '0.75rem',
                  padding: '0.5rem 0.75rem',
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.3)',
                  borderRadius: '8px',
                  color: 'var(--color-error)',
                  fontSize: '0.8125rem',
                  textAlign: 'center',
                }}>
                  {tgError}
                </div>
              )}
            </div>
          ) : (
            <div style={{
              marginBottom: '1.5rem',
              padding: '0.625rem',
              background: 'rgba(0,136,255,0.06)',
              border: '1px solid rgba(0,136,255,0.15)',
              borderRadius: '8px',
              color: 'rgba(255,255,255,0.4)',
              fontSize: '0.75rem',
              textAlign: 'center',
            }}>
              Telegram login not configured.<br/>
              Set VITE_TELEGRAM_BOT_USERNAME in .env to enable.
            </div>
          )}

          {/* Divider */}
          {TELEGRAM_BOT_USERNAME && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              marginBottom: '1.5rem',
            }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--color-border)' }} />
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-3)' }}>or</span>
              <div style={{ flex: 1, height: '1px', background: 'var(--color-border)' }} />
            </div>
          )}

          {/* Email / Password Form */}
          <form onSubmit={handleEmailSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--color-text-2)', marginBottom: '0.375rem' }}>
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="agent@example.com"
                required
                autoComplete="email"
                style={{
                  width: '100%',
                  padding: '0.625rem 0.875rem',
                  background: 'var(--color-surface-2)',
                  border: '1px solid var(--color-border-bright)',
                  borderRadius: '8px',
                  color: 'var(--color-text)',
                  fontSize: '0.875rem',
                  outline: 'none',
                  transition: 'border-color 0.15s',
                }}
                onFocus={e => e.target.style.borderColor = 'var(--color-accent)'}
                onBlur={e => e.target.style.borderColor = 'var(--color-border-bright)'}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--color-text-2)', marginBottom: '0.375rem' }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                style={{
                  width: '100%',
                  padding: '0.625rem 0.875rem',
                  background: 'var(--color-surface-2)',
                  border: '1px solid var(--color-border-bright)',
                  borderRadius: '8px',
                  color: 'var(--color-text)',
                  fontSize: '0.875rem',
                  outline: 'none',
                  transition: 'border-color 0.15s',
                }}
                onFocus={e => e.target.style.borderColor = 'var(--color-accent)'}
                onBlur={e => e.target.style.borderColor = 'var(--color-border-bright)'}
              />
            </div>

            {error && (
              <div style={{
                padding: '0.625rem 0.875rem',
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: '8px',
                color: 'var(--color-error)',
                fontSize: '0.8125rem',
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.625rem',
                marginTop: '0.5rem',
                background: loading ? 'rgba(249,115,22,0.5)' : 'var(--color-accent)',
                border: 'none',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = 'var(--color-accent-hover)' }}
              onMouseLeave={e => { if (!loading) e.currentTarget.style.background = 'var(--color-accent)' }}
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.75rem', color: 'var(--color-text-3)' }}>
          Mission Control V1 — Authorized Personnel Only
        </p>
      </div>
    </div>
  )
}

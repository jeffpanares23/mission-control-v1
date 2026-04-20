import { useState, useEffect } from 'react'
import { Plus, Users, Search, ExternalLink, Tag } from 'lucide-react'
import { api } from '@/lib/api'
import type { Account } from '@/types'

export function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.accounts.list()
      .then(res => setAccounts(res))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filtered = accounts.filter(a =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.company?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 flex items-center justify-between border-b border-surface-border">
        <div>
          <h2 className="text-lg font-bold text-text-primary">Accounts</h2>
          <p className="text-xs text-text-muted">{accounts.length} total accounts</p>
        </div>
        <button className="btn btn-primary text-xs">
          <Plus className="w-3.5 h-3.5" /> Add Account
        </button>
      </div>

      <div className="px-6 py-3 border-b border-surface-border">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            placeholder="Search accounts..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input pl-9 py-1.5 text-sm"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="text-center text-text-muted text-sm py-12 animate-pulse">Loading accounts...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-text-muted gap-2">
            <Users className="w-8 h-8 opacity-30" />
            <p className="text-sm">No accounts found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(account => (
              <div key={account.id} className="glass-card p-4 hover:border-accent/30 transition-colors cursor-pointer">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-accent/15 flex items-center justify-center">
                      <span className="text-sm font-bold text-accent">{account.name.charAt(0)}</span>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-text-primary">{account.name}</h3>
                      <p className="text-xs text-text-muted">{account.company || '—'}</p>
                    </div>
                  </div>
                  <span className="badge badge-neutral text-xs">{account.channel}</span>
                </div>

                <div className="space-y-1.5 text-xs text-text-secondary mb-3">
                  {account.email && <p>{account.email}</p>}
                  {account.phone && <p>{account.phone}</p>}
                  {account.website && (
                    <a href={account.website} target="_blank" rel="noreferrer"
                       className="flex items-center gap-1 text-accent hover:text-accent-hover">
                      <ExternalLink className="w-3 h-3" /> {account.website.replace(/^https?:\/\//, '')}
                    </a>
                  )}
                </div>

                {account.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {account.tags.map(tag => (
                      <span key={tag} className="badge badge-neutral text-xs">
                        <Tag className="w-2.5 h-2.5 mr-0.5" />{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

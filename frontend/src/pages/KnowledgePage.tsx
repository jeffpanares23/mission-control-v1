// ============================================================
// KnowledgePage — AI Agent Knowledge / Markdown Files Manager
// Phase 5: Full management view with preview + assignments
// ============================================================
import { useState, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  BookOpen, FileText, FileJson, FileCode, Search, Filter,
  Loader, RefreshCw, AlertTriangle, CheckCircle2, X,
  Bot, Hash, Clock, Tag, Weight, Archive, ArchiveRestore,
  Eye, EyeOff, ChevronRight, ExternalLink, Info,
  PanelRightOpen, PanelRightClose,
} from 'lucide-react'
import { cn, formatDate, formatRelative } from '@/lib/utils'
import { api } from '@/lib/api'
import type { KnowledgeFile, KnowledgeFileStatus, KnowledgeFileType } from '@/types'

// ─── File type icons ───────────────────────────────────────
const FILE_TYPE_ICON: Record<KnowledgeFileType, React.ReactNode> = {
  markdown: <FileText  className="w-4 h-4" />,
  text:     <FileText  className="w-4 h-4" />,
  json:     <FileJson  className="w-4 h-4" />,
  yaml:     <FileCode  className="w-4 h-4" />,
}

// ─── Status config ──────────────────────────────────────────
const STATUS_CONFIG: Record<KnowledgeFileStatus, { label: string; color: string; badge: string; icon: React.ReactNode }> = {
  active:   { label: 'Active',   color: '#10b981', badge: 'badge-success', icon: <Eye className="w-3 h-3" /> },
  archived: { label: 'Archived', color: '#6b7280', badge: 'badge-gray',    icon: <Archive className="w-3 h-3" /> },
  disabled: { label: 'Disabled', color: '#ef4444', badge: 'badge-error',   icon: <EyeOff className="w-3 h-3" /> },
}

// ─── Filter shape ──────────────────────────────────────────
interface Filters {
  status: string
  channel_id: string
  agent_id: string
  file_type: string
  tag: string
  search: string
}

const DEFAULT_FILTERS: Filters = {
  status: 'all', channel_id: 'all', agent_id: 'all', file_type: 'all', tag: 'all', search: '',
}

// ─────────────────────────────────────────────────────────────
// KnowledgePage
// ─────────────────────────────────────────────────────────────
export function KnowledgePage() {
  const [files, setFiles] = useState<KnowledgeFile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [searchInput, setSearchInput] = useState('')

  const [selectedFile, setSelectedFile] = useState<KnowledgeFile | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)

  const [showPreview, setShowPreview] = useState(true) // toggle for mobile
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set())

  // Unique filter options derived from loaded files
  const [channelOptions, setChannelOptions] = useState<Array<{ id: string; name: string }>>([])
  const [agentOptions, setAgentOptions]     = useState<Array<{ id: string; name: string }>>([])
  const [tagOptions, setTagOptions]         = useState<string[]>([])

  const loadFiles = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.agentOps.knowledgeFiles.list()
      setFiles(data ?? [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load knowledge files')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadFiles() }, [loadFiles])

  // Derive filter options from file data
  useEffect(() => {
    const chMap = new Map<string, string>()
    const agMap = new Map<string, string>()
    const tags = new Set<string>()
    files.forEach(f => {
      if (f.channel_id && f.channel_name) chMap.set(f.channel_id, f.channel_name)
      if (f.agent_id && f.agent_name) agMap.set(f.agent_id, f.agent_name)
      f.tags.forEach(t => tags.add(t))
    })
    setChannelOptions(Array.from(chMap, ([id, name]) => ({ id, name })))
    setAgentOptions(Array.from(agMap, ([id, name]) => ({ id, name })))
    setTagOptions(Array.from(tags).sort())
  }, [files])

  // Apply filters
  const filteredFiles = files.filter(f => {
    if (filters.status !== 'all' && f.status !== filters.status) return false
    if (filters.channel_id !== 'all' && f.channel_id !== filters.channel_id) return false
    if (filters.agent_id !== 'all' && f.agent_id !== filters.agent_id) return false
    if (filters.file_type !== 'all' && f.file_type !== filters.file_type) return false
    if (filters.tag !== 'all' && !f.tags.includes(filters.tag)) return false
    if (filters.search) {
      const q = filters.search.toLowerCase()
      if (
        !(f.filename?.toLowerCase().includes(q) ||
          f.title?.toLowerCase().includes(q) ||
          f.path?.toLowerCase().includes(q) ||
          f.tags.some(t => t.toLowerCase().includes(q)))
      ) return false
    }
    return true
  })

  // Select file for preview
  const handleSelectFile = async (file: KnowledgeFile) => {
    setSelectedFile(file)
    setPreviewLoading(true)
    setPreviewError(null)
    try {
      const full = await api.agentOps.knowledgeFiles.get(file.id)
      setSelectedFile(full)
    } catch (e: unknown) {
      setPreviewError(e instanceof Error ? e.message : 'Failed to load preview')
    } finally {
      setPreviewLoading(false)
    }
  }

  // Update a file field (toggle enable, archive, assign)
  const handleUpdate = async (id: string, patch: Parameters<typeof api.agentOps.knowledgeFiles.update>[1]) => {
    setUpdatingIds(prev => new Set(prev).add(id))
    try {
      const updated = await api.agentOps.knowledgeFiles.update(id, patch)
      setFiles(prev => prev.map(f => f.id === id ? { ...f, ...updated } : f))
      if (selectedFile?.id === id) setSelectedFile(prev => prev ? { ...prev, ...updated } : prev)
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setUpdatingIds(prev => { const s = new Set(prev); s.delete(id); return s })
    }
  }

  // Quick toggle enable/disable
  const handleToggleEnabled = (file: KnowledgeFile) => {
    handleUpdate(file.id, { is_enabled: !file.is_enabled })
  }

  // Archive / restore
  const handleArchive = (file: KnowledgeFile) => {
    const newStatus: KnowledgeFileStatus = file.status === 'archived' ? 'active' : 'archived'
    handleUpdate(file.id, { status: newStatus })
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setFilters(prev => ({ ...prev, search: searchInput }))
  }

  const hasActiveFilters =
    filters.status !== 'all' || filters.channel_id !== 'all' ||
    filters.agent_id !== 'all' || filters.file_type !== 'all' ||
    filters.tag !== 'all' || filters.search !== ''

  const clearFilters = () => {
    setFilters(DEFAULT_FILTERS)
    setSearchInput('')
  }

  return (
    <div className="h-full flex flex-col">

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="px-5 py-3 flex-shrink-0 border-b border-surface-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/20
              flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-accent" />
            </div>
            <div>
              <h2 className="text-base font-bold text-text-primary">Knowledge Files</h2>
              <p className="text-xs text-text-muted">
                {loading ? '...' : `${filteredFiles.length} / ${files.length} files`}
                {files.length > 0 && (
                  <span className="ml-2 text-success">
                    {files.filter(f => f.is_enabled).length} active
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Preview toggle (mobile) */}
            <button
              className="btn btn-ghost text-xs gap-1 lg:hidden"
              onClick={() => setShowPreview(p => !p)}
            >
              {showPreview ? <PanelRightClose className="w-3.5 h-3.5" /> : <PanelRightOpen className="w-3.5 h-3.5" />}
              {showPreview ? 'Hide Preview' : 'Show Preview'}
            </button>
            <button className="btn btn-ghost text-xs gap-1" onClick={loadFiles} disabled={loading}>
              <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
              Refresh
            </button>
          </div>
        </div>

        {/* ── Search + Filters ──────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <form onSubmit={handleSearch} className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Search files, tags..."
              className="input pl-8 text-xs h-8"
            />
          </form>

          {/* Status filter */}
          <FilterSelect label="Status" value={filters.status}
            options={[['all','All'],['active','Active'],['archived','Archived'],['disabled','Disabled']]}
            onChange={v => setFilters(p => ({ ...p, status: v }))} />

          {/* Channel filter */}
          <FilterSelect label="Channel" value={filters.channel_id}
            options={[['all','All Channels'], ...channelOptions.map(c => [c.id, c.name])]}
            onChange={v => setFilters(p => ({ ...p, channel_id: v }))} />

          {/* Agent filter */}
          <FilterSelect label="Agent" value={filters.agent_id}
            options={[['all','All Agents'], ...agentOptions.map(a => [a.id, a.name])]}
            onChange={v => setFilters(p => ({ ...p, agent_id: v }))} />

          {/* File type */}
          <FilterSelect label="Type" value={filters.file_type}
            options={[['all','All Types'],['markdown','Markdown'],['json','JSON'],['yaml','YAML'],['text','Text']]}
            onChange={v => setFilters(p => ({ ...p, file_type: v }))} />

          {/* Tag filter */}
          {tagOptions.length > 0 && (
            <FilterSelect label="Tag" value={filters.tag}
              options={[['all','All Tags'], ...tagOptions.map(t => [t, t])]}
              onChange={v => setFilters(p => ({ ...p, tag: v }))} />
          )}

          {hasActiveFilters && (
            <button className="btn btn-ghost text-xs text-error gap-1" onClick={clearFilters}>
              <X className="w-3 h-3" /> Clear
            </button>
          )}
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── File List Panel ─────────────────────────────── */}
        <div className={cn(
          'flex-shrink-0 border-r border-surface-border overflow-y-auto',
          showPreview ? 'w-96' : 'flex-1',
          !showPreview && 'max-w-full',
        )}>
          {loading ? (
            <LoadingState />
          ) : error && files.length === 0 ? (
            <ErrorState message={error} onRetry={loadFiles} />
          ) : filteredFiles.length === 0 ? (
            files.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm text-text-muted">No files match your filters</p>
              </div>
            )
          ) : (
            <div className="p-3 flex flex-col gap-2">
              {filteredFiles.map(file => (
                <FileCard
                  key={file.id}
                  file={file}
                  selected={selectedFile?.id === file.id}
                  onSelect={() => {
                    handleSelectFile(file)
                    if (window.innerWidth < 1024) setShowPreview(true)
                  }}
                  onToggle={() => handleToggleEnabled(file)}
                  onArchive={() => handleArchive(file)}
                  isUpdating={updatingIds.has(file.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Preview / Detail Panel ──────────────────────── */}
        {showPreview && (
          <div className="flex-1 overflow-hidden flex flex-col bg-surface-1">
            {selectedFile ? (
              <PreviewPanel
                file={selectedFile}
                loading={previewLoading}
                error={previewError}
                onClose={() => setShowPreview(false)}
                onUpdate={(patch) => handleUpdate(selectedFile.id, patch)}
                onAssignChannel={(channel_id) => handleUpdate(selectedFile.id, { channel_id: channel_id || null })}
                onAssignAgent={(agent_id) => handleUpdate(selectedFile.id, { agent_id: agent_id || null })}
                channelOptions={channelOptions}
                agentOptions={agentOptions}
                isUpdating={updatingIds.has(selectedFile.id)}
              />
            ) : (
              <EmptyPreviewState />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Filter Select
// ─────────────────────────────────────────────────────────────
function FilterSelect({
  label, value, options, onChange,
}: {
  label: string; value: string
  options: [string, string][]
  onChange: (v: string) => void
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="input text-xs h-8 py-0 pr-6 appearance-none bg-no-repeat bg-[right_6px_center]"
      style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' fill='none'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%236b7280' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")` }}
    >
      {options.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
    </select>
  )
}

// ─────────────────────────────────────────────────────────────
// File Card
// ─────────────────────────────────────────────────────────────
function FileCard({
  file, selected, onSelect, onToggle, onArchive, isUpdating,
}: {
  file: KnowledgeFile
  selected: boolean
  onSelect: () => void
  onToggle: () => void
  onArchive: () => void
  isUpdating: boolean
}) {
  const sCfg = STATUS_CONFIG[file.status]
  const sizeKb = file.file_size_bytes ? Math.round(file.file_size_bytes / 1024) : null

  return (
    <div
      className={cn(
        'card p-3 cursor-pointer transition-all group',
        selected && 'ring-1 ring-accent bg-accent/5',
        !selected && 'hover:bg-surface-hover',
      )}
      onClick={onSelect}
    >
      <div className="flex items-start gap-2.5 mb-2">
        <div className={cn(
          'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5',
          file.is_enabled ? 'bg-accent/10 text-accent' : 'bg-surface-2 text-text-muted',
        )}>
          {FILE_TYPE_ICON[file.file_type] ?? <FileText className="w-4 h-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className={cn(
            'text-xs font-semibold truncate leading-tight',
            file.is_enabled ? 'text-text-primary' : 'text-text-muted',
          )}>
            {file.title ?? file.filename}
          </p>
          <p className="text-[10px] text-text-muted truncate mt-0.5">{file.filename}</p>
        </div>
        {isUpdating ? (
          <Loader className="w-3.5 h-3.5 animate-spin text-text-muted flex-shrink-0" />
        ) : (
          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 flex-shrink-0">
            {/* Toggle enable */}
            <button
              className="p-1 rounded hover:bg-surface-hover transition-colors"
              onClick={e => { e.stopPropagation(); onToggle() }}
              title={file.is_enabled ? 'Disable' : 'Enable'}
            >
              {file.is_enabled
                ? <EyeOff className="w-3 h-3 text-text-muted" />
                : <Eye className="w-3 h-3 text-success" />
              }
            </button>
            {/* Archive / restore */}
            <button
              className="p-1 rounded hover:bg-surface-hover transition-colors"
              onClick={e => { e.stopPropagation(); onArchive() }}
              title={file.status === 'archived' ? 'Restore' : 'Archive'}
            >
              {file.status === 'archived'
                ? <ArchiveRestore className="w-3 h-3 text-text-muted" />
                : <Archive className="w-3 h-3 text-text-muted" />
              }
            </button>
          </div>
        )}
      </div>

      {/* Tags */}
      {file.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {file.tags.slice(0, 3).map(tag => (
            <span key={tag} className="badge badge-gray text-[9px] py-0 px-1.5">{tag}</span>
          ))}
          {file.tags.length > 3 && (
            <span className="text-[9px] text-text-muted">+{file.tags.length - 3}</span>
          )}
        </div>
      )}

      {/* Meta row */}
      <div className="flex items-center gap-2 text-[10px] text-text-muted">
        <span className={cn('badge text-[9px] py-0', sCfg.badge)} style={{ color: sCfg.color }}>
          {sCfg.icon}{sCfg.label}
        </span>
        {file.channel_name && (
          <span className="flex items-center gap-0.5 truncate max-w-[80px]">
            <Hash className="w-3 h-3 flex-shrink-0" />{file.channel_name}
          </span>
        )}
        {file.agent_name && (
          <span className="flex items-center gap-0.5 truncate max-w-[70px]">
            <Bot className="w-3 h-3 flex-shrink-0" />{file.agent_name}
          </span>
        )}
        {sizeKb && <span className="ml-auto">{sizeKb}KB</span>}
        {file.last_modified_at && (
          <span className="ml-auto">{formatRelative(file.last_modified_at)}</span>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Preview Panel
// ─────────────────────────────────────────────────────────────
function PreviewPanel({
  file, loading, error, onClose,
  onUpdate, onAssignChannel, onAssignAgent,
  channelOptions, agentOptions, isUpdating,
}: {
  file: KnowledgeFile
  loading: boolean
  error: string | null
  onClose: () => void
  onUpdate: (patch: Parameters<typeof api.agentOps.knowledgeFiles.update>[1]) => void
  onAssignChannel: (channel_id: string) => void
  onAssignAgent: (agent_id: string) => void
  channelOptions: Array<{ id: string; name: string }>
  agentOptions: Array<{ id: string; name: string }>
  isUpdating: boolean
}) {
  const [activeTab, setActiveTab] = useState<'preview' | 'details' | 'assign'>('preview')
  const sCfg = STATUS_CONFIG[file.status]

  return (
    <div className="flex flex-col h-full">

      {/* Panel header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-surface-border
        flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <div className={cn(
              'w-6 h-6 rounded flex items-center justify-center flex-shrink-0',
              file.is_enabled ? 'text-accent' : 'text-text-muted',
            )}>
              {FILE_TYPE_ICON[file.file_type] ?? <FileText className="w-4 h-4" />}
            </div>
            <p className="text-sm font-bold text-text-primary truncate">{file.title ?? file.filename}</p>
          </div>
          <p className="text-[10px] text-text-muted truncate">{file.path}</p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className={cn('badge text-[10px]', sCfg.badge)} style={{ color: sCfg.color }}>
            {sCfg.icon}{sCfg.label}
          </span>
          <button className="p-1 rounded hover:bg-surface-hover transition-colors"
            onClick={onClose}><X className="w-4 h-4 text-text-muted" /></button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-shrink-0 flex border-b border-surface-border">
        {(['preview', 'details', 'assign'] as const).map(tab => (
          <button
            key={tab}
            className={cn(
              'flex-1 py-2.5 text-xs font-medium capitalize transition-colors',
              activeTab === tab
                ? 'text-accent border-b-2 border-accent'
                : 'text-text-muted hover:text-text-primary',
            )}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'assign' ? 'Assignment' : tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">

        {/* ── Preview tab ──────────────────────────────── */}
        {activeTab === 'preview' && (
          loading ? (
            <div className="flex items-center justify-center h-full gap-3">
              <Loader className="w-5 h-5 animate-spin text-accent" />
              <span className="text-sm text-text-muted">Loading preview...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
              <AlertTriangle className="w-7 h-7 text-error" />
              <p className="text-sm text-text-muted">{error}</p>
            </div>
          ) : file.content ? (
            <div className="p-5">
              {/* Markdown rendered */}
              <div className="prose-custom">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {file.content}
                </ReactMarkdown>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
              <FileText className="w-8 h-8 text-text-muted" />
              <p className="text-sm text-text-muted">No content to preview</p>
              <p className="text-xs text-text-muted">This file may be a binary or unsupported format.</p>
            </div>
          )
        )}

        {/* ── Details tab ──────────────────────────────── */}
        {activeTab === 'details' && (
          <div className="p-4 flex flex-col gap-4">

            {/* Metadata grid */}
            <section>
              <h3 className="text-xs font-semibold text-text-secondary mb-3 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5" /> File Details
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <MetaRow label="Filename" value={file.filename} />
                <MetaRow label="Type" value={file.file_type} />
                <MetaRow label="Path" value={file.path} />
                <MetaRow label="Size" value={file.file_size_bytes ? `${Math.round(file.file_size_bytes / 1024)} KB` : '—'} />
                <MetaRow label="Status" value={sCfg.label} />
                <MetaRow label="Weight"
                  value={file.instruction_weight != null ? `${Math.round(file.instruction_weight * 100)}%` : '—'} />
                <MetaRow label="Created" value={formatDate(file.created_at)} />
                <MetaRow label="Updated" value={formatDate(file.updated_at)} />
                <MetaRow label="Last Modified" value={file.last_modified_at ? formatDate(file.last_modified_at) : '—'} />
                <MetaRow label="Channel ID" value={file.channel_id ?? '—'} mono />
                <MetaRow label="Agent ID" value={file.agent_id ?? '—'} mono />
              </div>
            </section>

            {/* Tags */}
            <section>
              <h3 className="text-xs font-semibold text-text-secondary mb-2 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5" /> Tags
              </h3>
              {file.tags.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {file.tags.map(tag => (
                    <span key={tag} className="badge badge-gray text-xs">{tag}</span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-text-muted">No tags</p>
              )}
            </section>

            {/* Metadata JSON */}
            {Object.keys(file.metadata ?? {}).length > 0 && (
              <section>
                <h3 className="text-xs font-semibold text-text-secondary mb-2">Metadata</h3>
                <pre className="text-[10px] text-text-muted bg-surface-1 rounded-lg p-3 overflow-auto">
                  {JSON.stringify(file.metadata, null, 2)}
                </pre>
              </section>
            )}
          </div>
        )}

        {/* ── Assignment tab ───────────────────────────── */}
        {activeTab === 'assign' && (
          <div className="p-4 flex flex-col gap-5">

            {/* Channel assignment */}
            <section>
              <h3 className="text-xs font-semibold text-text-secondary mb-2 flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5" /> Linked Channel
              </h3>
              <p className="text-xs text-text-muted mb-2">
                Which channel this knowledge file applies to.
              </p>
              <div className="flex gap-2">
                <select
                  value={file.channel_id ?? ''}
                  onChange={e => onAssignChannel(e.target.value)}
                  className="input text-xs flex-1"
                  disabled={isUpdating}
                >
                  <option value="">— None —</option>
                  {channelOptions.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                {isUpdating ? (
                  <Loader className="w-4 h-4 animate-spin text-text-muted" />
                ) : file.channel_id ? (
                  <button
                    className="btn btn-ghost text-xs text-error"
                    onClick={() => onAssignChannel('')}
                  >Unassign</button>
                ) : null}
              </div>
            </section>

            {/* Agent assignment */}
            <section>
              <h3 className="text-xs font-semibold text-text-secondary mb-2 flex items-center gap-1.5">
                <Bot className="w-3.5 h-3.5" /> Assigned Agent
              </h3>
              <p className="text-xs text-text-muted mb-2">
                Which AI agent uses this file for context or instructions.
              </p>
              <div className="flex gap-2">
                <select
                  value={file.agent_id ?? ''}
                  onChange={e => onAssignAgent(e.target.value)}
                  className="input text-xs flex-1"
                  disabled={isUpdating}
                >
                  <option value="">— None —</option>
                  {agentOptions.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
                {isUpdating ? (
                  <Loader className="w-4 h-4 animate-spin text-text-muted" />
                ) : file.agent_id ? (
                  <button
                    className="btn btn-ghost text-xs text-error"
                    onClick={() => onAssignAgent('')}
                  >Unassign</button>
                ) : null}
              </div>
            </section>

            {/* Instruction weight */}
            <section>
              <h3 className="text-xs font-semibold text-text-secondary mb-2 flex items-center gap-1.5">
                <Weight className="w-3.5 h-3.5" /> Instruction Weight
              </h3>
              <p className="text-xs text-text-muted mb-3">
                How strongly this file influences agent behavior (0–100%).
              </p>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0" max="100" step="5"
                  value={Math.round((file.instruction_weight ?? 0) * 100)}
                  onChange={e => onUpdate({ instruction_weight: Number(e.target.value) / 100 })}
                  className="flex-1 accent-accent"
                  disabled={isUpdating}
                />
                <span className="text-xs font-semibold text-accent w-10 text-right">
                  {Math.round((file.instruction_weight ?? 0) * 100)}%
                </span>
              </div>
            </section>

            {/* Status management */}
            <section>
              <h3 className="text-xs font-semibold text-text-secondary mb-2">File Status</h3>
              <div className="flex gap-2 flex-wrap">
                <button
                  className={cn('btn text-xs gap-1', file.status === 'active' ? 'btn-primary' : 'btn-ghost')}
                  onClick={() => onUpdate({ status: 'active' })}
                  disabled={isUpdating}
                >
                  <Eye className="w-3.5 h-3.5" /> Active
                </button>
                <button
                  className={cn('btn text-xs gap-1', file.status === 'disabled' ? 'btn-error' : 'btn-ghost')}
                  onClick={() => onUpdate({ status: 'disabled' })}
                  disabled={isUpdating}
                >
                  <EyeOff className="w-3.5 h-3.5" /> Disabled
                </button>
                <button
                  className={cn('btn text-xs gap-1', file.status === 'archived' ? 'btn-ghost ring-1 ring-text-muted' : 'btn-ghost')}
                  onClick={() => onUpdate({ status: 'archived' })}
                  disabled={isUpdating}
                >
                  <Archive className="w-3.5 h-3.5" /> Archived
                </button>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Helper: metadata row
// ─────────────────────────────────────────────────────────────
function MetaRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 p-2 bg-surface-1 rounded-lg">
      <span className="text-[9px] uppercase tracking-wider text-text-muted font-semibold">{label}</span>
      <span className={cn('text-xs text-text-primary break-all', mono && 'font-mono text-[10px]')}>{value}</span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// States
// ─────────────────────────────────────────────────────────────
function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3">
      <Loader className="w-6 h-6 animate-spin text-accent" />
      <p className="text-sm text-text-muted">Loading knowledge files...</p>
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 px-6 text-center">
      <AlertTriangle className="w-8 h-8 text-error" />
      <p className="text-sm text-text-muted">{message}</p>
      <button className="btn btn-ghost text-xs gap-1" onClick={onRetry}>
        <RefreshCw className="w-3.5 h-3.5" /> Retry
      </button>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 px-6 text-center">
      <div className="w-14 h-14 rounded-full bg-surface-2 flex items-center justify-center">
        <BookOpen className="w-7 h-7 text-text-muted" />
      </div>
      <div>
        <p className="text-sm font-semibold text-text-primary mb-1">No knowledge files yet</p>
        <p className="text-xs text-text-muted max-w-xs">
          Upload .md files to your agent's knowledge base to provide context and instructions.
        </p>
      </div>
    </div>
  )
}

function EmptyPreviewState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
      <PanelRightOpen className="w-8 h-8 text-text-muted" />
      <div>
        <p className="text-sm text-text-primary mb-1">Select a file to preview</p>
        <p className="text-xs text-text-muted max-w-xs">
          Click any file in the list to view its content, metadata, and manage assignments.
        </p>
      </div>
    </div>
  )
}

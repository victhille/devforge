import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, File, Folder, FolderOpen, GitCompare, RefreshCw } from 'lucide-react'
import type { DefaultIDE, FileChangeStatus, FileEntry } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { formatSize } from '@renderer/lib/format'
import { cn } from '@renderer/lib/cn'
import IconButton from '@renderer/components/ui/IconButton'
import { SectionTitle } from '@renderer/components/ui/Page'
import { pressable } from '@renderer/lib/a11y'
import FilePreview from './FilePreview'
import { SearchBar, SearchResults, useProjectSearch, type SearchHit } from './ProjectSearch'
import { changedTree, GitLetter, holdsChange, TONE, type ChangedNode, type GitStates } from './GitMarks'

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', '.next', 'build', 'out', '.nuxt', 'vendor', '__pycache__', '.cache'])

const EXT_COLORS: Record<string, string> = {
  ts: '#3178C6', tsx: '#3178C6', js: '#F7DF1E', jsx: '#61DAFB',
  css: '#1572B6', scss: '#CF649A', html: '#E34F26', json: '#CBCB41',
  md: '#083FA1', svg: '#FFB13B', png: '#7B68EE', jpg: '#7B68EE', jpeg: '#7B68EE',
  py: '#3776AB', go: '#00ADD8', rs: '#DEA584', php: '#777BB4',
  sh: '#89E051', yml: '#CB171E', yaml: '#CB171E', env: '#ECD53F',
  vue: '#42B883', rb: '#CC342D', java: '#ED8B00', kt: '#7F52FF',
  cs: '#9B4993', cpp: '#F34B7D', c: '#555555', swift: '#FA7343'
}

const DIR_COLOR = '#E8B86D'
const fileColor = (ext: string | null) => (ext ? EXT_COLORS[ext.toLowerCase()] : undefined) ?? '#6B7280'

/** Dirs first, dotfiles last, skip heavy build/dependency folders. */
function visibleEntries(entries: FileEntry[]): FileEntry[] {
  return entries
    .filter(e => !(e.isDirectory && SKIP_DIRS.has(e.name)))
    .sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
      const aH = a.name.startsWith('.')
      const bH = b.name.startsWith('.')
      if (aH !== bH) return aH ? 1 : -1
      return a.name.localeCompare(b.name)
    })
}

// ─── Node ─────────────────────────────────────────────────────────────────────

interface NodeProps {
  entry:    FileEntry
  depth:    number
  dirs:     Map<string, FileEntry[]>
  expanded: Set<string>
  onToggle: (path: string) => void
  /** v3.5.1: a file opens in the preview */
  selected: string | null
  onSelect: (entry: FileEntry) => void
  emptyLabel: string
  /** v3.7: what Git says of the files (none outside a repository) */
  git?: GitTree
}

interface GitTree {
  states: GitStates
  relOf: (path: string) => string
  /** A folder's entries, its deleted files added (they are no longer on disk) */
  withDeleted: (dirPath: string, entries: FileEntry[]) => FileEntry[]
}

function TreeNode({ entry, depth, dirs, expanded, onToggle, selected, onSelect, emptyLabel, git }: NodeProps) {
  const isOpen   = expanded.has(entry.path)
  const loaded   = dirs.get(entry.path)
  const children = loaded && git ? git.withDeleted(entry.path, visibleEntries(loaded)) : loaded && visibleEntries(loaded)
  const rel      = git?.relOf(entry.path)
  const status   = git && !entry.isDirectory ? git.states[rel!] : undefined
  const changedDir = !!git && entry.isDirectory && holdsChange(git.states, rel!)
  const color    = entry.isDirectory ? DIR_COLOR : fileColor(entry.extension)
  const Icon     = entry.isDirectory ? (isOpen ? FolderOpen : Folder) : File
  const activate = () => (entry.isDirectory ? onToggle(entry.path) : onSelect(entry))

  return (
    <>
      <div
        onClick={activate}
        {...pressable(activate)}
        role="button"
        {...(entry.isDirectory ? { 'aria-expanded': isOpen } : { 'aria-current': selected === entry.path ? 'true' as const : undefined })}
        style={{ paddingLeft: 8 + depth * 14 }}
        className={cn('flex h-6 cursor-default items-center gap-1.5 rounded pr-2 text-sm hover:bg-hover hover:text-fg',
          selected === entry.path ? 'bg-accent-soft text-fg' : 'text-fg-secondary')}
      >
        <span className="flex w-2.5 shrink-0 justify-center text-fg-muted">
          {entry.isDirectory && (isOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />)}
        </span>
        <Icon size={13} color={color} strokeWidth={1.8} className="shrink-0" />
        <span className={cn('truncate', status && TONE[status])}>{entry.name}</span>
        {!entry.isDirectory && !!entry.size && (
          <span className={cn('shrink-0 pl-2 font-mono text-2xs text-fg-muted', !status && 'ml-auto')}>{formatSize(entry.size)}</span>
        )}
        {status && <GitLetter status={status} />}
        {changedDir && <span aria-hidden data-testid="dir-changed" className="ml-auto size-1.5 shrink-0 rounded-full bg-warning" />}
      </div>
      {entry.isDirectory && isOpen && children && (
        children.length === 0 ? (
          <div className="h-6 text-xs italic text-fg-muted" style={{ paddingLeft: 22 + (depth + 1) * 14 }}>{emptyLabel}</div>
        ) : children.map(child => (
          <TreeNode key={child.path} entry={child} depth={depth + 1} dirs={dirs} expanded={expanded} onToggle={onToggle} selected={selected} onSelect={onSelect} emptyLabel={emptyLabel} git={git} />
        ))
      )}
    </>
  )
}

/** "Modified only": the changed files as their own tree, every folder open */
function ChangedTreeNode({ node, depth, selected, onSelect }: { node: ChangedNode; depth: number; selected: string | null; onSelect: (rel: string, status: FileChangeStatus) => void }) {
  const status = node.status
  const open = () => status && onSelect(node.path, status)
  return (
    <>
      <div {...(status ? { onClick: open, ...pressable(open), role: 'button', 'aria-current': selected === node.path ? 'true' as const : undefined } : {})}
        style={{ paddingLeft: 8 + depth * 14 }}
        className={cn('flex h-6 items-center gap-1.5 rounded pr-2 text-sm', status ? 'cursor-default hover:bg-hover' : 'text-fg-secondary', selected === node.path && 'bg-accent-soft')}>
        <span className="w-2.5 shrink-0" />
        {status ? <File size={13} strokeWidth={1.8} className="shrink-0 text-fg-muted" /> : <FolderOpen size={13} color={DIR_COLOR} strokeWidth={1.8} className="shrink-0" />}
        <span className={cn('truncate', status && TONE[status])}>{node.name}</span>
        {status && <GitLetter status={status} />}
      </div>
      {node.children.map(c => <ChangedTreeNode key={c.path} node={c} depth={depth + 1} selected={selected} onSelect={onSelect} />)}
    </>
  )
}

// ─── Tree ─────────────────────────────────────────────────────────────────────

/** Lazy-loaded directory tree rooted at `rootPath`; a file opens beside it (v3.5.1). */
/** `open`: a file of the project (relative path) to show at once, at a line (v3.7: a failed test's place) */
export default function FileTree({ rootPath, ide, open }: { rootPath: string; ide?: DefaultIDE; open?: { path: string; line?: number } }) {
  const { t } = useI18n()
  const f = t.files
  const [file,     setFile]     = useState<FileEntry | null>(null)
  /** v3.6: the line a search result opens at */
  const [line,     setLine]     = useState<number | undefined>(undefined)
  const search = useProjectSearch(rootPath)
  const sep = rootPath.includes('\\') ? '\\' : '/'
  function openHit(hit: SearchHit) {
    const name = hit.path.split('/').pop() ?? hit.path
    setFile({ name, path: [rootPath, ...hit.path.split('/')].join(sep), isDirectory: false, size: null, extension: name.includes('.') ? name.split('.').pop()! : null })
    setLine(hit.line)
  }
  const pickFile = (entry: FileEntry) => { setFile(entry); setLine(undefined) }
  const [dirs,     setDirs]     = useState<Map<string, FileEntry[]>>(new Map())
  /** v3.7: Git's view of the files, null outside a repository */
  const [states,   setStates]   = useState<GitStates | null>(null)
  const [onlyChanged, setOnlyChanged] = useState(false)
  /** The preview starts on the changes (a file opened from "Modified only") */
  const [onChanges, setOnChanges] = useState(false)
  const loadStates = useCallback(() => {
    window.devforge.git.fileStates(rootPath).then(r => setStates(r.inRepo ? r.files : null)).catch(() => setStates(null))
  }, [rootPath])
  const [expanded, setExpanded] = useState<Set<string>>(new Set([rootPath]))

  const load = useCallback(async (path: string) => {
    const entries = await window.devforge.readDirectory(path)
    setDirs(prev => new Map(prev).set(path, entries))
  }, [])

  const reset = useCallback(() => {
    setFile(null)
    setDirs(new Map())
    setExpanded(new Set([rootPath]))
    load(rootPath)
    loadStates()
  }, [rootPath, load, loadStates])

  useEffect(() => { reset() }, [reset])

  // After the reset above: a file asked from outside (a failed test's place)
  const openPath = open?.path
  const openLine = open?.line
  useEffect(() => {
    if (!openPath) return
    const name = openPath.split('/').pop() ?? openPath
    setFile({ name, path: [rootPath, ...openPath.split('/')].join(sep), isDirectory: false, size: null, extension: name.includes('.') ? name.split('.').pop()! : null })
    setLine(openLine)
  }, [openPath, openLine, rootPath, sep])

  function toggle(path: string) {
    if (expanded.has(path)) {
      setExpanded(prev => { const n = new Set(prev); n.delete(path); return n })
    } else {
      if (!dirs.has(path)) load(path)
      setExpanded(prev => new Set(prev).add(path))
    }
  }

  const relOf = (path: string) => path.slice(rootPath.length + 1).split(sep).join('/')
  const gitTree: GitTree | undefined = states ? {
    states, relOf,
    withDeleted: (dirPath, entries) => {
      const dir = dirPath === rootPath ? '' : relOf(dirPath)
      const here = new Set(entries.map(e => relOf(e.path)))
      const gone = Object.entries(states).filter(([p, s]) => s === 'deleted' && !here.has(p) && (p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '') === dir)
      return [...entries, ...gone.map(([p]) => { const name = p.split('/').pop()!; return { name, path: [rootPath, ...p.split('/')].join(sep), isDirectory: false, size: null, extension: name.includes('.') ? name.split('.').pop()! : null } })]
    }
  } : undefined
  const root = gitTree ? gitTree.withDeleted(rootPath, visibleEntries(dirs.get(rootPath) ?? [])) : visibleEntries(dirs.get(rootPath) ?? [])
  const changedCount = states ? Object.keys(states).length : 0
  const openChanged = (rel: string) => {
    const name = rel.split('/').pop() ?? rel
    setFile({ name, path: [rootPath, ...rel.split('/')].join(sep), isDirectory: false, size: null, extension: name.includes('.') ? name.split('.').pop()! : null })
    setLine(undefined)
    setOnChanges(true)
  }

  return (
    <div className="flex h-full min-h-0">
      {/* min-w-0: a long line found never widens the pane past its card */}
      <div className={cn('flex min-h-0 min-w-0 flex-col', file ? 'w-[320px] shrink-0' : 'flex-1')}>
        <div className="flex h-10 shrink-0 items-center justify-between border-b border-line-subtle px-3">
          <SectionTitle>{f.title}</SectionTitle>
          <span className="flex items-center gap-1">
            {/* v3.7: the tree reduced to what changed since the last commit */}
            {states && (changedCount > 0 || onlyChanged) && (
              <button aria-pressed={onlyChanged} onClick={() => setOnlyChanged(v => !v)}
                className={cn('flex h-6 items-center gap-1.5 rounded-md border px-2 text-[11.5px] font-medium',
                  onlyChanged ? 'border-warning/50 bg-warning-soft text-warning' : 'border-line text-fg-secondary hover:text-fg')}>
                <GitCompare size={12} aria-hidden /> {f.onlyChanged.replace('{n}', String(changedCount))}
              </button>
            )}
            <IconButton size="sm" title={f.refresh} onClick={reset}><RefreshCw size={12} /></IconButton>
          </span>
        </div>
        <SearchBar s={search} />
        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-1">
          {search.active
            ? <SearchResults s={search} selected={file && line ? { path: file.path.slice(rootPath.length + 1).split(sep).join('/'), line } : null} onOpen={openHit} />
            : onlyChanged && states
              ? <>
                {changedTree(states).map(n => <ChangedTreeNode key={n.path} node={n} depth={0} selected={file ? relOf(file.path) : null} onSelect={rel => openChanged(rel)} />)}
                {changedCount === 0 && <p className="px-3 py-3 text-sm text-fg-muted">{f.noChanges}</p>}
              </>
              : <>
                {root.map(entry => (
                  <TreeNode key={entry.path} entry={entry} depth={0} dirs={dirs} expanded={expanded} onToggle={toggle} selected={file?.path ?? null} onSelect={e => { pickFile(e); setOnChanges(false) }} emptyLabel={f.emptyDir} git={gitTree} />
                ))}
                {root.length === 0 && <p className="px-3 py-3 text-sm text-fg-muted">{f.empty}</p>}
              </>}
        </div>
        {!file && root.length > 0 && !search.active && <p className="shrink-0 border-t border-line-subtle px-3 py-2 text-2xs text-fg-muted">{f.pickFile}</p>}
      </div>
      {file && <FilePreview file={file} line={line} root={rootPath} ide={ide} onClose={() => setFile(null)}
        change={states?.[relOf(file.path)]} rel={relOf(file.path)} startOnChanges={onChanges} />}
    </div>
  )
}

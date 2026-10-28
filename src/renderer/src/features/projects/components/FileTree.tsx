import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, File, Folder, FolderOpen, RefreshCw } from 'lucide-react'
import type { DefaultIDE, FileEntry } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { formatSize } from '@renderer/lib/format'
import { cn } from '@renderer/lib/cn'
import IconButton from '@renderer/components/ui/IconButton'
import { SectionTitle } from '@renderer/components/ui/Page'
import { pressable } from '@renderer/lib/a11y'
import FilePreview from './FilePreview'

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
}

function TreeNode({ entry, depth, dirs, expanded, onToggle, selected, onSelect, emptyLabel }: NodeProps) {
  const isOpen   = expanded.has(entry.path)
  const children = dirs.get(entry.path)
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
        <span className="truncate">{entry.name}</span>
        {!entry.isDirectory && !!entry.size && (
          <span className="ml-auto shrink-0 pl-2 font-mono text-2xs text-fg-muted">{formatSize(entry.size)}</span>
        )}
      </div>
      {entry.isDirectory && isOpen && children && (
        visibleEntries(children).length === 0 ? (
          <div className="h-6 text-xs italic text-fg-muted" style={{ paddingLeft: 22 + (depth + 1) * 14 }}>{emptyLabel}</div>
        ) : visibleEntries(children).map(child => (
          <TreeNode key={child.path} entry={child} depth={depth + 1} dirs={dirs} expanded={expanded} onToggle={onToggle} selected={selected} onSelect={onSelect} emptyLabel={emptyLabel} />
        ))
      )}
    </>
  )
}

// ─── Tree ─────────────────────────────────────────────────────────────────────

/** Lazy-loaded directory tree rooted at `rootPath`; a file opens beside it (v3.5.1). */
export default function FileTree({ rootPath, ide }: { rootPath: string; ide?: DefaultIDE }) {
  const { t } = useI18n()
  const f = t.files
  const [file,     setFile]     = useState<FileEntry | null>(null)
  const [dirs,     setDirs]     = useState<Map<string, FileEntry[]>>(new Map())
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
  }, [rootPath, load])

  useEffect(() => { reset() }, [reset])

  function toggle(path: string) {
    if (expanded.has(path)) {
      setExpanded(prev => { const n = new Set(prev); n.delete(path); return n })
    } else {
      if (!dirs.has(path)) load(path)
      setExpanded(prev => new Set(prev).add(path))
    }
  }

  const root = visibleEntries(dirs.get(rootPath) ?? [])

  return (
    <div className="flex h-full min-h-0">
      <div className={cn('flex min-h-0 flex-col', file ? 'w-[280px] shrink-0' : 'flex-1')}>
        <div className="flex h-10 shrink-0 items-center justify-between border-b border-line-subtle px-3">
          <SectionTitle>{f.title}</SectionTitle>
          <IconButton size="sm" title={f.refresh} onClick={reset}><RefreshCw size={12} /></IconButton>
        </div>
        <div className="flex-1 overflow-y-auto p-1">
          {root.map(entry => (
            <TreeNode key={entry.path} entry={entry} depth={0} dirs={dirs} expanded={expanded} onToggle={toggle} selected={file?.path ?? null} onSelect={setFile} emptyLabel={f.emptyDir} />
          ))}
          {root.length === 0 && <p className="px-3 py-3 text-sm text-fg-muted">{f.empty}</p>}
        </div>
        {!file && root.length > 0 && <p className="shrink-0 border-t border-line-subtle px-3 py-2 text-2xs text-fg-muted">{f.pickFile}</p>}
      </div>
      {file && <FilePreview file={file} root={rootPath} ide={ide} onClose={() => setFile(null)} />}
    </div>
  )
}

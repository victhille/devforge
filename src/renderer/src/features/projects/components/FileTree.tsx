import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, File, Folder, FolderOpen, RefreshCw } from 'lucide-react'
import type { FileEntry } from '@shared/types'
import { formatSize } from '@renderer/lib/format'
import IconButton from '@renderer/components/ui/IconButton'
import { SectionTitle } from '@renderer/components/ui/Page'
import { pressable } from '@renderer/lib/a11y'

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
}

function TreeNode({ entry, depth, dirs, expanded, onToggle }: NodeProps) {
  const isOpen   = expanded.has(entry.path)
  const children = dirs.get(entry.path)
  const color    = entry.isDirectory ? DIR_COLOR : fileColor(entry.extension)
  const Icon     = entry.isDirectory ? (isOpen ? FolderOpen : Folder) : File

  return (
    <>
      <div
        onClick={() => entry.isDirectory && onToggle(entry.path)}
        {...(entry.isDirectory ? { ...pressable(() => onToggle(entry.path)), role: 'button', 'aria-expanded': isOpen } : {})}
        style={{ paddingLeft: 8 + depth * 14 }}
        className="flex h-6 cursor-default items-center gap-1.5 rounded pr-2 text-sm text-fg-secondary hover:bg-hover hover:text-fg"
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
          <div className="h-6 text-xs italic text-fg-muted" style={{ paddingLeft: 22 + (depth + 1) * 14 }}>empty</div>
        ) : visibleEntries(children).map(child => (
          <TreeNode key={child.path} entry={child} depth={depth + 1} dirs={dirs} expanded={expanded} onToggle={onToggle} />
        ))
      )}
    </>
  )
}

// ─── Tree ─────────────────────────────────────────────────────────────────────

/** Lazy-loaded directory tree rooted at `rootPath`. */
export default function FileTree({ rootPath }: { rootPath: string }) {
  const [dirs,     setDirs]     = useState<Map<string, FileEntry[]>>(new Map())
  const [expanded, setExpanded] = useState<Set<string>>(new Set([rootPath]))

  const load = useCallback(async (path: string) => {
    const entries = await window.devforge.readDirectory(path)
    setDirs(prev => new Map(prev).set(path, entries))
  }, [])

  const reset = useCallback(() => {
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
    <div className="flex min-h-0 flex-col">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-line-subtle px-3">
        <SectionTitle>Files</SectionTitle>
        <IconButton size="sm" title="Refresh" onClick={reset}><RefreshCw size={12} /></IconButton>
      </div>
      <div className="flex-1 overflow-y-auto p-1">
        {root.map(entry => (
          <TreeNode key={entry.path} entry={entry} depth={0} dirs={dirs} expanded={expanded} onToggle={toggle} />
        ))}
        {root.length === 0 && <p className="px-3 py-3 text-sm text-fg-muted">No files found</p>}
      </div>
    </div>
  )
}

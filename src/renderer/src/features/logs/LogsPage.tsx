import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDownToLine, Eraser, FileText, Pause, Play, Plus, Search, WrapText, X } from 'lucide-react'
import type { LogFileSuggestion } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useToast } from '@renderer/app/ToastContext'
import { cn } from '@renderer/lib/cn'
import Button from '@renderer/components/ui/Button'
import EmptyState from '@renderer/components/ui/EmptyState'
import IconButton from '@renderer/components/ui/IconButton'
import { Input } from '@renderer/components/ui/Input'
import { LEVEL_COLOR, levelOf, type LogLevel } from './logLevel'
import Suggestions from '@renderer/components/ui/Suggestions'
import { formatRelative, formatSize } from '@renderer/lib/format'

const MAX_LINES = 5000
const STORAGE_KEY = 'devforge:log-files'

interface Line { n: number; text: string; level: LogLevel }
interface OpenFile { id: string; path: string; lines: Line[]; counter: number }

const LEVELS: LogLevel[] = ['error', 'warn', 'info', 'debug']
const LEVEL_CHIP: Record<LogLevel, string> = {
  error: 'border-danger/40 text-danger', warn: 'border-warning/40 text-warning',
  info: 'border-line text-fg', debug: 'border-line text-fg-muted', other: ''
}

function toLines(texts: string[], start: number): Line[] {
  return texts.map((text, i) => ({ n: start + i + 1, text, level: levelOf(text) }))
}

const fileName = (p: string) => p.split(/[\\/]/).pop() ?? p

export default function LogsPage() {
  const { t, lang } = useI18n()
  const l = t.logs
  const [suggested, setSuggested] = useState<LogFileSuggestion[]>([])
  useEffect(() => { window.devforge.suggest.logFiles().then(setSuggested).catch(() => {}) }, [])
  const toast = useToast()
  const [files, setFiles] = useState<OpenFile[]>([])
  const [active, setActive] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [levels, setLevels] = useState<Set<LogLevel>>(new Set(['error', 'warn', 'info', 'debug', 'other']))
  const [paused, setPaused] = useState(false)
  const [wrap, setWrap] = useState(true)
  const listRef = useRef<HTMLDivElement>(null)
  const openedOnce = useRef(false)

  const open = useCallback(async (path: string) => {
    try {
      const r = await window.devforge.logs.open(path)
      setFiles(prev => [...prev.filter(f => f.path !== path), { id: r.id, path, lines: toLines(r.lines, 0), counter: r.lines.length }])
      setActive(r.id)
    } catch (err) {
      toast.show({ tone: 'error', title: l.openFailed, description: `${path}\n${String(err)}` })
    }
  }, [toast, l])

  // Re-open last files; close every tail when leaving the page
  useEffect(() => {
    if (!openedOnce.current) {
      openedOnce.current = true
      try { (JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as string[]).forEach(open) } catch { /* ignore */ }
    }
    return window.devforge.logs.onLines(e => setFiles(prev => prev.map(f => {
      if (f.id !== e.id) return f
      if (e.reset) return { ...f, lines: [], counter: 0 }
      const added = toLines(e.lines, f.counter)
      const lines = [...f.lines, ...added]
      return { ...f, counter: f.counter + added.length, lines: lines.length > MAX_LINES ? lines.slice(-MAX_LINES) : lines }
    })))
  }, [open])

  const filesRef = useRef(files)
  filesRef.current = files
  useEffect(() => () => { filesRef.current.forEach(f => window.devforge.logs.close(f.id)) }, [])

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(files.map(f => f.path))) } catch { /* ignore */ }
  }, [files])

  async function addFile() {
    const p = await window.devforge.selectFile()
    if (p) open(p)
  }

  function closeFile(id: string) {
    window.devforge.logs.close(id)
    setFiles(prev => prev.filter(f => f.id !== id))
    setActive(prev => (prev === id ? files.find(f => f.id !== id)?.id ?? null : prev))
  }

  const file = files.find(f => f.id === active)
  const q = search.toLowerCase()
  const visible = useMemo(
    () => (file?.lines ?? []).filter(x => levels.has(x.level) && (!q || x.text.toLowerCase().includes(q))),
    [file, levels, q]
  )
  const counts = useMemo(() => {
    const c: Record<LogLevel, number> = { error: 0, warn: 0, info: 0, debug: 0, other: 0 }
    for (const x of file?.lines ?? []) c[x.level]++
    return c
  }, [file])

  // Follow the end unless paused
  useEffect(() => {
    if (!paused && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [visible, paused])

  const toggleLevel = (lvl: LogLevel) => setLevels(prev => {
    const n = new Set(prev)
    if (n.has(lvl)) n.delete(lvl); else n.add(lvl)
    return n
  })

  return (
    <div className="relative flex h-full flex-col">
      {/* File tabs */}
      <div className="flex h-10 shrink-0 items-end gap-0.5 overflow-x-auto border-b border-line-subtle bg-surface px-2">
        {files.map(f => (
          <div key={f.id} onClick={() => setActive(f.id)} title={f.path}
            className={cn('flex h-9 cursor-pointer items-center gap-2 rounded-t-md border border-b-0 px-3 text-sm',
              f.id === active ? 'border-line-subtle bg-canvas text-fg' : 'border-transparent text-fg-secondary hover:bg-hover')}>
            <FileText size={13} />
            <span className="max-w-48 truncate">{fileName(f.path)}</span>
            <IconButton size="sm" title={t.common.close} className="size-5" onClick={e => { e.stopPropagation(); closeFile(f.id) }}><X size={11} /></IconButton>
          </div>
        ))}
        <IconButton title={l.open} onClick={addFile} className="mb-1"><Plus size={15} /></IconButton>
      </div>

      {!file ? (
        <div className="flex flex-1 flex-col gap-4 p-8">
          <Suggestions
            title={l.suggestions}
            items={suggested.map(s => ({
              key: s.path,
              label: <span><span className="font-medium">{s.projectName}</span> <span className="font-mono text-xs text-fg-secondary">{s.path.split(/[\\/]/).slice(-3).join('/')}</span></span>,
              hint: `${formatSize(s.size)} · ${formatRelative(s.modifiedAt, lang)}`,
              onPick: () => open(s.path)
            }))}
          />
          <EmptyState className="flex-1" icon={<FileText size={32} />} title={l.emptyTitle} description={l.emptyHint}
            action={<Button onClick={addFile}><Plus size={14} /> {l.open}</Button>} />
        </div>
      ) : (
        <>
          {/* Toolbar */}
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-line-subtle px-4 py-2">
            <div className="relative w-72">
              <Search size={13} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-fg-muted" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={l.search} className="h-8 pl-8 text-sm" />
            </div>
            {LEVELS.map(lvl => (
              <button key={lvl} onClick={() => toggleLevel(lvl)}
                className={cn('rounded-full border px-2.5 py-0.5 font-mono text-xs transition-opacity', LEVEL_CHIP[lvl], !levels.has(lvl) && 'opacity-35')}>
                {lvl} {counts[lvl]}
              </button>
            ))}
            <span className="ml-auto truncate font-mono text-2xs text-fg-muted" title={file.path}>{file.path}</span>
            <IconButton title={wrap ? l.noWrap : l.wrap} active={wrap} onClick={() => setWrap(w => !w)}><WrapText size={14} /></IconButton>
            <IconButton title={l.clear} onClick={() => setFiles(prev => prev.map(f => (f.id === file.id ? { ...f, lines: [] } : f)))}><Eraser size={14} /></IconButton>
            <Button size="sm" variant={paused ? 'primary' : 'secondary'} onClick={() => setPaused(p => !p)}>
              {paused ? <Play size={12} /> : <Pause size={12} />} {paused ? l.resume : l.pause}
            </Button>
          </div>

          {/* Lines */}
          <div ref={listRef} className="relative min-h-0 flex-1 overflow-auto bg-console py-2 font-mono text-xs leading-5">
            {visible.length === 0 && <p className="px-4 py-6 text-fg-muted">{l.noLines}</p>}
            {visible.map(x => (
              <div key={x.n} className={cn('flex gap-3 px-4 hover:bg-hover', LEVEL_COLOR[x.level], x.level === 'error' && 'bg-danger-soft')}>
                <span className="w-12 shrink-0 text-right text-fg-disabled select-none">{x.n}</span>
                <span className={cn(wrap ? 'whitespace-pre-wrap break-all' : 'whitespace-pre')}>{x.text || ' '}</span>
              </div>
            ))}
          </div>
          {paused && (
            <button onClick={() => setPaused(false)} className="absolute right-8 bottom-8 flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-sm text-white shadow-pop">
              <ArrowDownToLine size={13} /> {l.resume}
            </button>
          )}
        </>
      )}
    </div>
  )
}

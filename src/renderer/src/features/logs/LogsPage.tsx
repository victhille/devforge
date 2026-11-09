import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAssistantPageContext } from '@renderer/features/assistant/AssistantContext'
import { ArrowDownToLine, Eraser, ExternalLink, FileText, Pause, Play, Plus, Sparkles, WrapText, X } from 'lucide-react'
import type { LogFileSuggestion } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useToast } from '@renderer/app/ToastContext'
import { cn } from '@renderer/lib/cn'
import { pressable } from '@renderer/lib/a11y'
import { usePreferredIde } from '@renderer/lib/ide'
import Button from '@renderer/components/ui/Button'
import Card from '@renderer/components/ui/Card'
import EmptyState from '@renderer/components/ui/EmptyState'
import IconButton from '@renderer/components/ui/IconButton'
import MoreMenu from '@renderer/components/ui/MoreMenu'
import { Page, PageHeader } from '@renderer/components/ui/Page'
import AskForgy from '@renderer/features/assistant/AskForgy'
import { LEVEL_COLOR, LEVEL_TAG, levelOf, splitLine, type LogLevel } from './logLevel'
import Suggestions from '@renderer/components/ui/Suggestions'
import { formatRelative, formatSize } from '@renderer/lib/format'
import SearchInput from '@renderer/components/ui/SearchInput'

const MAX_LINES = 5000
const STORAGE_KEY = 'devforge:log-files'
/** Lines around the one asked about, sent to Forgy with it */
const AROUND = 8

interface Line { n: number; text: string; level: LogLevel }
interface OpenFile { id: string; path: string; lines: Line[]; counter: number }
type Filter = 'all' | 'error' | 'warn' | 'info'
/** The level's tag, as the mock-up colors it (INFO in blue) */
const TAG_COLOR: Record<LogLevel, string> = { ...LEVEL_COLOR, info: 'text-info' }

function toLines(texts: string[], start: number): Line[] {
  return texts.map((text, i) => ({ n: start + i + 1, text, level: levelOf(text) }))
}

const fileName = (p: string) => p.split(/[\\/]/).pop() ?? p
/** « storage/logs/laravel.log »: the last folders, enough to know it */
const shortPath = (p: string) => p.split(/[\\/]/).slice(-3).join('/')

/**
 * As in the mock-up: the file and Pause in the header, a filter and the levels
 * above the lines (time, level, message), and Forgy beside an error picked.
 */
export default function LogsPage() {
  const { t, lang } = useI18n()
  const l = t.logs
  const [suggested, setSuggested] = useState<LogFileSuggestion[]>([])
  useEffect(() => { window.devforge.suggest.logFiles().then(setSuggested).catch(() => {}) }, [])
  const toast = useToast()
  const ide = usePreferredIde()
  const [files, setFiles] = useState<OpenFile[]>([])
  const [active, setActive] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [paused, setPaused] = useState(false)
  const [wrap, setWrap] = useState(true)
  const [picked, setPicked] = useState<number | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const openedOnce = useRef(false)
  // ?file=<path>: opened from a project page
  const [params] = useSearchParams()
  const wantedFile = useRef(params.get('file'))

  const open = useCallback(async (path: string) => {
    try {
      const r = await window.devforge.logs.open(path)
      setFiles(prev => [...prev.filter(f => f.path !== path), { id: r.id, path, lines: toLines(r.lines, 0), counter: r.lines.length }])
      setActive(r.id)
      setPicked(null)
    } catch (err) {
      toast.show({ tone: 'error', title: l.openFailed, description: `${path}\n${String(err)}` })
    }
  }, [toast, l])

  // Re-open last files; close every tail when leaving the page
  useEffect(() => {
    if (!openedOnce.current) {
      openedOnce.current = true
      try { (JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as string[]).forEach(open) } catch { /* ignore */ }
      const wanted = wantedFile.current
      if (wanted) open(wanted)
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
    const p = await window.devforge.logs.pick()
    if (p) open(p)
  }

  function closeFile(id: string) {
    window.devforge.logs.close(id)
    setFiles(prev => prev.filter(f => f.id !== id))
    setActive(prev => (prev === id ? files.find(f => f.id !== id)?.id ?? null : prev))
    setPicked(null)
  }

  const file = files.find(f => f.id === active)
  const q = search.toLowerCase()
  const visible = useMemo(
    () => (file?.lines ?? []).filter(x => (filter === 'all' || x.level === filter) && (!q || x.text.toLowerCase().includes(q))),
    [file, filter, q]
  )
  // Last visible lines (filters applied) for the assistant
  const tail = useMemo(() => visible.slice(-150).map(x => x.text).join('\n'), [visible])
  useAssistantPageContext(file ? { label: `Logs — ${fileName(file.path)}`, content: `File: ${file.path}\n${tail}` } : null)

  const counts = useMemo(() => {
    const c: Record<LogLevel, number> = { error: 0, warn: 0, info: 0, debug: 0, other: 0 }
    for (const x of file?.lines ?? []) c[x.level]++
    return c
  }, [file])

  // Follow the end unless paused
  useEffect(() => {
    if (!paused && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [visible, paused])

  // A file opened shows Forgy beside its last error, as in the mock-up (closed with its ✕)
  const firstLook = useRef<string | null>(null)
  useEffect(() => {
    if (!file || firstLook.current === file.id) return
    firstLook.current = file.id
    const last = [...file.lines].reverse().find(x => x.level === 'error')
    if (last) setPicked(last.n)
  }, [file])
  const pickedLine = file?.lines.find(x => x.n === picked) ?? null
  const project = file ? suggested.find(s => s.path === file.path)?.projectName : undefined
  const chips: { value: Filter; label: string; count?: number }[] = [
    { value: 'all', label: l.all },
    { value: 'error', label: l.levelError, count: counts.error },
    { value: 'warn', label: l.levelWarn, count: counts.warn },
    { value: 'info', label: l.levelInfo }
  ]

  /** The line and the ones around it: what Forgy needs to explain it */
  const question = () => {
    if (!file || !pickedLine) return ''
    const at = file.lines.indexOf(pickedLine)
    const around = file.lines.slice(Math.max(0, at - AROUND), at + AROUND + 1).map(x => x.text).join('\n')
    return l.explainPrompt.replace('{file}', file.path).replace('{line}', pickedLine.text).replace('{around}', around)
  }

  return (
    <Page className="df-mockup h-full">
      <PageHeader crumb={t.nav.groupData} title={t.nav.logs} subtitle={l.subtitle}
        actions={file ? <>
          <label className="flex items-center">
            <span className="sr-only">{l.file}</span>
            <select value={file.id} title={file.path}
              onChange={e => { if (e.target.value === '+') addFile(); else { setActive(e.target.value); setPicked(null) } }}
              className="h-9 max-w-[320px] truncate rounded-control border border-line bg-surface px-3 text-sm font-semibold text-fg outline-none focus:border-accent">
              {files.map(f => <option key={f.id} value={f.id}>{shortPath(f.path)}</option>)}
              <option value="+">{l.openOther}</option>
            </select>
          </label>
          <Button variant="secondary" onClick={() => setPaused(p => !p)}>
            {paused ? <Play size={14} aria-hidden /> : <Pause size={14} aria-hidden />} {paused ? l.resume : l.pause}
          </Button>
          <MoreMenu label={l.more} items={[
            { label: wrap ? l.noWrap : l.wrap, icon: WrapText, onSelect: () => setWrap(w => !w) },
            { label: l.clear, icon: Eraser, onSelect: () => setFiles(prev => prev.map(f => (f.id === file.id ? { ...f, lines: [] } : f))) },
            { label: l.closeFile, icon: X, danger: true, onSelect: () => closeFile(file.id) }
          ]} />
        </> : undefined} />

      {!file ? (
        <>
          <Suggestions
            title={l.suggestions}
            items={suggested.map(s => ({
              key: s.path,
              label: <span><span className="font-medium">{s.projectName}</span> <span className="font-mono text-xs text-fg-secondary">{shortPath(s.path)}</span></span>,
              hint: `${formatSize(s.size, lang)} · ${formatRelative(s.modifiedAt, lang)}`,
              onPick: () => open(s.path)
            }))}
          />
          <EmptyState icon={<FileText size={32} />} title={l.emptyTitle} description={l.emptyHint}
            action={<Button onClick={addFile}><Plus size={14} aria-hidden /> {l.open}</Button>} />
        </>
      ) : (
        <>
          {/* The filter and the levels, the file's figures on the right */}
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <SearchInput className="w-full max-w-[300px]" value={search} onChange={setSearch} placeholder={l.search} />
            <div role="radiogroup" aria-label={l.levels} className="flex flex-wrap gap-2">
              {chips.map(c => (
                <button key={c.value} role="radio" aria-checked={filter === c.value} onClick={() => setFilter(c.value)}
                  className={cn('flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition-colors',
                    filter === c.value ? 'border-accent/45 bg-accent-soft text-accent' : 'border-line text-fg-secondary hover:text-fg')}>
                  {c.label}{c.count ? <span className="font-mono text-xs font-medium text-fg-muted">{c.count}</span> : null}
                </button>
              ))}
            </div>
            <span className="ml-auto truncate text-sm text-fg-muted" title={file.path}>
              {[project, l.lineCount.replace('{n}', file.lines.length.toLocaleString(lang)), paused ? l.paused : l.following].filter(Boolean).join(' · ')}
            </span>
          </div>

          <div className={cn('grid min-h-0 flex-1 items-start gap-4', pickedLine && 'xl:grid-cols-[minmax(0,1fr)_340px]')}>
            {/* The lines: time, level, message; an error or a warning can be picked */}
            <div ref={listRef} role="log" aria-label={l.linesOf.replace('{name}', fileName(file.path))}
              className="relative max-h-full overflow-auto rounded-card border border-line-subtle bg-console py-2.5 font-mono text-xs leading-6">
              {visible.length === 0 && <p className="px-4 py-6 text-fg-muted">{l.noLines}</p>}
              {visible.map(x => {
                const { time, message } = splitLine(x.text)
                const pickable = x.level === 'error' || x.level === 'warn'
                const choose = () => setPicked(p => (p === x.n ? null : x.n))
                return (
                  <div key={x.n} {...(pickable ? { ...pressable(choose), role: 'button', onClick: choose, 'aria-pressed': picked === x.n, title: l.explainHint } : {})}
                    className={cn('flex gap-4 px-4', pickable && 'cursor-pointer', x.level === 'error' && 'bg-danger-soft/60', picked === x.n ? 'bg-active' : 'hover:bg-hover')}>
                    <span className="w-16 shrink-0 text-fg-muted select-none">{time ?? ''}</span>
                    <span className={cn('w-16 shrink-0 font-semibold select-none', TAG_COLOR[x.level])}>{LEVEL_TAG[x.level]}</span>
                    <span className={cn('min-w-0 flex-1', x.level === 'debug' || x.level === 'other' ? 'text-fg-secondary' : 'text-fg', wrap ? 'whitespace-pre-wrap break-all' : 'whitespace-pre')}>{message || ' '}</span>
                  </div>
                )
              })}
              {paused && (
                <button onClick={() => setPaused(false)} className="sticky bottom-3 left-full mr-3 ml-auto flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 font-sans text-sm text-accent-fg shadow-pop">
                  <ArrowDownToLine size={13} aria-hidden /> {l.resume}
                </button>
              )}
            </div>

            {pickedLine && (
              <Card className="flex flex-col gap-3 border-forgy/40 p-4.5">
                <div className="flex items-center gap-2">
                  <Sparkles size={15} aria-hidden className="text-forgy" />
                  <h2 className="min-w-0 flex-1 font-display text-md font-bold tracking-[-.01em] text-fg">{l.explainTitle}</h2>
                  <IconButton size="sm" title={t.common.close} onClick={() => setPicked(null)}><X size={13} /></IconButton>
                </div>
                <p className="line-clamp-4 rounded-control bg-console px-3 py-2 font-mono text-xs break-all text-fg">{pickedLine.text}</p>
                <p className="text-sm text-fg-secondary">{l.explainText}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <AskForgy solid label={l.explainAsk} question={question} />
                  <Button size="sm" variant="ghost" onClick={() => ide.openFile(file.path)}><ExternalLink size={13} aria-hidden /> {l.openFile}</Button>
                </div>
              </Card>
            )}
          </div>
        </>
      )}
    </Page>
  )
}

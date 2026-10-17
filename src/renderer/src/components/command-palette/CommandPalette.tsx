import { useEffect, useMemo, useRef, useState } from 'react'
import { CornerDownLeft, Search } from 'lucide-react'
import { useI18n } from '@renderer/i18n/I18nContext'
import { cn } from '@renderer/lib/cn'
import { useCommands, scoreCommand, type Command } from './useCommands'

const MAX_RESULTS = 60

/** Ctrl+K / Cmd+K launcher: pages, projects, scripts and servers. */
export default function CommandPalette() {
  const { t } = useI18n()
  const [open,   setOpen]   = useState(false)
  const [query,  setQuery]  = useState('')
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef  = useRef<HTMLDivElement>(null)
  const commands = useCommands(open)

  // Global shortcut + custom event (title bar button)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(o => !o)
      }
    }
    const onOpen = () => setOpen(true)
    window.addEventListener('keydown', onKey)
    window.addEventListener('devforge:open-palette', onOpen)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('devforge:open-palette', onOpen)
    }
  }, [])

  useEffect(() => {
    if (open) {
      setQuery('')
      setCursor(0)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  const results = useMemo(() => {
    if (!query.trim()) {
      // No query: pages first, then the rest, in natural order
      return commands.slice(0, MAX_RESULTS)
    }
    const scored = commands
      .map(cmd => ({ cmd, score: scoreCommand(cmd, query) }))
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score)
    // Keep each group together, groups ordered by their best match
    const groupRank = new Map<string, number>()
    scored.forEach((r, i) => { if (!groupRank.has(r.cmd.group)) groupRank.set(r.cmd.group, i) })
    return scored
      .sort((a, b) => groupRank.get(a.cmd.group)! - groupRank.get(b.cmd.group)! || b.score - a.score)
      .slice(0, MAX_RESULTS)
      .map(r => r.cmd)
  }, [commands, query])

  useEffect(() => { setCursor(0) }, [query])

  // Keep the highlighted row visible
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${cursor}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [cursor])

  if (!open) return null

  function execute(cmd: Command | undefined) {
    if (!cmd) return
    setOpen(false)
    cmd.run()
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(results.length - 1, c + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(0, c - 1)) }
    else if (e.key === 'Enter') { e.preventDefault(); execute(results[cursor]) }
    else if (e.key === 'Escape') { e.preventDefault(); setOpen(false) }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-6 pt-[12vh] backdrop-blur-[2px]"
      onMouseDown={e => { if (e.target === e.currentTarget) setOpen(false) }}
    >
      <div className="flex max-h-[65vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-pop">
        <div className="flex items-center gap-3 border-b border-line-subtle px-4">
          <Search size={16} className="shrink-0 text-fg-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t.palette.placeholder}
            className="h-12 flex-1 bg-transparent text-md text-fg outline-none placeholder:text-fg-muted"
          />
          <kbd className="rounded border border-line bg-elevated px-1.5 py-0.5 font-mono text-2xs text-fg-muted">Esc</kbd>
        </div>

        <div ref={listRef} className="flex-1 overflow-y-auto p-1.5">
          {results.length === 0 && <p className="px-3 py-8 text-center text-fg-muted">{t.palette.noResults}</p>}
          {results.map((cmd, i) => {
            const showGroup = i === 0 || results[i - 1].group !== cmd.group
            const Icon = cmd.icon
            return (
              <div key={cmd.id}>
                {showGroup && (
                  <div className="px-3 pt-2.5 pb-1 text-2xs font-semibold uppercase tracking-widest text-fg-muted">{cmd.group}</div>
                )}
                <button
                  data-index={i}
                  onMouseMove={() => setCursor(i)}
                  onClick={() => execute(cmd)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left',
                    i === cursor ? 'bg-active' : 'hover:bg-hover'
                  )}
                >
                  <Icon size={15} className={cn('shrink-0', i === cursor ? 'text-accent' : 'text-fg-muted')} style={cmd.color ? { color: cmd.color } : undefined} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-fg">{cmd.title}</span>
                    {cmd.subtitle && <span className="truncate font-mono text-2xs text-fg-muted">{cmd.subtitle}</span>}
                  </span>
                  {i === cursor && <CornerDownLeft size={13} className="shrink-0 text-fg-muted" />}
                </button>
              </div>
            )
          })}
        </div>

        <div className="flex items-center gap-4 border-t border-line-subtle px-4 py-2 text-2xs text-fg-muted">
          <span><kbd className="font-mono">↑↓</kbd> {t.palette.hintNavigate}</span>
          <span><kbd className="font-mono">↵</kbd> {t.palette.hintRun}</span>
          <span className="ml-auto"><kbd className="font-mono">Ctrl K</kbd> {t.palette.hintToggle}</span>
        </div>
      </div>
    </div>
  )
}

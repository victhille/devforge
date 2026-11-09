import { useEffect, useMemo, useRef, useState } from 'react'
import { CornerDownLeft, Search } from 'lucide-react'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useToast } from '@renderer/app/ToastContext'
import { cn } from '@renderer/lib/cn'
import { useCommands, scoreCommand, type Command } from './useCommands'
import { errorText } from '@renderer/lib/errors'
import { confirmDialog } from '@renderer/app/ConfirmContext'
import Kbd from '@renderer/components/ui/Kbd'

const MAX_RESULTS = 60

/** The typed words found in a result, in the accent and bold, as in the mock-up (a look only: the title is read whole) */
function Hit({ text, query }: { text: string; query: string }) {
  const words = query.trim().split(/\s+/).filter(Boolean).map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  if (!words.length) return <>{text}</>
  const parts = text.split(new RegExp(`(${words.join('|')})`, 'gi'))
  return <>{parts.map((p, k) => (k % 2 ? <span key={k} className="font-bold text-accent">{p}</span> : p))}</>
}

/** Ctrl+K / Cmd+K launcher: pages, projects, scripts and servers. */
export default function CommandPalette() {
  const { t } = useI18n()
  const [open,   setOpen]   = useState(false)
  const [query,  setQuery]  = useState('')
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef  = useRef<HTMLDivElement>(null)
  const commands = useCommands(open)
  const toast = useToast()

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

  async function execute(cmd: Command | undefined) {
    if (!cmd) return
    if (cmd.confirm && !(await confirmDialog(cmd.confirm))) return
    setOpen(false)
    const r = cmd.run()
    // An action says when it is done, or why it failed
    if (r instanceof Promise) {
      r.then(() => toast.show({ tone: 'success', title: t.palette.done.replace('{title}', cmd.title) }))
        .catch(err => toast.show({ tone: 'error', title: t.palette.failed.replace('{title}', cmd.title), description: errorText(err) }))
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(results.length - 1, c + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(0, c - 1)) }
    else if (e.key === 'Enter') { e.preventDefault(); execute(results[cursor]) }
    else if (e.key === 'Escape') { e.preventDefault(); setOpen(false) }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/55 px-6 pt-[12vh] backdrop-blur-[3px]"
      onMouseDown={e => { if (e.target === e.currentTarget) setOpen(false) }}
    >
      {/* Forge: a floating window, 680 px, the chosen row on the soft accent; rows of 44 px, keys easy to read */}
      <div className="flex max-h-[65vh] w-full max-w-[680px] flex-col overflow-hidden rounded-window border border-line bg-surface shadow-pop">
        {/* The field and the hints keep their height: only the list scrolls when it is long */}
        <div className="flex shrink-0 items-center gap-4 border-b border-line-subtle px-6">
          <Search size={18} aria-hidden className="shrink-0 text-fg-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t.palette.placeholder}
            className="h-18 flex-1 bg-transparent text-lg text-fg outline-none placeholder:text-fg-muted"
          />
          <Kbd size="md">{t.palette.escKey}</Kbd>
        </div>

        <div ref={listRef} className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
          {results.length === 0 && <p className="px-3 py-10 text-center text-base text-fg-muted">{t.palette.noResults}</p>}
          {results.map((cmd, i) => {
            const showGroup = i === 0 || results[i - 1].group !== cmd.group
            const Icon = cmd.icon
            return (
              <div key={cmd.id}>
                {showGroup && (
                  <div className="px-3.5 pt-3.5 pb-2 text-sm font-semibold tracking-wide text-fg-muted">{cmd.group}</div>
                )}
                <button
                  data-index={i}
                  onMouseMove={() => setCursor(i)}
                  onClick={() => execute(cmd)}
                  className={cn(
                    'flex min-h-13.5 w-full items-center gap-4 rounded-control px-3.5 py-2.5 text-left',
                    i === cursor ? 'bg-accent-soft' : 'hover:bg-elevated'
                  )}
                >
                  <Icon size={18} aria-hidden className={cn('shrink-0', i === cursor ? 'text-accent' : 'text-fg-muted')} style={cmd.color ? { color: cmd.color } : undefined} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-md text-fg"><Hit text={cmd.title} query={query} /></span>
                    {cmd.subtitle && <span className="truncate font-mono text-xs text-fg-muted">{cmd.subtitle}</span>}
                  </span>
                  {i === cursor && <CornerDownLeft size={14} aria-hidden className="shrink-0 text-fg-muted" />}
                </button>
              </div>
            )
          })}
        </div>

        <div className="flex min-h-15 shrink-0 flex-wrap items-center gap-x-6 gap-y-2 border-t border-line-subtle px-6 py-3 text-sm text-fg-muted">
          <span className="flex items-center gap-2.5"><Kbd size="md">↑↓</Kbd> {t.palette.hintNavigate}</span>
          <span className="flex items-center gap-2.5"><Kbd size="md">↵</Kbd> {t.palette.hintRun}</span>
          <span className="ml-auto flex items-center gap-2.5"><Kbd size="md">Ctrl K</Kbd> {t.palette.hintToggle}</span>
        </div>
      </div>
    </div>
  )
}

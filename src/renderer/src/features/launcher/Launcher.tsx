import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom'
import { Bot, Calculator, Check, Clock, Copy, Hash, Loader2, Palette, X } from 'lucide-react'
import type { LauncherToMain } from '@shared/types'
import { quickAnswers, type AnswerKind, type QuickAnswer } from '@shared/lib/launcherTools'
import { rankEntries, recordUse, type LauncherUsage } from '@shared/lib/launcherRank'
import { ConsoleContext, type ConsoleContextValue } from '@renderer/app/ConsoleContext'
import { useCommands, type Command } from '@renderer/components/command-palette/useCommands'
import { useI18n } from '@renderer/i18n/I18nContext'
import { applyAppearance } from '@renderer/lib/appearance'
import { cn } from '@renderer/lib/cn'

/** The launcher's own empty page: any other route is meant for the main window */
const HERE = '/launcher'
const USAGE_KEY = 'devforge:launcher-usage'
const MAX_RESULTS = 8
/** Change the look of the main window, not this one: left to the palette */
const MAIN_ONLY = new Set(['act:theme', 'act:density'])

const toMain = (m: LauncherToMain) => window.devforge.launcher.toMain(m)
const hide = () => window.devforge.launcher.hide()

function readUsage(): LauncherUsage {
  try { return JSON.parse(localStorage.getItem(USAGE_KEY) ?? '{}') as LauncherUsage } catch { return {} }
}
function saveUsage(u: LauncherUsage): void {
  try { localStorage.setItem(USAGE_KEY, JSON.stringify(u)) } catch { /* not kept */ }
}

/** Pages opened by a command show in the main window */
function Forwarder() {
  const location = useLocation()
  const navigate = useNavigate()
  useEffect(() => {
    if (location.pathname === HERE) return
    toMain({ kind: 'navigate', path: location.pathname + location.search })
    navigate(HERE, { replace: true })
  }, [location, navigate])
  return null
}

/** The palette's commands run scripts through the console: here it is the main window's */
function ConsoleBridge({ children }: { children: ReactNode }) {
  const value = useMemo<ConsoleContextValue>(() => ({
    visible: false, minimized: false, label: '', taskId: null, logs: [], result: null, projectPath: null, isCreation: false, projectId: null,
    startCreation: async () => {},
    runScript: async (projectPath, script, pm, name) => { await toMain({ kind: 'script', projectPath, script, pm, name }) },
    runTask: async () => '',
    cancelTask: () => {}, hide: () => {}, setMinimized: () => {}, openFolder: () => {}, openVSCode: () => {}
  }), [])
  return <ConsoleContext.Provider value={value}>{children}</ConsoleContext.Provider>
}

export default function Launcher() {
  // Each opening starts afresh: empty query, data read again
  const [round, setRound] = useState(0)
  useEffect(() => window.devforge.launcher.onShown(() => setRound(r => r + 1)), [])
  useEffect(() => { window.devforge.getSettings().then(applyAppearance).catch(() => {}) }, [round])
  return (
    <MemoryRouter initialEntries={[HERE]}>
      <Forwarder />
      <ConsoleBridge>
        <LauncherBody key={round} />
      </ConsoleBridge>
    </MemoryRouter>
  )
}

type Item =
  | { type: 'answer'; id: string; answer: QuickAnswer }
  | { type: 'command'; id: string; command: Command }
  | { type: 'forgy'; id: string }

const ANSWER_ICON: Record<AnswerKind, typeof Calculator> = { calc: Calculator, timestamp: Clock, date: Clock, base64: Hash, color: Palette }

function LauncherBody() {
  const { t } = useI18n()
  const l = t.launcher
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const [pending, setPending] = useState<string | null>(null)
  const [status, setStatus] = useState<{ tone: 'busy' | 'ok' | 'error'; text: string } | null>(null)
  const [shortcut, setShortcut] = useState<string | null>(null)
  const [usage, setUsage] = useState(readUsage)
  const listRef = useRef<HTMLDivElement>(null)
  const commands = useCommands(true)

  useEffect(() => { window.devforge.launcher.state().then(s => setShortcut(s.shortcut)).catch(() => {}) }, [])

  const items = useMemo<Item[]>(() => {
    const usable = commands.filter(c => !MAIN_ONLY.has(c.id))
    const answers: Item[] = quickAnswers(q).map((a, i) => ({ type: 'answer', id: `answer:${i}`, answer: a }))
    const found: Item[] = rankEntries(usable, q, usage).slice(0, MAX_RESULTS).map(c => ({ type: 'command', id: c.id, command: c }))
    return [...answers, ...found, ...(q.trim() ? [{ type: 'forgy' as const, id: 'forgy' }] : [])]
  }, [commands, q, usage])

  useEffect(() => { setSel(0); setPending(null) }, [q])
  useEffect(() => { listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }) }, [sel])

  const finish = useCallback((text: string) => {
    setStatus({ tone: 'ok', text })
    setTimeout(() => { hide() }, 600)
  }, [])

  async function choose(item: Item) {
    if (item.type === 'answer') {
      await navigator.clipboard.writeText(item.answer.value).catch(() => {})
      finish(l.copied.replace('{value}', item.answer.value))
      return
    }
    if (item.type === 'forgy') { await toMain({ kind: 'ask', text: q.trim() }); return }
    const c = item.command
    if (c.confirm && pending !== c.id) { setPending(c.id); return }
    const next = recordUse(usage, c.id)
    setUsage(next)
    saveUsage(next)
    try {
      const result = c.run()
      if (result instanceof Promise) {
        setStatus({ tone: 'busy', text: l.running.replace('{title}', c.title) })
        await result
        finish(l.done.replace('{title}', c.title))
      } else {
        // Opened something (an editor, a folder, a page): the launcher steps aside
        hide()
      }
    } catch (err) {
      setPending(null)
      setStatus({ tone: 'error', text: l.failed.replace('{error}', String(err instanceof Error ? err.message : err).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')) })
    }
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { e.preventDefault(); if (pending) setPending(null); else hide() }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(s + 1, items.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(s => Math.max(s - 1, 0)) }
    else if (e.key === 'Tab' && q.trim()) { e.preventDefault(); setSel(items.length - 1) }
    else if (e.key === 'Enter' && items[sel]) { e.preventDefault(); choose(items[sel]) }
  }

  return (
    <div className="flex h-full items-start justify-center p-3">
      <div className="ln-card flex max-h-full w-full flex-col overflow-hidden rounded-2xl">
        <div className="flex items-center gap-3 border-b border-line-subtle px-4 py-3">
          <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-accent font-bold text-accent-fg">D</span>
          <input
            autoFocus
            role="combobox"
            aria-expanded={items.length > 0}
            aria-controls="launcher-results"
            aria-activedescendant={items[sel] ? `ln-${sel}` : undefined}
            aria-label={l.placeholder}
            placeholder={l.placeholder}
            value={q}
            onChange={e => { setQ(e.target.value); setStatus(null) }}
            onKeyDown={onKey}
            spellCheck={false}
            className="min-w-0 flex-1 bg-transparent text-lg text-fg outline-none placeholder:text-fg-muted"
          />
          {shortcut && <kbd className="shrink-0 rounded-md border border-line px-1.5 py-0.5 font-mono text-[11px] text-fg-secondary">{shortcut.replace(/\+/g, ' + ')}</kbd>}
        </div>

        <div ref={listRef} id="launcher-results" role="listbox" aria-label={l.results} className="min-h-0 flex-1 overflow-y-auto p-2">
          {!q.trim() && items.length > 0 && <p className="px-3 pt-1 pb-2 font-mono text-[10.5px] tracking-widest text-fg-secondary uppercase">{l.recent}</p>}
          {items.length === 0 && <p className="px-3 py-6 text-center text-sm text-fg-secondary">{q.trim() ? l.noResults : l.empty}</p>}
          {items.map((item, i) => {
            const active = i === sel
            const base = cn('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left', active ? 'bg-active' : 'hover:bg-hover')
            const props = { id: `ln-${i}`, role: 'option', 'aria-selected': active, onMouseEnter: () => setSel(i), onClick: () => choose(item), className: base }
            if (item.type === 'answer') {
              const Icon = ANSWER_ICON[item.answer.kind]
              return (
                <div key={item.id} {...props}>
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
                    {item.answer.kind === 'color' ? <span className="size-4 rounded-full border border-line" style={{ background: item.answer.value.startsWith('#') ? item.answer.value : item.answer.detail.startsWith('#') ? item.answer.detail : undefined }} /> : <Icon size={15} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-mono text-base text-fg">{item.answer.value}</span>
                    <span className="block truncate text-xs text-fg-secondary">{l.kinds[item.answer.kind]} · {item.answer.detail}</span>
                  </span>
                  {active && <span className="flex items-center gap-1 text-xs text-fg-secondary"><Copy size={12} /> {l.copy}</span>}
                </div>
              )
            }
            if (item.type === 'forgy') {
              return (
                <div key={item.id} {...props}>
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-forgy-soft text-forgy"><Bot size={15} /></span>
                  <span className="min-w-0 flex-1 truncate text-fg">{l.askForgy.replace('{q}', q.trim())}</span>
                  <kbd className="rounded border border-line px-1 font-mono text-[10.5px] text-fg-secondary">Tab</kbd>
                </div>
              )
            }
            const c = item.command
            const Icon = c.icon
            return (
              <div key={item.id} {...props}>
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-elevated" style={{ color: c.color }}><Icon size={15} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-fg">{c.title}</span>
                  {pending === c.id
                    ? <span className="block text-xs text-warning">{l.confirmAgain.replace('{text}', c.confirm ?? '')}</span>
                    : c.subtitle && <span className="block truncate font-mono text-xs text-fg-secondary">{c.subtitle}</span>}
                </span>
                <span className="shrink-0 text-xs text-fg-secondary">{c.group}</span>
              </div>
            )
          })}
        </div>

        <div className="flex items-center gap-4 border-t border-line-subtle px-4 py-2 text-xs text-fg-secondary">
          {status ? (
            <span role="status" className={cn('flex min-w-0 flex-1 items-center gap-1.5 truncate', status.tone === 'error' ? 'text-danger' : status.tone === 'ok' ? 'text-success' : '')}>
              {status.tone === 'busy' ? <Loader2 size={12} className="animate-spin" /> : status.tone === 'ok' ? <Check size={12} /> : <X size={12} />}{status.text}
            </span>
          ) : (
            <>
              <span><kbd className="font-mono">↑↓</kbd> {l.hintChoose}</span>
              <span><kbd className="font-mono">{l.enter}</kbd> {l.hintRun}</span>
              <span className="ml-auto"><kbd className="font-mono">{l.escape}</kbd> {l.hintClose}</span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

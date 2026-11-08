import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronDown, Plus, X } from 'lucide-react'
import type { SSHConnection, TerminalShell } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { cn } from '@renderer/lib/cn'
import StatusDot from '@renderer/components/ui/StatusDot'
import BlockTerminal from './BlockTerminal'
import { localBackend, sshBackend, type ShellBackend } from './backends'

interface Tab {
  key: number
  label: string
  language: string
  /** Remade on "restart" */
  make: () => ShellBackend
  backend: ShellBackend
  /** The project script this tab runs, by name */
  script?: string
  /** Its command, run once the shell is ready */
  autoRun?: string
}

/** A script to run or stop, sent by the project page; `seq` changes on each request */
export interface ScriptRequest { seq: number; action: 'run' | 'stop'; name: string; cmd: string }

let tabCounter = 0

function newTab(label: string, language: string, make: () => ShellBackend): Tab {
  return { key: ++tabCounter, label, language, make, backend: make() }
}

const LANGUAGE: Record<TerminalShell['kind'], string> = { powershell: 'PowerShell', pwsh: 'PowerShell', gitbash: 'Bash', cmd: 'Batch' }

/**
 * Shells side by side: local ones in `cwd`, or a server over SSH. Each tab
 * keeps its shell while hidden.
 */
export default function TerminalTabs({ cwd, className, withSsh = true, onEmpty, onHide, request, onScripts, variant = 'dock' }: {
  cwd: string
  className?: string
  withSsh?: boolean
  /** The last tab was closed (the dock closes) */
  onEmpty?: () => void
  /** A "Hide" button at the right of the tabs; the shells live on */
  onHide?: () => void
  /** A script to run in its own tab, or to stop */
  request?: ScriptRequest | null
  /** The project's scripts open in a tab: when each started, null when it waits */
  onScripts?: (runs: Record<string, number | null>) => void
  /** `page`: the project page's look (the mock-up's): the tabs above a framed terminal */
  variant?: 'dock' | 'page'
}) {
  const page = variant === 'page'
  const { t } = useI18n()
  const s = t.terminal
  const [shells, setShells] = useState<TerminalShell[]>([])
  const [servers, setServers] = useState<SSHConnection[]>([])
  const [tabs, setTabs] = useState<Tab[]>([])
  const [active, setActive] = useState<number | null>(null)
  const [menu, setMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  /** Since when each tab's command runs (null: it waits) */
  const [busy, setBusy] = useState<Record<number, number | null>>({})
  const controls = useRef<Record<number, { run: (cmd: string) => void; interrupt: () => void }>>({})
  const onBusy = useCallback((key: number, since: number | null) => setBusy(b => (b[key] === since ? b : { ...b, [key]: since })), [])

  const addLocal = (sh: TerminalShell) => {
    const tab = newTab(sh.label, LANGUAGE[sh.kind], () => localBackend(sh.kind, cwd))
    setTabs(list => [...list, tab])
    setActive(tab.key)
  }
  const addSsh = (c: SSHConnection) => {
    const tab = newTab(c.name, 'Bash', () => sshBackend(c.id))
    setTabs(list => [...list, tab])
    setActive(tab.key)
  }

  // A first PowerShell on arrival
  useEffect(() => {
    let alive = true
    window.devforge.terminal.shells().then(list => {
      if (!alive) return
      setShells(list.filter(x => x.available))
      const first = list.find(x => x.available)
      if (first) setTabs(prev => {
        if (prev.length) return prev
        const tab = newTab(first.label, LANGUAGE[first.kind], () => localBackend(first.kind, cwd))
        setActive(tab.key)
        return [tab]
      })
    }).catch(() => {})
    if (withSsh) window.devforge.getSshConnections().then(l => { if (alive) setServers(l) }).catch(() => {})
    return () => { alive = false }
  }, [cwd, withSsh])

  const handled = useRef(0)
  useEffect(() => {
    if (!request || request.seq === handled.current || !shells.length) return
    handled.current = request.seq
    const tab = tabs.find(x => x.script === request.name)
    if (request.action === 'stop') { if (tab) controls.current[tab.key]?.interrupt(); return }
    if (tab) {
      setActive(tab.key)
      if (busy[tab.key] == null) controls.current[tab.key]?.run(request.cmd)
      return
    }
    const sh = shells[0]
    const made: Tab = { ...newTab(request.name, LANGUAGE[sh.kind], () => localBackend(sh.kind, cwd)), script: request.name, autoRun: request.cmd }
    setTabs(list => [...list, made])
    setActive(made.key)
  }, [request, shells, tabs, busy, cwd])

  // The page follows its scripts
  useEffect(() => {
    onScripts?.(Object.fromEntries(tabs.filter(x => x.script).map(x => [x.script!, busy[x.key] ?? null])))
  }, [tabs, busy, onScripts])

  useEffect(() => {
    if (!menu) return
    const close = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenu(false) }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [menu])

  function closeTab(key: number) {
    const next = tabs.filter(x => x.key !== key)
    setTabs(next)
    delete controls.current[key]
    setBusy(b => { const { [key]: _gone, ...rest } = b; return rest })
    if (active === key) setActive(next[next.length - 1]?.key ?? null)
    if (!next.length) onEmpty?.()
  }

  function restart(key: number) {
    setTabs(list => list.map(x => x.key === key ? { ...x, key: ++tabCounter, backend: x.make() } : x))
    setActive(tabCounter)
  }

  const items = tabs

  return (
    <div className={cn('flex min-h-0 flex-col', className)}>
      <div role="toolbar" aria-label={s.tabsLabel}
        className={cn('flex shrink-0 items-center gap-1', page ? 'mb-2.5 flex-wrap' : 'border-b border-line-subtle bg-chrome px-2')}>
        {items.map(tab => (
          <div key={tab.key} className={cn('group flex items-center', page ? 'rounded-[9px]' : 'rounded-t-lg', active === tab.key && (page ? 'bg-elevated' : 'bg-term'))}>
            <button aria-pressed={active === tab.key} onClick={() => setActive(tab.key)}
              className={cn('flex items-center gap-1.5 px-3', page ? 'h-8 text-sm' : 'h-8 text-xs font-medium', active === tab.key ? cn('text-fg', page && 'font-semibold') : 'text-fg-secondary hover:text-fg')}>
              {busy[tab.key] != null && <StatusDot state="on" live />}{tab.label}
            </button>
            <button aria-label={s.closeTab.replace('{name}', tab.label)} onClick={() => closeTab(tab.key)} className="mr-1 rounded p-0.5 text-fg-secondary hover:bg-hover hover:text-fg">
              <X size={11} />
            </button>
          </div>
        ))}
        <div ref={menuRef} className="relative">
          <button aria-label={s.newTab} title={s.newTab} aria-expanded={menu} onClick={() => setMenu(m => !m)} className="flex size-7 items-center justify-center rounded-md text-fg-secondary hover:bg-hover hover:text-fg">
            <Plus size={13} />
          </button>
          {menu && (
            <div role="menu" className="absolute top-full left-0 z-30 mt-1 min-w-[200px] rounded-xl border border-line bg-surface p-1 shadow-lg">
              {shells.map(sh => (
                <button key={sh.kind} role="menuitem" onClick={() => { addLocal(sh); setMenu(false) }} className="block w-full rounded-lg px-3 py-1.5 text-left text-sm text-fg hover:bg-hover">{sh.label}</button>
              ))}
              {servers.length > 0 && <div className="my-1 border-t border-line-subtle" />}
              {servers.map(c => (
                <button key={c.id} role="menuitem" onClick={() => { addSsh(c); setMenu(false) }} className="block w-full rounded-lg px-3 py-1.5 text-left text-sm text-fg hover:bg-hover">
                  SSH · {c.name}
                </button>
              ))}
            </div>
          )}
        </div>
        {page && <span className="ml-auto truncate font-mono text-xs text-fg-muted" title={cwd}>{cwd}</span>}
        {onHide && (
          <button onClick={onHide} title={s.hide + ' (Ctrl+`)'} className="ml-auto flex h-7 items-center gap-1 rounded-md px-2 text-xs text-fg-secondary hover:bg-hover hover:text-fg">
            <ChevronDown size={13} aria-hidden /> {s.hide}
          </button>
        )}
      </div>
      <div className={cn('relative min-h-0 flex-1', page && 'overflow-hidden rounded-xl border border-line-subtle bg-term')}>
        {items.length === 0 && <p className="p-4 text-sm text-fg-secondary">{s.noTab}</p>}
        {items.map(tab => (
          <div key={tab.key} role="group" aria-label={tab.label} className={cn('absolute inset-0 flex flex-col', active !== tab.key && 'invisible')}>
            <BlockTerminal backend={tab.backend} shellLabel={tab.label} snippetLanguage={tab.language} onRestart={() => restart(tab.key)} className="h-full"
              autoRun={tab.autoRun} onControl={c => { controls.current[tab.key] = c }} onBusy={since => onBusy(tab.key, since)} />
          </div>
        ))}
      </div>
    </div>
  )
}

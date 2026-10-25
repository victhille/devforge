import { useEffect, useRef, useState } from 'react'
import { Plus, X } from 'lucide-react'
import type { SSHConnection, TerminalShell } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { cn } from '@renderer/lib/cn'
import BlockTerminal from './BlockTerminal'
import { localBackend, sshBackend, type ShellBackend } from './backends'

interface Tab {
  key: number
  label: string
  language: string
  /** Remade on "restart" */
  make: () => ShellBackend
  backend: ShellBackend
}

let tabCounter = 0

function newTab(label: string, language: string, make: () => ShellBackend): Tab {
  return { key: ++tabCounter, label, language, make, backend: make() }
}

const LANGUAGE: Record<TerminalShell['kind'], string> = { powershell: 'PowerShell', pwsh: 'PowerShell', gitbash: 'Bash', cmd: 'Batch' }

/**
 * Shells side by side: local ones in `cwd`, or a server over SSH. Each tab
 * keeps its shell while hidden.
 */
export default function TerminalTabs({ cwd, className, withSsh = true }: { cwd: string; className?: string; withSsh?: boolean }) {
  const { t } = useI18n()
  const s = t.terminal
  const [shells, setShells] = useState<TerminalShell[]>([])
  const [servers, setServers] = useState<SSHConnection[]>([])
  const [tabs, setTabs] = useState<Tab[]>([])
  const [active, setActive] = useState<number | null>(null)
  const [menu, setMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    if (!menu) return
    const close = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenu(false) }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [menu])

  function closeTab(key: number) {
    setTabs(list => {
      const next = list.filter(x => x.key !== key)
      if (active === key) setActive(next[next.length - 1]?.key ?? null)
      return next
    })
  }

  function restart(key: number) {
    setTabs(list => list.map(x => x.key === key ? { ...x, key: ++tabCounter, backend: x.make() } : x))
    setActive(tabCounter)
  }

  const items = tabs

  return (
    <div className={cn('flex min-h-0 flex-col', className)}>
      <div role="toolbar" aria-label={s.tabsLabel} className="flex shrink-0 items-center gap-1 border-b border-line-subtle bg-chrome px-2">
        {items.map(tab => (
          <div key={tab.key} className={cn('group flex items-center rounded-t-lg', active === tab.key ? 'bg-[#090B10]' : '')}>
            <button aria-pressed={active === tab.key} onClick={() => setActive(tab.key)}
              className={cn('h-8 px-3 text-xs font-medium', active === tab.key ? 'text-fg' : 'text-fg-secondary hover:text-fg')}>{tab.label}</button>
            <button aria-label={s.closeTab.replace('{name}', tab.label)} onClick={() => closeTab(tab.key)} className="mr-1 rounded p-0.5 text-fg-secondary hover:bg-hover hover:text-fg">
              <X size={11} />
            </button>
          </div>
        ))}
        <div ref={menuRef} className="relative">
          <button aria-label={s.newTab} aria-expanded={menu} onClick={() => setMenu(m => !m)} className="flex size-7 items-center justify-center rounded-md text-fg-secondary hover:bg-hover hover:text-fg">
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
      </div>
      <div className="relative min-h-0 flex-1">
        {items.length === 0 && <p className="p-4 text-sm text-fg-secondary">{s.noTab}</p>}
        {items.map(tab => (
          <div key={tab.key} role="group" aria-label={tab.label} className={cn('absolute inset-0 flex flex-col', active !== tab.key && 'invisible')}>
            <BlockTerminal backend={tab.backend} shellLabel={tab.label} snippetLanguage={tab.language} onRestart={() => restart(tab.key)} className="h-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

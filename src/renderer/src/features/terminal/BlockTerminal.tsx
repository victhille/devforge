import { useEffect, useMemo, useRef, useState } from 'react'
import type { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { Bookmark, Bot, Check, ChevronDown, ChevronRight, Copy, RotateCcw, Square, X } from 'lucide-react'
import type { TerminalHistoryEntry } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useToast } from '@renderer/app/ToastContext'
import { useAssistant } from '@renderer/features/assistant/AssistantContext'
import { cn } from '@renderer/lib/cn'
import IconButton from '@renderer/components/ui/IconButton'
import Spinner from '@renderer/components/ui/Spinner'
import Button from '@renderer/components/ui/Button'
import type { ShellBackend } from './backends'
import { useBlockShell, type Block } from './useBlockShell'
import { lineText } from './snapshot'
import '@xterm/xterm/css/xterm.css'

const SHOWN_LINES = 300
const duration = (ms: number) => ms < 1000 ? `${ms} ms` : ms < 60_000 ? `${(ms / 1000).toFixed(1).replace('.', ',')} s` : `${Math.floor(ms / 60_000)} min ${Math.round(ms % 60_000 / 1000)} s`
const blockText = (b: Block) => (b.lines ?? []).map(lineText).join('\n')

/** Adds a snippet to the Snippets page (same storage) */
function saveSnippet(title: string, code: string, language: string): void {
  try {
    const list = JSON.parse(localStorage.getItem('devforge:snippets') || '[]') as unknown[]
    list.unshift({ id: crypto.randomUUID(), title, language, code, tags: ['terminal'], createdAt: new Date().toISOString() })
    localStorage.setItem('devforge:snippets', JSON.stringify(list))
  } catch { /* storage full or off */ }
}

interface Props {
  backend: ShellBackend
  /** "PowerShell", "Git Bash", "VPS Prod"… */
  shellLabel: string
  /** Language of the snippets made from a block */
  snippetLanguage: string
  onRestart: () => void
  className?: string
}

export default function BlockTerminal({ backend, shellLabel, snippetLanguage, onRestart, className }: Props) {
  const { t } = useI18n()
  const s = t.terminal
  const toast = useToast()
  const { ask } = useAssistant()
  const shell = useBlockShell(backend)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set())

  // Follows the output, unless the user scrolled up to read
  const stick = useRef(true)
  useEffect(() => {
    const el = scrollRef.current
    if (el && stick.current) el.scrollTop = el.scrollHeight
  })

  function explain(b: Block) {
    const out = blockText(b).slice(-3500)
    ask(s.explainPrompt.replace('{cmd}', b.cmd).replace('{code}', String(b.code ?? '?')).replace('{cwd}', b.cwd || '—').replace('{shell}', shellLabel) + `\n\n\`\`\`\n${out}\n\`\`\``)
  }

  return (
    <div className={cn('flex min-h-0 flex-col bg-[#090B10]', className)}>
      <div ref={scrollRef} role="log" aria-label={s.blocksLabel} tabIndex={0}
        onScroll={e => { const el = e.currentTarget; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40 }}
        className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3">
        {shell.state === 'starting' && <p className="flex items-center gap-2 text-sm text-fg-secondary"><Spinner /> {s.starting.replace('{shell}', shellLabel)}</p>}
        {shell.blocks.length === 0 && shell.state === 'ready' && <p className="text-sm text-fg-secondary">{s.empty}</p>}
        {shell.blocks.map(b => b.endedAt === null
          ? <LiveBlock key={b.id} block={b} term={shell.live} onKeys={shell.send} onResize={shell.resize} onStop={shell.interrupt} />
          : (
            <DoneBlock key={b.id} block={b} collapsed={collapsed.has(b.id)}
              onToggle={() => setCollapsed(c => { const n = new Set(c); if (n.has(b.id)) n.delete(b.id); else n.add(b.id); return n })}
              onCopy={() => { navigator.clipboard.writeText(blockText(b)).catch(() => {}); toast.show({ tone: 'success', title: s.copied }) }}
              onRerun={() => shell.run(b.cmd)} rerunDisabled={shell.state !== 'ready'}
              onExplain={() => explain(b)}
              onSnippet={() => { saveSnippet(b.cmd.slice(0, 60), b.cmd, snippetLanguage); toast.show({ tone: 'success', title: s.snippetSaved }) }} />
          ))}
        {shell.state === 'exited' && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line-subtle p-3 text-sm text-fg-secondary">
            <span className="flex-1">{s.exited.replace('{shell}', shellLabel)}</span>
            <Button size="sm" variant="secondary" onClick={onRestart}><RotateCcw size={13} /> {s.restart}</Button>
          </div>
        )}
      </div>
      <InputBar shell={shell} historyKey={backend.historyKey} shellLabel={shellLabel} onAsk={q => ask(q)} />
    </div>
  )
}

// ─── A finished block ─────────────────────────────────────────────────────────

function DoneBlock({ block: b, collapsed, onToggle, onCopy, onRerun, rerunDisabled, onExplain, onSnippet }: {
  block: Block; collapsed: boolean; onToggle: () => void; onCopy: () => void; onRerun: () => void; rerunDisabled: boolean; onExplain: () => void; onSnippet: () => void
}) {
  const { t } = useI18n()
  const s = t.terminal
  const [all, setAll] = useState(false)
  const failed = b.code !== null && b.code !== 0
  const lines = b.lines ?? []
  const shown = all ? lines : lines.slice(-SHOWN_LINES)
  return (
    <article aria-label={b.cmd} className={cn('overflow-hidden rounded-xl border bg-[#0F1218]', failed ? 'border-danger/50' : 'border-line-subtle')}>
      <header className="flex items-center gap-2 border-b border-line-subtle px-3 py-1.5">
        <IconButton size="sm" title={collapsed ? s.expand : s.collapse} onClick={onToggle}>{collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}</IconButton>
        <span role="img" aria-label={b.code === null ? s.codeUnknown : failed ? s.codeFailed.replace('{code}', String(b.code)) : s.codeOk}
          className={cn('flex size-4 items-center justify-center', failed ? 'text-danger' : b.code === 0 ? 'text-success' : 'text-fg-secondary')}>
          {failed ? <X size={13} /> : b.code === 0 ? <Check size={13} /> : '–'}
        </span>
        <code className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-fg" title={b.cmd}>{b.cmd}</code>
        <span className="shrink-0 font-mono text-[11px] text-fg-secondary">
          {failed ? `${s.code} ${b.code} · ` : ''}{duration((b.endedAt ?? b.startedAt) - b.startedAt)} · {new Date(b.startedAt).toLocaleTimeString().slice(0, 5)}
        </span>
        <IconButton size="sm" title={s.copy} onClick={onCopy}><Copy size={13} /></IconButton>
        <IconButton size="sm" title={s.rerun} onClick={onRerun} disabled={rerunDisabled}><RotateCcw size={13} /></IconButton>
        <IconButton size="sm" title={s.snippet} onClick={onSnippet}><Bookmark size={13} /></IconButton>
        <IconButton size="sm" title={s.explain} onClick={onExplain} className={cn(failed && 'text-forgy')}><Bot size={13} /></IconButton>
      </header>
      {!collapsed && lines.length > 0 && (
        <>
          {!all && lines.length > SHOWN_LINES && (
            <button onClick={() => setAll(true)} className="w-full border-b border-line-subtle px-3 py-1 text-left text-xs text-accent hover:underline">
              {s.showAll.replace('{n}', String(lines.length))}
            </button>
          )}
          <pre className="max-h-[480px] overflow-auto px-3 py-2 font-mono text-[12.5px] leading-[1.45] whitespace-pre-wrap break-words text-[#D4D4D4]">
            {shown.map((l, i) => (
              <div key={i}>{l.length ? l.map((seg, j) => <span key={j} style={{ color: seg.fg, fontWeight: seg.bold ? 600 : undefined }}>{seg.text}</span>) : ' '}</div>
            ))}
          </pre>
        </>
      )}
      {failed && !collapsed && (
        <div className="flex items-center gap-2 border-t border-forgy/20 bg-forgy-soft px-3 py-1.5 text-xs">
          <Bot size={13} className="text-forgy" />
          <span className="flex-1 text-fg-secondary">{s.failedHint}</span>
          <button onClick={onExplain} className="font-medium text-forgy hover:underline">{s.explain}</button>
        </div>
      )}
    </article>
  )
}

// ─── The running block: a real terminal ───────────────────────────────────────

function LiveBlock({ block: b, term, onKeys, onResize, onStop }: {
  block: Block; term: Terminal | null; onKeys: (d: string) => void; onResize: (cols: number, rows: number) => void; onStop: () => void
}) {
  const { t } = useI18n()
  const s = t.terminal
  const host = useRef<HTMLDivElement>(null)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setElapsed(Date.now() - b.startedAt), 1000)
    return () => clearInterval(id)
  }, [b.startedAt])

  useEffect(() => {
    if (!term || !host.current) return
    if (!term.element) term.open(host.current)
    const fit = new FitAddon()
    term.loadAddon(fit)
    const refit = () => { const d = fit.proposeDimensions(); if (d && d.cols > 10) onResize(d.cols, term.rows) }
    refit()
    term.focus()
    const keys = term.onData(onKeys)
    const ro = new ResizeObserver(refit)
    ro.observe(host.current)
    return () => { keys.dispose(); ro.disconnect() }
  }, [term, onKeys, onResize])

  return (
    <article aria-label={b.cmd} aria-busy="true" className="overflow-hidden rounded-xl border border-accent/50 bg-[#0F1218]">
      <header className="flex items-center gap-2 border-b border-line-subtle px-3 py-1.5">
        <Spinner />
        <code className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-fg">{b.cmd}</code>
        <span className="font-mono text-[11px] text-fg-secondary">{s.running} · {duration(elapsed)}</span>
        <Button size="sm" variant="ghost" onClick={onStop}><Square size={11} /> {s.stop}</Button>
      </header>
      <div ref={host} className="h-[340px] px-2 py-1" />
    </article>
  )
}

// ─── Input ────────────────────────────────────────────────────────────────────

function InputBar({ shell, historyKey, shellLabel, onAsk }: {
  shell: ReturnType<typeof useBlockShell>; historyKey: string; shellLabel: string; onAsk: (q: string) => void
}) {
  const { t } = useI18n()
  const s = t.terminal
  const [value, setValue] = useState('')
  const [history, setHistory] = useState<TerminalHistoryEntry[]>([])
  const [cursor, setCursor] = useState<number | null>(null)
  const [searching, setSearching] = useState(false)
  const [pick, setPick] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Read again after each command
  useEffect(() => {
    window.devforge.terminal.history(historyKey).then(setHistory).catch(() => {})
  }, [historyKey, shell.blocks.length, shell.state])
  useEffect(() => { if (shell.state === 'ready') inputRef.current?.focus() }, [shell.state])

  const matches = useMemo(() => {
    const q = value.toLowerCase()
    return [...history].reverse().filter(h => !q || h.cmd.toLowerCase().includes(q)).slice(0, 8)
  }, [history, value])

  function submit(cmd = value) {
    const text = cmd.trim()
    if (!text) return
    if (text.startsWith('#')) { onAsk(text.slice(1).trim()); setValue(''); return }
    shell.run(text)
    setValue('')
    setCursor(null)
    setSearching(false)
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'r' && e.ctrlKey) { e.preventDefault(); setSearching(v => !v); setPick(0); return }
    if (searching) {
      if (e.key === 'Escape') { e.preventDefault(); setSearching(false) }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setPick(p => Math.min(p + 1, matches.length - 1)) }
      else if (e.key === 'ArrowDown') { e.preventDefault(); setPick(p => Math.max(p - 1, 0)) }
      else if (e.key === 'Enter') { e.preventDefault(); if (matches[pick]) { setValue(matches[pick].cmd); setSearching(false) } }
      return
    }
    if (e.key === 'Enter') { e.preventDefault(); submit() }
    else if (e.key === 'ArrowUp' && history.length) {
      e.preventDefault()
      const next = cursor === null ? history.length - 1 : Math.max(0, cursor - 1)
      setCursor(next)
      setValue(history[next].cmd)
    } else if (e.key === 'ArrowDown' && cursor !== null) {
      e.preventDefault()
      const next = cursor + 1
      if (next >= history.length) { setCursor(null); setValue('') } else { setCursor(next); setValue(history[next].cmd) }
    }
  }

  const disabled = shell.state !== 'ready'
  const placeholder = shell.state === 'running' ? s.busy : shell.state === 'starting' ? s.startingShort : shell.state === 'exited' ? s.exitedShort : s.placeholder

  return (
    <div className="relative border-t border-line-subtle bg-[#0F1218] px-3 py-2">
      {searching && (
        <ul role="listbox" aria-label={s.historyLabel} className="absolute right-3 bottom-full left-3 mb-1 flex max-h-72 flex-col-reverse overflow-y-auto rounded-xl border border-line bg-surface p-1 shadow-lg">
          {matches.length === 0 && <li className="px-3 py-2 text-sm text-fg-secondary">{s.historyEmpty}</li>}
          {matches.map((h, i) => (
            <li key={h.cmd} role="option" aria-selected={i === pick} onMouseDown={e => { e.preventDefault(); setValue(h.cmd); setSearching(false) }}
              className={cn('flex cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 font-mono text-[12.5px]', i === pick ? 'bg-active text-fg' : 'text-fg-secondary')}>
              <span className={cn('size-1.5 shrink-0 rounded-full', h.code === 0 ? 'bg-success' : h.code === null ? 'bg-fg-disabled' : 'bg-danger')} aria-hidden />
              <span className="truncate">{h.cmd}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center gap-2 font-mono text-[11px] text-fg-secondary">
        <span className="truncate" title={shell.cwd}>{shell.cwd || '…'}</span>
        <span className="ml-auto shrink-0">{shellLabel}</span>
      </div>
      <input ref={inputRef} value={value} disabled={disabled} onChange={e => { setValue(e.target.value); setCursor(null) }} onKeyDown={onKey}
        aria-label={s.inputLabel} placeholder={placeholder} spellCheck={false} autoComplete="off"
        className="mt-1 w-full bg-transparent font-mono text-[13.5px] text-fg outline-none placeholder:text-fg-secondary disabled:cursor-not-allowed" />
      <div className="mt-1 flex flex-wrap gap-x-4 text-[11px] text-fg-secondary">
        <span><kbd className="font-mono">↑↓</kbd> {s.hintHistory}</span>
        <span><kbd className="font-mono">Ctrl+R</kbd> {s.hintSearch}</span>
        <span><kbd className="font-mono">#</kbd> {s.hintForgy}</span>
      </div>
    </div>
  )
}

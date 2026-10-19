import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowUp, Check, ChevronDown, Copy, ExternalLink, KeyRound, Loader2, Mic, Plus, Square } from 'lucide-react'
import type { AssistantConfig, AssistantEffort, Project } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { cn } from '@renderer/lib/cn'
import { useCopy } from '@renderer/hooks/useCopy'
import { usePersistentState } from '@renderer/hooks/usePersistentState'
import Mascot, { type MascotMood } from '@renderer/features/assistant/Mascot'
import Markdown from '@renderer/features/assistant/Markdown'

type Phase = 'idle' | 'thinking' | 'searching' | 'working' | 'happy' | 'sad'
/** The last question and its answer, as shown on the card */
interface Turn { question: string; text: string; notices: { tone: 'error' | 'info'; text: string }[] }

/** How long Forgy stays happy or sad after an answer */
const REACTION_MS = 2600
/** The window lost focus: collapse unless something is shown (the delay lets a select popup settle) */
const BLUR_COLLAPSE_MS = 200

const money = (usd: number) => (usd === 0 ? '0 $' : usd < 0.01 ? `${(usd * 100).toFixed(2)} ¢` : `${usd.toFixed(2)} $`)
const cleanError = (err: unknown) => String(err instanceof Error ? err.message : err).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')

/** A chip showing `label`, with a native select laid over it (its popup is not clipped by the small window) */
function ChipSelect({ label, title, disabled, children, value, onChange }: {
  label: string; title: string; disabled?: boolean; children: ReactNode; value: string; onChange: (v: string) => void
}) {
  return (
    <label title={title} className={cn('relative flex h-[26px] min-w-0 items-center gap-1 rounded-lg border border-line bg-elevated px-2 text-xs font-medium text-fg-secondary',
      disabled ? 'opacity-50' : 'hover:text-fg')}>
      <span className="truncate">{label}</span>
      <ChevronDown size={11} className="shrink-0" />
      <select value={value} disabled={disabled} onChange={e => onChange(e.target.value)} aria-label={title}
        className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-not-allowed">
        {children}
      </select>
    </label>
  )
}

/**
 * Forgy's desktop widget: a bubble that opens into a one-line prompt. The
 * answer streams into a card above it. Same assistant, budget and history as
 * the app's panel; "Open in DevForge" continues the conversation there.
 */
export default function Widget() {
  const { t } = useI18n()
  const a = t.assistant
  const w = a.widget
  const { copy, isCopied } = useCopy()
  const [open, setOpenState] = useState(false)
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const [running, setRunning] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [status, setStatus] = useState<string | null>(null)
  const [turn, setTurn] = useState<Turn | null>(null)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [cost, setCost] = useState<number | null>(null)
  const [unread, setUnread] = useState(0)
  const [alert, setAlert] = useState(false)
  const [dictateHint, setDictateHint] = useState(false)
  const [config, setConfig] = useState<AssistantConfig | null>(null)
  const [effort, setEffort] = useState<AssistantEffort | 'auto'>('auto')
  const [projects, setProjects] = useState<Project[]>([])
  const [shortcut, setShortcut] = useState<string | null>(null)
  const [projectPath, setProjectPath] = usePersistentState<string | null>('devforge:widget-project', null)
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  // Read from event callbacks
  const idRef = useRef<string | null>(null)
  const openRef = useRef(false)
  const runningRef = useRef(false)
  const turnRef = useRef<Turn | null>(null)
  const errored = useRef(false)
  const needBreak = useRef(false)
  const reaction = useRef<ReturnType<typeof setTimeout>>()
  const typingTimer = useRef<ReturnType<typeof setTimeout>>()
  runningRef.current = running
  turnRef.current = turn

  // The window follows the content, anchored bottom-right by the main process
  useLayoutEffect(() => {
    const el = rootRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect()
      window.devforge.widget.resize(Math.ceil(r.width), Math.ceil(r.height))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    window.devforge.assistant.getConfig().then(c => { setConfig(c); setEffort(c.effort) })
    window.devforge.widget.shortcut().then(setShortcut)
    return () => { clearTimeout(reaction.current); clearTimeout(typingTimer.current) }
  }, [])

  const reset = useCallback(() => {
    idRef.current = null
    setConversationId(null)
    setTurn(null)
    setCost(null)
  }, [])

  const expand = useCallback(() => {
    openRef.current = true
    setOpenState(true)
    setUnread(0)
    setAlert(false)
    window.devforge.assistant.getConfig().then(setConfig)
    window.devforge.getProjects().then(setProjects)
    window.devforge.widget.setOpen(true).then(() => inputRef.current?.focus())
  }, [])

  const collapse = useCallback(() => {
    openRef.current = false
    setOpenState(false)
    setDictateHint(false)
    setTyping(false)
    // A finished answer is done with; one still coming shows a badge when it lands
    if (!runningRef.current) reset()
    window.devforge.widget.setOpen(false)
  }, [reset])

  // Global shortcut, from anywhere
  useEffect(() => window.devforge.widget.onToggle(() => (openRef.current ? collapse() : expand())), [expand, collapse])

  // Clicked elsewhere with nothing to show: back to the bubble
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const onBlur = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        if (document.hasFocus() || !openRef.current || runningRef.current || turnRef.current || inputRef.current?.value.trim()) return
        collapse()
      }, BLUR_COLLAPSE_MS)
    }
    window.addEventListener('blur', onBlur)
    return () => { window.removeEventListener('blur', onBlur); clearTimeout(timer) }
  }, [collapse])

  // Streamed events of the widget's conversation
  useEffect(() => window.devforge.assistant.onEvent(e => {
    if (e.conversationId !== idRef.current) return
    if (e.type === 'text') {
      setPhase('working')
      setStatus(null)
      const sep = needBreak.current ? '\n\n' : ''
      needBreak.current = false
      setTurn(tu => tu && { ...tu, text: tu.text ? tu.text + sep + e.delta : e.delta })
    } else if (e.type === 'tool') {
      setPhase('searching')
      needBreak.current = true
      const label = (a.tools as Record<string, string>)[e.name] ?? e.name
      setStatus(`${label}${e.summary ? ` · ${e.summary}` : ''}…`)
    } else if (e.type === 'tool-done') {
      setPhase('thinking')
    } else if (e.type === 'error') {
      errored.current = true
    } else if (e.type === 'done') {
      setRunning(false)
      setStatus(null)
      setPhase(errored.current ? 'sad' : e.stopped ? 'idle' : 'happy')
      clearTimeout(reaction.current)
      reaction.current = setTimeout(() => setPhase('idle'), REACTION_MS)
      if (!openRef.current) { if (errored.current) setAlert(true); else setUnread(n => n + 1) }
      // The saved conversation is the reference: final text, notices, cost
      window.devforge.assistant.get(e.conversationId).then(c => {
        if (!c || c.id !== idRef.current) return
        setCost(c.cost)
        const lastUser = c.items.map(i => i.kind).lastIndexOf('user')
        const after = c.items.slice(lastUser + 1)
        setTurn(tu => tu && {
          ...tu,
          text: after.flatMap(i => (i.kind === 'assistant' ? [i.text] : [])).join('\n\n'),
          notices: after.flatMap(i => (i.kind === 'notice' ? [{ tone: i.tone, text: i.text === 'No API key' ? a.noKey : i.text }] : []))
        })
      })
    }
  }), [a])

  async function send() {
    const q = input.trim()
    if (!q || running) return
    const isNew = !idRef.current
    const id = idRef.current ?? crypto.randomUUID()
    idRef.current = id
    setConversationId(id)
    errored.current = false
    needBreak.current = false
    clearTimeout(reaction.current)
    setTurn({ question: q, text: '', notices: [] })
    setInput('')
    setTyping(false)
    setDictateHint(false)
    setRunning(true)
    setPhase('thinking')
    setStatus(null)
    try {
      await window.devforge.assistant.send({ conversationId: id, text: q, projectPath, skill: 'chat', ...(isNew && { effort }) })
    } catch (err) {
      setRunning(false)
      setPhase('sad')
      setTurn(tu => tu && { ...tu, notices: [...tu.notices, { tone: 'error', text: cleanError(err) }] })
    }
  }

  function dictate() {
    // Windows voice typing writes into the focused field
    inputRef.current?.focus()
    setDictateHint(true)
  }

  const project = projects.find(p => p.path === projectPath)
  const mood: MascotMood = phase !== 'idle' ? phase : alert ? 'sad' : typing ? 'listening' : 'idle'
  const effortLabel: Record<AssistantEffort | 'auto', string> = { auto: a.effortAuto, low: a.effortLow, medium: a.effortMedium, high: a.effortHigh }

  return (
    <div ref={rootRef} className="wg-root" data-open={open}
      onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); collapse() } }}>
      {!open ? (
        <button className="wg-bubble wg-pop" onClick={expand} data-unread={unread > 0} data-alert={alert}
          aria-label={alert ? `${w.open} — ${w.alert}` : unread ? `${w.open} — ${w.unread.replace('{n}', String(unread))}` : w.open}
          title={alert ? w.alert : unread ? w.unread.replace('{n}', String(unread)) : shortcut ? `${w.open} (${shortcut})` : w.open}>
          {/* Under 60 px: no floating loop at rest (see Mascot.tsx) */}
          <Mascot mood={mood} size={58} />
          {(unread > 0 || alert) && (
            <span className={cn('absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-xs font-bold',
              alert ? 'bg-danger text-white' : 'bg-forgy text-[#1A0E04]')}>
              {alert ? '!' : unread}
            </span>
          )}
        </button>
      ) : (
        <>
          {turn && (
            <div className="wg-card wg-pop flex w-[380px] flex-col gap-2.5 rounded-[18px] px-4 py-3.5 text-base">
              <div className="line-clamp-2 text-sm text-fg-secondary">{turn.question}</div>
              {turn.text && <div className="max-h-[320px] overflow-y-auto pr-1"><Markdown text={turn.text} /></div>}
              {turn.notices.map((n, i) => (
                <div key={i} className={cn('rounded-lg px-3 py-2 text-xs', n.tone === 'error' ? 'bg-danger-soft text-danger' : 'bg-active text-fg-muted')}>{n.text}</div>
              ))}
              {!running && (
                <div className="flex items-center gap-1.5">
                  {turn.text && (
                    <button onClick={() => copy(turn.text)} className="flex h-7 items-center gap-1.5 rounded-lg border border-line bg-elevated px-2.5 text-sm font-medium text-fg hover:bg-hover">
                      {isCopied() ? <Check size={12} className="text-success" /> : <Copy size={12} />} {isCopied() ? w.copied : w.copy}
                    </button>
                  )}
                  <button onClick={() => { window.devforge.widget.openInApp(conversationId); collapse() }}
                    className="flex h-7 items-center gap-1.5 rounded-lg border border-line bg-elevated px-2.5 text-sm font-medium text-fg hover:bg-hover">
                    <ExternalLink size={12} /> {w.openInApp}
                  </button>
                  <button onClick={() => { reset(); inputRef.current?.focus() }} title={w.newQuestion} aria-label={w.newQuestion}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-fg-muted hover:bg-hover hover:text-fg">
                    <Plus size={14} />
                  </button>
                  {cost !== null && <span className="ml-auto font-mono text-xs text-fg-muted">{money(cost)}</span>}
                </div>
              )}
            </div>
          )}

          <div className="wg-card wg-pop flex w-[380px] flex-col gap-2 rounded-[20px] p-2.5">
            <div className="flex items-center gap-2">
              <div className="flex h-[60px] w-[60px] shrink-0 items-center justify-center">
                <Mascot mood={mood} size={56} />
              </div>
              <label className="min-w-0 flex-1">
                <span className="sr-only">{w.label}</span>
                <input ref={inputRef} autoFocus value={input} placeholder={w.placeholder}
                  onChange={e => {
                    setInput(e.target.value)
                    setTyping(true)
                    clearTimeout(typingTimer.current)
                    typingTimer.current = setTimeout(() => setTyping(false), 1500)
                  }}
                  onBlur={() => setTyping(false)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); send() } }}
                  className="h-10 w-full bg-transparent text-md text-fg outline-none placeholder:text-fg-muted" />
              </label>
              {running ? (
                <button onClick={() => idRef.current && window.devforge.assistant.stop(idRef.current)} title={a.stop} aria-label={a.stop}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-line bg-elevated text-fg-secondary hover:text-fg">
                  <Square size={14} />
                </button>
              ) : (
                <button onClick={send} disabled={!input.trim()} title={a.send} aria-label={a.send}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-forgy text-[#1A0E04] transition-opacity disabled:opacity-50">
                  <ArrowUp size={16} />
                </button>
              )}
              <button onClick={dictate} title={w.dictateHint} aria-label={w.dictate}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-line bg-elevated text-fg-secondary hover:text-fg">
                <Mic size={16} />
              </button>
            </div>

            {config && !config.hasKey && (
              <div className="mx-1 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning-soft px-2.5 py-2 text-xs text-warning">
                <KeyRound size={13} className="mt-0.5 shrink-0" />
                <span className="flex-1">{a.noKey}</span>
                <button onClick={() => window.devforge.widget.openInApp(null)} className="shrink-0 underline">{a.openSettings}</button>
              </div>
            )}
            {dictateHint && <p className="px-1.5 text-xs text-fg-muted">{w.dictateHint}</p>}
            {running && !turn?.text && (
              <div className="flex flex-col gap-1.5 px-1.5 pb-1">
                <div className="truncate font-mono text-xs text-forgy">{status ?? a.thinking}</div>
                <div className="wg-shim" style={{ width: '92%' }} />
                <div className="wg-shim" style={{ width: '64%' }} />
              </div>
            )}

            <div className="flex items-center gap-1.5 px-1 pb-0.5">
              <ChipSelect value={effort} onChange={v => setEffort(v as AssistantEffort | 'auto')} label={effortLabel[effort]}
                title={conversationId ? w.effortLocked : w.effortHint} disabled={!!conversationId}>
                {(['auto', 'low', 'medium', 'high'] as const).map(e => <option key={e} value={e}>{effortLabel[e]}</option>)}
              </ChipSelect>
              <ChipSelect value={projectPath ?? ''} onChange={v => setProjectPath(v || null)} title={a.noProject}
                label={project ? w.context.replace('{name}', project.name) : w.noContext}>
                <option value="">{w.noContext}</option>
                {projects.map(p => <option key={p.id} value={p.path}>{p.name}</option>)}
              </ChipSelect>
              {running && <Loader2 size={14} className="shrink-0 animate-spin text-forgy" />}
              <button onClick={collapse} title={w.collapse} aria-label={w.collapse}
                className="ml-auto flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-lg text-fg-muted hover:bg-hover hover:text-fg">
                <ChevronDown size={14} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

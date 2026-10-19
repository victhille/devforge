import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowUp, BookOpen, Bug, Check, ChevronDown, ChevronLeft, Container, Database, ExternalLink, FileText, GitCommitHorizontal, Globe, History, KeyRound,
  Loader2, MessageSquare, Paperclip, Plus, Search, ShieldCheck, Square, Trash2, Wrench, X, XCircle, type LucideIcon
} from 'lucide-react'
import type { AssistantConfig, AssistantConversation, AssistantConversationSummary, AssistantItem, AssistantUsage, Project } from '@shared/types'
import { ASSISTANT_SKILLS, skillById, type AssistantSkill, type AssistantSkillId } from '@shared/data/assistantSkills'
import { useI18n } from '@renderer/i18n/I18nContext'
import { cn } from '@renderer/lib/cn'
import { formatRelative } from '@renderer/lib/format'
import Button from '@renderer/components/ui/Button'
import IconButton from '@renderer/components/ui/IconButton'
import { useAssistant } from './AssistantContext'
import Markdown from './Markdown'
import Mascot from './Mascot'
import AiLaunchers from './AiLaunchers'

const SKILL_ICON: Record<string, LucideIcon> = { MessageSquare, Search, Bug, GitCommitHorizontal, ShieldCheck, BookOpen, Database, Container, Globe }
const MODEL_LABEL: Record<string, string> = {
  'claude-opus-5-5': 'Opus 5.5', 'claude-sonnet-5-5': 'Sonnet 5.5', 'claude-haiku-5-5': 'Haiku 5.5', auto: 'Auto'
}
/** Past this many input tokens per request, a new conversation is much cheaper */
const LONG_CONVERSATION = 30_000

const money = (usd: number) => (usd === 0 ? '0 $' : usd < 0.01 ? `${(usd * 100).toFixed(2)} ¢` : `${usd.toFixed(2)} $`)

function ToolRow({ item }: { item: AssistantItem & { kind: 'tool' } }) {
  const { t } = useI18n()
  const label = (t.assistant.tools as Record<string, string>)[item.name] ?? item.name
  return (
    <div className="flex items-center gap-2 font-mono text-[11px] text-fg-muted">
      {item.status === 'running' ? <Loader2 size={12} className="animate-spin text-accent" />
        : item.status === 'done' ? <Check size={12} className="text-success" /> : <XCircle size={12} className="text-danger" />}
      <Wrench size={11} />
      <span className="shrink-0">{label}</span>
      {item.summary && <span className="truncate font-mono text-fg-secondary">{item.summary}</span>}
    </div>
  )
}

export default function AssistantPanel() {
  const { t, lang } = useI18n()
  const a = t.assistant
  const l = lang === 'fr' ? 'fr' : 'en'
  const navigate = useNavigate()
  const { setOpen, pageContext, projectPath, setProjectPath, mood, markSending, setTyping, pendingConversation, clearPendingConversation } = useAssistant()
  const typingTimer = useRef<ReturnType<typeof setTimeout>>()
  const [config, setConfig] = useState<AssistantConfig | null>(null)
  const [usage, setUsage] = useState<AssistantUsage | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [conversation, setConversation] = useState<AssistantConversation | null>(null)
  const [items, setItems] = useState<AssistantItem[]>([])
  const [skillId, setSkillId] = useState<AssistantSkillId>('chat')
  const [running, setRunning] = useState(false)
  const [input, setInput] = useState('')
  const [attachPage, setAttachPage] = useState(true)
  const [history, setHistory] = useState<AssistantConversationSummary[] | null>(null)
  const [launchers, setLaunchers] = useState(false)
  const [showAllSkills, setShowAllSkills] = useState(false)
  const idRef = useRef<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const refreshUsage = useCallback(() => window.devforge.assistant.usage().then(setUsage), [])
  useEffect(() => {
    window.devforge.assistant.getConfig().then(setConfig)
    window.devforge.getProjects().then(setProjects)
    refreshUsage()
  }, [refreshUsage])

  // A new page context is attached by default
  useEffect(() => { setAttachPage(true) }, [pageContext?.label])

  const load = useCallback(async (id: string) => {
    const c = await window.devforge.assistant.get(id)
    if (!c) return
    idRef.current = c.id
    setConversation(c)
    setItems(c.items)
    setSkillId(c.skill)
    if (c.projectPath) setProjectPath(c.projectPath)
    setHistory(null)
  }, [setProjectPath])

  // A conversation started in the desktop widget, continued here
  useEffect(() => {
    if (!pendingConversation) return
    clearPendingConversation()
    load(pendingConversation)
  }, [pendingConversation, clearPendingConversation, load])

  // Streamed events of the shown conversation
  useEffect(() => window.devforge.assistant.onEvent(e => {
    if (e.conversationId !== idRef.current) return
    if (e.type === 'text') {
      setItems(list => {
        const last = list[list.length - 1]
        return last?.kind === 'assistant'
          ? [...list.slice(0, -1), { ...last, text: last.text + e.delta }]
          : [...list, { kind: 'assistant', text: e.delta }]
      })
    } else if (e.type === 'tool') {
      setItems(list => [...list, { kind: 'tool', id: e.id, name: e.name, summary: e.summary, status: 'running' }])
    } else if (e.type === 'tool-done') {
      setItems(list => list.map(i => (i.kind === 'tool' && i.id === e.id ? { ...i, status: e.ok ? 'done' : 'error' } : i)))
    } else if (e.type === 'done') {
      setRunning(false)
      // The saved version is the reference (notices, cost)
      window.devforge.assistant.get(e.conversationId).then(c => {
        if (c && idRef.current === c.id) { setConversation(c); setItems(c.items) }
      })
      refreshUsage()
    }
  }), [refreshUsage])

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }) }, [items])

  async function send(text = input, skill: AssistantSkillId = skillId) {
    const q = text.trim()
    if (!q || running) return
    const id = idRef.current ?? crypto.randomUUID()
    idRef.current = id
    const ctx = attachPage ? pageContext : null
    setItems(list => [...list, { kind: 'user', text: q, context: ctx ? [ctx.label] : [] }])
    setInput('')
    setTyping(false)
    setRunning(true)
    markSending()
    try {
      await window.devforge.assistant.send({ conversationId: id, text: q, projectPath, pageContext: ctx, skill })
    } catch (err) {
      setRunning(false)
      setItems(list => [...list, { kind: 'notice', tone: 'error', text: String(err instanceof Error ? err.message : err).replace(/^Error invoking remote method '[^']+': (Error: )?/, '') }])
    }
  }

  function pickSkill(s: AssistantSkill) {
    setSkillId(s.id)
    if (s.prompt) send(s.prompt[l], s.id)
    else inputRef.current?.focus()
  }

  function newConversation() {
    idRef.current = null
    setConversation(null)
    setItems([])
    setSkillId('chat')
    setHistory(null)
  }

  async function openHistory() {
    setHistory(history ? null : await window.devforge.assistant.list())
  }

  const project = projects.find(p => p.path === projectPath)
  const skill = skillById(skillId)
  const started = items.length > 0
  const modelShown = conversation?.model ?? (config?.model === 'auto' ? skill.model : config?.model)
  const available = (s: AssistantSkill) => !(s.needs === 'project' && !project) && !(s.needs === 'page' && !pageContext)
  const longConversation = (conversation?.lastInput ?? 0) > LONG_CONVERSATION

  const effortLabel = !config ? null : config.effort === 'auto' ? a.effortAuto
    : { low: a.effortLow, medium: a.effortMedium, high: a.effortHigh }[config.effort]
  const spentPct = usage && usage.budget > 0 ? Math.min(100, (usage.spent / usage.budget) * 100) : 0
  // Chips under the conversation: tasks this page or project makes possible first
  const chips = [...ASSISTANT_SKILLS]
    .filter(available)
    .sort((x, y) => (y.needs ? 1 : 0) - (x.needs ? 1 : 0))
  const shownChips = showAllSkills ? chips : chips.slice(0, 3)

  return (
    <aside className="flex w-[380px] shrink-0 flex-col border-l border-line-subtle bg-sidebar">
      {/* Header: Forgy, what he is doing, with which model */}
      <div className="flex shrink-0 items-center gap-3 border-b border-line-subtle p-4">
        <Mascot mood={mood} size={60} />
        <div className="min-w-0 flex-1">
          <div className="text-md font-semibold text-fg">{a.mascotName}</div>
          <div className="truncate text-sm text-fg-secondary">
            {[a.moods[mood], modelShown && MODEL_LABEL[modelShown], effortLabel?.toLowerCase()].filter(Boolean).join(' · ')}
          </div>
        </div>
        <span className="flex gap-0.5">
          <IconButton size="sm" title={a.openWith} active={launchers} onClick={() => setLaunchers(v => !v)}><ExternalLink size={14} /></IconButton>
          <IconButton size="sm" title={a.newConversation} onClick={newConversation}><Plus size={14} /></IconButton>
          <IconButton size="sm" title={a.history} active={!!history} onClick={openHistory}><History size={14} /></IconButton>
          <IconButton size="sm" title={a.close} onClick={() => setOpen(false)}><X size={14} /></IconButton>
        </span>
      </div>

      {/* Monthly spending */}
      {usage && (
        <div className="flex shrink-0 items-center gap-2.5 border-b border-line-subtle px-4 py-2.5 font-mono text-[11.5px] text-fg-secondary" title={a.costHint}>
          <span>{conversation ? `${money(conversation.cost)} · ` : ''}{money(usage.spent)}{usage.budget > 0 ? ` / ${usage.budget} $` : ''}</span>
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-line">
            <div className="df-grow h-full rounded-full bg-forgy" style={{ width: `${spentPct}%` }} />
          </div>
          <span>{new Date().toLocaleDateString(l === 'fr' ? 'fr-FR' : 'en-GB', { month: 'short' })}</span>
        </div>
      )}

      {/* "Open with": official AI tools on the user's subscriptions */}
      {launchers && (
        <div className="df-pop shrink-0 border-b border-line-subtle px-4 py-2.5">
          <AiLaunchers projectPath={projectPath} />
        </div>
      )}

      {history ? (
        <div className="flex-1 overflow-y-auto p-2">
          <button onClick={() => setHistory(null)} className="mb-2 flex items-center gap-1 px-2 text-xs text-fg-muted hover:text-fg"><ChevronLeft size={12} /> {a.back}</button>
          {history.length === 0 && <p className="p-4 text-center text-sm text-fg-muted">{a.noHistory}</p>}
          {history.map(h => (
            <div key={h.id} className={cn('group flex items-center gap-2 rounded-lg px-2.5 py-2 hover:bg-hover', h.id === conversation?.id && 'bg-active')}>
              <button onClick={() => load(h.id)} className="flex min-w-0 flex-1 flex-col text-left">
                <span className="truncate text-sm text-fg">{h.title}</span>
                <span className="text-2xs text-fg-muted">{h.projectName ? `${h.projectName} · ` : ''}{formatRelative(h.updatedAt, lang)}</span>
              </button>
              <IconButton size="sm" tone="danger" title={t.common.delete} className="invisible group-hover:visible"
                onClick={async () => { await window.devforge.assistant.remove(h.id); if (h.id === conversation?.id) newConversation(); setHistory(await window.devforge.assistant.list()) }}>
                <Trash2 size={12} />
              </IconButton>
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Conversation */}
          <div ref={scrollRef} className="flex flex-1 flex-col gap-3 overflow-y-auto p-4 text-base leading-relaxed">
            {config && !config.hasKey && (
              <div className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning-soft p-3 text-xs text-warning">
                <KeyRound size={14} className="mt-0.5 shrink-0" />
                <span className="flex-1">{a.noKey}</span>
                <Button size="sm" variant="secondary" onClick={() => navigate('/settings')}>{a.openSettings}</Button>
              </div>
            )}
            {!started && (
              <div className="df-rise flex flex-1 flex-col items-center justify-center gap-3 py-6 text-center">
                <Mascot mood={mood} size={96} />
                <p className="max-w-[260px] text-sm text-fg-secondary">{a.greeting}</p>
              </div>
            )}
            {items.map((item, i) => {
              if (item.kind === 'user') return (
                <div key={i} className="df-rise flex flex-col items-end gap-1">
                  {item.context.length > 0 && (
                    <span className="flex items-center gap-1 text-2xs text-fg-muted"><FileText size={10} /> {item.context.join(' · ')}</span>
                  )}
                  <div className="max-w-[85%] rounded-[12px_12px_4px_12px] bg-active px-3 py-[9px] whitespace-pre-wrap text-fg">{item.text}</div>
                </div>
              )
              if (item.kind === 'assistant') return (
                <div key={i} className="df-rise max-w-[92%] rounded-[12px_12px_12px_4px] border border-line-subtle bg-surface px-3 py-2.5">
                  <Markdown text={item.text} />
                </div>
              )
              if (item.kind === 'tool') return <ToolRow key={i} item={item} />
              return (
                <div key={i} className={cn('rounded-xl px-3 py-2 text-xs', item.tone === 'error' ? 'bg-danger-soft text-danger' : 'bg-active text-fg-muted')}>
                  {item.text === 'No API key' ? a.noKey : item.text}
                </div>
              )
            })}
            {running && items[items.length - 1]?.kind !== 'assistant' && (
              <div className="df-typing flex gap-1 text-xl leading-none text-forgy" aria-label={a.thinking}>
                <span>•</span><span>•</span><span>•</span>
              </div>
            )}
            {longConversation && !running && (
              <div className="flex items-center gap-2 rounded-xl border border-line-subtle bg-canvas p-2.5 text-xs text-fg-muted">
                <span className="flex-1">{a.longConversation}</span>
                <Button size="sm" variant="secondary" onClick={newConversation}>{a.newConversation}</Button>
              </div>
            )}
          </div>

          {/* Tasks, context and input */}
          <div className="flex shrink-0 flex-col gap-2.5 border-t border-line-subtle px-4 pt-3 pb-4">
            <div className="flex flex-wrap gap-1.5">
              {shownChips.map(s => {
                const Icon = SKILL_ICON[s.icon] ?? MessageSquare
                return (
                  <button key={s.id} onClick={() => pickSkill(s)} title={s.description[l]}
                    className={cn('flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors',
                      skillId === s.id ? 'border-forgy/50 bg-forgy-soft text-forgy' : 'border-line bg-surface text-fg-secondary hover:bg-hover hover:text-fg')}>
                    <Icon size={12} /> {s.label[l]}
                  </button>
                )
              })}
              {chips.length > 3 && (
                <button onClick={() => setShowAllSkills(v => !v)} className="h-7 rounded-full px-2 text-xs text-fg-muted hover:text-fg">
                  {showAllSkills ? '−' : `+${chips.length - 3}`}
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <label className="relative flex h-[26px] items-center rounded-lg border border-line bg-elevated pr-1 pl-2.5 text-xs text-fg-secondary">
                <span className="sr-only">{a.noProject}</span>
                <select value={projectPath ?? ''} onChange={e => setProjectPath(e.target.value || null)}
                  className="max-w-[170px] cursor-pointer appearance-none truncate bg-transparent pr-4 outline-none">
                  <option value="">{a.noProject}</option>
                  {projects.map(p => <option key={p.id} value={p.path}>{p.name}</option>)}
                </select>
                <ChevronDown size={11} className="pointer-events-none absolute right-1.5" />
              </label>
              {pageContext && (
                <button onClick={() => setAttachPage(v => !v)} title={attachPage ? a.detachPage : a.attachPage}
                  className={cn('flex h-[26px] max-w-[180px] items-center gap-1 rounded-lg border px-2.5 text-xs transition-colors',
                    attachPage ? 'border-accent/40 bg-accent-soft text-accent' : 'border-line text-fg-muted line-through')}>
                  <Paperclip size={11} className="shrink-0" /> <span className="truncate">{pageContext.label}</span>
                </button>
              )}
            </div>

            <div className="flex items-end gap-2 rounded-xl border border-line bg-canvas py-1.5 pr-1.5 pl-3 focus-within:border-forgy/50" title={a.footer}>
              <textarea
                ref={inputRef}
                value={input}
                aria-label={skill.label[l]}
                onChange={e => {
                  setInput(e.target.value)
                  setTyping(true)
                  clearTimeout(typingTimer.current)
                  typingTimer.current = setTimeout(() => setTyping(false), 1500)
                }}
                onBlur={() => setTyping(false)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                placeholder={skillId === 'chat' ? a.askForgy : `${skill.label[l]}…`}
                rows={Math.min(6, Math.max(1, input.split('\n').length))}
                className="max-h-40 min-h-8 flex-1 resize-none bg-transparent py-1.5 text-base text-fg outline-none placeholder:text-fg-muted"
              />
              {running ? (
                <button title={a.stop} aria-label={a.stop} onClick={() => idRef.current && window.devforge.assistant.stop(idRef.current)}
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-line bg-elevated text-fg hover:bg-hover"><Square size={13} /></button>
              ) : (
                <button title={a.send} aria-label={a.send} disabled={!input.trim()} onClick={() => send()}
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-forgy text-[#1A0E04] transition-[transform,opacity] active:scale-95 disabled:opacity-40"><ArrowUp size={16} strokeWidth={2.4} /></button>
              )}
            </div>
          </div>
        </>
      )}
    </aside>
  )
}

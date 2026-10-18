import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowUp, BookOpen, Bug, Check, ChevronLeft, Container, Database, FileText, GitCommitHorizontal, Globe, History, KeyRound,
  Loader2, MessageSquare, Paperclip, Plus, ShieldCheck, Sparkles, Square, Trash2, Wrench, X, XCircle, type LucideIcon
} from 'lucide-react'
import type { AssistantConfig, AssistantConversation, AssistantConversationSummary, AssistantItem, AssistantUsage, Project } from '@shared/types'
import { ASSISTANT_SKILLS, skillById, type AssistantSkill, type AssistantSkillId } from '@shared/data/assistantSkills'
import { useI18n } from '@renderer/i18n/I18nContext'
import { cn } from '@renderer/lib/cn'
import { formatRelative } from '@renderer/lib/format'
import Button from '@renderer/components/ui/Button'
import IconButton from '@renderer/components/ui/IconButton'
import { Select } from '@renderer/components/ui/Input'
import { useAssistant } from './AssistantContext'
import Markdown from './Markdown'

const SKILL_ICON: Record<string, LucideIcon> = { MessageSquare, Bug, GitCommitHorizontal, ShieldCheck, BookOpen, Database, Container, Globe }
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
    <div className="flex items-center gap-2 rounded-md bg-canvas px-2.5 py-1.5 text-xs text-fg-muted">
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
  const { setOpen, pageContext, projectPath, setProjectPath } = useAssistant()
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
    setRunning(true)
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
  const SkillIcon = SKILL_ICON[skill.icon] ?? MessageSquare
  const started = items.length > 0
  const modelShown = conversation?.model ?? (config?.model === 'auto' ? skill.model : config?.model)
  const available = (s: AssistantSkill) => !(s.needs === 'project' && !project) && !(s.needs === 'page' && !pageContext)
  const longConversation = (conversation?.lastInput ?? 0) > LONG_CONVERSATION

  return (
    <aside className="flex w-[440px] shrink-0 flex-col border-l border-line-subtle bg-surface">
      {/* Header */}
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-line-subtle px-3">
        <Sparkles size={15} className="text-accent" />
        <span className="font-semibold text-fg">{a.title}</span>
        {modelShown && <span className="rounded bg-active px-1.5 py-px text-2xs text-fg-muted">{MODEL_LABEL[modelShown]}</span>}
        <span className="ml-auto flex gap-0.5">
          <IconButton size="sm" title={a.newConversation} onClick={newConversation}><Plus size={14} /></IconButton>
          <IconButton size="sm" title={a.history} active={!!history} onClick={openHistory}><History size={14} /></IconButton>
          <IconButton size="sm" title={a.close} onClick={() => setOpen(false)}><X size={14} /></IconButton>
        </span>
      </div>

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
          {/* Context */}
          <div className="flex shrink-0 flex-col gap-2 border-b border-line-subtle px-3 py-2">
            <Select value={projectPath ?? ''} onChange={e => setProjectPath(e.target.value || null)} className="h-8 text-xs">
              <option value="">{a.noProject}</option>
              {projects.map(p => <option key={p.id} value={p.path}>{p.name}</option>)}
            </Select>
            {pageContext && (
              <button onClick={() => setAttachPage(v => !v)} title={attachPage ? a.detachPage : a.attachPage}
                className={cn('flex items-center gap-1.5 self-start rounded-full border px-2.5 py-0.5 text-xs transition-colors',
                  attachPage ? 'border-accent/40 bg-accent-soft text-accent' : 'border-line-subtle text-fg-muted line-through')}>
                <Paperclip size={11} /> <span className="max-w-[340px] truncate">{pageContext.label}</span>
              </button>
            )}
          </div>

          {/* Conversation */}
          <div ref={scrollRef} className="flex flex-1 flex-col gap-3 overflow-y-auto p-3">
            {config && !config.hasKey && (
              <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning-soft p-3 text-xs text-warning">
                <KeyRound size={14} className="mt-0.5 shrink-0" />
                <span className="flex-1">{a.noKey}</span>
                <Button size="sm" variant="secondary" onClick={() => navigate('/settings')}>{a.openSettings}</Button>
              </div>
            )}
            {!started && (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-fg-muted">{a.pickSkill}</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {ASSISTANT_SKILLS.map(s => {
                    const Icon = SKILL_ICON[s.icon] ?? MessageSquare
                    const ok = available(s)
                    return (
                      <button key={s.id} disabled={!ok} onClick={() => pickSkill(s)}
                        title={!ok ? (s.needs === 'project' ? a.needsProject : a.needsPage) : s.description[l]}
                        className={cn('flex flex-col gap-0.5 rounded-lg border px-2.5 py-2 text-left transition-colors disabled:opacity-40',
                          skillId === s.id ? 'border-accent/50 bg-accent-soft' : 'border-line-subtle hover:border-accent/40 hover:bg-hover')}>
                        <span className="flex items-center gap-1.5 text-xs font-medium text-fg"><Icon size={13} className="text-accent" /> {s.label[l]}</span>
                        <span className="truncate text-2xs text-fg-muted">{s.description[l]}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
            {items.map((item, i) => {
              if (item.kind === 'user') return (
                <div key={i} className="flex flex-col items-end gap-1">
                  {item.context.length > 0 && (
                    <span className="flex items-center gap-1 text-2xs text-fg-muted"><FileText size={10} /> {item.context.join(' · ')}</span>
                  )}
                  <div className="max-w-[90%] rounded-xl rounded-br-sm bg-accent-soft px-3 py-2 text-sm whitespace-pre-wrap text-fg">{item.text}</div>
                </div>
              )
              if (item.kind === 'assistant') return <Markdown key={i} text={item.text} />
              if (item.kind === 'tool') return <ToolRow key={i} item={item} />
              return (
                <div key={i} className={cn('rounded-lg px-3 py-2 text-xs', item.tone === 'error' ? 'bg-danger-soft text-danger' : 'bg-active text-fg-muted')}>
                  {item.text === 'No API key' ? a.noKey : item.text}
                </div>
              )
            })}
            {running && items[items.length - 1]?.kind !== 'assistant' && (
              <div className="flex items-center gap-2 text-xs text-fg-muted"><Loader2 size={12} className="animate-spin" /> {a.thinking}</div>
            )}
            {longConversation && !running && (
              <div className="flex items-center gap-2 rounded-lg border border-line-subtle bg-canvas p-2.5 text-xs text-fg-muted">
                <span className="flex-1">{a.longConversation}</span>
                <Button size="sm" variant="secondary" onClick={newConversation}>{a.newConversation}</Button>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="shrink-0 border-t border-line-subtle p-3">
            <div className="mb-1.5 flex items-center gap-1.5 text-2xs text-fg-muted">
              <SkillIcon size={11} className="text-accent" />
              <span>{skill.label[l]}</span>
              {!started && skillId !== 'chat' && (
                <button onClick={() => setSkillId('chat')} className="hover:text-fg" aria-label={a.resetSkill}><X size={10} /></button>
              )}
            </div>
            <div className="flex items-end gap-2 rounded-xl border border-line bg-canvas p-2 focus-within:border-accent/60">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                placeholder={a.placeholder}
                rows={Math.min(6, Math.max(1, input.split('\n').length))}
                className="max-h-40 flex-1 resize-none bg-transparent px-1 text-sm text-fg outline-none placeholder:text-fg-muted"
              />
              {running ? (
                <IconButton size="sm" title={a.stop} onClick={() => idRef.current && window.devforge.assistant.stop(idRef.current)}><Square size={13} /></IconButton>
              ) : (
                <IconButton size="sm" title={a.send} disabled={!input.trim()} onClick={() => send()} className="bg-accent text-white hover:bg-accent-hover hover:text-white"><ArrowUp size={14} /></IconButton>
              )}
            </div>
            <p className="mt-1.5 flex justify-between gap-2 text-2xs text-fg-muted">
              <span>{a.footer}</span>
              {usage && (
                <span className="shrink-0" title={a.costHint}>
                  {conversation ? `${money(conversation.cost)} · ` : ''}{a.month} {money(usage.spent)}{usage.budget > 0 ? ` / ${usage.budget} $` : ''}
                </span>
              )}
            </p>
          </div>
        </>
      )}
    </aside>
  )
}

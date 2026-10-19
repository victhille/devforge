import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { AssistantPageContext } from '@shared/types'
import { usePersistentState } from '@renderer/hooks/usePersistentState'
import { useToast } from '@renderer/app/ToastContext'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useActiveProject } from '@renderer/hooks/useActiveProject'
import type { MascotMood } from './Mascot'

interface AssistantState {
  open: boolean
  setOpen: (v: boolean | ((o: boolean) => boolean)) => void
  /** What the current page shows (null when the page gives nothing) */
  pageContext: AssistantPageContext | null
  setPageContext: (owner: symbol, ctx: AssistantPageContext | null) => void
  /** Saved project the questions are about */
  projectPath: string | null
  setProjectPath: (p: string | null) => void
  /** What the mascot shows, from the assistant activity */
  mood: MascotMood
  /** A question was just sent: thinking until the first event */
  markSending: () => void
  /** The user is typing in the assistant input */
  setTyping: (typing: boolean) => void
  /** Forgy strolls along the bottom of the window, Boulon the dog with him */
  walker: boolean
  setWalker: (v: boolean) => void
  walkerDog: boolean
  setWalkerDog: (v: boolean) => void
  /** A conversation the desktop widget asked to show, until the panel loads it */
  pendingConversation: string | null
  clearPendingConversation: () => void
}

/** After this long without activity, the mascot falls asleep */
const SLEEP_AFTER = 120_000
/** How long the mascot stays happy or sad after an answer */
const REACTION_MS = 2600

const Ctx = createContext<AssistantState | null>(null)

export function AssistantProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = usePersistentState('devforge:assistant-open', false)
  const [projectPath, setProjectPath] = usePersistentState<string | null>('devforge:assistant-project', null)
  // Forgy follows the active project (the panel can still pick another one)
  const { active } = useActiveProject()
  useEffect(() => { if (active) setProjectPath(active.path) }, [active, setProjectPath])
  const [walker, setWalker] = usePersistentState('devforge:walker', true)
  const [walkerDog, setWalkerDog] = usePersistentState('devforge:walker-dog', true)
  const [page, setPage] = useState<{ owner: symbol; ctx: AssistantPageContext } | null>(null)
  const [phase, setPhase] = useState<'idle' | 'thinking' | 'searching' | 'working' | 'happy' | 'sad'>('idle')
  const [typing, setTypingState] = useState(false)
  const [pendingConversation, setPendingConversation] = useState<string | null>(null)
  const [sleepy, setSleepy] = useState(false)
  const lastActive = useRef(Date.now())
  const errored = useRef(false)
  const reaction = useRef<ReturnType<typeof setTimeout>>()

  const touch = useCallback(() => { lastActive.current = Date.now(); setSleepy(false) }, [])
  const markSending = useCallback(() => { touch(); errored.current = false; clearTimeout(reaction.current); setPhase('thinking') }, [touch])
  const setTyping = useCallback((v: boolean) => { touch(); setTypingState(v) }, [touch])

  // Assistant events drive the mood, panel open or not
  const { show } = useToast()
  const { t } = useI18n()
  const actionTitles = useRef(new Map<string, string>())

  useEffect(() => window.devforge.assistant.onEvent(e => {
    touch()
    if (e.type === 'action') {
      actionTitles.current.set(e.id, e.title)
      // An action waits for a click: show the card
      if (!e.auto) setOpen(true)
    } else if (e.type === 'action-done' && (e.status === 'done' || e.status === 'failed')) {
      // Also lands in the home page's activity log
      const title = actionTitles.current.get(e.id) ?? ''
      show({ tone: e.status === 'done' ? 'success' : 'error', title: (e.status === 'done' ? t.assistant.actionDone : t.assistant.actionFailed).replace('{title}', title) })
    }
    if (e.type === 'text') setPhase('working')
    else if (e.type === 'tool') setPhase('searching')
    else if (e.type === 'tool-done') setPhase('thinking')
    else if (e.type === 'error') errored.current = true
    else if (e.type === 'done') {
      setPhase(errored.current ? 'sad' : e.stopped ? 'idle' : 'happy')
      clearTimeout(reaction.current)
      reaction.current = setTimeout(() => setPhase('idle'), REACTION_MS)
    }
  }), [touch, setOpen, show, t])

  // Background alerts (disk, container, server, site): a toast, and Forgy looks worried a while
  useEffect(() => window.devforge.watch.onAlert(a => {
    touch()
    show({ tone: 'error', title: a.title, description: a.body })
    setPhase('sad')
    clearTimeout(reaction.current)
    reaction.current = setTimeout(() => setPhase('idle'), 8000)
  }), [touch, show])

  useEffect(() => {
    const id = setInterval(() => { if (Date.now() - lastActive.current > SLEEP_AFTER) setSleepy(true) }, 10_000)
    return () => { clearInterval(id); clearTimeout(reaction.current) }
  }, [])

  const mood: MascotMood = phase !== 'idle' ? phase : typing ? 'listening' : sleepy ? 'sleeping' : 'idle'

  // Only the page that set the context can clear it (no race between pages)
  const setPageContext = useCallback((owner: symbol, ctx: AssistantPageContext | null) => {
    setPage(prev => (ctx ? { owner, ctx } : prev?.owner === owner ? null : prev))
  }, [])

  // "Open in DevForge" from the desktop widget
  useEffect(() => window.devforge.assistant.onOpenConversation(id => { setPendingConversation(id); setOpen(true) }), [setOpen])
  const clearPendingConversation = useCallback(() => setPendingConversation(null), [])

  // Ctrl+J toggles the panel from anywhere
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j') { e.preventDefault(); setOpen(o => !o) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setOpen])

  const value = useMemo(() => ({
    open, setOpen, pageContext: page?.ctx ?? null, setPageContext, projectPath, setProjectPath, mood, markSending, setTyping,
    walker, setWalker, walkerDog, setWalkerDog, pendingConversation, clearPendingConversation
  }), [open, setOpen, page, setPageContext, projectPath, setProjectPath, mood, markSending, setTyping, walker, setWalker, walkerDog, setWalkerDog,
    pendingConversation, clearPendingConversation])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAssistant(): AssistantState {
  const c = useContext(Ctx)
  if (!c) throw new Error('useAssistant must be used inside AssistantProvider')
  return c
}

/**
 * Pages call this with what they show; the assistant can attach it to a
 * question. Pass null when there is nothing useful. Cleared on unmount.
 */
export function useAssistantPageContext(ctx: AssistantPageContext | null): void {
  const c = useContext(Ctx)
  const owner = useRef(Symbol('page')).current
  const set = c?.setPageContext
  const label = ctx?.label
  const content = ctx?.content
  useEffect(() => {
    set?.(owner, label && content ? { label, content } : null)
  }, [set, owner, label, content])
  useEffect(() => () => set?.(owner, null), [set, owner])
}

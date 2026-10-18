import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { AssistantPageContext } from '@shared/types'
import { usePersistentState } from '@renderer/hooks/usePersistentState'

interface AssistantState {
  open: boolean
  setOpen: (v: boolean | ((o: boolean) => boolean)) => void
  /** What the current page shows (null when the page gives nothing) */
  pageContext: AssistantPageContext | null
  setPageContext: (owner: symbol, ctx: AssistantPageContext | null) => void
  /** Saved project the questions are about */
  projectPath: string | null
  setProjectPath: (p: string | null) => void
}

const Ctx = createContext<AssistantState | null>(null)

export function AssistantProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = usePersistentState('devforge:assistant-open', false)
  const [projectPath, setProjectPath] = usePersistentState<string | null>('devforge:assistant-project', null)
  const [page, setPage] = useState<{ owner: symbol; ctx: AssistantPageContext } | null>(null)

  // Only the page that set the context can clear it (no race between pages)
  const setPageContext = useCallback((owner: symbol, ctx: AssistantPageContext | null) => {
    setPage(prev => (ctx ? { owner, ctx } : prev?.owner === owner ? null : prev))
  }, [])

  // Ctrl+J toggles the panel from anywhere
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j') { e.preventDefault(); setOpen(o => !o) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setOpen])

  const value = useMemo(() => ({
    open, setOpen, pageContext: page?.ctx ?? null, setPageContext, projectPath, setProjectPath
  }), [open, setOpen, page, setPageContext, projectPath, setProjectPath])

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

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { cn } from '@renderer/lib/cn'

type Tone = 'success' | 'error' | 'info'

interface Toast {
  id: number
  tone: Tone
  title: string
  description?: string
  /** Button under the text; the toast stays longer when it has one */
  action?: { label: string; onClick: () => void }
}

/** A past success or error, shown in the home page's activity card */
export interface ActivityEntry { at: number; tone: Tone; title: string }

interface ToastContextValue {
  show: (toast: Omit<Toast, 'id'>) => void
}

// Separate context: the toast API stays stable while the log changes
const ActivityContext = createContext<ActivityEntry[]>([])

const ACTIVITY_KEY = 'devforge:activity'
const ACTIVITY_MAX = 20

function loadActivity(): ActivityEntry[] {
  try { return JSON.parse(localStorage.getItem(ACTIVITY_KEY) ?? '[]') as ActivityEntry[] } catch { return [] }
}

const ToastContext = createContext<ToastContextValue | null>(null)

const DURATION: Record<Tone, number> = { success: 3500, info: 3500, error: 8000 }
const ICON = { success: CheckCircle2, error: XCircle, info: Info }
const COLOR: Record<Tone, string> = { success: 'text-success', error: 'text-danger', info: 'text-accent' }

let nextId = 1

/** Small stacked notifications in the bottom-right corner. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const [activity, setActivity] = useState<ActivityEntry[]>(loadActivity)

  const dismiss = useCallback((id: number) => setToasts(list => list.filter(t => t.id !== id)), [])

  const show = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = nextId++
    setToasts(list => [...list.slice(-3), { ...toast, id }])
    setTimeout(() => dismiss(id), toast.action ? 10_000 : DURATION[toast.tone])
    // Every notification also lands in the activity log (newest first)
    setActivity(list => {
      const next = [{ at: Date.now(), tone: toast.tone, title: toast.title }, ...list].slice(0, ACTIVITY_MAX)
      try { localStorage.setItem(ACTIVITY_KEY, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }, [dismiss])

  // Stable value: consumers can safely put the toast API in effect deps
  const value = useMemo(() => ({ show }), [show])

  return (
    <ToastContext.Provider value={value}>
      <ActivityContext.Provider value={activity}>{children}</ActivityContext.Provider>
      <div className="pointer-events-none fixed right-5 bottom-5 z-[60] flex w-96 flex-col gap-2">
        {toasts.map(t => {
          const Icon = ICON[t.tone]
          return (
            <div
              key={t.id}
              role="status"
              className="pointer-events-auto flex items-start gap-3 rounded-xl border border-line bg-elevated p-3.5 shadow-pop"
            >
              <Icon size={16} className={cn('mt-0.5 shrink-0', COLOR[t.tone])} />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-fg">{t.title}</p>
                {t.description && (
                  <p tabIndex={0} className="mt-0.5 max-h-28 overflow-y-auto font-mono text-xs whitespace-pre-wrap break-words text-fg-secondary">
                    {t.description}
                  </p>
                )}
                {t.action && (
                  <button onClick={() => { t.action!.onClick(); dismiss(t.id) }} className="mt-1.5 text-sm font-medium text-accent hover:underline">
                    {t.action.label}
                  </button>
                )}
              </div>
              <button onClick={() => dismiss(t.id)} aria-label="Close" className="text-fg-muted hover:text-fg">
                <X size={14} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}

/** Recent notifications, newest first (kept across restarts) */
export function useActivity(): ActivityEntry[] {
  return useContext(ActivityContext)
}

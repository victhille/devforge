import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { cn } from '@renderer/lib/cn'

type Tone = 'success' | 'error' | 'info'

interface Toast {
  id: number
  tone: Tone
  title: string
  description?: string
}

interface ToastContextValue {
  show: (toast: Omit<Toast, 'id'>) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const DURATION: Record<Tone, number> = { success: 3500, info: 3500, error: 8000 }
const ICON = { success: CheckCircle2, error: XCircle, info: Info }
const COLOR: Record<Tone, string> = { success: 'text-success', error: 'text-danger', info: 'text-accent' }

let nextId = 1

/** Small stacked notifications in the bottom-right corner. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: number) => setToasts(list => list.filter(t => t.id !== id)), [])

  const show = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = nextId++
    setToasts(list => [...list.slice(-3), { ...toast, id }])
    setTimeout(() => dismiss(id), DURATION[toast.tone])
  }, [dismiss])

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
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
                  <p className="mt-0.5 max-h-28 overflow-y-auto font-mono text-xs whitespace-pre-wrap break-words text-fg-secondary">
                    {t.description}
                  </p>
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

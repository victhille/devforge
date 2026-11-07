import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useI18n } from '@renderer/i18n/I18nContext'
import Button from '@renderer/components/ui/Button'
import Modal from '@renderer/components/ui/Modal'

export interface ConfirmOptions {
  /** The dialog's title; « Es-tu sûr ? » by default */
  title?: string
  /** The confirm button's word; « Confirmer » by default */
  confirmLabel?: string
  /** A deletion or anything that cannot be undone: the button in red */
  danger?: boolean
}

type Confirm = (message: string, options?: ConfirmOptions) => Promise<boolean>

interface Question {
  id: number
  message: string
  options: ConfirmOptions
  resolve: (ok: boolean) => void
  /** Asked while another was open, or just after its answer: it shows where that one was */
  waited: boolean
}

/** How long the confirm button of a question that waited stays off: a click meant for the one before must not answer it */
const SETTLE_MS = 400

const ConfirmContext = createContext<Confirm | null>(null)

/** The provider's question, for code outside a component's render (a click handler, a context's callback) */
let mounted: Confirm | null = null

/**
 * `await confirmDialog(message)`: the app's dialog when ConfirmProvider is
 * mounted (the main window), Windows' own otherwise (a window without it).
 */
export const confirmDialog: Confirm = (message, options) => (mounted ? mounted(message, options) : Promise.resolve(window.confirm(message)))

/**
 * v4.3: the question before a deletion, asked in the app's own dialog (in
 * its theme, its language, the keyboard kept inside) instead of Windows' grey
 * `window.confirm`. `await confirm(message)` reads the same way.
 *
 * A question asked while another is open (after a scan, a check that took a
 * while) waits its turn: it never takes the place of the one being read.
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<Question[]>([])
  // The same queue, read by the callbacks without waiting for a render
  const waiting = useRef<Question[]>([])
  const count = useRef(0)
  /** When the last question was answered: one asked right after (chained questions) is a follow-up too */
  const lastAnswer = useRef(-Infinity)

  const confirm = useCallback<Confirm>((message, options = {}) => new Promise<boolean>(resolve => {
    const waited = waiting.current.length > 0 || performance.now() - lastAnswer.current < SETTLE_MS
    const question = { id: ++count.current, message, options, resolve, waited }
    waiting.current = [...waiting.current, question]
    setQueue(waiting.current)
  }), [])

  const answer = useCallback((ok: boolean) => {
    const [first, ...rest] = waiting.current
    if (!first) return
    waiting.current = rest
    lastAnswer.current = performance.now()
    setQueue(rest)
    first.resolve(ok)
  }, [])

  useEffect(() => {
    mounted = confirm
    return () => { if (mounted === confirm) mounted = null }
  }, [confirm])

  const asked = queue[0]
  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {/* One dialog per question (key): the next one starts with the focus on
          its box, not on a « Confirmer » meant for the one before */}
      {asked && <QuestionDialog key={asked.id} question={asked} onAnswer={answer} />}
    </ConfirmContext.Provider>
  )
}

export function QuestionDialog({ question, onAnswer }: { question: Question; onAnswer: (ok: boolean) => void }) {
  const { t } = useI18n()
  const { message, options, waited } = question
  // A question that waited shows where the last one was: its confirm button wakes up a moment later
  const [settled, setSettled] = useState(!waited)

  useEffect(() => {
    if (settled) return
    const timer = setTimeout(() => setSettled(true), SETTLE_MS)
    return () => clearTimeout(timer)
  }, [settled])

  return (
    <Modal title={options.title ?? t.common.confirmTitle} onClose={() => onAnswer(false)}
      footer={<>
        <Button variant="ghost" onClick={() => onAnswer(false)}>{t.common.cancel}</Button>
        <Button variant={options.danger ? 'danger' : 'primary'} disabled={!settled} onClick={() => onAnswer(true)}>{options.confirmLabel ?? t.common.confirm}</Button>
      </>}>
      <p className="text-base whitespace-pre-line text-fg-secondary">{message}</p>
    </Modal>
  )
}

export function useConfirm(): Confirm {
  const confirm = useContext(ConfirmContext)
  if (!confirm) throw new Error('useConfirm must be used inside ConfirmProvider')
  return confirm
}

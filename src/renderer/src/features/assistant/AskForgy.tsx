import type { ReactNode } from 'react'
import { Bot } from 'lucide-react'
import { cn } from '@renderer/lib/cn'
import Button from '@renderer/components/ui/Button'
import { useAssistant } from './AssistantContext'

/**
 * v4.2 lot 4: the one way a page offers Forgy, with the same look everywhere:
 * the panel opens, and the question (when there is one, worked out at the
 * click) is sent in a new conversation.
 */
export default function AskForgy({ question, label, icon, size = 'sm', solid, disabled, title, className }: {
  /** Nothing: the panel only opens */
  question?: string | (() => string)
  label: string
  icon?: ReactNode
  size?: 'sm' | 'md'
  /** Filled with Forgy's color (the page's main action), else outlined */
  solid?: boolean
  disabled?: boolean
  title?: string
  className?: string
}) {
  const { ask, setOpen } = useAssistant()
  const go = () => {
    const q = typeof question === 'function' ? question() : question
    if (q?.trim()) ask(q)
    else setOpen(true)
  }
  return (
    <Button size={size} variant="secondary" disabled={disabled} title={title} onClick={go}
      className={cn(solid ? 'border-transparent bg-forgy text-forgy-fg hover:border-transparent hover:bg-forgy/90' : 'border-forgy/30 text-forgy hover:border-forgy/50', className)}>
      {icon ?? <Bot size={size === 'md' ? 15 : 13} />} {label}
    </Button>
  )
}

import { Check, Copy } from 'lucide-react'
import { useCopy } from '@renderer/hooks/useCopy'
import { cn } from '@renderer/lib/cn'
import IconButton from './IconButton'

interface Props {
  text: string
  title?: string
  className?: string
}

export default function CopyButton({ text, title = 'Copy', className }: Props) {
  const { copy, isCopied } = useCopy()
  const done = isCopied()
  return (
    <IconButton
      size="sm"
      title={title}
      onClick={e => { e.stopPropagation(); copy(text) }}
      className={cn(done && 'text-success hover:text-success', className)}
    >
      {done ? <Check size={13} /> : <Copy size={13} />}
    </IconButton>
  )
}

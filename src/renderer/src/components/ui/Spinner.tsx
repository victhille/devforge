import { cn } from '@renderer/lib/cn'

export default function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-block size-3 shrink-0 animate-spin rounded-full border-[1.5px] border-accent-soft border-t-accent',
        className
      )}
    />
  )
}

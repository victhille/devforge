import { useEffect, useRef } from 'react'
import { cn } from '@renderer/lib/cn'
import { useProcessLogs } from '@renderer/hooks/useProcessLogs'

/** Live, auto-scrolling output of a managed process (stack step, docker logs…). */
export default function LogPanel({ procKey: key }: { procKey: string }) {
  const logs = useProcessLogs(key)
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }) }, [logs])
  return (
    <div role="log" tabIndex={0} className="max-h-64 overflow-y-auto rounded-lg bg-console p-3 font-mono text-xs leading-relaxed">
      {logs.length === 0 && <span className="text-fg-muted">—</span>}
      {logs.map((l, i) => (
        <div key={i} className={cn('whitespace-pre-wrap break-all', l.stream === 'stderr' ? 'text-warning' : l.stream === 'system' ? 'text-accent' : 'text-fg-secondary')}>
          {l.text}
        </div>
      ))}
      <div ref={end} />
    </div>
  )
}

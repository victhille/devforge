import { useEffect, useRef } from 'react'
import type { LogLine, CommandResult } from '../../../../shared/types'
import Button from './Button'
import styles from './CreationConsole.module.css'

interface Props {
  projectName: string
  logs: LogLine[]
  result: CommandResult | null
  onCancel: () => void
  onOpenFolder: () => void
  onOpenVSCode: () => void
  onDone: () => void
}

export default function CreationConsole({
  projectName,
  logs,
  result,
  onCancel,
  onOpenFolder,
  onOpenVSCode,
  onDone
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const running = result === null

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const statusColor = !result
    ? 'var(--accent)'
    : result.status === 'success'
    ? 'var(--success)'
    : result.status === 'cancelled'
    ? 'var(--warning)'
    : 'var(--danger)'

  const statusLabel = !result
    ? 'Creating...'
    : result.status === 'success'
    ? 'Created successfully'
    : result.status === 'cancelled'
    ? 'Cancelled'
    : 'Failed'

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          {running && <span className={styles.spinner} />}
          <div>
            <h2 className={styles.title}>Creating {projectName}</h2>
            <span className={styles.status} style={{ color: statusColor }}>
              {statusLabel}
            </span>
          </div>
        </div>
        {running && (
          <Button variant="danger" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>

      <div className={styles.console}>
        {logs.map((log, i) => (
          <div key={i} className={`${styles.line} ${styles[log.type]}`}>
            <span className={styles.lineText}>{log.text}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {result && (
        <div className={styles.footer}>
          {result.status === 'success' ? (
            <>
              <Button variant="secondary" onClick={onOpenFolder}>Open Folder</Button>
              <Button variant="secondary" onClick={onOpenVSCode}>Open in VS Code</Button>
              <Button onClick={onDone}>Done</Button>
            </>
          ) : (
            <Button variant="secondary" onClick={onDone}>Back to Home</Button>
          )}
        </div>
      )}
    </div>
  )
}

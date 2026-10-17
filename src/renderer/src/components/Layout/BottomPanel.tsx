import { useEffect, useRef } from 'react'
import { X, ChevronUp, ChevronDown, CheckCircle2, XCircle, FolderOpen, Code2 } from 'lucide-react'
import { useConsole } from '../../contexts/ConsoleContext'
import { useI18n } from '../../i18n/I18nContext'
import styles from './BottomPanel.module.css'

export default function BottomPanel() {
  const { t } = useI18n()
  const {
    visible, minimized, label, logs, result, isCreation, taskId,
    cancelTask, hide, setMinimized, openFolder, openVSCode
  } = useConsole()

  const logEndRef = useRef<HTMLDivElement>(null)
  const running = visible && result === null && taskId !== null

  useEffect(() => {
    if (!minimized) {
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs, minimized])

  const statusColor = !result
    ? 'var(--accent)'
    : result.status === 'success'  ? 'var(--success)'
    : result.status === 'cancelled'? 'var(--warning)'
    : 'var(--danger)'

  const statusLabel = !result
    ? null
    : result.status === 'success'   ? t.console.done
    : result.status === 'cancelled' ? t.console.cancelled
    : t.console.failed

  const panelClass = [
    styles.panel,
    visible    && styles.panelVisible,
    minimized  && styles.panelMinimized
  ].filter(Boolean).join(' ')

  return (
    <div className={panelClass}>
      {/* ── Header / status bar ──────────────────────────────── */}
      <div
        className={styles.header}
        onClick={() => { if (minimized) setMinimized(false) }}
        style={{ cursor: minimized ? 'pointer' : 'default' }}
      >
        <div className={styles.headerLeft}>
          {running && <span className={styles.spinner} />}
          {result?.status === 'success'  && <CheckCircle2 size={12} style={{ color: 'var(--success)', flexShrink: 0 }} />}
          {result && result.status !== 'success' && <XCircle size={12} style={{ color: statusColor, flexShrink: 0 }} />}
          <span className={styles.headerLabel}>{label}</span>
          {statusLabel && (
            <span className={styles.headerStatus} style={{ color: statusColor }}>
              — {statusLabel}
            </span>
          )}
        </div>

        <div className={styles.headerActions}>
          {running && (
            <button
              className={styles.headerBtn}
              onClick={e => { e.stopPropagation(); cancelTask() }}
              title={t.console.cancel}
            >
              <X size={11} />
            </button>
          )}
          <button
            className={styles.headerBtn}
            onClick={e => { e.stopPropagation(); setMinimized(!minimized) }}
            title={minimized ? t.console.expand : t.console.minimize}
          >
            {minimized ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </button>
          <button
            className={styles.headerBtn}
            onClick={e => { e.stopPropagation(); hide() }}
            title={t.console.close}
          >
            <X size={11} />
          </button>
        </div>
      </div>

      {/* ── Log output ───────────────────────────────────────── */}
      <div className={styles.logArea}>
        {logs.map((log, i) => (
          <div key={i} className={`${styles.line} ${styles[log.type]}`}>
            {log.text}
          </div>
        ))}
        <div ref={logEndRef} />
      </div>

      {/* ── Footer buttons on completion ─────────────────────── */}
      {result && (
        <div className={styles.footer}>
          {result.status === 'success' && isCreation && (
            <>
              <button className={styles.footerBtn} onClick={openFolder}>
                <FolderOpen size={11} /> {t.console.openFolder}
              </button>
              <button className={styles.footerBtn} onClick={openVSCode}>
                <Code2 size={11} /> {t.console.openVSCode}
              </button>
            </>
          )}
          <button className={`${styles.footerBtn} ${styles.footerBtnClose}`} onClick={hide}>
            {t.console.close}
          </button>
        </div>
      )}
    </div>
  )
}

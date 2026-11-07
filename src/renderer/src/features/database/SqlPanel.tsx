import { useState } from 'react'
import { Play } from 'lucide-react'
import type { DbQueryResult } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import Button from '@renderer/components/ui/Button'
import ResultGrid from './ResultGrid'

interface Props {
  connId: string
  sql: string
  onSql: (sql: string) => void
  /** Structure changed (CREATE / DROP / ALTER) */
  onSchemaChange: () => void
}

/** Free SQL editor with its result grid */
export default function SqlPanel({ connId, sql, onSql, onSchemaChange }: Props) {
  const { t } = useI18n()
  const d = t.database
  const [result, setResult] = useState<DbQueryResult | null>(null)
  const [running, setRunning] = useState(false)

  async function run() {
    if (!sql.trim()) return
    setRunning(true)
    try { setResult(await window.devforge.db.query(connId, sql)) }
    finally { setRunning(false) }
    if (/^\s*(create|drop|alter|rename)/i.test(sql)) onSchemaChange()
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-col border-b border-line-subtle">
        <textarea
          value={sql}
          onChange={e => onSql(e.target.value)}
          onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); run() } }}
          placeholder={d.sqlPlaceholder}
          spellCheck={false}
          autoFocus
          className="h-40 resize-y bg-canvas p-4 font-mono text-sm text-fg outline-none placeholder:text-fg-muted"
        />
        <div className="flex items-center gap-3 bg-surface px-4 py-2">
          <Button size="sm" onClick={run} loading={running} disabled={!sql.trim()}>{!running && <Play size={13} />} {d.run}</Button>
          <span className="text-xs text-fg-muted">{d.shortcut}</span>
          <span className="ml-auto text-xs text-fg-muted">{d.limitHint}</span>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        {result ? <ResultGrid result={result} /> : <p className="p-6 text-sm text-fg-muted">{d.noResult}</p>}
      </div>
    </div>
  )
}

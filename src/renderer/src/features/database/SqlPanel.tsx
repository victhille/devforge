import { useState } from 'react'
import { Play, Sparkles } from 'lucide-react'
import type { DbQueryResult } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import Button from '@renderer/components/ui/Button'
import AskForgy from '@renderer/features/assistant/AskForgy'
import ResultGrid from './ResultGrid'

interface Props {
  connId: string
  sql: string
  onSql: (sql: string) => void
  /** Structure changed (CREATE / DROP / ALTER) */
  onSchemaChange: () => void
}

/** As in the mock-up: the query in a dark card, Run (Ctrl + Enter) or Forgy, then its rows in a card */
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
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex shrink-0 flex-col gap-3 rounded-card border border-line-subtle bg-surface p-3.5">
        <textarea
          value={sql}
          onChange={e => onSql(e.target.value)}
          onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); run() } }}
          placeholder={d.sqlPlaceholder}
          aria-label={d.sqlLabel}
          spellCheck={false}
          autoFocus
          className="h-32 resize-y rounded-control bg-console px-4 py-3 font-mono text-sm leading-relaxed text-fg outline-none placeholder:text-fg-muted focus:ring-1 focus:ring-accent/40"
        />
        <div className="flex flex-wrap items-center gap-2.5">
          <Button onClick={run} loading={running} disabled={!sql.trim()}>
            {!running && <Play size={13} aria-hidden />} {d.run}
            <kbd className="ml-1 rounded border border-current/30 px-1 font-mono text-2xs opacity-80">{d.shortcutKeys}</kbd>
          </Button>
          <AskForgy label={d.writeWithForgy} icon={<Sparkles size={13} aria-hidden />} className="border-transparent"
            question={() => d.forgyPrompt.replace('{sql}', sql.trim() || '—')} />
          <span className="ml-auto text-xs text-fg-muted">{d.limitHint}</span>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-card border border-line-subtle bg-surface">
        {result ? <ResultGrid result={result} /> : <p className="p-6 text-sm text-fg-muted">{d.noResult}</p>}
      </div>
    </div>
  )
}

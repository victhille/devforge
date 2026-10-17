import type { DbQueryResult } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { cn } from '@renderer/lib/cn'
import CopyButton from '@renderer/components/ui/CopyButton'

/** CSV with RFC 4180 quoting, for the copy button */
function toCsv(r: DbQueryResult): string {
  const q = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [r.columns.map(q).join(','), ...r.rows.map(row => row.map(q).join(','))].join('\n')
}

export default function ResultGrid({ result }: { result: DbQueryResult }) {
  const { t } = useI18n()
  const d = t.database

  if (result.error) {
    return <div className="m-3 rounded-lg bg-danger-soft p-3 font-mono text-sm whitespace-pre-wrap text-danger">{result.error}</div>
  }
  if (result.columns.length === 0) {
    return (
      <div className="m-3 rounded-lg bg-success-soft p-3 text-sm text-success">
        {d.affected.replace('{n}', String(result.affected ?? 0))} · {result.durationMs} ms
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b border-line-subtle px-3 py-1.5 text-xs text-fg-muted">
        <span>{d.rows.replace('{n}', String(result.rows.length))}{result.truncated ? ` (${d.truncated})` : ''}</span>
        <span>{result.durationMs} ms</span>
        <span className="ml-auto flex items-center gap-1">CSV <CopyButton text={toCsv(result)} /></span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-max min-w-full border-collapse font-mono text-xs">
          <thead className="sticky top-0 z-10 bg-elevated">
            <tr>
              <th className="border-r border-b border-line-subtle px-2 py-1.5 text-right text-fg-muted">#</th>
              {result.columns.map((c, i) => (
                <th key={i} className="border-r border-b border-line-subtle px-3 py-1.5 text-left font-semibold whitespace-nowrap text-fg">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.rows.map((row, ri) => (
              <tr key={ri} className="hover:bg-hover">
                <td className="border-r border-b border-line-subtle px-2 py-1 text-right text-fg-muted">{ri + 1}</td>
                {row.map((v, ci) => (
                  <td key={ci} title={v === null ? 'NULL' : String(v)}
                    className={cn('max-w-80 truncate border-r border-b border-line-subtle px-3 py-1', v === null ? 'italic text-fg-muted' : 'text-fg-secondary')}>
                    {v === null ? 'NULL' : String(v)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

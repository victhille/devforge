import { useMemo, useState } from 'react'
import { Eye, Search, Table2 } from 'lucide-react'
import type { DbOverview, DbTableRef } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { formatSize } from '@renderer/lib/format'
import Card from '@renderer/components/ui/Card'
import { Input } from '@renderer/components/ui/Input'
import { Stat } from './TableTabs'

/** Database home, like phpMyAdmin's database page: info + every table with its size */
export default function OverviewView({ overview, onOpenTable }: { overview: DbOverview; onOpenTable: (t: DbTableRef) => void }) {
  const { t } = useI18n()
  const d = t.database
  const [filter, setFilter] = useState('')
  const tables = overview.tables.filter(tb => tb.type === 'table')
  const views = overview.tables.filter(tb => tb.type === 'view')
  const totalRows = tables.reduce((s, tb) => s + (tb.rows ?? 0), 0)
  const showSchema = new Set(overview.tables.map(tb => tb.schema)).size > 1
  const hasEngine = overview.tables.some(tb => tb.engine)
  const hasSizes = overview.tables.some(tb => tb.dataBytes !== null)

  const shown = useMemo(() => {
    const f = filter.trim().toLowerCase()
    return f ? overview.tables.filter(tb => `${tb.schema}.${tb.name}`.toLowerCase().includes(f)) : overview.tables
  }, [overview.tables, filter])

  return (
    <div className="flex flex-col gap-5 p-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label={d.server} value={overview.version} />
        <Stat label={d.databaseLabel} value={overview.database} />
        <Stat label={d.size} value={formatSize(overview.sizeBytes)} />
        <Stat label={d.tablesLabel} value={String(tables.length)} hint={views.length ? `${views.length} ${d.viewsLabel.toLowerCase()}` : undefined} />
        <Stat label={d.totalRows} value={totalRows.toLocaleString()} hint={d.approx} />
        <Stat label={d.encoding} value={overview.encoding ?? '—'} hint={overview.collation} />
      </div>

      <div className="relative w-72">
        <Search size={13} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-fg-muted" />
        <Input value={filter} onChange={e => setFilter(e.target.value)} placeholder={d.filterTables} className="pl-8" />
      </div>

      <Card className="overflow-x-auto p-0">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-elevated text-xs text-fg-muted">
            <tr>
              <th className="border-b border-line-subtle px-3 py-2 text-left font-semibold">{d.colName}</th>
              <th className="border-b border-line-subtle px-3 py-2 text-left font-semibold">{d.colType}</th>
              <th className="border-b border-line-subtle px-3 py-2 text-right font-semibold">{d.rowsEstimate}</th>
              {hasSizes && <>
                <th className="border-b border-line-subtle px-3 py-2 text-right font-semibold">{d.dataSize}</th>
                <th className="border-b border-line-subtle px-3 py-2 text-right font-semibold">{d.indexSize}</th>
                <th className="border-b border-line-subtle px-3 py-2 text-right font-semibold">{d.size}</th>
              </>}
              {hasEngine && <th className="border-b border-line-subtle px-3 py-2 text-left font-semibold">{d.engine}</th>}
              {hasEngine && <th className="border-b border-line-subtle px-3 py-2 text-left font-semibold">{d.collation}</th>}
              <th className="border-b border-line-subtle px-3 py-2 text-left font-semibold">{d.comment}</th>
            </tr>
          </thead>
          <tbody>
            {shown.map(tb => (
              <tr key={`${tb.schema}.${tb.name}`} className="hover:bg-hover">
                <td className="border-b border-line-subtle px-3 py-2">
                  <button onClick={() => onOpenTable(tb)} className="flex items-center gap-2 font-mono font-medium text-fg hover:text-accent">
                    {tb.type === 'view' ? <Eye size={13} className="text-fg-muted" /> : <Table2 size={13} className="text-fg-muted" />}
                    {showSchema && <span className="text-fg-muted">{tb.schema}.</span>}{tb.name}
                  </button>
                </td>
                <td className="border-b border-line-subtle px-3 py-2 text-xs text-fg-secondary">{tb.type === 'view' ? d.typeView : d.typeTable}</td>
                <td className="border-b border-line-subtle px-3 py-2 text-right tabular-nums text-fg-secondary">{tb.rows?.toLocaleString() ?? '—'}</td>
                {hasSizes && <>
                  <td className="border-b border-line-subtle px-3 py-2 text-right tabular-nums text-xs text-fg-secondary">{formatSize(tb.dataBytes)}</td>
                  <td className="border-b border-line-subtle px-3 py-2 text-right tabular-nums text-xs text-fg-secondary">{formatSize(tb.indexBytes)}</td>
                  <td className="border-b border-line-subtle px-3 py-2 text-right tabular-nums text-xs font-medium text-fg">
                    {formatSize(tb.dataBytes === null && tb.indexBytes === null ? null : (tb.dataBytes ?? 0) + (tb.indexBytes ?? 0))}
                  </td>
                </>}
                {hasEngine && <td className="border-b border-line-subtle px-3 py-2 text-xs text-fg-secondary">{tb.engine ?? ''}</td>}
                {hasEngine && <td className="border-b border-line-subtle px-3 py-2 font-mono text-2xs text-fg-muted">{tb.collation ?? ''}</td>}
                <td className="max-w-64 truncate border-b border-line-subtle px-3 py-2 text-xs text-fg-muted">{tb.comment ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}

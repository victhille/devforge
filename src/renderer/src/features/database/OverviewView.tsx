import { useMemo, useState } from 'react'
import { Eye, Search, Table2 } from 'lucide-react'
import type { DbOverview, DbTableRef } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { formatSize } from '@renderer/lib/format'
import Card from '@renderer/components/ui/Card'
import { Table, Td, Th } from '@renderer/components/ui/Table'
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
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">
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

      <Card className="overflow-hidden p-0">
        <Table>
          <thead>
            <tr>
              <Th>{d.colName}</Th>
              <Th>{d.colType}</Th>
              <Th align="right">{d.rowsEstimate}</Th>
              {hasSizes && <>
                <Th align="right">{d.dataSize}</Th>
                <Th align="right">{d.indexSize}</Th>
                <Th align="right">{d.size}</Th>
              </>}
              {hasEngine && <Th>{d.engine}</Th>}
              {hasEngine && <Th>{d.collation}</Th>}
              <Th>{d.comment}</Th>
            </tr>
          </thead>
          <tbody>
            {shown.map(tb => (
              <tr key={`${tb.schema}.${tb.name}`}>
                <Td>
                  <button onClick={() => onOpenTable(tb)} className="flex items-center gap-2 font-mono font-medium text-fg hover:text-accent">
                    {tb.type === 'view' ? <Eye size={13} className="text-fg-muted" /> : <Table2 size={13} className="text-fg-muted" />}
                    {showSchema && <span className="text-fg-muted">{tb.schema}.</span>}{tb.name}
                  </button>
                </Td>
                <Td className="text-xs text-fg-secondary">{tb.type === 'view' ? d.typeView : d.typeTable}</Td>
                <Td align="right" className="tabular-nums text-fg-secondary">{tb.rows?.toLocaleString() ?? '—'}</Td>
                {hasSizes && <>
                  <Td align="right" className="tabular-nums text-xs text-fg-secondary">{formatSize(tb.dataBytes)}</Td>
                  <Td align="right" className="tabular-nums text-xs text-fg-secondary">{formatSize(tb.indexBytes)}</Td>
                  <Td align="right" className="tabular-nums text-xs font-medium text-fg">
                    {formatSize(tb.dataBytes === null && tb.indexBytes === null ? null : (tb.dataBytes ?? 0) + (tb.indexBytes ?? 0))}
                  </Td>
                </>}
                {hasEngine && <Td className="text-xs text-fg-secondary">{tb.engine ?? ''}</Td>}
                {hasEngine && <Td className="font-mono text-2xs text-fg-muted">{tb.collation ?? ''}</Td>}
                <Td className="max-w-64 truncate text-xs text-fg-muted">{tb.comment ?? ''}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  )
}

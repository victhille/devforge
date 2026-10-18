import { useEffect, useState, type ReactNode } from 'react'
import { ArrowRight, ChevronLeft, ChevronRight, KeyRound, Link2 } from 'lucide-react'
import type { DbBrowseResult, DbForeignKey, DbTableDetails, DbTableRef, DbTableStat } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { usePersistentState } from '@renderer/hooks/usePersistentState'
import { formatSize } from '@renderer/lib/format'
import { cn } from '@renderer/lib/cn'
import Badge from '@renderer/components/ui/Badge'
import Card from '@renderer/components/ui/Card'
import CopyButton from '@renderer/components/ui/CopyButton'
import IconButton from '@renderer/components/ui/IconButton'
import Spinner from '@renderer/components/ui/Spinner'
import { Select } from '@renderer/components/ui/Input'
import { SectionTitle } from '@renderer/components/ui/Page'
import ResultGrid, { type GridSort } from './ResultGrid'

const PAGE_SIZES = [25, 50, 100, 250, 500]

// ─── Parcourir ────────────────────────────────────────────────────────────────

export function BrowseTab({ connId, table }: { connId: string; table: DbTableRef }) {
  const { t } = useI18n()
  const d = t.database
  const [limit, setLimit] = usePersistentState('devforge:db-page-size', 50)
  const [page, setPage] = useState(0)
  const [sort, setSort] = useState<GridSort | null>(null)
  const [result, setResult] = useState<DbBrowseResult | null>(null)
  const [loading, setLoading] = useState(true)

  // Another table: back to its first page, natural order
  useEffect(() => { setPage(0); setSort(null) }, [table.name, table.schema])

  useEffect(() => {
    let alive = true
    setLoading(true)
    window.devforge.db.browse(connId, table, { offset: page * limit, limit, orderBy: sort?.column, desc: sort?.desc })
      .then(r => { if (alive) setResult(r) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [connId, table.name, table.schema, page, limit, sort])

  if (!result) return <Spinner className="m-6" />

  const from = result.rows.length ? page * limit + 1 : 0
  const to = page * limit + result.rows.length
  const last = result.total !== null ? Math.max(0, Math.ceil(result.total / limit) - 1) : null
  const hasNext = last !== null ? page < last : result.rows.length === limit

  const pager = (
    <span className="flex items-center gap-2">
      <IconButton size="sm" title={d.prev} disabled={page === 0 || loading} onClick={() => setPage(p => p - 1)}><ChevronLeft size={13} /></IconButton>
      <span className="tabular-nums text-fg-secondary">
        {(result.total !== null ? d.pageOf : d.pageOfUnknown)
          .replace('{from}', String(from)).replace('{to}', String(to)).replace('{total}', String(result.total))}
      </span>
      <IconButton size="sm" title={d.next} disabled={!hasNext || loading} onClick={() => setPage(p => p + 1)}><ChevronRight size={13} /></IconButton>
      <Select value={limit} onChange={e => { setLimit(Number(e.target.value)); setPage(0) }} className="h-7 w-auto py-0 text-xs">
        {PAGE_SIZES.map(n => <option key={n} value={n}>{n} {d.perPage}</option>)}
      </Select>
      {loading && <Spinner />}
    </span>
  )

  if (!result.error && result.total === 0) {
    return <div className="flex flex-col">{<div className="border-b border-line-subtle px-3 py-1.5 text-xs">{pager}</div>}<p className="p-6 text-sm text-fg-muted">{d.emptyTable}</p></div>
  }
  return <ResultGrid result={result} rowOffset={page * limit} sort={sort} onSort={s => { setSort(s); setPage(0) }} toolbar={pager} />
}

// ─── Structure ────────────────────────────────────────────────────────────────

const KEY_COLOR = { PRI: 'warning', UNI: 'accent', MUL: 'default' } as const

function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return <th className={cn('border-b border-line-subtle px-3 py-2 text-left text-xs font-semibold text-fg-muted', className)}>{children}</th>
}
function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cn('border-b border-line-subtle px-3 py-2 align-top', className)}>{children}</td>
}

export function StructureTab({ details }: { details: DbTableDetails }) {
  const { t } = useI18n()
  const d = t.database
  return (
    <div className="flex flex-col gap-5 p-5">
      <section className="flex flex-col gap-2">
        <SectionTitle>{d.columnsTitle.replace('{n}', String(details.columns.length))}</SectionTitle>
        <Card className="overflow-x-auto p-0">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-elevated">
              <tr><Th className="w-10">#</Th><Th>{d.colName}</Th><Th>{d.colType}</Th><Th>{d.colNull}</Th><Th>{d.colDefault}</Th><Th>{d.colKey}</Th><Th>{d.colExtra}</Th><Th>{d.colComment}</Th></tr>
            </thead>
            <tbody>
              {details.columns.map((c, i) => (
                <tr key={c.name} className="hover:bg-hover">
                  <Td className="text-fg-muted tabular-nums">{i + 1}</Td>
                  <Td className="font-mono font-medium text-fg">
                    <span className="flex items-center gap-1.5">{c.key === 'PRI' && <KeyRound size={11} className="text-warning" />}{c.name}</span>
                  </Td>
                  <Td className="font-mono text-xs text-accent">{c.type}</Td>
                  <Td className="text-xs text-fg-secondary">{c.nullable ? d.yes : d.no}</Td>
                  <Td className="font-mono text-xs text-fg-secondary">{c.default ?? <span className="italic text-fg-muted">{c.nullable ? 'NULL' : '—'}</span>}</Td>
                  <Td>{c.key && <Badge color={KEY_COLOR[c.key]} className="font-mono text-2xs">{c.key}</Badge>}</Td>
                  <Td className="text-xs text-fg-secondary">{c.extra}</Td>
                  <Td className="text-xs text-fg-muted">{c.comment}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>

      <section className="flex flex-col gap-2">
        <SectionTitle>{d.indexesTitle.replace('{n}', String(details.indexes.length))}</SectionTitle>
        {details.indexes.length === 0 ? <p className="text-sm text-fg-muted">{d.noIndexes}</p> : (
          <Card className="overflow-x-auto p-0">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-elevated"><tr><Th>{d.colName}</Th><Th>{d.colType}</Th><Th>{d.unique}</Th><Th>{d.indexColumns}</Th></tr></thead>
              <tbody>
                {details.indexes.map(i => (
                  <tr key={i.name} className="hover:bg-hover">
                    <Td className="font-mono text-fg">
                      <span className="flex items-center gap-2">{i.name}{i.primary && <Badge color="warning" className="text-2xs">{d.primary}</Badge>}</span>
                    </Td>
                    <Td className="font-mono text-xs text-fg-secondary">{i.type}</Td>
                    <Td className="text-xs text-fg-secondary">{i.unique ? d.yes : d.no}</Td>
                    <Td className="font-mono text-xs text-fg-secondary">{i.columns.join(', ')}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>
    </div>
  )
}

// ─── Relations ────────────────────────────────────────────────────────────────

function FkRow({ fk, self, incoming, onOpen }: { fk: DbForeignKey; self: string; incoming: boolean; onOpen: (name: string) => void }) {
  const link = (name: string) => (
    <button onClick={() => onOpen(name)} className="font-mono font-medium text-accent hover:underline">{name}</button>
  )
  // incoming: other.cols → self.refCols ; outgoing: self.cols → other.refCols
  const own = <span className="font-mono font-medium text-fg">{self}</span>
  const cols = (list: string[]) => <span> ({list.join(', ')})</span>
  const left = incoming ? <>{link(fk.table)}{cols(fk.columns)}</> : <>{own}{cols(fk.columns)}</>
  const right = incoming ? <>{own}{cols(fk.refColumns)}</> : <>{link(fk.table)}{cols(fk.refColumns)}</>
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
      <Link2 size={13} className="text-fg-muted" />
      <span className="font-mono text-xs text-fg-secondary">{left}</span>
      <ArrowRight size={13} className="text-fg-muted" />
      <span className="font-mono text-xs text-fg-secondary">{right}</span>
      <span className="ml-auto flex gap-1.5">
        <Badge className="font-mono text-2xs">ON DELETE {fk.onDelete}</Badge>
        <Badge className="font-mono text-2xs">ON UPDATE {fk.onUpdate}</Badge>
      </span>
      <span className="w-full pl-6 font-mono text-2xs text-fg-muted">{fk.name}</span>
    </div>
  )
}

export function RelationsTab({ details, table, onOpenTable }: { details: DbTableDetails; table: DbTableRef; onOpenTable: (name: string) => void }) {
  const { t } = useI18n()
  const d = t.database
  return (
    <div className="flex flex-col gap-5 p-5">
      <section className="flex flex-col gap-2">
        <SectionTitle>{d.foreignKeys}</SectionTitle>
        {details.foreignKeys.length === 0 ? <p className="text-sm text-fg-muted">{d.noForeignKeys}</p> : (
          <Card className="divide-y divide-line-subtle p-0">
            {details.foreignKeys.map(fk => <FkRow key={fk.name + fk.table} fk={fk} self={table.name} incoming={false} onOpen={onOpenTable} />)}
          </Card>
        )}
      </section>
      <section className="flex flex-col gap-2">
        <SectionTitle>{d.referencedBy}</SectionTitle>
        {details.referencedBy.length === 0 ? <p className="text-sm text-fg-muted">{d.noReferences}</p> : (
          <Card className="divide-y divide-line-subtle p-0">
            {details.referencedBy.map(fk => <FkRow key={fk.name + fk.table} fk={fk} self={table.name} incoming onOpen={onOpenTable} />)}
          </Card>
        )}
      </section>
    </div>
  )
}

// ─── Infos ────────────────────────────────────────────────────────────────────

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <Card className="flex flex-col gap-1 px-4 py-3">
      <span className="text-2xs font-medium uppercase tracking-wider text-fg-muted">{label}</span>
      <span className="truncate text-md font-semibold text-fg" title={typeof value === 'string' ? value : undefined}>{value}</span>
      {hint && <span className="text-2xs text-fg-muted">{hint}</span>}
    </Card>
  )
}

export function InfoTab({ details }: { details: DbTableDetails }) {
  const { t } = useI18n()
  const d = t.database
  const s: DbTableStat | null = details.stats
  const total = s && (s.dataBytes !== null || s.indexBytes !== null) ? (s.dataBytes ?? 0) + (s.indexBytes ?? 0) : null
  return (
    <div className="flex flex-col gap-5 p-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={d.rowsEstimate} value={s?.rows?.toLocaleString() ?? '—'} hint={d.approx} />
        <Stat label={d.size} value={formatSize(total)} />
        <Stat label={d.dataSize} value={formatSize(s?.dataBytes)} />
        <Stat label={d.indexSize} value={formatSize(s?.indexBytes)} />
        {s?.engine && <Stat label={d.engine} value={s.engine} />}
        {s?.collation && <Stat label={d.collation} value={s.collation} />}
        <Stat label={d.colType} value={s?.type === 'view' ? d.typeView : d.typeTable} />
        {s?.comment && <Stat label={d.comment} value={s.comment} />}
      </div>
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <SectionTitle>{d.ddl}</SectionTitle>
          {details.ddl && <CopyButton text={details.ddl} />}
        </div>
        {details.ddl
          ? <pre className="overflow-x-auto rounded-lg border border-line-subtle bg-console p-4 font-mono text-xs leading-relaxed text-fg-secondary">{details.ddl}</pre>
          : <p className="text-sm text-fg-muted">{d.noDdl}</p>}
      </section>
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { FolderOpen, HardDrive, Search, Trash2 } from 'lucide-react'
import type { CleanKind } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useToast } from '@renderer/app/ToastContext'
import { cn } from '@renderer/lib/cn'
import { formatRelative, formatSize } from '@renderer/lib/format'
import Badge from '@renderer/components/ui/Badge'
import Button from '@renderer/components/ui/Button'
import Checkbox from '@renderer/components/ui/Checkbox'
import EmptyState from '@renderer/components/ui/EmptyState'
import IconButton from '@renderer/components/ui/IconButton'
import Modal from '@renderer/components/ui/Modal'
import { Skeleton } from '@renderer/components/ui/Skeleton'
import Spinner from '@renderer/components/ui/Spinner'
import { Table, Td, Th } from '@renderer/components/ui/Table'
import ErrorState from '@renderer/components/ui/ErrorState'
import Tabs from '@renderer/components/ui/Tabs'
import { Input } from '@renderer/components/ui/Input'
import { Page, PageHeader } from '@renderer/components/ui/Page'
import { useDiskCleaner } from './useDiskCleaner'

type KindFilter = CleanKind | 'all'

/** Each kind's color in the bar and its legend, as in the mock-up */
const KIND_BAR: Record<CleanKind, string> = { dependencies: 'bg-accent', cache: 'bg-info', build: 'bg-success' }
const KINDS: CleanKind[] = ['dependencies', 'cache', 'build']
const OLD_DAYS = 30

export default function DiskCleanerPage() {
  const { t, lang } = useI18n()
  const c = t.cleaner
  const toast = useToast()
  const { rows, scanning, sizing, error, scan, remove } = useDiskCleaner()
  const [root, setRoot] = useState('')
  const [kind, setKind] = useState<KindFilter>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    window.devforge.getSettings().then(s => setRoot(s.defaultProjectsDir))
  }, [])

  const visible = useMemo(() => rows
    .filter(r => kind === 'all' || r.kind === kind)
    .sort((a, b) => (b.size ?? -1) - (a.size ?? -1)), [rows, kind])

  const total         = rows.reduce((s, r) => s + (r.size ?? 0), 0)
  const byKind        = KINDS.map(k => ({ kind: k, bytes: rows.filter(r => r.kind === k).reduce((s, r) => s + (r.size ?? 0), 0) })).filter(x => x.bytes > 0)
  const selectedRows  = rows.filter(r => selected.has(r.path))
  const selectedBytes = selectedRows.reduce((s, r) => s + (r.size ?? 0), 0)
  const kindLabel: Record<CleanKind, string> = { dependencies: c.kindDependencies, cache: c.kindCache, build: c.kindBuild }

  const isOld = (iso: string) => !!iso && Date.now() - new Date(iso).getTime() > OLD_DAYS * 86400e3

  function toggle(path: string, on: boolean) {
    setSelected(prev => {
      const next = new Set(prev)
      if (on) next.add(path); else next.delete(path)
      return next
    })
  }

  async function browse() {
    const dir = await window.devforge.selectDirectory()
    if (dir) setRoot(dir)
  }

  async function runScan() {
    setSelected(new Set())
    await scan(root)
  }

  async function confirmDelete() {
    setDeleting(true)
    try {
      const r = await remove([...selected])
      setSelected(new Set())
      toast.show({
        tone: r.failed.length ? 'error' : 'success',
        title: c.freed.replace('{size}', formatSize(r.freedBytes, lang)).replace('{n}', String(r.removed.length)),
        description: r.failed.map(f => `${f.path}: ${f.error}`).join('\n') || undefined
      })
    } finally {
      setDeleting(false)
      setConfirming(false)
    }
  }

  return (
    <Page className="df-mockup">
      <PageHeader crumb={t.nav.groupSystem} title={c.title} subtitle={c.subtitle}
        actions={
          <form className="flex items-center gap-2" onSubmit={ev => { ev.preventDefault(); if (root) runScan() }}>
            <div className="flex h-9 items-center rounded-control border border-line bg-surface focus-within:border-accent">
              <Input value={root} onChange={e => setRoot(e.target.value)} placeholder="C:\Dev" aria-label={c.folder} className="h-full w-64 border-0 bg-transparent font-mono focus:ring-0" />
              <IconButton size="sm" title={c.browse} onClick={browse} className="mr-1"><FolderOpen size={14} /></IconButton>
            </div>
            <Button type="submit" variant="secondary" loading={scanning} disabled={!root}>
              {!scanning && <Search size={14} aria-hidden />} {c.scan}
            </Button>
          </form>
        }
      />

      {scanning && rows.length === 0 && (
        <div role="status" aria-label={c.scanning} className="flex flex-col gap-3 rounded-card border border-line-subtle bg-surface p-5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-2.5 w-full rounded-full" />
        </div>
      )}

      {rows.length > 0 && (
        <>
          {/* How much can go, by kind, and the selection's button */}
          <section aria-labelledby="cleaner-total" className="df-rise flex flex-col gap-4 rounded-card border border-line-subtle bg-surface p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 id="cleaner-total" className="text-sm text-fg-muted">{c.statReclaimable}</h2>
                <p className="mt-1 flex items-baseline gap-2">
                  <span className="font-display text-page leading-none font-bold tracking-[-.025em] text-fg">{formatSize(total, lang)}</span>
                  <span className="text-sm text-fg-muted">{c.inFolders.replace('{n}', String(rows.length))}</span>
                  {sizing && <Spinner />}
                </p>
              </div>
              <Button disabled={selected.size === 0} onClick={() => setConfirming(true)}>
                <Trash2 size={14} aria-hidden /> {selected.size ? c.deleteSelectedSize.replace('{size}', formatSize(selectedBytes, lang)) : c.deleteSelected}
              </Button>
            </div>
            {total > 0 && (
              <>
                <div className="flex h-2.5 overflow-hidden rounded-full bg-active" role="img" aria-label={byKind.map(k => `${kindLabel[k.kind]} ${formatSize(k.bytes, lang)}`).join(', ')}>
                  {byKind.map(k => <span key={k.kind} className={cn('h-full', KIND_BAR[k.kind])} style={{ width: `${(k.bytes / total) * 100}%` }} />)}
                </div>
                <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-fg-secondary">
                  {byKind.map(k => (
                    <li key={k.kind} className="flex items-center gap-1.5">
                      <span aria-hidden className={cn('size-2.5 rounded-sm', KIND_BAR[k.kind])} />
                      {kindLabel[k.kind]} <span className="font-mono text-fg-muted">{formatSize(k.bytes, lang)}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Tabs<KindFilter>
              value={kind}
              onChange={setKind}
              label={c.kinds}
              items={[
                { value: 'all',          label: c.kindAll },
                { value: 'dependencies', label: c.kindDependencies },
                { value: 'build',        label: c.kindBuild },
                { value: 'cache',        label: c.kindCache }
              ]}
            />
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={() => setSelected(new Set(visible.map(r => r.path)))}>{c.selectAll}</Button>
              <Button variant="ghost" size="sm" onClick={() => setSelected(new Set(visible.filter(r => isOld(r.projectModified)).map(r => r.path)))}>
                {c.selectOld.replace('{n}', String(OLD_DAYS))}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>{c.selectNone}</Button>
            </div>
          </div>

          <div className="df-rise overflow-hidden rounded-card border border-line-subtle bg-surface">
            <Table className="table-fixed">
              <thead>
                <tr>
                  <Th className="w-12"><span className="sr-only">{c.colPick}</span></Th>
                  <Th className="w-[24%]">{c.colFolder}</Th>
                  <Th>{c.colProject}</Th>
                  <Th className="w-44">{c.colActivity}</Th>
                  <Th className="w-28" align="right">{c.colSize}</Th>
                </tr>
              </thead>
              <tbody>
                {visible.map(r => (
                  <tr key={r.path} onClick={() => toggle(r.path, !selected.has(r.path))}
                    className={cn('cursor-pointer', selected.has(r.path) && '[&_td]:bg-accent-soft/40')}>
                    <Td onClick={e => e.stopPropagation()}>
                      <Checkbox checked={selected.has(r.path)} onChange={on => toggle(r.path, on)}><span className="sr-only">{r.path}</span></Checkbox>
                    </Td>
                    <Td className="truncate font-mono font-semibold text-fg" title={r.path}>
                      <span className={cn('mr-2 inline-block size-2 rounded-sm align-middle', KIND_BAR[r.kind])} aria-hidden />{r.name}
                    </Td>
                    <Td className="truncate" title={r.path}><span className="font-semibold text-fg">{r.projectName}</span></Td>
                    <Td className="text-fg-muted">
                      <span className="flex items-center gap-2">{formatRelative(r.projectModified, lang)} {isOld(r.projectModified) && <Badge>{c.old}</Badge>}</span>
                    </Td>
                    <Td align="right" className="font-mono font-bold text-fg">
                      {r.size === null ? <Spinner className="ml-auto" /> : formatSize(r.size, lang)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </>
      )}

      {!scanning && error && <ErrorState error={error} onRetry={runScan} />}
      {!scanning && !error && rows.length === 0 && (
        <EmptyState fill icon={<HardDrive size={32} />} title={c.emptyTitle} description={c.emptyHint} />
      )}

      {confirming && (
        <Modal
          title={c.confirmTitle}
          onClose={() => !deleting && setConfirming(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirming(false)} disabled={deleting}>{t.common.cancel}</Button>
              <Button variant="danger" onClick={confirmDelete} loading={deleting}>
                {!deleting && <Trash2 size={14} />} {c.confirmDelete.replace('{size}', formatSize(selectedBytes, lang))}
              </Button>
            </>
          }
        >
          <p className="text-fg-secondary">
            {c.confirmText.replace('{n}', String(selected.size)).replace('{size}', formatSize(selectedBytes, lang))}
          </p>
          <ul className="max-h-48 overflow-y-auto rounded-lg border border-line-subtle bg-canvas p-2 font-mono text-xs text-fg-muted">
            {selectedRows.map(r => <li key={r.path} className="truncate">{r.path}</li>)}
          </ul>
        </Modal>
      )}
    </Page>
  )
}

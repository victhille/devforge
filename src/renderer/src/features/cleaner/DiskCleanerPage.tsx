import { useEffect, useMemo, useState } from 'react'
import { FolderSearch, HardDrive, Trash2 } from 'lucide-react'
import type { CleanKind } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useToast } from '@renderer/app/ToastContext'
import { cn } from '@renderer/lib/cn'
import { formatRelative, formatSize } from '@renderer/lib/format'
import Badge, { type BadgeColor } from '@renderer/components/ui/Badge'
import Button from '@renderer/components/ui/Button'
import Card from '@renderer/components/ui/Card'
import Checkbox from '@renderer/components/ui/Checkbox'
import EmptyState from '@renderer/components/ui/EmptyState'
import Modal from '@renderer/components/ui/Modal'
import Spinner from '@renderer/components/ui/Spinner'
import Tabs from '@renderer/components/ui/Tabs'
import { Input } from '@renderer/components/ui/Input'
import { Page, PageHeader } from '@renderer/components/ui/Page'
import { useDiskCleaner } from './useDiskCleaner'

type KindFilter = CleanKind | 'all'

const KIND_COLOR: Record<CleanKind, BadgeColor> = { dependencies: 'accent', build: 'warning', cache: 'default' }
const OLD_DAYS = 30

export default function DiskCleanerPage() {
  const { t, lang } = useI18n()
  const c = t.cleaner
  const toast = useToast()
  const { rows, scanning, sizing, scan, remove } = useDiskCleaner()
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
  const selectedRows  = rows.filter(r => selected.has(r.path))
  const selectedBytes = selectedRows.reduce((s, r) => s + (r.size ?? 0), 0)

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
        title: c.freed.replace('{size}', formatSize(r.freedBytes)).replace('{n}', String(r.removed.length)),
        description: r.failed.map(f => `${f.path}: ${f.error}`).join('\n') || undefined
      })
    } finally {
      setDeleting(false)
      setConfirming(false)
    }
  }

  return (
    <Page>
      <PageHeader icon={<HardDrive size={18} />} title={c.title} subtitle={c.subtitle} />

      <div className="flex gap-2">
        <Input value={root} onChange={e => setRoot(e.target.value)} placeholder="C:\Dev" className="font-mono" />
        <Button variant="secondary" onClick={browse}>{c.browse}</Button>
        <Button onClick={runScan} loading={scanning} disabled={!root}>
          {!scanning && <FolderSearch size={14} />} {c.scan}
        </Button>
      </div>

      {rows.length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Card className="flex flex-col gap-1 px-4 py-3">
              <span className="flex items-center gap-2 text-2xl font-semibold text-fg">
                {formatSize(total)} {sizing && <Spinner />}
              </span>
              <span className="text-sm text-fg-secondary">{c.reclaimable.replace('{n}', String(rows.length))}</span>
            </Card>
            <Card className="flex flex-col gap-1 px-4 py-3">
              <span className="text-2xl font-semibold text-accent">{formatSize(selectedBytes)}</span>
              <span className="text-sm text-fg-secondary">{c.selected.replace('{n}', String(selected.size))}</span>
            </Card>
            <Card className="flex items-center justify-center px-4 py-3">
              <Button variant="danger" size="lg" disabled={selected.size === 0} onClick={() => setConfirming(true)}>
                <Trash2 size={16} /> {c.deleteSelected}
              </Button>
            </Card>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Tabs<KindFilter>
              value={kind}
              onChange={setKind}
              items={[
                { value: 'all',          label: c.kindAll },
                { value: 'dependencies', label: c.kindDependencies },
                { value: 'build',        label: c.kindBuild },
                { value: 'cache',        label: c.kindCache }
              ]}
            />
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setSelected(new Set(visible.map(r => r.path)))}>{c.selectAll}</Button>
              <Button variant="ghost" size="sm" onClick={() => setSelected(new Set(visible.filter(r => isOld(r.projectModified)).map(r => r.path)))}>
                {c.selectOld.replace('{n}', String(OLD_DAYS))}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>{c.selectNone}</Button>
            </div>
          </div>

          <Card className="divide-y divide-line-subtle">
            {visible.map(r => (
              <div
                key={r.path}
                onClick={() => toggle(r.path, !selected.has(r.path))}
                className={cn('flex cursor-pointer items-center gap-4 px-4 py-2.5 hover:bg-elevated', selected.has(r.path) && 'bg-accent-soft/40')}
              >
                <span onClick={e => e.stopPropagation()}>
                  <Checkbox checked={selected.has(r.path)} onChange={on => toggle(r.path, on)}>{null}</Checkbox>
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="flex items-center gap-2">
                    <span className="font-medium text-fg">{r.projectName}</span>
                    <Badge color={KIND_COLOR[r.kind]} className="font-mono">{r.name}</Badge>
                    {isOld(r.projectModified) && <Badge>{c.old}</Badge>}
                  </span>
                  <span className="truncate font-mono text-xs text-fg-muted">{r.path}</span>
                </div>
                <span className="shrink-0 text-xs text-fg-muted">{formatRelative(r.projectModified, lang)}</span>
                <span className="w-24 shrink-0 text-right font-mono text-sm font-semibold text-fg">
                  {r.size === null ? <Spinner className="ml-auto" /> : formatSize(r.size)}
                </span>
              </div>
            ))}
          </Card>
        </>
      )}

      {!scanning && rows.length === 0 && (
        <EmptyState icon={<HardDrive size={32} />} title={c.emptyTitle} description={c.emptyHint} />
      )}

      {confirming && (
        <Modal
          title={c.confirmTitle}
          onClose={() => !deleting && setConfirming(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirming(false)} disabled={deleting}>{t.common.cancel}</Button>
              <Button variant="danger" onClick={confirmDelete} loading={deleting}>
                {!deleting && <Trash2 size={14} />} {c.confirmDelete.replace('{size}', formatSize(selectedBytes))}
              </Button>
            </>
          }
        >
          <p className="text-fg-secondary">
            {c.confirmText.replace('{n}', String(selected.size)).replace('{size}', formatSize(selectedBytes))}
          </p>
          <ul className="max-h-48 overflow-y-auto rounded-lg border border-line-subtle bg-canvas p-2 font-mono text-xs text-fg-muted">
            {selectedRows.map(r => <li key={r.path} className="truncate">{r.path}</li>)}
          </ul>
        </Modal>
      )}
    </Page>
  )
}

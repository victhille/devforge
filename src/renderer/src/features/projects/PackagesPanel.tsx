import { useCallback, useEffect, useState } from 'react'
import { ArrowUpCircle, ExternalLink, Package, RefreshCw, ShieldAlert, ShieldCheck } from 'lucide-react'
import type { AuditSummary, PackageInfo, PackageManifest, PackageUpdate, UpdateLevel } from '@shared/types'
import { fitsRange, rangeFloor, updateLevel } from '@shared/lib/packages'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useToast } from '@renderer/app/ToastContext'
import { cn } from '@renderer/lib/cn'
import Badge, { type BadgeColor } from '@renderer/components/ui/Badge'
import Button from '@renderer/components/ui/Button'
import Card from '@renderer/components/ui/Card'
import Spinner from '@renderer/components/ui/Spinner'
import EmptyState from '@renderer/components/ui/EmptyState'

const errorText = (err: unknown) => String(err instanceof Error ? err.message : err).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')

type Filter = 'all' | 'outdated' | 'major'

const LEVEL_COLOR: Record<UpdateLevel, BadgeColor> = { current: 'success', patch: 'accent', minor: 'warning', major: 'danger', unknown: 'default' }
const SEVERITY_COLOR = { info: 'default', low: 'default', moderate: 'warning', high: 'danger', critical: 'danger' } as const

/** What updating one package means: within its range, or to the latest version */
function planOf(p: PackageInfo, latest: string | null): { level: UpdateLevel; update: PackageUpdate | null } {
  const level = updateLevel(p.installed ?? rangeFloor(p.wanted), latest)
  if (level === 'current' || level === 'unknown' || !latest) return { level, update: null }
  return { level, update: { name: p.name, dev: p.dev, target: fitsRange(latest, p.wanted) ? 'compatible' : 'latest' } }
}

/**
 * A project's packages (v3.3 lot 2): one card per package.json, what is
 * behind, what is vulnerable, and the update the user chooses.
 */
export default function PackagesPanel({ projectId }: { projectId: string }) {
  const { t } = useI18n()
  const k = t.packages
  const toast = useToast()
  const [manifests, setManifests] = useState<PackageManifest[] | null>(null)
  const [latest, setLatest] = useState<Record<string, Record<string, string | null>>>({})
  const [audits, setAudits] = useState<Record<string, AuditSummary | null | 'busy'>>({})
  const [filter, setFilter] = useState<Filter>('outdated')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [running, setRunning] = useState<string | null>(null)
  const [log, setLog] = useState<string[]>([])

  const loadLatest = useCallback(async (m: PackageManifest) => {
    const versions = await window.devforge.packages.latest(projectId, m.dir, m.packages.map(p => p.name)).catch(() => ({}))
    setLatest(prev => ({ ...prev, [m.dir]: versions }))
  }, [projectId])

  const load = useCallback(async () => {
    const list = await window.devforge.packages.list(projectId).catch(() => [])
    setManifests(list)
    list.forEach(m => { void loadLatest(m) })
  }, [projectId, loadLatest])
  useEffect(() => { void load() }, [load])

  useEffect(() => window.devforge.packages.onLog(line => setLog(l => [...l.slice(-300), line])), [])

  async function runAudit(dir: string) {
    setAudits(a => ({ ...a, [dir]: 'busy' }))
    const r = await window.devforge.packages.audit(projectId, dir).catch(() => null)
    setAudits(a => ({ ...a, [dir]: r }))
  }

  async function apply(m: PackageManifest, updates: PackageUpdate[]) {
    if (!updates.length) return
    const majors = updates.filter(u => {
      const p = m.packages.find(x => x.name === u.name)
      return p && planOf(p, latest[m.dir]?.[u.name] ?? null).level === 'major'
    })
    if (majors.length && !window.confirm(k.majorConfirm.replace('{list}', majors.map(u => `${u.name} → ${latest[m.dir]?.[u.name]}`).join('\n')))) return
    setRunning(m.dir); setLog([])
    try {
      const r = await window.devforge.packages.update(projectId, m.dir, updates)
      toast.show(r.ok ? { tone: 'success', title: k.updated.replace('{n}', String(updates.length)) } : { tone: 'error', title: r.restored ? k.failedRestored : k.failed })
      setSelected(new Set())
      const fresh = await window.devforge.packages.list(projectId).catch(() => manifests ?? [])
      setManifests(fresh)
      const again = fresh.find(x => x.dir === m.dir)
      if (again) await loadLatest(again)
      if (audits[m.dir] && audits[m.dir] !== 'busy') void runAudit(m.dir)
    } catch (err) {
      toast.show({ tone: 'error', title: errorText(err) })
    } finally { setRunning(null) }
  }

  if (!manifests) return <Spinner />
  if (!manifests.length) return <EmptyState icon={<Package size={28} />} title={k.none} />

  return (
    <div className="flex flex-col gap-5">
      <div role="radiogroup" aria-label={k.filter} className="flex gap-1 self-start rounded-lg border border-line p-0.5">
        {(['outdated', 'major', 'all'] as Filter[]).map(f => (
          <button key={f} role="radio" aria-checked={filter === f} onClick={() => setFilter(f)}
            className={cn('rounded-md px-3 py-1 text-sm', filter === f ? 'bg-active text-fg' : 'text-fg-secondary hover:text-fg')}>{k.filters[f]}</button>
        ))}
      </div>

      {manifests.map(m => {
        const versions = latest[m.dir]
        const rows = m.packages.map(p => ({ p, latest: versions?.[p.name] ?? null, ...planOf(p, versions?.[p.name] ?? null) }))
        const shown = rows.filter(r => filter === 'all' || (filter === 'major' ? r.level === 'major' : !!r.update))
        const compatible = rows.flatMap(r => r.update?.target === 'compatible' ? [r.update] : [])
        const picked = rows.flatMap(r => r.update && selected.has(`${m.dir}:${r.p.name}`) ? [r.update] : [])
        const audit = audits[m.dir]
        const label = `${m.dir ? `${m.dir}/` : ''}${m.file}`
        return (
          <Card key={m.dir} className="overflow-hidden">
            <header className="flex flex-wrap items-center gap-2.5 border-b border-line-subtle px-[18px] py-3.5">
              <Package size={16} className="text-fg-muted" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-mono text-sm text-fg">{label}</div>
                <div className="text-xs text-fg-muted">{m.name ?? '—'} · {m.manager} · {k.count.replace('{n}', String(m.packages.length))}</div>
              </div>
              {audit === 'busy' ? <Spinner />
                : audit === undefined ? <Button size="sm" variant="ghost" onClick={() => runAudit(m.dir)}><ShieldAlert size={13} /> {k.audit}</Button>
                : audit === null ? <span className="text-xs text-fg-muted">{k.auditUnavailable}</span>
                : audit.total === 0 ? <Badge color="success"><ShieldCheck size={12} /> {k.auditClean}</Badge>
                : <Badge color={audit.bySeverity.critical || audit.bySeverity.high ? 'danger' : 'warning'}><ShieldAlert size={12} /> {k.auditFound.replace('{n}', String(audit.total))}</Badge>}
              <Button size="sm" variant="ghost" onClick={() => loadLatest(m)} disabled={!!running}><RefreshCw size={13} /> {t.common.refresh}</Button>
              <Button size="sm" variant="secondary" disabled={!compatible.length || !!running} loading={running === m.dir}
                onClick={() => apply(m, compatible)}><ArrowUpCircle size={13} /> {k.updateCompatible.replace('{n}', String(compatible.length))}</Button>
            </header>

            {!versions && <div className="flex items-center gap-2 px-[18px] py-3 text-sm text-fg-muted"><Spinner /> {k.checking}</div>}
            {versions && shown.length === 0 && <p className="px-[18px] py-4 text-sm text-fg-muted">{filter === 'all' ? k.empty : k.allCurrent}</p>}
            {versions && shown.length > 0 && (
              <table className="w-full border-collapse text-sm">
                <thead className="border-b border-line-subtle text-left text-2xs uppercase tracking-wider text-fg-muted">
                  <tr>
                    <th className="w-8 px-3 py-2"><span className="sr-only">{k.select}</span></th>
                    <th className="px-3 py-2">{k.colName}</th>
                    <th className="px-3 py-2">{k.colWanted}</th>
                    <th className="px-3 py-2">{k.colInstalled}</th>
                    <th className="px-3 py-2">{k.colLatest}</th>
                    <th className="px-3 py-2">{k.colState}</th>
                    <th className="px-3 py-2 text-right"><span className="sr-only">{k.colAction}</span></th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map(r => {
                    const key = `${m.dir}:${r.p.name}`
                    const vuln = audit && audit !== 'busy' ? audit.packages[r.p.name] : undefined
                    return (
                      <tr key={key} className="border-b border-line-subtle last:border-0 hover:bg-elevated">
                        <td className="px-3 py-1.5">
                          {r.update && <input type="checkbox" className="size-3.5 accent-accent" aria-label={k.selectOne.replace('{name}', r.p.name)} checked={selected.has(key)}
                            onChange={e => setSelected(s => { const n = new Set(s); if (e.target.checked) n.add(key); else n.delete(key); return n })} />}
                        </td>
                        <td className="px-3 py-1.5">
                          <button onClick={() => window.devforge.openExternal(`https://www.npmjs.com/package/${r.p.name}`)} className="inline-flex items-center gap-1 font-mono text-fg hover:text-accent">
                            {r.p.name} <ExternalLink size={11} className="text-fg-muted" />
                          </button>
                          {r.p.dev && <span className="ml-2 rounded bg-elevated px-1.5 font-mono text-[10.5px] text-fg-muted">dev</span>}
                        </td>
                        <td className="px-3 py-1.5 font-mono text-xs text-fg-secondary">{r.p.wanted}</td>
                        <td className="px-3 py-1.5 font-mono text-xs">{r.p.installed ?? <span className="text-warning">{k.notInstalled}</span>}</td>
                        <td className="px-3 py-1.5 font-mono text-xs text-fg-secondary">{r.latest ?? '—'}</td>
                        <td className="px-3 py-1.5">
                          <span className="flex flex-wrap gap-1">
                            <Badge color={LEVEL_COLOR[r.level]}>{k.levels[r.level]}</Badge>
                            {vuln && <Badge color={SEVERITY_COLOR[vuln]}><ShieldAlert size={11} /> {k.severities[vuln]}</Badge>}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-right">
                          {r.update && (
                            <Button size="sm" variant={r.level === 'major' ? 'ghost' : 'secondary'} disabled={!!running} onClick={() => apply(m, [r.update!])}>
                              {r.update.target === 'compatible' ? k.update : k.updateTo.replace('{v}', r.latest ?? '')}
                            </Button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}

            {picked.length > 0 && (
              <div className="flex items-center gap-3 border-t border-line-subtle px-[18px] py-3">
                <span className="text-sm text-fg-secondary">{k.selected.replace('{n}', String(picked.length))}</span>
                <Button size="sm" disabled={!!running} onClick={() => apply(m, picked)}><ArrowUpCircle size={13} /> {k.updateSelected}</Button>
              </div>
            )}

            {running === m.dir && (
              <pre aria-label={k.log} className="max-h-60 overflow-auto border-t border-line-subtle bg-canvas px-[18px] py-3 font-mono text-xs text-fg-secondary">{log.join('\n') || '…'}</pre>
            )}
          </Card>
        )
      })}

      {!running && log.length > 0 && (
        <details className="rounded-[14px] border border-line">
          <summary className="cursor-pointer px-[18px] py-2.5 text-sm text-fg-secondary">{k.lastLog}</summary>
          <pre aria-label={k.log} className="max-h-60 overflow-auto border-t border-line-subtle bg-canvas px-[18px] py-3 font-mono text-xs text-fg-secondary">{log.join('\n')}</pre>
        </details>
      )}
    </div>
  )
}

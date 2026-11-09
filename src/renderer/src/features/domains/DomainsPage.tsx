import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ExternalLink, FileCheck2, FileWarning, Globe, Plus, ShieldCheck, ToggleRight, Trash2 } from 'lucide-react'
import type { DomainSuggestion, DomainsStatus, ListeningPort, LocalDomain, PortProject } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useToast } from '@renderer/app/ToastContext'
import { cn } from '@renderer/lib/cn'
import Badge from '@renderer/components/ui/Badge'
import Button from '@renderer/components/ui/Button'
import EmptyState from '@renderer/components/ui/EmptyState'
import IconButton from '@renderer/components/ui/IconButton'
import Switch from '@renderer/components/ui/Switch'
import { Input } from '@renderer/components/ui/Input'
import { Page, PageHeader } from '@renderer/components/ui/Page'
import Suggestions from '@renderer/components/ui/Suggestions'
import { Table, Td, Th } from '@renderer/components/ui/Table'
import { errorText } from '@renderer/lib/errors'

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/** One of the three state cards at the top, as in the mock-up */
function StateCard({ icon, title, detail, action, i }: { icon: ReactNode; title: string; detail: ReactNode; action?: ReactNode; i: number }) {
  return (
    <div className="df-rise flex min-w-0 flex-col gap-2 rounded-card border border-line-subtle bg-surface px-4 py-3.5" style={{ '--i': i } as CSSProperties}>
      <div className="flex items-center gap-2.5">
        {icon}
        <h2 className="min-w-0 flex-1 truncate font-semibold text-fg">{title}</h2>
        {action}
      </div>
      <div className="min-w-0 truncate text-xs text-fg-muted">{detail}</div>
    </div>
  )
}

export default function DomainsPage() {
  const { t } = useI18n()
  const d = t.domains
  const toast = useToast()
  const [domains, setDomains] = useState<LocalDomain[]>([])
  const [status, setStatus] = useState<DomainsStatus | null>(null)
  const [suggested, setSuggested] = useState<DomainSuggestion[]>([])
  const [draft, setDraft] = useState({ name: '', port: '3000' })
  const [adding, setAdding] = useState(false)
  const [applying, setApplying] = useState(false)
  /** Ports listening now (null until read): whether each domain answers */
  const [listening, setListening] = useState<ListeningPort[] | null>(null)
  const [owners, setOwners] = useState<PortProject[]>([])
  const alive = useRef(true)

  const reload = useCallback(async () => {
    const [list, st] = await Promise.all([window.devforge.domains.list(), window.devforge.domains.status()])
    if (!alive.current) return
    setDomains(list)
    setStatus(st)
    window.devforge.getListeningPorts().then(p => { if (alive.current) setListening(p) }).catch(() => { if (alive.current) setListening([]) })
  }, [])

  useEffect(() => {
    alive.current = true
    reload()
    window.devforge.suggest.domains().then(s => { if (alive.current) setSuggested(s) }).catch(() => {})
    // The project of each port reads every process's command line: once, when the page opens
    window.devforge.suggest.portProjects().then(o => { if (alive.current) setOwners(o) }).catch(() => {})
    return () => { alive.current = false }
  }, [reload])

  async function save(domain: LocalDomain) {
    try {
      await window.devforge.domains.save(domain)
      await reload()
      return true
    } catch (err) {
      toast.show({ tone: 'error', title: d.saveFailed, description: errorText(err) })
      return false
    }
  }

  async function add() {
    const name = draft.name.trim().toLowerCase()
    const domain = /\.(test|localhost)$/.test(name) ? name : `${slug(name)}.test`
    if (await save({ id: crypto.randomUUID(), domain, port: Number(draft.port), enabled: true })) {
      setDraft({ name: '', port: '3000' })
      setAdding(false)
    }
  }

  async function applyHosts() {
    setApplying(true)
    const r = await window.devforge.domains.applyHosts()
    setApplying(false)
    toast.show(r.ok ? { tone: 'success', title: d.hostsUpdated } : { tone: 'error', title: d.hostsFailed, description: r.error })
    reload()
  }

  const suffix = status?.proxyPort && status.proxyPort !== 80 ? `:${status.proxyPort}` : ''
  const active = domains.filter(x => x.enabled).length
  const proxyOn = !!status?.proxyPort
  const stateOf = (dom: LocalDomain) => !dom.enabled
    ? <span className="text-sm text-fg-muted">{d.stateOff}</span>
    : listening === null
      ? <span className="text-fg-disabled">—</span>
      : listening.some(l => l.port === dom.port)
        ? <Badge color="success" dot>{d.stateUp}</Badge>
        : <Badge>{d.stateDown}</Badge>

  return (
    <Page className="df-mockup">
      <PageHeader crumb={t.nav.groupSystem} title={d.title}
        subtitle={<><span className="font-mono">shop.test</span> {d.subtitleInstead} <span className="font-mono">localhost:3000</span>.</>}
        actions={<Button onClick={() => setAdding(v => !v)} aria-expanded={adding}><Plus size={14} aria-hidden /> {d.newDomain}</Button>}
      />

      {/* The proxy, the hosts file, the domains on */}
      <div className="grid gap-4 md:grid-cols-3">
        <StateCard i={0}
          icon={<span aria-hidden className={cn('size-2.5 shrink-0 rounded-full', proxyOn ? 'bg-success df-ping' : active ? 'bg-danger' : 'bg-fg-muted')} />}
          title={proxyOn ? d.proxyRunning : d.proxyOff}
          detail={status?.proxyError ?? (proxyOn ? (status!.proxyPort !== 80 ? d.portFallback : d.proxyPorts.replace('{port}', String(status!.proxyPort))) : d.proxyHint)} />
        <StateCard i={1}
          icon={status?.hostsInSync ? <FileCheck2 size={16} aria-hidden className="shrink-0 text-success" /> : <FileWarning size={16} aria-hidden className="shrink-0 text-warning" />}
          title={status?.hostsInSync ? d.hostsOk : d.hostsOutdated}
          detail={<span className="font-mono" title={status?.hostsPath}>{status?.hostsPath}</span>}
          action={!status?.hostsInSync && status && (
            <Button size="sm" onClick={applyHosts} loading={applying}>{!applying && <ShieldCheck size={13} aria-hidden />} {d.applyHosts}</Button>
          )} />
        {domains.length > 0 && <StateCard i={2}
          icon={<ToggleRight size={16} aria-hidden className="shrink-0 text-fg-secondary" />}
          title={d.activeCount.replace('{n}', String(active)).replace('{total}', String(domains.length))}
          detail={d.activeHint} />}
      </div>

      {/* A new domain: its name, the port it leads to, or one found in the projects */}
      {adding && (
        <div className="df-rise flex flex-col gap-3 rounded-card border border-line-subtle bg-surface p-4">
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex min-w-[220px] flex-1 flex-col gap-1.5">
              <span className="text-xs font-medium text-fg-secondary">{d.domain}</span>
              <div className="flex items-center">
                <Input autoFocus value={draft.name} onChange={e => setDraft(x => ({ ...x, name: e.target.value }))} placeholder="shop" className="rounded-r-none font-mono"
                  onKeyDown={e => { if (e.key === 'Enter' && draft.name) add(); if (e.key === 'Escape') setAdding(false) }} />
                {!/\.(test|localhost)$/.test(draft.name) && (
                  <span className="flex h-9 items-center rounded-r-lg border border-l-0 border-line bg-active px-3 font-mono text-sm text-fg-secondary">.test</span>
                )}
              </div>
            </label>
            <ArrowRight size={16} aria-hidden className="mb-2.5 text-fg-muted" />
            <label className="flex w-40 flex-col gap-1.5">
              <span className="text-xs font-medium text-fg-secondary">localhost:</span>
              <Input type="number" value={draft.port} onChange={e => setDraft(x => ({ ...x, port: e.target.value }))} className="font-mono" />
            </label>
            <Button variant="ghost" onClick={() => setAdding(false)}>{t.common.cancel}</Button>
            <Button onClick={add} disabled={!draft.name.trim()}><Plus size={14} aria-hidden /> {d.add}</Button>
          </div>
          <Suggestions
            title={d.suggestions}
            items={suggested.map(s => ({
              key: s.domain,
              label: <span className="font-mono">{s.domain} → :{s.port}</span>,
              hint: s.running ? `● ${d.running}` : s.source,
              onPick: async () => {
                if (await save({ id: crypto.randomUUID(), domain: s.domain, port: s.port, enabled: true })) {
                  setSuggested(list => list.filter(x => x.domain !== s.domain))
                }
              }
            }))}
          />
        </div>
      )}

      {/* The domains */}
      {domains.length === 0 ? (
        <EmptyState icon={<Globe size={32} />} title={d.emptyTitle} description={d.emptyHint} />
      ) : (
        <div className="df-rise overflow-hidden rounded-card border border-line-subtle bg-surface" style={{ '--i': 3 } as CSSProperties}>
          <Table>
            <thead>
              <tr>
                <Th>{d.domain}</Th>
                <Th>{d.colTarget}</Th>
                <Th>{d.colProject}</Th>
                <Th>{d.colState}</Th>
                <Th align="right">{d.colActions}</Th>
              </tr>
            </thead>
            <tbody>
              {domains.map(dom => {
                const owner = owners.find(o => o.port === dom.port)
                return (
                  <tr key={dom.id} className="group">
                    <Td className={cn('font-mono font-bold', dom.enabled ? 'text-fg' : 'font-normal text-fg-muted')}>{dom.domain}</Td>
                    <Td className="font-mono text-fg-secondary">localhost:{dom.port}</Td>
                    <Td>
                      {owner
                        ? <Link to={`/project/${owner.projectId}`} className={cn('hover:text-accent', dom.enabled ? 'text-fg' : 'text-fg-muted')}>{owner.projectName}</Link>
                        : <span className="text-fg-disabled">—</span>}
                    </Td>
                    <Td>{stateOf(dom)}</Td>
                    <Td align="right">
                      <span className="inline-flex items-center gap-1.5">
                        <IconButton size="sm" tone="danger" title={d.removeDomain.replace('{domain}', dom.domain)}
                          className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100"
                          onClick={async () => { await window.devforge.domains.remove(dom.id); reload() }}>
                          <Trash2 size={13} />
                        </IconButton>
                        {dom.enabled && proxyOn && (
                          <IconButton size="sm" title={d.openDomain.replace('{url}', `http://${dom.domain}${suffix}`)} onClick={() => window.devforge.openExternal(`http://${dom.domain}${suffix}`)}>
                            <ExternalLink size={13} />
                          </IconButton>
                        )}
                        <Switch checked={dom.enabled} onChange={v => save({ ...dom, enabled: v })} label={dom.domain} />
                      </span>
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </Table>
        </div>
      )}
    </Page>
  )
}
